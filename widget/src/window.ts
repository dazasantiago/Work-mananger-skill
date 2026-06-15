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
const COMPACT_SNAP = 40;

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

export async function getWindowOuterPosition(): Promise<{ x: number; y: number }> {
  const pos = await getCurrentWindow().outerPosition();
  return { x: pos.x, y: pos.y };
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
  const edgePhys = Math.round(EDGE_THRESHOLD * sf);
  const monitorLeft = monitor.position.x;
  const monitorRight = monitor.position.x + monitor.size.width;
  const widgetRight = pos.x + Math.round(normalWidth * sf);

  const nearRight = widgetRight >= monitorRight - edgePhys;
  const nearLeft = pos.x <= monitorLeft + edgePhys;
  if (!nearRight && !nearLeft) return;

  const compactWPhys = Math.round(COMPACT_W * sf);
  const compactHPhys = Math.round(COMPACT_H * sf);
  const dockX = nearRight ? monitorRight - compactWPhys : monitorLeft;
  const dockY = monitor.position.y + Math.floor((monitor.size.height - compactHPhys) / 2);
  await win.setSize(new LogicalSize(COMPACT_W, COMPACT_H));
  await win.setPosition(new PhysicalPosition(dockX, dockY));
  onDock();
}

// Free 2D drag for the compact widget. Clamped to the monitor bounds; while
// an edge of the window is within COMPACT_SNAP of the matching monitor edge,
// X sticks to that edge (magnetism). Moving back out beyond that zone frees
// it again — the underlying target position always tracks the mouse, so the
// stick releases as soon as the cursor leaves the snap zone.
export async function moveCompactFree(targetPhysX: number, targetPhysY: number): Promise<void> {
  if (compactMovePending) return;
  compactMovePending = true;
  try {
    const monitor = await getMonitor();
    if (!monitor) return;
    const win = getCurrentWindow();
    const sf = await win.scaleFactor();
    const compactWPhys = Math.round(COMPACT_W * sf);
    const compactHPhys = Math.round(COMPACT_H * sf);
    const snapPhys = Math.round(COMPACT_SNAP * sf);

    const minX = monitor.position.x;
    const maxX = monitor.position.x + monitor.size.width - compactWPhys;
    const minY = monitor.position.y;
    const maxY = monitor.position.y + monitor.size.height - compactHPhys;

    let x = Math.max(minX, Math.min(maxX, Math.round(targetPhysX)));
    const y = Math.max(minY, Math.min(maxY, Math.round(targetPhysY)));

    if (x - minX <= snapPhys) x = minX;
    else if (maxX - x <= snapPhys) x = maxX;

    await win.setPosition(new PhysicalPosition(x, y));
  } finally {
    compactMovePending = false;
  }
}

// Called on drag end. If the compact widget is resting near the left or
// right edge (magnetism still applies), it stays docked there. Otherwise it
// was pulled out into the middle of the screen, so expand it back to normal
// size in place (clamped so it doesn't spill off-screen).
export async function finishCompactDrag(
  normalWidth: number,
  normalHeight: number,
  onExpand: () => void,
): Promise<void> {
  const monitor = await getMonitor();
  if (!monitor) return;
  const win = getCurrentWindow();
  const sf = await win.scaleFactor();
  const pos = await win.outerPosition();
  const compactWPhys = Math.round(COMPACT_W * sf);
  const snapPhys = Math.round(COMPACT_SNAP * sf);
  const minX = monitor.position.x;
  const maxX = monitor.position.x + monitor.size.width - compactWPhys;

  const nearEdge = pos.x - minX <= snapPhys || maxX - pos.x <= snapPhys;
  if (nearEdge) return;

  const normalWPhys = Math.round(normalWidth * sf);
  const normalHPhys = Math.round(normalHeight * sf);
  const minExpX = monitor.position.x;
  const maxExpX = monitor.position.x + monitor.size.width - normalWPhys;
  const minExpY = monitor.position.y;
  const maxExpY = monitor.position.y + monitor.size.height - normalHPhys;
  const x = Math.max(minExpX, Math.min(maxExpX, pos.x));
  const y = Math.max(minExpY, Math.min(maxExpY, pos.y));

  await win.setSize(new LogicalSize(normalWidth, normalHeight));
  await win.setPosition(new PhysicalPosition(x, y));
  onExpand();
}
