export type Navigate = (to: string) => void;

export type Phase = 'lobby' | 'briefing' | 'working' | 'review' | 'confirm' | 'finished';
export type FinalStatus = 'DAT' | 'CHO_XAC_MINH';
export type FieldKey = 'element' | 'cell' | 'z' | 'period' | 'group' | 'block';

export interface Answer {
  element?: string;
  cell?: string;
  z?: string;
  period?: string;
  group?: string;
  block?: string;
}

export interface RoomInfo {
  id: string;
  code: string;
  status: 'open' | 'closed';
  phase: Phase;
  phase_ends_at: string | null;
  started_at: string | null;
  review_edit_open: boolean;
  hint_used: boolean;
  results_visible: boolean;
  final_status: FinalStatus | null;
  player_count: number;
}

export interface TaskInfo {
  id: number;
  title: string;
  kind: 'z' | 'config';
  fact: string;
  prompt: string;
  fields: FieldKey[];
  options: string[];
}

export interface MeInfo {
  id: string;
  display_name: string;
  recovery_code: string;
  hint: string | null;
}

export interface MySubmission {
  answer: Answer;
  submitted_at: string;
  revision_count: number;
  is_correct?: boolean;
  details?: Partial<Record<FieldKey, boolean>>;
}

export interface TeacherPlayer {
  id: string;
  display_name: string;
  task_id: number | null;
  recovery_code: string;
  submitted: boolean;
  is_correct: boolean | null;
  first_is_correct: boolean | null;
  revision_count: number;
  has_hint: boolean;
}

export interface Summary {
  participants: number;
  submitted: number;
  correct: number | null;
  needed: number;
  rate: number | null;
  status: FinalStatus | null;
}

export interface RoomState {
  server_now: string;
  role: 'teacher' | 'player';
  room: RoomInfo;
  me?: MeInfo;
  task?: TaskInfo | null;
  submission?: MySubmission | null;
  players?: TeacherPlayer[];
  summary?: Summary;
}

export interface SolutionRow {
  player_id: string;
  display_name: string;
  task_id: number;
  title: string;
  fact: string;
  expected: { symbol: string; name: string; z: number; period: number; group: number; block: string };
  explanation: string;
  answer: Answer | null;
  is_correct: boolean | null;
}
