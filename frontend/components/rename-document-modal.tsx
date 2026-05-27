"use client"

import type React from "react"

import { useState, useEffect } from "react"
import { PenTool, Loader2 } from "lucide-react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface RenameDocumentModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (newTitle: string) => Promise<void>
  currentTitle: string
}

export function RenameDocumentModal({ isOpen, onClose, onConfirm, currentTitle }: RenameDocumentModalProps) {
  const [newTitle, setNewTitle] = useState(currentTitle)
  const [isRenaming, setIsRenaming] = useState(false)

  useEffect(() => {
    if (isOpen) {
      setNewTitle(currentTitle)
    }
  }, [isOpen, currentTitle])

  const handleConfirm = async () => {
    if (!newTitle.trim() || newTitle === currentTitle) return

    setIsRenaming(true)
    try {
      await onConfirm(newTitle.trim())
      onClose()
    } catch (error) {
      console.error("Error renaming document:", error)
    } finally {
      setIsRenaming(false)
    }
  }

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") {
      handleConfirm()
    } else if (e.key === "Escape") {
      onClose()
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className=" font-semibold">Cambiar nombre</DialogTitle>
          <DialogDescription className="">Ingresa el nuevo nombre para el texto.</DialogDescription>
        </DialogHeader>
        <div className="space-y-2">
          <Label htmlFor="title" className=" text-sm">
            Nombre del texto
          </Label>
          <Input
            id="title"
            value={newTitle}
            onChange={(e) => setNewTitle(e.target.value)}
            onKeyDown={handleKeyDown}
            className=""
            placeholder="Nombre del texto"
            autoFocus
          />
        </div>
        <DialogFooter className="gap-2">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isRenaming}
            className="btn-radius  text-sm bg-transparent"
          >
            Cancelar
          </Button>
          <Button
            variant="primary"
            onClick={handleConfirm}
            disabled={isRenaming || !newTitle.trim() || newTitle === currentTitle}
            className="btn-radius text-sm px-4"
          >
            {isRenaming ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Guardando...
              </>
            ) : (
              <>
                <PenTool />
                Guardar
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
