import { Download, Printer } from "lucide-react"
import { useEffect, useState } from "react"
import { useSynraStore } from "../lib/useSynraStore"
import { ApiError, apiFetch } from "../lib/api"
import { SEVERITY_TO_FE, STATUS_TO_FE, formatDateTime, type BackendAlertStatus, type BackendSeverity } from "../lib/backend"
import {
  ApiErrorBanner,
  DataTable,
  FilterField,
  GlassCard,
  PageToolbar,
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
        <div className="table-primary">
          <strong>{a.hostname}</strong>
          <span className="type-meta text-muted-foreground">{a.component}</span>
        </div>
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
    { key: "code", header: "ID", render: (a) => a.code },
    { key: "problem", header: "Masalah", render: (a) => <strong>{a.problem}</strong> },
    { key: "host", header: "Aset", render: (a) => `${a.hostname} · ${a.host}` },
    { key: "severity", header: "Severity", render: (a) => <SeverityBadge severity={SEVERITY_TO_FE[a.severity]} /> },
    { key: "status", header: "Status", render: (a) => STATUS_TO_FE[a.status] },
    { key: "time", header: "Terdeteksi", render: (a) => formatDateTime(a.detectedAt) },
  ]

  const s = report?.summary

  return (
    <div className="reports-page">
      <ApiErrorBanner message={error} />
      <PageToolbar
        className="mb-6"
        actions={
          <>
            <Button variant="outline" onClick={() => exportFile("xlsx")} disabled={busy !== ""}>
              <Download {...iconProps} />
              {busy === "xlsx" ? "Mengekspor…" : "Ekspor XLSX"}
            </Button>
            <Button variant="outline" onClick={() => exportFile("pdf")} disabled={busy !== ""}>
              <Download {...iconProps} />
              {busy === "pdf" ? "Mengekspor…" : "Ekspor PDF"}
            </Button>
            <Button onClick={() => window.print()}>
              <Printer {...iconProps} />
              Cetak
            </Button>
          </>
        }
      >
        <FilterField label="Tanggal" className="w-[180px]">
          <Input
            type="date"
            value={date}
            max={today()}
            onChange={(event) => setDate(event.target.value || today())}
          />
        </FilterField>
        <FilterField label="Host" className="w-[180px]">
          <Select
            value={hostId}
            onValueChange={(val) => setHostId(val ?? "")}
          >
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
      </PageToolbar>

      <div className="executive-summary">
        <GlassCard>
          <span className="type-meta text-muted-foreground">Total aset</span>
          <strong className="bigcopy">{s?.totalAssets ?? "—"}</strong>
          <span className="type-meta text-muted-foreground">Laporan {report?.date ?? date}</span>
        </GlassCard>
        <GlassCard>
          <span className="type-meta text-muted-foreground">Rata-rata availability</span>
          <strong className="bigcopy">{s ? pct(s.availabilityAvgPct) : "—"}</strong>
          <span className="type-meta text-muted-foreground">Data per menit</span>
        </GlassCard>
        <GlassCard>
          <span className="type-meta text-muted-foreground">Alert terdeteksi</span>
          <strong className="bigcopy">{s?.alertsDetected ?? "—"}</strong>
          <span className="type-meta text-muted-foreground">Pada tanggal ini</span>
        </GlassCard>
        <GlassCard>
          <span className="type-meta text-muted-foreground">Alert ditutup</span>
          <strong className="bigcopy">{s?.alertsClosed ?? "—"}</strong>
          <span className="type-meta text-muted-foreground">Pada tanggal ini</span>
        </GlassCard>
      </div>

      <GlassCard className="report-severity">
        <div className="section-heading mb-4">
          <span className="type-label text-muted-foreground">ALERT</span>
          <h3 className="type-card-title">Alert Terdeteksi per Severity</h3>
        </div>
        <div className="severity-summary">
          {(["CRITICAL", "HIGH", "MEDIUM", "LOW", "INFO"] as BackendSeverity[]).map((severity) => (
            <div key={severity}>
              <SeverityBadge severity={SEVERITY_TO_FE[severity]} />
              <strong className="bigcopy">{s?.detectedBySeverity[severity] ?? 0}</strong>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="report-risk">
        <div className="section-heading mb-4">
          <span className="type-label text-muted-foreground">ASET</span>
          <h3 className="type-card-title">Statistik per Aset</h3>
        </div>
        <DataTable columns={assetColumns} rows={report?.assets ?? []} rowKey={(a) => a.hostname} />
      </GlassCard>

      <GlassCard className="report-requests">
        <div className="section-heading mb-4">
          <span className="type-label text-muted-foreground">ALERT</span>
          <h3 className="type-card-title">Alert pada Tanggal Ini</h3>
        </div>
        {report && report.alerts.length === 0 ? (
          <p className="type-body text-muted-foreground table-empty">Tidak ada alert yang terdeteksi pada tanggal ini.</p>
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
