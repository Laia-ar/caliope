"use client"

import { useState } from "react"
import { Trash2, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface DeleteDocumentModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => Promise<void>
  documentTitle: string
}

export function DeleteDocumentModal({ isOpen, onClose, onConfirm, documentTitle }: DeleteDocumentModalProps) {
  const [isDeleting, setIsDeleting] = useState(false)

  const handleConfirm = async () => {
    setIsDeleting(true)
    try {
      await onConfirm()
      onClose()
    } catch (error) {
      console.error("Error deleting document:", error)
    } finally {
      setIsDeleting(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className=" font-semibold">Vas a eliminar "{documentTitle}"</DialogTitle>
          <DialogDescription className="">
            Tus cambios podrían perderse. Esta acción no se puede deshacer.
          </DialogDescription>
        </DialogHeader>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isDeleting}
            className="btn-radius  text-sm bg-transparent"
          >
            Cancelar
          </Button>
          <Button
            variant="destructive"
            onClick={handleConfirm}
            disabled={isDeleting}
            className="btn-radius  text-sm px-4"
          >
            {isDeleting ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Eliminando...
              </>
            ) : (
              <>
                <Trash2 className="w-4 h-4 mr-2" />
                Eliminar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
