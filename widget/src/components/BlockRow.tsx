import { motion, useDragControls } from 'framer-motion';
import type { Task } from '../types';
import { fmt, liveMs, displayMs } from '../useNow';
import { hexToRgba } from '../colors';

interface Props {
  members: Task[];
  rowId?: string;
  isCurrent: boolean;
  now: number;
  isMergeTarget: boolean;
  dropEdge?: 'before' | 'after';
  onDone: (id: string) => void;
  onUnmerge: (id: string) => void;
  onRemove: (id: string) => void;
  onDrag: (point: { x: number; y: number }) => void;
  onDragEnd: () => void;
}

export default function BlockRow({
  members,
  rowId,
  isCurrent,
  now,
  isMergeTarget,
  dropEdge,
  onDone,
  onUnmerge,
  onRemove,
  onDrag,
  onDragEnd,
}: Props) {
  const dragControls = useDragControls();
  const head = members[0];
  const sessionMs = members.reduce((s, m) => s + liveMs(m, now, members.length), 0);
  const totalDisplayMs = members.reduce((s, m) => s + displayMs(m, now, members.length), 0);
  const totalLeft = members.reduce((s, m) => s + Math.max(0, m.left_min ?? 0), 0);
  const isOver = totalLeft > 0 ? sessionMs / 60000 >= totalLeft : false;

  const rowStyle = {
    '--task-color': head.color,
    ...(isCurrent ? { background: hexToRgba(head.color, 0.14) } : {}),
  } as React.CSSProperties;

  const className = [
    'task-row',
    'block-row',
    isCurrent ? 'current' : '',
    isMergeTarget ? 'merge-target' : '',
    dropEdge === 'before' ? 'drop-before' : '',
    dropEdge === 'after' ? 'drop-after' : '',
  ]
    .filter(Boolean)
    .join(' ');

  return (
    <motion.div
      data-row-id={rowId}
      layout
      drag="y"
      dragListener={false}
      dragControls={dragControls}
      dragSnapToOrigin
      onDrag={(_, info) => onDrag(info.point)}
      onDragEnd={() => onDragEnd()}
      whileDrag={{ scale: 1.03, boxShadow: '0 10px 28px rgba(0,0,0,.4)', zIndex: 5 }}
      className={className}
      style={rowStyle}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      transition={{ duration: 0.25, ease: [0.4, 0, 0.2, 1] }}
    >
      <div className="task-row-main">
        <div
          className="drag-handle"
          onPointerDown={(e) => dragControls.start(e)}
          title="Reordenar"
        >
          ⠿
        </div>

        <div className="task-info">
          <span className="task-name">{members.map(m => m.name).join('  +  ')}</span>
          <span className="task-meta">
            {totalLeft ? `~${totalLeft} min total · ${members.length} tareas` : `${members.length} tareas`}
          </span>
        </div>

        {(isCurrent || totalDisplayMs > 0) && (
          <div className="task-clock-wrap">
            <span className={`task-clock${isOver ? ' over' : ''}`}>{fmt(totalDisplayMs)}</span>
          </div>
        )}
      </div>

      <div className="block-members">
        {members.map(m => (
          <BlockSubRow
            key={m.id}
            task={m}
            now={now}
            blockSize={members.length}
            onDone={() => onDone(m.id)}
            onUnmerge={() => onUnmerge(m.id)}
            onRemove={() => onRemove(m.id)}
          />
        ))}
      </div>
    </motion.div>
  );
}

function BlockSubRow({
  task,
  now,
  blockSize,
  onDone,
  onUnmerge,
  onRemove,
}: {
  task: Task;
  now: number;
  blockSize: number;
  onDone: () => void;
  onUnmerge: () => void;
  onRemove: () => void;
}) {
  const sessionElapsed = liveMs(task, now, blockSize);
  const totalElapsed = displayMs(task, now, blockSize);
  const isOver = task.left_min ? (sessionElapsed / 60000) >= task.left_min : false;

  return (
    <motion.div
      className="block-subrow"
      style={{ '--task-color': task.color } as React.CSSProperties}
      drag
      dragSnapToOrigin
      dragElastic={0.15}
      whileDrag={{ scale: 1.04, boxShadow: '0 6px 16px rgba(0,0,0,.35)', zIndex: 3 }}
      onDragEnd={(_, info) => {
        if (Math.abs(info.offset.y) > 36 || Math.abs(info.offset.x) > 56) onUnmerge();
      }}
    >
      <span className="block-subrow-dot" style={{ background: task.color }} />
      <span className="block-subrow-name">{task.name}</span>
      {task.left_min ? <span className="block-subrow-meta">~{task.left_min} min</span> : null}
      <span className={`block-subrow-clock${isOver ? ' over' : ''}`}>{fmt(totalElapsed)}</span>
      <button
        className="block-subrow-done"
        onPointerDown={e => e.stopPropagation()}
        onClick={() => onDone()}
      >
        Done ✓
      </button>
      <button
        className="block-subrow-remove"
        onPointerDown={e => e.stopPropagation()}
        onClick={() => onRemove()}
        title="Quitar de la sesión"
      >
        ✕
      </button>
    </motion.div>
  );
}
