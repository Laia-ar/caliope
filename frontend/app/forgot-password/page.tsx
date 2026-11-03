"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { buildBackendUrl } from "@/lib/backend"
import Link from "next/link"

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [sent, setSent] = useState(false)
  const [error, setError] = useState("")

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading || !email.trim()) return

    setIsLoading(true)
    setError("")

    try {
      const response = await fetch(buildBackendUrl("/api/forgot-password"), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim() }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(typeof data?.error === "string" ? data.error : "No se pudo procesar el pedido")
        return
      }
      setSent(true)
    } catch {
      setError("Error de conexión. Probá de nuevo.")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="min-h-screen animated-gradient flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white rounded-2xl shadow-xl p-8">
        <h1 className="text-3xl font-semibold text-center mb-6 text-gray-900 font-sans">Calíope</h1>

        {sent ? (
          <div className="text-center">
            <p className="text-gray-700">
              Si existe una cuenta con ese email, te enviamos un link para restablecer la
              contraseña. Revisá tu bandeja de entrada (y el spam).
            </p>
            <p className="mt-3 text-sm text-gray-500">El link vence en 1 hora.</p>
            <Link href="/auth">
              <Button variant="outline" className="mt-6 w-full">
                Volver al inicio de sesión
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-600 text-center mb-6">
              Ingresá tu email y te enviamos un link para restablecer tu contraseña.
            </p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                type="email"
                placeholder="tu@email.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full py-3 px-4 border border-gray-300 rounded-lg focus:ring-2 focus:ring-[#1862A2] focus:border-transparent"
                required
                autoFocus
              />

              {error && <div className="text-red-600 text-sm text-center">{error}</div>}

              <Button
                type="submit"
                disabled={isLoading || !email.trim()}
                variant="primary"
                className="w-full py-3 rounded-lg font-medium"
              >
                {isLoading ? "Enviando..." : "Enviar link"}
              </Button>
            </form>

            <div className="text-center mt-6">
              <Link href="/auth" className="text-sm text-gray-600 hover:text-gray-900 underline">
                Volver al inicio de sesión
              </Link>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
