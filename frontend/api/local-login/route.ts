import { type NextRequest, NextResponse } from "next/server"

const DEFAULT_BACKEND_URL = "http://127.0.0.1:5000"

function resolveBackendUrl(): string {
  return process.env.BACKEND_URL || process.env.NEXT_PUBLIC_BACKEND_URL || DEFAULT_BACKEND_URL
}

function buildBackendUrl(): URL {
  const base = resolveBackendUrl()
  try {
    return new URL("/api/local-login", base)
  } catch (error) {
    throw new Error("BACKEND_URL inválida")
  }
}

export async function POST(request: NextRequest) {
  try {
    const { username, password } = await request.json()

    if (!username || !password) {
      return NextResponse.json({ error: "Usuario y contraseña requeridos" }, { status: 400 })
    }

    const backendUrl = buildBackendUrl()

    const backendResponse = await fetch(backendUrl, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Cookie: request.headers.get("cookie") ?? "",
      },
      body: JSON.stringify({ username, password }),
      redirect: "manual",
    })

    const rawBody = await backendResponse.text()
    let parsedBody: unknown

    try {
      parsedBody = JSON.parse(rawBody)
    } catch (error) {
      parsedBody = rawBody ? { error: rawBody } : { error: "Respuesta inválida del backend" }
    }

    const nextResponse = NextResponse.json(parsedBody, { status: backendResponse.status })

    const setCookieHeader = backendResponse.headers.get("set-cookie")
    if (setCookieHeader) {
      nextResponse.headers.set("set-cookie", setCookieHeader)
    }

    return nextResponse
  } catch (error) {
    return NextResponse.json({ error: "Error al procesar la solicitud" }, { status: 500 })
  }
}
