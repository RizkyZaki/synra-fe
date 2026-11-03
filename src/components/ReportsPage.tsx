import { Download, Printer } from "lucide-react"
import { useEffect, useState } from "react"
import { useSynraStore } from "../lib/useSynraStore"
import { ApiError, apiFetch } from "../lib/api"
import { SEVERITY_TO_FE, STATUS_TO_FE, formatDateTime, type BackendAlertStatus, type BackendSeverity } from "../lib/backend"
import {
  ApiErrorBanner,
  DataTable,
  GlassCard,
  SeverityBadge,
  Toast,
  type DataTableColumn,
} from "./ui"

const iconProps = {
  size: 20,
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
    bpd: string
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
    bpd: string
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
  const [bpdId, setBpdId] = useState("")
  const [report, setReport] = useState<DailyReport | null>(null)
  const [error, setError] = useState("")
  const [toast, setToast] = useState("")
  const [busy, setBusy] = useState<"" | "xlsx" | "pdf">("")

  const query = `date=${date}${bpdId ? `&bpdId=${bpdId}` : ""}`

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
          <span className="label text-muted">{a.component}</span>
        </div>
      ),
    },
    { key: "bpd", header: "BPD", render: (a) => a.bpd },
    { key: "cpu", header: "CPU rata-rata / maks", render: (a) => `${pct(a.cpuAvg)} / ${pct(a.cpuMax)}` },
    { key: "memory", header: "Memori rata-rata / maks", render: (a) => `${pct(a.memoryAvg)} / ${pct(a.memoryMax)}` },
    { key: "disk", header: "Disk maks", render: (a) => pct(a.diskMax) },
    { key: "availability", header: "Availability", render: (a) => pct(a.availabilityPct) },
    { key: "alerts", header: "Alert", render: (a) => a.alertsDetected },
  ]

  const alertColumns: DataTableColumn<DailyReport["alerts"][number]>[] = [
    { key: "code", header: "ID", render: (a) => a.code },
    { key: "problem", header: "Masalah", render: (a) => <strong>{a.problem}</strong> },
    { key: "host", header: "Aset", render: (a) => `${a.hostname} · ${a.bpd}` },
    { key: "severity", header: "Severity", render: (a) => <SeverityBadge severity={SEVERITY_TO_FE[a.severity]} /> },
    { key: "status", header: "Status", render: (a) => STATUS_TO_FE[a.status] },
    { key: "time", header: "Terdeteksi", render: (a) => formatDateTime(a.detectedAt) },
  ]

  const s = report?.summary

  return (
    <div className="reports-page">
      <ApiErrorBanner message={error} />
      <div className="page-actions">
        <div className="inventory-filters">
          <label>
            <span className="label">Tanggal</span>
            <input type="date" value={date} max={today()} onChange={(event) => setDate(event.target.value || today())} />
          </label>
          <label>
            <span className="label">BPD</span>
            <select value={bpdId} onChange={(event) => setBpdId(event.target.value)}>
              <option value="">Semua</option>
              {api.bpds.map((bpd) => (
                <option key={bpd.id} value={bpd.id}>
                  {bpd.name}
                </option>
              ))}
            </select>
          </label>
        </div>
        <button className="button button--secondary" onClick={() => exportFile("xlsx")} disabled={busy !== ""}>
          <Download {...iconProps} />
          {busy === "xlsx" ? "Mengekspor…" : "Ekspor XLSX"}
        </button>
        <button className="button button--secondary" onClick={() => exportFile("pdf")} disabled={busy !== ""}>
          <Download {...iconProps} />
          {busy === "pdf" ? "Mengekspor…" : "Ekspor PDF"}
        </button>
        <button className="button button--primary" onClick={() => window.print()}>
          <Printer {...iconProps} />
          Cetak
        </button>
      </div>

      <div className="executive-summary">
        <GlassCard>
          <span className="label text-muted">Total aset</span>
          <strong className="bigcopy">{s?.totalAssets ?? "—"}</strong>
          <span className="label text-muted">Laporan {report?.date ?? date}</span>
        </GlassCard>
        <GlassCard>
          <span className="label text-muted">Rata-rata availability</span>
          <strong className="bigcopy">{s ? pct(s.availabilityAvgPct) : "—"}</strong>
          <span className="label text-muted">Data per menit</span>
        </GlassCard>
        <GlassCard>
          <span className="label text-muted">Alert terdeteksi</span>
          <strong className="bigcopy">{s?.alertsDetected ?? "—"}</strong>
          <span className="label text-muted">Pada tanggal ini</span>
        </GlassCard>
        <GlassCard>
          <span className="label text-muted">Alert ditutup</span>
          <strong className="bigcopy">{s?.alertsClosed ?? "—"}</strong>
          <span className="label text-muted">Pada tanggal ini</span>
        </GlassCard>
      </div>

      <GlassCard className="report-severity">
        <div className="section-heading">
          <span className="pretext">ALERT</span>
          <h3 className="title-h3">Alert terdeteksi per severity</h3>
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
        <div className="section-heading">
          <span className="pretext">ASET</span>
          <h3 className="title-h3">Statistik per aset</h3>
        </div>
        <DataTable columns={assetColumns} rows={report?.assets ?? []} rowKey={(a) => a.hostname} />
      </GlassCard>

      <GlassCard className="report-requests">
        <div className="section-heading">
          <span className="pretext">ALERT</span>
          <h3 className="title-h3">Alert pada tanggal ini</h3>
        </div>
        {report && report.alerts.length === 0 ? (
          <p className="bodycopy text-muted table-empty">Tidak ada alert yang terdeteksi pada tanggal ini.</p>
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
