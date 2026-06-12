import { getCurrentWindow } from '@tauri-apps/api/window';
import { fmt } from '../useNow';

interface Props {
  title: string;
  plannedMin: number;
  sessionStart: number;
  now: number;
}

function startDrag(e: React.MouseEvent) {
  if ((e.target as HTMLElement).closest('button')) return;
  getCurrentWindow().startDragging();
}

export default function Header({ title, plannedMin, sessionStart, now }: Props) {
  const elapsed = fmt(now - sessionStart);
  return (
    <div className="header" onMouseDown={startDrag}>
      <div className="title">{title}</div>
      <div className="timer">
        <span>{elapsed}</span>
        <span className="planned"> / {plannedMin} min</span>
      </div>
    </div>
  );
}
