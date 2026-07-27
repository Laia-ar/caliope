import { buildBackendUrl } from "./backend"
import { apiFetch } from "./api"

export interface ClassroomCourse {
  id: string
  name: string
  section?: string
}

export interface ClassroomCoursework {
  id: string
  title: string
  state?: string
  work_type?: string
}

export interface ExportResult {
  success: boolean
  exported_count: number
  documents: { participant_name: string; url: string }[]
  coursework_id?: string
  coursework_url?: string
  material_id?: string
  material_url?: string
}

async function classroomFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const response = await apiFetch(path, {
    ...options,
    headers: {
      "Content-Type": "application/json",
      ...options.headers,
    },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    throw new Error(data.message || data.error || `HTTP ${response.status}`)
  }
  return data
}

export async function fetchClassroomCourses(): Promise<ClassroomCourse[]> {
  const data = (await classroomFetch("/api/classroom/courses")) as { courses: ClassroomCourse[] }
  return data.courses || []
}

export async function fetchClassroomCoursework(courseId: string): Promise<ClassroomCoursework[]> {
  const data = (await classroomFetch(`/api/classroom/courses/${courseId}/coursework`)) as {
    coursework: ClassroomCoursework[]
  }
  return data.coursework || []
}

export async function exportSessionToClassroomCoursework(
  sessionId: number,
  courseId: string,
  title: string,
  description: string
): Promise<ExportResult> {
  return (await classroomFetch(`/api/sessions/${sessionId}/export-to-classroom-coursework`, {
    method: "POST",
    body: JSON.stringify({ course_id: courseId, title, description }),
  })) as ExportResult
}

export async function exportSessionToClassroomMaterials(
  sessionId: number,
  courseId: string,
  title: string,
  description: string
): Promise<ExportResult> {
  return (await classroomFetch(`/api/sessions/${sessionId}/export-to-classroom-materials`, {
    method: "POST",
    body: JSON.stringify({ course_id: courseId, title, description }),
  })) as ExportResult
}
