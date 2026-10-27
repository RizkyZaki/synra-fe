import { createContext, type ReactNode, useContext } from "react"
import { can, roleCapabilities, type Role } from "../seed"

export const NO_ACCESS_MESSAGE =
  "Anda tidak memiliki akses untuk tindakan ini"

export type SessionUser = {
  name: string
  email: string
  role: string
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
  const capabilities =
    roleCapabilities.find((item) => item.role === user.role) ??
    roleCapabilities.find((item) => item.role === "Auditor")!

  return (
    <AccessContext.Provider
      value={{
        user,
        capabilities,
        can: (action) => can(user.role as Role, action),
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
