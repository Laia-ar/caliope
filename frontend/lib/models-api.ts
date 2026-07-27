import { buildBackendUrl } from "./backend"
import { apiFetch } from "./api"

export interface AvailableModel {
  id: number
  slug: string
  label: string
  is_active?: boolean
  updated_at?: string
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

export async function loadAvailableModels(): Promise<AvailableModel[]> {
  const result = await apiCall("/api/models")
  const data = result && typeof result === "object" ? (result as Record<string, unknown>) : {}
  return Array.isArray(data.models) ? (data.models as AvailableModel[]) : []
}

export async function loadAdminModels(): Promise<AvailableModel[]> {
  const result = await apiCall("/api/admin/models")
  const data = result && typeof result === "object" ? (result as Record<string, unknown>) : {}
  return Array.isArray(data.models) ? (data.models as AvailableModel[]) : []
}

export async function createModel(data: { slug: string; label: string }): Promise<AvailableModel> {
  return (await apiCall("/api/admin/models", {
    method: "POST",
    body: JSON.stringify(data),
  })) as AvailableModel
}

export async function updateModel(
  id: number,
  data: Partial<{ slug: string; label: string; is_active: boolean }>
): Promise<AvailableModel> {
  return (await apiCall(`/api/admin/models/${id}`, {
    method: "PUT",
    body: JSON.stringify(data),
  })) as AvailableModel
}

export async function deleteModel(id: number): Promise<void> {
  await apiCall(`/api/admin/models/${id}`, { method: "DELETE" })
}
