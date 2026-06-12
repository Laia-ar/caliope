"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import { toast } from "sonner"
import {
  loadAdminModels,
  createModel,
  updateModel,
  deleteModel,
  type AvailableModel,
} from "@/lib/models-api"

export function AdminModelsSection() {
  const [models, setModels] = useState<AvailableModel[]>([])
  const [loading, setLoading] = useState(true)
  const [newSlug, setNewSlug] = useState("")
  const [newLabel, setNewLabel] = useState("")
  const [isAdding, setIsAdding] = useState(false)
  const [editingId, setEditingId] = useState<number | null>(null)
  const [editSlug, setEditSlug] = useState("")
  const [editLabel, setEditLabel] = useState("")

  const loadModels = async () => {
    try {
      setLoading(true)
      const data = await loadAdminModels()
      setModels(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar los modelos")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    loadModels()
  }, [])

  const handleAdd = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!newSlug.trim() || !newLabel.trim()) return
    try {
      setIsAdding(true)
      await createModel({ slug: newSlug.trim(), label: newLabel.trim() })
      toast.success("Modelo agregado")
      setNewSlug("")
      setNewLabel("")
      await loadModels()
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo agregar el modelo")
    } finally {
      setIsAdding(false)
    }
  }

  const handleToggleActive = async (model: AvailableModel) => {
    try {
      await updateModel(model.id, { is_active: !model.is_active })
      setModels((prev) =>
        prev.map((m) => (m.id === model.id ? { ...m, is_active: !m.is_active } : m))
      )
      toast.success(model.is_active ? "Modelo desactivado" : "Modelo activado")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar")
    }
  }

  const handleStartEdit = (model: AvailableModel) => {
    setEditingId(model.id)
    setEditSlug(model.slug)
    setEditLabel(model.label)
  }

  const handleSaveEdit = async () => {
    if (!editingId || !editSlug.trim() || !editLabel.trim()) return
    try {
      await updateModel(editingId, { slug: editSlug.trim(), label: editLabel.trim() })
      setModels((prev) =>
        prev.map((m) =>
          m.id === editingId ? { ...m, slug: editSlug.trim(), label: editLabel.trim() } : m
        )
      )
      toast.success("Modelo actualizado")
      setEditingId(null)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo actualizar")
    }
  }

  const handleDelete = async (id: number) => {
    if (!confirm("¿Estás seguro de que querés eliminar este modelo?")) return
    try {
      await deleteModel(id)
      setModels((prev) => prev.filter((m) => m.id !== id))
      toast.success("Modelo eliminado")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar")
    }
  }

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-32 w-full" />
      </div>
    )
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div>
        <h2 className="text-xl font-semibold text-gray-900">Modelos disponibles</h2>
        <p className="text-sm text-gray-500">
          Definí qué modelos pueden elegir los docentes al crear una sesión.
        </p>
      </div>

      <form onSubmit={handleAdd} className="mt-6 flex gap-2">
        <Input
          placeholder="Slug de OpenRouter (ej: openai/gpt-4o-mini)"
          value={newSlug}
          onChange={(e) => setNewSlug(e.target.value)}
          className="flex-1"
        />
        <Input
          placeholder="Nombre visible"
          value={newLabel}
          onChange={(e) => setNewLabel(e.target.value)}
          className="flex-1"
        />
        <Button type="submit" disabled={isAdding}>
          {isAdding ? "Agregando..." : "Agregar"}
        </Button>
      </form>

      <div className="mt-6 overflow-hidden rounded-xl border border-gray-100">
        <table className="min-w-full divide-y divide-gray-200 text-sm">
          <thead className="bg-gray-50">
            <tr>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Slug</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Nombre</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Estado</th>
              <th className="px-4 py-3 text-left font-medium text-gray-600">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100 bg-white">
            {models.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-8 text-center text-gray-500">
                  No hay modelos configurados.
                </td>
              </tr>
            ) : (
              models.map((model) => (
                <tr key={model.id} className="hover:bg-gray-50/80">
                  <td className="px-4 py-3 font-mono text-xs text-gray-700">
                    {editingId === model.id ? (
                      <Input
                        value={editSlug}
                        onChange={(e) => setEditSlug(e.target.value)}
                        className="h-8 text-xs"
                      />
                    ) : (
                      model.slug
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-700">
                    {editingId === model.id ? (
                      <Input
                        value={editLabel}
                        onChange={(e) => setEditLabel(e.target.value)}
                        className="h-8 text-xs"
                      />
                    ) : (
                      model.label
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <Button
                      variant={model.is_active ? "default" : "outline"}
                      size="sm"
                      onClick={() => handleToggleActive(model)}
                    >
                      {model.is_active ? "Activo" : "Inactivo"}
                    </Button>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      {editingId === model.id ? (
                        <>
                          <Button variant="outline" size="sm" onClick={handleSaveEdit}>
                            Guardar
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => setEditingId(null)}
                          >
                            Cancelar
                          </Button>
                        </>
                      ) : (
                        <>
                          <Button variant="outline" size="sm" onClick={() => handleStartEdit(model)}>
                            Editar
                          </Button>
                          <Button
                            variant="outline"
                            size="sm"
                            className="text-red-600 hover:bg-red-50 hover:text-red-700"
                            onClick={() => handleDelete(model.id)}
                          >
                            Eliminar
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </section>
  )
}
