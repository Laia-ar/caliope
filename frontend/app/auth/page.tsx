"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { getBackendBaseUrl } from "@/lib/backend"

const getRedirectTarget = () => {
  if (typeof window === "undefined") {
    return null
  }

  const redirectTo = new URLSearchParams(window.location.search).get("redirectTo")
  if (!redirectTo) return null
  if (!redirectTo.startsWith("/") || redirectTo.startsWith("//")) return null
  return redirectTo
}

const getLoginError = () => {
  if (typeof window === "undefined") {
    return null
  }

  const errorParam = new URLSearchParams(window.location.search).get("error")
  if (errorParam === "dominio_no_permitido") {
    return "Solo se permiten cuentas de los dominios autorizados."
  }
  if (errorParam) {
    return errorParam
  }
  return null
}

export default function LoginPage() {
  const router = useRouter()
  const backendBaseUrl = getBackendBaseUrl()
  const [error, setError] = useState("")

  const resolveRedirectTarget = () => getRedirectTarget()

  useEffect(() => {
    const loginError = getLoginError()
    if (loginError) {
      setError(loginError)
    }

    let aborted = false

    const checkExistingSession = async () => {
      try {
        const response = await fetch("/api/check-auth", {
          method: "GET",
          credentials: "include",
        })

        if (!aborted && response.ok) {
          const redirectTarget = resolveRedirectTarget()
          router.replace(redirectTarget ?? "/welcome")
        }
      } catch {
        // No autenticado: quedarse en la página de login
      }
    }

    void checkExistingSession()

    return () => {
      aborted = true
    }
  }, [router])

  const handleGoogleLogin = () => {
    // Use current origin since backend is proxied through same origin
    const baseUrl = typeof window !== 'undefined' ? window.location.origin : backendBaseUrl
    const loginUrl = new URL("/login", baseUrl)
    const redirectTarget = resolveRedirectTarget()

    if (redirectTarget) {
      loginUrl.searchParams.set("redirectTo", redirectTarget)
    }

    window.location.href = loginUrl.toString()
  }

  return (
    <div className="min-h-screen animated-gradient flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        {/* Title */}
        <h1 className="text-4xl font-semibold text-center mb-8 text-gray-900 font-sans">Calíope</h1>

        {/* Error Message */}
        {error && <div className="text-red-600 text-sm text-center mb-4">{error}</div>}

        {/* Google Login Button */}
        <Button
          onClick={handleGoogleLogin}
          variant="outline"
          className="w-full py-3 text-[#1862A2] border-[#1862A2] hover:bg-[#1862A2]/5 bg-transparent"
        >
          Entrar con @laia.ar o @buber.edu.ar
        </Button>
      </div>
    </div>
  )
}
