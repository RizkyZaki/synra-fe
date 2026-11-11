import { Activity, BarChart3, HardDrive, Server } from "lucide-react"
import { motion } from "motion/react"
import { useMemo } from "react"
import { useSynraStore } from "../lib/useSynraStore"
import type { Asset, Severity } from "../lib/synraDomain"
import { CardHeading, DataTable, GlassCard, ScopeNotice, SeverityBadge, StatusBadge, type DataTableColumn } from "./ui"
import { NumberTicker } from "@/components/aceternity/number-ticker"
import { cn } from "@/lib/utils"

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

const metricColor = { cpu: "bg-primary", memory: "bg-info", disk: "bg-secondary-foreground/40" } as const

function statusTone(status: Asset["status"]) {
  if (status === "Online") return "success" as const
  if (status === "Degraded" || status === "Offline") return "danger" as const
  return "neutral" as const
}

function average(values: number[]) {
  if (values.length === 0) return 0
  return Math.round((values.reduce((total, value) => total + value, 0) / values.length) * 10) / 10
}

function pctTone(value: number) {
  return value >= 90 ? "text-danger" : value >= 80 ? "text-warning" : ""
}

function ComparisonChart({ assets }: { assets: Asset[] }) {
  return (
    <GlassCard className="flex min-w-0 flex-col gap-5 p-5">
      <CardHeading
        icon={BarChart3}
        title="Perbandingan Metrik Aset"
        description="Utilisasi terbaru per aset"
        actions={
          <div className="hidden gap-3 text-xs text-muted-foreground sm:flex">
            {(["cpu", "memory", "disk"] as const).map((metric) => (
              <span key={metric} className="flex items-center gap-1.5">
                <span className={cn("h-2 w-3 rounded-sm", metricColor[metric])} />
                {metric === "cpu" ? "CPU" : metric === "memory" ? "Memori" : "Disk"}
              </span>
            ))}
          </div>
        }
      />
      {assets.length > 0 ? (
        <div className="grid gap-x-8 gap-y-5 lg:grid-cols-2">
          {assets.map((asset, rowIndex) => (
            <div key={asset.id} className="min-w-0">
              <div className="mb-2 flex items-center justify-between gap-2">
                <strong className="truncate text-sm font-medium">{asset.name}</strong>
                <span className="shrink-0 text-xs text-muted-foreground">{asset.location}</span>
              </div>
              <div className="flex flex-col gap-1.5">
                {(["cpu", "memory", "disk"] as const).map((metric, index) => (
                  <div key={metric} className="flex items-center gap-2">
                    <span className="w-10 shrink-0 text-[11px] text-muted-foreground">
                      {metric === "cpu" ? "CPU" : metric === "memory" ? "Mem" : "Disk"}
                    </span>
                    <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                      <motion.div
                        className={cn("h-full rounded-full", metricColor[metric])}
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(asset[metric], 100)}%` }}
                        transition={{ duration: 0.7, delay: Math.min(rowIndex, 8) * 0.03 + index * 0.05 }}
                      />
                    </div>
                    <span className={cn("w-12 shrink-0 text-right text-xs font-medium tabular-nums", pctTone(asset[metric]))}>
                      {asset[metric].toLocaleString("id-ID")}%
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <p className="type-meta">Tidak ada aset yang sesuai dengan kategori monitoring ini.</p>
      )}
    </GlassCard>
  )
}

function diskSeverity(value: number): Severity {
  return value >= 95 ? "Critical" : value >= 90 ? "High" : value >= 80 ? "Medium" : value >= 70 ? "Low" : "Normal"
}

function DiskByMount({ assets }: { assets: Asset[] }) {
  const rows = assets.flatMap((asset) => (asset.disks ?? []).map((disk) => ({ asset, ...disk })))
  rows.sort((a, b) => b.value - a.value)
  type Row = (typeof rows)[number]
  const columns: DataTableColumn<Row>[] = [
    { key: "asset", header: "Aset", render: (row) => <strong className="font-medium">{row.asset.name}</strong> },
    { key: "host", header: "Host", render: (row) => row.asset.location },
    { key: "mount", header: "Mount point", render: (row) => <span className="font-mono text-xs">{row.mountPoint}</span> },
    {
      key: "used",
      header: "Terpakai",
      render: (row) => (
        <span className="flex w-[160px] items-center gap-2">
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-muted">
            <span
              className={cn("block h-full rounded-full", row.value >= 90 ? "bg-danger" : row.value >= 80 ? "bg-warning" : "bg-primary")}
              style={{ width: `${Math.min(row.value, 100)}%` }}
            />
          </span>
          <span className={cn("w-12 text-right text-xs font-medium tabular-nums", pctTone(row.value))}>
            {row.value.toLocaleString("id-ID")}%
          </span>
        </span>
      ),
    },
    { key: "sev", header: "Severity", render: (row) => <SeverityBadge severity={diskSeverity(row.value)} /> },
  ]
  return (
    <GlassCard className="flex min-w-0 flex-col gap-4 p-5">
      <CardHeading icon={HardDrive} title="Pemakaian per Mount Point" description="Urut dari yang paling penuh" />
      {rows.length === 0 ? (
        <p className="type-meta">Belum ada data disk.</p>
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(row) => `${row.asset.id}${row.mountPoint}`}
          rowSeverity={(row) => diskSeverity(row.value)}
        />
      )}
    </GlassCard>
  )
}

function AvailabilityTable() {
  const { api } = useSynraStore()
  const rows = api.availability?.assets ?? []
  type Row = (typeof rows)[number]
  const columns: DataTableColumn<Row>[] = [
    { key: "asset", header: "Aset", render: (row) => <strong className="font-medium">{row.hostname}</strong> },
    { key: "host", header: "Host", render: (row) => row.host },
    { key: "component", header: "Komponen", render: (row) => row.component },
    {
      key: "pct",
      header: "Availability",
      render: (row) => (
        <span
          className={cn(
            "font-medium tabular-nums",
            row.pct === null ? "text-muted-foreground" : row.pct >= 99 ? "text-success" : row.pct >= 95 ? "text-warning" : "text-danger",
          )}
        >
          {row.pct === null ? "—" : `${row.pct.toLocaleString("id-ID")}%`}
        </span>
      ),
    },
  ]
  return (
    <GlassCard className="flex min-w-0 flex-col gap-4 p-5">
      <CardHeading
        icon={Activity}
        title="Availability 24 Jam"
        description={
          api.availability?.averagePct != null
            ? `Rata-rata ${api.availability.averagePct.toLocaleString("id-ID")}%`
            : "Persentase menit dengan data masuk"
        }
      />
      <DataTable columns={columns} rows={rows} rowKey={(row) => row.assetId} />
    </GlassCard>
  )
}

export default function MonitoringPage({ name }: { name: MonitoringName }) {
  const { read } = useSynraStore()
  const assets = read("assets")
  const relevantTypes = typeMap[name]
  const relevant = useMemo(
    () => assets.filter((asset) => relevantTypes === null || relevantTypes.includes(asset.type)),
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
        <span className="flex flex-col">
          <strong className="whitespace-nowrap font-medium">{asset.name}</strong>
          <span className="font-mono text-[11px] text-muted-foreground">{asset.ipAddress}</span>
        </span>
      ),
    },
    { key: "type", header: "Komponen", render: (asset) => asset.type },
    { key: "location", header: "Host", render: (asset) => asset.location },
    { key: "status", header: "Status", render: (asset) => <StatusBadge status={asset.status} tone={statusTone(asset.status)} /> },
    { key: "severity", header: "Severity", render: (asset) => <SeverityBadge severity={asset.severity} /> },
    ...(["cpu", "memory", "disk"] as const).map((metric) => ({
      key: metric,
      header: metric === "cpu" ? "CPU" : metric === "memory" ? "Memori" : "Disk",
      render: (asset: Asset) => (
        <span className={cn("tabular-nums", pctTone(asset[metric]))}>{asset[metric].toLocaleString("id-ID")}%</span>
      ),
    })),
  ]

  const stats: [string, string][] = [
    ["Total aset", String(relevant.length)],
    ["Daring", `${online}/${relevant.length}`],
    ["Rata-rata CPU", `${averageCpu.toLocaleString("id-ID")}%`],
    ["Memori / disk", `${averageMemory.toLocaleString("id-ID")}% / ${averageDisk.toLocaleString("id-ID")}%`],
  ]

  return (
    <div className="flex min-w-0 flex-col gap-6">
      {name === "Backup & Keamanan" && (
        <ScopeNotice>
          Pilot SYNRA hanya menerima CPU, memori, disk, uptime (Metricbeat) dan jumlah log error (Filebeat). Data backup dan
          keamanan belum tersedia.
        </ScopeNotice>
      )}

      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-4">
        {stats.map(([label, value]) => (
          <GlassCard key={label} className="min-w-0 p-4 md:p-5">
            <p className="type-label text-muted-foreground">{label}</p>
            <NumberTicker value={value} className="mt-1.5 block truncate text-xl font-semibold tracking-tight md:text-2xl" />
          </GlassCard>
        ))}
      </div>

      <ComparisonChart assets={relevant} />

      {name === "Storage & Kapasitas" && <DiskByMount assets={relevant} />}
      {name === "Availability & Performa" && <AvailabilityTable />}

      <GlassCard className="flex min-w-0 flex-col gap-4 p-5">
        <CardHeading icon={Server} title="Aset Terkait" description={`${relevant.length} aset pada kategori ini`} />
        {relevant.length > 0 ? (
          <DataTable columns={columns} rows={relevant} rowKey={(asset) => asset.id} rowSeverity={(asset) => asset.severity} />
        ) : (
          <p className="type-meta">Belum ada aset.</p>
        )}
      </GlassCard>
    </div>
  )
}
