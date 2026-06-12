import { useEffect, useReducer, useRef, useState } from 'react';
import { invoke } from '@tauri-apps/api/core';
import { AnimatePresence, motion } from 'framer-motion';
import { colorForTask } from './colors';
import { useNow } from './useNow';
import { buildFinishPayload, buildCancelPayload } from './session';
import {
  setWindowSize,
  showWindow,
  closeWindow,
  checkDockPosition,
  exitCompactCentered,
  listenToMoved,
} from './window';
import type { SessionData, Task, TaskStatus, AppView } from './types';
import Header from './components/Header';
import TaskRow from './components/TaskRow';
import BlockRow from './components/BlockRow';
import AddTaskForm from './components/AddTaskForm';
import Controls from './components/Controls';
import CompactCard from './components/CompactCard';

function computeHeight(numTasks: number): number {
  return Math.max(360, Math.min(window.screen.height - 90, 230 + numTasks * 62));
}

// ── State model ─────────────────────────────────────────────────────────────
//
// `tasks` is the single source of truth: a flat, ordered list. Grouping lives
// only in each task's `blockId`; the first member of a block (by array order)
// is the block's head. There is exactly one rule for "what is running":
//
//   the first pending row is the active one, and only it runs.
//
// `finalize()` enforces that rule after every mutation. Nothing else touches
// timers, so there is no second place for the invariant to drift out of sync.

interface State {
  tasks: Task[];
  currentId: string | null;
  paused: boolean;
}

type Action =
  | { type: 'INIT'; tasks: Task[] }
  | { type: 'DONE_TASK'; id: string }
  | { type: 'UNDO_TASK'; id: string }
  | { type: 'ADD_TASK'; task: Task }
  | { type: 'SET_PAUSED'; paused: boolean }
  | { type: 'REORDER'; tasks: Task[] }
  | { type: 'TOGGLE_NOTES'; id: string }
  | { type: 'SET_NOTES'; id: string; notes: string }
  | { type: 'MERGE'; sourceId: string; targetId: string }
  | { type: 'UNMERGE'; id: string };

// Starts the clock on the front pending item (a whole block if the front is
// merged) and stops it on everything else, then derives `currentId` from the
// same front item. This is the *only* function that mutates `running_since`.
function finalize(tasks: Task[], paused: boolean): State {
  const front = tasks.find(t => t.status !== 'done') ?? null;
  const now = Date.now();
  const runIds =
    !front || paused
      ? new Set<string>()
      : front.blockId
        ? new Set(tasks.filter(t => t.blockId === front.blockId).map(t => t.id))
        : new Set([front.id]);

  const out = tasks.map(t => {
    const shouldRun = runIds.has(t.id);
    if (shouldRun && t.running_since === null) {
      return { ...t, running_since: now };
    }
    if (!shouldRun && t.running_since !== null) {
      const rate = t.blockId ? tasks.filter(x => x.blockId === t.blockId && x.status !== 'done').length : 1;
      return { ...t, accumulated_ms: t.accumulated_ms + (now - t.running_since) / rate, running_since: null };
    }
    return t;
  });

  return { tasks: out, currentId: front ? front.id : null, paused };
}

// Freezes every running task's clock at `now`, baking in whatever rate
// (1/block-size) was in effect — based on `tasks`' *current* block
// memberships — up to this instant, then rebases `running_since` to `now`.
// Call this before any reducer mutation that changes block membership, so
// the old rate is never retroactively replaced by the new one (or vice
// versa) for time that already elapsed under the old rate.
function settle(tasks: Task[], now: number): Task[] {
  return tasks.map(t => {
    if (t.running_since === null) return t;
    const rate = t.blockId ? tasks.filter(x => x.blockId === t.blockId && x.status !== 'done').length : 1;
    return { ...t, accumulated_ms: t.accumulated_ms + (now - t.running_since) / rate, running_since: now };
  });
}

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'INIT':
      return finalize(action.tasks, false);

    // Completes a single task on its own. If it's part of a block, it's
    // peeled out (its own clock — already running at 1/N speed — is baked
    // into accumulated_ms) and the rest of the block keeps running.
    case 'DONE_TASK': {
      const target = state.tasks.find(t => t.id === action.id);
      if (!target || target.status === 'done') return state;
      const now = Date.now();
      const settled = settle(state.tasks, now);
      let out = settled.map(t =>
        t.id === action.id
          ? { ...t, running_since: null, status: 'done' as TaskStatus, blockId: null }
          : t,
      );
      if (target.blockId) {
        const remaining = out.filter(t => t.blockId === target.blockId);
        if (remaining.length === 1) {
          out = out.map(t => (t.id === remaining[0].id ? { ...t, blockId: null } : t));
        }
      }
      return finalize(out, state.paused);
    }

    case 'UNDO_TASK': {
      const idx = state.tasks.findIndex(t => t.id === action.id && t.status === 'done');
      if (idx === -1) return state;
      const out = state.tasks.map(t =>
        t.id === action.id ? { ...t, status: 'pending' as TaskStatus } : t,
      );
      // Re-entered tasks rejoin the back of the pending list, so they don't
      // jump to the front and steal the active slot.
      const [revived] = out.splice(out.findIndex(t => t.id === action.id), 1);
      let lastPending = -1;
      out.forEach((t, i) => { if (t.status !== 'done') lastPending = i; });
      out.splice(lastPending + 1, 0, revived);
      return finalize(out, state.paused);
    }

    case 'ADD_TASK':
      return finalize([...state.tasks, action.task], state.paused);

    case 'SET_PAUSED':
      return finalize(state.tasks, action.paused);

    case 'REORDER':
      return finalize(action.tasks, state.paused);

    case 'TOGGLE_NOTES':
      return {
        ...state,
        tasks: state.tasks.map(t => (t.id === action.id ? { ...t, notesOpen: !t.notesOpen } : t)),
      };

    case 'SET_NOTES':
      return {
        ...state,
        tasks: state.tasks.map(t => (t.id === action.id ? { ...t, notes: action.notes } : t)),
      };

    case 'MERGE': {
      const { sourceId, targetId } = action;
      if (sourceId === targetId) return state;
      const source = state.tasks.find(t => t.id === sourceId);
      const target = state.tasks.find(t => t.id === targetId);
      if (!source || !target || source.status === 'done' || target.status === 'done') return state;
      // Already in the same block → nothing to do.
      if (source.blockId && source.blockId === target.blockId) return state;

      const now = Date.now();
      const settled = settle(state.tasks, now);

      const blockId = target.blockId ?? `block-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
      // Dragging a whole block onto another row carries all its members, so
      // blocks grow past two tasks instead of shedding members on each merge.
      const movingIds = source.blockId
        ? new Set(settled.filter(t => t.blockId === source.blockId).map(t => t.id))
        : new Set([sourceId]);

      const reassigned = settled.map(t =>
        t.id === targetId || movingIds.has(t.id) ? { ...t, blockId } : t,
      );
      const moving = reassigned.filter(t => movingIds.has(t.id));
      const rest = reassigned.filter(t => !movingIds.has(t.id));
      // Drop the moving members right after the block's last existing member.
      let insertAt = rest.length;
      for (let i = 0; i < rest.length; i++) {
        if (rest[i].blockId === blockId) insertAt = i + 1;
      }
      rest.splice(insertAt, 0, ...moving);
      return finalize(rest, state.paused);
    }

    case 'UNMERGE': {
      const task = state.tasks.find(t => t.id === action.id);
      if (!task || !task.blockId) return state;
      const now = Date.now();
      const settled = settle(state.tasks, now);
      const blockId = task.blockId;
      let out = settled.map(t => (t.id === action.id ? { ...t, blockId: null } : t));
      // A block of one is just a task — dissolve it.
      const remaining = out.filter(t => t.blockId === blockId);
      if (remaining.length === 1) {
        out = out.map(t => (t.id === remaining[0].id ? { ...t, blockId: null } : t));
      }
      return finalize(out, state.paused);
    }

    default:
      return state;
  }
}

// Moves top-level item `draggedId` to just before/after `targetId`. Pure; used
// only once, on drop, to commit a reorder.
function moveItem(order: Task[], draggedId: string, targetId: string, edge: 'before' | 'after'): Task[] {
  const dragged = order.find(t => t.id === draggedId);
  if (!dragged) return order;
  const without = order.filter(t => t.id !== draggedId);
  const targetIdx = without.findIndex(t => t.id === targetId);
  if (targetIdx === -1) return order;
  const insertAt = edge === 'before' ? targetIdx : targetIdx + 1;
  const result = [...without];
  result.splice(insertAt, 0, dragged);
  return result;
}

// ── App ───────────────────────────────────────────────────────────────────

type Drop = { targetId: string; mode: 'merge' | 'before' | 'after' };

export default function App() {
  const [session, setSession] = useState<SessionData | null>(null);
  const [{ tasks, currentId }, dispatch] = useReducer(reducer, { tasks: [], currentId: null, paused: false });
  const [sessionStart, setSessionStart] = useState(() => Date.now());
  const [pausedAt, setPausedAt] = useState<number | null>(null);
  const [view, setView] = useState<AppView>('session');
  const [addFormOpen, setAddFormOpen] = useState(false);
  const [closeConfirmOpen, setCloseConfirmOpen] = useState(false);
  const [cancelConfirmOpen, setCancelConfirmOpen] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [isCompact, setIsCompact] = useState(false);
  const [normalHeight, setNormalHeight] = useState(600);
  const [finishResult, setFinishResult] = useState<{ kept: number; removed: number } | null>(null);
  const [errorMessage, setErrorMessage] = useState('');
  const isCompactRef = useRef(false);
  const tasksRef = useRef<Task[]>([]);
  const taskListRef = useRef<HTMLDivElement>(null);
  const dropRef = useRef<Drop | null>(null);
  const [drop, setDrop] = useState<Drop | null>(null);
  const now = useNow();

  useEffect(() => { tasksRef.current = tasks; }, [tasks]);

  useEffect(() => {
    async function load() {
      let data: SessionData;
      try {
        data = await invoke<SessionData>('get_session_data');
      } catch {
        const mod = await import('../dev-session.json');
        data = mod.default as SessionData;
      }
      setSession(data);
      const initialTasks: Task[] = data.tasks.map((t, i) => ({
        id: t.id,
        name: t.name,
        project: t.project ?? null,
        left_min: t.left_min ?? null,
        initial_actual_min: t.initial_actual_min ?? 0,
        prev_status: t.prev_status ?? 'Pendiente',
        status: 'pending' as TaskStatus,
        accumulated_ms: 0,
        running_since: null,
        notes: '',
        notesOpen: false,
        is_new: false,
        project_is_new: false,
        color: colorForTask(i),
        blockId: null,
      }));
      dispatch({ type: 'INIT', tasks: initialTasks });

      const h = computeHeight(data.tasks.length);
      setNormalHeight(h);
      await setWindowSize(380, h);
      await showWindow();
    }
    load();
  }, []);

  useEffect(() => { isCompactRef.current = isCompact; }, [isCompact]);

  useEffect(() => {
    let unlisten: (() => void) | undefined;
    let timer: ReturnType<typeof setTimeout> | undefined;
    listenToMoved(() => {
      if (isCompactRef.current) return;
      if (timer) clearTimeout(timer);
      // Only act once the window has stopped moving (i.e. the drag ended),
      // so passing through the edge mid-drag doesn't trigger a dock.
      timer = setTimeout(() => {
        checkDockPosition(380, () => setIsCompact(true));
      }, 200);
    }).then(u => { unlisten = u; });
    return () => {
      unlisten?.();
      if (timer) clearTimeout(timer);
    };
  }, []);

  // ── Handlers ──────────────────────────────────────────────────────────────

  function doneTask(id: string) {
    dispatch({ type: 'DONE_TASK', id });
  }

  function undoTask(id: string) {
    dispatch({ type: 'UNDO_TASK', id });
  }

  function addTask(name: string, project: string | null, projectIsNew: boolean, leftMin: number | null) {
    const id = `custom-${Date.now()}`;
    const task: Task = {
      id,
      name,
      project,
      left_min: leftMin,
      initial_actual_min: 0,
      prev_status: 'Pendiente',
      status: 'pending',
      accumulated_ms: 0,
      running_since: null,
      notes: '',
      notesOpen: false,
      is_new: true,
      project_is_new: projectIsNew,
      color: colorForTask(tasks.length),
      blockId: null,
    };
    dispatch({ type: 'ADD_TASK', task });
    setAddFormOpen(false);
  }

  async function confirmCloseSession() {
    dispatch({ type: 'SET_PAUSED', paused: true });
    setCloseConfirmOpen(false);
    setView('finishing');

    const payload = buildFinishPayload(tasksRef.current, session!, sessionStart);

    try {
      const result = await invoke<{ ok: boolean; kept: number; removed: number }>('finish_session', {
        payload: JSON.stringify(payload),
      });
      if (result.ok) {
        setFinishResult({ kept: result.kept, removed: result.removed });
        setView('finished');
      } else {
        setErrorMessage('session-finish.py devolvió ok: false');
        setView('error');
      }
    } catch (e) {
      setErrorMessage(String(e));
      setView('error');
    }
  }

  async function confirmCancelSession() {
    setCancelConfirmOpen(false);
    setView('cancelling');

    const payload = buildCancelPayload(tasksRef.current, session!);

    try {
      const result = await invoke<{ ok: boolean; reverted: number }>('cancel_session', {
        payload: JSON.stringify(payload),
      });
      if (result.ok) {
        setView('cancelled');
      } else {
        setErrorMessage('session-cancel.py devolvió ok: false');
        setView('error');
      }
    } catch (e) {
      setErrorMessage(String(e));
      setView('error');
    }
  }

  function handleExpand() {
    exitCompactCentered(380, normalHeight, () => setIsCompact(false));
  }

  function unmergeTask(id: string) {
    dispatch({ type: 'UNMERGE', id });
  }

  function togglePause() {
    const ts = Date.now();
    if (isPaused) {
      dispatch({ type: 'SET_PAUSED', paused: false });
      setSessionStart(s => s + (ts - (pausedAt ?? ts)));
      setPausedAt(null);
    } else {
      dispatch({ type: 'SET_PAUSED', paused: true });
      setPausedAt(ts);
    }
    setIsPaused(p => !p);
  }

  // ── Render ────────────────────────────────────────────────────────────────

  if (!session) return null;

  const pendingTasks = tasks.filter(t => t.status !== 'done');
  const doneTasks = tasks.filter(t => t.status === 'done');
  const currentTask = tasks.find(t => t.id === currentId) ?? null;
  const activeMembers = currentTask
    ? currentTask.blockId
      ? pendingTasks.filter(t => t.blockId === currentTask.blockId)
      : [currentTask]
    : [];
  const actualMin = Math.round((now - sessionStart) / 60000);
  const displayNow = isPaused && pausedAt !== null ? pausedAt : now;

  // One render row per standalone task or per block (anchored on its head).
  const topLevelTasks = pendingTasks.filter(
    t => !t.blockId || pendingTasks.find(x => x.blockId === t.blockId) === t,
  );

  function reorderPending(newTopLevel: Task[]) {
    const expanded: Task[] = [];
    for (const t of newTopLevel) {
      if (t.blockId) {
        expanded.push(...pendingTasks.filter(x => x.blockId === t.blockId));
      } else {
        expanded.push(t);
      }
    }
    dispatch({ type: 'REORDER', tasks: [...expanded, ...doneTasks] });
  }

  // Drag, the whole story: while dragging we never touch the list — we only
  // read each row's *live* position and decide what the drop would do (merge
  // into a row, or slot before/after it), surfacing that as a single
  // indicator. The list mutates exactly once, on drop. Because nothing
  // reorders mid-drag, the rects we read are never mid-animation, so there's
  // no snapshot to freeze and nothing to desync.
  function handleRowDrag(draggedId: string, point: { x: number; y: number }) {
    let result: Drop | null = null;
    const rows = taskListRef.current?.querySelectorAll<HTMLElement>('[data-row-id]') ?? [];
    for (const el of rows) {
      const id = el.dataset.rowId!;
      if (id === draggedId) continue;
      const r = el.getBoundingClientRect();
      if (point.y < r.top || point.y > r.bottom) continue;
      const mergeTop = r.top + r.height * 0.3;
      const mergeBottom = r.bottom - r.height * 0.3;
      if (point.y >= mergeTop && point.y <= mergeBottom) {
        result = { targetId: id, mode: 'merge' };
      } else {
        result = { targetId: id, mode: point.y < mergeTop ? 'before' : 'after' };
      }
      break;
    }
    if (
      result?.targetId !== dropRef.current?.targetId ||
      result?.mode !== dropRef.current?.mode
    ) {
      dropRef.current = result;
      setDrop(result);
    }
  }

  function handleRowDragEnd(draggedId: string) {
    const d = dropRef.current;
    if (d && d.targetId !== draggedId) {
      if (d.mode === 'merge') {
        dispatch({ type: 'MERGE', sourceId: draggedId, targetId: d.targetId });
      } else {
        reorderPending(moveItem(topLevelTasks, draggedId, d.targetId, d.mode));
      }
    }
    dropRef.current = null;
    setDrop(null);
  }

  const mergeTargetId = drop?.mode === 'merge' ? drop.targetId : null;
  const dropEdgeFor = (id: string): 'before' | 'after' | undefined =>
    drop && drop.mode !== 'merge' && drop.targetId === id ? drop.mode : undefined;

  return (
    <>
      <AnimatePresence>
        {!isCompact && (
          <motion.div
            key="full"
            style={{ display: 'flex', flexDirection: 'column', height: '100vh', position: 'relative' }}
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <Header
              title={session.session_title}
              plannedMin={session.planned_min}
              sessionStart={sessionStart}
              now={displayNow}
            />


            <AnimatePresence mode="wait">
              {view === 'session' && (
                <motion.div
                  key="session-view"
                  className="session-view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div id="task-list" ref={taskListRef}>
                    <AnimatePresence initial={false}>
                      {topLevelTasks.map(task =>
                        task.blockId ? (
                          <BlockRow
                            key={task.blockId}
                            rowId={task.id}
                            members={pendingTasks.filter(t => t.blockId === task.blockId)}
                            isCurrent={pendingTasks.some(t => t.blockId === task.blockId && t.id === currentId)}
                            now={now}
                            isMergeTarget={mergeTargetId === task.id}
                            dropEdge={dropEdgeFor(task.id)}
                            onDone={doneTask}
                            onUnmerge={unmergeTask}
                            onDrag={(point) => handleRowDrag(task.id, point)}
                            onDragEnd={() => handleRowDragEnd(task.id)}
                          />
                        ) : (
                          <TaskRow
                            key={task.id}
                            rowId={task.id}
                            task={task}
                            isCurrent={task.id === currentId}
                            now={now}
                            isMergeTarget={mergeTargetId === task.id}
                            dropEdge={dropEdgeFor(task.id)}
                            onDone={doneTask}
                            onUndo={undoTask}
                            onToggleNotes={(id) => dispatch({ type: 'TOGGLE_NOTES', id })}
                            onSetNotes={(id, notes) => dispatch({ type: 'SET_NOTES', id, notes })}
                            onDrag={(point) => handleRowDrag(task.id, point)}
                            onDragEnd={() => handleRowDragEnd(task.id)}
                          />
                        ),
                      )}
                    </AnimatePresence>

                    <AnimatePresence initial={false}>
                      {doneTasks.map(task => (
                        <TaskRow
                          key={task.id}
                          task={task}
                          isCurrent={false}
                          now={now}
                          onDone={doneTask}
                          onUndo={undoTask}
                          onToggleNotes={(id) => dispatch({ type: 'TOGGLE_NOTES', id })}
                          onSetNotes={(id, notes) => dispatch({ type: 'SET_NOTES', id, notes })}
                        />
                      ))}
                    </AnimatePresence>
                  </div>

                  <div className="bottom-bar">
                    <div className="add-row">
                      <AnimatePresence mode="wait">
                        {addFormOpen ? (
                          <motion.div
                            key="form"
                            initial={{ opacity: 0, height: 0 }}
                            animate={{ opacity: 1, height: 'auto' }}
                            exit={{ opacity: 0, height: 0 }}
                            transition={{ duration: 0.2 }}
                          >
                            <AddTaskForm
                              projects={session.projects}
                              onAdd={addTask}
                              onCancel={() => setAddFormOpen(false)}
                            />
                          </motion.div>
                        ) : (
                          <motion.button
                            key="add-btn"
                            className="add-btn"
                            onClick={() => setAddFormOpen(true)}
                            initial={{ opacity: 0 }}
                            animate={{ opacity: 1 }}
                            exit={{ opacity: 0 }}
                            transition={{ duration: 0.15 }}
                          >
                            + Add task
                          </motion.button>
                        )}
                      </AnimatePresence>
                    </div>

                    <Controls
                      confirmOpen={closeConfirmOpen}
                      cancelConfirmOpen={cancelConfirmOpen}
                      onAskConfirm={() => setCloseConfirmOpen(true)}
                      onCancelConfirm={() => setCloseConfirmOpen(false)}
                      onConfirmClose={confirmCloseSession}
                      isPaused={isPaused}
                      onTogglePause={togglePause}
                      onCancel={() => setCancelConfirmOpen(true)}
                      onCancelCancelConfirm={() => setCancelConfirmOpen(false)}
                      onConfirmCancel={confirmCancelSession}
                    />
                  </div>
                </motion.div>
              )}

              {(view === 'finishing' || view === 'cancelling') && (
                <motion.div
                  key="loading-view"
                  className="result-view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <div className="result-loading">
                    {view === 'finishing' ? 'Guardando sesión en Notion…' : 'Cancelando sesión…'}
                  </div>
                </motion.div>
              )}

              {view === 'finished' && finishResult && (
                <motion.div
                  key="finished-view"
                  className="result-view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <h3>Sesión cerrada</h3>
                  <div className="result-line">
                    Planeado: {session.planned_min} min · Real: {actualMin} min
                  </div>
                  <div className="result-line">
                    Completadas: {doneTasks.length} / {tasks.length}
                  </div>
                  <div className="result-line">
                    Guardadas: {finishResult.kept} · Removidas: {finishResult.removed}
                  </div>
                  <div className="result-ok">Listo ✓ — guardado en Notion</div>
                  <div className="result-actions">
                    <button
                      className="primary"
                      style={{ '--task-color': '#32D74B' } as React.CSSProperties}
                      onClick={closeWindow}
                    >
                      Cerrar
                    </button>
                  </div>
                </motion.div>
              )}

              {view === 'cancelled' && (
                <motion.div
                  key="cancelled-view"
                  className="result-view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <h3>Sesión cancelada</h3>
                  <div className="result-line">Las tareas volvieron a su estado anterior.</div>
                  <div className="result-line">La sesión fue eliminada de Notion.</div>
                  <div className="result-actions">
                    <button onClick={closeWindow}>Cerrar</button>
                  </div>
                </motion.div>
              )}

              {view === 'error' && (
                <motion.div
                  key="error-view"
                  className="result-view"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                >
                  <h3 style={{ color: '#ff6961' }}>Error</h3>
                  <div className="result-line result-error-msg">{errorMessage}</div>
                  <div className="result-actions">
                    <button onClick={closeWindow}>Cerrar</button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            <AnimatePresence>
              {isPaused && (
                <motion.div
                  className="pause-overlay"
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  exit={{ opacity: 0 }}
                  transition={{ duration: 0.2 }}
                  onClick={togglePause}
                >
                  <div className="pause-overlay-icon">
                    <svg width="22" height="22" viewBox="0 0 12 12" fill="none" xmlns="http://www.w3.org/2000/svg">
                      <path d="M2.5 1.5V10.5L10 6L2.5 1.5Z" fill="currentColor" />
                    </svg>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </motion.div>
        )}
      </AnimatePresence>

      <AnimatePresence>
        {isCompact && (
          <motion.div
            key="compact"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
          >
            <CompactCard
              plannedMin={session.planned_min}
              sessionStart={sessionStart}
              members={activeMembers}
              now={displayNow}
              isPaused={isPaused}
              onTogglePause={togglePause}
              onExpand={handleExpand}
              onDone={doneTask}
              onToggleNotes={(id) => dispatch({ type: 'TOGGLE_NOTES', id })}
              onSetNotes={(id, notes) => dispatch({ type: 'SET_NOTES', id, notes })}
            />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
}
