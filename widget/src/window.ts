import {
  getCurrentWindow,
  LogicalSize,
  PhysicalPosition,
  currentMonitor,
  type Monitor,
} from '@tauri-apps/api/window';

const COMPACT_W = 240;
const COMPACT_H = 230;
const EDGE_THRESHOLD = 30;

let cachedMonitor: Monitor | null = null;
let compactMovePending = false;

async function getMonitor(): Promise<Monitor | null> {
  if (!cachedMonitor) cachedMonitor = await currentMonitor();
  return cachedMonitor;
}

export async function setWindowSize(width: number, height: number): Promise<void> {
  await getCurrentWindow().setSize(new LogicalSize(width, height));
}

export async function showWindow(): Promise<void> {
  await getCurrentWindow().show();
}

export async function closeWindow(): Promise<void> {
  await getCurrentWindow().close();
}

export async function getWindowOuterY(): Promise<number> {
  return (await getCurrentWindow().outerPosition()).y;
}

export async function listenToMoved(callback: () => void): Promise<() => void> {
  return getCurrentWindow().onMoved(callback);
}

export async function checkDockPosition(
  normalWidth: number,
  onDock: () => void,
): Promise<void> {
  const win = getCurrentWindow();
  const monitor = await getMonitor();
  if (!monitor) return;

  const pos = await win.outerPosition();
  const sf = await win.scaleFactor();
  const widgetRight = pos.x + Math.round(normalWidth * sf);
  const monitorRight = monitor.position.x + monitor.size.width;

  if (widgetRight >= monitorRight - Math.round(EDGE_THRESHOLD * sf)) {
    const compactWPhys = Math.round(COMPACT_W * sf);
    const compactHPhys = Math.round(COMPACT_H * sf);
    const dockX = monitorRight - compactWPhys;
    const dockY = monitor.position.y + Math.floor((monitor.size.height - compactHPhys) / 2);
    await win.setSize(new LogicalSize(COMPACT_W, COMPACT_H));
    await win.setPosition(new PhysicalPosition(dockX, dockY));
    onDock();
  }
}

export async function exitCompactCentered(
  normalWidth: number,
  normalHeight: number,
  onExpand: () => void,
): Promise<void> {
  const win = getCurrentWindow();
  const monitor = await getMonitor();
  if (!monitor) {
    await win.setSize(new LogicalSize(normalWidth, normalHeight));
    onExpand();
    return;
  }
  const sf = await win.scaleFactor();
  const centerX =
    monitor.position.x + Math.floor((monitor.size.width - Math.round(normalWidth * sf)) / 2);
  const centerY =
    monitor.position.y + Math.floor((monitor.size.height - Math.round(normalHeight * sf)) / 2);
  await win.setSize(new LogicalSize(normalWidth, normalHeight));
  await win.setPosition(new PhysicalPosition(centerX, centerY));
  onExpand();
}

export async function moveCompactVertical(targetPhysY: number): Promise<void> {
  if (compactMovePending) return;
  compactMovePending = true;
  try {
    const monitor = await getMonitor();
    if (!monitor) return;
    const win = getCurrentWindow();
    const sf = await win.scaleFactor();
    const compactWPhys = Math.round(COMPACT_W * sf);
    const compactHPhys = Math.round(COMPACT_H * sf);
    const dockX = monitor.position.x + monitor.size.width - compactWPhys;
    const minY = monitor.position.y;
    const maxY = monitor.position.y + monitor.size.height - compactHPhys;
    const clampedY = Math.max(minY, Math.min(maxY, Math.round(targetPhysY)));
    await win.setPosition(new PhysicalPosition(dockX, clampedY));
  } finally {
    compactMovePending = false;
  }
}
