import {
  SAMPLE_audit,
  SAMPLE_notifications,
  SAMPLE_requests,
  SAMPLE_users,
  SNAPSHOT,
  alerts,
  assets,
  daysLeft,
  lifecycleItems,
  lifecycleSeverity,
  roles,
  rules,
  summary,
  type ExpiryThresholds,
  type Severity,
} from "../seed"

export type { ExpiryThresholds, Severity }

export type AlertStatus =
  | "Baru"
  | "Diakui"
  | "Dalam Penanganan"
  | "Menunggu Review"
  | "Ditutup"

export interface Asset extends Omit<(typeof assets)[number], "status" | "location"> {
  status: "Online" | "Degraded" | "Offline" | "Nonaktif"
  /** Nama Host (backend) */
  location: string
  // Field dari backend SYNRA
  apiId?: string
  ipAddress?: string
  hostId?: string
  hostCode?: string
  category?: "HARDWARE" | "SOFTWARE" | null
  /** Tipe aset (mis. CPU, VM). Field `type` sudah dipakai untuk komponen. */
  assetType?: string | null
  userInput?: string | null
  dtimeInput?: string
  userUpdate?: string | null
  timeUpdate?: string | null
  supervisorInput?: string | null
  supervisorUpdate?: string | null
  picContact?: string
  isActive?: boolean
  backendStatus?: "ONLINE" | "WARNING" | "CRITICAL" | "STALE" | "INACTIVE"
  lastSeenAt?: string | null
  disks?: { mountPoint: string; value: number }[]
  uptimeMs?: number | null
  logErrors?: number | null
  openAlertCount?: number
}

export interface LifecycleItem {
  /** UUID backend */
  id: string
  /** Kode tampilan, mis. LIC-001 */
  code: string
  name: string
  type: (typeof lifecycleItems)[number]["category"]
  location: string
  pic: string
  status: string
  expiry: string
  quantity: number
  allocated: number
  note: string
  vendor?: string
  daysLeft?: number
  pendingRenewals?: number
}

export interface AlertItem {
  id: string
  name: string
  type: string
  location: string
  pic: string
  status: AlertStatus
  severity: Severity
  note: string
  createdAt: string
  // Field dari backend SYNRA
  apiId?: string
  detectedAt?: string
  hostname?: string
  component?: string
  recommendation?: string
  value?: number
  threshold?: number
  /** false bila kondisi sudah normal kembali tetapi alert belum ditutup */
  conditionActive?: boolean
  closeNote?: string | null
  /** Tingkat eskalasi yang sudah dikirim (0 = belum) */
  escalationLevel?: number
}

export interface RenewalRequest {
  /** UUID backend */
  id: string
  /** Kode tampilan, mis. REQ-001 */
  code: string
  itemId: string
  itemName: string
  requestedBy: string
  status: "Menunggu" | "Disetujui" | "Ditolak"
  createdAt: string
  note?: string | null
  decidedBy?: string | null
  decisionNote?: string | null
}

export interface NotificationItem {
  id: string
  alertId?: string
  title: string
  channel: string
  target: string
  time: string
  status: string
}

export interface AuditEntry {
  id: string
  time: string
  user: string
  role: string
  action: string
  target: string
  detail: string
}

export interface User {
  id: string
  name: string
  email: string
  password: string
  role: string
  status: "Aktif" | "Nonaktif"
  backendRole?: "ADMIN" | "SUPERVISOR" | "OPERATOR" | "MANAGEMENT" | "AUDITOR"
  isLocked?: boolean
}

export interface Rule {
  name: string
  value: number
  unit: string
  // Field dari backend SYNRA
  id?: string
  metric?: string
  severity?: string
  operator?: "GT" | "GTE"
  enabled?: boolean
}

export interface SynraState {
  assets: Asset[]
  lifecycle: LifecycleItem[]
  alerts: AlertItem[]
  requests: RenewalRequest[]
  notifications: NotificationItem[]
  audit: AuditEntry[]
  users: User[]
  rules: Rule[]
}

export function seedAll(): SynraState {
  return {
    assets: assets.map((asset) => ({ ...asset })),
    lifecycle: lifecycleItems.map((item) => ({
      ...item,
      code: item.id,
      type: item.category,
      quantity: item.quantity ?? 1,
      allocated: item.allocated ?? 0,
    })),
    alerts: alerts.map((alert) => ({
      ...alert,
      name: alert.title,
      createdAt: SNAPSHOT,
    })),
    requests: SAMPLE_requests.map((request) => ({
      id: request.id,
      code: request.id,
      itemId: request.itemId,
      itemName: request.title.replace(/^Perpanjangan /, ""),
      requestedBy: request.pic,
      status: "Menunggu",
      createdAt: SNAPSHOT,
    })),
    notifications: SAMPLE_notifications.map((notification) => ({
      id: notification.id,
      title: `Alert ${notification.alertId}`,
      channel: notification.channel,
      target: notification.recipient,
      time: SNAPSHOT,
      status: notification.status,
    })),
    audit: SAMPLE_audit.map((entry) => ({
      ...entry,
      user: entry.role,
      detail: entry.target,
    })),
    users: SAMPLE_users.map((user, index) => ({
      id: `USR-${String(index + 1).padStart(3, "0")}`,
      name: user.name,
      email: user.email,
      password: "",
      role: user.role,
      status: "Aktif",
    })),
    rules: rules.map((rule) => ({ ...rule })),
  }
}

export const daysUntil = daysLeft

export function forecastDays(
  capacity: number,
  used: number,
  growth: number,
  target = 1,
) {
  return growth > 0
    ? Math.max(0, Math.ceil((capacity * target - used) / growth))
    : null
}

export function diskSeverity(value: number): Severity {
  if (value >= 95) return "Critical"
  if (value >= 90) return "High"
  if (value >= 80) return "Medium"
  return "Normal"
}

export const healthDimensions = [
  { key: "Availability", weight: 20, score: 90 },
  { key: "Performance", weight: 15, score: 82 },
  { key: "Capacity", weight: 15, score: 76 },
  { key: "Database", weight: 15, score: 85 },
  { key: "Security", weight: 15, score: 80 },
  { key: "Backup", weight: 10, score: 72 },
  { key: "Lifecycle", weight: 10, score: 78 },
]

export function dashboardKpi() {
  return {
    healthScore: summary.healthScoreIllustrative,
    healthLabel: "Good",
    online: summary.online,
    totalAssets: summary.totalAssets,
    openAlerts: summary.openAlerts,
    critical: summary.criticalAlerts,
    expiring: summary.lifecycleCritical,
  }
}

export function utilizationSeries(period: "24 jam" | "7 hari" | "30 hari") {
  const count = period === "24 jam" ? 8 : period === "7 hari" ? 7 : 10
  const average = (key: "cpu" | "memory" | "disk") =>
    Math.round(assets.reduce((sum, asset) => sum + asset[key], 0) / assets.length)
  return Array.from({ length: count }, (_, index) => ({
    label:
      period === "24 jam"
        ? `${String(index * 3).padStart(2, "0")}:00`
        : period === "7 hari"
          ? `H-${count - index - 1}`
          : `${(index + 1) * 3} Okt`,
    cpu: Math.max(0, average("cpu") + ((index % 3) - 1) * 4),
    memory: Math.max(0, average("memory") + ((index % 4) - 2) * 3),
    disk: average("disk"),
  }))
}

export { lifecycleSeverity, roles }
export { DEFAULT_EXPIRY_THRESHOLDS } from "../seed"
