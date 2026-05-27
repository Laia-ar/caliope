import { type NextRequest, NextResponse } from "next/server"

const DEFAULT_BACKEND_URL = "http://127.0.0.1:5000"

function resolveBackendUrl(): string {
  return process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || DEFAULT_BACKEND_URL
}

function buildHistoryUrl(request: NextRequest): URL {
  const base = resolveBackendUrl()
  try {
    const url = new URL("/api/queries/history", base)
    url.search = new URL(request.url).searchParams.toString()
    return url
  } catch (error) {
    throw new Error("BACKEND_URL inválida")
  }
}

export async function GET(request: NextRequest) {
  try {
    const backendUrl = buildHistoryUrl(request)
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

    const nextResponse = NextResponse.json(parsedBody, { status: backendResponse.status })

    const setCookieHeader = backendResponse.headers.get("set-cookie")
    if (setCookieHeader) {
      nextResponse.headers.set("set-cookie", setCookieHeader)
    }

    return nextResponse
  } catch (error) {
    return NextResponse.json({ error: "Error al obtener el historial" }, { status: 500 })
  }
}
