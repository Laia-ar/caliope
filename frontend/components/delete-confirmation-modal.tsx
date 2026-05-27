"use client"

import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"

interface DeleteConfirmationModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: () => void
  promptName: string
}

export function DeleteConfirmationModal({ isOpen, onClose, onConfirm, promptName }: DeleteConfirmationModalProps) {
  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-md p-6">
        <DialogHeader>
          <DialogTitle className="text-lg font-semibold text-gray-900 ">
            Vas a eliminar "{promptName}"
          </DialogTitle>
          <DialogDescription className="text-sm text-gray-600">Tus cambios podrían perderse. Esta acción no se puede deshacer.</DialogDescription>
        </DialogHeader>

        <div className="flex justify-end gap-3 pt-4">
          <Button variant="outline" onClick={onClose} className="px-4 py-2 bg-transparent">
            Cancelar
          </Button>
          <Button onClick={onConfirm} className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white">
            Eliminar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
