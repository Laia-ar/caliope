import { buildBackendUrl } from "./backend"

export interface AuthUser {
  id: number
  username: string
  email: string
  name: string
  can_create_sessions: boolean
  can_create_prompts: boolean
  can_create_invites: boolean
  is_admin: boolean
  is_teacher: boolean
}

export async function fetchAuthUser(): Promise<AuthUser | null> {
  try {
    const response = await fetch(buildBackendUrl("/api/check-auth"), {
      credentials: "include",
    })
    if (!response.ok) return null
    const data = await response.json()
    return {
      id: Number(data.id),
      username: String(data.username ?? ""),
      email: String(data.email ?? ""),
      name: String(data.name ?? ""),
      can_create_sessions: data.can_create_sessions === true,
      can_create_prompts: data.can_create_prompts === true,
      can_create_invites: data.can_create_invites === true,
      is_admin: data.is_admin === true,
      is_teacher: data.is_teacher === true,
    }
  } catch {
    return null
  }
}
