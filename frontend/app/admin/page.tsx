"use client"

import { useEffect, useMemo, useState } from "react"
import { Download, Edit3, Upload } from "lucide-react"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
  fetchAdminStats,
  fetchAdminUsers,
  updateTeacherStatus,
  updateUserFeatures,
  fetchUsageSummary,
  fetchUsageOverTime,
  syncUsageCosts,
  fetchOpenRouterCredits,
  type AdminStats,
  type AdminUser,
  type UsageSummaryUser,
  type UsageOverTimePoint,
  type OpenRouterCredits,
} from "@/lib/admin"
import { buildBackendUrl } from "@/lib/backend"
import { AdminModelsSection } from "@/components/admin-models-section"
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts"

interface EditableUser extends AdminUser {
  password?: string
}

const STAT_LABELS: Record<string, string> = {
  total_users: "Usuarios totales",
  active_users: "Usuarios activos",
  documents: "Textos",
  prompts: "Prompts",
  public_prompts: "Prompts públicos",
  queries: "Consultas realizadas",
}

export default function AdminPage() {
  const [stats, setStats] = useState<AdminStats | null>(null)
  const [users, setUsers] = useState<AdminUser[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [editingUser, setEditingUser] = useState<EditableUser | null>(null)
  const [isUploading, setIsUploading] = useState(false)
  const [togglingTeacherId, setTogglingTeacherId] = useState<number | null>(null)
  const [togglingUserId, setTogglingUserId] = useState<number | null>(null)

  const [usageUsers, setUsageUsers] = useState<UsageSummaryUser[]>([])
  const [usageOverTime, setUsageOverTime] = useState<UsageOverTimePoint[]>([])
  const [usageGroupBy, setUsageGroupBy] = useState<"day" | "week" | "month">("day")
  const [isSyncingCosts, setIsSyncingCosts] = useState(false)
  const [credits, setCredits] = useState<OpenRouterCredits | null>(null)
  const [isSyncingCredits, setIsSyncingCredits] = useState(false)

  const statEntries = useMemo(() => {
    if (!stats) {
      return []
    }

    return Object.entries(stats).filter(([, value]) => typeof value === "number")
  }, [stats])

  useEffect(() => {
    let cancelled = false

    const loadData = async () => {
      try {
        setLoading(true)
        setError(null)

        const [statsResponse, usersResponse, usageResponse, usageTimeResponse, creditsResponse] = await Promise.all([
          fetchAdminStats(),
          fetchAdminUsers(),
          fetchUsageSummary(),
          fetchUsageOverTime(usageGroupBy),
          fetchOpenRouterCredits().catch(() => null),
        ])

        if (!cancelled) {
          setStats(statsResponse)
          setUsers(usersResponse)
          setUsageUsers(usageResponse)
          setUsageOverTime(usageTimeResponse)
          setCredits(creditsResponse)
        }
      } catch (err) {
        if (!cancelled) {
          const message = err instanceof Error ? err.message : "No se pudieron cargar los datos"
          setError(message)
        }
      } finally {
        if (!cancelled) {
          setLoading(false)
        }
      }
    }

    void loadData()

    return () => {
      cancelled = true
    }
  }, [usageGroupBy])

  const handleSyncCredits = async () => {
    try {
      setIsSyncingCredits(true)
      const result = await fetchOpenRouterCredits()
      setCredits(result)
      toast.success("Saldo de OpenRouter sincronizado")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo sincronizar el saldo")
    } finally {
      setIsSyncingCredits(false)
    }
  }

  const handleSyncCosts = async () => {
    try {
      setIsSyncingCosts(true)
      const result = await syncUsageCosts()
      toast.success(`Costos sincronizados: ${result.updated} actualizados, ${result.failed} fallidos`)
      const [usageResponse, usageTimeResponse] = await Promise.all([
        fetchUsageSummary(),
        fetchUsageOverTime(usageGroupBy),
      ])
      setUsageUsers(usageResponse)
      setUsageOverTime(usageTimeResponse)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron sincronizar los costos")
    } finally {
      setIsSyncingCosts(false)
    }
  }

  const handleDownloadDatabase = () => {
    window.open(buildBackendUrl("/api/admin/download-db"), "_blank")
  }

  const handleUploadDatabase = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    // Validate file extension
    if (!file.name.endsWith('.db')) {
      toast.error('Solo se permiten archivos .db')
      return
    }

    setIsUploading(true)

    try {
      const formData = new FormData()
      formData.append('file', file)

      const response = await fetch(buildBackendUrl('/api/admin/upload-db'), {
        method: 'POST',
        credentials: 'include',
        body: formData,
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Error al subir la base de datos')
      }

      toast.success(`Base de datos subida exitosamente. Tablas: ${data.tables?.length || 0}. Recargando...`)
      
      // Recargar la página para reiniciar conexiones de DB
      setTimeout(() => {
        window.location.reload()
      }, 1500)
    } catch (error) {
      toast.error(error instanceof Error ? error.message : 'Error al subir la base de datos')
    } finally {
      setIsUploading(false)
      // Reset input
      event.target.value = ''
    }
  }

  const handleEditUser = (user: AdminUser) => {
    setEditingUser({ ...user })
    setIsEditModalOpen(true)
  }

  const handleSaveUser = () => {
    toast.info("La edición individual de usuarios todavía no está disponible. Editá el JSON para realizar cambios.")
    setIsEditModalOpen(false)
    setEditingUser(null)
  }

  const handleToggleTeacher = async (user: AdminUser) => {
    setTogglingTeacherId(user.id)
    try {
      await updateTeacherStatus(user.id, !user.can_create_sessions)
      setUsers((prev) =>
        prev.map((u) =>
          u.id === user.id ? { ...u, can_create_sessions: !user.can_create_sessions } : u
        )
      )
      toast.success(
        user.can_create_sessions
          ? "Se quitó el rol de docente"
          : "Se asignó el rol de docente"
      )
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar el rol")
    } finally {
      setTogglingTeacherId(null)
    }
  }

  const handleToggleCanInvite = async (user: AdminUser) => {
    if (togglingUserId === user.id) return
    setTogglingUserId(user.id)
    try {
      const updated = await updateUserFeatures(user.id, {
        can_create_invites: !user.can_create_invites,
      })
      setUsers((prev) =>
        prev.map((u) => (u.id === user.id ? { ...u, can_create_invites: updated.can_create_invites } : u))
      )
      toast.success(`Usuario ${updated.username} actualizado.`)
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo actualizar el usuario"
      toast.error(message)
    } finally {
      setTogglingUserId(null)
    }
  }

  const renderContent = () => {
    if (loading) {
      return (
        <div className="space-y-6">
          <Skeleton className="h-32 w-full" />
          <Skeleton className="h-12 w-full" />
          <Skeleton className="h-64 w-full" />
        </div>
      )
    }

    if (error) {
      return (
        <div className="rounded-xl border border-red-200 bg-red-50 p-6 text-red-700">
          <h2 className="text-lg font-semibold">No se pudo acceder al panel</h2>
          <p className="mt-2 text-sm">{error}</p>
        </div>
      )
    }

    return (
      <div className="space-y-10">
        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Estadísticas</h2>
              <p className="text-sm text-gray-500">Resumen general de la actividad de Calíope</p>
            </div>
            <div className="flex gap-2 self-start md:self-auto">
              <Button
                variant="outline"
                size="sm"
                onClick={handleDownloadDatabase}
                disabled={isUploading}
              >
                <Download className="h-4 w-4" />
                Descargar base de datos
              </Button>
              
              <div className="relative">
                <input
                  type="file"
                  accept=".db"
                  onChange={handleUploadDatabase}
                  disabled={isUploading}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                  id="db-upload"
                />
                <Button
                  variant="outline"
                  size="sm"
                  disabled={isUploading}
                  asChild
                >
                  <label htmlFor="db-upload" className="cursor-pointer disabled:cursor-not-allowed">
                    <Upload className="h-4 w-4" />
                    {isUploading ? 'Subiendo...' : 'Subir base de datos'}
                  </label>
                </Button>
              </div>
            </div>
          </div>

          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {statEntries.length === 0 ? (
              <div className="rounded-xl border border-dashed border-gray-200 p-6 text-center text-sm text-gray-500">
                No hay estadísticas disponibles por el momento.
              </div>
            ) : (
              statEntries.map(([key, value]) => (
                <div key={key} className="rounded-xl border border-gray-100 bg-gray-50 p-6">
                  <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                    {STAT_LABELS[key] ?? key.replace(/_/g, " ")}
                  </p>
                  <p className="mt-3 text-3xl font-semibold text-gray-900">{value}</p>
                </div>
              ))
            )}
          </div>
        </section>

        <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div>
              <h2 className="text-xl font-semibold text-gray-900">Usuarios</h2>
              <p className="text-sm text-gray-500">
                {users.length === 1 ? "1 usuario registrado" : `${users.length} usuarios registrados`}
              </p>
            </div>
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border border-gray-100">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Usuario</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Nombre</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Rol</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Docente</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Puede invitar</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={7} className="px-4 py-8 text-center text-gray-500">
                      No hay usuarios para mostrar.
                    </td>
                  </tr>
                ) : (
                  users.map((user) => (
                    <tr key={user.id} className="hover:bg-gray-50/80">
                      <td className="px-4 py-3 font-medium text-gray-900">{user.username}</td>
                      <td className="px-4 py-3 text-gray-600">{user.email || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{user.name || "—"}</td>
                      <td className="px-4 py-3 text-gray-600">{user.is_admin ? "Admin" : "Usuario"}</td>
                      <td className="px-4 py-3">
                        <Button
                          variant={user.can_create_sessions ? "default" : "outline"}
                          size="sm"
                          disabled={togglingTeacherId === user.id}
                          onClick={() => handleToggleTeacher(user)}
                        >
                          {user.can_create_sessions ? "Sí" : "No"}
                        </Button>
                      </td>
                      <td className="px-4 py-3">
                        <label className="inline-flex items-center gap-2 cursor-pointer">
                          <input
                            type="checkbox"
                            className="h-4 w-4 rounded border-gray-300 text-[#1862A2] focus:ring-[#1862A2]"
                            checked={user.can_create_invites}
                            onChange={() => handleToggleCanInvite(user)}
                            disabled={togglingUserId === user.id}
                          />
                          <span className="text-gray-600">{user.can_create_invites ? "Sí" : "No"}</span>
                        </label>
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex flex-wrap items-center gap-2">
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => handleEditUser(user)}
                          >
                            <Edit3 className="h-4 w-4" />
                            Editar
                          </Button>
                          <Button variant="secondary" size="sm" disabled title="Próximamente">
                            Eliminar
                          </Button>
                        </div>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>

        <section className="mb-10">
          <div className="mb-4 flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">Uso de OpenRouter</h2>
            <Button variant="outline" onClick={handleSyncCosts} disabled={isSyncingCosts}>
              {isSyncingCosts ? "Sincronizando..." : "Sincronizar costos"}
            </Button>
          </div>

          {credits && (
            <div className="mb-6 grid gap-4 sm:grid-cols-3">
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-6">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Créditos totales</p>
                <p className="mt-3 text-3xl font-semibold text-gray-900">${credits.total_credits.toFixed(2)}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-6">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Uso acumulado</p>
                <p className="mt-3 text-3xl font-semibold text-gray-900">${credits.total_usage.toFixed(2)}</p>
              </div>
              <div className="rounded-xl border border-gray-100 bg-gray-50 p-6">
                <p className="text-xs font-medium uppercase tracking-wide text-gray-500">Saldo restante</p>
                <div className="flex items-center justify-between">
                  <p className="mt-3 text-3xl font-semibold text-gray-900">${credits.balance_usd.toFixed(2)}</p>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={handleSyncCredits}
                    disabled={isSyncingCredits}
                  >
                    {isSyncingCredits ? "Sincronizando..." : "Sincronizar"}
                  </Button>
                </div>
                <p className="mt-2 text-xs text-gray-400">
                  Actualizado {new Date(credits.checked_at).toLocaleString()}
                </p>
              </div>
            </div>
          )}

          <div className="mb-6 overflow-hidden rounded-xl border border-gray-200 bg-white">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Usuario</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Consultas</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Tokens</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Costo USD</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {usageUsers.length === 0 ? (
                  <tr>
                    <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                      No hay datos de uso registrados.
                    </td>
                  </tr>
                ) : (
                  usageUsers.map((u) => (
                    <tr key={u.id}>
                      <td className="px-4 py-3">
                        <div className="font-medium text-gray-900">{u.name}</div>
                        <div className="text-xs text-gray-500">{u.username}</div>
                      </td>
                      <td className="px-4 py-3">{u.total_queries}</td>
                      <td className="px-4 py-3">{u.total_tokens.toLocaleString()}</td>
                      <td className="px-4 py-3">${u.total_cost_usd.toFixed(6)}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>

          <div className="rounded-xl border border-gray-200 bg-white p-4">
            <div className="mb-4 flex items-center gap-2">
              <span className="text-sm font-medium text-gray-700">Agrupar por:</span>
              {(["day", "week", "month"] as const).map((g) => (
                <Button
                  key={g}
                  variant={usageGroupBy === g ? "default" : "outline"}
                  size="sm"
                  onClick={() => setUsageGroupBy(g)}
                >
                  {g === "day" ? "Día" : g === "week" ? "Semana" : "Mes"}
                </Button>
              ))}
            </div>
            <div className="h-80">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={usageOverTime}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis dataKey="period" />
                  <YAxis yAxisId="left" />
                  <YAxis yAxisId="right" orientation="right" />
                  <Tooltip />
                  <Line
                    yAxisId="left"
                    type="monotone"
                    dataKey="total_tokens"
                    name="Tokens"
                    stroke="#1862A2"
                    strokeWidth={2}
                    dot={false}
                  />
                  <Line
                    yAxisId="right"
                    type="monotone"
                    dataKey="total_cost_usd"
                    name="Costo USD"
                    stroke="#10B981"
                    strokeWidth={2}
                    dot={false}
                  />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>
        </section>

        <AdminModelsSection />
      </div>
    )
  }

  return (
    <AppLayout>
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="mx-auto w-full max-w-6xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-10">
            <h1 className="text-3xl font-semibold text-gray-900">Panel de administración</h1>
            <p className="mt-2 text-gray-600">
              Consultá estadísticas y gestioná los usuarios que pueden acceder a Calíope.
            </p>
          </div>
          {renderContent()}
        </div>
      </div>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Editar usuario</DialogTitle>
            <DialogDescription>
              Podés consultar los datos y editar el archivo JSON para aplicar cambios.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Usuario</label>
              <Input value={editingUser?.username ?? ""} disabled />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Password</label>
              <Input
                type="password"
                value={editingUser?.password ?? ""}
                onChange={(event) =>
                  setEditingUser((prev) =>
                    prev ? { ...prev, password: event.target.value } : prev,
                  )
                }
                placeholder="(Sólo informativo, editar desde JSON)"
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Email</label>
              <Input
                value={editingUser?.email ?? ""}
                onChange={(event) =>
                  setEditingUser((prev) =>
                    prev ? { ...prev, email: event.target.value } : prev,
                  )
                }
              />
            </div>
            <div>
              <label className="mb-1 block text-sm font-medium text-gray-700">Nombre</label>
              <Input
                value={editingUser?.name ?? ""}
                onChange={(event) =>
                  setEditingUser((prev) =>
                    prev ? { ...prev, name: event.target.value } : prev,
                  )
                }
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsEditModalOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveUser}>Guardar</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
