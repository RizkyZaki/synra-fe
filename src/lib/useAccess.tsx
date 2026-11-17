import { createContext, type ReactNode, useContext, useMemo } from "react"
import { ADMIN_ROLE_CODE, isReadOnly, MENU_PERMISSION, type Permission } from "./permissions"

export const NO_ACCESS_MESSAGE =
  "Anda tidak memiliki akses untuk tindakan ini"

export type SessionUser = {
  id: string
  name: string
  /** Backend memakai username; field ini dipertahankan untuk komponen yang menampilkan email. */
  email: string
  username: string
  /** Nama role untuk tampilan, mis. "Supervisor Jatim" */
  role: string
  roleId: string
  roleCode: string
  /** Hak akses efektif dari backend (ADMIN = semua) */
  permissions: string[]
  initials: string
}

interface AccessContextValue {
  user: SessionUser
  /** Benar bila role punya hak akses ini */
  can: (permission: Permission) => boolean
  /** Benar bila role punya salah satu hak akses ini */
  canAny: (...permissions: Permission[]) => boolean
  canOpen: (menuLabel: string) => boolean
  /** Role tanpa hak tulis apa pun */
  readOnly: boolean
}

const AccessContext = createContext<AccessContextValue | null>(null)

export function accessFor(user: SessionUser): Omit<AccessContextValue, "user"> {
  const granted = new Set(user.permissions)
  const can = (permission: Permission) => user.roleCode === ADMIN_ROLE_CODE || granted.has(permission)
  const canAny = (...permissions: Permission[]) => permissions.some(can)
  return {
    can,
    canAny,
    canOpen: (label) => {
      const required = MENU_PERMISSION[label]
      return !required || canAny(...required)
    },
    readOnly: user.roleCode !== ADMIN_ROLE_CODE && isReadOnly(user.permissions),
  }
}

export function AccessProvider({
  user,
  children,
}: {
  user: SessionUser
  children: ReactNode
}) {
  const value = useMemo(() => ({ user, ...accessFor(user) }), [user])
  return <AccessContext.Provider value={value}>{children}</AccessContext.Provider>
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
