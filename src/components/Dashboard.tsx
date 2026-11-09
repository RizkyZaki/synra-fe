import { useEffect, useMemo, useRef, useState } from "react"
import { useAccess } from "../lib/useAccess"
import { useSynraStore, useUtilization } from "../lib/useSynraStore"
import { formatDateTime } from "../lib/backend"
import { ApiErrorBanner, GlassCard, KpiCard, SeverityBadge } from "./ui"

type Period = "24 jam" | "7 hari" | "30 hari"
type Metric = "cpu" | "memory" | "disk"

const metricConfig: Record<Metric, {
  label: string
  color: string
  chartType: "line" | "bar"
}> = {
  cpu: {
    label: "CPU",
    color: "var(--primary-700)",
    chartType: "line",
  },
  memory: {
    label: "Memory",
    color: "var(--chart-memory)",
    chartType: "line",
  },
  disk: {
    label: "Disk",
    color: "var(--chart-disk)",
    chartType: "bar",
  },
}

const donutColors = [
  "var(--primary-700)",
  "var(--primary-400)",
  "var(--success-500)",
  "var(--warning-500)",
  "var(--danger-500)",
  "var(--secondary-400)",
  "var(--primary-200)",
]

const kpiDestinations: Record<string, string> = {
  online: "Inventaris Aset",
  stale: "Inventaris Aset",
  alerts: "Alert & Insiden",
  critical: "Alert & Insiden",
  availability: "Availability & Performa",
  licenses: "Lisensi Software",
}

type Tone = "good" | "warning" | "high" | "critical"

/**
 * Kartu KPI. Aset/alert/stale/availability dari backend (/dashboard/summary, /dashboard/availability).
 * Lisensi masih dari data Lifecycle di FE (contoh) karena backend lisensi belum ada.
 */
function useKpiCards() {
  const { helpers, api, read } = useSynraStore()
  const k = helpers.dashboardKpi()
  const sev = api.summary?.openAlertsBySeverity
  const pct = k.totalAssets ? Math.round((k.online / k.totalAssets) * 100) : 0

  const licenses = read("lifecycle").filter((item) => item.type === "licenses")
  const activeLicenses = licenses.filter(
    (item) => item.status === "Aktif" && helpers.daysUntil(item.expiry) >= 0,
  )
  const expiring = activeLicenses
    .filter((item) => helpers.daysUntil(item.expiry) <= 30)
    .sort((a, b) => helpers.daysUntil(a.expiry) - helpers.daysUntil(b.expiry))

  return [
    {
      id: "online",
      label: "Aset online",
      value: `${k.online}/${k.totalAssets}`,
      tag: `${pct}%`,
      tone: (pct >= 80 ? "good" : "warning") as Tone,
      description: `${k.warning} warning · ${api.summary?.critical ?? 0} critical`,
      note: `${k.totalAssets - k.online} perlu perhatian`,
    },
    {
      id: "licenses",
      label: "Lisensi aktif",
      value: `${activeLicenses.length}/${licenses.length}`,
      tag: "H-30",
      tone: (expiring.length > 0 ? "warning" : "good") as Tone,
      description: `${expiring.length} habis ≤ 30 hari`,
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
      description: "Belum ditutup",
      // Ringkas agar muat di kartu; rincian per severity ada di halaman Alert.
      note: sev
        ? `${sev.CRITICAL + sev.HIGH} tinggi · ${sev.MEDIUM + sev.LOW + sev.INFO} lainnya`
        : "—",
    },
    {
      id: "critical",
      label: "Critical",
      value: String(k.critical),
      tag: "P1",
      tone: (k.critical > 0 ? "critical" : "good") as Tone,
      description: "Perlu tindakan segera",
      note: "Belum ditutup",
    },
    {
      id: "stale",
      label: "Host stale",
      value: String(k.stale),
      tag: "5 mnt",
      tone: (k.stale > 0 ? "critical" : "good") as Tone,
      description: "Tidak mengirim data",
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
      description: "Semua aset aktif",
      note: "Data per menit",
    },
  ]
}

function UtilizationChart() {
  const [period, setPeriod] = useState<Period>("24 jam")
  const [hovered, setHovered] = useState<number | null>(null)
  const [visible, setVisible] = useState<Record<Metric, boolean>>({
    cpu: true,
    memory: true,
    disk: true,
  })
  const { data, error } = useUtilization(period)
  const scrollRef = useRef<HTMLDivElement>(null)

  const height = 260
  const top = 18
  const chartHeight = 188
  const yAxisWidth = 46

  // Batasi agar 1 view layar menampilkan sekitar 6 jam (step ~105px).
  // Dengan 24 jam (25 titik), grafik melebar dan bisa di-scroll horizontal tanpa berdempetan.
  const isScrollable = data.length > 6
  const baseStep = period === "24 jam" ? 105 : 95
  const pointsCount = Math.max(data.length - 1, 1)
  const padX = 28
  const plotSvgWidth = isScrollable
    ? padX * 2 + pointsCount * baseStep
    : 640
  const step = isScrollable
    ? baseStep
    : (plotSvgWidth - padX * 2) / pointsCount

  const x = (index: number) =>
    data.length === 1 ? plotSvgWidth / 2 : padX + step * index
  const y = (value: number) => top + ((100 - value) / 100) * chartHeight

  const barWidth = isScrollable ? 22 : Math.min(24, step * 0.48)

  const linePoints = (metric: "cpu" | "memory") =>
    data.map((point, index) => `${x(index)},${y(point[metric])}`).join(" ")

  // Auto scroll ke ujung kanan (waktu terbaru) saat data 24 jam dimuat atau periode berubah
  useEffect(() => {
    if (scrollRef.current && isScrollable) {
      scrollRef.current.scrollLeft = scrollRef.current.scrollWidth
    }
  }, [period, data.length, isScrollable])

  return (
    <GlassCard className="dashboard-card utilization-card">
      <div className="dashboard-card__header">
        <div>
          <span className="pretext">MONITORING</span>
          <h3 className="title-h3">Utilisasi CPU / Memori / Disk</h3>
        </div>
        <div className="period-filter" aria-label="Periode grafik">
          {(["24 jam", "7 hari", "30 hari"] as Period[]).map((option) => (
            <button
              key={option}
              className={period === option ? "period-filter__active" : ""}
              onClick={() => {
                setPeriod(option)
                setHovered(null)
              }}
            >
              {option}
            </button>
          ))}
        </div>
      </div>

      <div className="chart-legend">
        {(Object.keys(metricConfig) as Metric[]).map((metric) => (
          <button
            key={metric}
            className={visible[metric] ? "chart-legend__active" : ""}
            onClick={() =>
              setVisible((current) => ({
                ...current,
                [metric]: !current[metric],
              }))
            }
          >
            <span
              className={`chart-legend__line chart-legend__line--${metric}`}
            />
            <span>{metricConfig[metric].label}</span>
          </button>
        ))}
      </div>

      {error && <p className="small-copy text-muted">{error}</p>}
      {!error && data.length === 0 && (
        <p className="small-copy text-muted">Belum ada data metrik pada periode ini.</p>
      )}
      <div className="chart-shell">
        <div className="chart-wrapper">
          {/* Sumbu Y Tetap di Kiri */}
          <div className="chart-y-axis" aria-hidden="true">
            <svg
              width={yAxisWidth}
              height={height}
              viewBox={`0 0 ${yAxisWidth} ${height}`}
            >
              {[0, 25, 50, 75, 100].map((tick) => {
                const tickY = y(tick)
                return (
                  <text
                    key={tick}
                    x={yAxisWidth - 8}
                    y={tickY + 4}
                    className="chart-axis-label"
                  >
                    {tick}%
                  </text>
                )
              })}
            </svg>
          </div>

          {/* Area Grafik yang Bisa Di-scroll Horizontal */}
          <div className="chart-scroll" ref={scrollRef}>
            <svg
              width={plotSvgWidth}
              height={height}
              viewBox={`0 0 ${plotSvgWidth} ${height}`}
              role="img"
              aria-label={`Grafik utilisasi periode ${period}`}
            >
              {/* Garis Grid Horizontal */}
              {[0, 25, 50, 75, 100].map((tick) => {
                const tickY = y(tick)
                return (
                  <line
                    key={tick}
                    x1={0}
                    x2={plotSvgWidth}
                    y1={tickY}
                    y2={tickY}
                    className="chart-gridline"
                  />
                )
              })}

              {/* Batang Disk */}
              {visible.disk &&
                data.map((point, index) => (
                  <rect
                    key={`disk-${index}`}
                    x={x(index) - barWidth / 2}
                    y={y(point.disk)}
                    width={barWidth}
                    height={top + chartHeight - y(point.disk)}
                    rx="4"
                    fill={metricConfig.disk.color}
                    className="chart-bar"
                  />
                ))}

              {/* Garis CPU */}
              {visible.cpu && (
                <polyline
                  points={linePoints("cpu")}
                  fill="none"
                  stroke={metricConfig.cpu.color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                />
              )}

              {/* Garis Memory */}
              {visible.memory && (
                <polyline
                  points={linePoints("memory")}
                  fill="none"
                  stroke={metricConfig.memory.color}
                  strokeWidth="2.5"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeDasharray="6 4"
                />
              )}

              {/* Titik & Label Jam Sumbu X */}
              {data.map((point, index) => (
                <g key={`point-${index}`}>
                  <text
                    x={x(index)}
                    y={height - 16}
                    className="chart-axis-label chart-axis-label--x"
                  >
                    {point.label}
                  </text>
                  <rect
                    x={x(index) - step / 2}
                    y={top}
                    width={step}
                    height={chartHeight + 30}
                    fill="transparent"
                    onMouseEnter={() => setHovered(index)}
                    onMouseLeave={() => setHovered(null)}
                  />
                </g>
              ))}

              {/* Tooltip Saat Hover */}
              {hovered !== null && data[hovered] && (
                <g
                  transform={`translate(${Math.min(
                    Math.max(x(hovered) - 65, 8),
                    plotSvgWidth - 138,
                  )}, 24)`}
                  className="chart-tooltip"
                >
                  <rect width="130" height="78" rx="10" />
                  <text x="12" y="18" className="chart-tooltip__title">
                    {data[hovered].label}
                  </text>
                  <text x="12" y="36">
                    CPU {data[hovered].cpu}%
                  </text>
                  <text x="12" y="53">
                    Memory {data[hovered].memory}%
                  </text>
                  <text x="12" y="70">
                    Disk {data[hovered].disk}%
                  </text>
                </g>
              )}
            </svg>
          </div>
        </div>
      </div>
    </GlassCard>
  )
}

function AssetDistribution() {
  const { helpers } = useSynraStore()
  const distribution = helpers.assetsByType()
  let offset = 0

  return (
    <GlassCard className="dashboard-card asset-distribution">
      <div className="dashboard-card__header">
        <div>
          <span className="pretext">ASET</span>
          <h3 className="title-h3">Distribusi aset per jenis</h3>
        </div>
      </div>
      <div className="donut-layout">
        <div className="donut-chart">
          <svg viewBox="0 0 120 120" aria-label="Distribusi aset">
            <circle
              cx="60"
              cy="60"
              r="44"
              fill="none"
              stroke="var(--glass-divider)"
              strokeWidth="18"
            />
            {distribution.map((item, index) => {
              const currentOffset = offset
              offset += item.pct
              return (
                <circle
                  key={item.type}
                  cx="60"
                  cy="60"
                  r="44"
                  pathLength="100"
                  fill="none"
                  stroke={donutColors[index % donutColors.length]}
                  strokeWidth="18"
                  strokeDasharray={`${item.pct} ${100 - item.pct}`}
                  strokeDashoffset={-currentOffset}
                  transform="rotate(-90 60 60)"
                />
              )
            })}
          </svg>
          <div>
            <strong className="bigcopy">
              {distribution.reduce((sum, item) => sum + item.count, 0)}
            </strong>
            <span className="label text-muted">Aset</span>
          </div>
        </div>
        <div className="donut-legend">
          {distribution.map((item, index) => (
            <div key={item.type}>
              <span
                className="small-copy"
                style={{ color: donutColors[index % donutColors.length] }}
              >
                {item.type}
              </span>
              <span className="label text-muted">
                {item.count} · {item.pct}%
              </span>
            </div>
          ))}
        </div>
      </div>
    </GlassCard>
  )
}

function AvailabilityBreakdown() {
  const { api } = useSynraStore()
  const rows = [...(api.availability?.assets ?? [])].sort(
    (a, b) => (a.pct ?? 101) - (b.pct ?? 101),
  )
  const tone = (pct: number | null) =>
    pct === null ? "risk" : pct >= 99.5 ? "healthy" : pct >= 99 ? "good" : pct >= 95 ? "warning" : "risk"
  return (
    <GlassCard className="dashboard-card health-breakdown">
      <div className="dashboard-card__header">
        <div>
          <span className="pretext">AVAILABILITY</span>
          <h3 className="title-h3">Availability per aset (24 jam)</h3>
        </div>
      </div>
      <div className="health-list">
        {rows.length === 0 && <p className="small-copy text-muted">Belum ada data.</p>}
        {rows.map((row) => (
          <div className="health-row" key={row.assetId}>
            <div className="health-row__label">
              <span className="small-copy">{row.hostname}</span>
              <span className="label text-muted">
                {row.host} ·{" "}
                {row.pct === null ? "belum ada data" : `${row.pct.toLocaleString("id-ID")}%`}
              </span>
            </div>
            <div className="health-track">
              <span
                className={`health-fill health-fill--${tone(row.pct)}`}
                style={{ width: `${row.pct ?? 0}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}

function LocationStatus() {
  const { read } = useSynraStore()
  const assets = read("assets")
  const hosts = [...new Set(assets.map((asset) => asset.location))].sort()

  return (
    <GlassCard className="dashboard-card location-status">
      <div className="dashboard-card__header">
        <div>
          <span className="pretext">Host</span>
          <h3 className="title-h3">Status per Host</h3>
        </div>
      </div>
      <div className="location-status__grid">
        {hosts.map((host) => {
          const hostAssets = assets.filter((asset) => asset.location === host)
          const count = (status: string) =>
            hostAssets.filter((asset) => asset.backendStatus === status).length
          return (
            <div className="location-mini" key={host}>
              <div className="location-mini__title">
                <strong className="small-copy">{host}</strong>
              </div>
              <dl>
                <div>
                  <dt>Daring</dt>
                  <dd>
                    {count("ONLINE")}/{hostAssets.length}
                  </dd>
                </div>
                <div>
                  <dt>Warning / critical</dt>
                  <dd>
                    {count("WARNING")} / {count("CRITICAL")}
                  </dd>
                </div>
                <div>
                  <dt>Stale</dt>
                  <dd>{count("STALE")}</dd>
                </div>
              </dl>
            </div>
          )
        })}
      </div>
    </GlassCard>
  )
}

function InsightPanel({ onNavigate }: { onNavigate: (page: string) => void }) {
  const { read } = useSynraStore()
  const priorityAlerts = read("alerts")
    .filter((alert) => alert.status !== "Ditutup" && alert.conditionActive !== false)
    .sort((a, b) => severityRank[b.severity] - severityRank[a.severity])
  const listRef = useRef<HTMLDivElement>(null)
  const scrollTimerRef = useRef<number | null>(null)
  const [atBottom, setAtBottom] = useState(true)
  const [scrolling, setScrolling] = useState(false)

  const updateScrollState = () => {
    const list = listRef.current
    if (!list) return
    setAtBottom(
      list.scrollHeight - list.scrollTop <= list.clientHeight + 1,
    )
  }

  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const frame = window.requestAnimationFrame(updateScrollState)
    const observer = new ResizeObserver(updateScrollState)
    observer.observe(list)
    return () => {
      window.cancelAnimationFrame(frame)
      observer.disconnect()
      if (scrollTimerRef.current !== null) {
        window.clearTimeout(scrollTimerRef.current)
      }
    }
  }, [priorityAlerts.length])

  const handleScroll = () => {
    updateScrollState()
    setScrolling(true)
    if (scrollTimerRef.current !== null) {
      window.clearTimeout(scrollTimerRef.current)
    }
    scrollTimerRef.current = window.setTimeout(() => setScrolling(false), 700)
  }

  return (
    <GlassCard className="dashboard-card insight-panel">
      <div className="dashboard-card__header">
        <div>
          <span className="pretext">PRIORITAS</span>
          <h3 className="title-h3">Prioritas hari ini</h3>
        </div>
      </div>
      {priorityAlerts.length > 0 ? (
        <div
          className={`priority-scroll ${
            atBottom ? "priority-scroll--at-bottom" : ""
          }`}
        >
          <div
            ref={listRef}
            className={`insight-list ${
              scrolling ? "insight-list--scrolling" : ""
            }`}
            onScroll={handleScroll}
          >
            {priorityAlerts.map((alert) => (
              <article className="insight-item" key={alert.id}>
                <div className="insight-item__top">
                  <SeverityBadge severity={alert.severity} />
                </div>
                <div>
                  <h4 className="strong">{alert.name}</h4>
                  <p className="small-copy">{alert.note}</p>
                </div>
                <button
                  className="insight-link"
                  onClick={() => onNavigate("Alert & Insiden")}
                >
                  Lihat Detail
                </button>
              </article>
            ))}
          </div>
        </div>
      ) : (
        <div className="priority-empty">
          <strong className="small-copy">
            Tidak ada alert aktif
          </strong>
          <span className="label text-muted">Semua aman untuk saat ini</span>
        </div>
      )}
    </GlassCard>
  )
}

const severityRank = {
  Normal: 0,
  Info: 1,
  Low: 2,
  Medium: 3,
  High: 4,
  Critical: 5,
  Expired: 6,
} as const

function ExecutiveSummary() {
  const { read, helpers } = useSynraStore()
  const alerts = [...read("alerts")]
    .filter((alert) => alert.status !== "Ditutup")
    .sort((a, b) => severityRank[b.severity] - severityRank[a.severity])
    .slice(0, 3)
  const assets = read("assets")
  const k = helpers.dashboardKpi()
  const online = assets.filter((asset) => asset.status === "Online").length

  return (
    <GlassCard className="executive-dashboard">
      <div className="section-heading">
        <span className="pretext">MANAJEMEN</span>
        <h3 className="title-h3">Ringkasan eksekutif</h3>
      </div>
      <div className="executive-dashboard__grid">
        <div>
          <span className="label text-muted">3 alert teratas</span>
          {alerts.map((alert) => (
            <span className="small-copy" key={alert.id}>
              {alert.name} · {alert.severity}
            </span>
          ))}
        </div>
        <div>
          <span className="label text-muted">Aset daring</span>
          <strong className="small-copy">
            {online}/{assets.length}
          </strong>
        </div>
        <div>
          <span className="label text-muted">Host stale</span>
          <strong className="bigcopy">{k.stale}</strong>
        </div>
        <div>
          <span className="label text-muted">Availability 24 jam</span>
          <strong className="bigcopy">
            {k.availabilityPct === null ? "—" : `${k.availabilityPct.toLocaleString("id-ID")}%`}
          </strong>
        </div>
      </div>
    </GlassCard>
  )
}

function AlertFunnel() {
  const { helpers } = useSynraStore()
  const funnel = helpers.alertFunnel()
  return (
    <GlassCard className="dashboard-card alert-funnel">
      <div className="dashboard-card__header">
        <div>
          <h3 className="title-h3">Tahap alert</h3>
        </div>
      </div>
      <div className="funnel-list">
        {funnel.map((stage, index) => (
          <div className="funnel-stage" key={stage.status}>
            <span className="funnel-stage__count">{stage.count}</span>
            <span className="label">{stage.status}</span>
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
    .slice(0, 5)

  return (
    <GlassCard className="dashboard-card recent-activity">
      <div className="dashboard-card__header">
        <div>
          <span className="pretext">AUDIT TRAIL</span>
          <h3 className="title-h3">Aktivitas terbaru</h3>
        </div>
      </div>
      <div className="activity-list">
        {entries.map((entry) => (
          <div className="activity-item" key={entry.id}>
            <div>
              <p className="small-copy">
                <strong>{entry.user}</strong> · {entry.action}
              </p>
              <span className="label text-muted">
                {entry.detail !== "—" && `${entry.detail} · `}
                {new Intl.DateTimeFormat("id-ID", {
                  day: "2-digit",
                  month: "short",
                  hour: "2-digit",
                  minute: "2-digit",
                }).format(new Date(entry.time))}
              </span>
            </div>
          </div>
        ))}
      </div>
    </GlassCard>
  )
}

export default function Dashboard({
  onNavigate,
}: {
  onNavigate: (page: string) => void
}) {
  const { capabilities } = useAccess()
  const { error } = useSynraStore()
  const kpiCards = useKpiCards()

  return (
    <div className="dashboard-grid">
      {error && (
        <div style={{ gridColumn: "1 / -1" }}>
          <ApiErrorBanner message={error} />
        </div>
      )}
      <div className="dashboard-kpis">
        {kpiCards.map((card) => (
          <KpiCard
            key={card.id}
            label={card.label}
            value={card.value}
            tag={card.tag}
            tone={card.tone}
            description={card.description}
            note={card.note}
            onAction={() => onNavigate(kpiDestinations[card.id])}
          />
        ))}
      </div>

      {capabilities.executiveSummary && <ExecutiveSummary />}
      <UtilizationChart />
      <InsightPanel onNavigate={onNavigate} />
      <AssetDistribution />
      <AvailabilityBreakdown />
      <LocationStatus />
      <AlertFunnel />
      <RecentActivity />
    </div>
  )
}
