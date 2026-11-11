import {
  DatabaseBackup,
  Lock,
  RefreshCw,
  Search,
} from "lucide-react"
import { motion } from "motion/react"
import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react"
import { ApiError, apiFetch } from "../lib/api"
import {
  type BackupHealth,
  type BackupJobDto,
  type BackupJobsDto,
  type BackupRunDto,
  type Paginated,
  type SecurityOverviewDto,
  formatBytes,
  formatDateTime,
  relativeTime,
} from "../lib/backend"
import { useAccess } from "../lib/useAccess"
import {
  CardHeading,
  DataTable,
  Drawer,
  EmptyState,
  ErrorState,
  FilterField,
  GlassCard,
  LoadingState,
  PageToolbar,
  Pagination,
  StatusBadge,
  usePagination,
  type DataTableColumn,
} from "./ui"
import { NumberTicker } from "@/components/aceternity/number-ticker"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

const REFRESH_MS = 60_000

const TONE_TEXT = { danger: "text-danger", warning: "text-warning", success: "text-success" } as const

const HEALTH_LABEL: Record<BackupHealth, string> = { OK: "Berhasil", FAILED: "Gagal", OVERDUE: "Terlambat" }
const HEALTH_TONE: Record<BackupHealth, "success" | "danger" | "warning"> = { OK: "success", FAILED: "danger", OVERDUE: "warning" }
const HEALTH_ITEMS: Record<string, string> = { Semua: "Semua", FAILED: "Gagal", OVERDUE: "Terlambat", OK: "Berhasil" }

const AUDIT_ACTION_LABEL: Record<string, string> = {
  ACCOUNT_LOCKED: "Akun terkunci",
  USER_CREATE: "Pengguna ditambahkan",
  USER_UPDATE: "Pengguna diubah",
  USER_UNLOCK: "Akun dibuka",
  USER_RESET_PASSWORD: "Reset kata sandi",
  PASSWORD_CHANGE: "Kata sandi diganti",
  THRESHOLD_UPDATE: "Threshold diubah",
  THRESHOLD_CREATE: "Threshold dibuat",
  THRESHOLD_DELETE: "Threshold dihapus",
  ESCALATION_UPDATE: "Matriks eskalasi diubah",
}

/** Memuat data dari endpoint dan menyegarkannya berkala. */
function usePolling<T>(path: string | null) {
  const [data, setData] = useState<T | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(Boolean(path))
  const load = useCallback(() => {
    if (!path) return
    apiFetch<T>(path)
      .then((res) => {
        setData(res)
        setError("")
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Data tidak dapat dimuat"))
      .finally(() => setLoading(false))
  }, [path])
  useEffect(() => {
    load()
    if (!path) return
    const timer = setInterval(load, REFRESH_MS)
    return () => clearInterval(timer)
  }, [load, path])
  return { data, error, loading, reload: load }
}

function Stat({
  label,
  value,
  hint,
  tone,
}: {
  label: string
  value: string | number
  hint?: string
  tone?: "danger" | "warning" | "success"
}) {
  return (
    <GlassCard className="flex min-w-0 flex-col gap-2 p-4 md:p-5">
      <span className="type-label truncate text-muted-foreground">{label}</span>
      <NumberTicker
        value={String(value)}
        className={cn(
          "block truncate text-2xl font-semibold tracking-tight md:text-[28px]",
          tone && Number(String(value).split("/")[0]) > 0 && TONE_TEXT[tone],
        )}
      />
      {hint && <p className="type-meta truncate" title={hint}>{hint}</p>}
    </GlassCard>
  )
}

function SectionTitle({ title, description, actions }: { title: string; description: string; actions?: ReactNode }) {
  return (
    <div className="flex flex-wrap items-end justify-between gap-3">
      <div className="min-w-0">
        <h2 className="text-lg font-semibold tracking-tight">{title}</h2>
        <p className="type-meta">{description}</p>
      </div>
      {actions}
    </div>
  )
}

// ── Pencadangan ──────────────────────────────────────────────────────────────

function BackupSection() {
  const { data, error, loading, reload } = usePolling<BackupJobsDto>("/backups/jobs")
  const [search, setSearch] = useState("")
  const [health, setHealth] = useState("Semua")
  const [selected, setSelected] = useState<BackupJobDto | null>(null)

  const jobs = useMemo(() => {
    const q = search.trim().toLowerCase()
    return (data?.jobs ?? []).filter(
      (j) =>
        (health === "Semua" || j.health === health) &&
        (!q || j.asset.hostname.includes(q) || j.jobName.toLowerCase().includes(q) || j.asset.host.name.toLowerCase().includes(q)),
    )
  }, [data, search, health])
  const { page, setPage, totalPages, startIndex, endIndex, totalRows, paginatedRows } = usePagination(jobs, 10)

  if (loading) return <LoadingState />
  if (error && !data) return <ErrorState message={error} onRetry={reload} />
  if (!data) return null
  const s = data.summary

  const columns: DataTableColumn<BackupJobDto>[] = [
    {
      key: "asset",
      header: "Aset",
      render: (j) => (
        <div className="min-w-[150px]">
          <p className="font-medium">{j.asset.hostname}</p>
          <p className="type-meta">{j.asset.host.name}</p>
        </div>
      ),
    },
    {
      key: "job",
      header: "Job",
      render: (j) => (
        <div className="min-w-[130px]">
          <p className="font-mono text-[13px]">{j.jobName}</p>
          <p className="type-meta">{j.type}</p>
        </div>
      ),
    },
    { key: "status", header: "Status", render: (j) => <StatusBadge status={HEALTH_LABEL[j.health]} tone={HEALTH_TONE[j.health]} /> },
    {
      key: "last",
      header: "Eksekusi terakhir",
      render: (j) => (
        <span className="whitespace-nowrap" title={formatDateTime(j.lastRunAt)}>
          {relativeTime(j.lastRunAt)}
        </span>
      ),
    },
    {
      key: "success",
      header: "Sukses terakhir",
      render: (j) => (
        <span className={cn("whitespace-nowrap", j.health === "OVERDUE" && "text-warning")} title={formatDateTime(j.lastSuccessAt)}>
          {j.lastSuccessAt ? relativeTime(j.lastSuccessAt) : "Belum pernah"}
        </span>
      ),
    },
    {
      key: "fail",
      header: "Gagal beruntun",
      render: (j) => <span className={cn("tabular-nums", j.consecutiveFailures > 0 && "font-semibold text-danger")}>{j.consecutiveFailures}</span>,
    },
    { key: "size", header: "Ukuran", render: (j) => <span className="whitespace-nowrap tabular-nums">{j.lastStatus === "FAILED" ? "—" : formatBytes(j.lastSizeBytes)}</span> },
  ]

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:gap-4 xl:grid-cols-4">
        <Stat label="Job berhasil" value={`${s.ok}/${s.jobs}`} hint={`${s.runs24h.success} eksekusi sukses · 24 jam`} />
        <Stat label="Gagal" value={s.failed} hint={`${s.runs24h.failed} eksekusi gagal · 24 jam`} tone="danger" />
        <Stat label="Terlambat" value={s.overdue} hint={`Tanpa sukses > ${s.overdueAfterHours} jam`} tone="warning" />
        <Stat
          label="Cakupan aset"
          value={`${s.assetsCovered}/${s.assetsTotal}`}
          hint={`${formatBytes(s.bytes24h)} dicadangkan · 24 jam`}
          tone={s.assetsCovered < s.assetsTotal ? "warning" : undefined}
        />
      </div>

      <GlassCard className="flex min-w-0 flex-col gap-4 p-5">
        <CardHeading
          title="Job Backup"
          description={s.lastRunAt ? `Eksekusi terakhir ${relativeTime(s.lastRunAt)} · disegarkan tiap menit` : "Belum ada laporan backup"}
          actions={
            <Button variant="outline" size="sm" onClick={reload}>
              <RefreshCw /> Segarkan
            </Button>
          }
        />
        <PageToolbar>
          <FilterField label="Cari" className="min-w-0 flex-1 sm:max-w-xs">
            <div className="relative">
              <Search size={15} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(e) => {
                  setSearch(e.target.value)
                  setPage(1)
                }}
                placeholder="Hostname, job, atau host"
                className="pl-9"
              />
            </div>
          </FilterField>
          <FilterField label="Status" className="w-full sm:w-44">
            <Select
              items={HEALTH_ITEMS}
              value={health}
              onValueChange={(v) => {
                setHealth(v ?? "Semua")
                setPage(1)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(HEALTH_ITEMS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
        </PageToolbar>

        {data.jobs.length === 0 ? (
          <EmptyState
            icon={DatabaseBackup}
            title="Belum ada laporan backup"
            description='Skrip backup di server perlu menulis log JSON dengan event.dataset "synra.backup" yang dikirim Filebeat.'
          />
        ) : jobs.length === 0 ? (
          <p className="type-meta">Tidak ada job yang cocok dengan filter.</p>
        ) : (
          <>
            <DataTable
              columns={columns}
              rows={paginatedRows}
              rowKey={(j) => `${j.assetId}:${j.jobName}`}
              rowSeverity={(j) => (j.health === "FAILED" ? "Critical" : undefined)}
              onRowClick={setSelected}
            />
            <Pagination
              page={page}
              totalPages={totalPages}
              totalRows={totalRows}
              startIndex={startIndex}
              endIndex={endIndex}
              onPageChange={setPage}
              itemLabel="job"
            />
          </>
        )}
      </GlassCard>

      {data.uncovered.length > 0 && (
        <GlassCard className="flex min-w-0 flex-col gap-3 p-5">
          <CardHeading
            title="Aset Tanpa Backup"
            description={`${data.uncovered.length} aset aktif belum melaporkan job backup apa pun dalam 30 hari`}
          />
          <div className="flex flex-wrap gap-2">
            {data.uncovered.map((a) => (
              <span key={a.id} className="inline-flex items-center gap-2 rounded-lg border border-warning/30 bg-warning/[0.06] px-3 py-1.5 text-sm">
                <span className="font-medium">{a.hostname}</span>
                <span className="type-meta">{a.host.name}</span>
              </span>
            ))}
          </div>
        </GlassCard>
      )}

      <BackupRunsDrawer job={selected} onClose={() => setSelected(null)} />
    </div>
  )
}

function BackupRunsDrawer({ job, onClose }: { job: BackupJobDto | null; onClose: () => void }) {
  const path = job ? `/backups/runs?assetId=${job.assetId}&jobName=${encodeURIComponent(job.jobName)}&limit=30` : null
  const { data, loading } = usePolling<Paginated<BackupRunDto>>(path)
  return (
    <Drawer open={Boolean(job)} title={job ? `${job.asset.hostname} · ${job.jobName}` : ""} onClose={onClose}>
      {job && (
        <div className="flex flex-col gap-5">
          <dl className="grid grid-cols-2 gap-3">
            {[
              ["Status", HEALTH_LABEL[job.health]],
              ["Jenis", job.type],
              ["Tujuan", job.target ?? "—"],
              ["Gagal beruntun", String(job.consecutiveFailures)],
              ["Sukses terakhir", job.lastSuccessAt ? formatDateTime(job.lastSuccessAt) : "Belum pernah"],
              ["Durasi terakhir", job.lastDurationSec !== null ? `${Math.round(job.lastDurationSec / 60)} menit` : "—"],
            ].map(([label, value]) => (
              <div key={label} className="min-w-0 rounded-xl border border-border bg-muted/40 p-3">
                <dt className="type-label text-muted-foreground">{label}</dt>
                <dd className="mt-1 truncate text-sm font-medium" title={value}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
          {job.lastMessage && job.health === "FAILED" && (
            <div className="rounded-xl border border-danger/30 bg-danger/[0.06] p-4">
              <p className="type-label mb-1 text-danger">Pesan kegagalan terakhir</p>
              <p className="break-words font-mono text-[13px]">{job.lastMessage}</p>
            </div>
          )}
          <div>
            <p className="type-label mb-2 text-muted-foreground">Riwayat eksekusi (30 terakhir)</p>
            {loading ? (
              <LoadingState />
            ) : (
              <ol className="flex flex-col gap-2">
                {(data?.data ?? []).map((r) => (
                  <li key={r.id} className="flex min-w-0 items-start gap-3 rounded-lg border border-border px-3 py-2">
                    <span className={cn("mt-1.5 size-2 shrink-0 rounded-full", r.status === "SUCCESS" ? "bg-success" : "bg-danger")} />
                    <div className="min-w-0 flex-1">
                      <p className="text-sm">
                        {formatDateTime(r.finishedAt)}
                        <span className="text-muted-foreground"> · {r.status === "SUCCESS" ? formatBytes(r.sizeBytes) : "gagal"}</span>
                      </p>
                      {r.message && <p className="type-meta break-words">{r.message}</p>}
                    </div>
                  </li>
                ))}
              </ol>
            )}
          </div>
        </div>
      )}
    </Drawer>
  )
}

// ── Keamanan ─────────────────────────────────────────────────────────────────

function ListCard({ title, description, empty, children }: { title: string; description: string; empty: boolean; children: ReactNode }) {
  return (
    <GlassCard className="flex min-w-0 flex-col gap-3 p-5">
      <CardHeading title={title} description={description} />
      {empty ? <p className="type-meta">Tidak ada.</p> : <ul className="flex flex-col divide-y divide-border">{children}</ul>}
    </GlassCard>
  )
}

function Row({ title, meta, right, tone }: { title: string; meta?: string; right?: string; tone?: "danger" | "warning" }) {
  return (
    <li className="flex min-w-0 items-center justify-between gap-3 py-2.5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className="truncate text-sm font-medium" title={title}>
          {title}
        </p>
        {meta && <p className="type-meta truncate">{meta}</p>}
      </div>
      {right && <span className={cn("shrink-0 text-sm tabular-nums", tone === "danger" && "font-semibold text-danger", tone === "warning" && "text-warning")}>{right}</span>}
    </li>
  )
}

function SecuritySection() {
  const { data, error, loading, reload } = usePolling<SecurityOverviewDto>("/security/overview")
  if (loading) return <LoadingState />
  if (error && !data) return <ErrorState message={error} onRetry={reload} />
  if (!data) return null
  const s = data.summary
  const peak = Math.max(1, ...data.failedLogins.perHour.map((h) => h.count))
  const days = (n: number) => (n < 0 ? `lewat ${Math.abs(n)} hari` : n === 0 ? "hari ini" : `${n} hari lagi`)

  return (
    <div className="flex min-w-0 flex-col gap-4">
      <div className="grid grid-cols-2 gap-3 md:gap-4 lg:grid-cols-5">
        <Stat label="Login gagal 24 jam" value={s.failedLogins24h} hint={`${s.failedLogins7d} dalam 7 hari`} tone="warning" />
        <Stat label="Akun terkunci" value={s.lockedAccounts} hint={`${s.activeUsers} akun aktif · ${s.admins} admin`} tone="danger" />
        <Stat label="Akun tidak aktif" value={s.dormantAccounts} hint={`Tidak login > ${s.dormantAfterDays} hari`} tone="warning" />
        <Stat
          label="Sertifikat ≤ 30 hari"
          value={s.certificatesExpiring + s.certificatesExpired}
          hint={s.certificatesExpired ? `${s.certificatesExpired} sudah kedaluwarsa` : "SSL/TLS dari modul siklus hidup"}
          tone="danger"
        />
        <Stat
          label="OS habis dukungan"
          value={s.osEndOfSupport}
          hint={`${s.osEndingSoon} lagi dalam 90 hari`}
          tone="danger"
        />
      </div>

      <div className="grid min-w-0 gap-4 lg:grid-cols-[minmax(0,1.3fr)_minmax(0,1fr)]">
        <GlassCard className="flex min-w-0 flex-col gap-4 p-5">
          <CardHeading title="Percobaan Login Gagal" description="Per jam, 24 jam terakhir" />
          <div className="flex h-28 items-end gap-[3px]" role="img" aria-label={`${s.failedLogins24h} login gagal dalam 24 jam`}>
            {data.failedLogins.perHour.map((h, i) => (
              <motion.div
                key={h.hour}
                className={cn("min-w-0 flex-1 rounded-t-sm", h.count ? "bg-warning/70" : "bg-muted")}
                initial={{ height: 0 }}
                animate={{ height: `${Math.max(4, (h.count / peak) * 100)}%` }}
                transition={{ delay: i * 0.01 }}
                title={`${new Date(h.hour).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}: ${h.count}`}
              />
            ))}
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {[
              ["Username terbanyak", data.failedLogins.byUsername],
              ["IP terbanyak", data.failedLogins.byIp],
            ].map(([label, rows]) => (
              <div key={label as string} className="min-w-0">
                <p className="type-label mb-2 text-muted-foreground">{label as string}</p>
                {(rows as { key: string; count: number }[]).length === 0 ? (
                  <p className="type-meta">Tidak ada.</p>
                ) : (
                  <ul className="flex flex-col gap-1.5">
                    {(rows as { key: string; count: number }[]).map((r) => (
                      <li key={r.key} className="flex justify-between gap-2 text-sm">
                        <span className="truncate font-mono text-[13px]">{r.key}</span>
                        <span className="shrink-0 tabular-nums text-muted-foreground">{r.count}×</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            ))}
          </div>
        </GlassCard>

        <ListCard title="Perubahan Sensitif" description="Hak akses dan konfigurasi, terbaru" empty={data.sensitiveChanges.length === 0}>
          {data.sensitiveChanges.map((c) => (
            <Row
              key={c.id}
              title={AUDIT_ACTION_LABEL[c.action] ?? c.action}
              meta={`${c.actorUsername}${c.ipAddress ? ` · ${c.ipAddress}` : ""}`}
              right={relativeTime(c.createdAt)}
            />
          ))}
        </ListCard>
      </div>

      <div className="grid min-w-0 gap-4 md:grid-cols-2 xl:grid-cols-4">
        <ListCard title="Sertifikat SSL/TLS" description="Berakhir ≤ 30 hari" empty={data.certificates.length === 0}>
          {data.certificates.map((c) => (
            <Row key={c.id} title={c.name} meta={`${c.code}${c.location ? ` · ${c.location}` : ""}`} right={days(c.daysLeft)} tone={c.daysLeft < 0 ? "danger" : "warning"} />
          ))}
        </ListCard>
        <ListCard title="Sistem Operasi" description="Habis dukungan ≤ 90 hari" empty={data.operatingSystems.length === 0}>
          {data.operatingSystems.map((o) => (
            <Row key={o.id} title={o.name} meta={`${o.quantity} unit${o.location ? ` · ${o.location}` : ""}`} right={days(o.daysLeft)} tone={o.daysLeft < 0 ? "danger" : "warning"} />
          ))}
        </ListCard>
        <ListCard title="Akun Terkunci" description="Terlalu banyak login gagal" empty={data.lockedAccounts.length === 0}>
          {data.lockedAccounts.map((u) => (
            <Row key={u.id} title={u.username} meta={`${u.fullName} · ${u.role}`} right={`s.d. ${new Date(u.lockedUntil).toLocaleTimeString("id-ID", { hour: "2-digit", minute: "2-digit" })}`} tone="danger" />
          ))}
        </ListCard>
        <ListCard title="Akun Tidak Aktif" description={`Tidak login > ${s.dormantAfterDays} hari`} empty={data.dormantAccounts.length === 0}>
          {data.dormantAccounts.map((u) => (
            <Row key={u.id} title={u.username} meta={`${u.fullName} · ${u.role}`} right={u.lastLoginAt ? relativeTime(u.lastLoginAt) : "Belum pernah"} tone="warning" />
          ))}
        </ListCard>
      </div>
    </div>
  )
}

export default function BackupSecurityPage() {
  const { user } = useAccess()
  const canSeeSecurity = user.backendRole === "ADMIN" || user.backendRole === "AUDITOR"
  return (
    <div className="flex min-w-0 flex-col gap-8">
      <section className="flex min-w-0 flex-col gap-4">
        <SectionTitle title="Pencadangan" description="Hasil job backup dari setiap server, dikirim Filebeat" />
        <BackupSection />
      </section>
      <section className="flex min-w-0 flex-col gap-4">
        <SectionTitle title="Keamanan" description="Akses pengguna, sertifikat, OS, dan perubahan sensitif" />
        {canSeeSecurity ? (
          <SecuritySection />
        ) : (
          <EmptyState icon={Lock} title="Khusus Administrator dan Auditor" description="Ringkasan keamanan memuat username dan alamat IP percobaan login, sehingga aksesnya dibatasi." />
        )}
      </section>
    </div>
  )
}
