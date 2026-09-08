// Paleta por etapa extraída del diseño de referencia (caliopeeducativo.netlify.app)

export interface StageTheme {
  color: string
  bg: string
  barBg: string
  border: string
  kind: "Escribiendo" | "Revisando"
}

const ESCRIBIENDO: StageTheme = {
  color: "#1d4ed8",
  bg: "#e6edfd",
  barBg: "#f4f7fe",
  border: "#d5e0fa",
  kind: "Escribiendo",
}

const REVISANDO: StageTheme = {
  color: "#7a3fa6",
  bg: "#f0e9f9",
  barBg: "#f8f4fc",
  border: "#e4d8f0",
  kind: "Revisando",
}

export function stageTheme(index: number): StageTheme {
  return index === 0 ? ESCRIBIENDO : REVISANDO
}

export type ParticipantStatus = "sin_empezar" | "escribiendo" | "revisando" | "entregada"

export const STATUS_THEME: Record<ParticipantStatus, { color: string; bg: string; label: string }> = {
  sin_empezar: { color: "#71717a", bg: "#f0f0f2", label: "Sin empezar" },
  escribiendo: { color: "#1d4ed8", bg: "#e6edfd", label: "Escribiendo" },
  revisando: { color: "#7a3fa6", bg: "#f0e9f9", label: "Revisando" },
  entregada: { color: "#1f7a4d", bg: "#e6f6ed", label: "Entregada" },
}
