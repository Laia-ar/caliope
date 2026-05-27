"use client"

import type React from "react"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Eye, EyeOff } from "lucide-react"
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

export default function LoginPage() {
  const router = useRouter()
  const backendBaseUrl = getBackendBaseUrl()
  const [showPassword, setShowPassword] = useState(false)
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")

  const resolveRedirectTarget = () => getRedirectTarget()

  useEffect(() => {
    let aborted = false

    const checkExistingSession = async () => {
      try {
        console.log("[Auth Debug] Checking session...")
        const response = await fetch("/api/check-auth", {
          method: "GET",
          credentials: "include",
        })

        console.log("[Auth Debug] Response status:", response.status)
        
        if (!aborted && response.ok) {
          const data = await response.json()
          console.log("[Auth Debug] User authenticated:", data)
          const redirectTarget = resolveRedirectTarget()
          router.replace(redirectTarget ?? "/welcome")
        } else {
          console.log("[Auth Debug] Not authenticated, staying on login page")
        }
      } catch (err) {
        console.error("[Auth Debug] Check failed:", err)
      }
    }

    void checkExistingSession()

    return () => {
      aborted = true
    }
  }, [router])

  const handleLocalLogin = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const response = await fetch("/api/local-login", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({ username, password }),
      })

      const data = await response.json().catch(() => ({ error: "Respuesta inválida" }))

      if (!response.ok) {
        setError(typeof data?.error === "string" ? data.error : "Credenciales inválidas")
        return
      }

      const redirectTarget = resolveRedirectTarget()
      router.push(redirectTarget ?? "/welcome")
    } catch (err) {
      setError("Error al iniciar sesión")
    } finally {
      setIsLoading(false)
    }
  }

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

        {/* Google Login Button */}
        <Button
          onClick={handleGoogleLogin}
          variant="outline"
          className="w-full mb-6 py-3 text-[#1862A2] border-[#1862A2] hover:bg-[#1862A2]/5 bg-transparent"
        >
          Continuar con cuenta @laia.ar
        </Button>

        {/* Divider */}
        <div className="relative mb-6">
          <div className="absolute inset-0 flex items-center">
            <div className="w-full border-t border-gray-300" />
          </div>
          <div className="relative flex justify-center text-sm">
            <span className="px-4 bg-white text-gray-500">o acceder con email</span>
          </div>
        </div>

        {/* Login Form */}
        <form onSubmit={handleLocalLogin} className="space-y-4">
          {/* Email/Username Input */}
          <Input
            type="text"
            placeholder="Mail/Usuario"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full py-3 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1862A2] focus:border-transparent"
          />

          {/* Password Input */}
          <div className="relative">
            <Input
              type={showPassword ? "text" : "password"}
              placeholder="Contraseña"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full py-3 px-4 pr-12 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1862A2] focus:border-transparent"
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
            </button>
          </div>

          {/* Forgot Password Link */}
          <div className="text-left">
            <button type="button" className="text-sm text-gray-600 hover:text-gray-900 underline">
              Recuperar contraseña
            </button>
          </div>

          {/* Error Message */}
          {error && <div className="text-red-600 text-sm text-center">{error}</div>}

          {/* Login Button */}
          <Button
            type="submit"
            disabled={isLoading}
            variant="primary"
            className="w-full py-3 rounded-lg font-medium"
          >
            {isLoading ? "Accediendo..." : "Acceder"}
          </Button>
        </form>

        {/* Sign Up Link */}
        <div className="text-center mt-6">
          <button type="button" className="text-sm text-gray-600 hover:text-gray-900 underline">
            Conseguí un usuario
          </button>
        </div>
      </div>
    </div>
  )
}
