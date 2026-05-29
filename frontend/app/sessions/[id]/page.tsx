"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Loader2, RefreshCw, Users } from "lucide-react"
import { toast } from "sonner"
import {
  getSession,
  getSessionQueries,
  updateSession,
  type Session,
  type SessionQueryItem,
} from "@/lib/sessions"

export default function SessionDetailPage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = Number(params.id)

  const [session, setSession] = useState<Session | null>(null)
  const [queries, setQueries] = useState<SessionQueryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [queriesLoading, setQueriesLoading] = useState(false)
  const [toggling, setToggling] = useState(false)

  const loadSession = useCallback(async () => {
    if (!sessionId || isNaN(sessionId)) return
    try {
      setLoading(true)
      const s = await getSession(sessionId)
      setSession(s)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar la sesión")
    } finally {
      setLoading(false)
    }
  }, [sessionId])

  const loadQueries = useCallback(async () => {
    if (!sessionId || isNaN(sessionId)) return
    try {
      setQueriesLoading(true)
      const data = await getSessionQueries(sessionId)
      setQueries(data)
    } catch (err) {
      console.error("Error loading queries", err)
    } finally {
      setQueriesLoading(false)
    }
  }, [sessionId])

  useEffect(() => {
    loadSession()
  }, [loadSession])

  useEffect(() => {
    if (!session) return
    loadQueries()
    const interval = setInterval(loadQueries, 2000)
    return () => clearInterval(interval)
  }, [session, loadQueries])

  const handleToggleActive = async () => {
    if (!session) return
    try {
      setToggling(true)
      const updated = await updateSession(session.id, {
        is_active: !session.is_active,
      })
      setSession((prev) => (prev ? { ...prev, is_active: updated.is_active } : prev))
      toast.success(updated.is_active ? "Sesión activada" : "Sesión desactivada")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar")
    } finally {
      setToggling(false)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="flex h-full items-center justify-center">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      </AppLayout>
    )
  }

  if (!session) {
    return (
      <AppLayout>
        <div className="flex h-full flex-col items-center justify-center gap-4">
          <p className="text-gray-600">No se encontró la sesión.</p>
          <Button variant="outline" onClick={() => router.push("/sessions")}>
            Volver
          </Button>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="mx-auto w-full max-w-5xl px-4 py-8 sm:px-6 lg:px-8">
          <Button
            variant="ghost"
            size="sm"
            className="mb-6"
            onClick={() => router.push("/sessions")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver
          </Button>

          <div className="grid gap-6 lg:grid-cols-3">
            {/* Left column — Session info */}
            <div className="space-y-6 lg:col-span-1">
              <Card>
                <CardHeader>
                  <CardTitle className="text-base">{session.title}</CardTitle>
                </CardHeader>
                <CardContent className="space-y-4">
                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Código de acceso
                    </p>
                    <p className="mt-1 font-mono text-3xl font-bold tracking-widest text-gray-900">
                      {session.access_code}
                    </p>
                  </div>

                  <div className="flex items-center gap-2">
                    <Badge variant={session.is_active ? "default" : "secondary"}>
                      {session.is_active ? "Activa" : "Inactiva"}
                    </Badge>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={toggling}
                      onClick={handleToggleActive}
                    >
                      {toggling ? (
                        <Loader2 className="h-3 w-3 animate-spin" />
                      ) : session.is_active ? (
                        "Desactivar"
                      ) : (
                        "Activar"
                      )}
                    </Button>
                  </div>

                  {session.instructions && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        Consigna
                      </p>
                      <p className="mt-1 whitespace-pre-wrap text-sm text-gray-700">
                        {session.instructions}
                      </p>
                    </div>
                  )}

                  {session.prompt && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        Prompt
                      </p>
                      <p className="mt-1 text-sm font-medium text-gray-700">
                        {session.prompt.name}
                      </p>
                    </div>
                  )}

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Modelo
                    </p>
                    <p className="mt-1 text-sm text-gray-700">{session.llm_model_name}</p>
                  </div>
                </CardContent>
              </Card>
            </div>

            {/* Right column — Live feed */}
            <div className="lg:col-span-2">
              <Card className="h-full">
                <CardHeader className="flex flex-row items-center justify-between">
                  <CardTitle className="flex items-center gap-2 text-base">
                    <Users className="h-4 w-4" />
                    Interacciones en vivo
                  </CardTitle>
                  <Button variant="ghost" size="sm" onClick={loadQueries} disabled={queriesLoading}>
                    <RefreshCw className={`h-4 w-4 ${queriesLoading ? "animate-spin" : ""}`} />
                  </Button>
                </CardHeader>
                <CardContent>
                  {queries.length === 0 ? (
                    <div className="py-12 text-center text-sm text-gray-500">
                      <p>Todavía no hay interacciones.</p>
                      <p className="mt-1">Los alumnos que se unan aparecerán aquí.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {queries.map((q) => (
                        <div
                          key={q.id}
                          className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm"
                        >
                          <div className="flex items-center justify-between">
                            <span className="text-xs font-medium text-gray-500">
                              {q.participant_name || "Anónimo"}
                            </span>
                            <span className="text-xs text-gray-400">
                              {new Date(q.created_at).toLocaleTimeString()}
                            </span>
                          </div>
                          <p className="mt-2 text-sm font-medium text-gray-900">
                            {q.query_text}
                          </p>
                          <div className="mt-2 rounded bg-gray-50 p-3 text-sm text-gray-700">
                            {q.response_text}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
