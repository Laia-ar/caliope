"use client"

import type React from "react"

import { useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation"
import { Button } from "@/components/ui/button"
import { TipTapEditor } from "@/components/tiptap-editor"
import { InspirationPanel } from "@/components/inspiration-panel"
import { AppLayout } from "@/components/app-layout"
import { toast } from "sonner"
import { Check, X } from "lucide-react"
import { buildBackendUrl } from "@/lib/backend"
import { useNavigationGuard } from "@/hooks/use-navigation-guard";

export default function WritePage() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const promptId = searchParams.get("promptId")
  const [documentTitle, setDocumentTitle] = useState("Texto sin título")
  const [isEditing, setIsEditing] = useState(false)
  const [documentContent, setDocumentContent] = useState("")
  const [isSaving, setIsSaving] = useState(false)

  const [lastSavedTitle, setLastSavedTitle] = useState("Documento sin título");
  const [lastSavedContent, setLastSavedContent] = useState("");

  const hasUnsavedChanges =
    documentTitle !== lastSavedTitle || documentContent !== lastSavedContent;

  useNavigationGuard({ hasUnsavedChanges });

  const handleTitleClick = () => {
    setIsEditing(true)
  }

  const handleTitleSubmit = (e: React.FormEvent) => {
    e.preventDefault()
    setIsEditing(false)
  }

  const handleTitleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      setIsEditing(false)
    }
    if (e.key === "Escape") {
      setIsEditing(false)
    }
  }

  const handleContentChange = useCallback((content: string) => {
    setDocumentContent(content);
  }, []);

  const handleSave = async () => {
    try {
      setIsSaving(true)

      const response = await fetch(buildBackendUrl("/api/documents"), {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        credentials: "include",
        body: JSON.stringify({
          title: documentTitle,
          content: documentContent,
          content_format: "html",
          tags: [],
        }),
      })

      if (!response.ok) {
        throw new Error("Error al guardar el texto")
      }

      const newDocument = await response.json()

      setLastSavedTitle(documentTitle);
      setLastSavedContent(documentContent);

      toast.custom((t) => (
        <div className="bg-green-100 border border-green-200 rounded-lg p-4 shadow-lg flex items-start gap-3 min-w-[280px]">
          <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-green-800 font-medium">Texto guardado</div>
            <div className="text-green-700 text-sm mt-1">El texto se guardó correctamente</div>
          </div>
        </div>
      ))

      setTimeout(() => {
        router.push(`/write/${newDocument.id}`)
      }, 1500)
    } catch (error) {
      console.error("Error saving document:", error)
      toast.custom((t) => (
        <div className="bg-red-100 border border-red-200 rounded-lg p-4 shadow-lg flex items-start gap-3 min-w-[280px]">
          <X className="w-5 h-5 text-red-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-red-800 font-medium">Error al guardar</div>
            <div className="text-red-700 text-sm mt-1">No se pudo guardar el texto</div>
          </div>
        </div>
      ))
    } finally {
      setIsSaving(false)
    }
  }

  return (
    <AppLayout>
      <div className="h-dvh flex flex-col m-4 bg-white rounded-lg shadow-lg overflow-hidden">
        {/* Header fijo*/}
        <header className="px-6 py-4 flex items-center justify-between sticky top-0 bg-white z-10">
          {/* Document Title */}
          <div className="flex-1">
            {isEditing ? (
              <form onSubmit={handleTitleSubmit}>
                <input
                  type="text"
                  value={documentTitle}
                  onChange={(e) => setDocumentTitle(e.target.value)}
                  onBlur={() => setIsEditing(false)}
                  onKeyDown={handleTitleKeyDown}
                  className="text-xl font-medium bg-transparent border-none outline-none focus:ring-0 p-0 w-full max-w-md "
                  autoFocus
                />
              </form>
            ) : (
              <h1
                className="text-xl font-medium cursor-pointer hover:text-muted-foreground transition-colors "
                onClick={handleTitleClick}
              >
                {documentTitle}
              </h1>
            )}
          </div>

          {/* Action Buttons */}
          <div className="flex items-center gap-3">
            <Button
              size="sm"
              variant="outline"
              className="text-sm btn-radius"
              onClick={handleSave}
              disabled={isSaving}
            >
              {isSaving ? "Guardando..." : "Guardar"}
            </Button>
          </div>
        </header>

        {/* Área que scrollea: flex-1 + min-h-0 + overflow-y-auto */}
        <div className="flex-1 min-h-0 overflow-y-auto">

          {/* Inspiration Panel */}
          <div className="px-6">
            <div className="bg-gray-100 rounded-lg mx-0">
              <InspirationPanel
                documentContent={documentContent}
                documentId={undefined}
                initialPromptId={promptId}
                onQuestionsGenerated={(questions) => {
                  console.log("[v0] Generated questions:", questions)
                }}
              />
            </div>
          </div>

          {/* Editor Container */}
          <div className="flex-1 min-h-[40dvh]">
            <TipTapEditor onContentChange={handleContentChange} />
          </div>
        </div>
      </div>
    </AppLayout>
  )
}
