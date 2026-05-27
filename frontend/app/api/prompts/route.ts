import { type NextRequest, NextResponse } from "next/server"

const DEFAULT_BACKEND_URL = "http://127.0.0.1:5000"

function resolveBackendUrl(): string {
  return process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || DEFAULT_BACKEND_URL
}

function buildPromptsUrl() {
  const base = resolveBackendUrl()
  try {
    return new URL("/api/prompts", base)
  } catch (error) {
    throw new Error("BACKEND_URL inválida")
  }
}

function normalizePromptSummary(prompt: any) {
  const updatedAt = prompt.updated_at || prompt.updatedAt || new Date().toISOString()

  return {
    id: String(prompt.id),
    name: prompt.name ?? "Sin título",
    instructions: prompt.content ?? "",
    isPublic: Boolean(prompt.public),
    creator: prompt.creator ?? (prompt.public ? "Biblioteca Pública" : "Yo"),
    lastEdited: updatedAt,
  }
}

function normalizePromptDetail(prompt: any) {
  const summary = normalizePromptSummary(prompt)
  return {
    ...summary,
    instructions: prompt.content ?? prompt.instructions ?? "",
    isOwner: prompt.is_owner ?? (!summary.isPublic),
    createdAt: prompt.created_at || prompt.createdAt || summary.lastEdited,
    updatedAt: summary.lastEdited,
  }
}

export async function GET(request: NextRequest) {
  try {
    const backendUrl = buildPromptsUrl()
    const backendResponse = await fetch(backendUrl, {
      method: "GET",
      headers: {
        Cookie: request.headers.get("cookie") ?? "",
      },
      redirect: "manual",
    })

    const rawBody = await backendResponse.text()
    let parsedBody: any

    try {
      parsedBody = rawBody ? JSON.parse(rawBody) : {}
    } catch (error) {
      parsedBody = rawBody ? { error: rawBody } : { error: "Respuesta inválida del backend" }
    }

    if (!backendResponse.ok) {
      return NextResponse.json(parsedBody, { status: backendResponse.status })
    }

    const prompts = Array.isArray(parsedBody.prompts) ? parsedBody.prompts : []
    const normalizedPrompts = prompts.map((prompt: any) => normalizePromptSummary(prompt))

    const nextResponse = NextResponse.json({ prompts: normalizedPrompts })

    const setCookieHeader = backendResponse.headers.get("set-cookie")
    if (setCookieHeader) {
      nextResponse.headers.set("set-cookie", setCookieHeader)
    }

    return nextResponse
  } catch (error) {
    return NextResponse.json({ error: "Error al obtener prompts" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const backendUrl = buildPromptsUrl()
    const body = await request.text()

    const backendResponse = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": request.headers.get("content-type") ?? "application/json",
        Cookie: request.headers.get("cookie") ?? "",
      },
      body,
      redirect: "manual",
    })

    const rawBody = await backendResponse.text()
    let parsedBody: any

    try {
      parsedBody = rawBody ? JSON.parse(rawBody) : {}
    } catch (error) {
      parsedBody = rawBody ? { error: rawBody } : { error: "Respuesta inválida del backend" }
    }

    const responseBody = backendResponse.ok ? normalizePromptDetail(parsedBody) : parsedBody

    const nextResponse = NextResponse.json(responseBody, { status: backendResponse.status })

    const setCookieHeader = backendResponse.headers.get("set-cookie")
    if (setCookieHeader) {
      nextResponse.headers.set("set-cookie", setCookieHeader)
    }

    return nextResponse
  } catch (error) {
    return NextResponse.json({ error: "Error al crear prompt" }, { status: 500 })
  }
}
