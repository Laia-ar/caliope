"use client"

import type React from "react"
import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Info } from "lucide-react"
import { ExpandGuidanceIcon, CollapseGuidanceIcon } from "@/components/prompt-guidance-icons"

interface Prompt {
  id: string
  name: string
  instructions: string
  isPublic: boolean
}

interface EditPromptFormProps {
  prompt: Prompt
  onSave: (data: Partial<Prompt>) => void
  onCancel: () => void
}

export function EditPromptForm({ prompt, onSave, onCancel }: EditPromptFormProps) {
  const [name, setName] = useState(prompt.name)
  const [instructions, setInstructions] = useState(prompt.instructions)
  const [showGuidance, setShowGuidance] = useState(false)

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    onSave({ name, instructions })
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 min-h-0">
      <div className="flex-shrink-0">
        {/* <Label htmlFor="name" className="font-sans">
          Nombre
        </Label> */}
        <Input id="name" value={name} onChange={(e) => setName(e.target.value)} className="font-sans" required />
      </div>

      <div className="flex-1 flex flex-col min-h-0">
        <div className="flex items-center justify-between gap-2 flex-shrink-0">
          <Label htmlFor="instructions" className="font-sans">
            Instrucciones
          </Label>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setShowGuidance((prev) => !prev)}
            className={`h-auto py-1 px-2 mb-1 text-xs font-medium text-[#1862A2] underline inline-flex items-center gap-1 ${showGuidance ? "flex-row-reverse" : ""}`}
            aria-expanded={showGuidance}
          >
            {showGuidance ? (
              <CollapseGuidanceIcon className="text-[#1862A2]" />
            ) : (
              <ExpandGuidanceIcon className="text-[#1862A2]" />
            )}
            <span>¿Cómo escribir un buen prompt para Calíope?</span>
          </Button>
        </div>

        <div className="mt-2 flex-1 min-h-0">
          <div className="flex h-full flex-col overflow-hidden rounded-md border border-input bg-background">
            <div className="flex-1 min-h-0 overflow-auto">
              <div className="flex min-h-full flex-col gap-4">
                {showGuidance && (
                  <div
                    className="p-4 text-sm text-gray-800"
                    style={{ backgroundColor: "rgba(203, 194, 224, 0.57)" }}
                  >
                    <div className="flex gap-3">
                      <Info className="w-5 h-5 text-[#553c8a] flex-shrink-0 mt-0.5" />
                      <div className="space-y-2">
                        <ul className="list-disc pl-4 space-y-2">
                          <li>
                            <strong>Definí un rol claro</strong> y situá a la IA como una voz específica (ej: “Sos la voz interior de
                            Hemingway”, “Sos un docente que ayuda a sus estudiantes a contar historias”).
                          </li>
                          <li>
                            <strong>Describí el tipo de preguntas</strong> que querés que te haga. Recordá que Calíope no da respuestas, la
                            clave está en provocar reflexión, abrir opciones y dar pie a la creación en lugar de entregar soluciones
                            cerradas.
                          </li>
                          <li>
                            <strong>Especificá el tono de acuerdo al contexto</strong> (simple y lúdico para infancias, riguroso para textos
                            académicos, evocador para textos literarios, etc.).
                          </li>
                          <li>
                            <strong>Agregá ejemplos relevantes</strong> que puedan servir a orientar el tipo de preguntas o su tono.
                          </li>
                        </ul>
                      </div>
                    </div>
                  </div>
                )}

                <Textarea
                  id="instructions"
                  value={instructions}
                  onChange={(e) => setInstructions(e.target.value)}
                  className={`font-sans flex-1 min-h-90 resize-none border-0 bg-transparent py-2 focus-visible:outline-none focus-visible:ring-0 ${showGuidance ? "min-h-[240px]" : "min-h-0"}`}
                  required
                />
              </div>
            </div>
          </div>
        </div>
      </div>

      <div className="flex items-center justify-end pt-4 flex-shrink-0">
        <div className="flex gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={onCancel}
            className="font-sans text-sm btn-radius bg-transparent py-2 px-4"
          >
            Cancelar
          </Button>
          <Button type="submit" variant="primary" className="font-sans text-sm btn-radius py-2 px-4">
            Guardar
          </Button>
        </div>
      </div>
    </form>
  )
}
