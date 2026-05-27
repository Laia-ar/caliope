import { buildBackendUrl } from "./backend"

export interface DocumentListItem {
  id: number
  title: string
  creator_name: string
  updated_at: string
  tags?: string[]
}

export interface Document extends DocumentListItem {
  content: string
  content_format: string
}

export interface DocumentListResponse {
  items: DocumentListItem[]
  page: number
  page_size: number
  total: number
}

const API_BASE = "/api"

function coerceRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" ? (value as Record<string, any>) : {}
}

function ensureArray<T>(value: unknown): T[] {
  if (Array.isArray(value)) {
    return value as T[]
  }
  return []
}

function normalizeTags(value: unknown): string[] {
  if (Array.isArray(value)) {
    return value.filter((tag): tag is string => typeof tag === "string")
  }
  if (typeof value === "string" && value.trim() !== "") {
    return value
      .split(",")
      .map((tag) => tag.trim())
      .filter(Boolean)
  }
  return []
}

function normalizeDate(value: unknown): string {
  if (typeof value === "string" && value.trim() !== "") {
    return value
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  return new Date().toISOString()
}

function normalizeDocument(raw: unknown): Document {
  const data = coerceRecord(raw)
  const idCandidate = Number(data.id ?? data.document_id ?? data.documentId)
  const id = Number.isFinite(idCandidate) ? idCandidate : 0

  return {
    id,
    title: typeof data.title === "string" && data.title.trim() !== "" ? data.title : "Sin título",
    content: typeof data.content === "string" ? data.content : "",
    content_format: typeof data.content_format === "string" && data.content_format.trim() !== ""
      ? data.content_format
      : "html",
    creator_name:
      typeof data.creator_name === "string"
        ? data.creator_name
        : typeof data.author_name === "string"
          ? data.author_name
          : typeof data.user_name === "string"
            ? data.user_name
            : "Yo",
    updated_at: normalizeDate(data.updated_at ?? data.modified_at ?? data.created_at),
    tags: normalizeTags(data.tags ?? data.labels ?? data.categories),
  }
}

function toListItem(raw: unknown): DocumentListItem {
  const { content: _content, content_format: _contentFormat, ...rest } = normalizeDocument(raw)
  return rest
}

function buildDocumentListResponse(payload: unknown): DocumentListResponse {
  const data = coerceRecord(payload)
  const rawItems = ensureArray<any>(data.items ?? data.documents ?? data.results ?? data.data)
  const items = rawItems.map(toListItem)
  const totalCandidate = Number(data.total ?? data.count ?? items.length)
  const total = Number.isFinite(totalCandidate) && totalCandidate >= 0 ? totalCandidate : items.length
  const fallbackPageSize = items.length > 0 ? items.length : 10
  const pageSizeCandidate = Number(
    data.page_size ?? data.pageSize ?? data.per_page ?? data.perPage ?? fallbackPageSize,
  )
  const page_size =
    Number.isFinite(pageSizeCandidate) && pageSizeCandidate > 0 ? pageSizeCandidate : fallbackPageSize
  const pageCandidate = Number(data.page ?? data.current_page ?? data.currentPage ?? 1)
  const page = Number.isFinite(pageCandidate) && pageCandidate > 0 ? pageCandidate : 1

  return {
    items,
    page,
    page_size,
    total,
  }
}

async function apiCall(path: string, options: RequestInit = {}) {
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
      parsed = text
    }
  }

  if (!response.ok) {
    const data = coerceRecord(parsed)
    const message =
      typeof data.error === "string"
        ? data.error
        : typeof data.message === "string"
          ? data.message
          : typeof parsed === "string" && parsed.trim() !== ""
            ? parsed
            : `HTTP ${response.status}`
    throw new Error(message)
  }

  return parsed
}

export const documentsApi = {
  list: async (
    params: {
      page?: number
      page_size?: number
      q?: string
      tag?: string
    } = {},
  ): Promise<DocumentListResponse> => {
    const searchParams = new URLSearchParams()

    if (params.page) searchParams.set("page", params.page.toString())
    if (params.page_size) searchParams.set("page_size", params.page_size.toString())
    if (params.q) searchParams.set("q", params.q)
    if (params.tag) searchParams.set("tag", params.tag)

    const query = searchParams.toString()
    const path = query ? `${API_BASE}/documents?${query}` : `${API_BASE}/documents`
    const data = await apiCall(path)
    return buildDocumentListResponse(data)
  },

  get: async (id: number): Promise<Document> => {
    const data = await apiCall(`${API_BASE}/documents/${id}`)
    return normalizeDocument(data)
  },

  create: async (data: { title: string; content: string }): Promise<Document> => {
    const result = await apiCall(`${API_BASE}/documents`, {
      method: "POST",
      body: JSON.stringify(data),
    })
    return normalizeDocument(result)
  },

  update: async (id: number, data: { title?: string; content?: string }): Promise<Document> => {
    const result = await apiCall(`${API_BASE}/documents/${id}`, {
      method: "PUT",
      body: JSON.stringify(data),
    })
    return normalizeDocument(result)
  },

  delete: async (id: number): Promise<{ success: boolean }> => {
    await apiCall(`${API_BASE}/documents/${id}`, {
      method: "DELETE",
    })
    return { success: true }
  },
}
