"use client"

import { useEffect, useState, useCallback } from "react"
import { useParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Badge } from "@/components/ui/badge"
import { Loader2, Send, Sparkles, User } from "lucide-react"
import { toast } from "sonner"
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

function getTokenKey(code: string) {
  return `session_token_${code.toUpperCase()}`
}

export default function StudentSessionPage() {
  const params = useParams()
  const code = String(params.code).toUpperCase()

  const [session, setSession] = useState<Session | null>(null)
  const [loading, setLoading] = useState(true)
  const [token, setToken] = useState<string>("")
  const [displayName, setDisplayName] = useState("")
  const [joining, setJoining] = useState(false)
  const [queryText, setQueryText] = useState("")
  const [sending, setSending] = useState(false)
  const [messages, setMessages] = useState<ChatMessage[]>([])

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

  useEffect(() => {
    loadSession()
    const stored = typeof window !== "undefined" ? localStorage.getItem(getTokenKey(code)) : null
    if (stored) {
      setToken(stored)
    }
  }, [loadSession, code])

  const handleJoin = async (e: React.FormEvent) => {
    e.preventDefault()
    try {
      setJoining(true)
      const result = await joinSession(code, displayName || undefined)
      localStorage.setItem(getTokenKey(code), result.participant_token)
      setToken(result.participant_token)
      setSession(result.session)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo unir a la sesión")
    } finally {
      setJoining(false)
    }
  }

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!queryText.trim() || !session) return
    try {
      setSending(true)
      const result = await sendSessionQuery(session.id, token, queryText.trim())
      setMessages((prev) => [
        {
          id: Date.now(),
          query_text: queryText.trim(),
          response_text: result.message,
          created_at: new Date().toISOString(),
        },
        ...prev,
      ])
      setQueryText("")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo enviar la consulta")
    } finally {
      setSending(false)
    }
  }

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!session) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-4">
        <p className="text-gray-600">Sesión no encontrada o inactiva.</p>
      </div>
    )
  }

  if (!token) {
    return (
      <div className="flex min-h-screen flex-col items-center justify-center bg-gray-50 p-4">
        <div className="w-full max-w-md">
          <h1 className="text-center text-2xl font-semibold text-gray-900">
            {session.title}
          </h1>
          <p className="mt-2 text-center text-sm text-gray-500">
            Ingresá tu nombre para unirte a la sesión.
          </p>
          <form onSubmit={handleJoin} className="mt-6 space-y-4">
            <div className="space-y-2">
              <Label htmlFor="name">Tu nombre (opcional)</Label>
              <Input
                id="name"
                placeholder="Ej: Juan"
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={joining}>
              {joining ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <User className="mr-2 h-4 w-4" />
              )}
              Unirse a la sesión
            </Button>
          </form>
        </div>
      </div>
    )
  }

  return (
    <div className="flex min-h-screen flex-col bg-gray-50">
      {/* Header */}
      <header className="border-b border-gray-200 bg-white px-4 py-4 sm:px-6">
        <div className="mx-auto flex max-w-3xl items-center justify-between">
          <div>
            <h1 className="text-lg font-semibold text-gray-900">{session.title}</h1>
            <div className="mt-1 flex items-center gap-2 text-xs text-gray-500">
              <Badge variant="outline">{session.llm_model_name}</Badge>
              {session.prompt && (
                <Badge variant="secondary">{session.prompt.name}</Badge>
              )}
            </div>
          </div>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl flex-1 px-4 py-6 sm:px-6">
        {/* Instructions */}
        {session.instructions && (
          <Card className="mb-6 border-blue-100 bg-blue-50/50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-blue-800">
                Consigna
              </CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm text-blue-900">
                {session.instructions}
              </p>
            </CardContent>
          </Card>
        )}

        {/* Chat / Input */}
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-sm font-medium text-gray-700">
              <Sparkles className="h-4 w-4 text-yellow-500" />
              Escribí tu texto y pedí preguntas
            </CardTitle>
          </CardHeader>
          <CardContent>
            <form onSubmit={handleSend} className="flex gap-2">
              <Input
                placeholder="Pegá o escribí tu texto aquí..."
                value={queryText}
                onChange={(e) => setQueryText(e.target.value)}
                disabled={sending}
              />
              <Button type="submit" disabled={sending || !queryText.trim()}>
                {sending ? (
                  <Loader2 className="h-4 w-4 animate-spin" />
                ) : (
                  <Send className="h-4 w-4" />
                )}
              </Button>
            </form>
          </CardContent>
        </Card>

        {/* Messages */}
        {messages.length > 0 && (
          <div className="mt-6 space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className="rounded-lg border border-gray-100 bg-white p-4 shadow-sm"
              >
                <p className="text-sm font-medium text-gray-900">{msg.query_text}</p>
                <div className="mt-2 rounded bg-gray-50 p-3 text-sm text-gray-700 whitespace-pre-line">
                  {msg.response_text}
                </div>
                <p className="mt-2 text-right text-xs text-gray-400">
                  {new Date(msg.created_at).toLocaleTimeString()}
                </p>
              </div>
            ))}
          </div>
        )}
      </main>
    </div>
  )
}
