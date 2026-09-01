"use client"

import { useEffect, useState } from "react"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Loader2 } from "lucide-react"

interface ChecklistConfirmDialogProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  title: string
  description?: string
  items: string[]
  confirmLabel: string
  onConfirm: () => void
  loading?: boolean
}

export function ChecklistConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  items,
  confirmLabel,
  onConfirm,
  loading = false,
}: ChecklistConfirmDialogProps) {
  const [checked, setChecked] = useState<boolean[]>([])

  useEffect(() => {
    if (open) {
      setChecked(items.map(() => false))
    }
  }, [open, items])

  const allChecked = checked.length === items.length && checked.every(Boolean)

  const toggleItem = (index: number) => {
    setChecked((prev) => prev.map((value, i) => (i === index ? !value : value)))
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          {description && <DialogDescription>{description}</DialogDescription>}
        </DialogHeader>

        <div className="space-y-3 py-2">
          {items.map((item, index) => (
            <label
              key={index}
              className="flex items-start gap-3 cursor-pointer text-sm text-gray-700"
            >
              <input
                type="checkbox"
                checked={checked[index] ?? false}
                onChange={() => toggleItem(index)}
                className="mt-0.5 h-4 w-4 shrink-0 cursor-pointer"
              />
              <span>{item}</span>
            </label>
          ))}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={loading}>
            Volver
          </Button>
          <Button onClick={onConfirm} disabled={!allChecked || loading}>
            {loading && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
            {confirmLabel}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
