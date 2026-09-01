"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TipTapEditor } from "@/components/tiptap-editor"
import { QuestionCard } from "@/components/question-card"
import { toast } from "sonner"
import { Send, Loader2, BookOpen, LogIn, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Upload, CheckCircle2, History } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { ChecklistConfirmDialog } from "@/components/checklist-confirm-dialog"
import {
  getSessionByCode,
  joinSession,
  sendSessionQuery,
  getParticipantMe,
  setParticipantStage,
  submitSessionWork,
  getParticipantQueries,
  type Session,
  type ParticipantInfo,
  type SessionQueryItem,
} from "@/lib/sessions"

interface Question {
  id: string
  text: string
}

interface AuthUser {
  id: number
  name: string
  email: string
}

function getTokenKey(code: string) {
  return `session_token_${code.toUpperCase()}`
}

function getDraftKey(code: string) {
  return `session_draft_${code.toUpperCase()}`
}

export default function StudentSessionPage() {
  const params = useParams()
  const router = useRouter()
  const code = String(params.code).toUpperCase()

  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [authLoading, setAuthLoading] = useState(true)
  const [token, setToken] = useState<string>("")
  const [participant, setParticipant] = useState<ParticipantInfo | null>(null)
  const [pendingToken, setPendingToken] = useState<string | null>(null)
  const [storedParticipant, setStoredParticipant] = useState<ParticipantInfo | null>(null)
  const [checkingStored, setCheckingStored] = useState(false)
  const [displayName, setDisplayName] = useState("")
  const [joining, setJoining] = useState(false)
  const [editorContent, setEditorContent] = useState("")
  const [draftContent, setDraftContent] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [questions, setQuestions] = useState<Question[]>([])
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)
  const [currentStageId, setCurrentStageId] = useState<number | null>(null)
  const [changingStage, setChangingStage] = useState(false)
  const [submitted, setSubmitted] = useState<string | null>(null)
  const [submissionUrl, setSubmissionUrl] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const [showConsigna, setShowConsigna] = useState(true)
  const [stageDialogOpen, setStageDialogOpen] = useState(false)
  const [submitDialogOpen, setSubmitDialogOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [historyQueries, setHistoryQueries] = useState<SessionQueryItem[]>([])
  const [loadingHistory, setLoadingHistory] = useState(false)

  const loadSession = useCallback(async () => {
    try {
      setLoading(true)
      setLoadError(null)
      const s = await getSessionByCode(code)
      setSession(s)
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo cargar la tarea"
      setLoadError(message)
      toast.error(message)
    } finally {
      setLoading(false)
    }
  }, [code])

  const loadAuth = useCallback(async () => {
    try {
      setAuthLoading(true)
      const response = await fetch("/api/check-auth", {
        method: "GET",
        credentials: "include",
      })
      if (response.ok) {
        const data = await response.json()
        if (data && typeof data.id === "number") {
          setAuthUser(data)
        } else {
          setAuthUser(null)
        }
      } else {
        setAuthUser(null)
      }
    } catch {
      setAuthUser(null)
    } finally {
      setAuthLoading(false)
    }
  }, [])

  useEffect(() => {
    loadSession()
    loadAuth()
    if (typeof window !== "undefined") {
      const storedToken = localStorage.getItem(getTokenKey(code))
      if (storedToken) {
        setPendingToken(storedToken)
      }
      const savedDraft = localStorage.getItem(getDraftKey(code))
      setDraftContent(savedDraft || "")
    }
  }, [loadSession, loadAuth, code])

  // Validate a stored participant token against the backend before resuming
  useEffect(() => {
    if (!session || !pendingToken) return
    let cancelled = false
    setCheckingStored(true)
    getParticipantMe(session.id, pendingToken)
      .then((p) => {
        if (!cancelled) setStoredParticipant(p)
      })
      .catch(() => {
        if (!cancelled) {
          localStorage.removeItem(getTokenKey(code))
          setPendingToken(null)
        }
      })
      .finally(() => {
        if (!cancelled) setCheckingStored(false)
      })
    return () => {
      cancelled = true
    }
  }, [session, pendingToken, code])

  // Auto-save draft with debounce
  useEffect(() => {
    if (typeof window === "undefined") return
    const timeout = setTimeout(() => {
      localStorage.setItem(getDraftKey(code), editorContent)
    }, 1000)
    return () => clearTimeout(timeout)
  }, [editorContent, code])

  const handleJoin = async (e?: React.FormEvent) => {
    e?.preventDefault()
    if (!session) return
    try {
      setJoining(true)
      // En tareas para invitados siempre se usa el nombre ingresado, aunque
      // haya un usuario logueado en el navegador.
      const nameToSend =
        session.access_level === "guests"
          ? displayName || undefined
          : authUser
            ? undefined
            : displayName || undefined
      const result = await joinSession(code, nameToSend)
      localStorage.setItem(getTokenKey(code), result.participant_token)
      setToken(result.participant_token)
      setParticipant(result.participant)
      setCurrentStageId(result.participant.current_stage_id)
      setSubmitted(result.participant.submitted_at ?? null)
      setSubmissionUrl(result.participant.submission_url ?? null)
      setSession(result.session)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo unir a la tarea")
    } finally {
      setJoining(false)
    }
  }

  const handleResume = () => {
    if (!pendingToken || !storedParticipant) return
    setToken(pendingToken)
    setParticipant(storedParticipant)
    setCurrentStageId(storedParticipant.current_stage_id)
    setSubmitted(storedParticipant.submitted_at ?? null)
    setSubmissionUrl(storedParticipant.submission_url ?? null)
    setPendingToken(null)
  }

  const handleSwitchIdentity = () => {
    localStorage.removeItem(getTokenKey(code))
    localStorage.removeItem(getDraftKey(code))
    setPendingToken(null)
    setStoredParticipant(null)
    setDraftContent("")
    setEditorContent("")
    setDisplayName("")
    setQuestions([])
    setSubmitted(null)
    setSubmissionUrl(null)
  }

  const handleSend = async () => {
    if (!editorContent.trim() || !session) return
    try {
      setSending(true)
      const result = await sendSessionQuery(session.id, token, editorContent.trim())
      const generated = result.message
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean)
        .map((text) => ({ id: crypto.randomUUID(), text }))
      if (generated.length === 0) {
        throw new Error("La respuesta no incluyó preguntas")
      }
      setQuestions(generated)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo enviar la consulta")
    } finally {
      setSending(false)
    }
  }

  const handleStageChange = async (stageId: number) => {
    if (!session || !token || stageId === currentStageId) return
    try {
      setChangingStage(true)
      const updated = await setParticipantStage(session.id, token, stageId)
      setCurrentStageId(updated.current_stage_id)
      setParticipant(updated)
      setQuestions([])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cambiar de etapa")
    } finally {
      setChangingStage(false)
    }
  }

  const handleSubmitClick = () => {
    if (!session) return
    if (!authUser) {
      toast.info("Para entregar necesitás iniciar sesión con tu cuenta institucional de Google")
      router.push(`/auth?redirectTo=/session/${code}`)
      return
    }
    if (!editorContent.trim()) {
      toast.error("Escribí algo antes de entregar")
      return
    }
    setSubmitDialogOpen(true)
  }

  const handleSubmitWork = async () => {
    if (!session) return
    try {
      setSubmitting(true)
      const result = await submitSessionWork(session.id, token, editorContent.trim())
      setSubmitDialogOpen(false)
      setSubmitted(result.submitted_at)
      setSubmissionUrl(result.submission_url)
      toast.success("¡Entregado! Tu texto ya está en Classroom.")
    } catch (err) {
      const message = err instanceof Error ? err.message : "No se pudo entregar"
      if (message.includes("google_auth_required")) {
        setSubmitDialogOpen(false)
        toast.error("Necesitás autorizar tu cuenta de Google", {
          action: {
            label: "Autorizar",
            onClick: () =>
              (window.location.href = `/api/auth/google/classroom?redirectTo=${encodeURIComponent(`/session/${code}`)}`),
          },
        })
      } else {
        toast.error(message)
      }
    } finally {
      setSubmitting(false)
    }
  }

  const handleOpenHistory = async () => {
    if (!session || !token) return
    setHistoryOpen(true)
    try {
      setLoadingHistory(true)
      const queries = await getParticipantQueries(session.id, token)
      setHistoryQueries(queries)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar el historial")
    } finally {
      setLoadingHistory(false)
    }
  }

  if (loading || authLoading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex h-screen flex-col items-center justify-center gap-4 bg-gray-50">
        {loadError ? (
          <>
            <p className="text-gray-600">No se pudo cargar la tarea.</p>
            <Button onClick={loadSession}>Reintentar</Button>
          </>
        ) : (
          <p className="text-gray-600">Tarea no encontrada o inactiva.</p>
        )}
      </div>
    )
  }

  const stages = session.stages && session.stages.length > 0 ? session.stages : null
  const firstStageInstructions = stages ? stages[0].instructions : session.instructions

  if (!token || draftContent === null) {
    const requiresAuth = session.access_level === "registered"
    const allowsGuests = session.access_level === "guests" || session.access_level === "both"
    const isLoggedIn = !!authUser
    const showNameForm =
      session.access_level === "guests" || (session.access_level === "both" && !isLoggedIn)
    const showAccountEntry =
      (requiresAuth && isLoggedIn) || (session.access_level === "both" && isLoggedIn)

    if (checkingStored) {
      return (
        <div className="flex h-screen items-center justify-center bg-gray-50">
          <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
        </div>
      )
    }

    if (storedParticipant) {
      return (
        <div className="flex h-screen flex-col items-center justify-center bg-gray-50 p-4">
          <div className="w-full max-w-md">
            <h1 className="text-center text-2xl font-semibold text-gray-900">
              {session.title}
            </h1>
            <p className="mt-2 text-center text-sm text-gray-500">
              Ya te uniste a esta tarea desde este navegador como{" "}
              <span className="font-medium text-gray-900">
                {storedParticipant.display_name || "Invitado"}
              </span>
              .
            </p>
            <Button className="mt-6 w-full" onClick={handleResume}>
              Seguir escribiendo
            </Button>
            <Button
              variant="outline"
              className="mt-3 w-full"
              onClick={handleSwitchIdentity}
            >
              No soy yo, entrar con otro nombre
            </Button>
          </div>
        </div>
      )
    }

    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md">
          <h1 className="text-center text-2xl font-semibold text-gray-900">
            {session.title}
          </h1>

          {firstStageInstructions && (
            <div className="mt-6 rounded-lg bg-blue-50 border border-blue-100 p-4">
              <div className="flex items-center gap-2 mb-2">
                <BookOpen className="h-4 w-4 text-blue-600" />
                <span className="text-sm font-medium text-blue-800">Consigna</span>
              </div>
              <p className="text-sm text-blue-900 whitespace-pre-wrap">
                {firstStageInstructions}
              </p>
            </div>
          )}

          {requiresAuth && !isLoggedIn && (
            <>
              <p className="mt-2 text-center text-sm text-gray-500">
                Esta tarea requiere que inicies sesión para participar.
              </p>
              <Button
                className="mt-6 w-full"
                onClick={() => router.push(`/auth?redirectTo=/session/${code}`)}
              >
                <LogIn className="mr-2 h-4 w-4" />
                Iniciar sesión
              </Button>
            </>
          )}

          {showAccountEntry && (
            <>
              <p className="mt-2 text-center text-sm text-gray-500">
                Vas a entrar como{" "}
                <span className="font-medium text-gray-900">{authUser?.name}</span>.
              </p>
              <Button
                type="submit"
                className="mt-6 w-full"
                disabled={joining}
                onClick={() => handleJoin()}
              >
                {joining ? (
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  "Entrar a la tarea"
                )}
              </Button>
            </>
          )}

          {showNameForm && (
            <>
              <p className="mt-2 text-center text-sm text-gray-500">
                {session.access_level === "both"
                  ? "Ingresá tu nombre para unirte como invitado, o iniciá sesión si tenés cuenta."
                  : "Ingresá tu nombre para unirte a la tarea."}
              </p>
              <form onSubmit={handleJoin} className="mt-6 space-y-4">
                <div className="space-y-2">
                  <label htmlFor="name" className="block text-sm font-medium text-gray-700">
                    Tu nombre (opcional)
                  </label>
                  <input
                    id="name"
                    placeholder="Ej: Juan"
                    value={displayName}
                    onChange={(e) => setDisplayName(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 px-4 py-2 text-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <Button type="submit" className="w-full" disabled={joining}>
                  {joining ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    "Unirse a la tarea"
                  )}
                </Button>
              </form>
              {session.access_level === "both" && (
                <Button
                  variant="outline"
                  className="mt-3 w-full"
                  onClick={() => router.push(`/auth?redirectTo=/session/${code}`)}
                >
                  <LogIn className="mr-2 h-4 w-4" />
                  Iniciar sesión
                </Button>
              )}
            </>
          )}
        </div>
      </div>
    )
  }

  const currentStage =
    stages?.find((s) => s.id === currentStageId) ?? (stages ? stages[0] : null)
  const currentInstructions = currentStage ? currentStage.instructions : session.instructions
  const currentPrompt = currentStage ? currentStage.prompt : session.prompt
  const currentStageIndex = stages && currentStage ? stages.indexOf(currentStage) : 0

  return (
    <div className="flex h-screen bg-gray-50">
      {/* Main content area styled like /write */}
      <main className="flex-1 flex flex-col h-screen">
        <div className="h-dvh flex flex-col m-4 bg-white rounded-lg shadow-lg overflow-hidden">
          {/* Header */}
          <header className="px-6 py-4 flex items-center justify-between sticky top-0 bg-white z-10 border-b border-gray-100">
            <div className="flex-1">
              <h1 className="text-xl font-medium text-gray-900">{session.title}</h1>
              <div className="mt-1 flex items-center gap-2">
                <Badge variant="outline" className="font-mono text-xs">
                  {session.llm_model_name}
                </Badge>
                {currentPrompt && (
                  <Badge variant="secondary" className="text-xs">
                    {currentPrompt.name}
                  </Badge>
                )}
                {participant?.display_name && (
                  <Badge variant="outline" className="text-xs">
                    {participant.display_name}
                  </Badge>
                )}
              </div>
            </div>
            {stages && stages.length > 1 && (
              <div className="flex items-center gap-2 mr-4">
                <Button
                  variant="outline"
                  size="sm"
                  disabled={changingStage || currentStageIndex <= 0}
                  onClick={() => handleStageChange(stages[currentStageIndex - 1].id)}
                >
                  <ChevronLeft className="h-4 w-4" />
                  Anterior
                </Button>
                <span className="text-sm text-gray-600 whitespace-nowrap">
                  Etapa {currentStageIndex + 1} de {stages.length}
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={changingStage || currentStageIndex >= stages.length - 1}
                  onClick={() => setStageDialogOpen(true)}
                >
                  Terminé
                  <ChevronRight className="h-4 w-4" />
                </Button>
              </div>
            )}
            {session.classroom_linked && (
              submitted ? (
                <Badge variant="secondary" className="mr-2 bg-green-100 text-green-800">
                  <CheckCircle2 className="mr-1 h-3 w-3" />
                  {submissionUrl ? (
                    <a href={submissionUrl} target="_blank" rel="noopener noreferrer">
                      Entregado
                    </a>
                  ) : (
                    "Entregado"
                  )}
                </Badge>
              ) : (
                <Button
                  size="sm"
                  variant="outline"
                  className="mr-2"
                  onClick={handleSubmitClick}
                  disabled={submitting}
                >
                  {submitting ? (
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  ) : (
                    <Upload className="mr-2 h-4 w-4" />
                  )}
                  Entregar
                </Button>
              )
            )}
            <Button
              size="sm"
              variant="outline"
              className="mr-2"
              onClick={handleOpenHistory}
            >
              <History className="mr-2 h-4 w-4" />
              Historial
            </Button>
            <Button
              size="sm"
              onClick={handleSend}
              disabled={sending || !editorContent.trim()}
              className="btn-radius"
            >
              {sending ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Send className="mr-2 h-4 w-4" />
              )}
              Preguntar
            </Button>
          </header>

          {/* Instructions banner: fixed on top, collapsible */}
          {currentInstructions && (
            <div className="px-6 pt-4 shrink-0">
              <div className="rounded-lg bg-blue-50 border border-blue-100 p-4">
                <button
                  type="button"
                  onClick={() => setShowConsigna((v) => !v)}
                  className="flex items-center gap-2 w-full text-left cursor-pointer"
                >
                  <BookOpen className="h-4 w-4 text-blue-600" />
                  <span className="text-sm font-medium text-blue-800">Consigna</span>
                  {showConsigna ? (
                    <ChevronUp className="h-4 w-4 text-blue-600 ml-auto" />
                  ) : (
                    <ChevronDown className="h-4 w-4 text-blue-600 ml-auto" />
                  )}
                </button>
                {showConsigna && (
                  <p className="mt-2 text-sm text-blue-900 whitespace-pre-wrap">
                    {currentInstructions}
                  </p>
                )}
              </div>
            </div>
          )}

          {/* Generated questions: always visible, own bounded scroll */}
          {questions.length > 0 && (
            <div className="px-6 pt-4 shrink-0 max-h-56 overflow-y-auto">
              <div className="grid grid-cols-3 gap-4">
                {questions.slice(0, 3).map((question, index) => (
                  <QuestionCard
                    key={question.id}
                    question={question}
                    index={index}
                    showHoverEffects={true}
                  />
                ))}
              </div>
            </div>
          )}

          {/* Editor: the only scrollable area */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            <div className="px-6 py-4">
              <div className="flex-1 min-h-[40dvh]">
                <TipTapEditor
                  initialContent={draftContent || ""}
                  onContentChange={setEditorContent}
                />
              </div>
            </div>
          </div>
        </div>
      </main>

      {/* Checklist antes de pasar de etapa */}
      <ChecklistConfirmDialog
        open={stageDialogOpen}
        onOpenChange={setStageDialogOpen}
        title="¿Terminaste esta etapa?"
        description="Antes de pasar a la siguiente etapa, verificá:"
        items={[
          "Revisé mi texto",
          "Leí las preguntas de Calíope",
          "Sé que puedo volver con el botón Anterior",
        ]}
        confirmLabel="Pasar a la siguiente etapa"
        loading={changingStage}
        onConfirm={() => {
          if (!stages) return
          setStageDialogOpen(false)
          handleStageChange(stages[currentStageIndex + 1].id)
        }}
      />

      {/* Checklist antes de entregar */}
      <ChecklistConfirmDialog
        open={submitDialogOpen}
        onOpenChange={setSubmitDialogOpen}
        title="¿Entregar tu texto?"
        description="Se creará un documento de Google con tu nombre y quedará entregado en Classroom. Antes de entregar, verificá:"
        items={[
          "Mi texto está terminado",
          "Revisé que diga lo que quiero decir",
        ]}
        confirmLabel="Entregar"
        loading={submitting}
        onConfirm={handleSubmitWork}
      />

      {/* Historial de preguntas */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-2xl max-h-[80vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Historial de preguntas</DialogTitle>
          </DialogHeader>
          {loadingHistory ? (
            <div className="flex justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : historyQueries.length === 0 ? (
            <p className="text-sm text-gray-500 py-4">
              Todavía no hiciste preguntas en esta tarea.
            </p>
          ) : (
            <div className="space-y-6">
              {historyQueries.map((q) => (
                <div key={q.id} className="border-b border-gray-100 pb-4 last:border-0">
                  <div className="flex items-center gap-2 mb-2">
                    {q.stage_position && (
                      <Badge variant="outline" className="text-xs">
                        Etapa {q.stage_position}
                      </Badge>
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mb-2 line-clamp-2">
                    Sobre: {q.query_text.replace(/<[^>]*>/g, " ").replace(/\s+/g, " ").trim()}
                  </p>
                  <ul className="space-y-1">
                    {(q.response_text || "")
                      .split("\n")
                      .map((line) => line.trim())
                      .filter(Boolean)
                      .map((line, i) => (
                        <li key={i} className="text-sm text-gray-800">
                          {line}
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
