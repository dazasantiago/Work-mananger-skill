import type { Task, SessionData, FinishPayload, FinishTask, CancelPayload } from './types';
import { liveMs } from './useNow';

// Each task has exactly one clock: `accumulated_ms`/`running_since`, ticking
// at 1/N speed while it's one of N members of an active block (1x when
// standalone). This mirrors the rate used by `finalize` and by the live
// per-task clocks in BlockSubRow/CompactCard — there is no separate split.
export function effectiveMs(tasks: Task[], task: Task, now: number): number {
  if (!task.blockId) return liveMs(task, now);
  const rate = tasks.filter(t => t.blockId === task.blockId && t.status !== 'done').length;
  return liveMs(task, now, rate);
}

export function generateSummary(
  tasks: Task[],
  session: SessionData,
  sessionStart: number,
): string {
  const now = Date.now();
  const actual = Math.round((now - sessionStart) / 60000);
  const realTasks = tasks.filter(t => !t.is_new);

  const done = realTasks.filter(t => t.status === 'done');
  const inProgress = realTasks.filter(t => t.status !== 'done' && effectiveMs(tasks, t, now) > 0);
  const notStarted = realTasks.filter(t => t.status !== 'done' && effectiveMs(tasks, t, now) === 0);

  const parts: string[] = [`Sesion de ${actual} min (planeado ${session.planned_min}).`];
  if (done.length)
    parts.push(`Completadas ${done.length}/${realTasks.length}: ${done.map(t => t.name).join(', ')}.`);
  if (inProgress.length)
    parts.push(`En progreso: ${inProgress.map(t => `${t.name} (${Math.round(effectiveMs(tasks, t, now) / 60000)} min)`).join(', ')}.`);
  if (notStarted.length)
    parts.push(`Sin iniciar: ${notStarted.map(t => t.name).join(', ')}.`);

  const newTasks = tasks.filter(t => t.is_new);
  if (newTasks.length)
    parts.push(`Tareas nuevas agregadas: ${newTasks.map(t => t.name).join(', ')}.`);

  return parts.join(' ');
}

// Shared per-task mapper for the finish payload. `tasks` is the active list,
// used for block-rate lookups in `effectiveMs` — removed tasks have no
// `blockId`, so it's irrelevant for them and the same array works for both.
// `forcedStatus` overrides the derived done/in_progress/not_started status,
// used for tasks the user removed from the session mid-way.
function mapTask(tasks: Task[], t: Task, now: number, forcedStatus?: 'removed'): FinishTask {
  const ms = effectiveMs(tasks, t, now);
  let status: FinishTask['status'];
  if (forcedStatus) status = forcedStatus;
  else if (t.status === 'done') status = 'done';
  else if (ms > 0) status = 'in_progress';
  else status = 'not_started';
  return {
    id: t.id,
    name: t.name,
    project: t.project,
    project_is_new: t.project_is_new,
    left_min: t.left_min,
    initial_actual_min: t.initial_actual_min,
    actual_min: Math.round(ms / 60000),
    status,
    notes: t.notes,
    is_new: t.is_new,
  };
}

export function buildFinishPayload(
  tasks: Task[],
  removedTasks: Task[],
  session: SessionData,
  sessionStart: number,
): FinishPayload {
  const now = Date.now();
  const actual_min = Math.round((now - sessionStart) / 60000);
  const summary = generateSummary(tasks, session, sessionStart);

  return {
    session_id: session.session_id,
    session_title: session.session_title,
    planned_min: session.planned_min,
    actual_min,
    start: new Date(sessionStart).toISOString(),
    end: new Date(now).toISOString(),
    summary,
    tasks: [
      ...tasks.map(t => mapTask(tasks, t, now)),
      ...removedTasks.map(t => mapTask(tasks, t, now, 'removed')),
    ],
  };
}

export function buildCancelPayload(tasks: Task[], removedTasks: Task[], session: SessionData): CancelPayload {
  return {
    session_id: session.session_id,
    tasks: [...tasks, ...removedTasks].filter(t => !t.is_new).map(t => ({ id: t.id, prev_status: t.prev_status })),
  };
}
