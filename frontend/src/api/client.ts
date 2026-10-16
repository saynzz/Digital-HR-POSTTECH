import type {
  AskResponse, CourseDetail, Employee, Enrollment, HRRequest, HRRequestDetail, Me, Notification, RequestType,
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
    throw new ApiError(res.status, typeof body.detail === "string" ? body.detail : "Ошибка запроса");
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
  course: (id: number) => request<CourseDetail>(`/academy/courses/${id}`),
  completeLesson: (courseId: number, lessonId: number) =>
    post<Enrollment>(`/academy/courses/${courseId}/lessons/${lessonId}/complete`),
  submitQuiz: (courseId: number, answers: Record<number, number>) =>
    post<Enrollment>(`/academy/courses/${courseId}/quiz`, { answers }),
  assignCourse: (employee_id: number, course_id: number, due_date?: string) =>
    post<Enrollment>("/academy/assign", { employee_id, course_id, due_date }),

  ask: (question: string) => post<AskResponse>("/assistant/ask", { question }),
};
