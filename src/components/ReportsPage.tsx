import { Download, Printer } from "lucide-react"
import { useSynraStore } from "../lib/useSynraStore"
import type { Asset, RenewalRequest, Severity } from "../lib/synraDomain"
import {
  DataTable,
  GlassCard,
  SeverityBadge,
  StatusBadge,
  type DataTableColumn,
} from "./ui"

const iconProps = {
  size: 20,
  strokeWidth: 1.75,
  "aria-hidden": true,
} as const

const severities: Severity[] = [
  "Critical",
  "High",
  "Medium",
  "Low",
  "Info",
  "Normal",
]

function requestTone(status: RenewalRequest["status"]) {
  if (status === "Disetujui") return "success" as const
  if (status === "Ditolak") return "danger" as const
  return "warning" as const
}

function downloadCsv(filename: string, rows: Array<Array<string | number>>) {
  const escape = (value: string | number) =>
    `"${String(value).replace(/"/g, '""')}"`
  const csv = rows.map((row) => row.map(escape).join(",")).join("\n")
  const url = URL.createObjectURL(
    new Blob([csv], { type: "text/csv;charset=utf-8" }),
  )
  const link = document.createElement("a")
  link.href = url
  link.download = filename
  link.click()
  URL.revokeObjectURL(url)
}

export default function ReportsPage() {
  const { read, helpers } = useSynraStore()
  const assets = read("assets")
  const alerts = read("alerts")
  const lifecycle = read("lifecycle")
  const requests = read("requests")
  const kpi = helpers.dashboardKpi()
  const riskyAssets = assets.filter(
    (asset) =>
      asset.severity === "Critical" ||
      asset.severity === "High" ||
      asset.status === "Offline" ||
      asset.status === "Degraded",
  )
  const expiring = lifecycle.filter(
    (item) => helpers.daysUntil(item.expiry) <= 90,
  )

  const requestColumns: DataTableColumn<RenewalRequest>[] = [
    { key: "id", header: "ID", render: (request) => request.id },
    {
      key: "item",
      header: "Item",
      render: (request) => <strong>{request.itemName}</strong>,
    },
    {
      key: "requester",
      header: "Pemohon",
      render: (request) => request.requestedBy,
    },
    {
      key: "date",
      header: "Dibuat",
      render: (request) => request.createdAt,
    },
    {
      key: "status",
      header: "Status",
      render: (request) => (
        <StatusBadge
          status={request.status}
          tone={requestTone(request.status)}
        />
      ),
    },
  ]

  const assetColumns: DataTableColumn<Asset>[] = [
    {
      key: "asset",
      header: "Aset",
      render: (asset) => (
        <div className="table-primary">
          <strong>{asset.name}</strong>
          <span className="label text-muted">{asset.id}</span>
        </div>
      ),
    },
    { key: "type", header: "Jenis", render: (asset) => asset.type },
    { key: "location", header: "Lokasi", render: (asset) => asset.location },
    {
      key: "severity",
      header: "Severity",
      render: (asset) => <SeverityBadge severity={asset.severity} />,
    },
    {
      key: "disk",
      header: "Disk",
      render: (asset) => `${asset.disk.toLocaleString("id-ID")}%`,
    },
  ]

  const exportReport = () => {
    downloadCsv("laporan-eksekutif-synra.csv", [
      ["Ringkasan Eksekutif", "Nilai"],
      ["Skor kesehatan", kpi.healthScore],
      ["Aset Online", `${kpi.online}/${kpi.totalAssets}`],
      ["Alert Terbuka", kpi.openAlerts],
      ["Kritis", kpi.critical],
      ["Kedaluwarsa ≤ 30 hari", kpi.expiring],
      [],
      ["Pengajuan", "Item", "Pemohon", "Status", "Dibuat"],
      ...requests.map((request) => [
        request.id,
        request.itemName,
        request.requestedBy,
        request.status,
        request.createdAt,
      ]),
    ])
  }

  return (
    <div className="reports-page">
      <div className="page-actions">
        <button className="button button--secondary" onClick={exportReport}>
          <Download {...iconProps} />
          Ekspor CSV
        </button>
        <button
          className="button button--primary"
          onClick={() => window.print()}
        >
          <Printer {...iconProps} />
          Cetak
        </button>
      </div>

      <div className="executive-summary">
        <GlassCard>
          <span className="label text-muted">Skor kesehatan</span>
          <strong className="bigcopy">{kpi.healthScore}</strong>
          <StatusBadge status={kpi.healthLabel} tone="success" />
        </GlassCard>
        <GlassCard>
          <span className="label text-muted">Alert terbuka</span>
          <strong className="bigcopy">{kpi.openAlerts}</strong>
          <span className="label text-muted">{kpi.critical} critical</span>
        </GlassCard>
        <GlassCard>
          <span className="label text-muted">Aset berisiko</span>
          <strong className="bigcopy">{riskyAssets.length}</strong>
          <span className="label text-muted">Perlu perhatian</span>
        </GlassCard>
        <GlassCard>
          <span className="label text-muted">Kedaluwarsa ≤ 90 hari</span>
          <strong className="bigcopy">{expiring.length}</strong>
          <span className="label text-muted">Lifecycle aktif</span>
        </GlassCard>
      </div>

      <GlassCard className="report-severity">
        <div className="section-heading">
          <span className="pretext">ALERT</span>
          <h3 className="title-h3">Alert per tingkat keparahan</h3>
        </div>
        <div className="severity-summary">
          {severities.map((severity) => (
            <div key={severity}>
              <SeverityBadge severity={severity} />
              <strong className="bigcopy">
                {
                  alerts.filter((alert) => alert.severity === severity)
                    .length
                }
              </strong>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="report-risk">
        <div className="section-heading">
          <span className="pretext">RISIKO</span>
          <h3 className="title-h3">Aset Berisiko</h3>
        </div>
        <DataTable
          columns={assetColumns}
          rows={riskyAssets}
          rowKey={(asset) => asset.id}
          rowSeverity={(asset) => asset.severity}
        />
      </GlassCard>

      <GlassCard className="report-requests">
        <div className="section-heading">
          <span className="pretext">LIFECYCLE</span>
          <h3 className="title-h3">Pengajuan Perpanjangan</h3>
        </div>
        <DataTable
          columns={requestColumns}
          rows={requests}
          rowKey={(request) => request.id}
        />
      </GlassCard>
    </div>
  )
}
