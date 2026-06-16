import { useState, useEffect } from 'react';
import type { Task } from './types';

export function useNow(intervalMs = 1000): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const id = setInterval(() => setNow(Date.now()), intervalMs);
    return () => clearInterval(id);
  }, [intervalMs]);
  return now;
}

export function fmt(ms: number): string {
  const totalSec = Math.max(0, Math.floor(ms / 1000));
  const m = Math.floor(totalSec / 60);
  const s = totalSec % 60;
  return `${m}:${String(s).padStart(2, '0')}`;
}

// `rate` is the number of tasks sharing the clock (i.e. block size). Each
// member's own timer advances at 1/rate speed, so the sum of all members'
// liveMs always equals real elapsed time.
export function liveMs(task: Pick<Task, 'accumulated_ms' | 'running_since'>, now: number, rate = 1): number {
  let ms = task.accumulated_ms;
  if (task.running_since !== null) ms += (now - task.running_since) / rate;
  return ms;
}

// Total time ever spent on this task: session time + previous sessions (initial_actual_min).
// Use only for display — accumulated_ms stays session-only so the finish payload doesn't double-count.
export function displayMs(task: Pick<Task, 'accumulated_ms' | 'running_since' | 'initial_actual_min'>, now: number, rate = 1): number {
  return liveMs(task, now, rate) + task.initial_actual_min * 60000;
}
