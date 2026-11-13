export const SNAPSHOT = "2026-10-16T08:30:00+07:00"
const TODAY = Date.UTC(2026, 9, 16)

export type Severity = "Normal" | "Info" | "Low" | "Medium" | "High" | "Critical" | "Expired"

export interface Asset {
  id: string
  name: string
  type: string
  location: "DC Serpong" | "DRC Surabaya" | "Cloud"
  pic: string
  status: "Online" | "Degraded" | "Offline"
  severity: Severity
  cpu: number
  memory: number
  disk: number
  capacity: number
  used: number
  growth: number // GB, GB, GB/hari
  expiry: string
  note: string
}
export interface LifecycleItem {
  id: string
  name: string
  category: "os" | "licenses" | "certificates" | "warranty" | "contracts"
  location: string
  pic: string
  status: string
  expiry: string
  quantity?: number
  allocated?: number
  note: string
}
export interface Alert {
  id: string
  title: string
  type: string
  location: string
  pic: string
  status: "Baru" | "Diakui" | "Dalam Penanganan" | "Menunggu Review" | "Ditutup"
  severity: Severity
  note: string
}

const NOTE = ""
const sev = (d: number): Severity =>
  d >= 95 ? "Critical" : d >= 90 ? "High" : d >= 80 ? "Medium" : "Normal"
const mk = (
  id: string,
  name: string,
  type: string,
  location: Asset["location"],
  cpu: number,
  memory: number,
  disk: number,
  x: Partial<Asset> = {},
): Asset => ({
  id,
  name,
  type,
  location,
  pic: type === "Database" ? "Tim DBA" : "Tim Infrastruktur",
  status: "Online",
  severity: sev(disk),
  cpu,
  memory,
  disk,
  capacity: 1000,
  used: disk * 10,
  growth: 12,
  expiry: "2027-05-31",
  note: NOTE,
  ...x,
})

export const assets: Asset[] = [
  mk("AST-001", "CBS-DB-PROD01", "Database", "DC Serpong", 64, 82, 92.7, {
    used: 927,
    expiry: "2029-05-31",
    note: "IBM Db2 11.5 • CBS_DATA • RHEL 8.8 • patch 2026-08",
  }),
  mk("AST-002", "APP-MOBILE-01", "Server", "DC Serpong", 81, 87, 76, {
    note: "Mobile Banking • Ubuntu 22.04 • patch 2026-09",
  }),
  mk("AST-003", "SAN-STORAGE-01", "Storage", "DC Serpong", 22, 42, 84, {
    capacity: 20000,
    used: 16800,
    growth: 23.33,
    note: "SAN primary • growth 0,7 TB/bulan",
  }),
  mk("AST-004", "CBS-DB-DRC01", "Database", "DRC Surabaya", 28, 61, 63, {
    note: "IBM Db2 11.5 • replication lag 3 detik",
  }),
  mk("AST-005", "FW-PERIMETER-01", "Network", "DC Serpong", 34, 45, 31),
  mk("AST-006", "BACKUP-MASTER01", "Backup", "DRC Surabaya", 43, 67, 89, {
    status: "Degraded",
    severity: "High",
    note: "Backup terakhir gagal • last success 14 Oktober 2026 23:00",
  }),
  mk("AST-007", "API-GATEWAY-01", "Application", "DC Serpong", 52, 69, 58, {
    note: "Response 240 ms • uptime 99,98%",
  }),
  mk("AST-008", "VM-WIN-LEGACY", "Server", "DRC Surabaya", 22, 56, 71, {
    expiry: "2026-11-10",
    note: "Windows Server • verifikasi tanggal dukungan vendor sebelum produksi",
  }),
  mk("AST-009", "LB-PROD01", "Network", "DC Serpong", 18, 28, 22),
  mk("AST-010", "EDR-CONSOLE01", "Security", "DC Serpong", 35, 51, 48, {
    status: "Offline",
    severity: "Critical",
    note: "Agent tidak terhubung sejak 08:10",
  }),
]

const lic = (
  i: number,
  name: string,
  q: number,
  a: number,
  expiry: string,
): LifecycleItem => ({
  id: "LIC-00" + i,
  name,
  category: "licenses",
  location: "DC Serpong",
  pic: "Tim Asset Management",
  status: "Aktif",
  expiry,
  quantity: q,
  allocated: a,
  note: NOTE,
})
export const lifecycleItems: LifecycleItem[] = [
  lic(1, "VMware Enterprise", 20, 20, "2026-11-01"),
  lic(2, "Oracle Database", 8, 8, "2026-12-30"),
  lic(3, "Red Hat Subscription", 40, 38, "2027-01-15"),
  lic(4, "Antivirus Enterprise", 1000, 985, "2026-12-31"),
  {
    id: "CRT-001",
    name: "SSL API Banking",
    category: "certificates",
    location: "DC Serpong",
    pic: "Tim Security",
    status: "Aktif",
    expiry: "2026-10-27",
    note: NOTE,
  },
  {
    id: "WAR-001",
    name: "Garansi SAN Primary",
    category: "warranty",
    location: "DC Serpong",
    pic: "Tim Infrastruktur",
    status: "Aktif",
    expiry: "2027-02-01",
    note: NOTE,
  },
  {
    id: "CON-001",
    name: "Kontrak Pemeliharaan DC",
    category: "contracts",
    location: "DC Serpong",
    pic: "Vendor Demo Nusantara",
    status: "Aktif",
    expiry: "2026-12-01",
    note: NOTE,
  },
]

export const alerts: Alert[] = [
  {
    id: "ALT-001",
    title: "Tablespace CBS_DATA mendekati penuh",
    type: "Database",
    location: "DC Serpong",
    pic: "Tim DBA",
    status: "Baru",
    severity: "Critical",
    note: "CBS-DB-PROD01 • 92,7% • prediksi penuh 7 hari. Segera extend tablespace.",
  },
  {
    id: "ALT-002",
    title: "Memory melewati threshold 85%",
    type: "Server",
    location: "DC Serpong",
    pic: "Tim Infrastruktur",
    status: "Diakui",
    severity: "High",
    note: "APP-MOBILE-01 • Periksa proses dan memory leak.",
  },
  {
    id: "ALT-003",
    title: "Perpanjangan VMware H-16",
    type: "Lisensi",
    location: "DC Serpong",
    pic: "Tim Asset Management",
    status: "Baru",
    severity: "High",
    note: "Siapkan pengajuan perpanjangan lisensi.",
  },
  {
    id: "ALT-004",
    title: "Backup terjadwal gagal",
    type: "Backup",
    location: "DRC Surabaya",
    pic: "Tim Infrastruktur",
    status: "Dalam Penanganan",
    severity: "Critical",
    note: "Periksa log job dan ulangi backup, kemudian validasi restore.",
  },
]

export const rules = [
  { name: "CPU", value: 80, unit: "%" },
  { name: "Memory", value: 85, unit: "%" },
  { name: "Disk EWS", value: 80, unit: "%" },
  { name: "DB Tablespace", value: 85, unit: "%" },
  { name: "Backup gagal", value: 1, unit: "kejadian" },
  { name: "Replication lag", value: 30, unit: "detik" },
  { name: "License expiry", value: 90, unit: "hari" },
  { name: "Certificate expiry", value: 30, unit: "hari" },
  { name: "OS EOL", value: 180, unit: "hari" },
  { name: "Service down", value: 5, unit: "menit" },
  { name: "Capacity forecast", value: 30, unit: "hari" },
  { name: "DB Growth abnormal", value: 150, unit: "% baseline" },
]

export const slaMatrix = [
  { severity: "Info", response: "Dashboard", recipient: "Dashboard" },
  { severity: "Low", response: "24 jam", recipient: "Engineer" },
  { severity: "Medium", response: "8 jam", recipient: "Supervisor" },
  { severity: "High", response: "2 jam", recipient: "Department head" },
  {
    severity: "Critical",
    response: "15 menit",
    recipient: "Division head / manajemen",
  },
]
export const criticalEscalationMinutes = [15, 30, 60, 120]

export const roles = [
  "Administrator",
  "NOC",
  "Server Admin",
  "DBA",
  "Network Admin",
  "Security",
  "Asset Management",
  "Supervisor",
  "Manager",
  "Division Head",
  "Auditor",
]
export const navigation = [
  { label: "Pusat Kendali", path: "/" },
  { label: "Inventaris Aset", path: "/assets" },
  {
    label: "Monitor",
    children: [
      "Infrastruktur",
      "Database",
      "Storage & Kapasitas",
      "Availability & Performa",
      "Backup & Keamanan",
    ],
  },
  {
    label: "Lifecycle",
    children: [
      "Lifecycle OS",
      "Lisensi Software",
      "Sertifikat SSL/TLS",
      "Garansi Hardware",
      "Kontrak Vendor",
    ],
  },
  { label: "Operasi", children: ["Alert & Insiden", "Notifikasi & Eskalasi"] },
  {
    label: "Tata Kelola",
    children: ["Laporan", "Audit Trail", "Administrasi"],
  },
]
export const integrations = [
  "Zabbix",
  "Grafana",
  "SIEM",
  "CMDB",
  "Service Desk",
  "SSO AD/LDAP",
].map((name) => ({ name, status: "Belum terhubung" }))

// ---------- turunan (dihitung) ----------
export const daysLeft = (iso: string) =>
  Math.round(
    (Date.UTC(+iso.slice(0, 4), +iso.slice(5, 7) - 1, +iso.slice(8, 10)) -
      TODAY) /
      864e5,
  )
/** Batas sisa hari (inklusif) per level urgensi siklus hidup. Nilai aktif diatur admin di backend. */
export type ExpiryThresholds = { CRITICAL: number; HIGH: number; MEDIUM: number; LOW: number }

export const DEFAULT_EXPIRY_THRESHOLDS: ExpiryThresholds = { CRITICAL: 30, HIGH: 90, MEDIUM: 180, LOW: 365 }

export const lifecycleSeverity = (d: number, t: ExpiryThresholds = DEFAULT_EXPIRY_THRESHOLDS): Severity =>
  d < 0
    ? "Expired"
    : d <= t.CRITICAL
      ? "Critical"
      : d <= t.HIGH
        ? "High"
        : d <= t.MEDIUM
          ? "Medium"
          : d <= t.LOW
            ? "Low"
            : "Info"
// target: 0.9 / 0.95 / 1 -> hari sampai tercapai (min 0), null jika growth 0
export const daysToTarget = (
  a: Pick<Asset, "capacity" | "used" | "growth">,
  target: number,
) =>
  a.growth > 0
    ? Math.max(0, Math.ceil((a.capacity * target - a.used) / a.growth))
    : null

// OS lifecycle: aset yang memiliki tanggal dukungan
export const osLifecycle = assets
  .filter((a) => ["AST-001", "AST-002", "AST-008"].includes(a.id))
  .map((a) => ({
    id: a.id,
    name: a.name,
    expiry: a.expiry,
    note: a.note,
    daysLeft: daysLeft(a.expiry),
    severity: lifecycleSeverity(daysLeft(a.expiry)),
  }))

export const lifecycleWithSeverity = lifecycleItems.map((i) => ({
  ...i,
  daysLeft: daysLeft(i.expiry),
  severity: lifecycleSeverity(daysLeft(i.expiry)),
}))
export const capacityForecast = assets.map((a) => ({
  id: a.id,
  name: a.name,
  growthPerDay: a.growth,
  d90: daysToTarget(a, 0.9),
  d95: daysToTarget(a, 0.95),
  d100: daysToTarget(a, 1),
}))

const within90 = [
  ...lifecycleWithSeverity,
  ...osLifecycle.filter((o) => o.id === "AST-008"),
].filter((i) => i.daysLeft >= 0 && i.daysLeft <= 90)
export const summary = {
  totalAssets: assets.length,
  online: assets.filter((a) => a.status === "Online").length,
  degraded: assets.filter((a) => a.status === "Degraded").length,
  offline: assets.filter((a) => a.status === "Offline").length,
  openAlerts: alerts.filter((a) => a.status !== "Ditutup").length,
  criticalAlerts: alerts.filter(
    (a) => a.severity === "Critical" && a.status !== "Ditutup",
  ).length,
  lifecycleWithin90: within90.length,
  lifecycleCritical: within90.filter((i) => i.severity === "Critical").length,
  healthScoreIllustrative: 87, // ilustrasi, bukan agregasi telemetri
}

// ---------- SAMPLE_* : hanya untuk desain (di proyek asli kosong saat awal) ----------
export const SAMPLE_requests = [
  {
    id: "REQ-001",
    itemId: "LIC-001",
    title: "Perpanjangan VMware Enterprise",
    pic: "Tim Asset Management",
    status: "Menunggu persetujuan",
  },
  {
    id: "REQ-002",
    itemId: "CRT-001",
    title: "Perpanjangan SSL API Banking",
    pic: "Tim Security",
    status: "Menunggu persetujuan",
  },
]
export const SAMPLE_notifications = [
  {
    id: "NTF-001",
    alertId: "ALT-001",
    channel: "Email",
    recipient: "Division head / manajemen",
    status: "Antre",
  },
  {
    id: "NTF-002",
    alertId: "ALT-004",
    channel: "Chat",
    recipient: "Division head / manajemen",
    status: "Antre",
  },
  {
    id: "NTF-003",
    alertId: "ALT-002",
    channel: "Email",
    recipient: "Department head",
    status: "Antre",
  },
]
export const SAMPLE_audit = [
  {
    id: "AUD-001",
    time: "2026-10-16 08:31",
    role: "Administrator",
    action: "Evaluasi EWS",
    target: "12 indikator",
  },
  {
    id: "AUD-002",
    time: "2026-10-16 08:35",
    role: "NOC",
    action: "Acknowledge alert",
    target: "ALT-002",
  },
  {
    id: "AUD-003",
    time: "2026-10-16 08:42",
    role: "Administrator",
    action: "Ubah parameter EWS",
    target: "Memory 85%",
  },
  {
    id: "AUD-004",
    time: "2026-10-16 08:50",
    role: "DBA",
    action: "Mulai remediasi",
    target: "ALT-004",
  },
  {
    id: "AUD-005",
    time: "2026-10-16 09:02",
    role: "Asset Management",
    action: "Ajukan perpanjangan",
    target: "LIC-001",
  },
  {
    id: "AUD-006",
    time: "2026-10-16 09:10",
    role: "Security",
    action: "Ajukan perpanjangan",
    target: "CRT-001",
  },
  {
    id: "AUD-007",
    time: "2026-10-16 09:18",
    role: "Administrator",
    action: "Tambah aset",
    target: "AST-010",
  },
  {
    id: "AUD-008",
    time: "2026-10-16 09:25",
    role: "Auditor",
    action: "Ekspor CSV",
    target: "Audit Trail",
  },
]

// ---------- ROLE ----------
// Kapabilitas: dari aturan di sumber (src/domain.mjs).
//  - Auditor: baca saja (semua aksi false)
//  - approve: Supervisor, Manager, Division Head, Administrator
//  - config (parameter EWS, administrasi): hanya Administrator
//  - edit (ubah data, acknowledge, remediasi, ajukan): semua kecuali Auditor, Manager, Division Head
//  - Ringkasan Eksekutif di Pusat Kendali: Manager dan Division Head
export type Role = typeof roles[number]
export const can = (
  role: string,
  action: "edit" | "approve" | "config",
): boolean => {
  if (role === "Auditor") return false
  if (action === "approve")
    return ["Supervisor", "Manager", "Division Head", "Administrator"].includes(
      role,
    )
  if (action === "config") return role === "Administrator"
  return !["Manager", "Division Head"].includes(role)
}
export const roleCapabilities = roles.map((role) => ({
  role,
  edit: can(role, "edit"),
  approve: can(role, "approve"),
  config: can(role, "config"),
  readOnly: role === "Auditor",
  executiveSummary: ["Manager", "Division Head"].includes(role),
}))

// Pengguna contoh untuk halaman login dan menu pengguna (nama dan email karangan, bukan data nyata).
export const SAMPLE_users = [
  { name: "Admin SYNRA", email: "admin@synra.co.id", role: "Administrator" },
  { name: "Rafi Pratama", email: "noc@synra.co.id", role: "NOC" },
  {
    name: "Sinta Wulandari",
    email: "serveradmin@synra.co.id",
    role: "Server Admin",
  },
  { name: "Bagas Saputra", email: "dba@synra.co.id", role: "DBA" },
  {
    name: "Yusuf Hidayat",
    email: "networkadmin@synra.co.id",
    role: "Network Admin",
  },
  { name: "Nadia Kusuma", email: "security@synra.co.id", role: "Security" },
  {
    name: "Rini Anggraeni",
    email: "assetmanagement@synra.co.id",
    role: "Asset Management",
  },
  {
    name: "Hendra Wijaya",
    email: "supervisor@synra.co.id",
    role: "Supervisor",
  },
  { name: "Maya Sari", email: "manager@synra.co.id", role: "Manager" },
  {
    name: "Arief Nugroho",
    email: "divisionhead@synra.co.id",
    role: "Division Head",
  },
  { name: "Laras Putri", email: "auditor@synra.co.id", role: "Auditor" },
].map((u) => ({
  ...u,
  initials: u.name
    .split(" ")
    .map((w) => w[0])
    .join("")
    .slice(0, 2)
    .toUpperCase(),
}))

// USULAN DESAIN (bukan dari sumber): fokus alert per role pada kartu "Prioritas hari ini".
// null = semua alert. Role tanpa alert yang cocok menampilkan state kosong.
export const DESIGN_roleAlertFocus: Record<string, string[] | null> = {
  Administrator: null,
  NOC: null,
  Supervisor: null,
  Manager: null,
  "Division Head": null,
  Auditor: null,
  "Server Admin": ["Server"],
  DBA: ["Database"],
  "Network Admin": ["Network"],
  Security: ["Security"],
  "Asset Management": ["Lisensi"],
}
export const alertsForRole = (role: string) => {
  const focus = DESIGN_roleAlertFocus[role] ?? null
  return focus ? alerts.filter((a) => focus.includes(a.type)) : alerts
}

// ---------- KPI PUSAT KENDALI (semua teks dihitung dari data di atas) ----------
const joinID = (xs: string[]) =>
  xs.length <= 1
    ? (xs[0] ?? "")
    : xs.slice(0, -1).join(", ") + " dan " + xs[xs.length - 1]
const unique = <T>(xs: T[]) => [...new Set(xs)]
export const healthLabel = (s: number) =>
  s >= 80 ? "Baik" : s >= 60 ? "Perlu perhatian" : "Kritis"
const openAlertList = alerts.filter((a) => a.status !== "Ditutup")
const severityCounts = (list: Alert[]) =>
  (["Critical", "High", "Medium", "Low"] as Severity[])
    .map((s) => [s, list.filter((a) => a.severity === s).length] as const)
    .filter(([, n]) => n > 0)
    .map(([s, n]) => `${n} ${s}`)
    .join(", ")
const expiring30 = [...lifecycleWithSeverity, ...osLifecycle]
  .filter((i) => i.daysLeft >= 0 && i.daysLeft <= 30)
  .sort((a, b) => a.daysLeft - b.daysLeft)

// tone: "good" (hijau) | "warning" (kuning) | "high" (orange) | "critical" (merah) -> panduan warna angka dan tag
export const kpiCards = [
  {
    id: "health",
    label: "Skor kesehatan",
    value: String(summary.healthScoreIllustrative),
    tag: healthLabel(summary.healthScoreIllustrative),
    tone: summary.healthScoreIllustrative >= 80 ? "good" : "warning",
    description: "Dari 7 dimensi penilaian",
    note:
      "Kondisi " + healthLabel(summary.healthScoreIllustrative).toLowerCase(),
  },
  {
    id: "online",
    label: "Aset online",
    value: `${summary.online}/${summary.totalAssets}`,
    tag: `${Math.round((summary.online / summary.totalAssets) * 100)}%`,
    tone: summary.online / summary.totalAssets >= 0.8 ? "good" : "warning",
    description: joinID(unique(assets.map((a) => a.location))),
    note: `${summary.totalAssets - summary.online} aset perlu perhatian`,
  },
  {
    id: "alerts",
    label: "Alert terbuka",
    value: String(summary.openAlerts),
    tag: "Aktif",
    tone:
      summary.criticalAlerts > 0
        ? "critical"
        : summary.openAlerts > 0
          ? "warning"
          : "good",
    description: "Belum ditutup",
    note: severityCounts(openAlertList),
  },
  {
    id: "critical",
    label: "Critical",
    value: String(summary.criticalAlerts),
    tag: "Prioritas",
    tone: summary.criticalAlerts > 0 ? "critical" : "good",
    description: "Perlu tindakan segera",
    note: joinID(
      unique(
        openAlertList
          .filter((a) => a.severity === "Critical")
          .map((a) => a.type),
      ),
    ),
  },
  {
    id: "expiring",
    label: "Kedaluwarsa ≤ 30 hari",
    value: String(expiring30.length),
    tag: "H-30",
    tone: expiring30.length > 0 ? "critical" : "good",
    description: "Tenggat 30 hari ke depan",
    note:
      expiring30.length === 0
        ? "Tidak ada"
        : expiring30.length === 1
          ? expiring30[0].name
          : `${expiring30[0].name} +${expiring30.length - 1} lainnya`,
  },
]
