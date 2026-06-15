import { motion, useDragControls } from 'framer-motion';
import type { Task } from '../types';
import { fmt, liveMs } from '../useNow';
import { hexToRgba } from '../colors';

interface Props {
  task: Task;
  rowId?: string;
  isCurrent: boolean;
  now: number;
  isMergeTarget?: boolean;
  dropEdge?: 'before' | 'after';
  onDone: (id: string) => void;
  onUndo: (id: string) => void;
  onRemove: (id: string) => void;
  onToggleNotes: (id: string) => void;
  onSetNotes: (id: string, notes: string) => void;
  onDrag?: (point: { x: number; y: number }) => void;
  onDragEnd?: () => void;
}

export default function TaskRow({
  task,
  rowId,
  isCurrent,
  now,
  isMergeTarget,
  dropEdge,
  onDone,
  onUndo,
  onRemove,
  onToggleNotes,
  onSetNotes,
  onDrag,
  onDragEnd,
}: Props) {
  const dragControls = useDragControls();
  const elapsed = liveMs(task, now);
  const isRunning = task.running_since !== null;
  const isOver = task.left_min ? (elapsed / 60000) >= task.left_min : false;
  const isDone = task.status === 'done';
  const showHandle = !isDone;

  const metaParts: string[] = [];
  if (task.project) metaParts.push(task.project);
  if (task.left_min) metaParts.push(`~${task.left_min} min`);
  const meta = metaParts.join(' · ') || '—';

  const rowStyle: React.CSSProperties = {
    '--task-color': task.color,
    ...(isCurrent ? { background: hexToRgba(task.color, 0.14) } : {}),
  } as React.CSSProperties;

  const className = [
    'task-row',
    isCurrent ? 'current' : '',
    task.status === 'done' ? 'done' : '',
    isMergeTarget ? 'merge-target' : '',
    dropEdge === 'before' ? 'drop-before' : '',
    dropEdge === 'after' ? 'drop-after' : '',
  ]
    .filter(Boolean)
    .join(' ');

  const content = (
    <>
      <div className="task-row-main">
        {showHandle && (
          <div
            className="drag-handle"
            onPointerDown={(e) => dragControls.start(e)}
            title="Reordenar"
          >
            ⠿
          </div>
        )}

        <div className="task-info">
          <span
            className="task-name"
            style={task.status === 'done' ? { textDecoration: 'line-through' } : undefined}
          >
            {task.name}
          </span>
          <span className="task-meta">{meta}</span>
        </div>

        {task.status !== 'done' && (isRunning || task.accumulated_ms > 0) && (
          <div className="task-clock-wrap">
            <span className={`task-clock${isOver ? ' over' : ''}`}>{fmt(elapsed)}</span>
          </div>
        )}

        <div className="task-actions">
          <button
            className="notes-toggle"
            title={task.notesOpen ? 'Ocultar notas' : 'Notas'}
            onClick={() => onToggleNotes(task.id)}
          >
            📝
          </button>
          {task.status === 'done' ? (
            <>
              <span className="task-meta">✓ {Math.round(task.accumulated_ms / 60000)} min</span>
              <button className="undo-btn" title="Deshacer" onClick={() => onUndo(task.id)}>
                ↩
              </button>
            </>
          ) : (
            <button
              className={isCurrent ? 'primary' : ''}
              onClick={() => onDone(task.id)}
            >
              Done ✓
            </button>
          )}
          <button className="remove-btn" title="Quitar de la sesión" onClick={() => onRemove(task.id)}>
            ✕
          </button>
        </div>
      </div>

      {task.notesOpen && (
        <textarea
          className="notes-area"
          placeholder="Notas para esta tarea…"
          value={task.notes}
          onChange={e => onSetNotes(task.id, e.target.value)}
          onClick={e => e.stopPropagation()}
          rows={3}
        />
      )}
    </>
  );

  if (!isDone) {
    return (
      <motion.div
        data-row-id={rowId}
        layout
        drag="y"
        dragListener={false}
        dragControls={dragControls}
        dragSnapToOrigin
        onDrag={(_, info) => onDrag?.(info.point)}
        onDragEnd={() => onDragEnd?.()}
        whileDrag={{ scale: 1.03, boxShadow: '0 10px 28px rgba(0,0,0,.4)', zIndex: 5 }}
        className={className}
        style={rowStyle}
        initial={{ opacity: 0, y: -8 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -8 }}
        transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
      >
        {content}
      </motion.div>
    );
  }

  return (
    <motion.div
      layout
      className={className}
      style={rowStyle}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 0.4, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
    >
      {content}
    </motion.div>
  );
}
