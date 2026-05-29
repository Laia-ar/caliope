"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Eye, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { listSessions, deleteSession, type Session } from "@/lib/sessions"

export default function SessionsPage() {
  const router = useRouter()
  const [sessions, setSessions] = useState<Session[]>([])
  const [loading, setLoading] = useState(true)

  const loadSessions = async () => {
    try {
      setLoading(true)
      const data = await listSessions()
      setSessions(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar las sesiones")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadSessions()
  }, [])

  const handleDelete = async (id: number) => {
    if (!confirm("¿Estás seguro de que querés eliminar esta sesión?")) return
    try {
      await deleteSession(id)
      toast.success("Sesión eliminada")
      setSessions((prev) => prev.filter((s) => s.id !== id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar la sesión")
    }
  }

  return (
    <AppLayout>
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Mis sesiones</h1>
              <p className="mt-1 text-sm text-gray-500">
                Creá sesiones para compartir con tus alumnos.
              </p>
            </div>
            <Button onClick={() => router.push("/sessions/new")}>
              <Plus className="mr-2 h-4 w-4" />
              Nueva sesión
            </Button>
          </div>

          {loading ? (
            <p className="text-sm text-gray-500">Cargando sesiones...</p>
          ) : sessions.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-300 bg-white p-12 text-center">
              <p className="text-gray-600">No tenés sesiones creadas todavía.</p>
              <Button className="mt-4" onClick={() => router.push("/sessions/new")}>
                Crear la primera sesión
              </Button>
            </div>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {sessions.map((session) => (
                <Card key={session.id} className="border-gray-200">
                  <CardHeader className="pb-3">
                    <div className="flex items-start justify-between">
                      <CardTitle className="text-base font-medium">{session.title}</CardTitle>
                      <span
                        className={`inline-flex rounded-full px-2 py-0.5 text-xs font-medium ${
                          session.is_active
                            ? "bg-green-100 text-green-700"
                            : "bg-gray-100 text-gray-600"
                        }`}
                      >
                        {session.is_active ? "Activa" : "Inactiva"}
                      </span>
                    </div>
                  </CardHeader>
                  <CardContent className="pt-0">
                    <p className="font-mono text-lg font-semibold tracking-wider text-gray-900">
                      {session.access_code}
                    </p>
                    <p className="mt-1 text-xs text-gray-500">Código de acceso</p>
                    <div className="mt-4 flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        className="flex-1"
                        onClick={() => router.push(`/sessions/${session.id}`)}
                      >
                        <Eye className="mr-1 h-4 w-4" />
                        Ver
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        className="text-red-600 hover:bg-red-50 hover:text-red-700"
                        onClick={() => handleDelete(session.id)}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
