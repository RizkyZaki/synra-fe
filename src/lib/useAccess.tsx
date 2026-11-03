import { createContext, type ReactNode, useContext } from "react"
import { can, roleCapabilities, type Role } from "../seed"

export const NO_ACCESS_MESSAGE =
  "Anda tidak memiliki akses untuk tindakan ini"

export type SessionUser = {
  id: string
  name: string
  /** Backend memakai username; field ini dipertahankan untuk komponen yang menampilkan email. */
  email: string
  username: string
  /** Label role tampilan FE (mis. "Administrator") yang dipakai aturan akses di seed.ts */
  role: string
  backendRole: "ADMIN" | "OPERATOR" | "MANAGEMENT" | "AUDITOR"
  initials: string
}

interface AccessContextValue {
  user: SessionUser
  capabilities: (typeof roleCapabilities)[number]
  can: (action: "edit" | "approve" | "config") => boolean
}

const AccessContext = createContext<AccessContextValue | null>(null)

export function AccessProvider({
  user,
  children,
}: {
  user: SessionUser
  children: ReactNode
}) {
  const baseCapabilities =
    roleCapabilities.find((item) => item.role === user.role) ??
    roleCapabilities.find((item) => item.role === "Auditor")!
  // MANAGEMENT di backend bersifat read-only, jadi hak approve dari role "Manager" dicabut.
  const readOnlyManagement = user.backendRole === "MANAGEMENT"
  const capabilities = readOnlyManagement
    ? { ...baseCapabilities, approve: false, readOnly: true }
    : baseCapabilities

  return (
    <AccessContext.Provider
      value={{
        user,
        capabilities,
        can: (action) =>
          readOnlyManagement ? false : can(user.role as Role, action),
      }}
    >
      {children}
    </AccessContext.Provider>
  )
}

export function useAccess() {
  const context = useContext(AccessContext)
  if (!context) {
    throw new Error("useAccess harus digunakan di dalam AccessProvider")
  }
  return context
}

export function restrictedAction(allowed: boolean) {
  return allowed
    ? {}
    : {
        disabled: true,
        title: NO_ACCESS_MESSAGE,
      }
}
