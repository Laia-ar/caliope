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
  fetchUsersRawJson,
  updateUsersRawJson,
  type AdminStats,
  type AdminUser,
} from "@/lib/admin"
import { buildBackendUrl } from "@/lib/backend"

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

  const [isRawEditorOpen, setIsRawEditorOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [rawUsersJson, setRawUsersJson] = useState("")
  const [isRawJsonLoading, setIsRawJsonLoading] = useState(false)
  const [isRawJsonSaving, setIsRawJsonSaving] = useState(false)
  const [editingUser, setEditingUser] = useState<EditableUser | null>(null)
  const [isUploading, setIsUploading] = useState(false)

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

        const [statsResponse, usersResponse] = await Promise.all([
          fetchAdminStats(),
          fetchAdminUsers(),
        ])

        if (!cancelled) {
          setStats(statsResponse)
          setUsers(usersResponse)
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
  }, [])

  const handleOpenRawEditor = async () => {
    try {
      setIsRawJsonLoading(true)
      const content = await fetchUsersRawJson()
      setRawUsersJson(content)
      setIsRawEditorOpen(true)
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo cargar el archivo JSON"
      toast.error(message)
    } finally {
      setIsRawJsonLoading(false)
    }
  }

  const handleSaveRawJson = async () => {
    try {
      JSON.parse(rawUsersJson)
    } catch (error) {
      toast.error("El JSON no tiene un formato válido")
      return
    }

    try {
      setIsRawJsonSaving(true)
      await updateUsersRawJson(rawUsersJson)
      toast.success("Archivo actualizado correctamente")
      setIsRawEditorOpen(false)

      const [statsResponse, usersResponse] = await Promise.all([
        fetchAdminStats(),
        fetchAdminUsers(),
      ])
      setStats(statsResponse)
      setUsers(usersResponse)
    } catch (error) {
      const message = error instanceof Error ? error.message : "No se pudo guardar el archivo"
      toast.error(message)
    } finally {
      setIsRawJsonSaving(false)
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
            <Button
              variant="outline"
              onClick={handleOpenRawEditor}
              disabled={isRawJsonLoading}
            >
              {isRawJsonLoading ? "Abriendo..." : "Editar JSON crudo"}
            </Button>
          </div>

          <div className="mt-6 overflow-hidden rounded-xl border border-gray-100">
            <table className="min-w-full divide-y divide-gray-200 text-sm">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Usuario</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Email</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Nombre</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Rol</th>
                  <th className="px-4 py-3 text-left font-medium text-gray-600">Acciones</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100 bg-white">
                {users.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-8 text-center text-gray-500">
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

      <Dialog open={isRawEditorOpen} onOpenChange={setIsRawEditorOpen}>
        <DialogContent className="max-w-3xl">
          <DialogHeader>
            <DialogTitle>Editar usuarios</DialogTitle>
            <DialogDescription>
              Modificá el contenido de <code>users.json</code>. Al guardar se validará que el formato sea JSON válido.
            </DialogDescription>
          </DialogHeader>
          <Textarea
            value={rawUsersJson}
            onChange={(event) => setRawUsersJson(event.target.value)}
            rows={16}
            className="font-mono text-sm"
          />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsRawEditorOpen(false)}>
              Cancelar
            </Button>
            <Button onClick={handleSaveRawJson} disabled={isRawJsonSaving}>
              {isRawJsonSaving ? "Guardando..." : "Guardar cambios"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
