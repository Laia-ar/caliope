"use client"

import { useState, useEffect } from "react"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { History, Clock, User } from "lucide-react"
import { buildBackendUrl } from "@/lib/backend"
import { TimeAgo } from "@/components/time-ago"

interface QueryHistoryItem {
  id: string
  query: string
  prompt_name: string
  model_used: string
  created_at: string
  document_id: string | null
}

interface QueryHistoryModalProps {
  isOpen: boolean
  onClose: () => void
  documentId?: string
}

export function QueryHistoryModal({ isOpen, onClose, documentId }: QueryHistoryModalProps) {
  const [history, setHistory] = useState<QueryHistoryItem[]>([])
  const [isLoading, setIsLoading] = useState(false)

  useEffect(() => {
    if (isOpen) {
      loadHistory()
    }
  }, [isOpen, documentId])

  const loadHistory = async () => {
    setIsLoading(true)
    try {
      const url = documentId ? `/api/queries/history?document_id=${documentId}` : "/api/queries/history"

      const response = await fetch(buildBackendUrl(url), {
        credentials: "include",
      })

      if (response.ok) {
        const data = await response.json()
        setHistory(data)
      }
    } catch (error) {
      console.error("Error loading history:", error)
    } finally {
      setIsLoading(false)
    }
  }

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-2xl max-h-[80vh]">
        <DialogHeader>
          <DialogTitle className=" flex items-center gap-2">
            <History className="w-5 h-5" />
            Historial de preguntas
          </DialogTitle>
        </DialogHeader>

        <div className="py-4 max-h-96 overflow-y-auto">
          {isLoading ? (
            <div className="text-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-purple-600 mx-auto"></div>
              <p className=" text-muted-foreground mt-2">Cargando historial...</p>
            </div>
          ) : history.length > 0 ? (
            <div className="space-y-4">
              {history.map((item) => (
                <div key={item.id} className="border border-border rounded-lg p-4 hover:bg-muted/50 transition-colors">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p className=" text-sm leading-relaxed mb-2">{item.query}</p>
                      <div className="flex items-center gap-4 text-xs text-muted-foreground">
                        <div className="flex items-center gap-1">
                          <User className="w-3 h-3" />
                          <span>{item.prompt_name}</span>
                        </div>
                        <div className="flex items-center gap-1">
                          <Clock className="w-3 h-3" />
                          <TimeAgo value={item.created_at} className="text-xs" />
                        </div>
                        <span className="bg-muted px-2 py-1 rounded text-xs">{item.model_used}</span>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="text-center py-8">
              <History className="w-12 h-12 text-muted-foreground mx-auto mb-4" />
              <p className=" text-muted-foreground">No hay preguntas en el historial</p>
              <p className=" text-sm text-muted-foreground mt-1">
                Las consultas aparecerán aquí después de generar preguntas
              </p>
            </div>
          )}
        </div>

        <div className="flex justify-end pt-4 border-t">
          <Button onClick={onClose} variant="outline" className=" text-sm btn-radius bg-transparent">
            Cerrar
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  )
}
