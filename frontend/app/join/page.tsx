"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowRight, Loader2 } from "lucide-react"
import { toast } from "sonner"

export default function JoinPage() {
  const router = useRouter()
  const [code, setCode] = useState("")
  const [isLoading, setIsLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    const trimmed = code.trim().toUpperCase()
    if (!trimmed) {
      toast.error("Ingresá un código")
      return
    }
    setIsLoading(true)
    try {
      const response = await fetch(`/api/sessions/by-code/${trimmed}`)
      if (!response.ok) {
        throw new Error("Código inválido o sesión inactiva")
      }
      router.push(`/session/${trimmed}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo verificar el código")
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
      <div className="w-full max-w-md">
        <h1 className="text-center text-3xl font-semibold text-gray-900">Calíope</h1>
        <p className="mt-2 text-center text-sm text-gray-500">
          Ingresá el código de la sesión para participar.
        </p>

        <form onSubmit={handleSubmit} className="mt-8 space-y-4">
          <div className="space-y-2">
            <Label htmlFor="code">Código de acceso</Label>
            <Input
              id="code"
              placeholder="Ej: A3B9K1"
              value={code}
              onChange={(e) => setCode(e.target.value)}
              className="text-center font-mono text-lg tracking-widest uppercase"
              maxLength={10}
            />
          </div>
          <Button type="submit" className="w-full" disabled={isLoading}>
            {isLoading ? (
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            ) : (
              <ArrowRight className="mr-2 h-4 w-4" />
            )}
            Entrar
          </Button>
        </form>
      </div>
    </div>
  )
}
