// Tipe respons API backend SYNRA dan pemetaan ke model tampilan FE (synraDomain).
import type {
  AlertItem,
  AlertStatus,
  Asset,
  AuditEntry,
  NotificationItem,
  Rule,
  Severity,
  User,
} from "./synraDomain"

export type BackendRole = "ADMIN" | "SUPERVISOR" | "OPERATOR" | "MANAGEMENT" | "AUDITOR"
export type BackendSeverity = "INFO" | "LOW" | "MEDIUM" | "HIGH" | "CRITICAL"
export type BackendAlertStatus =
  | "NEW"
  | "ACKNOWLEDGED"
  | "IN_PROGRESS"
  | "PENDING_REVIEW"
  | "CLOSED"
export type RuleMetric = "CPU" | "MEMORY" | "DISK" | "HOST_STALE"

export interface Paginated<T> {
  data: T[]
  meta: { page: number; limit: number; total: number; totalPages: number }
}

export interface HostDto {
  id: string
  code: string
  name: string
  region: string | null
  assetCount: number
}

export type AssetCategory = "HARDWARE" | "SOFTWARE"

export interface UserRefDto {
  id: string
  fullName: string
}

export interface SupervisorDto extends UserRefDto {
  username: string
}

export interface AssetDto {
  id: string
  hostname: string
  ipAddress: string
  component: string
  host: { id: string; code: string; name: string }
  category: AssetCategory | null
  type: string | null
  picName: string
  picContact: string | null
  notes: string | null
  isActive: boolean
  isStale: boolean
  lastSeenAt: string | null
  status: "ONLINE" | "WARNING" | "CRITICAL" | "STALE" | "INACTIVE"
  latest: {
    cpu: number | null
    memory: number | null
    disk: number | null
    disks: { mountPoint: string; value: number }[]
    uptimeMs: number | null
    logErrors: number | null
    timestamp: string | null
  }
  openAlerts: { count: number; activeCount: number; maxSeverity: BackendSeverity | null }
  userInput: UserRefDto | null
  dtimeInput: string
  userUpdate: UserRefDto | null
  timeUpdate: string | null
  supervisorInput: UserRefDto | null
  supervisorUpdate: UserRefDto | null
}

export interface AlertDto {
  id: string
  code: string
  asset: {
    id: string
    hostname: string
    ipAddress: string
    component: string
    host: { id: string; code: string; name: string }
  }
  metric: RuleMetric
  label: string
  severity: BackendSeverity
  status: BackendAlertStatus
  problem: string
  value: number
  lastValue: number
  thresholdValue: number
  picName: string
  recommendation: string
  detectedAt: string
  conditionActive: boolean
  recoveredAt: string | null
  closedAt: string | null
  closeNote: string | null
}

export interface AlertEventDto {
  id: string
  action: string
  fromStatus: BackendAlertStatus | null
  toStatus: BackendAlertStatus
  note: string | null
  evidence: string | null
  actorUsername: string
  createdAt: string
}

export interface AlertDetailDto extends AlertDto {
  events: AlertEventDto[]
}

export interface UserDto {
  id: string
  username: string
  fullName: string
  role: BackendRole
  isActive: boolean
  isLocked: boolean
}

export interface ThresholdLevelDto {
  id: string
  metric: RuleMetric
  severity: BackendSeverity
  operator: "GT" | "GTE"
  value: number
  enabled: boolean
}

export interface ThresholdGroupDto {
  metric: RuleMetric
  unit: string
  levels: ThresholdLevelDto[]
}

export interface AuditDto {
  id: string
  action: string
  actorUsername: string
  entity: string | null
  entityId: string | null
  before: unknown
  after: unknown
  createdAt: string
}

export interface NotificationDto {
  id: string
  event: string
  channel: string
  status: "SENT" | "FAILED" | "SKIPPED"
  error: string | null
  createdAt: string
  alert: { number: number; severity: BackendSeverity; problem: string } | null
}

export interface SummaryDto {
  totalAssets: number
  online: number
  warning: number
  critical: number
  stale: number
  inactive: number
  openAlerts: number
  openAlertsBySeverity: Record<BackendSeverity, number>
  alertsByStatus: Record<BackendAlertStatus, number>
  assetsByComponent: { name: string; count: number }[]
  assetsByHost: { name: string; count: number }[]
  lastIngestAt: string | null
  lastIngestError: string | null
}

export interface AvailabilityDto {
  averagePct: number | null
  assets: {
    assetId: string
    hostname: string
    host: string
    component: string
    pct: number | null
  }[]
}

export interface UtilizationDto {
  bucketSeconds: number
  points: { t: string; cpu: number | null; memory: number | null; disk: number | null }[]
}

// ------------------------------------------------------------------ label

export const SEVERITY_TO_FE: Record<BackendSeverity, Severity> = {
  INFO: "Info",
  LOW: "Low",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
}

export const SEVERITY_TO_BE: Partial<Record<Severity, BackendSeverity>> = {
  Info: "INFO",
  Low: "LOW",
  Medium: "MEDIUM",
  High: "HIGH",
  Critical: "CRITICAL",
}

export const STATUS_TO_FE: Record<BackendAlertStatus, AlertStatus> = {
  NEW: "Baru",
  ACKNOWLEDGED: "Diakui",
  IN_PROGRESS: "Dalam Penanganan",
  PENDING_REVIEW: "Menunggu Review",
  CLOSED: "Ditutup",
}

export const ROLE_LABEL: Record<BackendRole, string> = {
  ADMIN: "Administrator",
  SUPERVISOR: "Supervisor",
  OPERATOR: "NOC",
  MANAGEMENT: "Manager",
  AUDITOR: "Auditor",
}

export const ROLE_OPTIONS: { value: BackendRole; label: string }[] = [
  { value: "ADMIN", label: "Administrator (ADMIN)" },
  { value: "SUPERVISOR", label: "Supervisor (SUPERVISOR)" },
  { value: "OPERATOR", label: "Operator / NOC (OPERATOR)" },
  { value: "MANAGEMENT", label: "Manajemen, read-only (MANAGEMENT)" },
  { value: "AUDITOR", label: "Auditor (AUDITOR)" },
]

const METRIC_LABEL: Record<RuleMetric, string> = {
  CPU: "CPU",
  MEMORY: "Memory",
  DISK: "Disk",
  HOST_STALE: "Host stale",
}

const AUDIT_LABEL: Record<string, string> = {
  LOGIN_SUCCESS: "Login berhasil",
  LOGIN_FAILED: "Login gagal",
  ACCOUNT_LOCKED: "Akun terkunci",
  PASSWORD_CHANGE: "Kata sandi diganti",
  THRESHOLD_UPDATE: "Threshold diubah",
  ALERT_STATUS_CHANGE: "Status alert diperbarui",
  ALERT_EVALUATE: "Evaluasi EWS",
  REPORT_EXPORT: "Ekspor",
  METRIC_IMPORT: "Impor metrik CSV",
  USER_CREATE: "Pengguna ditambahkan",
  USER_UPDATE: "Pengguna diperbarui",
  USER_UNLOCK: "Akun dibuka",
  USER_RESET_PASSWORD: "Reset kata sandi",
  ASSET_CREATE: "Aset ditambahkan",
  ASSET_UPDATE: "Data aset diperbarui",
  ASSET_DELETE: "Aset dihapus",
  HOST_CREATE: "Host ditambahkan",
  HOST_UPDATE: "Host diperbarui",
  HOST_DELETE: "Host dihapus",
}

export const ALERT_EVENT_LABEL: Record<string, string> = {
  CREATED: "Alert dibuat",
  ACKNOWLEDGED: "Alert diakui",
  STARTED: "Remediasi dimulai",
  SUBMITTED_REVIEW: "Diajukan untuk review",
  RETURNED: "Dikembalikan ke penanganan",
  CLOSED: "Alert ditutup",
  SEVERITY_RAISED: "Severity naik",
}

const NOTIF_STATUS: Record<NotificationDto["status"], string> = {
  SENT: "Terkirim",
  FAILED: "Gagal",
  SKIPPED: "Dilewati",
}

export function formatDateTime(iso: string | null): string {
  if (!iso) return "—"
  return new Intl.DateTimeFormat("id-ID", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(iso))
}

// ------------------------------------------------------------------ mapper

const ASSET_STATUS: Record<AssetDto["status"], Asset["status"]> = {
  ONLINE: "Online",
  WARNING: "Degraded",
  CRITICAL: "Degraded",
  STALE: "Offline",
  INACTIVE: "Nonaktif",
}

export function toAsset(a: AssetDto): Asset {
  return {
    id: a.hostname,
    apiId: a.id,
    name: a.hostname,
    type: a.component,
    location: a.host.name,
    pic: a.picName,
    status: ASSET_STATUS[a.status],
    severity: a.openAlerts.maxSeverity ? SEVERITY_TO_FE[a.openAlerts.maxSeverity] : "Normal",
    cpu: a.latest.cpu ?? 0,
    memory: a.latest.memory ?? 0,
    disk: a.latest.disk ?? 0,
    // Kapasitas dalam GB dan pertumbuhan tidak dikirim Metricbeat pilot; proyeksi ditampilkan "—".
    capacity: 0,
    used: 0,
    growth: 0,
    expiry: "",
    note: a.notes ?? "",
    ipAddress: a.ipAddress,
    hostId: a.host.id,
    hostCode: a.host.code,
    category: a.category,
    assetType: a.type,
    userInput: a.userInput?.fullName ?? null,
    dtimeInput: a.dtimeInput,
    userUpdate: a.userUpdate?.fullName ?? null,
    timeUpdate: a.timeUpdate,
    supervisorInput: a.supervisorInput?.fullName ?? null,
    supervisorUpdate: a.supervisorUpdate?.fullName ?? null,
    picContact: a.picContact ?? "",
    isActive: a.isActive,
    backendStatus: a.status,
    lastSeenAt: a.lastSeenAt,
    disks: a.latest.disks,
    uptimeMs: a.latest.uptimeMs,
    logErrors: a.latest.logErrors,
    openAlertCount: a.openAlerts.count,
  }
}

export function toAlert(a: AlertDto): AlertItem {
  return {
    id: a.code,
    apiId: a.id,
    name: a.problem,
    type: METRIC_LABEL[a.metric],
    location: a.asset.host.name,
    pic: a.picName,
    status: STATUS_TO_FE[a.status],
    severity: SEVERITY_TO_FE[a.severity],
    note: `${a.asset.hostname} • ${a.recommendation}`,
    createdAt: formatDateTime(a.detectedAt),
    detectedAt: a.detectedAt,
    hostname: a.asset.hostname,
    component: a.asset.component,
    recommendation: a.recommendation,
    value: a.lastValue,
    threshold: a.thresholdValue,
    conditionActive: a.conditionActive,
    closeNote: a.closeNote,
  }
}

export function toUser(u: UserDto): User {
  return {
    id: u.id,
    name: u.fullName,
    email: u.username,
    password: "",
    role: ROLE_LABEL[u.role],
    status: u.isActive ? "Aktif" : "Nonaktif",
    backendRole: u.role,
    isLocked: u.isLocked,
  }
}

const SEVERITY_LABEL: Record<BackendSeverity, string> = {
  INFO: "Info",
  LOW: "Warning",
  MEDIUM: "Medium",
  HIGH: "High",
  CRITICAL: "Critical",
}

/** Satu baris parameter per level threshold, mis. "Disk · Critical (≥)". */
export function toRules(groups: ThresholdGroupDto[]): Rule[] {
  return groups.flatMap((g) =>
    g.levels.map((l) => ({
      id: l.id,
      metric: g.metric,
      name: `${METRIC_LABEL[g.metric]} · ${SEVERITY_LABEL[l.severity]} (${l.operator === "GT" ? ">" : "≥"})`,
      value: l.value,
      unit: g.unit,
      enabled: l.enabled,
    })),
  )
}

function summarize(v: unknown): string {
  if (v === null || v === undefined) return ""
  if (typeof v !== "object") return String(v)
  if (Array.isArray(v)) {
    return v
      .map((item) =>
        typeof item === "object" && item && "severity" in item && "value" in item
          ? `${(item as { severity: string }).severity} ${(item as { value: number }).value}`
          : summarize(item),
      )
      .join(", ")
  }
  return Object.entries(v as Record<string, unknown>)
    .filter(([, val]) => val !== null && val !== undefined && typeof val !== "object")
    .map(([k, val]) => `${k}: ${val}`)
    .join(" · ")
}

const LOGIN_REASON: Record<string, string> = {
  WRONG_PASSWORD: "Password salah",
  USER_NOT_FOUND: "Username tidak terdaftar",
  ACCOUNT_LOCKED: "Akun sedang terkunci",
  ACCOUNT_INACTIVE: "Akun nonaktif",
}

/** Target dan detail audit dalam kalimat singkat; field id internal tidak ditampilkan. */
function describeAudit(a: AuditDto): { target: string; detail: string } {
  const before = (a.before ?? {}) as Record<string, unknown>
  const after = (a.after ?? {}) as Record<string, unknown>
  const str = (v: unknown) => (v === null || v === undefined ? "" : String(v))
  const status = (v: unknown) => STATUS_TO_FE[v as BackendAlertStatus] ?? str(v)
  const join = (...parts: string[]) => parts.filter(Boolean).join(" · ") || "—"

  switch (a.action) {
    case "LOGIN_SUCCESS":
    case "LOGIN_FAILED":
      return { target: a.actorUsername, detail: LOGIN_REASON[str(after.reason)] ?? "—" }
    case "ACCOUNT_LOCKED":
      return { target: a.actorUsername, detail: `Terkunci sampai ${formatDateTime(str(after.lockedUntil))}` }
    case "ALERT_STATUS_CHANGE":
      return {
        target: str(after.code) || "Alert",
        detail: join(
          `${status(before.status)} → ${status(after.status)}`,
          str(after.note),
          after.evidence ? `Bukti: ${str(after.evidence)}` : "",
        ),
      }
    case "ALERT_EVALUATE":
      return {
        target: "Semua aset",
        detail: join(`${str(after.created)} alert baru`, `${str(after.findings)} temuan`, `${str(after.staleAssets)} host stale`),
      }
    case "THRESHOLD_UPDATE":
      return { target: a.entityId ?? "Threshold", detail: `${summarize(a.before)} → ${summarize(a.after)}` }
    case "REPORT_EXPORT":
      return after.type === "AUDIT_LOG"
        ? { target: "Audit log", detail: join(`CSV`, `${str(after.rows)} baris`) }
        : {
            target: `Laporan harian ${str(after.date)}`,
            detail: join(str(after.format).toUpperCase(), after.host ?? after.bpd ? str(after.host ?? after.bpd) : "Semua Host"),
          }
    case "METRIC_IMPORT":
      return {
        target: str(after.fileName) || "CSV",
        detail: join(`${str(after.inserted)} baris masuk`, `${str(after.invalidRows)} tidak valid`),
      }
    case "ASSET_CREATE":
    case "ASSET_UPDATE":
    case "ASSET_DELETE": {
      const v = Object.keys(after).length ? after : before
      return { target: str(v.hostname) || "Aset", detail: join(str(v.ipAddress), str(v.component), str(v.picName)) }
    }
    case "USER_CREATE":
    case "USER_UPDATE": {
      const changed = Object.keys(after).filter((k) => JSON.stringify(after[k]) !== JSON.stringify(before[k]))
      return {
        target: str(after.username),
        detail:
          a.action === "USER_CREATE"
            ? join(str(after.fullName), str(after.role))
            : join(...changed.map((k) => `${k}: ${str(before[k])} → ${str(after[k])}`)),
      }
    }
    default: {
      const b = summarize(a.before)
      const t = summarize(a.after)
      return { target: a.entity ?? "—", detail: b && t ? `${b} → ${t}` : t || b || "—" }
    }
  }
}

export function toAudit(a: AuditDto): AuditEntry {
  const { target, detail } = describeAudit(a)
  return {
    id: a.id,
    time: a.createdAt,
    user: a.actorUsername,
    role: a.entity ?? "—",
    action: AUDIT_LABEL[a.action] ?? a.action,
    target,
    detail,
  }
}

export function toNotification(n: NotificationDto): NotificationItem {
  return {
    id: n.id.slice(0, 8).toUpperCase(),
    title: n.alert
      ? `ALT-${String(n.alert.number).padStart(3, "0")} · ${ALERT_EVENT_LABEL[n.event] ?? n.event}`
      : "Pesan uji Telegram",
    channel: n.channel === "TELEGRAM" ? "Telegram" : n.channel,
    target: n.alert ? n.alert.problem : "Chat Telegram",
    time: formatDateTime(n.createdAt),
    status: NOTIF_STATUS[n.status],
  }
}
