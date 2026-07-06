import { buildBackendUrl } from "./backend"

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
}

async function classroomFetch(path: string, options: RequestInit = {}): Promise<unknown> {
  const response = await fetch(buildBackendUrl(path), {
    ...options,
    credentials: "include",
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

export async function exportSessionToClassroom(
  sessionId: number,
  courseId: string,
  courseworkId: string
): Promise<ExportResult> {
  return (await classroomFetch(`/api/sessions/${sessionId}/export-to-classroom`, {
    method: "POST",
    body: JSON.stringify({ course_id: courseId, coursework_id: courseworkId }),
  })) as ExportResult
}
