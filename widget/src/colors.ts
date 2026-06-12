export const TASK_COLORS = [
  '#0A84FF', '#BF5AF2', '#FF375F', '#FF9F0A',
  '#32D74B', '#5E5CE6', '#64D2FF', '#FFD60A',
];

export function colorForTask(index: number): string {
  return TASK_COLORS[index % TASK_COLORS.length];
}

export function hexToRgba(hex: string, alpha: number): string {
  const r = parseInt(hex.slice(1, 3), 16);
  const g = parseInt(hex.slice(3, 5), 16);
  const b = parseInt(hex.slice(5, 7), 16);
  return `rgba(${r},${g},${b},${alpha})`;
}

export function darkenHex(hex: string, amount: number): string {
  const r = Math.round(parseInt(hex.slice(1, 3), 16) * (1 - amount));
  const g = Math.round(parseInt(hex.slice(3, 5), 16) * (1 - amount));
  const b = Math.round(parseInt(hex.slice(5, 7), 16) * (1 - amount));
  return `rgb(${r},${g},${b})`;
}
