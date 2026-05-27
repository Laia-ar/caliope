"use client"

import { useState } from "react"
import { Download, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface DownloadDocumentModalProps {
  isOpen: boolean
  onClose: () => void
  onDownload: (format: "md" | "html") => Promise<void>
  documentTitle: string
}

export function DownloadDocumentModal({ isOpen, onClose, onDownload, documentTitle }: DownloadDocumentModalProps) {
  const [isDownloading, setIsDownloading] = useState(false)
  const [selectedFormat, setSelectedFormat] = useState<"md" | "html">("md")

  const handleDownload = async () => {
    setIsDownloading(true)
    try {
      await onDownload(selectedFormat)
      onClose()
    } catch (error) {
      console.error("Error downloading document:", error)
    } finally {
      setIsDownloading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className=" font-semibold">Descargar texto</DialogTitle>
          <DialogDescription className="">
            Selecciona el formato para descargar "{documentTitle}".
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          <div className="flex gap-2">
            <Button
              variant={selectedFormat === "md" ? "default" : "outline"}
              onClick={() => setSelectedFormat("md")}
              className="flex-1 btn-radius  text-sm"
              disabled={isDownloading}
            >
              Markdown (.md)
            </Button>
            <Button
              variant={selectedFormat === "html" ? "default" : "outline"}
              onClick={() => setSelectedFormat("html")}
              className="flex-1 btn-radius  text-sm"
              disabled={isDownloading}
            >
              HTML (.html)
            </Button>
          </div>
        </div>

        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isDownloading}
            className="btn-radius  text-sm bg-transparent"
          >
            Cancelar
          </Button>
          <Button variant="primary" onClick={handleDownload} disabled={isDownloading} className="btn-radius text-sm px-4">
            {isDownloading ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Descargando...
              </>
            ) : (
              <>
                <Download className="w-4 h-4 mr-2" />
                Descargar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
