"use client"

import type React from "react"

import { useState } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Info, Loader2 } from "lucide-react"
import { ExpandGuidanceIcon, CollapseGuidanceIcon } from "@/components/prompt-guidance-icons"
import { savePromptData } from "@/lib/prompts"

interface CreatePromptModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: (newPromptId: string) => void;
}

export function CreatePromptModal({ isOpen, onClose, onSuccess }: CreatePromptModalProps) {
  const [name, setName] = useState("")
  const [instructions, setInstructions] = useState("")
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState("")
  const [showGuidance, setShowGuidance] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setIsLoading(true)
    setError("")

    try {
      const newPrompt = await savePromptData({
        name,
        instructions,
        isPublic: false,
      });

      setName("")
      setInstructions("")
      onSuccess(newPrompt.id)
      onClose()
    } catch (error) {
      console.error("Error creating prompt:", error)
      const message = error instanceof Error ? error.message : "Error al crear el prompt"
      setError(message)
    } finally {
      setIsLoading(false)
    }
  }

  const handleClose = () => {
    if (!isLoading) {
      setName("")
      setInstructions("")
      setError("")
      setShowGuidance(false)
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="max-w-6xl h-[90vh] flex flex-col overflow-hidden">
        <DialogHeader className="flex-shrink-0">
          <DialogTitle className="">Crear nuevo prompt</DialogTitle>
          <DialogDescription className=" text-sm text-muted-foreground">
            Completa los campos para crear un nuevo prompt personalizado
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-1 flex-col gap-4 min-h-0">
          {error && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-3 py-2 rounded text-sm flex-shrink-0">{error}</div>
          )}

          <div className="flex-shrink-0">
            <Label htmlFor="name" className="">
              Nombre *
            </Label>
            <Input
              id="name"
              value={name}
              onChange={(e) => setName(e.target.value)}
              className=""
              placeholder="Ej: Preguntas Creativas"
              required
              disabled={isLoading}
            />
          </div>

          <div className="flex-1 flex flex-col min-h-0">
            <div className="flex items-center justify-between gap-2 flex-shrink-0">
              <Label htmlFor="instructions" className="">
                Instrucciones *
              </Label>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={() => setShowGuidance((prev) => !prev)}
                className={`h-auto py-1 px-2 mb-1 text-xs font-medium text-[#1862A2] underline inline-flex items-center gap-1 ${showGuidance ? "flex-row-reverse" : ""}`}
                aria-expanded={showGuidance}
                disabled={isLoading}
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
                                <strong>Describí el tipo de preguntas</strong> que querés que te haga. Recordá que Calíope no da respuestas,
                                la clave está en provocar reflexión, abrir opciones y dar pie a la creación en lugar de entregar soluciones
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
                      className={`flex-1 resize-none border-0 bg-transparent py-2 focus-visible:outline-none focus-visible:ring-0 ${showGuidance ? "min-h-[240px]" : "min-h-0"}`}
                      placeholder="Describe cómo debe comportarse el prompt..."
                      required
                      disabled={isLoading}
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
                onClick={handleClose}
                className=" text-sm btn-radius bg-transparent"
                disabled={isLoading}
              >
                Cancelar
              </Button>
              <Button type="submit" variant="primary" className=" text-sm btn-radius py-2 px-4" disabled={isLoading}>
                {isLoading ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Creando...
                  </>
                ) : (
                  "Crear prompt"
                )}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
