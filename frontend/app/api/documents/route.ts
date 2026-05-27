import { type NextRequest, NextResponse } from "next/server"

const DEFAULT_BACKEND_URL = "http://127.0.0.1:5000"

function resolveBackendUrl(): string {
  return process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || DEFAULT_BACKEND_URL
}

function buildDocumentsUrl(request: NextRequest): URL {
  const base = resolveBackendUrl()
  try {
    const url = new URL("/api/documents", base)
    url.search = new URL(request.url).searchParams.toString()
    return url
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

export async function GET(request: NextRequest) {
  try {
    const backendUrl = buildDocumentsUrl(request)
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

    const documents = Array.isArray(parsedBody.documents)
      ? parsedBody.documents
      : Array.isArray(parsedBody.items)
        ? parsedBody.items
        : []

    const searchParams = new URL(request.url).searchParams
    const page = Number.parseInt(searchParams.get("page") || "1")
    const pageSize = Number.parseInt(searchParams.get("page_size") || "10")
    const startIndex = (page - 1) * pageSize
    const endIndex = startIndex + pageSize

    const normalizedDocuments = documents.map((doc: any) => {
      const normalized = normalizeDocument(doc)
      return {
        id: normalized.id,
        title: normalized.title,
        creator_name: normalized.creator_name,
        updated_at: normalized.updated_at,
        tags: normalized.tags,
      }
    })

    const paginatedDocuments = normalizedDocuments.slice(startIndex, endIndex)

    const nextResponse = NextResponse.json({
      items: paginatedDocuments,
      page,
      page_size: pageSize,
      total: normalizedDocuments.length,
    })

    const setCookieHeader = backendResponse.headers.get("set-cookie")
    if (setCookieHeader) {
      nextResponse.headers.set("set-cookie", setCookieHeader)
    }

    return nextResponse
  } catch (error) {
    return NextResponse.json({ error: "Error al obtener textos" }, { status: 500 })
  }
}

export async function POST(request: NextRequest) {
  try {
    const backendUrl = buildDocumentsUrl(request)
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

    const responseBody = backendResponse.ok ? normalizeDocument(parsedBody) : parsedBody

    const nextResponse = NextResponse.json(responseBody, { status: backendResponse.status })

    const setCookieHeader = backendResponse.headers.get("set-cookie")
    if (setCookieHeader) {
      nextResponse.headers.set("set-cookie", setCookieHeader)
    }

    return nextResponse
  } catch (error) {
    return NextResponse.json({ error: "Error al crear texto" }, { status: 500 })
  }
}
