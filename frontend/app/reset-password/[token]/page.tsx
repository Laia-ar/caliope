"use client"

import { useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { toast } from "sonner"
import { buildBackendUrl } from "@/lib/backend"
import Link from "next/link"

export default function ResetPasswordPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [password, setPassword] = useState("")
  const [confirm, setConfirm] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [done, setDone] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (isLoading) return

    if (password.length < 6) {
      setError("La contraseña debe tener al menos 6 caracteres")
      return
    }
    if (password !== confirm) {
      setError("Las contraseñas no coinciden")
      return
    }

    setIsLoading(true)
    setError("")

    try {
      const response = await fetch(buildBackendUrl(`/api/reset-password/${token}`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok) {
        setError(typeof data?.error === "string" ? data.error : "No se pudo actualizar la contraseña")
        return
      }

      setDone(true)
      toast.success("Contraseña actualizada")
      setTimeout(() => router.push("/auth"), 2000)
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

        {done ? (
          <div className="text-center">
            <p className="text-gray-700">Contraseña actualizada. Redirigiendo al inicio de sesión…</p>
            <Link href="/auth">
              <Button variant="outline" className="mt-6 w-full">
                Ir al inicio de sesión
              </Button>
            </Link>
          </div>
        ) : (
          <>
            <p className="text-sm text-gray-600 text-center mb-6">Elegí tu nueva contraseña.</p>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="password">Nueva contraseña</Label>
                <Input
                  id="password"
                  type="password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Mínimo 6 caracteres"
                  required
                  autoFocus
                />
              </div>
              <div>
                <Label htmlFor="confirm">Repetí la contraseña</Label>
                <Input
                  id="confirm"
                  type="password"
                  value={confirm}
                  onChange={(e) => setConfirm(e.target.value)}
                  required
                />
              </div>

              {error && <div className="text-red-600 text-sm text-center">{error}</div>}

              <Button
                type="submit"
                disabled={isLoading || !password || !confirm}
                variant="primary"
                className="w-full py-3 rounded-lg font-medium"
              >
                {isLoading ? "Guardando..." : "Guardar contraseña"}
              </Button>
            </form>
          </>
        )}
      </div>
    </div>
  )
}
