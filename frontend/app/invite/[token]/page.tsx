"use client"

import { useEffect, useState } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { buildBackendUrl } from "@/lib/backend"
import Link from "next/link"

export default function InviteRegisterPage() {
  const params = useParams()
  const router = useRouter()
  const token = params.token as string

  const [checking, setChecking] = useState(true)
  const [valid, setValid] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)

  const [username, setUsername] = useState("")
  const [email, setEmail] = useState("")
  const [name, setName] = useState("")
  const [password, setPassword] = useState("")

  useEffect(() => {
    let cancelled = false

    const check = async () => {
      try {
        const response = await fetch(buildBackendUrl(`/api/invitations/${token}`))
        const data = await response.json()
        if (!response.ok) {
          throw new Error(data.error || "Link inválido")
        }
        if (!cancelled) {
          setValid(true)
        }
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Link inválido")
        }
      } finally {
        if (!cancelled) {
          setChecking(false)
        }
      }
    }

    void check()
    return () => {
      cancelled = true
    }
  }, [token])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (submitting) return

    if (!username || !email || !name || !password) {
      toast.error("Todos los campos son obligatorios")
      return
    }
    if (password.length < 6) {
      toast.error("La contraseña debe tener al menos 6 caracteres")
      return
    }

    setSubmitting(true)
    try {
      const response = await fetch(buildBackendUrl(`/api/invitations/${token}/register`), {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ username, email, name, password }),
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Error al registrar")
      }
      toast.success(data.message || "Cuenta creada exitosamente")
      router.push("/auth")
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo crear la cuenta"
      toast.error(message)
    } finally {
      setSubmitting(false)
    }
  }

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md space-y-6">
          <Skeleton className="h-8 w-3/4 mx-auto" />
          <Skeleton className="h-4 w-1/2 mx-auto" />
          <Skeleton className="h-32 w-full" />
        </div>
      </div>
    )
  }

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
        <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
          <h1 className="text-2xl font-semibold text-gray-900">Link inválido</h1>
          <p className="mt-3 text-gray-600">{error}</p>
          <div className="mt-6">
            <Link href="/auth">
              <Button variant="outline">Ir al inicio de sesión</Button>
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-50 px-4">
      <div className="w-full max-w-md rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-semibold text-gray-900">Creá tu cuenta</h1>
          <p className="mt-2 text-sm text-gray-600">
            Te invitaron a probar Calíope. Completá tus datos para empezar tu prueba de 15 días.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <Label htmlFor="username">Usuario</Label>
            <Input
              id="username"
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="Tu nombre de usuario"
              required
            />
          </div>
          <div>
            <Label htmlFor="email">Email</Label>
            <Input
              id="email"
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="tu@email.com"
              required
            />
          </div>
          <div>
            <Label htmlFor="name">Nombre completo</Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tu nombre"
              required
            />
          </div>
          <div>
            <Label htmlFor="password">Contraseña</Label>
            <Input
              id="password"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="Mínimo 6 caracteres"
              required
            />
          </div>
          <Button type="submit" className="w-full" disabled={submitting}>
            {submitting ? "Creando cuenta..." : "Crear cuenta"}
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-gray-500">
          ¿Ya tenés cuenta?{" "}
          <Link href="/auth" className="text-[#1862A2] hover:underline">
            Iniciá sesión
          </Link>
        </p>
      </div>
    </div>
  )
}
