import { buildBackendUrl } from "./backend"
import { apiFetch } from "./api"

export type SessionAccessLevel = 'guests' | 'registered' | 'both'

export interface GradeInfo {
  id: number
  name: string
  institution_id: number
}

export interface Session {
  id: number
  title: string
  access_code: string
  access_level: SessionAccessLevel
  is_active: boolean
  llm_model_name: string
  instructions?: string
  prompt?: {
    id: number
    name: string
    content: string
  } | null
  grade?: GradeInfo | null
  grade_id?: number | null
  created_at: string
  updated_at?: string
  teacher_name?: string
}

export interface SessionQueryItem {
  id: number
  participant_id: number | null
  query_text: string
  response_text: string
  participant_name: string | null
  created_at: string
}

export interface CreateSessionData {
  title: string
  instructions: string
  custom_prompt_id?: number | null
  llm_model_name: string
  access_level?: SessionAccessLevel
  is_active?: boolean
  grade_id?: number | null
}

async function apiCall(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers ?? {})
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }
  const response = await apiFetch(path, {
    ...options,
    headers,
  })
  const text = await response.text()
  let parsed: unknown = undefined
  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch {
      parsed = text
    }
  }
  if (!response.ok) {
    const data = parsed && typeof parsed === "object" ? (parsed as Record<string, unknown>) : {}
    const message =
      typeof data.error === "string"
        ? data.error
        : typeof data.message === "string"
          ? data.message
          : typeof parsed === "string" && parsed.trim() !== ""
            ? parsed
            : `HTTP ${response.status}`
    throw new Error(message as string)
  }
  return parsed
}

export async function createSession(data: CreateSessionData): Promise<Session> {
  return (await apiCall("/api/sessions", {
    method: "POST",
    body: JSON.stringify(data),
  })) as Session
}

export async function listSessions(): Promise<Session[]> {
  const result = await apiCall("/api/sessions")
  const data = result && typeof result === "object" ? (result as Record<string, unknown>) : {}
  return Array.isArray(data.sessions) ? (data.sessions as Session[]) : []
}

export async function fetchParticipatedSessions(): Promise<Session[]> {
  const result = await apiCall("/api/sessions/participated")
  const data = result && typeof result === "object" ? (result as Record<string, unknown>) : {}
  return Array.isArray(data.sessions) ? (data.sessions as Session[]) : []
}

export async function fetchStudentSessions(): Promise<Session[]> {
  const result = await apiCall("/api/sessions/student")
  const data = result && typeof result === "object" ? (result as Record<string, unknown>) : {}
  return Array.isArray(data.sessions) ? (data.sessions as Session[]) : []
}

export async function fetchMyGrades(): Promise<GradeInfo[]> {
  const result = await apiCall("/api/grades/my-grades")
  const data = result && typeof result === "object" ? (result as Record<string, unknown>) : {}
  return Array.isArray(data.grades) ? (data.grades as GradeInfo[]) : []
}

export async function getSession(id: number): Promise<Session> {
  return (await apiCall(`/api/sessions/${id}`)) as Session
}

export async function updateSession(id: number, data: Partial<CreateSessionData>): Promise<Session> {
  return (await apiCall(`/api/sessions/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  })) as Session
}

export async function deleteSession(id: number): Promise<void> {
  await apiCall(`/api/sessions/${id}`, { method: "DELETE" })
}

export async function getSessionQueries(id: number): Promise<SessionQueryItem[]> {
  const result = await apiCall(`/api/sessions/${id}/queries`)
  const data = result && typeof result === "object" ? (result as Record<string, unknown>) : {}
  return Array.isArray(data.queries) ? (data.queries as SessionQueryItem[]) : []
}

export async function joinSession(code: string, displayName?: string): Promise<{ session: Session; participant_token: string }> {
  return (await apiCall("/api/sessions/join", {
    method: "POST",
    body: JSON.stringify({ access_code: code, display_name: displayName }),
  })) as { session: Session; participant_token: string }
}

export async function getSessionByCode(code: string): Promise<Session> {
  return (await apiCall(`/api/sessions/by-code/${code}`)) as Session
}

export async function sendSessionQuery(
  sessionId: number,
  token: string,
  text: string
): Promise<{ message: string }> {
  return (await apiCall(`/api/sessions/${sessionId}/query`, {
    method: "POST",
    headers: {
      "X-Participant-Token": token,
    },
    body: JSON.stringify({ text }),
  })) as { message: string }
}
