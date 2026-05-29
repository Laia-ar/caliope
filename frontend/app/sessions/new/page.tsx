"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { ArrowLeft, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { createSession } from "@/lib/sessions"
import { loadPrompts, type Prompt } from "@/lib/prompts"
import { MODEL_OPTIONS } from "@/lib/models"

export default function NewSessionPage() {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [instructions, setInstructions] = useState("")
  const [promptId, setPromptId] = useState<string>("")
  const [model, setModel] = useState<string>(MODEL_OPTIONS[0].value)
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const load = async () => {
      try {
        setIsLoading(true)
        const data = await loadPrompts()
        setPrompts(data)
      } catch (err) {
        toast.error("No se pudieron cargar los prompts")
      } finally {
        setIsLoading(false)
      }
    }
    load()
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!title.trim()) {
      toast.error("El título es obligatorio")
      return
    }
    try {
      setIsSaving(true)
      const session = await createSession({
        title: title.trim(),
        instructions: instructions.trim(),
        custom_prompt_id: promptId ? Number(promptId) : null,
        llm_model_name: model,
      })
      toast.success("Sesión creada")
      router.push(`/sessions/${session.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear la sesión")
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AppLayout>
      <div className="flex-1 overflow-y-auto bg-gray-50">
        <div className="mx-auto w-full max-w-2xl px-4 py-8 sm:px-6 lg:px-8">
          <Button
            variant="ghost"
            size="sm"
            className="mb-6"
            onClick={() => router.push("/sessions")}
          >
            <ArrowLeft className="mr-2 h-4 w-4" />
            Volver a sesiones
          </Button>

          <h1 className="text-2xl font-semibold text-gray-900">Nueva sesión</h1>
          <p className="mt-1 text-sm text-gray-500">
            Definí la consigna, el prompt y el modelo que usarán tus alumnos.
          </p>

          <form onSubmit={handleSubmit} className="mt-8 space-y-6">
            <div className="space-y-2">
              <Label htmlFor="title">Título</Label>
              <Input
                id="title"
                placeholder="Ej: Clase de redacción - 3° año"
                value={title}
                onChange={(e) => setTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label htmlFor="instructions">Consigna</Label>
              <Textarea
                id="instructions"
                rows={6}
                placeholder="Escribí aquí la consigna que verán los alumnos..."
                value={instructions}
                onChange={(e) => setInstructions(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <Label>Prompt</Label>
              {isLoading ? (
                <p className="text-sm text-gray-500">Cargando prompts...</p>
              ) : (
                <Select value={promptId} onValueChange={setPromptId}>
                  <SelectTrigger>
                    <SelectValue placeholder="Seleccionar prompt" />
                  </SelectTrigger>
                  <SelectContent>
                    {prompts.map((p) => (
                      <SelectItem key={p.id} value={p.id}>
                        {p.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>

            <div className="space-y-2">
              <Label>Modelo</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar modelo" />
                </SelectTrigger>
                <SelectContent>
                  {MODEL_OPTIONS.map((m) => (
                    <SelectItem key={m.value} value={m.value}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-3">
              <Button
                type="button"
                variant="outline"
                onClick={() => router.push("/sessions")}
              >
                Cancelar
              </Button>
              <Button type="submit" disabled={isSaving}>
                {isSaving ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    Creando...
                  </>
                ) : (
                  "Crear sesión"
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  )
}
