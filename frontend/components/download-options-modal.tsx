"use client"

import { useState } from "react"
import { FileText, Code, Loader2 } from "lucide-react"
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface DownloadOptionsModalProps {
  isOpen: boolean
  onClose: () => void
  onDownload: (format: "md" | "html") => Promise<void>
  documentTitle: string
}

export function DownloadOptionsModal({ isOpen, onClose, onDownload, documentTitle }: DownloadOptionsModalProps) {
  const [isDownloading, setIsDownloading] = useState<"md" | "html" | null>(null)

  const handleDownload = async (format: "md" | "html") => {
    setIsDownloading(format)
    try {
      await onDownload(format)
      onClose()
    } catch (error) {
      console.error("Error downloading document:", error)
    } finally {
      setIsDownloading(null)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className=" font-semibold">Descargar texto</DialogTitle>
          <DialogDescription className="">
            Selecciona el formato en el que quieres descargar "{documentTitle}".
          </DialogDescription>
        </DialogHeader>
        <div className="space-y-3">
          <Button
            variant="outline"
            onClick={() => handleDownload("md")}
            disabled={isDownloading !== null}
            className="w-full justify-start btn-radius  text-sm"
          >
            {isDownloading === "md" ? (
              <Loader2 className="w-4 h-4 mr-3 animate-spin" />
            ) : (
              <FileText className="w-4 h-4 mr-3" />
            )}
            <div className="text-left">
              <div className="font-medium">Markdown (.md)</div>
              <div className="text-xs text-gray-500">Formato de texto plano con marcado</div>
            </div>
          </Button>

          <Button
            variant="outline"
            onClick={() => handleDownload("html")}
            disabled={isDownloading !== null}
            className="w-full justify-start btn-radius  text-sm"
          >
            {isDownloading === "html" ? (
              <Loader2 className="w-4 h-4 mr-3 animate-spin" />
            ) : (
              <Code className="w-4 h-4 mr-3" />
            )}
            <div className="text-left">
              <div className="font-medium">HTML (.html)</div>
              <div className="text-xs text-gray-500">Formato web con estilos</div>
            </div>
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
