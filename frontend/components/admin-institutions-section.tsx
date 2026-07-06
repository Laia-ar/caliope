"use client"

import { useEffect, useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { toast } from "sonner"
import { Plus, Trash2, ChevronDown, ChevronUp, Users } from "lucide-react"
import {
  fetchInstitutions,
  createInstitution,
  updateInstitution,
  deleteInstitution,
  fetchGrades,
  createGrade,
  updateGrade,
  deleteGrade,
  fetchGradeMembers,
  addGradeMember,
  removeGradeMember,
  type Institution,
  type Grade,
  type GradeMember,
} from "@/lib/institutions"

export function AdminInstitutionsSection() {
  const [institutions, setInstitutions] = useState<Institution[]>([])
  const [expandedInstitution, setExpandedInstitution] = useState<number | null>(null)
  const [expandedGrade, setExpandedGrade] = useState<number | null>(null)
  const [newInstitutionName, setNewInstitutionName] = useState("")
  const [newGradeNames, setNewGradeNames] = useState<Record<number, string>>({})
  const [gradesByInstitution, setGradesByInstitution] = useState<Record<number, Grade[]>>({})
  const [membersByGrade, setMembersByGrade] = useState<Record<number, GradeMember[]>>({})
  const [newMemberEmails, setNewMemberEmails] = useState<Record<number, string>>({})
  const [newMemberRoles, setNewMemberRoles] = useState<Record<number, "teacher" | "student">>({})
  const [loading, setLoading] = useState(true)

  const loadInstitutions = async () => {
    try {
      setLoading(true)
      const data = await fetchInstitutions()
      setInstitutions(data)
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudieron cargar las instituciones")
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadInstitutions()
  }, [])

  const handleCreateInstitution = async () => {
    if (!newInstitutionName.trim()) return
    try {
      const created = await createInstitution(newInstitutionName.trim())
      setInstitutions((prev) => [...prev, created].sort((a, b) => a.name.localeCompare(b.name)))
      setNewInstitutionName("")
      toast.success("Institución creada")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear la institución")
    }
  }

  const handleDeleteInstitution = async (id: number) => {
    if (!confirm("¿Eliminar esta institución? Se eliminarán todos sus grados y asignaciones.")) return
    try {
      await deleteInstitution(id)
      setInstitutions((prev) => prev.filter((i) => i.id !== id))
      toast.success("Institución eliminada")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar la institución")
    }
  }

  const toggleInstitution = async (id: number) => {
    if (expandedInstitution === id) {
      setExpandedInstitution(null)
      return
    }
    setExpandedInstitution(id)
    if (!gradesByInstitution[id]) {
      try {
        const grades = await fetchGrades(id)
        setGradesByInstitution((prev) => ({ ...prev, [id]: grades }))
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudieron cargar los grados")
      }
    }
  }

  const handleCreateGrade = async (institutionId: number) => {
    const name = newGradeNames[institutionId]?.trim()
    if (!name) return
    try {
      const created = await createGrade(institutionId, name)
      setGradesByInstitution((prev) => ({
        ...prev,
        [institutionId]: [...(prev[institutionId] || []), created].sort((a, b) => a.name.localeCompare(b.name)),
      }))
      setNewGradeNames((prev) => ({ ...prev, [institutionId]: "" }))
      toast.success("Grado creado")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo crear el grado")
    }
  }

  const handleDeleteGrade = async (institutionId: number, gradeId: number) => {
    if (!confirm("¿Eliminar este grado?")) return
    try {
      await deleteGrade(gradeId)
      setGradesByInstitution((prev) => ({
        ...prev,
        [institutionId]: (prev[institutionId] || []).filter((g) => g.id !== gradeId),
      }))
      toast.success("Grado eliminado")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo eliminar el grado")
    }
  }

  const toggleGrade = async (gradeId: number) => {
    if (expandedGrade === gradeId) {
      setExpandedGrade(null)
      return
    }
    setExpandedGrade(gradeId)
    if (!membersByGrade[gradeId]) {
      try {
        const members = await fetchGradeMembers(gradeId)
        setMembersByGrade((prev) => ({ ...prev, [gradeId]: members }))
      } catch (err) {
        toast.error(err instanceof Error ? err.message : "No se pudieron cargar los miembros")
      }
    }
  }

  const handleAddMember = async (gradeId: number) => {
    const email = newMemberEmails[gradeId]?.trim().toLowerCase()
    const role = newMemberRoles[gradeId] || "student"
    if (!email) return
    try {
      const created = await addGradeMember(gradeId, email, role)
      setMembersByGrade((prev) => ({
        ...prev,
        [gradeId]: [...(prev[gradeId] || []), created].sort((a, b) => a.email.localeCompare(b.email)),
      }))
      setNewMemberEmails((prev) => ({ ...prev, [gradeId]: "" }))
      toast.success("Miembro agregado")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo agregar el miembro")
    }
  }

  const handleRemoveMember = async (gradeId: number, memberId: number) => {
    if (!confirm("¿Quitar este miembro del grado?")) return
    try {
      await removeGradeMember(gradeId, memberId)
      setMembersByGrade((prev) => ({
        ...prev,
        [gradeId]: (prev[gradeId] || []).filter((m) => m.id !== memberId),
      }))
      toast.success("Miembro removido")
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "No se pudo remover el miembro")
    }
  }

  if (loading) {
    return <p className="text-sm text-gray-500">Cargando instituciones...</p>
  }

  return (
    <section className="rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
      <div className="mb-4">
        <h2 className="text-xl font-semibold text-gray-900">Instituciones y grados</h2>
        <p className="text-sm text-gray-500">Administrá las instituciones, sus grados y la asignación de docentes y alumnos por email.</p>
      </div>

      <div className="mb-6 flex gap-2">
        <Input
          placeholder="Nombre de la institución"
          value={newInstitutionName}
          onChange={(e) => setNewInstitutionName(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && handleCreateInstitution()}
        />
        <Button onClick={handleCreateInstitution}>
          <Plus className="mr-2 h-4 w-4" />
          Agregar
        </Button>
      </div>

      <div className="space-y-4">
        {institutions.length === 0 ? (
          <p className="text-sm text-gray-500">No hay instituciones cargadas.</p>
        ) : (
          institutions.map((institution) => (
            <Card key={institution.id}>
              <CardHeader className="pb-3">
                <div className="flex items-center justify-between">
                  <CardTitle className="text-base">{institution.name}</CardTitle>
                  <div className="flex items-center gap-2">
                    <Button variant="ghost" size="sm" onClick={() => toggleInstitution(institution.id)}>
                      {expandedInstitution === institution.id ? (
                        <ChevronUp className="h-4 w-4" />
                      ) : (
                        <ChevronDown className="h-4 w-4" />
                      )}
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      className="text-red-600 hover:bg-red-50 hover:text-red-700"
                      onClick={() => handleDeleteInstitution(institution.id)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              </CardHeader>
              {expandedInstitution === institution.id && (
                <CardContent className="pt-0">
                  <div className="mb-4 flex gap-2">
                    <Input
                      placeholder="Nombre del grado (ej: 1A)"
                      value={newGradeNames[institution.id] || ""}
                      onChange={(e) =>
                        setNewGradeNames((prev) => ({ ...prev, [institution.id]: e.target.value }))
                      }
                      onKeyDown={(e) => e.key === "Enter" && handleCreateGrade(institution.id)}
                    />
                    <Button onClick={() => handleCreateGrade(institution.id)}>
                      <Plus className="mr-2 h-4 w-4" />
                      Grado
                    </Button>
                  </div>

                  <div className="space-y-3">
                    {(gradesByInstitution[institution.id] || []).length === 0 ? (
                      <p className="text-sm text-gray-500">No hay grados en esta institución.</p>
                    ) : (
                      (gradesByInstitution[institution.id] || []).map((grade) => (
                        <Card key={grade.id} className="border-gray-100">
                          <CardHeader className="pb-2">
                            <div className="flex items-center justify-between">
                              <CardTitle className="text-sm font-medium">{grade.name}</CardTitle>
                              <div className="flex items-center gap-2">
                                <Button variant="ghost" size="sm" onClick={() => toggleGrade(grade.id)}>
                                  <Users className="mr-2 h-4 w-4" />
                                  Miembros
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-red-600 hover:bg-red-50 hover:text-red-700"
                                  onClick={() => handleDeleteGrade(institution.id, grade.id)}
                                >
                                  <Trash2 className="h-4 w-4" />
                                </Button>
                              </div>
                            </div>
                          </CardHeader>
                          {expandedGrade === grade.id && (
                            <CardContent className="pt-0">
                              <div className="mb-3 flex gap-2">
                                <Input
                                  placeholder="Email institucional"
                                  value={newMemberEmails[grade.id] || ""}
                                  onChange={(e) =>
                                    setNewMemberEmails((prev) => ({ ...prev, [grade.id]: e.target.value }))
                                  }
                                  onKeyDown={(e) => e.key === "Enter" && handleAddMember(grade.id)}
                                />
                                <Select
                                  value={newMemberRoles[grade.id] || "student"}
                                  onValueChange={(value) =>
                                    setNewMemberRoles((prev) => ({ ...prev, [grade.id]: value as "teacher" | "student" }))
                                  }
                                >
                                  <SelectTrigger className="w-32">
                                    <SelectValue />
                                  </SelectTrigger>
                                  <SelectContent>
                                    <SelectItem value="teacher">Docente</SelectItem>
                                    <SelectItem value="student">Alumno</SelectItem>
                                  </SelectContent>
                                </Select>
                                <Button onClick={() => handleAddMember(grade.id)}>
                                  <Plus className="h-4 w-4" />
                                </Button>
                              </div>

                              <div className="space-y-2">
                                {(membersByGrade[grade.id] || []).length === 0 ? (
                                  <p className="text-xs text-gray-500">No hay miembros asignados.</p>
                                ) : (
                                  (membersByGrade[grade.id] || []).map((member) => (
                                    <div
                                      key={member.id}
                                      className="flex items-center justify-between rounded-lg border border-gray-100 bg-gray-50 px-3 py-2 text-sm"
                                    >
                                      <div className="flex items-center gap-2">
                                        <span className="font-medium text-gray-900">{member.email}</span>
                                        <span className="text-xs text-gray-500">
                                          {member.role === "teacher" ? "Docente" : "Alumno"}
                                        </span>
                                        {member.user_id && (
                                          <span className="text-xs text-green-600">● vinculado</span>
                                        )}
                                      </div>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        className="h-7 w-7 p-0 text-red-600 hover:bg-red-50 hover:text-red-700"
                                        onClick={() => handleRemoveMember(grade.id, member.id)}
                                      >
                                        <Trash2 className="h-3 w-3" />
                                      </Button>
                                    </div>
                                  ))
                                )}
                              </div>
                            </CardContent>
                          )}
                        </Card>
                      ))
                    )}
                  </div>
                </CardContent>
              )}
            </Card>
          ))
        )}
      </div>
    </section>
  )
}
