import { buildBackendUrl } from "./backend"
import { apiFetch } from "./api"

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
  can_create_sessions: boolean
  can_create_prompts: boolean
  can_create_invites: boolean
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
    can_create_sessions: typeof data.can_create_sessions === "boolean" ? data.can_create_sessions : false,
    can_create_prompts: typeof data.can_create_prompts === "boolean" ? data.can_create_prompts : true,
    can_create_invites: typeof data.can_create_invites === "boolean" ? data.can_create_invites : false,
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

  const response = await apiFetch(path, {
    ...rest,
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

export async function updateTeacherStatus(userId: number, canCreateSessions: boolean): Promise<void> {
  await adminFetch(`/api/admin/users/${userId}/teacher-status`, {
    method: "PUT",
    body: JSON.stringify({ can_create_sessions: canCreateSessions }),
  })
}

export async function updateUserFeatures(
  userId: number,
  features: { can_create_invites?: boolean; can_create_prompts?: boolean; is_admin?: boolean }
): Promise<AdminUser> {
  const { parsed } = await adminFetch(`/api/admin/users/${userId}/features`, {
    method: "PUT",
    body: JSON.stringify(features),
  })
  const data = coerceRecord(parsed)
  return normalizeUser(data)
}

export interface UsageSummaryUser {
  id: number
  username: string | null
  name: string
  total_tokens: number
  total_cost_usd: number
  total_queries: number
}

export async function fetchUsageSummary(): Promise<UsageSummaryUser[]> {
  const { parsed } = await adminFetch("/api/admin/usage/summary")
  const data = coerceRecord(parsed)
  const rawUsers = Array.isArray(data.users) ? data.users : []
  return rawUsers.map((u: unknown) => {
    const r = coerceRecord(u)
    return {
      id: Number(r.id),
      username: r.username === null ? null : String(r.username),
      name: String(r.name ?? ""),
      total_tokens: Number(r.total_tokens ?? 0),
      total_cost_usd: Number(r.total_cost_usd ?? 0),
      total_queries: Number(r.total_queries ?? 0),
    }
  })
}

export interface UsageOverTimePoint {
  period: string
  total_tokens: number
  total_cost_usd: number
  total_queries: number
}

export async function fetchUsageOverTime(groupBy: "day" | "week" | "month" = "day"): Promise<UsageOverTimePoint[]> {
  const { parsed } = await adminFetch(`/api/admin/usage/over-time?group_by=${groupBy}`)
  const data = coerceRecord(parsed)
  const rawData = Array.isArray(data.data) ? data.data : []
  return rawData.map((d: unknown) => {
    const r = coerceRecord(d)
    return {
      period: String(r.period ?? ""),
      total_tokens: Number(r.total_tokens ?? 0),
      total_cost_usd: Number(r.total_cost_usd ?? 0),
      total_queries: Number(r.total_queries ?? 0),
    }
  })
}

export async function syncUsageCosts(): Promise<{ updated: number; failed: number; processed: number }> {
  const { parsed } = await adminFetch("/api/admin/usage/sync-costs", { method: "POST" })
  const data = coerceRecord(parsed)
  return {
    updated: Number(data.updated ?? 0),
    failed: Number(data.failed ?? 0),
    processed: Number(data.processed ?? 0),
  }
}

export interface OpenRouterCredits {
  total_credits: number
  total_usage: number
  balance_usd: number
  checked_at: string
}

export async function fetchOpenRouterCredits(): Promise<OpenRouterCredits> {
  const { parsed } = await adminFetch("/api/admin/openrouter/credits")
  const data = coerceRecord(parsed)
  return {
    total_credits: Number(data.total_credits ?? 0),
    total_usage: Number(data.total_usage ?? 0),
    balance_usd: Number(data.balance_usd ?? 0),
    checked_at: typeof data.checked_at === "string" ? data.checked_at : "",
  }
}

export interface AdminPrompt {
  id: number
  name: string
  content: string
  public: boolean
  user_id: number
  created_at: string
}

export async function fetchAdminPrompts(): Promise<AdminPrompt[]> {
  const { parsed } = await adminFetch("/api/admin/prompts")
  const data = coerceRecord(parsed)
  const rawPrompts = Array.isArray(data.prompts) ? data.prompts : []
  return rawPrompts.map((p: unknown) => {
    const r = coerceRecord(p)
    return {
      id: Number(r.id),
      name: String(r.name ?? ""),
      content: String(r.content ?? ""),
      public: r.public === true,
      user_id: Number(r.user_id ?? 0),
      created_at: typeof r.created_at === "string" ? r.created_at : "",
    }
  })
}

export async function toggleAdminPromptPublic(
  promptId: number,
  isPublic: boolean
): Promise<AdminPrompt> {
  const { parsed } = await adminFetch(`/api/admin/prompts/${promptId}/public`, {
    method: "PUT",
    body: JSON.stringify({ public: isPublic }),
  })
  const data = coerceRecord(parsed)
  return {
    id: Number(data.id),
    name: String(data.name ?? ""),
    content: String(data.content ?? ""),
    public: data.public === true,
    user_id: 0,
    created_at: "",
  }
}

export async function fetchOpenRouterCreditsHistory(): Promise<OpenRouterCredits[]> {
  const { parsed } = await adminFetch("/api/admin/openrouter/credits/history")
  const data = coerceRecord(parsed)
  const rawHistory = Array.isArray(data.history) ? data.history : []
  return rawHistory.map((d: unknown) => {
    const r = coerceRecord(d)
    return {
      total_credits: Number(r.total_credits ?? 0),
      total_usage: Number(r.total_usage ?? 0),
      balance_usd: Number(r.balance_usd ?? 0),
      checked_at: typeof r.checked_at === "string" ? r.checked_at : "",
    }
  })
}
