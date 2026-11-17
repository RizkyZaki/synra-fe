import { CheckCircle2, ClipboardCheck, Radar, Search } from "lucide-react"
import { motion } from "motion/react"
import { useEffect, useState } from "react"
import { useSearchParams } from "react-router"
import { restrictedAction, useAccess } from "../lib/useAccess"
import { type AlertTransition, useAlertByCode, useAlertDetail, useAlertList, useSynraStore } from "../lib/useSynraStore"
import { ApiError } from "../lib/api"
import {
  ALERT_EVENT_LABEL,
  SEVERITY_TO_BE,
  STATUS_TO_FE,
  formatDateTime,
  type BackendAlertStatus,
  type BackendSeverity,
} from "../lib/backend"
import { AlertEvidence } from "./AlertEvidence"
import type { AlertItem, AlertStatus, Severity } from "../lib/synraDomain"
import {
  ApiErrorBanner,
  CardHeading,
  DataTable,
  FilterField,
  FormField,
  GlassCard,
  PageToolbar,
  Pagination,
  SeverityBadge,
  StatusBadge,
  Toast,
  type DataTableColumn,
} from "./ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { cn } from "@/lib/utils"

const RECOVERED_HINT =
  "Masalahnya sudah tidak terdeteksi lagi, tetapi alert belum ditutup. Catat penyebabnya lalu ajukan penutupan. Bila masalah muncul lagi sebelum ditutup, alert yang sama aktif kembali."

const statusFlow: AlertStatus[] = ["Baru", "Diakui", "Dalam Penanganan", "Menunggu Review", "Ditutup"]

const statusLabels: Record<AlertStatus, string> = {
  Baru: "Baru",
  Diakui: "Diakui",
  "Dalam Penanganan": "Dalam penanganan",
  "Menunggu Review": "Menunggu tinjauan",
  Ditutup: "Ditutup",
}

const STATUS_TO_BE = Object.fromEntries(
  Object.entries(STATUS_TO_FE).map(([be, fe]) => [fe, be]),
) as Record<AlertStatus, BackendAlertStatus>

const PAGE_SIZE = 10
/** Default daftar: hanya alert yang belum ditutup. */
const DEFAULT_STATUS = "open"
const STATUS_FILTER_ITEMS: Record<string, string> = {
  open: "Terbuka (belum ditutup)",
  all: "Semua status",
  ...Object.fromEntries(statusFlow.map((s) => [STATUS_TO_BE[s], statusLabels[s]])),
}
const SEVERITY_ITEMS: Record<string, string> = {
  all: "Semua",
  CRITICAL: "Kritis",
  HIGH: "Tinggi",
  MEDIUM: "Sedang",
  LOW: "Rendah",
  INFO: "Info",
}
const PERIOD_ITEMS: Record<string, string> = {
  all: "Semua waktu",
  "1": "24 jam terakhir",
  "7": "7 hari terakhir",
  "30": "30 hari terakhir",
  "90": "90 hari terakhir",
}

export function alertStatusTone(status: AlertStatus) {
  if (status === "Ditutup") return "success" as const
  if (status === "Baru") return "danger" as const
  if (status === "Dalam Penanganan" || status === "Menunggu Review") return "warning" as const
  return "neutral" as const
}

function WorkflowForm({
  title,
  requireEvidence = false,
  attachmentCount = 0,
  allowed,
  onSubmit,
}: {
  title: string
  requireEvidence?: boolean
  /** Lampiran yang sudah diunggah; bila ada, teks bukti boleh kosong */
  attachmentCount?: number
  allowed: boolean
  onSubmit: (note: string, evidence: string) => Promise<void> | void
}) {
  const [note, setNote] = useState("")
  const [evidence, setEvidence] = useState("")
  const [error, setError] = useState("")

  return (
    <form
      className="flex flex-col gap-3"
      onSubmit={(event) => {
        event.preventDefault()
        if (!note.trim()) {
          setError("Catatan wajib diisi.")
          return
        }
        if (requireEvidence && !evidence.trim() && attachmentCount === 0) {
          setError("Isi ringkasan bukti atau unggah minimal satu lampiran di panel Bukti Remediasi.")
          return
        }
        setError("")
        void onSubmit(note.trim(), evidence.trim())
      }}
    >
      <FormField label="Catatan">
        <Textarea value={note} onChange={(event) => setNote(event.target.value)} rows={3} placeholder="Tuliskan catatan penanganan" />
      </FormField>
      {requireEvidence && (
        <FormField label={attachmentCount ? `Ringkasan bukti (opsional, ${attachmentCount} lampiran)` : "Ringkasan bukti"}>
          <Textarea
            value={evidence}
            onChange={(event) => setEvidence(event.target.value)}
            rows={3}
            placeholder="Mis. No. tiket INC-1234; disk /data turun ke 61% setelah arsip lama dipindah"
          />
        </FormField>
      )}
      {error && (
        <p className="text-xs text-danger" role="alert">
          {error}
        </p>
      )}
      <Button type="submit" className="self-start" {...restrictedAction(allowed)}>
        {title}
      </Button>
    </form>
  )
}

/** Jumlah alert per tahap; klik tahap untuk memfilter tabel. Dipindah dari dashboard. */
function AlertFunnel({
  active,
  counts,
  onSelect,
}: {
  active: string
  counts: Record<BackendAlertStatus, number> | null
  onSelect: (status: AlertStatus) => void
}) {
  const funnel = statusFlow.map((status) => ({ status, count: counts?.[STATUS_TO_BE[status]] ?? 0 }))
  const max = Math.max(1, ...funnel.map((stage) => stage.count))
  return (
    <GlassCard className="min-w-0 p-4 md:p-5">
      <CardHeading
        title="Tahap Alert"
        description="Jumlah sesuai filter periode, severity, dan pencarian. Klik tahap untuk memfilter tabel."
        className="mb-4"
      />
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5">
        {funnel.map((stage, index) => {
          const selectedStage = active === STATUS_TO_BE[stage.status]
          return (
            <button
              key={stage.status}
              type="button"
              aria-pressed={selectedStage}
              onClick={() => onSelect(stage.status)}
              className={cn(
                "min-w-0 rounded-xl border p-3.5 text-left outline-none transition-all hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring",
                selectedStage ? "border-primary/50 bg-primary/10" : "border-border bg-muted/40 hover:border-primary/30",
              )}
            >
              <span className="type-label block truncate text-muted-foreground">
                {statusLabels[stage.status]}
              </span>
              <span className="mt-2 block text-2xl font-semibold tabular-nums">{stage.count}</span>
              <span className="mt-3 block h-1 overflow-hidden rounded-full bg-muted">
                <motion.span
                  className="block h-full rounded-full bg-primary"
                  initial={{ width: 0 }}
                  animate={{ width: `${(stage.count / max) * 100}%` }}
                  transition={{ duration: 0.7, delay: index * 0.06 }}
                />
              </span>
            </button>
          )
        })}
      </div>
    </GlassCard>
  )
}

export default function AlertIncidentPage({
  selectedId,
  onSelectedIdChange,
}: {
  selectedId: string | null
  onSelectedIdChange: (id: string | null) => void
}) {
  const { read, actions, error } = useSynraStore()
  const { can } = useAccess()
  const canEdit = can("alerts.handle")
  const canApprove = can("alerts.review")
  const canConfig = can("alerts.evaluate")
  const alerts = read("alerts")
  const [toast, setToast] = useState("")
  const [busy, setBusy] = useState(false)

  // Filter disimpan di URL (?status=&severity=&period=&q=&page=) supaya tetap ada saat kembali dari detail.
  const [params, setParams] = useSearchParams()
  const statusFilter = params.get("status") ?? DEFAULT_STATUS
  const severityFilter = params.get("severity") ?? "all"
  const periodFilter = params.get("period") ?? "all"
  const searchParam = params.get("q") ?? ""
  const page = Math.max(1, Number(params.get("page")) || 1)
  const setFilter = (key: string, value: string, fallback: string) =>
    setParams(
      (current) => {
        const next = new URLSearchParams(current)
        if (value === fallback) next.delete(key)
        else next.set(key, value)
        if (key !== "page") next.delete("page")
        return next
      },
      { replace: true },
    )

  // Ketikan pencarian ditunda sebentar agar tidak memanggil server di setiap huruf.
  const [searchInput, setSearchInput] = useState(searchParam)
  useEffect(() => setSearchInput(searchParam), [searchParam])
  useEffect(() => {
    if (searchInput === searchParam) return
    const timer = setTimeout(() => setFilter("q", searchInput.trim(), ""), 350)
    return () => clearTimeout(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchInput])

  const list = useAlertList({
    page,
    limit: PAGE_SIZE,
    status: statusFilter === "all" ? undefined : (statusFilter as BackendAlertStatus | "open"),
    severity: severityFilter === "all" ? undefined : (severityFilter as BackendSeverity),
    periodDays: periodFilter === "all" ? undefined : Number(periodFilter),
    search: searchParam,
  })

  // Detail dicari di data store, di halaman daftar, lalu langsung ke server (alert lama di luar 100 terbaru).
  const known = alerts.find((alert) => alert.id === selectedId) ?? list.rows.find((alert) => alert.id === selectedId) ?? null
  const fetched = useAlertByCode(selectedId, Boolean(known))
  const selected = known ?? fetched
  const { events, attachments, reload: reloadDetail } = useAlertDetail(selected?.apiId, selected?.status)

  /** Perubahan status dikirim ke backend; backend memvalidasi alur, role, dan mencatat audit. */
  const changeStatus = async (alert: AlertItem, action: AlertTransition, target: AlertStatus, note?: string, evidence?: string) => {
    if (!alert.apiId) return
    setBusy(true)
    try {
      await actions.transitionAlert(alert.apiId, action, { note, evidence })
      setToast(`Alert dipindahkan ke ${statusLabels[target]}`)
    } catch (e) {
      setToast(e instanceof ApiError ? e.message : "Gagal mengubah status alert")
    } finally {
      setBusy(false)
    }
  }

  const evaluateEws = async () => {
    if (!canConfig) return
    setBusy(true)
    try {
      const result = await actions.evaluateAlerts()
      setToast(result.created > 0 ? `${result.created} alert baru dibuat` : "Tidak ada alert baru; duplikat terbuka dilewati")
    } catch (e) {
      setToast(e instanceof ApiError ? e.message : "Evaluasi gagal")
    } finally {
      setBusy(false)
    }
  }

  const columns: DataTableColumn<AlertItem>[] = [
    { key: "id", header: "ID", render: (alert) => <span className="font-mono text-xs text-muted-foreground">{alert.id}</span> },
    {
      key: "name",
      header: "Alert",
      render: (alert) => (
        <span className="flex min-w-[240px] max-w-[420px] flex-wrap items-center gap-2 whitespace-normal">
          <strong className="font-medium">{alert.name}</strong>
          {alert.conditionActive === false && alert.status !== "Ditutup" && (
            <span
              className="inline-flex cursor-help rounded-full border border-success/25 bg-success/10 px-2 py-0.5 text-[11px] text-success"
              title={RECOVERED_HINT}
            >
              kondisi pulih
            </span>
          )}
        </span>
      ),
    },
    { key: "type", header: "Jenis", render: (alert) => alert.type },
    { key: "location", header: "Host", render: (alert) => alert.location },
    { key: "pic", header: "PIC", render: (alert) => alert.pic },
    { key: "severity", header: "Severity", render: (alert) => <SeverityBadge severity={alert.severity} /> },
    {
      key: "status",
      header: "Status",
      render: (alert) => <StatusBadge status={alert.status} tone={alertStatusTone(alert.status)} />,
    },
    {
      key: "created",
      header: "Dibuat",
      render: (alert) => <span className="whitespace-nowrap text-muted-foreground">{alert.createdAt}</span>,
    },
  ]

  if (selected) {
    const currentStep = statusFlow.indexOf(selected.status)
    return (
      <div className="flex min-w-0 flex-col gap-6">
        <GlassCard className="overflow-hidden p-0">
          <div
            aria-hidden="true"
            className={cn(
              "h-1 w-full bg-gradient-to-r",
              selected.severity === "Critical"
                ? "from-danger via-danger/60 to-transparent"
                : selected.severity === "High"
                  ? "from-high via-high/60 to-transparent"
                  : "from-warning via-warning/50 to-transparent",
            )}
          />
          <div className="flex flex-col gap-5 p-5 md:p-6">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="min-w-0">
                <span className="font-mono text-xs text-muted-foreground">{selected.id}</span>
                <h2 className="mt-1 text-xl font-semibold tracking-tight md:text-2xl">{selected.name}</h2>
                <p className="type-meta mt-1">
                  {selected.hostname} · {selected.component} · PIC {selected.pic}
                </p>
              </div>
              <SeverityBadge severity={selected.severity} />
            </div>

            <dl className="grid grid-cols-2 gap-3 md:grid-cols-5">
              {[
                ["Nilai terakhir", selected.value?.toLocaleString("id-ID") ?? "—"],
                ["Batas", selected.threshold?.toLocaleString("id-ID") ?? "—"],
                ["Terdeteksi", selected.createdAt],
                ["Kondisi", selected.conditionActive === false ? "Sudah normal" : "Masih aktif"],
                ["Eskalasi", selected.escalationLevel ? `Tingkat ${selected.escalationLevel}` : "Belum"],
              ].map(([label, value]) => (
                <div key={label} className="min-w-0 rounded-xl border border-border bg-muted/40 p-3">
                  <dt className="type-label text-muted-foreground">{label}</dt>
                  <dd className="mt-1 truncate text-sm font-medium" title={value}>
                    {value}
                  </dd>
                </div>
              ))}
            </dl>

            {selected.conditionActive === false && selected.status !== "Ditutup" && (
              <div role="note" className="flex items-start gap-3 rounded-xl border border-success/25 bg-success/[0.06] p-4">
                <CheckCircle2 size={18} className="mt-0.5 shrink-0 text-success" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-sm font-semibold text-success">
                    Kondisi sudah normal{selected.recoveredAt ? ` sejak ${formatDateTime(selected.recoveredAt)}` : ""}
                  </p>
                  <p className="type-body mt-1 text-muted-foreground">
                    Masalahnya tidak lagi terdeteksi, tetapi kejadiannya tetap perlu ditindaklanjuti: cari dan catat penyebabnya,
                    lalu ajukan penutupan. Reviewer (hak Review alert) dapat langsung menutup alert bila tidak perlu tindakan lanjutan. Bila masalah
                    muncul lagi sebelum ditutup, penanda ini hilang dan alert yang sama kembali aktif.
                  </p>
                </div>
              </div>
            )}

            <div className="rounded-xl border border-primary/20 bg-primary/[0.06] p-4">
              <p className="type-label mb-1 text-primary">Rekomendasi</p>
              <p className="type-body">{selected.recommendation}</p>
              {selected.closeNote && (
                <p className="type-body mt-2 text-muted-foreground">
                  <strong className="font-medium text-foreground">Catatan penutupan:</strong> {selected.closeNote}
                </p>
              )}
            </div>
          </div>
        </GlassCard>

        <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1fr)_minmax(0,420px)]">
          <div className="flex min-w-0 flex-col gap-6">
          {selected.apiId && (
            <AlertEvidence
              alertApiId={selected.apiId}
              attachments={attachments}
              canUpload={canEdit && selected.status !== "Ditutup"}
              onUploaded={(count) => {
                reloadDetail()
                setToast(`${count} lampiran diunggah`)
              }}
            />
          )}
          <GlassCard className="min-w-0 p-5 md:p-6">
            <CardHeading title="Riwayat Penanganan" description="Timeline perubahan status" className="mb-5" />
            {events.length === 0 ? (
              <p className="type-meta">Belum ada riwayat.</p>
            ) : (
              <ol className="relative flex flex-col gap-5 before:absolute before:bottom-2 before:left-[5px] before:top-2 before:w-px before:bg-border">
                {events.map((event, index) => (
                  <motion.li
                    key={event.id}
                    className="relative min-w-0 pl-6"
                    initial={{ opacity: 0, y: 6 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                  >
                    <span className="absolute left-0 top-1 size-[11px] rounded-full border-2 border-card bg-primary ring-1 ring-primary/30" />
                    <p className="text-sm font-medium">
                      {ALERT_EVENT_LABEL[event.action] ?? event.action}
                      {event.fromStatus ? (
                        <span className="font-normal text-muted-foreground">
                          {" "}
                          · {STATUS_TO_FE[event.fromStatus]} → {STATUS_TO_FE[event.toStatus]}
                        </span>
                      ) : null}
                    </p>
                    {event.note && <p className="type-body mt-1 break-words">{event.note}</p>}
                    {event.evidence && <p className="type-body mt-1 break-words text-muted-foreground">Bukti: {event.evidence}</p>}
                    <p className="mt-1 text-xs text-muted-foreground">
                      {event.actorUsername} · {formatDateTime(event.createdAt)}
                    </p>
                  </motion.li>
                ))}
              </ol>
            )}
          </GlassCard>
          </div>

          <GlassCard className="min-w-0 self-start p-5 md:p-6">
            <CardHeading title="Alur Status" description="Tindakan sesuai tahap saat ini" className="mb-5" />
            <ol className="mb-6 flex flex-col">
              {statusFlow.map((status, index) => {
                const done = index < currentStep
                const current = index === currentStep
                return (
                  <li key={status} className="relative flex items-center gap-3 pb-3 last:pb-0">
                    {index < statusFlow.length - 1 && (
                      <span
                        className={cn("absolute left-[11px] top-6 h-[calc(100%-12px)] w-px", done ? "bg-primary/60" : "bg-border")}
                        aria-hidden="true"
                      />
                    )}
                    <span
                      className={cn(
                        "relative grid size-6 shrink-0 place-items-center rounded-full border text-[11px] font-semibold",
                        done && "border-primary/50 bg-primary/15 text-primary",
                        current && "border-primary bg-primary text-primary-foreground shadow-[0_0_14px_rgb(255_122_26/60%)]",
                        !done && !current && "border-border bg-muted text-muted-foreground",
                      )}
                    >
                      {done ? <CheckCircle2 size={13} /> : index + 1}
                    </span>
                    <span className={cn("text-sm", current ? "font-medium text-foreground" : "text-muted-foreground")}>
                      {statusLabels[status]}
                    </span>
                  </li>
                )
              })}
            </ol>
            <div className="border-t border-border pt-5">
              {selected.status === "Baru" && (
                <Button {...restrictedAction(canEdit && !busy)} onClick={() => changeStatus(selected, "acknowledge", "Diakui")}>
                  <ClipboardCheck /> Akui Alert
                </Button>
              )}
              {selected.status === "Diakui" && (
                <WorkflowForm
                  title="Mulai Remediasi"
                  allowed={canEdit}
                  onSubmit={(note) => changeStatus(selected, "start", "Dalam Penanganan", note)}
                />
              )}
              {selected.status === "Dalam Penanganan" && (
                <WorkflowForm
                  title="Ajukan Review Penutupan"
                  allowed={canEdit}
                  requireEvidence
                  attachmentCount={attachments.length}
                  onSubmit={(note, evidence) => changeStatus(selected, "submit-review", "Menunggu Review", note, evidence)}
                />
              )}
              {selected.status === "Menunggu Review" && canApprove && (
                <div className="flex flex-col gap-5">
                  <WorkflowForm
                    title="Kembalikan"
                    allowed={canApprove}
                    onSubmit={(note) => changeStatus(selected, "return", "Dalam Penanganan", note)}
                  />
                  <div className="border-t border-border pt-5">
                    <WorkflowForm
                      title="Setujui & Tutup"
                      allowed={canApprove}
                      onSubmit={(note) => changeStatus(selected, "close", "Ditutup", note)}
                    />
                  </div>
                </div>
              )}
              {selected.status === "Menunggu Review" && !canApprove && (
                <p className="type-body text-muted-foreground">Menunggu persetujuan reviewer (hak Review alert).</p>
              )}
              {selected.status === "Ditutup" && (
                <p className="type-body flex items-center gap-2 text-muted-foreground">
                  <CheckCircle2 size={16} className="shrink-0 text-success" /> Alert telah ditutup dan tidak memerlukan tindakan lanjutan.
                </p>
              )}
            </div>
          </GlassCard>
        </div>

        <Toast visible={Boolean(toast)} message={toast} onClose={() => setToast("")} />
      </div>
    )
  }

  const filterSelect = (
    label: string,
    key: string,
    value: string,
    fallback: string,
    items: Record<string, string>,
    className: string,
  ) => (
    <FilterField label={label} className={className}>
      <Select items={items} value={value} onValueChange={(next) => setFilter(key, next ?? fallback, fallback)}>
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {Object.entries(items).map(([itemValue, itemLabel]) => (
            <SelectItem key={itemValue} value={itemValue}>
              {itemLabel}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </FilterField>
  )
  const filtersActive =
    statusFilter !== DEFAULT_STATUS || severityFilter !== "all" || periodFilter !== "all" || searchParam !== ""
  const startIndex = (page - 1) * PAGE_SIZE

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <ApiErrorBanner message={error || list.error} />

      <AlertFunnel
        active={statusFilter}
        counts={list.counts}
        onSelect={(status) => {
          const value = STATUS_TO_BE[status]
          setFilter("status", statusFilter === value ? DEFAULT_STATUS : value, DEFAULT_STATUS)
        }}
      />

      <GlassCard className="flex min-w-0 flex-col gap-4 p-4 md:p-5">
        <PageToolbar
          actions={
            <Button onClick={() => void evaluateEws()} {...restrictedAction(canConfig && !busy)}>
              <Radar /> Evaluasi EWS
            </Button>
          }
        >
          <FilterField label="Cari" className="w-full sm:w-[240px]">
            <label className="relative min-w-0">
              <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={searchInput}
                onChange={(event) => setSearchInput(event.target.value)}
                placeholder="Host, masalah, atau ALT-…"
                aria-label="Cari alert"
                className="pl-9"
              />
            </label>
          </FilterField>
          {filterSelect("Periode", "period", periodFilter, "all", PERIOD_ITEMS, "w-full sm:w-[170px]")}
          {filterSelect("Status", "status", statusFilter, DEFAULT_STATUS, STATUS_FILTER_ITEMS, "w-full sm:w-[200px]")}
          {filterSelect("Severity", "severity", severityFilter, "all", SEVERITY_ITEMS, "w-full sm:w-[140px]")}
          {filtersActive && (
            <Button
              variant="ghost"
              className="self-end text-muted-foreground"
              onClick={() => {
                setSearchInput("")
                setParams(new URLSearchParams(), { replace: true })
              }}
            >
              Reset filter
            </Button>
          )}
        </PageToolbar>

        <DataTable
          columns={columns}
          rows={list.rows}
          rowKey={(alert) => alert.id}
          rowSeverity={(alert) => alert.severity}
          onRowClick={(alert) => onSelectedIdChange(alert.id)}
        />

        <Pagination
          page={Math.min(page, list.totalPages)}
          totalPages={list.totalPages}
          totalRows={list.total}
          startIndex={startIndex}
          endIndex={Math.min(startIndex + list.rows.length, list.total)}
          onPageChange={(next) => setFilter("page", String(next), "1")}
          itemLabel="alert"
        />
      </GlassCard>
      <Toast visible={Boolean(toast)} message={toast} onClose={() => setToast("")} />
    </div>
  )
}
