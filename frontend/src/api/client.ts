import type {
  Account, AgentCommands, AskResponse, Candidate, CandidateInput, CandidateStatus, Course, CourseDetail, Employee, Enrollment, GameProfile, HireResult, KudosItem, KudosValue, LeaderRow, MotivationSummary, Person,
  RedemptionItem, Rewards, RewardItem, TeamGoal, Track,
  HRRequest, HRRequestDetail, ImportRun, InviteInfo, ZupStatus, InviteResult, Me, Notification, RequestType,
} from "./types";

const TOKEN_KEY = "janamen_token";

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (t: string) => localStorage.setItem(TOKEN_KEY, t),
  clear: () => localStorage.removeItem(TOKEN_KEY),
};

export class ApiError extends Error {
  constructor(public status: number, message: string) {
    super(message);
  }
}

const FIELD_LABELS: Record<string, string> = {
  full_name: "ФИО", email: "Email", phone: "Телефон", position: "Должность", department: "Подразделение",
  start_date: "Дата выхода", password: "Пароль",
};

function errorMessage(detail: unknown): string {
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail) && detail.length) {
    const fields = detail
      .map((d) => FIELD_LABELS[String(d?.loc?.[d.loc.length - 1])] ?? null)
      .filter(Boolean);
    return fields.length ? `Проверьте поля: ${[...new Set(fields)].join(", ")}` : "Проверьте заполнение полей";
  }
  return "Ошибка запроса";
}

async function request<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = tokenStore.get();
  const res = await fetch(`/api${path}`, {
    ...init,
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...init.headers,
    },
  });
  if (res.status === 401 && token) {
    tokenStore.clear();
    window.location.href = "/login";
  }
  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    throw new ApiError(res.status, errorMessage(body.detail));
  }
  return res.json();
}

const post = <T>(path: string, body?: unknown) =>
  request<T>(path, { method: "POST", body: body ? JSON.stringify(body) : undefined });

export const api = {
  login: (email: string, password: string) => post<{ access_token: string }>("/auth/login", { email, password }),
  me: () => request<Me>("/auth/me"),

  team: () => request<Employee[]>("/team"),
  employee: (id: number) => request<Employee>(`/employees/${id}`),

  requests: (scope: "my" | "team" | "all" = "my") => request<HRRequest[]>(`/requests?scope=${scope}`),
  request: (id: number) => request<HRRequestDetail>(`/requests/${id}`),
  createRequest: (type: RequestType, data: Record<string, unknown>) =>
    post<HRRequestDetail>("/requests", { type, [type]: data }),
  decide: (id: number, decision: "approve" | "reject", comment?: string) =>
    post<HRRequestDetail>(`/requests/${id}/decision`, { decision, comment }),
  cancelRequest: (id: number) => post<HRRequestDetail>(`/requests/${id}/cancel`),

  notifications: () => request<Notification[]>("/notifications"),
  unreadCount: () => request<{ count: number }>("/notifications/unread-count"),
  markRead: (id: number) => post<Notification>(`/notifications/${id}/read`),
  markAllRead: () => post<{ ok: boolean }>("/notifications/read-all"),

  myCourses: () => request<Enrollment[]>("/academy/my"),
  catalog: () => request<Course[]>("/academy/courses"),
  startCourse: (id: number) => post<Enrollment>(`/academy/courses/${id}/start`),
  course: (id: number) => request<CourseDetail>(`/academy/courses/${id}`),
  completeLesson: (courseId: number, lessonId: number) =>
    post<Enrollment>(`/academy/courses/${courseId}/lessons/${lessonId}/complete`),
  submitQuiz: (courseId: number, answers: Record<number, number>) =>
    post<Enrollment>(`/academy/courses/${courseId}/quiz`, { answers }),
  assignCourse: (employee_id: number, course_id: number, due_date?: string) =>
    post<Enrollment>("/academy/assign", { employee_id, course_id, due_date }),
  game: () => request<GameProfile>("/academy/game"),
  tracks: () => request<Track[]>("/academy/tracks"),
  track: (id: number) => request<Track>(`/academy/tracks/${id}`),
  joinTrack: (id: number) => post<Track>(`/academy/tracks/${id}/join`),
  assignTrack: (employee_id: number, track_id: number, due_date?: string) =>
    post<Track>("/academy/tracks/assign", { employee_id, track_id, due_date }),
  motivation: () => request<MotivationSummary>("/motivation/summary"),
  rewards: () => request<RewardItem[]>("/motivation/rewards"),
  redeem: (id: number) => post<RedemptionItem>(`/motivation/rewards/${id}/redeem`),
  myRedemptions: () => request<RedemptionItem[]>("/motivation/redemptions/my"),
  cancelRedemption: (id: number) => post<RedemptionItem>(`/motivation/redemptions/${id}/cancel`),
  colleagues: () => request<Person[]>("/motivation/colleagues"),
  sendKudos: (to_employee_id: number, value: KudosValue, message: string) =>
    post<{ kudos: KudosItem; rewards: Rewards | null; kudos_left: number }>("/motivation/kudos", { to_employee_id, value, message }),
  kudos: (scope: "all" | "me" | "team") => request<KudosItem[]>(`/motivation/kudos?scope=${scope}`),
  goals: () => request<{ department: string; goal: TeamGoal | null }[]>("/motivation/goals"),
  setGoal: (data: { department?: string; title: string; reward: string; target_xp: number; end_date: string }) =>
    post<TeamGoal>("/motivation/goals", data),
  importPreview: async (file: File, fullSync: boolean) => {
    const token = tokenStore.get();
    const form = new FormData();
    form.append("file", file);
    form.append("full_sync", String(fullSync));
    const res = await fetch("/api/hr/import/preview", { method: "POST", body: form, headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) {
      const body = await res.json().catch(() => ({}));
      throw new ApiError(res.status, errorMessage(body.detail));
    }
    return res.json() as Promise<ImportRun>;
  },
  zupStatus: () => request<ZupStatus>("/hr/import/zup/status"),
  zupPreview: (full_sync: boolean) => post<ImportRun>("/hr/import/zup/preview", { full_sync }),
  importRuns: () => request<ImportRun[]>("/hr/import/runs"),
  importRun: (id: number) => request<ImportRun>(`/hr/import/runs/${id}`),
  applyImport: (id: number, opts: { send_invites: boolean; block_missing: boolean; assign_onboarding: boolean }) =>
    post<ImportRun>(`/hr/import/runs/${id}/apply`, opts),
  adminRedemptions: () => request<RedemptionItem[]>("/motivation/admin/redemptions"),
  decideRedemption: (id: number, approve: boolean, comment?: string) =>
    post<RedemptionItem>(`/motivation/admin/redemptions/${id}/decide`, { approve, comment: comment || null }),
  adminRewards: () => request<RewardItem[]>("/motivation/admin/rewards"),
  createReward: (data: Omit<RewardItem, "id">) => post<RewardItem>("/motivation/admin/rewards", data),
  updateReward: (id: number, data: Omit<RewardItem, "id">) =>
    request<RewardItem>(`/motivation/admin/rewards/${id}`, { method: "PUT", body: JSON.stringify(data) }),
  leaderboard: (scope: "team" | "company", period: "week" | "all") =>
    request<{ rows: LeaderRow[] }>(`/academy/leaderboard?scope=${scope}&period=${period}`),

  ask: (question: string) => post<AskResponse>("/assistant/ask", { question }),
  escalate: (question: string) => post<{ ok: boolean }>("/assistant/escalate", { question }),
  agentCommands: () => request<AgentCommands>("/assistant/commands"),
  download: async (path: string, filename: string) => {
    const token = tokenStore.get();
    const res = await fetch(`/api${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
    if (!res.ok) throw new ApiError(res.status, "Не удалось скачать файл");
    const url = URL.createObjectURL(await res.blob());
    const a = Object.assign(document.createElement("a"), { href: url, download: filename });
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  },

  inviteInfo: (token: string) => request<InviteInfo>(`/auth/invite/${encodeURIComponent(token)}`),
  activate: (token: string, password: string) => post<{ access_token: string }>("/auth/activate", { token, password }),

  candidates: (status?: CandidateStatus) => request<Candidate[]>(`/hr/candidates${status ? `?status=${status}` : ""}`),
  createCandidate: (data: CandidateInput) => post<Candidate>("/hr/candidates", data),
  updateCandidate: (id: number, data: Partial<CandidateInput>) =>
    request<Candidate>(`/hr/candidates/${id}`, { method: "PATCH", body: JSON.stringify(data) }),
  setCandidateStatus: (id: number, status: "interview_pending" | "interview_passed" | "interview_failed", comment?: string) =>
    post<Candidate>(`/hr/candidates/${id}/status`, { status, comment: comment || null }),
  archiveCandidate: (id: number, comment?: string) => post<Candidate>(`/hr/candidates/${id}/archive`, { comment: comment || null }),
  restoreCandidate: (id: number) => post<Candidate>(`/hr/candidates/${id}/restore`),
  hireCandidate: (id: number, start_date: string, role: "employee" | "manager") =>
    post<HireResult>(`/hr/candidates/${id}/hire`, { start_date, role }),

  accounts: () => request<Account[]>("/hr/accounts"),
  sendInvite: (userId: number) => post<InviteResult>(`/hr/accounts/${userId}/invite`),
  blockAccount: (userId: number) => post<Account>(`/hr/accounts/${userId}/block`),
  unblockAccount: (userId: number) => post<Account>(`/hr/accounts/${userId}/unblock`),
};
