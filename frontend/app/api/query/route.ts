import { type NextRequest, NextResponse } from "next/server"

const DEFAULT_BACKEND_URL = "http://127.0.0.1:5000"

function resolveBackendUrl(): string {
  return process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || DEFAULT_BACKEND_URL
}

function buildQueryUrl(): URL {
  const base = resolveBackendUrl()
  try {
    return new URL("/api/query", base)
  } catch (error) {
    throw new Error("BACKEND_URL inválida")
  }
}

export async function POST(request: NextRequest) {
  try {
    const backendUrl = buildQueryUrl()
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

    if (!backendResponse.ok) {
      return NextResponse.json(parsedBody, { status: backendResponse.status })
    }

    const responseBody = {
      ...parsedBody,
      timestamp: parsedBody?.timestamp ?? new Date().toISOString(),
    }

    const nextResponse = NextResponse.json(responseBody, { status: backendResponse.status })

    const setCookieHeader = backendResponse.headers.get("set-cookie")
    if (setCookieHeader) {
      nextResponse.headers.set("set-cookie", setCookieHeader)
    }

    return nextResponse
  } catch (error) {
    return NextResponse.json({ error: "Error al procesar la consulta" }, { status: 500 })
  }
}
