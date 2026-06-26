"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams, useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { TipTapEditor } from "@/components/tiptap-editor"
import { toast } from "sonner"
import { Send, Loader2, Sparkles, BookOpen, LogIn } from "lucide-react"
import {
  getSessionByCode,
  joinSession,
  sendSessionQuery,
  type Session,
} from "@/lib/sessions"

interface ChatMessage {
  id: number
  query_text: string
  response_text: string
  created_at: string
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
  const [authLoading, setAuthLoading] = useState(true)
  const [token, setToken] = useState<string>("")
  const [displayName, setDisplayName] = useState("")
  const [joining, setJoining] = useState(false)
  const [editorContent, setEditorContent] = useState("")
  const [draftContent, setDraftContent] = useState<string | null>(null)
  const [sending, setSending] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [authUser, setAuthUser] = useState<AuthUser | null>(null)

  const loadSession = useCallback(async () => {
    try {
      setLoading(true)
      const s = await getSessionByCode(code)
      setSession(s)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo cargar la sesión")
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
        setAuthUser(data)
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
        setToken(storedToken)
      }
      const savedDraft = localStorage.getItem(getDraftKey(code))
      setDraftContent(savedDraft || "")
    }
  }, [loadSession, loadAuth, code])

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
      const result = await joinSession(
        code,
        authUser ? undefined : displayName || undefined
      )
      localStorage.setItem(getTokenKey(code), result.participant_token)
      setToken(result.participant_token)
      setSession(result.session)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo unir a la sesión")
    } finally {
      setJoining(false)
    }
  }

  const handleSend = async () => {
    if (!editorContent.trim() || !session) return
    try {
      setSending(true)
      const result = await sendSessionQuery(session.id, token, editorContent.trim())
      setMessages((prev) => [
        {
          id: Date.now(),
          query_text: editorContent.trim(),
          response_text: result.message,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ])
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo enviar la consulta")
    } finally {
      setSending(false)
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
        <p className="text-gray-600">Sesión no encontrada o inactiva.</p>
      </div>
    )
  }

  if (!token || draftContent === null) {
    const requiresAuth = session.access_level === "registered"
    const allowsGuests = session.access_level === "guests" || session.access_level === "both"
    const isLoggedIn = !!authUser

    return (
      <div className="flex h-screen flex-col items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md">
          <h1 className="text-center text-2xl font-semibold text-gray-900">
            {session.title}
          </h1>

          {requiresAuth && !isLoggedIn && (
            <>
              <p className="mt-2 text-center text-sm text-gray-500">
                Esta sesión requiere que inicies sesión para participar.
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

          {(requiresAuth && isLoggedIn) || (allowsGuests && isLoggedIn) ? (
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
                  "Entrar a la sesión"
                )}
              </Button>
            </>
          ) : null}

          {allowsGuests && !isLoggedIn && (
            <>
              <p className="mt-2 text-center text-sm text-gray-500">
                {session.access_level === "both"
                  ? "Ingresá tu nombre para unirte como invitado, o iniciá sesión si tenés cuenta."
                  : "Ingresá tu nombre para unirte a la sesión."}
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
                    "Unirse a la sesión"
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
                {session.prompt && (
                  <Badge variant="secondary" className="text-xs">
                    {session.prompt.name}
                  </Badge>
                )}
              </div>
            </div>
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

          {/* Scrollable area */}
          <div className="flex-1 min-h-0 overflow-y-auto">
            {/* Instructions banner */}
            {session.instructions && (
              <div className="px-6 pt-4">
                <div className="rounded-lg bg-blue-50 border border-blue-100 p-4">
                  <div className="flex items-center gap-2 mb-2">
                    <BookOpen className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-blue-800">Consigna</span>
                  </div>
                  <p className="text-sm text-blue-900 whitespace-pre-wrap">
                    {session.instructions}
                  </p>
                </div>
              </div>
            )}

            {/* Previous messages */}
            {messages.length > 0 && (
              <div className="px-6 pt-4 space-y-4">
                {messages.map((msg) => (
                  <div
                    key={msg.id}
                    className="rounded-lg border border-gray-100 bg-gray-50/50 p-4"
                  >
                    <div className="flex items-center gap-2 mb-2">
                      <Sparkles className="h-4 w-4 text-yellow-500" />
                      <span className="text-xs font-medium text-gray-500">
                        {new Date(msg.created_at).toLocaleTimeString()}
                      </span>
                    </div>
                    <div
                      className="prose prose-sm max-w-none text-gray-700"
                      dangerouslySetInnerHTML={{ __html: msg.response_text.replace(/\n/g, "<br/>") }}
                    />
                  </div>
                ))}
              </div>
            )}

            {/* Editor container */}
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
    </div>
  )
}
