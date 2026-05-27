import { type NextRequest, NextResponse } from "next/server"

const DEFAULT_BACKEND_URL = "http://127.0.0.1:5000"

function resolveBackendUrl(): string {
  return process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || DEFAULT_BACKEND_URL
}

function buildDocumentUrl(id: string): URL {
  const base = resolveBackendUrl()
  try {
    return new URL(`/api/documents/${id}`, base)
  } catch (error) {
    throw new Error("BACKEND_URL inválida")
  }
}

function normalizeDocument(doc: any) {
  return {
    id: doc.id,
    title: doc.title ?? "Sin título",
    content: doc.content ?? "",
    creator_name: doc.creator_name ?? doc.author_name ?? "Yo",
    updated_at: doc.updated_at ?? new Date().toISOString(),
    created_at: doc.created_at ?? doc.updated_at ?? new Date().toISOString(),
    tags: doc.tags ?? [],
    content_format: doc.content_format ?? "html",
  }
}

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const backendUrl = buildDocumentUrl(params.id)
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

    const nextResponse = NextResponse.json(normalizeDocument(parsedBody))

    const setCookieHeader = backendResponse.headers.get("set-cookie")
    if (setCookieHeader) {
      nextResponse.headers.set("set-cookie", setCookieHeader)
    }

    return nextResponse
  } catch (error) {
    return NextResponse.json({ error: "Error al obtener el texto" }, { status: 500 })
  }
}

export async function PUT(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const backendUrl = buildDocumentUrl(params.id)
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

    const nextResponse = NextResponse.json(normalizeDocument(parsedBody))

    const setCookieHeader = backendResponse.headers.get("set-cookie")
    if (setCookieHeader) {
      nextResponse.headers.set("set-cookie", setCookieHeader)
    }

    return nextResponse
  } catch (error) {
    return NextResponse.json({ error: "Error al actualizar el texto" }, { status: 500 })
  }
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  try {
    const backendUrl = buildDocumentUrl(params.id)
    const backendResponse = await fetch(backendUrl, {
      method: "DELETE",
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
      parsedBody = rawBody ? { error: rawBody } : {}
    }

    if (!backendResponse.ok) {
      return NextResponse.json(parsedBody, { status: backendResponse.status })
    }

    const nextResponse = NextResponse.json({ success: true })

    const setCookieHeader = backendResponse.headers.get("set-cookie")
    if (setCookieHeader) {
      nextResponse.headers.set("set-cookie", setCookieHeader)
    }

    return nextResponse
  } catch (error) {
    return NextResponse.json({ error: "Error al eliminar el texto" }, { status: 500 })
  }
}
