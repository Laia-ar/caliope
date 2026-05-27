import { buildBackendUrl } from "./backend"

export interface Prompt {
  id: string
  name: string
  instructions: string
  isPublic: boolean
  creator?: string
  lastEdited?: string
  createdAt?: string
  updatedAt?: string
  isOwner?: boolean
}

interface PromptInput {
  name: string
  instructions: string
  isPublic?: boolean
}

const API_BASE = "/api/prompts"

function coerceRecord(value: unknown): Record<string, any> {
  return value && typeof value === "object" ? (value as Record<string, any>) : {}
}

function normalizeDate(value: unknown): string | undefined {
  if (typeof value === "string" && value.trim() !== "") {
    return value
  }
  if (value instanceof Date) {
    return value.toISOString()
  }
  return undefined
}

function normalizePrompt(raw: unknown): Prompt {
  const data = coerceRecord(raw)
  const idValue = data.id ?? data.prompt_id ?? data.promptId ?? ""
  const id = typeof idValue === "string" ? idValue : String(idValue)
  const updatedAt = normalizeDate(data.updated_at ?? data.updatedAt ?? data.modified_at) ?? new Date().toISOString()
  const createdAt = normalizeDate(data.created_at ?? data.createdAt)

  return {
    id,
    name: typeof data.name === "string" && data.name.trim() !== "" ? data.name : "Sin nombre",
    instructions:
      typeof data.instructions === "string"
        ? data.instructions
        : typeof data.content === "string"
          ? data.content
          : "",
    isPublic: Boolean(data.isPublic ?? data.public ?? data.is_public),
    creator:
      typeof data.creator === "string"
        ? data.creator
        : typeof data.creator_name === "string"
          ? data.creator_name
          : typeof data.author_name === "string"
            ? data.author_name
            : undefined,
    lastEdited: updatedAt,
    createdAt,
    updatedAt,
    isOwner: typeof data.is_owner === "boolean" ? data.is_owner : typeof data.isOwner === "boolean" ? data.isOwner : true,
  }
}

async function fetchJson(path: string, options: RequestInit = {}) {
  const headers = new Headers(options.headers ?? {})

  if (options.body && !headers.has("Content-Type")) {
    headers.set("Content-Type", "application/json")
  }

  const { headers: _ignored, ...rest } = options

  const response = await fetch(buildBackendUrl(path), {
    ...rest,
    headers,
    credentials: "include",
  })

  const text = await response.text()
  let parsed: unknown = undefined

  if (text) {
    try {
      parsed = JSON.parse(text)
    } catch (error) {
      throw new Error("Respuesta inválida del servidor")
    }
  }

  if (!response.ok) {
    const data = coerceRecord(parsed)
    const message =
      typeof data.error === "string"
        ? data.error
        : typeof data.message === "string"
          ? data.message
          : `HTTP ${response.status}`
    throw new Error(message)
  }

  return parsed
}

export async function loadPrompts(): Promise<Prompt[]> {
  try {
    const payload = await fetchJson(API_BASE)
    const data = coerceRecord(payload)
    const prompts = Array.isArray(data.prompts) ? data.prompts.map(normalizePrompt) : []
    return prompts
  } catch (error) {
    console.error("Error loading prompts:", error)
    return []
  }
}

export async function getPrompt(promptId: string): Promise<Prompt> {
  const payload = await fetchJson(`${API_BASE}/${promptId}`)
  return normalizePrompt(payload)
}

export async function createPrompt(data: PromptInput): Promise<Prompt> {
  const payload = await fetchJson(API_BASE, {
    method: "POST",
    body: JSON.stringify({
      name: data.name,
      content: data.instructions,
      public: data.isPublic ?? false,
    }),
  })
  return normalizePrompt(payload)
}

export async function updatePrompt(promptId: string, data: Partial<PromptInput>): Promise<Prompt> {
  const payload = await fetchJson(`${API_BASE}/${promptId}`, {
    method: "PUT",
    body: JSON.stringify({
      name: data.name,
      content: data.instructions,
      public: data.isPublic,
    }),
  })
  return normalizePrompt(payload)
}

export async function deletePrompt(promptId: string): Promise<boolean> {
  try {
    await fetchJson(`${API_BASE}/${promptId}`, {
      method: "DELETE",
    })
    return true
  } catch (error) {
    console.error("Error deleting prompt:", error)
    return false
  }
}

export async function savePrompt(promptId: string, data: Partial<Prompt>): Promise<boolean> {
  try {
    await updatePrompt(promptId, {
      name: data.name,
      instructions: data.instructions,
      isPublic: data.isPublic,
    })
    return true
  } catch (error) {
    console.error("Error saving prompt:", error)
    return false
  }
}

export async function savePromptData(data: PromptInput): Promise<Prompt> {
  return createPrompt(data)
}
