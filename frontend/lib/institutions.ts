import { buildBackendUrl } from "./backend"
import { apiFetch } from "./api"

export interface Institution {
  id: number
  name: string
  created_at?: string
}

export interface Grade {
  id: number
  name: string
  institution_id: number
  created_at?: string
}

export interface GradeMember {
  id: number
  email: string
  role: "teacher" | "student"
  user_id: number | null
}

async function adminFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const headers = new Headers(options.headers ?? {})
  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }
  const response = await apiFetch(path, {
    ...options,
    headers,
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.error || data.message || `HTTP ${response.status}`)
  }
  return data
}

export async function fetchInstitutions(): Promise<Institution[]> {
  const data = (await adminFetch("/api/admin/institutions")) as { institutions: Institution[] }
  return data.institutions || []
}

export async function createInstitution(name: string): Promise<Institution> {
  return (await adminFetch("/api/admin/institutions", {
    method: "POST",
    body: JSON.stringify({ name }),
  })) as Institution
}

export async function updateInstitution(id: number, name: string): Promise<Institution> {
  return (await adminFetch(`/api/admin/institutions/${id}`, {
    method: "PUT",
    body: JSON.stringify({ name }),
  })) as Institution
}

export async function deleteInstitution(id: number): Promise<void> {
  await adminFetch(`/api/admin/institutions/${id}`, { method: "DELETE" })
}

export async function fetchGrades(institutionId: number): Promise<Grade[]> {
  const data = (await adminFetch(`/api/admin/institutions/${institutionId}/grades`)) as {
    grades: Grade[]
  }
  return data.grades || []
}

export async function createGrade(institutionId: number, name: string): Promise<Grade> {
  return (await adminFetch(`/api/admin/institutions/${institutionId}/grades`, {
    method: "POST",
    body: JSON.stringify({ name }),
  })) as Grade
}

export async function updateGrade(id: number, name: string): Promise<Grade> {
  return (await adminFetch(`/api/admin/grades/${id}`, {
    method: "PUT",
    body: JSON.stringify({ name }),
  })) as Grade
}

export async function deleteGrade(id: number): Promise<void> {
  await adminFetch(`/api/admin/grades/${id}`, { method: "DELETE" })
}

export async function fetchGradeMembers(gradeId: number): Promise<GradeMember[]> {
  const data = (await adminFetch(`/api/admin/grades/${gradeId}/members`)) as {
    members: GradeMember[]
  }
  return data.members || []
}

export async function addGradeMember(
  gradeId: number,
  email: string,
  role: "teacher" | "student"
): Promise<GradeMember> {
  return (await adminFetch(`/api/admin/grades/${gradeId}/members`, {
    method: "POST",
    body: JSON.stringify({ email, role }),
  })) as GradeMember
}

export async function removeGradeMember(gradeId: number, memberId: number): Promise<void> {
  await adminFetch(`/api/admin/grades/${gradeId}/members/${memberId}`, { method: "DELETE" })
}
