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

export interface Enrollment {
  id: number;
  status: EnrollmentStatus;
  progress: number;
  score: number | null;
  due_date: string | null;
  completed_lesson_ids: number[];
  course: Course;
}

export interface CourseDetail extends Course {
  lessons: { id: number; order: number; title: string; content: string }[];
  questions: { id: number; question: string; options: string[] }[];
  enrollment: Enrollment | null;
}

export interface AskResponse {
  answer: string;
  sources: { doc_id: string; title: string; section: string | null; url: string | null }[];
  found: boolean;
  mode: "llm" | "extractive" | "refusal";
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
