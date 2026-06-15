import { useEffect, useRef } from 'react';
import type { Task } from '../types';
import { fmt, liveMs } from '../useNow';
import { getWindowOuterPosition, moveCompactFree, finishCompactDrag } from '../window';

interface Props {
  plannedMin: number;
  sessionStart: number;
  members: Task[];
  now: number;
  isPaused: boolean;
  normalWidth: number;
  normalHeight: number;
  onTogglePause: () => void;
  onExpand: () => void;
  onDone: (id: string) => void;
  onToggleNotes: (id: string) => void;
  onSetNotes: (id: string, notes: string) => void;
}

interface DragState {
  startMouseScreenX: number;
  startMouseScreenY: number;
  startWinPhysX: number;
  startWinPhysY: number;
  pending: boolean;
}

export default function CompactCard({
  plannedMin, sessionStart, members, now, isPaused, normalWidth, normalHeight, onTogglePause, onExpand,
  onDone, onToggleNotes, onSetNotes,
}: Props) {
  const dragRef = useRef<DragState | null>(null);
  const elapsed = fmt(now - sessionStart);
  const head = members[0] ?? null;
  const cardColor = head?.color ?? '#5e5ce6';
  const isBlock = members.length > 1;
  const totalMs = members.reduce((s, m) => s + liveMs(m, now, members.length), 0);
  const totalLeft = members.reduce((s, m) => s + (m.left_min ?? 0), 0);
  const isOver = totalLeft > 0 ? (totalMs / 60000) >= totalLeft : false;
  const progress = totalLeft > 0 ? Math.min(100, (totalMs / (totalLeft * 60000)) * 100) : 0;

  useEffect(() => {
    const handleMouseMove = async (e: MouseEvent) => {
      const drag = dragRef.current;
      if (!drag || drag.pending || drag.startWinPhysX === -1) return;
      const targetPhysX = drag.startWinPhysX + (e.screenX - drag.startMouseScreenX) * window.devicePixelRatio;
      const targetPhysY = drag.startWinPhysY + (e.screenY - drag.startMouseScreenY) * window.devicePixelRatio;
      drag.pending = true;
      try { await moveCompactFree(targetPhysX, targetPhysY); } finally { drag.pending = false; }
    };
    const handleMouseUp = async () => {
      if (!dragRef.current) return;
      dragRef.current = null;
      await finishCompactDrag(normalWidth, normalHeight, onExpand);
    };
    window.addEventListener('mousemove', handleMouseMove);
    window.addEventListener('mouseup', handleMouseUp);
    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
    };
  }, [normalWidth, normalHeight, onExpand]);

  async function handleMouseDown(e: React.MouseEvent) {
    e.stopPropagation();
    dragRef.current = {
      startMouseScreenX: e.screenX, startMouseScreenY: e.screenY,
      startWinPhysX: -1, startWinPhysY: -1, pending: false,
    };
    const pos = await getWindowOuterPosition();
    if (dragRef.current) { dragRef.current.startWinPhysX = pos.x; dragRef.current.startWinPhysY = pos.y; }
  }

  return (
    <div className="compact-view" onMouseDown={handleMouseDown}>
      <div className="compact-top">
        <div className="compact-timer-wrap">
          <span className="compact-timer">{elapsed}</span>
          <span className="compact-planned"> / {plannedMin} min</span>
        </div>
      </div>

      <div className="compact-card" style={{ '--task-color': cardColor } as React.CSSProperties}>
        {head ? (
          <>
            <div className="compact-card-header">
              {!isBlock && head.project && <div className="compact-project">{head.project}</div>}
              {!isBlock ? (
                <div className="compact-task-name">{head.name}</div>
              ) : (
                <div className="compact-project">{members.length} tareas en bloque</div>
              )}
              <div className="compact-clock-row">
                <span className={`compact-task-clock${isOver ? ' over' : ''}`}>{fmt(totalMs)}</span>
                {totalLeft ? <span className="compact-left">/ {totalLeft} min</span> : null}
              </div>
              {totalLeft ? (
                <div className="compact-progress">
                  <div className={`compact-progress-fill${isOver ? ' over' : ''}`} style={{ width: `${progress}%` }} />
                </div>
              ) : null}
            </div>

            <div className="compact-members">
              {members.map(m => (
                <CompactMemberRow
                  key={m.id}
                  task={m}
                  now={now}
                  blockSize={members.length}
                  showName={isBlock}
                  onDone={onDone}
                  onToggleNotes={onToggleNotes}
                  onSetNotes={onSetNotes}
                />
              ))}
            </div>
          </>
        ) : (
          <div className="compact-project">Sin tareas pendientes</div>
        )}

        {isPaused && (
          <div className="compact-pause-overlay" onMouseDown={e => e.stopPropagation()} onClick={onTogglePause}>
            <svg width="18" height="18" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
              <path d="M2.5 1.5V10.5L10 6L2.5 1.5Z" fill="currentColor" />
            </svg>
          </div>
        )}
      </div>
    </div>
  );
}

function CompactMemberRow({
  task, now, blockSize, showName, onDone, onToggleNotes, onSetNotes,
}: {
  task: Task;
  now: number;
  blockSize: number;
  showName: boolean;
  onDone: (id: string) => void;
  onToggleNotes: (id: string) => void;
  onSetNotes: (id: string, notes: string) => void;
}) {
  const elapsed = liveMs(task, now, blockSize);

  return (
    <div className="compact-member-row">
      <div className="compact-member-top">
        {showName && <span className="compact-member-dot" style={{ background: task.color }} />}
        {showName && <span className="compact-member-name">{task.name}</span>}
        <span className="compact-member-time">{fmt(elapsed)}</span>
        <div className="compact-member-actions">
          <button
            className="compact-icon-btn"
            title={task.notesOpen ? 'Ocultar notas' : 'Notas'}
            onMouseDown={e => e.stopPropagation()}
            onClick={() => onToggleNotes(task.id)}
          >
            📝
          </button>
          <button
            className="compact-icon-btn compact-done-btn"
            title="Marcar como hecha"
            onMouseDown={e => e.stopPropagation()}
            onClick={() => onDone(task.id)}
          >
            {showName ? '✓' : 'Done ✓'}
          </button>
        </div>
      </div>
      {task.notesOpen && (
        <textarea
          className="compact-notes-area"
          placeholder="Notas para esta tarea…"
          value={task.notes}
          onChange={e => onSetNotes(task.id, e.target.value)}
          onMouseDown={e => e.stopPropagation()}
          onClick={e => e.stopPropagation()}
          rows={2}
        />
      )}
    </div>
  );
}
