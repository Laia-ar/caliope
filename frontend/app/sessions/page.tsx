"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Eye, Trash2, LogIn } from "lucide-react"
import { toast } from "sonner"
import {
  listSessions,
  deleteSession,
  fetchParticipatedSessions,
  fetchStudentSessions,
  type Session,
} from "@/lib/sessions"
import { fetchAuthUser } from "@/lib/auth"

export default function SessionsPage() {
  const router = useRouter()
  const [createdSessions, setCreatedSessions] = useState<Session[]>([])
  const [participatedSessions, setParticipatedSessions] = useState<Session[]>([])
  const [gradeSessions, setGradeSessions] = useState<Session[]>([])
  const [loadingCreated, setLoadingCreated] = useState(true)
  const [loadingParticipated, setLoadingParticipated] = useState(true)
  const [loadingGradeSessions, setLoadingGradeSessions] = useState(true)
  const [isTeacher, setIsTeacher] = useState(false)

  useEffect(() => {
    const loadAuth = async () => {
      const user = await fetchAuthUser()
      setIsTeacher(user?.is_teacher ?? false)
    }

    const loadCreated = async () => {
      try {
        setLoadingCreated(true)
        const data = await listSessions()
        setCreatedSessions(data)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudieron cargar las tareas creadas")
      } finally {
        setLoadingCreated(false)
      }
    }

    const loadParticipated = async () => {
      try {
        setLoadingParticipated(true)
        const data = await fetchParticipatedSessions()
        setParticipatedSessions(data)
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudieron cargar las tareas en las que participás")
      } finally {
        setLoadingParticipated(false)
      }
    }

    const loadGradeSessions = async () => {
      try {
        setLoadingGradeSessions(true)
        const data = await fetchStudentSessions()
        setGradeSessions(data)
      } catch (err) {
        // Silently ignore for users without grade assignments
        console.error("Error loading grade sessions", err)
      } finally {
        setLoadingGradeSessions(false)
      }
    }

    void loadAuth()
    void loadCreated()
    void loadParticipated()
    void loadGradeSessions()
  }, [])

  const handleDelete = async (id: number) => {
    if (!confirm("¿Estás seguro de que querés eliminar esta tarea?")) return
    try {
      await deleteSession(id)
      toast.success("Tarea eliminada")
      setCreatedSessions((prev) => prev.filter((s) => s.id !== id))
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar la tarea")
    }
  }

  const renderSessionCard = (
    session: Session,
    actions: "manage" | "join"
  ) => (
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
          {actions === "manage" ? (
            <>
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
            </>
          ) : (
            <Button
              variant="outline"
              size="sm"
              className="w-full"
              onClick={() => router.push(`/session/${session.access_code}`)}
            >
              <LogIn className="mr-1 h-4 w-4" />
              Entrar
            </Button>
          )}
        </div>
      </CardContent>
    </Card>
  )

  const isLoading = loadingCreated || loadingParticipated || loadingGradeSessions

  return (
    <AppLayout>
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <div className="mb-8 flex items-center justify-between">
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Mis tareas</h1>
              <p className="mt-1 text-sm text-gray-500">
                Gestiona las tareas que creaste o accedé a las que participás.
              </p>
            </div>
            {isTeacher && (
              <Button onClick={() => router.push("/sessions/new")}>
                <Plus className="mr-2 h-4 w-4" />
                Nueva tarea
              </Button>
            )}
          </div>

          {isLoading ? (
            <p className="text-sm text-gray-500">Cargando tareas...</p>
          ) : (
            <div className="space-y-10">
              {/* Grade sessions */}
              <section>
                <h2 className="mb-4 text-lg font-medium text-gray-900">Tareas de mis cursos</h2>
                {gradeSessions.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
                    <p className="text-gray-600">No tenés tareas asignadas a tus cursos todavía.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {gradeSessions.map((session) => renderSessionCard(session, "join"))}
                  </div>
                )}
              </section>

              {/* Created sessions */}
              {isTeacher && (
                <section>
                  <h2 className="mb-4 text-lg font-medium text-gray-900">Creadas por mí</h2>
                  {createdSessions.length === 0 ? (
                    <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
                      <p className="text-gray-600">No tenés tareas creadas todavía.</p>
                    </div>
                  ) : (
                    <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                      {createdSessions.map((session) => renderSessionCard(session, "manage"))}
                    </div>
                  )}
                </section>
              )}

              {/* Participated sessions */}
              <section>
                <h2 className="mb-4 text-lg font-medium text-gray-900">En las que participé</h2>
                {participatedSessions.length === 0 ? (
                  <div className="rounded-xl border border-dashed border-gray-300 bg-white p-8 text-center">
                    <p className="text-gray-600">Todavía no participaste de ninguna tarea.</p>
                  </div>
                ) : (
                  <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                    {participatedSessions.map((session) => renderSessionCard(session, "join"))}
                  </div>
                )}
              </section>
            </div>
          )}
        </div>
      </div>
    </AppLayout>
  )
}
