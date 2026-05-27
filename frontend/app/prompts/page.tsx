"use client"

import { useState, useEffect, type MouseEvent } from "react"
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog"
import { Trash2, Plus, Check, FileInput, Copy, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react"
import Image from "next/image"
import { useRouter } from "next/navigation"
import {
  loadPrompts,
  savePrompt,
  deletePrompt,
  getPrompt,
  createPrompt,
  type Prompt,
} from "@/lib/prompts"
import { CreatePromptModal } from "@/components/create-prompt-modal"
import { EditPromptForm } from "@/components/edit-prompt-form"
import { ViewPromptModal } from "@/components/view-prompt-modal"
import { toast } from "sonner"
import { DeleteConfirmationModal } from "@/components/delete-confirmation-modal"
import { TimeAgo } from "@/components/time-ago"
import { ActionTooltip } from "@/components/action-tooltip"

export default function PromptsPage() {
  const [activeTab, setActiveTab] = useState("propios")
  const [prompts, setPrompts] = useState<Prompt[]>([])
  const [isCreateModalOpen, setIsCreateModalOpen] = useState(false)
  const [isEditModalOpen, setIsEditModalOpen] = useState(false)
  const [isViewModalOpen, setIsViewModalOpen] = useState(false)
  const [isDeleteModalOpen, setIsDeleteModalOpen] = useState(false)
  const [promptToDelete, setPromptToDelete] = useState<Prompt | null>(null)
  const [editingPrompt, setEditingPrompt] = useState<Prompt | null>(null)
  const [viewingPrompt, setViewingPrompt] = useState<Prompt | null>(null)
  const [sortConfig, setSortConfig] = useState<{ field: "name" | "lastEdited"; direction: "asc" | "desc" }>({
    field: "lastEdited",
    direction: "desc",
  })
  const router = useRouter()

  const updatePromptInState = (updatedPrompt: Prompt) => {
    setPrompts((prev) =>
      prev.map((prompt) => (prompt.id === updatedPrompt.id ? { ...prompt, ...updatedPrompt } : prompt)),
    )
  }

  useEffect(() => {
    loadPromptsData()
  }, [])

  const loadPromptsData = async () => {
    const data = await loadPrompts()
    setPrompts(data)
  }

  const filteredPrompts = prompts.filter((prompt) => (activeTab === "propios" ? !prompt.isPublic : prompt.isPublic))

  const sortedPrompts = [...filteredPrompts].sort((a, b) => {
    const directionMultiplier = sortConfig.direction === "asc" ? 1 : -1

    if (sortConfig.field === "name") {
      const aName = a.name ?? ""
      const bName = b.name ?? ""
      return aName.localeCompare(bName, "es", { sensitivity: "base" }) * directionMultiplier
    }

    const getTimestamp = (value?: string) => {
      if (!value) {
        return null
      }
      const parsed = new Date(value)
      return Number.isNaN(parsed.getTime()) ? null : parsed.getTime()
    }

    const aTime = getTimestamp(a.lastEdited ?? a.updatedAt)
    const bTime = getTimestamp(b.lastEdited ?? b.updatedAt)

    if (aTime === null && bTime === null) {
      return 0
    }
    if (aTime === null) {
      return directionMultiplier === 1 ? 1 : -1
    }
    if (bTime === null) {
      return directionMultiplier === 1 ? -1 : 1
    }

    return (aTime - bTime) * directionMultiplier
  })

  const handleSort = (field: "name" | "lastEdited") => {
    setSortConfig((prev) => {
      if (prev.field === field) {
        return {
          field,
          direction: prev.direction === "asc" ? "desc" : "asc",
        }
      }
      return { field, direction: "asc" }
    })
  }

  const renderSortIcon = (field: "name" | "lastEdited") => {
    if (sortConfig.field !== field) {
      return <ArrowUpDown className="w-3 h-3 opacity-60" />
    }

    return sortConfig.direction === "asc" ? (
      <ArrowUp className="w-3 h-3" />
    ) : (
      <ArrowDown className="w-3 h-3" />
    )
  }

  const handleDownload = (promptId: string) => {
    const prompt = prompts.find((p) => p.id === promptId)
    if (prompt) {
      const dataStr = JSON.stringify(prompt, null, 2)
      const dataUri = "data:application/json;charset=utf-8," + encodeURIComponent(dataStr)
      const exportFileDefaultName = `${prompt.name}.json`

      const linkElement = document.createElement("a")
      linkElement.setAttribute("href", dataUri)
      linkElement.setAttribute("download", exportFileDefaultName)
      linkElement.click()
    }
  }

  const handleDelete = async (promptId: string) => {
    const prompt = prompts.find((p) => p.id === promptId)
    if (prompt) {
      setPromptToDelete(prompt)
      setIsDeleteModalOpen(true)
    }
  }

  const handleConfirmDelete = async () => {
    if (promptToDelete) {
      const success = await deletePrompt(promptToDelete.id)
      if (success) {
        await loadPromptsData()
      }
      setIsDeleteModalOpen(false)
      setPromptToDelete(null)
    }
  }

  const handleCancelDelete = () => {
    setIsDeleteModalOpen(false)
    setPromptToDelete(null)
  }

  const handlePromptClick = async (prompt: Prompt) => {
    try {
      const detailedPrompt = prompt.instructions
        ? prompt
        : await getPrompt(prompt.id)

      updatePromptInState(detailedPrompt)

      if (detailedPrompt.isPublic && !detailedPrompt.isOwner) {
        setViewingPrompt(detailedPrompt)
        setIsViewModalOpen(true)
      } else {
        setEditingPrompt(detailedPrompt)
        setIsEditModalOpen(true)
      }
    } catch (error) {
      console.error("Error opening prompt:", error)
      const message = error instanceof Error ? error.message : "No se pudo cargar el prompt"
      toast.error(message)
    }
  }

  const handleSavePrompt = async (promptData: Partial<Prompt>) => {
    if (!editingPrompt) {
      return
    }

    const success = await savePrompt(editingPrompt.id, promptData)
    if (success) {
      try {
        const refreshed = await getPrompt(editingPrompt.id)
        updatePromptInState(refreshed)
      } catch (error) {
        console.error("Error refreshing prompt:", error)
      }

      setIsEditModalOpen(false)
      setEditingPrompt(null)
      await loadPromptsData()
    } else {
      toast.error("No se pudo guardar el prompt")
    }
  }

  const handleCreateSuccess = () => {
    loadPromptsData()
  }

  const handleUseInNewText = (promptId: string) => {
    router.push(`/write?promptId=${promptId}`)
  }

  const handleCreateCopy = async (promptId: string) => {
    const prompt = prompts.find((p) => p.id === promptId)
    if (!prompt) {
      return
    }

    try {
      const detailedPrompt = prompt.instructions ? prompt : await getPrompt(prompt.id)

      await createPrompt({
        name: `Copia de ${detailedPrompt.name}`,
        instructions: detailedPrompt.instructions,
        isPublic: false,
      })

      await loadPromptsData()
      setActiveTab("propios")

      toast.custom((t) => (
        <div className="bg-green-100 border border-green-200 rounded-lg p-4 shadow-lg flex items-start gap-3 min-w-[280px]">
          <Check className="w-5 h-5 text-green-600 mt-0.5 flex-shrink-0" />
          <div className="flex-1">
            <div className="text-green-800 font-medium">Copia creada</div>
            <button
              onClick={() => {
                setActiveTab("propios")
                toast.dismiss(t)
              }}
              className="text-green-700 underline hover:text-green-800 text-sm mt-1 block"
            >
              Ver en prompts privados
            </button>
          </div>
        </div>
      ))
    } catch (error) {
      console.error("Error copying prompt:", error)
      const message = error instanceof Error ? error.message : "No se pudo copiar el prompt"
      toast.error(message)
    }
  }

  const handleToggleFavorite = (promptId: string) => {
    console.log("[v0] Toggle favorite for prompt:", promptId)
    // TODO: Implement favorite functionality
  }

  return (
    <AppLayout>
      <div className="p-4 h-full min-h-0">

        {/* Main Panel */}
        <div className="bg-white rounded-lg shadow-lg p-8 h-full min-h-0 flex flex-col overflow-hidden">

          {/* Screen header */}
          <div className="mb-8 flex-shrink-0">
            <div className="flex items-center gap-3 mb-2">
              <Image src="/icons/prompt-icon.svg" alt="Prompts" width={28} height={28} className="w-6 h-6" />
              <h1 className="text-3xl  font-semibold text-black">Biblioteca de prompts</h1>
            </div>
            <p className="text-md text-(--color-gris-medio)">
              Aquí podés acceder a prompts públicos y también crear los tuyos
            </p>
          </div>

          <div className="flex items-center justify-between mb-6 flex-shrink-0">
            <Tabs value={activeTab} onValueChange={setActiveTab} className="w-auto">
              <TabsList className="bg-transparent p-0 h-auto gap-4 border-b-[0]">
                <TabsTrigger
                  value="propios"
                  className="bg-transparent p-0 border-b-4 border-transparent data-[state=active]:border-b-[#1862A2] data-[state=active]:bg-transparent data-[state=active]:text-[#1862A2] data-[state=active]:font-bold data-[state=active]:shadow-none font-normal text-gray-600 hover:text-gray-900 transition-colors rounded-none pb-1 pt-1 shadow-none cursor-pointer"
                >
                  Prompts privados
                </TabsTrigger>
                <TabsTrigger
                  value="publicos"
                  className="bg-transparent p-0 border-b-4 border-transparent data-[state=active]:border-b-[#1862A2] data-[state=active]:bg-transparent data-[state=active]:text-[#1862A2] data-[state=active]:font-bold data-[state=active]:shadow-none font-normal text-gray-600 hover:text-gray-900 transition-colors rounded-none pb-1 pt-1 shadow-none cursor-pointer"
                >
                  Prompts públicos
                </TabsTrigger>
              </TabsList>
            </Tabs>

            <Button variant="primary" className="py-2 px-4" onClick={() => setIsCreateModalOpen(true)}>
              <Plus className="w-4 h-4 mr-2" />
              Crear prompt
            </Button>
          </div>

          {/* Screen table */}
          <div className="flex-1 min-h-0 flex flex-col">
            {/* Table Header */}
            {filteredPrompts.length > 0 && (
              <div className="grid grid-cols-12 gap-4 p-4 text-xs font-medium font-mono text-(--color-gris-medio) uppercase tracking-wider flex-shrink-0">
                <button
                  type="button"
                  onClick={() => handleSort("name")}
                  className="col-span-7 flex items-center gap-1 text-left hover:text-gray-700 transition-colors"
                >
                  <span className="uppercase">Nombre</span>
                  {renderSortIcon("name")}
                </button>
                <button
                  type="button"
                  onClick={() => handleSort("lastEdited")}
                  className="col-span-3 flex items-center gap-1 text-left hover:text-gray-700 transition-colors"
                >
                  <span className="uppercase">Última edición</span>
                  {renderSortIcon("lastEdited")}
                </button>
                <div className="col-span-2 text-right">Acciones</div>
              </div>
            )}

            {/* Table Body */}
            <div className="flex-1 overflow-y-auto divide-y divide-gray-200">
              {filteredPrompts.length === 0 ? (
                <div className="h-full flex items-center justify-center">
                  <div className="flex flex-col items-center gap-4">
                    <Image
                      src="/icons/prompt-icon.svg"
                      alt="Prompts"
                      width={48}
                      height={48}
                      className="w-12 h-12 opacity-50"
                    />
                    {activeTab === "propios" && (
                      <Button variant="outline" onClick={() => setIsCreateModalOpen(true)}>
                        <Plus className="w-4 h-4 mr-2" />
                        Crear mi primer prompt
                      </Button>
                    )}
                  </div>
                </div>
              ) : (
                sortedPrompts.map((prompt) => (
                    <div
                      key={prompt.id}
                      className="grid grid-cols-12 gap-4 p-4 hover:bg-gray-50 transition-colors cursor-pointer"
                      onClick={() => void handlePromptClick(prompt)}
                    >
                      <div className="col-span-7">
                        <div className="font-medium text-gray-900 ">{prompt.name}</div>
                      </div>
                      <div className="col-span-3">
                        <TimeAgo value={prompt.lastEdited} className="text-gray-600 " />
                      </div>
                      <div className="col-span-2 flex items-center justify-end gap-2">
                        <ActionTooltip label="Usar en un texto nuevo">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={(e: MouseEvent<HTMLButtonElement>) => {
                              e.stopPropagation()
                              handleUseInNewText(prompt.id)
                            }}
                            className="h-8 w-8 p-0 hover:bg-gray-100"
                          >
                            <FileInput />
                          </Button>
                        </ActionTooltip>

                        {prompt.isPublic ? (
                          <>
                            <ActionTooltip label="Crear una copia">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e: MouseEvent<HTMLButtonElement>) => {
                                  e.stopPropagation()
                                  handleCreateCopy(prompt.id)
                                }}
                                className="h-8 w-8 p-0 hover:bg-gray-100"
                              >
                                <Copy />
                              </Button>
                            </ActionTooltip>

                            {/* <ActionTooltip label="Marcar como favorito">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleToggleFavorite(prompt.id)
                                }}
                                className="h-8 w-8 p-0 hover:bg-gray-100"
                              >
                                <Image
                                  src="/icons/favorite.svg"
                                  alt="Marcar como favorito"
                                  width={16}
                                  height={16}
                                  className="w-4 h-4"
                                />
                              </Button>
                            </ActionTooltip> */}
                          </>
                        ) : (
                          <>
                            {/* <ActionTooltip label="Marcar como favorito">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e) => {
                                  e.stopPropagation()
                                  handleToggleFavorite(prompt.id)
                                }}
                                className="h-8 w-8 p-0 hover:bg-gray-100"
                              >
                                <Image
                                  src="/icons/favorite.svg"
                                  alt="Marcar como favorito"
                                  width={16}
                                  height={16}
                                  className="w-4 h-4"
                                />
                              </Button>
                            </ActionTooltip> */}

                            <ActionTooltip label="Eliminar">
                              <Button
                                variant="ghost"
                                size="sm"
                                onClick={(e: MouseEvent<HTMLButtonElement>) => {
                                  e.stopPropagation()
                                  handleDelete(prompt.id)
                                }}
                                className="h-8 w-8 p-0 hover:bg-gray-100"
                              >
                                <Trash2 className="h-4 w-4 text-gray-600" />
                              </Button>
                            </ActionTooltip>
                          </>
                        )}
                      </div>
                    </div>
                  ))
              )}
            </div>
          </div>
        </div>
      </div>

      <DeleteConfirmationModal
        isOpen={isDeleteModalOpen}
        onClose={handleCancelDelete}
        onConfirm={handleConfirmDelete}
        promptName={promptToDelete?.name || ""}
      />

      <Dialog open={isViewModalOpen} onOpenChange={setIsViewModalOpen}>
        <DialogContent className="max-w-6xl max-h-[90vh] overflow-hidden flex flex-col">
          <DialogHeader>
            <DialogTitle className="font-sans">{viewingPrompt?.name || "Ver Prompt"}</DialogTitle>
          </DialogHeader>
          {viewingPrompt && <ViewPromptModal prompt={viewingPrompt} onClose={() => setIsViewModalOpen(false)} />}
        </DialogContent>
      </Dialog>

      <Dialog open={isEditModalOpen} onOpenChange={setIsEditModalOpen}>
        <DialogContent className="max-w-4xl h-[90vh] flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="font-sans">Editar prompt</DialogTitle>
            {/* <DialogDescription>Modifica el nombre y las instrucciones de tu prompt.</DialogDescription> */}
          </DialogHeader>
          {editingPrompt && (
            <EditPromptForm
              prompt={editingPrompt}
              onSave={handleSavePrompt}
              onCancel={() => setIsEditModalOpen(false)}
            />
          )}
        </DialogContent>
      </Dialog>

      <CreatePromptModal
        isOpen={isCreateModalOpen}
        onClose={() => setIsCreateModalOpen(false)}
        onSuccess={handleCreateSuccess}
      />
    </AppLayout>
  )
}
