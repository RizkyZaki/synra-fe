/**
 * Kunci hak akses, sama dengan katalog di backend (synra-be/src/common/permissions.ts).
 * Label dan deskripsi untuk form role diambil dari GET /roles/permissions.
 */
export type Permission =
  | "alerts.view"
  | "notifications.view"
  | "monitoring.view"
  | "backup.view"
  | "assets.view"
  | "lifecycle.view"
  | "reports.view"
  | "audit.view"
  | "dashboard.executive"
  | "alerts.handle"
  | "alerts.review"
  | "alerts.evaluate"
  | "escalation.manage"
  | "notifications.test"
  | "ingestion.manage"
  | "security.view"
  | "assets.manage"
  | "assets.supervise"
  | "lifecycle.request"
  | "lifecycle.manage"
  | "lifecycle.delete"
  | "thresholds.manage"
  | "users.manage"
  | "roles.manage"

export const ADMIN_ROLE_CODE = "ADMIN"

/** Hak yang hanya membuka tampilan; role tanpa hak lain ditandai "Akses baca saja". */
const VIEW_ONLY = new Set<Permission>([
  "alerts.view",
  "notifications.view",
  "monitoring.view",
  "backup.view",
  "assets.view",
  "lifecycle.view",
  "reports.view",
  "audit.view",
  "dashboard.executive",
  "security.view",
])

export const isReadOnly = (permissions: readonly string[]) =>
  permissions.every((p) => VIEW_ONLY.has(p as Permission))

/** Hak akses yang dibutuhkan untuk membuka menu. Menu yang tidak disebut terbuka untuk semua. */
export const MENU_PERMISSION: Record<string, Permission[]> = {
  "Alert & Insiden": ["alerts.view"],
  "Notifikasi & Eskalasi": ["notifications.view"],
  Infrastruktur: ["monitoring.view"],
  Database: ["monitoring.view"],
  "Storage & Kapasitas": ["monitoring.view"],
  "Availability & Performa": ["monitoring.view"],
  "Backup & Keamanan": ["backup.view"],
  "Inventaris Aset": ["assets.view"],
  "Lifecycle OS": ["lifecycle.view"],
  "Lisensi Software": ["lifecycle.view"],
  "Sertifikat SSL/TLS": ["lifecycle.view"],
  "Garansi Hardware": ["lifecycle.view"],
  "Kontrak Vendor": ["lifecycle.view"],
  Laporan: ["reports.view"],
  "Audit Trail": ["audit.view"],
  Administrasi: ["thresholds.manage", "users.manage", "roles.manage"],
}

export interface PermissionGroup {
  group: string
  items: { key: Permission; label: string; description: string }[]
}
