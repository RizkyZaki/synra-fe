import { useMemo } from "react"
import { useSynraStore } from "../lib/useSynraStore"
import type { Asset } from "../lib/synraDomain"
import {
  DataTable,
  GlassCard,
  ScopeNotice,
  SeverityBadge,
  StatusBadge,
  type DataTableColumn,
} from "./ui"

export type MonitoringName =
  | "Infrastruktur"
  | "Database"
  | "Storage & Kapasitas"
  | "Availability & Performa"
  | "Backup & Keamanan"

// Komponen aset dari backend (CORE_BANKING, DATABASE, WEB, MIDDLEWARE, ...). null = semua aset.
const typeMap: Record<MonitoringName, string[] | null> = {
  Infrastruktur: null,
  Database: ["DATABASE"],
  "Storage & Kapasitas": null,
  "Availability & Performa": null,
  "Backup & Keamanan": [],
}

function statusTone(status: Asset["status"]) {
  if (status === "Online") return "success" as const
  if (status === "Degraded" || status === "Offline") return "danger" as const
  return "neutral" as const
}

function average(values: number[]) {
  if (values.length === 0) return 0
  return Math.round(
    (values.reduce((total, value) => total + value, 0) / values.length) * 10,
  ) / 10
}

function ComparisonChart({ assets }: { assets: Asset[] }) {
  return (
    <GlassCard className="monitoring-chart">
      <div className="section-heading">
        <span className="pretext">UTILISASI</span>
        <h3 className="title-h3">Perbandingan Metrik Aset</h3>
      </div>
      {assets.length > 0 ? (
        <div className="comparison-chart">
          <div className="comparison-chart__legend">
            <span className="comparison-chart__cpu">CPU</span>
            <span className="comparison-chart__memory">Memory</span>
            <span className="comparison-chart__disk">Disk</span>
          </div>
          <div className="comparison-chart__rows">
            {assets.map((asset) => (
              <div className="comparison-row" key={asset.id}>
                <strong className="label">{asset.name}</strong>
                <div className="comparison-row__bars">
                  <span
                    className="comparison-bar comparison-bar--cpu"
                    style={{ width: `${asset.cpu}%` }}
                  >
                    {asset.cpu}%
                  </span>
                  <span
                    className="comparison-bar comparison-bar--memory"
                    style={{ width: `${asset.memory}%` }}
                  >
                    {asset.memory}%
                  </span>
                  <span
                    className="comparison-bar comparison-bar--disk"
                    style={{ width: `${asset.disk}%` }}
                  >
                    {asset.disk.toLocaleString("id-ID")}%
                  </span>
                </div>
              </div>
            ))}
          </div>
        </div>
      ) : (
        <p className="bodycopy text-muted">
          Tidak ada aset yang sesuai dengan kategori monitoring ini.
        </p>
      )}
    </GlassCard>
  )
}

function DiskByMount({ assets }: { assets: Asset[] }) {
  const rows = assets.flatMap((asset) =>
    (asset.disks ?? []).map((disk) => ({ asset, ...disk })),
  )
  rows.sort((a, b) => b.value - a.value)
  return (
    <GlassCard className="storage-forecast">
      <div className="section-heading">
        <span className="pretext">DISK</span>
        <h3 className="title-h3">Pemakaian per Mount Point</h3>
      </div>
      <div className="forecast-table-wrap">
        <table className="forecast-table">
          <thead>
            <tr>
              <th>Aset</th>
              <th>Host</th>
              <th>Mount point</th>
              <th>Terpakai</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr
                key={`${row.asset.id}${row.mountPoint}`}
                data-severity={row.value >= 95 ? "Critical" : row.value >= 90 ? "High" : row.value >= 80 ? "Medium" : row.value >= 70 ? "Low" : "Normal"}
              >
                <td>
                  <strong>{row.asset.name}</strong>
                </td>
                <td>{row.asset.location}</td>
                <td>{row.mountPoint}</td>
                <td>{row.value.toLocaleString("id-ID")}%</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  )
}

function AvailabilityTable() {
  const { api } = useSynraStore()
  const rows = api.availability?.assets ?? []
  return (
    <GlassCard className="storage-forecast">
      <div className="section-heading">
        <span className="pretext">AVAILABILITY</span>
        <h3 className="title-h3">
          Availability 24 Jam
          {api.availability?.averagePct != null && ` · rata-rata ${api.availability.averagePct.toLocaleString("id-ID")}%`}
        </h3>
      </div>
      <div className="forecast-table-wrap">
        <table className="forecast-table">
          <thead>
            <tr>
              <th>Aset</th>
              <th>Host</th>
              <th>Komponen</th>
              <th>Availability</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => (
              <tr key={row.assetId}>
                <td>
                  <strong>{row.hostname}</strong>
                </td>
                <td>{row.host}</td>
                <td>{row.component}</td>
                <td>{row.pct === null ? "—" : `${row.pct.toLocaleString("id-ID")}%`}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </GlassCard>
  )
}

export default function MonitoringPage({ name }: { name: MonitoringName }) {
  const { read } = useSynraStore()
  const assets = read("assets")
  const relevantTypes = typeMap[name]
  const relevant = useMemo(
    () =>
      assets.filter(
        (asset) => relevantTypes === null || relevantTypes.includes(asset.type),
      ),
    [assets, relevantTypes],
  )
  const online = relevant.filter((asset) => asset.status === "Online").length
  const averageCpu = average(relevant.map((asset) => asset.cpu))
  const averageMemory = average(relevant.map((asset) => asset.memory))
  const averageDisk = average(relevant.map((asset) => asset.disk))

  const columns: DataTableColumn<Asset>[] = [
    {
      key: "asset",
      header: "Aset",
      render: (asset) => (
        <div className="table-primary">
          <strong>{asset.name}</strong>
          <span className="label text-muted">{asset.ipAddress}</span>
        </div>
      ),
    },
    { key: "type", header: "Komponen", render: (asset) => asset.type },
    { key: "location", header: "Host", render: (asset) => asset.location },
    {
      key: "status",
      header: "Status",
      render: (asset) => (
        <StatusBadge status={asset.status} tone={statusTone(asset.status)} />
      ),
    },
    {
      key: "severity",
      header: "Severity",
      render: (asset) => <SeverityBadge severity={asset.severity} />,
    },
    {
      key: "cpu",
      header: "CPU",
      render: (asset) => `${asset.cpu.toLocaleString("id-ID")}%`,
    },
    {
      key: "memory",
      header: "Memory",
      render: (asset) => `${asset.memory.toLocaleString("id-ID")}%`,
    },
    {
      key: "disk",
      header: "Disk",
      render: (asset) => `${asset.disk.toLocaleString("id-ID")}%`,
    },
  ]

  return (
    <div className="monitoring-page">
      {name === "Backup & Keamanan" && (
        <ScopeNotice>
          Pilot SYNRA hanya menerima CPU, memori, disk, uptime (Metricbeat) dan jumlah log error (Filebeat).
          Data backup dan keamanan belum tersedia.
        </ScopeNotice>
      )}
      <div className="monitoring-summary">
        <GlassCard>
          <span className="label text-muted">Total aset</span>
          <strong className="bigcopy">{relevant.length}</strong>
        </GlassCard>
        <GlassCard>
          <span className="label text-muted">Daring</span>
          <strong className="bigcopy">{online}</strong>
        </GlassCard>
        <GlassCard>
          <span className="label text-muted">Rata-rata CPU</span>
          <strong className="bigcopy">{averageCpu}%</strong>
        </GlassCard>
        <GlassCard>
          <span className="label text-muted">Memori / disk</span>
          <strong className="bigcopy">
            {averageMemory}% / {averageDisk}%
          </strong>
        </GlassCard>
      </div>

      <ComparisonChart assets={relevant} />

      {name === "Storage & Kapasitas" && <DiskByMount assets={relevant} />}
      {name === "Availability & Performa" && <AvailabilityTable />}

      <GlassCard className="monitoring-table">
        <div className="section-heading">
          <span className="pretext">ASET TERKAIT</span>
          <h3 className="title-h3">Status {name}</h3>
        </div>
        <DataTable
          columns={columns}
          rows={relevant}
          rowKey={(asset) => asset.id}
          rowSeverity={(asset) => asset.severity}
        />
      </GlassCard>
    </div>
  )
}
