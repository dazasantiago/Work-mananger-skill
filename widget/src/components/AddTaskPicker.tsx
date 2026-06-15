import { useMemo, useState } from 'react';
import type { AvailableTask } from '../types';
import RangeSlider from './RangeSlider';

interface Props {
  availableTasks: AvailableTask[];
  excludeIds: Set<string>;
  onPick: (task: AvailableTask) => void;
  onCreateNew: () => void;
  onCancel: () => void;
}

// Cycles Todos -> Pendiente -> En progreso -> Todos on each click of the chip.
const STATUS_CYCLE = ['', 'Pendiente', 'En progreso'] as const;
const STATUS_LABELS: Record<string, string> = {
  '': 'Todos',
  'Pendiente': 'Pendiente',
  'En progreso': 'En progreso',
};

const TIME_MIN = 0;
const TIME_MAX = 120;
const TIME_STEP = 5;

function formatTime(v: number): string {
  if (v >= TIME_MAX) return `${TIME_MAX}+ min`;
  return `${v} min`;
}

function matchesTime(leftMin: number | undefined | null, [lo, hi]: [number, number]): boolean {
  if (lo === TIME_MIN && hi === TIME_MAX) return true;
  if (leftMin == null) return false;
  if (leftMin < lo) return false;
  if (hi < TIME_MAX && leftMin > hi) return false;
  return true;
}

export default function AddTaskPicker({ availableTasks, excludeIds, onPick, onCreateNew, onCancel }: Props) {
  const [projectFilter, setProjectFilter] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('');
  const [timeRange, setTimeRange] = useState<[number, number]>([TIME_MIN, TIME_MAX]);

  const pending = useMemo(
    () => availableTasks.filter(t => !excludeIds.has(t.id)),
    [availableTasks, excludeIds],
  );

  const projectOptions = useMemo(() => {
    const names = new Set<string>();
    let hasNone = false;
    for (const t of pending) {
      if (t.project) names.add(t.project);
      else hasNone = true;
    }
    return { names: Array.from(names).sort((a, b) => a.localeCompare(b)), hasNone };
  }, [pending]);

  const filtered = pending.filter(t => {
    if (projectFilter === '__none__' ? !!t.project : projectFilter && t.project !== projectFilter) return false;
    if (statusFilter && t.status !== statusFilter) return false;
    if (!matchesTime(t.left_min, timeRange)) return false;
    return true;
  });

  function cycleStatus() {
    setStatusFilter(s => STATUS_CYCLE[(STATUS_CYCLE.indexOf(s as typeof STATUS_CYCLE[number]) + 1) % STATUS_CYCLE.length]);
  }

  return (
    <div className="task-picker">
      <div className="task-picker-filters">
        <select value={projectFilter} onChange={e => setProjectFilter(e.target.value)}>
          <option value="">Todos los proyectos</option>
          {projectOptions.names.map(p => (
            <option key={p} value={p}>{p}</option>
          ))}
          {projectOptions.hasNone && <option value="__none__">Sin proyecto</option>}
        </select>
        <button type="button" className="filter-chip" onClick={cycleStatus}>
          {statusFilter && (
            <span className={`task-picker-status-dot ${statusFilter === 'En progreso' ? 'in-progress' : 'pending'}`} />
          )}
          {STATUS_LABELS[statusFilter]}
        </button>
      </div>

      <RangeSlider
        min={TIME_MIN}
        max={TIME_MAX}
        step={TIME_STEP}
        value={timeRange}
        onChange={setTimeRange}
        formatValue={formatTime}
      />

      <div className="task-picker-list">
        {filtered.length === 0 ? (
          <div className="task-picker-empty">
            {pending.length === 0
              ? 'No hay otras tareas pendientes en Notion.'
              : 'Ninguna tarea coincide con estos filtros.'}
          </div>
        ) : (
          filtered.map(task => (
            <button key={task.id} className="task-picker-item" onClick={() => onPick(task)}>
              <span
                className={`task-picker-status-dot ${task.status === 'En progreso' ? 'in-progress' : 'pending'}`}
                title={task.status}
              />
              <div className="task-picker-item-info">
                <span className="task-picker-item-name">{task.name}</span>
                <span className="task-picker-item-meta">
                  {[task.project, task.left_min != null ? `~${task.left_min} min` : null]
                    .filter(Boolean)
                    .join(' · ') || '—'}
                </span>
              </div>
              <span className="task-picker-add">+</span>
            </button>
          ))
        )}
      </div>

      <div className="task-picker-actions">
        <button onClick={onCancel}>Cancelar</button>
        <button className="primary" onClick={onCreateNew}>+ Crear nueva tarea</button>
      </div>
    </div>
  );
}
