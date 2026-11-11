import { Download, FileSpreadsheet, Printer } from "lucide-react"
import { motion } from "motion/react"
import { useEffect, useState } from "react"
import { NumberTicker } from "@/components/aceternity/number-ticker"
import { cn } from "@/lib/utils"
import { useSynraStore } from "../lib/useSynraStore"
import { ApiError, apiFetch } from "../lib/api"
import { SEVERITY_TO_FE, STATUS_TO_FE, formatDateTime, type BackendAlertStatus, type BackendSeverity } from "../lib/backend"
import {
  ApiErrorBanner,
  CardHeading,
  DataTable,
  FilterField,
  GlassCard,
  SeverityBadge,
  Toast,
  type DataTableColumn,
} from "./ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const iconProps = {
  size: 18,
  strokeWidth: 1.75,
  "aria-hidden": true,
} as const

interface DailyReport {
  date: string
  timezone: string
  summary: {
    totalAssets: number
    availabilityAvgPct: number | null
    alertsDetected: number
    alertsClosed: number
    detectedBySeverity: Record<BackendSeverity, number>
  }
  assets: Array<{
    hostname: string
    host: string
    component: string
    cpuAvg: number | null
    cpuMax: number | null
    memoryAvg: number | null
    memoryMax: number | null
    diskMax: number | null
    availabilityPct: number | null
    alertsDetected: number
  }>
  alerts: Array<{
    code: string
    hostname: string
    host: string
    problem: string
    severity: BackendSeverity
    status: BackendAlertStatus
    detectedAt: string
  }>
}

const pct = (n: number | null) => (n === null ? "—" : `${n.toLocaleString("id-ID")}%`)

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jakarta" }).format(new Date())
}

export default function ReportsPage() {
  const { actions, api } = useSynraStore()
  const [date, setDate] = useState(today)
  const [hostId, setHostId] = useState("")
  const [report, setReport] = useState<DailyReport | null>(null)
  const [error, setError] = useState("")
  const [toast, setToast] = useState("")
  const [busy, setBusy] = useState<"" | "xlsx" | "pdf">("")

  const query = `date=${date}${hostId ? `&hostId=${hostId}` : ""}`

  useEffect(() => {
    let cancelled = false
    apiFetch<DailyReport>(`/reports/daily?${query}`)
      .then((res) => {
        if (cancelled) return
        setReport(res)
        setError("")
      })
      .catch((e) => !cancelled && setError(e instanceof ApiError ? e.message : "Gagal memuat laporan"))
    return () => {
      cancelled = true
    }
  }, [query])

  const exportFile = async (format: "xlsx" | "pdf") => {
    setBusy(format)
    try {
      await actions.download(`/reports/daily/export?format=${format}&${query}`, `synra-laporan-harian-${date}.${format}`)
      setToast(`Laporan ${format.toUpperCase()} berhasil diunduh`)
    } catch (e) {
      setToast(e instanceof ApiError ? e.message : "Gagal mengekspor laporan")
    } finally {
      setBusy("")
    }
  }

  const assetColumns: DataTableColumn<DailyReport["assets"][number]>[] = [
    {
      key: "asset",
      header: "Aset",
      render: (a) => (
        <span className="flex flex-col">
          <strong className="whitespace-nowrap font-medium">{a.hostname}</strong>
          <span className="text-xs text-muted-foreground">{a.component}</span>
        </span>
      ),
    },
    { key: "host", header: "Host", render: (a) => a.host },
    { key: "cpu", header: "CPU rata-rata / maks", render: (a) => `${pct(a.cpuAvg)} / ${pct(a.cpuMax)}` },
    { key: "memory", header: "Memori rata-rata / maks", render: (a) => `${pct(a.memoryAvg)} / ${pct(a.memoryMax)}` },
    { key: "disk", header: "Disk maks", render: (a) => pct(a.diskMax) },
    { key: "availability", header: "Availability", render: (a) => pct(a.availabilityPct) },
    { key: "alerts", header: "Alert", render: (a) => a.alertsDetected },
  ]

  const alertColumns: DataTableColumn<DailyReport["alerts"][number]>[] = [
    { key: "code", header: "ID", render: (a) => <span className="font-mono text-xs text-muted-foreground">{a.code}</span> },
    { key: "problem", header: "Masalah", render: (a) => <strong className="font-medium">{a.problem}</strong> },
    { key: "host", header: "Aset", render: (a) => `${a.hostname} · ${a.host}` },
    { key: "severity", header: "Severity", render: (a) => <SeverityBadge severity={SEVERITY_TO_FE[a.severity]} /> },
    { key: "status", header: "Status", render: (a) => STATUS_TO_FE[a.status] },
    { key: "time", header: "Terdeteksi", render: (a) => formatDateTime(a.detectedAt) },
  ]

  const s = report?.summary
  const severityKeys = ["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as BackendSeverity[]
  const maxSeverity = Math.max(1, ...severityKeys.map((key) => s?.detectedBySeverity[key] ?? 0))
  const severityBar: Record<BackendSeverity, string> = {
    CRITICAL: "bg-danger",
    HIGH: "bg-high",
    MEDIUM: "bg-warning",
    LOW: "bg-warning/60",
    INFO: "bg-info",
  }

  const summary: [string, string, string][] = [
    ["Total aset", String(s?.totalAssets ?? "—"), `Laporan ${report?.date ?? date}`],
    ["Rata-rata availability", s ? pct(s.availabilityAvgPct) : "—", "Data per menit"],
    ["Alert terdeteksi", String(s?.alertsDetected ?? "—"), "Pada tanggal ini"],
    ["Alert ditutup", String(s?.alertsClosed ?? "—"), "Pada tanggal ini"],
  ]

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <ApiErrorBanner message={error} />

      <GlassCard className="min-w-0 p-4 md:p-5 print:hidden">
        <div className="flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div className="grid grid-cols-2 gap-3 sm:flex">
            <FilterField label="Tanggal" className="sm:w-[180px]">
              <Input type="date" value={date} max={today()} onChange={(event) => setDate(event.target.value || today())} />
            </FilterField>
            <FilterField label="Host" className="sm:w-[180px]">
              <Select items={{ "": "Semua", ...Object.fromEntries(api.hosts.map((h) => [h.id, h.name])) }} value={hostId} onValueChange={(val) => setHostId(val ?? "")}>
                <SelectTrigger className="w-full">
                  <SelectValue placeholder="Semua" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Semua</SelectItem>
                  {api.hosts.map((host) => (
                    <SelectItem key={host.id} value={host.id}>
                      {host.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </FilterField>
          </div>
          <div className="grid grid-cols-3 gap-2 sm:flex">
            <Button variant="outline" onClick={() => exportFile("xlsx")} disabled={busy !== ""}>
              <FileSpreadsheet {...iconProps} />
              {busy === "xlsx" ? "…" : "XLSX"}
            </Button>
            <Button variant="outline" onClick={() => exportFile("pdf")} disabled={busy !== ""}>
              <Download {...iconProps} />
              {busy === "pdf" ? "…" : "PDF"}
            </Button>
            <Button onClick={() => window.print()}>
              <Printer {...iconProps} />
              Cetak
            </Button>
          </div>
        </div>
      </GlassCard>

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        {summary.map(([label, value, hint]) => (
          <GlassCard key={label} className="min-w-0 p-4 md:p-5">
            <p className="type-label text-muted-foreground">{label}</p>
            <NumberTicker value={value} className="mt-1.5 block text-2xl font-semibold tracking-tight md:text-3xl" />
            <p className="type-meta mt-1 truncate">{hint}</p>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="flex min-w-0 flex-col gap-5 p-5">
        <CardHeading title="Alert Terdeteksi per Severity" />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-5">
          {severityKeys.map((severity, index) => {
            const count = s?.detectedBySeverity[severity] ?? 0
            return (
              <div key={severity} className="min-w-0 rounded-xl border border-border bg-muted/40 p-4">
                <div className="flex items-center justify-between gap-2 sm:flex-col sm:items-start">
                  <SeverityBadge severity={SEVERITY_TO_FE[severity]} />
                  <span className="text-2xl font-semibold tabular-nums">{count}</span>
                </div>
                <div className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted">
                  <motion.div
                    className={cn("h-full rounded-full", severityBar[severity])}
                    initial={{ width: 0 }}
                    animate={{ width: `${(count / maxSeverity) * 100}%` }}
                    transition={{ duration: 0.7, delay: index * 0.05 }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </GlassCard>

      <GlassCard className="flex min-w-0 flex-col gap-4 p-5">
        <CardHeading title="Statistik per Aset" description={`${report?.assets.length ?? 0} aset`} />
        <DataTable columns={assetColumns} rows={report?.assets ?? []} rowKey={(a) => a.hostname} />
      </GlassCard>

      <GlassCard className="flex min-w-0 flex-col gap-4 p-5">
        <CardHeading title="Alert pada Tanggal Ini" description={`${report?.alerts.length ?? 0} alert`} />
        {report && report.alerts.length === 0 ? (
          <p className="type-meta">Tidak ada alert yang terdeteksi pada tanggal ini.</p>
        ) : (
          <DataTable
            columns={alertColumns}
            rows={report?.alerts ?? []}
            rowKey={(a) => a.code}
            rowSeverity={(a) => SEVERITY_TO_FE[a.severity]}
          />
        )}
      </GlassCard>

      <Toast visible={Boolean(toast)} message={toast} onClose={() => setToast("")} />
    </div>
  )
}
