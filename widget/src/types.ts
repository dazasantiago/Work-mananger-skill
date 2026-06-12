export interface RawTask {
  id: string;
  name: string;
  project?: string;
  left_min?: number;
  initial_actual_min?: number;
  prev_status?: string;
}

export interface SessionData {
  session_id: string;
  session_title: string;
  planned_min: number;
  projects: string[];
  tasks: RawTask[];
}

export type TaskStatus = 'pending' | 'done';

export interface Task {
  id: string;
  name: string;
  project: string | null;
  left_min: number | null;
  initial_actual_min: number;
  prev_status: string;
  status: TaskStatus;
  accumulated_ms: number;
  running_since: number | null;
  notes: string;
  notesOpen: boolean;
  is_new: boolean;
  project_is_new: boolean;
  color: string;
  blockId: string | null;
}

export type AppView = 'session' | 'finishing' | 'finished' | 'cancelling' | 'cancelled' | 'error';

export interface FinishPayload {
  session_id: string;
  session_title: string;
  planned_min: number;
  actual_min: number;
  start: string;
  end: string;
  summary: string;
  tasks: FinishTask[];
}

export interface FinishTask {
  id: string;
  name: string;
  project: string | null;
  project_is_new: boolean;
  left_min: number | null;
  initial_actual_min: number;
  actual_min: number;
  status: 'done' | 'in_progress' | 'not_started';
  notes: string;
  is_new: boolean;
}

export interface CancelPayload {
  session_id: string;
  tasks: { id: string; prev_status: string }[];
}
