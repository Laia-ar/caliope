import { buildBackendUrl } from "./backend"

export interface AdminStats {
  total_users?: number
  active_users?: number
  documents?: number
  prompts?: number
  public_prompts?: number
  queries?: number
  [key: string]: number | undefined
}

export interface AdminUser {
  id: number
  username: string
  email: string
  name: string
  is_admin: boolean
}

function coerceRecord(value: unknown): Record<string, unknown> {
  return value && typeof value === "object" ? (value as Record<string, unknown>) : {}
}

function parseNumber(value: unknown): number | undefined {
  const candidate = Number(value)
  return Number.isFinite(candidate) ? candidate : undefined
}

function normalizeStats(raw: unknown): AdminStats {
  const data = coerceRecord(raw)
  const stats: AdminStats = {}

  for (const [key, value] of Object.entries(data)) {
    const numericValue = parseNumber(value)
    if (numericValue !== undefined) {
      stats[key] = numericValue
    }
  }

  return stats
}

function normalizeUser(raw: unknown): AdminUser {
  const data = coerceRecord(raw)
  const idCandidate = parseNumber(data.id)
  const id = idCandidate !== undefined ? idCandidate : 0

  return {
    id,
    username: typeof data.username === "string" ? data.username : "",
    email: typeof data.email === "string" ? data.email : "",
    name: typeof data.name === "string" ? data.name : "",
    is_admin:
      typeof data.is_admin === "boolean"
        ? data.is_admin
        : typeof data.username === "string" && data.username.toLowerCase() === "admin",
  }
}

function extractErrorMessage(payload: unknown, fallback: string): string {
  const data = coerceRecord(payload)
  const messageCandidates = [data.error, data.message, data.detail]
  for (const candidate of messageCandidates) {
    if (typeof candidate === "string" && candidate.trim() !== "") {
      return candidate
    }
  }
  return fallback
}

async function adminFetch(path: string, options: RequestInit = {}): Promise<{ parsed: unknown; text: string }> {
  const headers = new Headers(options.headers ?? {})

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  const { headers: _ignored, ...rest } = options

  const response = await fetch(buildBackendUrl(path), {
    ...rest,
    credentials: "include",
    headers,
  })

  const text = await response.text()
  let parsed: unknown = undefined

  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch (error) {
      parsed = undefined
    }
  }

  if (!response.ok) {
    const fallback = text && text.trim() !== "" ? text : `HTTP ${response.status}`
    const message = extractErrorMessage(parsed, fallback)
    throw new Error(message)
  }

  return { parsed, text }
}

export async function fetchAdminStats(): Promise<AdminStats> {
  const { parsed } = await adminFetch("/api/admin/dashboard")
  const data = coerceRecord(parsed)
  return normalizeStats(data.stats)
}

export async function fetchAdminUsers(): Promise<AdminUser[]> {
  const { parsed } = await adminFetch("/api/admin/users")
  const data = coerceRecord(parsed)
  const rawUsers = Array.isArray(data.users) ? data.users : []
  return rawUsers.map(normalizeUser)
}

export async function fetchUsersRawJson(): Promise<string> {
  const { text } = await adminFetch("/api/admin/users/rawjson", {
    headers: {
      Accept: "application/json",
    },
  })
  return text
}

export async function updateUsersRawJson(rawContent: string): Promise<void> {
  await adminFetch(
    "/api/admin/users/rawjson",
    {
      method: "PUT",
      body: rawContent,
      headers: {
        "Content-Type": "application/json",
      },
    },
  )
}
