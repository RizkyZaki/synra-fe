import { ArrowRight, CheckCircle2 } from "lucide-react"
import { motion } from "motion/react"
import { useEffect, useLayoutEffect, useRef, useState } from "react"
import { useSynraStore, useUtilization } from "../lib/useSynraStore"
import { formatDateTime } from "../lib/backend"
import { ApiErrorBanner, CardHeading, GlassCard, KpiCard, SeverityBadge } from "./ui"
import { Button } from "@/components/ui/button"
import { NumberTicker } from "@/components/aceternity/number-ticker"
import { cn } from "@/lib/utils"

type Period = "24 jam" | "7 hari" | "30 hari"
type Metric = "cpu" | "memory" | "disk"

const metricConfig: Record<Metric, { label: string; color: string }> = {
  cpu: { label: "CPU", color: "var(--primary)" },
  memory: { label: "Memori", color: "var(--status-info)" },
  disk: { label: "Disk", color: "var(--secondary-500)" },
}

const donutColors = ["#ff7a1a", "#5cc8ff", "#5ee88a", "#ffd84d", "#ff6b6b", "#a78bfa", "#94a0b4"]

const kpiDestinations: Record<string, string> = {
  online: "Inventaris Aset",
  stale: "Inventaris Aset",
  alerts: "Alert & Insiden",
  critical: "Alert & Insiden",
  availability: "Availability & Performa",
  licenses: "Lisensi Software",
}

type Tone = "good" | "warning" | "high" | "critical"

const severityRank = { Normal: 0, Info: 1, Low: 2, Medium: 3, High: 4, Critical: 5, Expired: 6 } as const

/** Mengukur lebar elemen agar grafik SVG mengikuti ukuran kartu. */
function useWidth<T extends HTMLElement>() {
  const ref = useRef<T>(null)
  const [width, setWidth] = useState(0)
  useLayoutEffect(() => {
    const node = ref.current
    if (!node) return
    const observer = new ResizeObserver(([entry]) => setWidth(Math.floor(entry.contentRect.width)))
    observer.observe(node)
    return () => observer.disconnect()
  }, [])
  return [ref, width] as const
}

/**
 * Kartu KPI. Aset/alert/stale/availability dari backend (/dashboard/summary, /dashboard/availability).
 * Lisensi dari modul Siklus Hidup (/lifecycle).
 */
function useKpiCards() {
  const { helpers, api, read } = useSynraStore()
  const k = helpers.dashboardKpi()
  const sev = api.summary?.openAlertsBySeverity
  const pct = k.totalAssets ? Math.round((k.online / k.totalAssets) * 100) : 0

  const licenses = read("lifecycle").filter((item) => item.type === "licenses")
  const activeLicenses = licenses.filter(
    (item) => (item.status === "Aktif" || item.status === "Renewed") && helpers.daysUntil(item.expiry) >= 0,
  )
  const expiring = activeLicenses
    .filter((item) => helpers.daysUntil(item.expiry) <= api.expiryThresholds.CRITICAL)
    .sort((a, b) => helpers.daysUntil(a.expiry) - helpers.daysUntil(b.expiry))

  return [
    {
      id: "online",
      label: "Aset online",
      value: `${k.online}/${k.totalAssets}`,
      tag: `${pct}%`,
      tone: (pct >= 80 ? "good" : "warning") as Tone,
      note: `${k.totalAssets - k.online} perlu perhatian`,
    },
    {
      id: "licenses",
      label: "Lisensi aktif",
      value: `${activeLicenses.length}/${licenses.length}`,
      tag: `H-${api.expiryThresholds.CRITICAL}`,
      tone: (expiring.length > 0 ? "warning" : "good") as Tone,
      note:
        expiring.length === 0
          ? "Tidak ada yang mendekati"
          : expiring.length === 1
            ? expiring[0].name
            : `${expiring[0].name} +${expiring.length - 1}`,
    },
    {
      id: "alerts",
      label: "Alert terbuka",
      value: String(k.openAlerts),
      tag: "Aktif",
      tone: (k.critical > 0 ? "critical" : k.openAlerts > 0 ? "warning" : "good") as Tone,
      // Ringkas agar muat di kartu; rincian per severity ada di halaman Alert.
      note: sev ? `${sev.CRITICAL + sev.HIGH} tinggi · ${sev.MEDIUM + sev.LOW + sev.INFO} lainnya` : "—",
    },
    {
      id: "critical",
      label: "Critical",
      value: String(k.critical),
      tag: "P1",
      tone: (k.critical > 0 ? "critical" : "good") as Tone,
      note: "Perlu tindakan segera",
    },
    {
      id: "stale",
      label: "Host stale",
      value: String(k.stale),
      tag: "5 mnt",
      tone: (k.stale > 0 ? "critical" : "good") as Tone,
      note: api.summary?.lastIngestAt
        ? `Ingest ${formatDateTime(api.summary.lastIngestAt).split(", ")[1] ?? ""}`
        : "Belum ada ingest",
    },
    {
      id: "availability",
      label: "Availability 24 jam",
      value: k.availabilityPct === null ? "—" : `${k.availabilityPct.toLocaleString("id-ID")}%`,
      tag: "Avg",
      tone: (k.availabilityPct === null || k.availabilityPct >= 99
        ? "good"
        : k.availabilityPct >= 95
          ? "warning"
          : "critical") as Tone,
      note: "Data per menit",
    },
  ]
}

/** Tombol pilihan bersegmen dengan indikator beranimasi. */
export function Segmented<T extends string>({
  options,
  value,
  onChange,
  id,
  label,
}: {
  options: T[]
  value: T
  onChange: (value: T) => void
  id: string
  label: string
}) {
  return (
    <div role="group" aria-label={label} className="inline-flex rounded-lg border border-border bg-muted/60 p-0.5">
      {options.map((option) => (
        <button
          key={option}
          type="button"
          aria-pressed={value === option}
          onClick={() => onChange(option)}
          className={cn(
            "relative h-7 rounded-md px-3 text-xs font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
            value === option ? "text-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {value === option && (
            <motion.span
              layoutId={`seg-${id}`}
              className="absolute inset-0 rounded-md border border-border bg-card shadow-sm"
              transition={{ type: "spring", stiffness: 500, damping: 38 }}
            />
          )}
          <span className="relative">{option}</span>
        </button>
      ))}
    </div>
  )
}

function UtilizationChart() {
  const [period, setPeriod] = useState<Period>("24 jam")
  const [hovered, setHovered] = useState<number | null>(null)
  const [visible, setVisible] = useState<Record<Metric, boolean>>({ cpu: true, memory: true, disk: true })
  const { data, error } = useUtilization(period)
  const [boxRef, boxWidth] = useWidth<HTMLDivElement>()
  const scrollRef = useRef<HTMLDivElement>(null)

  const height = 260
  const top = 16
  const chartHeight = 196
  const yAxisWidth = 40
  const padX = 20
  // Minimal 44px per titik; kalau kartu cukup lebar grafik mengisi penuh, kalau tidak bisa digeser.
  const available = Math.max(boxWidth - yAxisWidth, 240)
  const pointsCount = Math.max(data.length - 1, 1)
  const plotWidth = Math.max(available, padX * 2 + pointsCount * 44)
  const step = (plotWidth - padX * 2) / pointsCount
  const scrollable = plotWidth > available + 1
  const labelEvery = Math.max(1, Math.ceil(56 / step))

  const x = (index: number) => (data.length === 1 ? plotWidth / 2 : padX + step * index)
  const y = (value: number) => top + ((100 - value) / 100) * chartHeight
  const barWidth = Math.max(4, Math.min(18, step * 0.42))
  const linePath = (metric: "cpu" | "memory") =>
    data.map((point, index) => `${index === 0 ? "M" : "L"}${x(index)},${y(point[metric])}`).join(" ")
  const areaPath = (metric: "cpu" | "memory") =>
    data.length
      ? `${linePath(metric)} L${x(data.length - 1)},${top + chartHeight} L${x(0)},${top + chartHeight} Z`
      : ""

  // Gulir ke data terbaru saat grafik bisa digeser.
  useEffect(() => {
    if (scrollRef.current && scrollable) scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
  }, [period, data.length, scrollable])

  const hoveredPoint = hovered !== null ? data[hovered] : undefined

  return (
    <GlassCard className="col-span-12 flex min-w-0 flex-col gap-4 p-5 xl:col-span-8">
      <CardHeading
        title="Utilisasi CPU / Memori / Disk"
        description="Rata-rata seluruh host yang aktif"
        actions={
          <Segmented
            id="period"
            label="Periode grafik"
            options={["24 jam", "7 hari", "30 hari"] as Period[]}
            value={period}
            onChange={(next) => {
              setPeriod(next)
              setHovered(null)
            }}
          />
        }
      />

      <div className="flex flex-wrap gap-2">
        {(Object.keys(metricConfig) as Metric[]).map((metric) => (
          <button
            key={metric}
            type="button"
            aria-pressed={visible[metric]}
            onClick={() => setVisible((current) => ({ ...current, [metric]: !current[metric] }))}
            className={cn(
              "inline-flex h-7 items-center gap-2 rounded-full border px-3 text-xs font-medium outline-none transition-all focus-visible:ring-2 focus-visible:ring-ring",
              visible[metric] ? "border-border bg-muted text-foreground" : "border-dashed border-border text-muted-foreground opacity-60",
            )}
          >
            <span
              className={cn("h-2 w-3.5", metric === "disk" ? "rounded-sm" : "rounded-full")}
              style={{ background: metricConfig[metric].color }}
              aria-hidden="true"
            />
            {metricConfig[metric].label}
          </button>
        ))}
      </div>

      {error && <p className="type-meta">{error}</p>}
      {!error && data.length === 0 && <p className="type-meta">Belum ada data metrik pada periode ini.</p>}

      <div ref={boxRef} className="relative flex w-full min-w-0">
        <svg width={yAxisWidth} height={height} className="shrink-0" aria-hidden="true">
          {[0, 25, 50, 75, 100].map((tick) => (
            <text key={tick} x={yAxisWidth - 8} y={y(tick) + 4} textAnchor="end" className="fill-muted-foreground text-[11px]">
              {tick}%
            </text>
          ))}
        </svg>
        <div ref={scrollRef} className={cn("min-w-0 flex-1", scrollable ? "overflow-x-auto" : "overflow-hidden")}>
          <svg
            width={plotWidth}
            height={height}
            role="img"
            aria-label={`Grafik utilisasi periode ${period}`}
            onMouseLeave={() => setHovered(null)}
          >
            <defs>
              {(["cpu", "memory"] as const).map((metric) => (
                <linearGradient key={metric} id={`fill-${metric}`} x1="0" x2="0" y1="0" y2="1">
                  <stop offset="0%" stopColor={metricConfig[metric].color} stopOpacity="0.28" />
                  <stop offset="100%" stopColor={metricConfig[metric].color} stopOpacity="0" />
                </linearGradient>
              ))}
            </defs>
            {[0, 25, 50, 75, 100].map((tick) => (
              <line
                key={tick}
                x1={0}
                x2={plotWidth}
                y1={y(tick)}
                y2={y(tick)}
                stroke="var(--border)"
                strokeDasharray={tick === 0 ? undefined : "3 5"}
              />
            ))}

            {visible.disk &&
              data.map((point, index) => (
                <rect
                  key={`disk-${index}`}
                  x={x(index) - barWidth / 2}
                  y={y(point.disk)}
                  width={barWidth}
                  height={top + chartHeight - y(point.disk)}
                  rx={Math.min(4, barWidth / 2)}
                  fill={metricConfig.disk.color}
                  opacity={hovered === null || hovered === index ? 0.45 : 0.2}
                />
              ))}

            {(["memory", "cpu"] as const).map(
              (metric) =>
                visible[metric] &&
                data.length > 0 && (
                  <g key={metric}>
                    <path d={areaPath(metric)} fill={`url(#fill-${metric})`} />
                    <motion.path
                      d={linePath(metric)}
                      fill="none"
                      stroke={metricConfig[metric].color}
                      strokeWidth={2.25}
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      initial={{ pathLength: 0 }}
                      animate={{ pathLength: 1 }}
                      transition={{ duration: 1, ease: "easeOut" }}
                      key={`${metric}-${period}-${data.length}`}
                    />
                  </g>
                ),
            )}

            {hovered !== null && (
              <line
                x1={x(hovered)}
                x2={x(hovered)}
                y1={top}
                y2={top + chartHeight}
                stroke="var(--muted-foreground)"
                strokeOpacity="0.4"
                strokeDasharray="3 3"
              />
            )}
            {hoveredPoint &&
              (["cpu", "memory"] as const).map(
                (metric) =>
                  visible[metric] && (
                    <circle
                      key={metric}
                      cx={x(hovered!)}
                      cy={y(hoveredPoint[metric])}
                      r={4}
                      fill="var(--card)"
                      stroke={metricConfig[metric].color}
                      strokeWidth={2}
                    />
                  ),
              )}

            {data.map((point, index) => (
              <g key={`point-${index}`}>
                {index % labelEvery === 0 && (
                  <text x={x(index)} y={height - 14} textAnchor="middle" className="fill-muted-foreground text-[11px]">
                    {point.label}
                  </text>
                )}
                <rect
                  x={x(index) - step / 2}
                  y={top}
                  width={step}
                  height={chartHeight + 30}
                  fill="transparent"
                  onMouseEnter={() => setHovered(index)}
                />
              </g>
            ))}
          </svg>
        </div>

        {hoveredPoint && (
          <div
            className="pointer-events-none absolute top-2 z-10 w-36 rounded-lg border border-border bg-popover/95 p-2.5 text-xs shadow-xl backdrop-blur"
            style={{
              left: Math.min(
                Math.max(yAxisWidth + x(hovered!) - (scrollRef.current?.scrollLeft ?? 0) - 72, 0),
                Math.max(boxWidth - 144, 0),
              ),
            }}
          >
            <p className="mb-1.5 font-medium">{hoveredPoint.label}</p>
            {(Object.keys(metricConfig) as Metric[]).map((metric) => (
              <p key={metric} className="flex items-center justify-between gap-2 text-muted-foreground">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full" style={{ background: metricConfig[metric].color }} />
                  {metricConfig[metric].label}
                </span>
                <span className="font-medium text-foreground">{hoveredPoint[metric]}%</span>
              </p>
            ))}
          </div>
        )}
      </div>
    </GlassCard>
  )
}

function InsightPanel({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { read } = useSynraStore()
  const priorityAlerts = read("alerts")
    .filter((alert) => alert.status !== "Ditutup" && alert.conditionActive !== false)
    .sort((a, b) => severityRank[b.severity] - severityRank[a.severity])

  return (
    <GlassCard className="col-span-12 flex min-w-0 flex-col gap-4 p-5 xl:col-span-4">
      <CardHeading
        title="Prioritas Hari Ini"
        description={`${priorityAlerts.length} alert aktif`}
        actions={
          <Button variant="ghost" size="sm" onClick={() => onNavigate("Alert & Insiden")}>
            Semua <ArrowRight />
          </Button>
        }
      />
      {priorityAlerts.length > 0 ? (
        <div className="relative -mx-1 min-h-0 flex-1">
          <div className="flex max-h-[340px] flex-col gap-2 overflow-y-auto px-1 pb-6">
            {priorityAlerts.map((alert, index) => (
              <motion.button
                key={alert.id}
                type="button"
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: Math.min(index, 8) * 0.04 }}
                onClick={() => onNavigate("Alert & Insiden")}
                className={cn(
                  "group flex flex-col gap-2 rounded-xl border border-border bg-muted/40 p-3 text-left outline-none transition-colors hover:border-primary/30 hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
                  alert.severity === "Critical" && "border-danger/30 bg-danger/[0.05]",
                )}
              >
                <span className="flex items-center justify-between gap-2">
                  <SeverityBadge severity={alert.severity} />
                  <ArrowRight
                    size={14}
                    className="text-muted-foreground opacity-0 transition-all group-hover:translate-x-0.5 group-hover:opacity-100"
                    aria-hidden="true"
                  />
                </span>
                <span className="text-sm font-medium leading-snug">{alert.name}</span>
                {alert.note && <span className="line-clamp-2 text-xs text-muted-foreground">{alert.note}</span>}
              </motion.button>
            ))}
          </div>
          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-8 bg-gradient-to-t from-card to-transparent" />
        </div>
      ) : (
        <div className="flex flex-1 flex-col items-center justify-center gap-2 rounded-xl border border-dashed border-border py-10 text-center">
          <CheckCircle2 size={28} className="text-success" aria-hidden="true" />
          <strong className="text-sm font-medium">Tidak ada alert aktif</strong>
          <span className="type-meta">Semua aman untuk saat ini</span>
        </div>
      )}
    </GlassCard>
  )
}

function AssetDistribution() {
  const { helpers } = useSynraStore()
  const distribution = helpers.assetsByType()
  const total = distribution.reduce((sum, item) => sum + item.count, 0)
  let offset = 0

  return (
    <GlassCard className="col-span-12 flex min-w-0 flex-col gap-5 p-5 md:col-span-6 xl:col-span-4">
      <CardHeading title="Distribusi Aset" description="Per jenis perangkat" />
      <div className="flex flex-col items-center gap-6 sm:flex-row xl:flex-col 2xl:flex-row">
        <div className="relative size-40 shrink-0">
          <svg viewBox="0 0 120 120" className="size-full -rotate-90" aria-label="Distribusi aset">
            <circle cx="60" cy="60" r="46" fill="none" stroke="var(--muted)" strokeWidth="12" />
            {distribution.map((item, index) => {
              const currentOffset = offset
              offset += item.pct
              return (
                <motion.circle
                  key={item.type}
                  cx="60"
                  cy="60"
                  r="46"
                  pathLength="100"
                  fill="none"
                  stroke={donutColors[index % donutColors.length]}
                  strokeWidth="12"
                  strokeDasharray={`${Math.max(item.pct - 1, 0)} ${100 - Math.max(item.pct - 1, 0)}`}
                  strokeDashoffset={-currentOffset}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: index * 0.08 }}
                />
              )
            })}
          </svg>
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            <NumberTicker value={String(total)} className="text-3xl font-semibold tracking-tight" />
            <span className="type-meta">aset</span>
          </div>
        </div>
        <ul className="grid w-full min-w-0 gap-2">
          {distribution.map((item, index) => (
            <li key={item.type} className="flex items-center justify-between gap-3 text-sm">
              <span className="flex min-w-0 items-center gap-2">
                <span
                  className="size-2.5 shrink-0 rounded-sm"
                  style={{ background: donutColors[index % donutColors.length] }}
                  aria-hidden="true"
                />
                <span className="truncate">{item.type}</span>
              </span>
              <span className="shrink-0 text-xs text-muted-foreground">
                {item.count} · {item.pct}%
              </span>
            </li>
          ))}
        </ul>
      </div>
    </GlassCard>
  )
}

function AvailabilityBreakdown() {
  const { api } = useSynraStore()
  const rows = [...(api.availability?.assets ?? [])].sort((a, b) => (a.pct ?? 101) - (b.pct ?? 101))
  const barColor = (pct: number | null) =>
    pct === null ? "bg-muted-foreground/40" : pct >= 99 ? "bg-success" : pct >= 95 ? "bg-warning" : "bg-danger"

  return (
    <GlassCard className="col-span-12 flex min-w-0 flex-col gap-4 p-5 md:col-span-6 xl:col-span-4">
      <CardHeading title="Availability per Aset" description="24 jam terakhir, terendah di atas" />
      <div className="flex max-h-[300px] flex-col gap-3.5 overflow-y-auto pr-1">
        {rows.length === 0 && <p className="type-meta">Belum ada data.</p>}
        {rows.map((row, index) => (
          <div key={row.assetId} className="min-w-0">
            <div className="mb-1.5 flex items-baseline justify-between gap-3">
              <span className="truncate text-sm">{row.hostname}</span>
              <span className="shrink-0 text-xs font-medium tabular-nums">
                {row.pct === null ? "—" : `${row.pct.toLocaleString("id-ID")}%`}
              </span>
            </div>
            <div className="h-1.5 overflow-hidden rounded-full bg-muted">
              <motion.div
                className={cn("h-full rounded-full", barColor(row.pct))}
                initial={{ width: 0 }}
                animate={{ width: `${row.pct ?? 0}%` }}
                transition={{ duration: 0.8, delay: Math.min(index, 10) * 0.04, ease: "easeOut" }}
              />
            </div>
            <span className="mt-1 block truncate text-[11px] text-muted-foreground">{row.host}</span>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}

function RecentActivity() {
  const { read } = useSynraStore()
  const entries = [...read("audit")]
    .sort((a, b) => new Date(b.time).getTime() - new Date(a.time).getTime())
    .slice(0, 6)
  const fmt = new Intl.DateTimeFormat("id-ID", { day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit" })

  return (
    <GlassCard className="col-span-12 flex min-w-0 flex-col gap-4 p-5 xl:col-span-4">
      <CardHeading title="Aktivitas Terbaru" description="Dari audit trail" />
      {entries.length === 0 ? (
        <p className="type-meta">Belum ada aktivitas.</p>
      ) : (
        <ol className="relative flex flex-col gap-4 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-border">
          {entries.map((entry) => (
            <li key={entry.id} className="relative min-w-0 pl-6">
              <span className="absolute left-0 top-1.5 size-[11px] rounded-full border-2 border-card bg-primary/80 ring-1 ring-primary/30" />
              <p className="text-[13.5px] leading-snug">
                <strong className="font-medium">{entry.user}</strong>{" "}
                <span className="text-muted-foreground">·</span> {entry.action}
              </p>
              <span className="mt-0.5 block truncate text-xs text-muted-foreground">
                {entry.detail !== "—" && `${entry.detail} · `}
                {fmt.format(new Date(entry.time))}
              </span>
            </li>
          ))}
        </ol>
      )}
    </GlassCard>
  )
}

function LocationStatus() {
  const { read } = useSynraStore()
  const assets = read("assets")
  const hosts = [...new Set(assets.map((asset) => asset.location))].sort()

  return (
    <GlassCard className="col-span-12 flex min-w-0 flex-col gap-4 p-5">
      <CardHeading title="Status per Host" description={`${hosts.length} host terpantau`} />
      <div className="grid grid-cols-[repeat(auto-fill,minmax(min(100%,220px),1fr))] gap-3">
        {hosts.map((host) => {
          const hostAssets = assets.filter((asset) => asset.location === host)
          const count = (status: string) => hostAssets.filter((asset) => asset.backendStatus === status).length
          const online = count("ONLINE")
          const critical = count("CRITICAL")
          const warning = count("WARNING")
          const stale = count("STALE")
          const state = critical || stale ? "danger" : warning ? "warning" : "success"
          return (
            <div key={host} className="min-w-0 rounded-xl border border-border bg-muted/30 p-4">
              <div className="mb-3 flex items-center gap-2">
                <span
                  className={cn(
                    "size-2 shrink-0 rounded-full",
                    state === "danger" ? "bg-danger animate-pulse-ring" : state === "warning" ? "bg-warning" : "bg-success",
                  )}
                  aria-hidden="true"
                />
                <strong className="truncate text-sm font-medium">{host}</strong>
              </div>
              <dl className="grid grid-cols-3 gap-2 text-center">
                {[
                  ["Daring", `${online}/${hostAssets.length}`, "text-foreground"],
                  ["Warn/Krit", `${warning}/${critical}`, critical ? "text-danger" : warning ? "text-warning" : "text-foreground"],
                  ["Stale", String(stale), stale ? "text-danger" : "text-foreground"],
                ].map(([label, value, tone]) => (
                  <div key={label} className="rounded-lg bg-card/70 px-1 py-2">
                    <dd className={cn("text-base font-semibold tabular-nums", tone)}>{value}</dd>
                    <dt className="mt-0.5 truncate text-[10.5px] text-muted-foreground">{label}</dt>
                  </div>
                ))}
              </dl>
            </div>
          )
        })}
      </div>
    </GlassCard>
  )
}

export default function Dashboard({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { error } = useSynraStore()
  const kpiCards = useKpiCards()

  return (
    <div className="grid min-w-0 grid-cols-12 gap-4 md:gap-6">
      {error && (
        <div className="col-span-12">
          <ApiErrorBanner message={error} />
        </div>
      )}

      <div className="col-span-12 grid grid-cols-2 gap-3 sm:grid-cols-3 md:gap-4 xl:grid-cols-6">
        {kpiCards.map((card, index) => (
          <motion.div
            key={card.id}
            className="min-w-0 [&>*]:h-full"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: index * 0.05, duration: 0.35 }}
          >
            <KpiCard
              label={card.label}
              value={card.value}
              tag={card.tag}
              tone={card.tone}
              note={card.note}
              onAction={() => onNavigate(kpiDestinations[card.id])}
            />
          </motion.div>
        ))}
      </div>

      <UtilizationChart />
      <InsightPanel onNavigate={onNavigate} />
      <AssetDistribution />
      <AvailabilityBreakdown />
      <RecentActivity />
      <LocationStatus />
    </div>
  )
}
