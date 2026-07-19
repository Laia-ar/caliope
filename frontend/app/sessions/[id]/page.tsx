"use client"

import { useEffect, useState, useCallback } from "react"
import { useRouter, useParams } from "next/navigation"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { ArrowLeft, Loader2, RefreshCw, Users, Copy, Check, ExternalLink, Upload } from "lucide-react"
import { toast } from "sonner"
import {
  getSession,
  getSessionQueries,
  updateSession,
  type Session,
  type SessionQueryItem,
} from "@/lib/sessions"
import {
  fetchClassroomCourses,
  exportSessionToClassroomCoursework,
  exportSessionToClassroomMaterials,
  type ClassroomCourse,
} from "@/lib/classroom"
import { renderHtmlContent } from "@/lib/html"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

function groupQueriesByParticipant(queries: SessionQueryItem[]): SessionQueryItem[][] {
  const map = new Map<number | null, SessionQueryItem[]>()
  for (const q of queries) {
    const key = q.participant_id ?? null
    if (!map.has(key)) {
      map.set(key, [])
    }
    map.get(key)!.push(q)
  }
  // Sort each group by created_at desc (should already be sorted, but be explicit)
  const groups = Array.from(map.values()).map((group) =>
    group.sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime())
  )
  // Sort groups by latest query date desc
  groups.sort((a, b) => new Date(b[0].created_at).getTime() - new Date(a[0].created_at).getTime())
  return groups
}

export default function SessionDetailPage() {
  const router = useRouter()
  const params = useParams()
  const sessionId = Number(params.id)

  const [session, setSession] = useState<Session | null>(null)
  const [queries, setQueries] = useState<SessionQueryItem[]>([])
  const [loading, setLoading] = useState(true)
  const [queriesLoading, setQueriesLoading] = useState(false)
  const [toggling, setToggling] = useState(false)
  const [copied, setCopied] = useState(false)

  const [isExportModalOpen, setIsExportModalOpen] = useState(false)
  const [courses, setCourses] = useState<ClassroomCourse[]>([])
  const [selectedCourse, setSelectedCourse] = useState<string>("")
  const [exportTitle, setExportTitle] = useState<string>("")
  const [exportDescription, setExportDescription] = useState<string>("")
  const [isExporting, setIsExporting] = useState(false)
  const [loadingCourses, setLoadingCourses] = useState(false)

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

  const publicJoinUrl = typeof window !== "undefined" && session
    ? `${window.location.origin}/session/${session.access_code}`
    : ""

  const handleCopyLink = async () => {
    if (!publicJoinUrl) return
    try {
      await navigator.clipboard.writeText(publicJoinUrl)
      setCopied(true)
      toast.success("Link copiado al portapapeles")
      setTimeout(() => setCopied(false), 2000)
    } catch {
      toast.error("No se pudo copiar el link")
    }
  }

  const handleOpenExport = async () => {
    setIsExportModalOpen(true)
    setExportTitle(session?.title ? `${session.title} - Textos de alumnos` : "Textos de alumnos")
    setExportDescription(session?.instructions ? `Consigna: ${session.instructions}` : "Documentos generados desde Caliope.")
    setLoadingCourses(true)
    try {
      const data = await fetchClassroomCourses()
      setCourses(data)
      if (data.length > 0) {
        setSelectedCourse(data[0].id)
      }
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudieron cargar los cursos"
      if (message.includes("google_auth_required")) {
        toast.error("Se requiere autorización de Google Classroom", {
          action: {
            label: "Autorizar",
            onClick: () =>
              window.location.href = `/api/auth/google/classroom?redirectTo=${encodeURIComponent(window.location.pathname)}`,
          },
        })
      } else {
        toast.error(message)
      }
    } finally {
      setLoadingCourses(false)
    }
  }

  const handleExportCoursework = async () => {
    if (!selectedCourse || !session) return
    try {
      setIsExporting(true)
      const result = await exportSessionToClassroomCoursework(
        session.id, selectedCourse, exportTitle, exportDescription
      )
      toast.success(`Creada actividad con ${result.exported_count} documentos`, {
        action: result.coursework_url
          ? { label: "Ver en Classroom", onClick: () => window.open(result.coursework_url, "_blank") }
          : undefined,
      })
      setIsExportModalOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear la actividad en Classroom")
    } finally {
      setIsExporting(false)
    }
  }

  const handleExportMaterials = async () => {
    if (!selectedCourse || !session) return
    try {
      setIsExporting(true)
      const result = await exportSessionToClassroomMaterials(
        session.id, selectedCourse, exportTitle, exportDescription
      )
      toast.success(`Creado material con ${result.exported_count} documentos`, {
        action: result.material_url
          ? { label: "Ver en Classroom", onClick: () => window.open(result.material_url, "_blank") }
          : undefined,
      })
      setIsExportModalOpen(false)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear el material en Classroom")
    } finally {
      setIsExporting(false)
    }
  }

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

                  <div>
                    <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                      Link para alumnos
                    </p>
                    <div className="mt-1 flex items-center gap-2">
                      <a
                        href={publicJoinUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex-1 truncate text-sm text-blue-600 hover:underline"
                        title={publicJoinUrl}
                      >
                        {publicJoinUrl}
                      </a>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        onClick={handleCopyLink}
                        title="Copiar link"
                      >
                        {copied ? (
                          <Check className="h-4 w-4 text-green-600" />
                        ) : (
                          <Copy className="h-4 w-4" />
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        className="h-8 w-8 p-0"
                        asChild
                        title="Abrir sesión"
                      >
                        <a href={publicJoinUrl} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="h-4 w-4" />
                        </a>
                      </Button>
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    <Badge variant={session.is_active ? "default" : "secondary"}>
                      {session.is_active ? "Activa" : "Inactiva"}
                    </Badge>
                    <Badge variant="outline">
                      {session.access_level === "registered"
                        ? "Solo registrados"
                        : session.access_level === "guests"
                          ? "Solo invitados"
                          : "Ambos"}
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

                  {session.grade && (
                    <div>
                      <p className="text-xs font-medium uppercase tracking-wide text-gray-500">
                        Grado
                      </p>
                      <p className="mt-1 text-sm text-gray-700">{session.grade.name}</p>
                    </div>
                  )}
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
                  <div className="flex items-center gap-2">
                    <Button variant="outline" size="sm" onClick={handleOpenExport}>
                      <Upload className="mr-2 h-4 w-4" />
                      Exportar a Classroom
                    </Button>
                    <Button variant="ghost" size="sm" onClick={loadQueries} disabled={queriesLoading}>
                      <RefreshCw className={`h-4 w-4 ${queriesLoading ? "animate-spin" : ""}`} />
                    </Button>
                  </div>
                </CardHeader>
                <CardContent>
                  {queries.length === 0 ? (
                    <div className="py-12 text-center text-sm text-gray-500">
                      <p>Todavía no hay interacciones.</p>
                      <p className="mt-1">Los alumnos que se unan aparecerán aquí.</p>
                    </div>
                  ) : (
                    <div className="space-y-4">
                      {groupQueriesByParticipant(queries).map((group) => {
                        const latest = group[0]
                        const rest = group.slice(1)
                        return (
                          <div
                            key={latest.participant_id ?? latest.id}
                            className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm"
                          >
                            <div className="flex items-center justify-between">
                              <span className="text-xs font-medium text-gray-500">
                                {latest.participant_name || "Anónimo"}
                              </span>
                              <span className="text-xs text-gray-400">
                                {new Date(latest.created_at).toLocaleTimeString()}
                              </span>
                            </div>
                            <div
                              className="mt-2 text-sm font-medium text-gray-900 prose prose-sm max-w-none"
                              dangerouslySetInnerHTML={{ __html: renderHtmlContent(latest.query_text) }}
                            />
                            <div
                              className="mt-2 rounded bg-gray-50 p-3 text-sm text-gray-700 prose prose-sm max-w-none"
                              dangerouslySetInnerHTML={{ __html: renderHtmlContent(latest.response_text) }}
                            />

                            {rest.length > 0 && (
                              <details className="mt-3 rounded-md bg-gray-50 p-3">
                                <summary className="cursor-pointer text-xs font-medium text-gray-600 hover:text-gray-900">
                                  Ver {rest.length} interacción{rest.length === 1 ? "" : "es"} anterior{rest.length === 1 ? "" : "es"}
                                </summary>
                                <div className="mt-3 space-y-3 border-l-2 border-gray-200 pl-3">
                                  {rest.map((q) => (
                                    <div key={q.id} className="text-sm">
                                      <div className="text-xs text-gray-400">
                                        {new Date(q.created_at).toLocaleTimeString()}
                                      </div>
                                      <div
                                        className="mt-1 font-medium text-gray-900 prose prose-sm max-w-none"
                                        dangerouslySetInnerHTML={{ __html: renderHtmlContent(q.query_text) }}
                                      />
                                      <div
                                        className="mt-1 rounded bg-white p-2 text-gray-700 prose prose-sm max-w-none"
                                        dangerouslySetInnerHTML={{ __html: renderHtmlContent(q.response_text) }}
                                      />
                                    </div>
                                  ))}
                                </div>
                              </details>
                            )}
                          </div>
                        )
                      })}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>
          </div>
        </div>
      </div>

      <Dialog open={isExportModalOpen} onOpenChange={setIsExportModalOpen}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle>Exportar a Google Classroom</DialogTitle>
            <DialogDescription>
              Seleccioná el curso y completá el título y descripción. Podés crear una actividad (CourseWork) con los documentos adjuntos, o un material independiente.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Curso</label>
              <Select value={selectedCourse} onValueChange={setSelectedCourse} disabled={loadingCourses}>
                <SelectTrigger>
                  <SelectValue placeholder={loadingCourses ? "Cargando cursos..." : "Seleccioná un curso"} />
                </SelectTrigger>
                <SelectContent>
                  {courses.map((course) => (
                    <SelectItem key={course.id} value={course.id}>
                      {course.name} {course.section ? `(${course.section})` : ""}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Título</label>
              <input
                type="text"
                value={exportTitle}
                onChange={(e) => setExportTitle(e.target.value)}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Título de la actividad o material"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm font-medium text-gray-700">Descripción</label>
              <textarea
                value={exportDescription}
                onChange={(e) => setExportDescription(e.target.value)}
                rows={3}
                className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                placeholder="Descripción para los alumnos"
              />
            </div>
          </div>
          <DialogFooter className="flex-col gap-2 sm:flex-row">
            <Button variant="outline" onClick={() => setIsExportModalOpen(false)} disabled={isExporting}>
              Cancelar
            </Button>
            <Button
              onClick={handleExportMaterials}
              disabled={isExporting || !selectedCourse || !exportTitle.trim()}
              variant="secondary"
            >
              {isExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Crear material
            </Button>
            <Button
              onClick={handleExportCoursework}
              disabled={isExporting || !selectedCourse || !exportTitle.trim()}
            >
              {isExporting ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Upload className="mr-2 h-4 w-4" />
              )}
              Crear actividad
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </AppLayout>
  )
}
