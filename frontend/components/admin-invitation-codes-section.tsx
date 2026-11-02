"use client"

import { useCallback, useEffect, useState } from "react"
import { Copy, Link2, Plus, Power, PowerOff } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { buildBackendUrl } from "@/lib/backend"

interface InvitationCode {
  id: number
  code: string
  created_at: string
  duration_days: number
  max_uses: number | null
  uses_count: number
  is_active: boolean
  expires_at: string
  used_by: string[]
}

function todayArInputValue(): string {
  // YYYY-MM-DD in America/Argentina for the date input default
  return new Date().toLocaleDateString("en-CA", { timeZone: "America/Argentina/Buenos_Aires" })
}

function codeStatus(code: InvitationCode): { label: string; className: string } {
  if (!code.is_active) {
    return { label: "Desactivado", className: "bg-gray-100 text-gray-600" }
  }
  if (new Date(code.expires_at) < new Date()) {
    return { label: "Vencido", className: "bg-red-50 text-red-700" }
  }
  if (code.max_uses !== null && code.uses_count >= code.max_uses) {
    return { label: "Agotado", className: "bg-amber-50 text-amber-700" }
  }
  return { label: "Activo", className: "bg-green-50 text-green-700" }
}

export function AdminInvitationCodesSection() {
  const [codes, setCodes] = useState<InvitationCode[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)

  const [durationDays, setDurationDays] = useState<7 | 15 | 30>(15)
  const [maxUses, setMaxUses] = useState("")
  const [expiresOn, setExpiresOn] = useState(todayArInputValue)

  const load = useCallback(async () => {
    try {
      setLoading(true)
      const response = await fetch(buildBackendUrl("/api/admin/invitation-codes"), {
        credentials: "include",
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || "Error al cargar códigos")
      }
      setCodes(data.codes || [])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar los códigos")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    void load()
  }, [load])

  const handleCreate = async (e: React.FormEvent) => {
    e.preventDefault()
    if (creating) return
    setCreating(true)
    try {
      const response = await fetch(buildBackendUrl("/api/admin/invitation-codes"), {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          duration_days: durationDays,
          max_uses: maxUses.trim() === "" ? null : Number(maxUses),
          expires_on: expiresOn || undefined,
        }),
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || "Error al crear el código")
      }
      toast.success(`Código creado: ${data.code}`)
      try {
        await navigator.clipboard.writeText(data.code)
        toast.success("Código copiado al portapapeles")
      } catch {
        // clipboard may be unavailable; the code is visible in the table
      }
      await load()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear el código")
    } finally {
      setCreating(false)
    }
  }

  const handleToggle = async (code: InvitationCode) => {
    try {
      const response = await fetch(buildBackendUrl(`/api/admin/invitation-codes/${code.id}/toggle`), {
        method: "POST",
        credentials: "include",
      })
      const data = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(data.error || "Error al cambiar el estado")
      }
      setCodes((prev) => prev.map((c) => (c.id === code.id ? { ...c, is_active: data.is_active } : c)))
      toast.success(data.is_active ? "Código activado" : "Código desactivado")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar el estado")
    }
  }

  const handleCopy = async (text: string, label: string) => {
    try {
      await navigator.clipboard.writeText(text)
      toast.success(`${label} copiado al portapapeles`)
    } catch {
      toast.error("No se pudo copiar")
    }
  }

  const formatDate = (value: string | null) => {
    if (!value) return "—"
    return new Date(value).toLocaleString("es-AR")
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-6">
        <h2 className="text-xl font-semibold text-gray-900">Códigos de invitación</h2>
        <p className="text-sm text-gray-500">
          Códigos multi-uso para invitar personas a probar Calíope por 7, 15 o 30 días. Se canjean
          desde el botón "Tengo un código de invitación" en la pantalla de acceso.
        </p>
      </div>

      <form onSubmit={handleCreate} className="mb-8 flex flex-wrap items-end gap-4">
        <div>
          <Label htmlFor="duration">Duración de la prueba</Label>
          <select
            id="duration"
            value={durationDays}
            onChange={(e) => setDurationDays(Number(e.target.value) as 7 | 15 | 30)}
            className="mt-1 block w-36 rounded-md border border-gray-300 bg-white px-3 py-2 text-sm focus:border-[#1862A2] focus:outline-none"
          >
            <option value={7}>7 días</option>
            <option value={15}>15 días</option>
            <option value={30}>30 días</option>
          </select>
        </div>
        <div>
          <Label htmlFor="maxUses">Usos máximos (opcional)</Label>
          <Input
            id="maxUses"
            type="number"
            min={1}
            value={maxUses}
            onChange={(e) => setMaxUses(e.target.value)}
            placeholder="Ilimitado"
            className="mt-1 w-36"
          />
        </div>
        <div>
          <Label htmlFor="expiresOn">Canjeable hasta</Label>
          <Input
            id="expiresOn"
            type="date"
            value={expiresOn}
            onChange={(e) => setExpiresOn(e.target.value)}
            className="mt-1 w-44"
          />
        </div>
        <Button type="submit" disabled={creating}>
          <Plus className="h-4 w-4 mr-2" />
          {creating ? "Generando..." : "Generar código"}
        </Button>
      </form>

      {loading ? (
        <div className="space-y-4">
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-12 w-full" />
        </div>
      ) : codes.length === 0 ? (
        <div className="rounded-xl border border-dashed border-gray-200 p-8 text-center text-sm text-gray-500">
          Todavía no hay códigos. Generá el primero con el formulario de arriba.
        </div>
      ) : (
        <div className="overflow-hidden rounded-xl border border-gray-100">
          <table className="min-w-full divide-y divide-gray-200 text-sm">
            <thead className="bg-gray-50">
              <tr>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Código</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Prueba</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Usos</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Canjeable hasta</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Estado</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Usado por</th>
                <th className="px-4 py-3 text-left font-medium text-gray-600">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100 bg-white">
              {codes.map((code) => {
                const status = codeStatus(code)
                const joinUrl = `${window.location.origin}/join/${code.code}`
                return (
                  <tr key={code.id} className="hover:bg-gray-50/80">
                    <td className="px-4 py-3 font-mono text-xs text-gray-900">{code.code}</td>
                    <td className="px-4 py-3 text-gray-600">{code.duration_days} días</td>
                    <td className="px-4 py-3 text-gray-600">
                      {code.uses_count}
                      {code.max_uses !== null ? ` / ${code.max_uses}` : ""}
                    </td>
                    <td className="px-4 py-3 text-gray-600">{formatDate(code.expires_at)}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium ${status.className}`}
                      >
                        {status.label}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-gray-600 text-xs">
                      {code.used_by.length > 0 ? code.used_by.join(", ") : "—"}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex flex-wrap items-center gap-1">
                        <Button
                          variant="outline"
                          size="sm"
                          title="Copiar código"
                          onClick={() => handleCopy(code.code, "Código")}
                        >
                          <Copy className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          title="Copiar link"
                          onClick={() => handleCopy(joinUrl, "Link")}
                        >
                          <Link2 className="h-4 w-4" />
                        </Button>
                        <Button
                          variant="outline"
                          size="sm"
                          title={code.is_active ? "Desactivar" : "Activar"}
                          onClick={() => handleToggle(code)}
                        >
                          {code.is_active ? (
                            <PowerOff className="h-4 w-4" />
                          ) : (
                            <Power className="h-4 w-4" />
                          )}
                        </Button>
                      </div>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}
