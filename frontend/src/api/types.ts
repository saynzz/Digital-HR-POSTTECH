export type Role = "employee" | "manager" | "hr";
export type RequestType = "vacation" | "advance";
export type RequestStatus = "pending_manager" | "pending_hr" | "approved" | "rejected" | "cancelled";
export type EnrollmentStatus = "assigned" | "in_progress" | "completed" | "failed";

export interface EmployeeShort {
  id: number;
  full_name: string;
  position: string;
  department: string;
}

export interface Employee extends EmployeeShort {
  external_id: string;
  company: string;
  hire_date: string;
  vacation_balance_days: number;
  manager: EmployeeShort | null;
}

export interface Me {
  id: number;
  email: string;
  role: Role;
  locale: string;
  employee: Employee;
}

export interface RequestEvent {
  id: number;
  from_status: RequestStatus | null;
  to_status: RequestStatus;
  comment: string | null;
  actor_name: string | null;
  created_at: string;
}

export interface HRRequest {
  id: number;
  type: RequestType;
  status: RequestStatus;
  payload: { start_date?: string; end_date?: string; days?: number; amount?: number; comment?: string | null };
  external_doc_id: string | null;
  created_at: string;
  updated_at: string;
  employee: EmployeeShort;
}

export interface HRRequestDetail extends HRRequest {
  events: RequestEvent[];
  can_decide: boolean;
  can_cancel: boolean;
}

export interface Notification {
  id: number;
  type: string;
  title: string;
  body: string | null;
  link: string | null;
  is_read: boolean;
  created_at: string;
}

export interface Course {
  id: number;
  title: string;
  description: string;
  duration_min: number;
}

export interface Rewards {
  xp: number;
  items: { label: string; xp: number }[];
  badges: { code: string; title: string; description: string; icon: string }[];
  level_up: { level: number; title: string } | null;
  tracks: string[];
}

export interface Enrollment {
  id: number;
  status: EnrollmentStatus;
  progress: number;
  score: number | null;
  due_date: string | null;
  completed_lesson_ids: number[];
  attempts?: number;
  course: Course;
  rewards?: Rewards | null;
}

export interface GameProfile {
  xp: number;
  xp_week: number;
  level: { level: number; title: string; xp_from: number; xp_to: number | null; next_title: string | null; progress: number };
  levels: { level: number; xp: number; title: string }[];
  streak: { current: number; best: number; today: boolean; days: { date: string; active: boolean }[] };
  badges: { code: string; title: string; description: string; icon: string; earned_at: string | null }[];
  recent: { title: string; xp: number; at: string }[];
}

export interface TrackStep {
  order: number;
  required: boolean;
  locked: boolean;
  course: Course;
  status: EnrollmentStatus | null;
  progress: number;
  score: number | null;
}

export interface Track {
  id: number;
  slug: string;
  title: string;
  description: string;
  audience: string;
  icon: string;
  xp_reward: number;
  enrolled: boolean;
  due_date: string | null;
  completed_at: string | null;
  progress: { required: number; required_done: number; done: number; total: number; progress: number; complete: boolean };
  steps: TrackStep[];
}

export interface LeaderRow {
  rank: number;
  employee_id: number;
  name: string;
  department: string;
  position: string;
  xp: number;
  level: number;
  level_title: string;
  streak: number;
  me: boolean;
}

export interface CourseDetail extends Course {
  lessons: { id: number; order: number; title: string; content: string }[];
  questions: { id: number; question: string; options: string[] }[];
  enrollment: Enrollment | null;
}

export type Tone = "good" | "warn" | "bad" | "muted" | "brand" | null;

export interface Cell { text: string; tone: Tone }

export type ReportBlock =
  | { type: "person"; name: string; full_name: string; position: string; department: string; manager: string | null;
      hire_date: string; tenure: string; account: string; initials: string }
  | { type: "stats"; items: { label: string; value: string; hint: string | null; tone: Tone }[] }
  | { type: "bars"; title: string; unit: string; empty: string; orientation?: "vertical";
      items: { label: string; value: number; display: string | null; tone: Tone; cmd: string | null }[] }
  | { type: "table"; title: string | null; empty: string; columns: { label: string; align: "left" | "right" }[];
      rows: { cells: Cell[]; cmd: string | null; link: string | null }[] }
  | { type: "signals"; title: string; empty: string; more: number;
      items: { level: "high" | "medium" | "info"; code: string; text: string; action: string; who: string;
               cmd: string | null; link: string | null }[] }
  | { type: "timeline"; title: string; more: number;
      items: { date: string; title: string; sub: string; tone: Tone; link?: string }[] }
  | { type: "gantt"; title: string; start: string; end: string; today: string;
      rows: { name: string; cmd: string; bars: { start: string; end: string; status: "approved" | "pending"; label: string; link: string }[] }[];
      overlaps: { start: string; end: string; names: string[] }[] }
  | { type: "notes"; title: string; items: string[] }
  | { type: "export"; label: string; url: string; filename: string }
  | { type: "commands"; items: { cmd: string; run: string | null; title: string; hint: string }[] };

export interface Report { title: string; subtitle: string | null; blocks: ReportBlock[] }

export interface AskResponse {
  answer: string;
  sources: { doc_id: string; title: string; section: string | null; url: string | null }[];
  found: boolean;
  mode: "llm" | "extractive" | "refusal" | "analytics";
  report?: Report | null;
  insight?: string | null;
  suggestions?: string[];
}

export interface AgentCommands {
  commands: { cmd: string; title: string; hint: string; arg: string | null }[];
  people: { id: number; name: string; position: string; department: string }[];
}

export type CandidateStatus = "interview_pending" | "interview_passed" | "interview_failed" | "hired" | "archived";
export type AccountStatus = "invited" | "active" | "blocked";

export interface Candidate {
  id: number;
  full_name: string;
  email: string;
  phone: string | null;
  position: string;
  department: string;
  manager: EmployeeShort | null;
  interview_at: string | null;
  planned_start_date: string | null;
  notes: string | null;
  status: CandidateStatus;
  status_comment: string | null;
  employee_id: number | null;
  created_at: string;
  updated_at: string;
}

export interface CandidateInput {
  full_name: string;
  email: string;
  phone: string | null;
  position: string;
  department: string;
  manager_id: number | null;
  interview_at: string | null;
  planned_start_date: string | null;
  notes: string | null;
}

export interface InviteResult {
  sent_to: string;
  expires_at: string;
  email_sent: boolean;
  email_error: string | null;
  invite_url: string | null;
}

export interface HireResult extends InviteResult {
  candidate: Candidate;
  user_id: number;
  employee_id: number;
}

export interface Account {
  user_id: number;
  email: string;
  role: Role;
  status: AccountStatus;
  employee: EmployeeShort;
  invite_sent_at: string | null;
  invite_expires_at: string | null;
  invite_pending: boolean;
}

export interface InviteInfo {
  full_name: string;
  position: string;
  company: string;
  email: string;
  expires_at: string;
  is_reset: boolean;
}
