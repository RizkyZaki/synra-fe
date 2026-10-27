import { useEffect, useMemo, useRef, useState } from "react"
import { alertsForRole, kpiCards } from "../seed"
import { useAccess } from "../lib/useAccess"
import { useSynraStore } from "../lib/useSynraStore"
import { GlassCard, KpiCard, SeverityBadge } from "./ui"

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
  health: "Kesehatan Infrastruktur",
  online: "Inventaris Aset",
  alerts: "Alert & Insiden",
  critical: "Alert & Insiden",
  expiring: "Lisensi Software",
}

function UtilizationChart() {
  const { helpers } = useSynraStore()
  const [period, setPeriod] = useState<Period>("24 jam")
  const [hovered, setHovered] = useState<number | null>(null)
  const [visible, setVisible] = useState<Record<Metric, boolean>>({
    cpu: true,
    memory: true,
    disk: true,
  })
  const data = helpers.utilizationSeries(period)
  const width = 760
  const height = 260
  const left = 42
  const top = 18
  const chartWidth = 700
  const chartHeight = 188
  const step = chartWidth / Math.max(data.length - 1, 1)
  const x = (index: number) => left + step * index
  const y = (value: number) => top + ((100 - value) / 100) * chartHeight
  const linePoints = (metric: "cpu" | "memory") =>
    data.map((point, index) => `${x(index)},${y(point[metric])}`).join(" ")

  return (
    <GlassCard className="dashboard-card utilization-card">
      <div className="dashboard-card__header">
        <div>
          <span className="pretext">MONITORING</span>
          <h3 className="title-h3">Utilisasi CPU / memori / disk</h3>
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

      <div className="chart-shell">
        <svg
          viewBox={`0 0 ${width} ${height}`}
          role="img"
          aria-label={`Grafik utilisasi periode ${period}`}
        >
          {[0, 25, 50, 75, 100].map((tick) => {
            const tickY = y(tick)
            return (
              <g key={tick}>
                <line
                  x1={left}
                  x2={left + chartWidth}
                  y1={tickY}
                  y2={tickY}
                  className="chart-gridline"
                />
                <text x={left - 10} y={tickY + 4} className="chart-axis-label">
                  {tick}%
                </text>
              </g>
            )
          })}

          {visible.disk &&
            data.map((point, index) => (
              <rect
                key={`disk-${point.label}`}
                x={x(index) - Math.min(12, step * 0.24)}
                y={y(point.disk)}
                width={Math.min(24, step * 0.48)}
                height={top + chartHeight - y(point.disk)}
                rx="4"
                fill={metricConfig.disk.color}
                className="chart-bar"
              />
            ))}

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

          {data.map((point, index) => (
            <g key={`point-${point.label}`}>
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
                width={Math.max(step, 24)}
                height={chartHeight + 30}
                fill="transparent"
                onMouseEnter={() => setHovered(index)}
              />
            </g>
          ))}

          {hovered !== null && (
            <g
              transform={`translate(${Math.min(
                Math.max(x(hovered) - 60, left),
                width - 140,
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

function HealthBreakdown() {
  const { helpers } = useSynraStore()
  return (
    <GlassCard className="dashboard-card health-breakdown">
      <div className="dashboard-card__header">
        <div>
          <span className="pretext">HEALTH SCORE</span>
          <h3 className="title-h3">Rincian skor kesehatan</h3>
        </div>
      </div>
      <div className="health-list">
        {helpers.healthDimensions.map((dimension) => (
          <div className="health-row" key={dimension.key}>
            <div className="health-row__label">
              <span className="small-copy">{dimension.key}</span>
              <span className="label text-muted">
                Bobot {dimension.weight}% · Skor {dimension.score}
              </span>
            </div>
            <div className="health-track">
              <span
                className={`health-fill health-fill--${
                  dimension.score >= 90
                    ? "healthy"
                    : dimension.score >= 80
                      ? "good"
                      : dimension.score >= 70
                        ? "warning"
                        : "risk"
                }`}
                style={{ width: `${dimension.score}%` }}
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
  const backup = assets.find((asset) => asset.name === "BACKUP-MASTER01")
  const drcDatabase = assets.find((asset) => asset.name === "CBS-DB-DRC01")
  const locations = ["DC Serpong", "DRC Surabaya"] as const

  return (
    <GlassCard className="dashboard-card location-status">
      <div className="dashboard-card__header">
        <div>
          <span className="pretext">LOKASI</span>
          <h3 className="title-h3">Status DC vs DRC</h3>
        </div>
      </div>
      <div className="location-status__grid">
        {locations.map((location) => {
          const locationAssets = assets.filter(
            (asset) => asset.location === location,
          )
          const online = locationAssets.filter(
            (asset) => asset.status === "Online",
          ).length
          return (
            <div className="location-mini" key={location}>
              <div className="location-mini__title">
                <strong className="small-copy">{location}</strong>
              </div>
              <dl>
                <div>
                  <dt>Daring</dt>
                  <dd>
                    {online}/{locationAssets.length}
                  </dd>
                </div>
                <div>
                  <dt>Replication lag</dt>
                  <dd>
                    {location === "DRC Surabaya"
                      ? (drcDatabase?.note.match(/lag ([^•]+)/)?.[1] ?? "—")
                      : "—"}
                  </dd>
                </div>
                <div>
                  <dt>Backup terakhir</dt>
                  <dd>
                    {location === "DRC Surabaya"
                      ? (backup?.note.split("last success ")[1] ?? "—")
                      : "—"}
                  </dd>
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
  const { user } = useAccess()
  const priorityAlerts = [...alertsForRole(user.role)].sort(
    (a, b) => severityRank[b.severity] - severityRank[a.severity],
  )
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
                  <h4 className="strong">{alert.title}</h4>
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
            Tidak ada alert untuk area Anda
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
  const lifecycleCritical = read("lifecycle").filter(
    (item) => helpers.lifecycleSeverity(helpers.daysUntil(item.expiry)) === "Critical",
  ).length
  const pending = read("requests").filter(
    (request) => request.status === "Menunggu",
  ).length
  const readiness = (location: "DC Serpong" | "DRC Surabaya") => {
    const locationAssets = assets.filter((asset) => asset.location === location)
    return `${locationAssets.filter((asset) => asset.status === "Online").length}/${locationAssets.length}`
  }

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
          <span className="label text-muted">Kesiapan DC / DRC</span>
          <strong className="small-copy">
            {readiness("DC Serpong")} · {readiness("DRC Surabaya")}
          </strong>
        </div>
        <div>
          <span className="label text-muted">Siklus hidup kritis</span>
          <strong className="bigcopy">{lifecycleCritical}</strong>
        </div>
        <div>
          <span className="label text-muted">Pengajuan menunggu</span>
          <strong className="bigcopy">{pending}</strong>
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
          <span className="pretext">OPERASI</span>
          <h3 className="title-h3">Tahapan alert</h3>
        </div>
      </div>
      <div className="funnel-list">
        {funnel.map((stage, index) => (
          <div className="funnel-stage" key={stage.status}>
            <span className="funnel-stage__count">{stage.count}</span>
            <span className="label">{stage.status}</span>
            {index < funnel.length - 1 && <span aria-hidden="true">→</span>}
          </div>
        ))}
      </div>
    </GlassCard>
  )
}

function ExpiryList() {
  const { read, helpers } = useSynraStore()
  const items = useMemo(
    () =>
      [...read("lifecycle")]
        .sort(
          (a, b) => helpers.daysUntil(a.expiry) - helpers.daysUntil(b.expiry),
        )
        .slice(0, 5),
    [helpers, read],
  )

  return (
    <GlassCard className="dashboard-card expiry-list">
      <div className="dashboard-card__header">
        <div>
          <span className="pretext">LIFECYCLE</span>
          <h3 className="title-h3">Kedaluwarsa terdekat</h3>
        </div>
      </div>
      <div className="compact-list">
        {items.map((item) => {
          const days = helpers.daysUntil(item.expiry)
          const severity = helpers.lifecycleSeverity(days)
          return (
            <div className="compact-list__row" key={item.id}>
              <div>
                <strong className="small-copy">{item.name}</strong>
                <span className="label text-muted">{item.location}</span>
              </div>
              <span className="small-copy">H-{days}</span>
              <SeverityBadge
                severity={severity === "Expired" ? "Critical" : severity}
              />
            </div>
          )
        })}
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
                {entry.detail} ·{" "}
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

  return (
    <div className="dashboard-grid">
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
      <HealthBreakdown />
      <LocationStatus />
      <ExpiryList />
      <RecentActivity />
    </div>
  )
}
