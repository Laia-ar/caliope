"use client"

import { useState, useEffect } from "react"
import Link from "next/link"
import Image from "next/image" // Added Image import for custom SVG icon
import { PenTool, Download, Trash2, MoreHorizontal, Plus, ArrowUp, ArrowDown, ArrowUpDown } from "lucide-react" // Added Plus icon import
import { AppLayout } from "@/components/app-layout"
import { Button } from "@/components/ui/button"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { Select, SelectContent, SelectItem } from "@/components/ui/select"
import { documentsApi, type DocumentListItem } from "@/lib/api"
import { DeleteDocumentModal } from "@/components/delete-document-modal"
import { RenameDocumentModal } from "@/components/rename-document-modal"
import { DownloadDocumentModal } from "@/components/download-document-modal"
import { ActionTooltip } from "@/components/action-tooltip"
import { TimeAgo } from "@/components/time-ago"

export default function DocumentsPage() {
  const [documents, setDocuments] = useState<DocumentListItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [currentPage, setCurrentPage] = useState(1)
  const [totalPages, setTotalPages] = useState(1)
  const [totalDocuments, setTotalDocuments] = useState(0)
  const [selectedSector, setSelectedSector] = useState<string>("all")

  const [deleteModal, setDeleteModal] = useState<{ isOpen: boolean; document: DocumentListItem | null }>({
    isOpen: false,
    document: null,
  })
  const [renameModal, setRenameModal] = useState<{ isOpen: boolean; document: DocumentListItem | null }>({
    isOpen: false,
    document: null,
  })
  const [downloadModal, setDownloadModal] = useState<{ isOpen: boolean; document: DocumentListItem | null }>({
    isOpen: false,
    document: null,
  })
  const [sortConfig, setSortConfig] = useState<{ field: "title" | "updated_at"; direction: "asc" | "desc" }>({
    field: "updated_at",
    direction: "desc",
  })

  const loadDocuments = async () => {
    try {
      setLoading(true)
      setError(null)

      const response = await documentsApi.list({
        page: currentPage,
        page_size: 10,
        tag: selectedSector === "all" ? undefined : selectedSector,
      })

      const {
        items: rawItems = [],
        total: rawTotal = 0,
        page_size: rawPageSize = 10,
      } = (response ?? {}) as Partial<typeof response>

      const items = Array.isArray(rawItems) ? rawItems : []
      const total = Number.isFinite(rawTotal) ? rawTotal : items.length
      const pageSize = Number.isFinite(rawPageSize) && rawPageSize > 0
        ? rawPageSize
        : items.length > 0
          ? items.length
          : 10

      setDocuments(items)
      setTotalPages(Math.max(1, Math.ceil(total / pageSize)))
      setTotalDocuments(total)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Error loading documents")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadDocuments()
  }, [currentPage, selectedSector])

  const sortedDocuments = [...documents].sort((a, b) => {
    const directionMultiplier = sortConfig.direction === "asc" ? 1 : -1

    if (sortConfig.field === "title") {
      return a.title.localeCompare(b.title, "es", { sensitivity: "base" }) * directionMultiplier
    }

    const getTimestamp = (value?: string) => {
      if (!value) {
        return null
      }
      const parsed = new Date(value)
      return Number.isNaN(parsed.getTime()) ? null : parsed.getTime()
    }

    const aTime = getTimestamp(a.updated_at)
    const bTime = getTimestamp(b.updated_at)

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

  const handleSort = (field: "title" | "updated_at") => {
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

  const renderSortIcon = (field: "title" | "updated_at") => {
    if (sortConfig.field !== field) {
      return <ArrowUpDown className="w-3 h-3 opacity-60" />
    }

    return sortConfig.direction === "asc" ? (
      <ArrowUp className="w-3 h-3" />
    ) : (
      <ArrowDown className="w-3 h-3" />
    )
  }

  const handleDownload = async (doc: DocumentListItem, format: "md" | "html" = "md") => {
    try {
      // Get full document content
      const fullDoc = await documentsApi.get(doc.id)

      const content =
        format === "md"
          ? fullDoc.content
          : `<!DOCTYPE html><html><head><title>${fullDoc.title}</title></head><body><h1>${fullDoc.title}</h1><pre>${fullDoc.content}</pre></body></html>`

      const mimeType = format === "md" ? "text/markdown" : "text/html"
      const blob = new Blob([content], { type: mimeType })
      const url = URL.createObjectURL(blob)
      const a = document.createElement("a")
      a.href = url
      a.download = `${fullDoc.title}.${format}`
      document.body.appendChild(a)
      a.click()
      document.body.removeChild(a)
      URL.revokeObjectURL(url)
    } catch (err) {
      console.error("Error downloading document:", err)
    }
  }

  const handleDelete = async (doc: DocumentListItem) => {
    try {
      await documentsApi.delete(doc.id)
      await loadDocuments() // Reload the list
    } catch (err) {
      console.error("Error deleting document:", err)
    }
  }

  const handleRename = async (doc: DocumentListItem, newTitle: string) => {
    try {
      await documentsApi.update(doc.id, { title: newTitle })
      await loadDocuments() // Reload the list
    } catch (err) {
      console.error("Error renaming document:", err)
    }
  }

  if (loading) {
    return (
      <AppLayout>
        <div className="p-8 h-full min-h-0">
          <div className="mb-8">
            <div className="flex items-center gap-3 mb-2">
              <Image src="/icons/documents-icon.svg" alt="Documents" width={24} height={24} className="w-6 h-6" />{" "}
              {/* Replaced FileText with custom SVG icon */}
              <h1 className="text-3xl  font-semibold text-black">Textos</h1>
            </div>
            <p className="text-lg  text-gray-600">Aquí podrás guardar tus textos ordenados en carpetas</p>
          </div>

          {/* Loading skeleton */}
          <div className="space-y-4">
            {[...Array(5)].map((_, i) => (
              <div key={i} className="h-12 bg-gray-100 rounded animate-pulse" />
            ))}
          </div>
        </div>
      </AppLayout>
    )
  }

  if (error) {
    return (
      <AppLayout>
        <div className="p-8 h-full min-h-0">
          <div className="text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <Button onClick={loadDocuments} className="btn-radius  text-sm">
              Reintentar
            </Button>
          </div>
        </div>
      </AppLayout>
    )
  }

  if (documents.length === 0) {
    return (
      <AppLayout>
        <div className="p-4 h-full min-h-0">
          <div className="bg-white rounded-lg shadow-lg p-8 h-full min-h-0 flex flex-col">
            <div className="mb-8">
              <div className="flex items-center gap-3 mb-2">
                <Image src="/icons/documents-icon.svg" alt="Documents" width={24} height={24} className="w-6 h-6" />{" "}
                {/* Replaced FileText with custom SVG icon */}
                <h1 className="text-3xl  font-semibold text-black">Textos</h1>
              </div>
              <p className="text-lg  text-gray-600">Aquí podrás guardar tus textos ordenados en carpetas</p>
            </div>

            {/* Empty state */}
            <div className="flex flex-col items-center justify-center py-16">
              <PenTool className="w-16 h-16 text-gray-400 mb-6" />
              <Link href="/write">
                <Button variant="outline" className="btn-radius  text-sm bg-transparent">
                  <Plus className="w-4 h-4 mr-2" />
                  crear mi primer texto
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </AppLayout>
    )
  }

  return (
    <AppLayout>
      <div className="p-4 h-full min-h-0">

        {/* Main Panel */}
        <div className="bg-white rounded-lg shadow-lg p-8 h-full min-h-0 flex flex-col overflow-hidden">
          
          {/* Screen header */}
          <div className="mb-8 flex-shrink-0">
            <div className="flex items-center gap-3 mb-2">
              <Image src="/icons/documents-icon.svg" alt="Documents" width={24} height={24} className="w-6 h-6" />{" "}
              {/* Replaced FileText with custom SVG icon */}
              <h1 className="text-3xl  font-semibold text-black">Textos</h1>
            </div>
            <p className="text-md text-(--color-gris-medio)">Aquí podrás guardar tus textos ordenados en carpetas</p>
          </div>

          <div className="flex items-center justify-between mb-6 flex-shrink-0">
            <div className="flex items-center gap-4">
              <Select value={selectedSector} onValueChange={setSelectedSector}>
                <SelectContent>
                  <SelectItem value="all">Todos los sectores</SelectItem>
                  <SelectItem value="Personal">Personal</SelectItem>
                  <SelectItem value="Trabajo">Trabajo</SelectItem>
                  <SelectItem value="Ficción">Ficción</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <Link href="/write">
              <Button variant="primary" className="py-2 px-4">
                <Plus className="w-4 h-4 mr-2" />
                Crear texto
              </Button>
            </Link>
          </div>

          {/* Screen table */}
          {/* Documents table */}
          <div className="flex-1 min-h-0 flex flex-col overflow-hidden">
            <div className="grid grid-cols-12 gap-4 p-4 border-b text-xs font-medium font-mono text-(--color-gris-medio) uppercase tracking-wide flex-shrink-0">
              <button
                type="button"
                onClick={() => handleSort("title")}
                className="col-span-7 flex items-center gap-1 text-left hover:text-gray-700 transition-colors"
              >
                <span className="uppercase">Título</span>
                {renderSortIcon("title")}
              </button>
              <button
                type="button"
                onClick={() => handleSort("updated_at")}
                className="col-span-3 flex items-center gap-1 text-left hover:text-gray-700 transition-colors"
              >
                <span className="uppercase">Última edición</span>
                {renderSortIcon("updated_at")}
              </button>
              <div className="col-span-2 text-right">Acciones</div>
            </div>

            <div className="flex-1 overflow-y-auto">
              {sortedDocuments.map((doc) => (
                  <div
                    key={doc.id}
                    className="grid grid-cols-12 gap-4 p-4 border-b border-gray-100 last:border-b-0 hover:bg-gray-50 transition-colors"
                  >
                  <div className="col-span-7">
                    <Link
                      href={`/write/${doc.id}`}
                      className=" text-black hover:text-blue-600 transition-colors"
                    >
                      {doc.title}
                    </Link>
                  </div>
                  <div className="col-span-3  text-gray-600">
                    <TimeAgo value={doc.updated_at} />
                  </div>
                  <div className="col-span-2 flex items-center justify-end gap-2">
                    <ActionTooltip label="Descargar">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDownloadModal({ isOpen: true, document: doc })}
                        className="p-2"
                        aria-label="Descargar"
                      >
                        <Download className="w-4 h-4" />
                      </Button>
                    </ActionTooltip>
                    <ActionTooltip label="Eliminar">
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setDeleteModal({ isOpen: true, document: doc })}
                        className="p-2 text-red-600 hover:text-red-700"
                        aria-label="Eliminar"
                      >
                        <Trash2 className="w-4 h-4" />
                      </Button>
                    </ActionTooltip>
                    <DropdownMenu>
                      <DropdownMenuTrigger asChild>
                        <Button variant="ghost" size="sm" className="p-2" aria-label="Más opciones">
                          <MoreHorizontal className="w-4 h-4" />
                        </Button>
                      </DropdownMenuTrigger>
                      <DropdownMenuContent align="end">
                        <DropdownMenuItem onClick={() => setDownloadModal({ isOpen: true, document: doc })}>
                          <Download className="w-4 h-4 mr-2" />
                          Descargar
                        </DropdownMenuItem>
                        <DropdownMenuItem onClick={() => setRenameModal({ isOpen: true, document: doc })}>
                          <PenTool className="w-4 h-4 mr-2" />
                          Cambiar Título
                        </DropdownMenuItem>
                        <DropdownMenuItem
                          onClick={() => setDeleteModal({ isOpen: true, document: doc })}
                          className="text-red-600"
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          Eliminar
                        </DropdownMenuItem>
                      </DropdownMenuContent>
                    </DropdownMenu>
                    </div>
                  </div>
                ))}
            </div>
          </div>
        </div>

        {deleteModal.document && (
          <DeleteDocumentModal
            isOpen={deleteModal.isOpen}
            onClose={() => setDeleteModal({ isOpen: false, document: null })}
            onConfirm={() => handleDelete(deleteModal.document!)}
            documentTitle={deleteModal.document.title}
          />
        )}

        {renameModal.document && (
          <RenameDocumentModal
            isOpen={renameModal.isOpen}
            onClose={() => setRenameModal({ isOpen: false, document: null })}
            onConfirm={(newTitle) => handleRename(renameModal.document!, newTitle)}
            currentTitle={renameModal.document.title}
          />
        )}

        {downloadModal.document && (
          <DownloadDocumentModal
            isOpen={downloadModal.isOpen}
            onClose={() => setDownloadModal({ isOpen: false, document: null })}
            onDownload={(format) => handleDownload(downloadModal.document!, format)}
            documentTitle={downloadModal.document.title}
          />
        )}
      </div>
    </AppLayout>
  )
}
