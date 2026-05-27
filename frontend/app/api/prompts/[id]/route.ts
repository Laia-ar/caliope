import { type NextRequest, NextResponse } from "next/server"

const DEFAULT_BACKEND_URL = "http://127.0.0.1:5000"

function resolveBackendUrl(): string {
  return process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || DEFAULT_BACKEND_URL
}

function buildPromptUrl(id: string) {
  const base = resolveBackendUrl()
  try {
    return new URL(`/api/prompts/${id}`, base)
  } catch (error) {
    throw new Error("BACKEND_URL inválida")
  }
}

function normalizePrompt(prompt: any) {
  const updatedAt = prompt.updated_at || prompt.updatedAt || new Date().toISOString()
  const createdAt = prompt.created_at || prompt.createdAt || updatedAt

  return {
    id: String(prompt.id),
    name: prompt.name ?? "Sin título",
    instructions: prompt.content ?? prompt.instructions ?? "",
    isPublic: Boolean(prompt.public),
    creator: prompt.creator ?? (prompt.public ? "Biblioteca Pública" : "Yo"),
    lastEdited: updatedAt,
    updatedAt,
    createdAt,
    isOwner: prompt.is_owner ?? (!prompt.public),
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const backendUrl = buildPromptUrl(params.id)
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

    const nextResponse = NextResponse.json(normalizePrompt(parsedBody))

    const setCookieHeader = backendResponse.headers.get("set-cookie")
    if (setCookieHeader) {
      nextResponse.headers.set("set-cookie", setCookieHeader)
    }

    return nextResponse
  } catch (error) {
    return NextResponse.json({ error: "Error al obtener el prompt" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const backendUrl = buildPromptUrl(params.id)
    const body = await request.text()

    const backendResponse = await fetch(backendUrl, {
      method: "PUT",
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

    if (!backendResponse.ok) {
      return NextResponse.json(parsedBody, { status: backendResponse.status })
    }

    const nextResponse = NextResponse.json(normalizePrompt(parsedBody))

    const setCookieHeader = backendResponse.headers.get("set-cookie")
    if (setCookieHeader) {
      nextResponse.headers.set("set-cookie", setCookieHeader)
    }

    return nextResponse
  } catch (error) {
    return NextResponse.json({ error: "Error al actualizar el prompt" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const backendUrl = buildPromptUrl(params.id)
    const backendResponse = await fetch(backendUrl, {
      method: "DELETE",
      headers: {
        Cookie: request.headers.get("cookie") ?? "",
      },
      redirect: "manual",
    })

    if (!backendResponse.ok) {
      const rawBody = await backendResponse.text()
      let parsedBody: any

      try {
        parsedBody = rawBody ? JSON.parse(rawBody) : {}
      } catch (error) {
        parsedBody = rawBody ? { error: rawBody } : { error: "Respuesta inválida del backend" }
      }

      return NextResponse.json(parsedBody, { status: backendResponse.status })
    }

    const nextResponse = NextResponse.json({ success: true })

    const setCookieHeader = backendResponse.headers.get("set-cookie")
    if (setCookieHeader) {
      nextResponse.headers.set("set-cookie", setCookieHeader)
    }

    return nextResponse
  } catch (error) {
    return NextResponse.json({ error: "Error al eliminar el prompt" }, { status: 500 })
  }
}
