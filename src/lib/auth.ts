import { apiFetch, SESSION_EVENT, tokenStore } from "./api"
import type { SessionUser } from "./useAccess"

export type BackendRole = "ADMIN" | "OPERATOR" | "MANAGEMENT" | "AUDITOR"

interface BackendUser {
  id: string
  username: string
  fullName: string
  role: BackendRole
}

interface LoginResponse {
  accessToken: string
  user: BackendUser
}

// Role backend dipetakan ke role tampilan FE agar aturan akses di seed.ts tetap dipakai.
// MANAGEMENT memakai "Manager" (read-only + ringkasan eksekutif); hak approve dicabut di AccessProvider.
const ROLE_LABEL: Record<BackendRole, string> = {
  ADMIN: "Administrator",
  OPERATOR: "NOC",
  MANAGEMENT: "Manager",
  AUDITOR: "Auditor",
}

function toSessionUser(user: BackendUser): SessionUser {
  return {
    id: user.id,
    name: user.fullName,
    email: user.username,
    username: user.username,
    role: ROLE_LABEL[user.role],
    backendRole: user.role,
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

export function logout() {
  tokenStore.clear()
  window.dispatchEvent(new Event(SESSION_EVENT))
}
