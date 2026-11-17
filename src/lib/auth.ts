import { apiFetch, SESSION_EVENT, tokenStore } from "./api"
import type { SessionUser } from "./useAccess"

export interface RoleRef {
  id: string
  code: string
  name: string
}

interface BackendUser {
  id: string
  username: string
  fullName: string
  role: RoleRef
  permissions: string[]
}

interface LoginResponse {
  accessToken: string
  user: BackendUser
}

function toSessionUser(user: BackendUser): SessionUser {
  return {
    id: user.id,
    name: user.fullName,
    email: user.username,
    username: user.username,
    role: user.role.name,
    roleId: user.role.id,
    roleCode: user.role.code,
    permissions: user.permissions,
    initials: user.fullName
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((word) => word[0]!.toUpperCase())
      .join(""),
  }
}

export async function login(
  username: string,
  password: string,
): Promise<SessionUser> {
  const result = await apiFetch<LoginResponse>("/auth/login", {
    method: "POST",
    body: JSON.stringify({ username, password }),
  })
  tokenStore.set(result.accessToken)
  window.dispatchEvent(new Event(SESSION_EVENT))
  return toSessionUser(result.user)
}

/** Memulihkan sesi dari token tersimpan. Mengembalikan null bila tidak ada token. */
export async function restoreSession(): Promise<SessionUser | null> {
  if (!tokenStore.get()) return null
  try {
    return toSessionUser(await apiFetch<BackendUser>("/auth/me"))
  } catch {
    tokenStore.clear()
    return null
  }
}

/** Dipicu setelah role atau hak akses diubah, supaya menu dan tombol user yang login ikut diperbarui. */
export const ACCESS_CHANGED_EVENT = "synra:access-changed"

/** Membaca ulang role dan hak akses user yang sedang login (mis. setelah admin mengubah role). */
export async function fetchSessionUser(): Promise<SessionUser> {
  return toSessionUser(await apiFetch<BackendUser>("/auth/me"))
}

export function logout() {
  tokenStore.clear()
  window.dispatchEvent(new Event(SESSION_EVENT))
}
