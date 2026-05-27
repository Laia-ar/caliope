"use client"
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"

interface InspirationSidebarProps {
  isOpen: boolean
  onClose: () => void
}

export function InspirationSidebar({ isOpen, onClose }: InspirationSidebarProps) {
  return (
    <Sheet open={isOpen} onOpenChange={onClose}>
      <SheetContent side="right" className="w-96">
        <SheetHeader>
          <SheetTitle>Inspiraciones</SheetTitle>
        </SheetHeader>

        <div className="mt-6 flex items-center justify-center h-64 text-muted-foreground">
          <p>Acá van las inspiraciones</p>
        </div>
      </SheetContent>
    </Sheet>
  )
}
