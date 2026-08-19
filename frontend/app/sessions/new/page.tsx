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
import { ArrowLeft, Loader2, Plus, Trash2 } from "lucide-react"
import { toast } from "sonner"
import { createSession, fetchMyGrades, type SessionAccessLevel, type GradeInfo } from "@/lib/sessions"
import { loadPrompts, type Prompt } from "@/lib/prompts"
import { loadAvailableModels, type AvailableModel } from "@/lib/models-api"
import { fetchAuthUser } from "@/lib/auth"

interface StageDraft {
  instructions: string
  promptId: string
}

export default function NewSessionPage() {
  const router = useRouter()
  const [title, setTitle] = useState("")
  const [stages, setStages] = useState<StageDraft[]>([{ instructions: "", promptId: "" }])
  const [model, setModel] = useState<string>("")
  const [accessLevel, setAccessLevel] = useState<SessionAccessLevel>("guests")
  const [gradeId, setGradeId] = useState<string>("")
  const [grades, setGrades] = useState<GradeInfo[]>([])
  const [models, setModels] = useState<AvailableModel[]>([])
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [isSaving, setIsSaving] = useState(false)

  useEffect(() => {
    const checkAccess = async () => {
      const user = await fetchAuthUser()
      if (!user?.is_teacher) {
        router.replace("/sessions")
      }
    }

    const load = async () => {
      try {
        setIsLoading(true)
        const [promptData, modelData, gradeData] = await Promise.all([
          loadPrompts(),
          loadAvailableModels(),
          fetchMyGrades(),
        ])
        setPrompts(promptData)
        setModels(modelData)
        setGrades(gradeData)
        if (modelData.length > 0) {
          setModel(modelData[0].slug)
        }
      } catch (err) {
        toast.error("No se pudieron cargar los datos")
      } finally {
        setIsLoading(false)
      }
    }

    void checkAccess()
    load()
  }, [router])

  const updateStage = (index: number, patch: Partial<StageDraft>) => {
    setStages((prev) => prev.map((s, i) => (i === index ? { ...s, ...patch } : s)))
  }

  const addStage = () => {
    setStages((prev) => [...prev, { instructions: "", promptId: "" }])
  }

  const removeStage = (index: number) => {
    setStages((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev))
  }

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
        instructions: stages[0].instructions.trim(),
        llm_model_name: model,
        access_level: accessLevel,
        grade_id: gradeId && gradeId !== "none" ? Number(gradeId) : null,
        stages: stages.map((s) => ({
          instructions: s.instructions.trim(),
          custom_prompt_id: s.promptId ? Number(s.promptId) : null,
        })),
      })
      toast.success("Tarea creada")
      router.push(`/sessions/${session.id}`)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear la tarea")
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
            Volver a tareas
          </Button>

          <h1 className="text-2xl font-semibold text-gray-900">Nueva tarea</h1>
          <p className="mt-1 text-sm text-gray-500">
            Definí las etapas (consigna y prompt de cada una) y el modelo que usarán tus alumnos.
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

            <div className="space-y-4">
              <Label>Etapas</Label>
              {stages.map((stage, index) => (
                <div
                  key={index}
                  className="space-y-4 rounded-lg border border-gray-200 bg-white p-4"
                >
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium text-gray-700">
                      Etapa {index + 1}
                    </span>
                    <Button
                      type="button"
                      variant="ghost"
                      size="sm"
                      onClick={() => removeStage(index)}
                      disabled={stages.length === 1}
                      title="Quitar etapa"
                    >
                      <Trash2 className="h-4 w-4 text-gray-400" />
                    </Button>
                  </div>

                  <div className="space-y-2">
                    <Label htmlFor={`instructions-${index}`}>Consigna</Label>
                    <Textarea
                      id={`instructions-${index}`}
                      rows={4}
                      placeholder="Escribí aquí la consigna que verán los alumnos en esta etapa..."
                      value={stage.instructions}
                      onChange={(e) => updateStage(index, { instructions: e.target.value })}
                    />
                  </div>

                  <div className="space-y-2">
                    <Label>Prompt</Label>
                    {isLoading ? (
                      <p className="text-sm text-gray-500">Cargando prompts...</p>
                    ) : (
                      <Select
                        value={stage.promptId}
                        onValueChange={(value) => updateStage(index, { promptId: value })}
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Seleccionar prompt" />
                        </SelectTrigger>
                        <SelectContent>
                          {prompts.map((p) => (
                            <SelectItem key={p.id} value={String(p.id)}>
                              {p.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                    )}
                  </div>
                </div>
              ))}

              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={addStage}
              >
                <Plus className="mr-2 h-4 w-4" />
                Agregar etapa
              </Button>
              <p className="text-xs text-gray-500">
                Los alumnos podrán pasar de una etapa a la siguiente con el mismo texto. Cada etapa puede tener su propia consigna y prompt.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Modelo</Label>
              <Select value={model} onValueChange={setModel}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar modelo" />
                </SelectTrigger>
                <SelectContent>
                  {models.map((m) => (
                    <SelectItem key={m.slug} value={m.slug}>
                      {m.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>Acceso permitido</Label>
              <Select value={accessLevel} onValueChange={(value) => setAccessLevel(value as SessionAccessLevel)}>
                <SelectTrigger>
                  <SelectValue placeholder="Seleccionar acceso" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="registered">Solo usuarios registrados</SelectItem>
                  <SelectItem value="guests">Solo invitados</SelectItem>
                  <SelectItem value="both">Ambos</SelectItem>
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Definí quién puede ingresar a la tarea con el código.
              </p>
            </div>

            <div className="space-y-2">
              <Label>Grado (opcional)</Label>
              <Select value={gradeId || "none"} onValueChange={setGradeId}>
                <SelectTrigger>
                  <SelectValue placeholder={grades.length === 0 ? "No tenés grados asignados" : "Seleccionar grado"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">Sin grado</SelectItem>
                  {grades.map((g) => (
                    <SelectItem key={g.id} value={String(g.id)}>
                      {g.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <p className="text-xs text-gray-500">
                Si asignás un grado, los alumnos de ese grado verán la tarea en su panel sin necesidad del código.
              </p>
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
                  "Crear tarea"
                )}
              </Button>
            </div>
          </form>
        </div>
      </div>
    </AppLayout>
  )
}
