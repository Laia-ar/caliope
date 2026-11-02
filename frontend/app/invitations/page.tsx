"use client"

import { useEffect, useState } from "react"
import { Copy, Link2, Plus } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import { buildBackendUrl } from "@/lib/backend"

interface Invitation {
  id: number
  token: string
  created_at: string
  expires_at: string
  used: boolean
  used_at: string | null
  used_by_email: string | null
}

export default function InvitationsPage() {
  const [invitations, setInvitations] = useState<Invitation[]>([])
  const [loading, setLoading] = useState(true)
  const [creating, setCreating] = useState(false)
  const [newInviteUrl, setNewInviteUrl] = useState<string | null>(null)
  const [isDialogOpen, setIsDialogOpen] = useState(false)

  useEffect(() => {
    let cancelled = false

    const load = async () => {
      try {
        setLoading(true)
        const response = await fetch(buildBackendUrl("/api/invitations"), {
          credentials: "include",
        })
        if (!response.ok) {
          const data = await response.json().catch(() => ({}))
          throw new Error(data.error || "Error al cargar invitaciones")
        }
        const data = await response.json()
        if (!cancelled) {
          setInvitations(data.invitations || [])
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "No se pudieron cargar las invitaciones"
          toast.error(message)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void load()
    return () => {
      cancelled = true
    }
  }, [])

  const handleCreate = async () => {
    if (creating) return
    setCreating(true)
    try {
      const response = await fetch(buildBackendUrl("/api/invitations"), {
        method: "POST",
        credentials: "include",
      })
      const data = await response.json()
      if (!response.ok) {
        throw new Error(data.error || "Error al crear invitación")
      }
      setNewInviteUrl(data.invite_url)
      setIsDialogOpen(true)
      setInvitations((prev) => [
        {
          id: data.id,
          token: data.token,
          created_at: new Date().toISOString(),
          expires_at: data.expires_at,
          used: false,
          used_at: null,
          used_by_email: null,
        },
        ...prev,
      ])
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo crear la invitación"
      toast.error(message)
    } finally {
      setCreating(false)
    }
  }

  const handleCopy = async () => {
    if (!newInviteUrl) return
    try {
      await navigator.clipboard.writeText(newInviteUrl)
      toast.success("Link copiado al portapapeles")
    } catch {
      toast.error("No se pudo copiar el link")
    }
  }

  const formatDate = (value: string | null) => {
    if (!value) return "—"
    return new Date(value).toLocaleString("es-AR")
  }

  return (
    <AppLayout>
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-10 flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h1 className="text-3xl font-semibold text-gray-900">Invitaciones</h1>
              <p className="mt-2 text-gray-600">
                Creá links de invitación de un solo uso para que otras personas prueben Calíope.
              </p>
            </div>
            <Button onClick={handleCreate} disabled={creating} className="self-start md:self-auto">
              <Plus className="h-4 w-4 mr-2" />
              {creating ? "Generando..." : "Generar link"}
            </Button>
          </div>

          {loading ? (
            <div className="space-y-4">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : invitations.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-gray-200 bg-white p-12 text-center">
              <Link2 className="mx-auto h-10 w-10 text-gray-300" />
              <h3 className="mt-4 text-lg font-medium text-gray-900">No tenés invitaciones</h3>
              <p className="mt-1 text-sm text-gray-500">
                Generá tu primer link para invitar a alguien a probar Calíope por 15 días.
              </p>
            </div>
          ) : (
            <div className="overflow-hidden rounded-xl border border-gray-200 bg-white shadow-sm">
              <table className="min-w-full divide-y divide-gray-200 text-sm">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Link</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Creado</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Expira</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Estado</th>
                    <th className="px-4 py-3 text-left font-medium text-gray-600">Usado por</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100 bg-white">
                  {invitations.map((inv) => (
                    <tr key={inv.id} className="hover:bg-gray-50/80">
                      <td className="px-4 py-3 font-mono text-xs text-gray-700">
                        {inv.token.slice(0, 12)}…
                      </td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(inv.created_at)}</td>
                      <td className="px-4 py-3 text-gray-600">{formatDate(inv.expires_at)}</td>
                      <td className="px-4 py-3">
                        {inv.used ? (
                          <span className="inline-flex items-center rounded-full bg-green-50 px-2 py-0.5 text-xs font-medium text-green-700">
                            Usado
                          </span>
                        ) : new Date(inv.expires_at) < new Date() ? (
                          <span className="inline-flex items-center rounded-full bg-red-50 px-2 py-0.5 text-xs font-medium text-red-700">
                            Expirado
                          </span>
                        ) : (
                          <span className="inline-flex items-center rounded-full bg-blue-50 px-2 py-0.5 text-xs font-medium text-blue-700">
                            Pendiente
                          </span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-gray-600">
                        {inv.used_by_email || "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>

      <Dialog open={isDialogOpen} onOpenChange={setIsDialogOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>Link de invitación generado</DialogTitle>
            <DialogDescription>
              Compartí este link con una sola persona. Expira en 7 días si no se usa.
            </DialogDescription>
          </DialogHeader>
          <div className="flex items-center gap-2 rounded-lg border border-gray-200 bg-gray-50 p-3">
            <code className="flex-1 break-all text-sm text-gray-800">{newInviteUrl}</code>
            <Button variant="outline" size="sm" onClick={handleCopy}>
              <Copy className="h-4 w-4" />
            </Button>
          </div>
          <DialogFooter>
            <Button onClick={() => setIsDialogOpen(false)}>Cerrar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
