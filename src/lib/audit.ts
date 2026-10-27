import type { AuditEntry, User } from "./synraDomain"

export function createAuditEntry(
  entries: AuditEntry[],
  user: Pick<User, "name" | "role">,
  action: string,
  target: string,
  detail: string,
): AuditEntry {
  const nextNumber =
    Math.max(
      0,
      ...entries.map((entry) => Number(entry.id.replace(/\D/g, "")) || 0),
    ) + 1

  return {
    id: `AUD-${String(nextNumber).padStart(3, "0")}`,
    time: new Date().toISOString(),
    user: user.name,
    role: user.role,
    action,
    target,
    detail,
  }
}
