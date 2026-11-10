import { useMemo, useState } from "react"
import { restrictedAction, useAccess } from "../lib/useAccess"
import { type AlertTransition, useAlertDetail, useSynraStore } from "../lib/useSynraStore"
import { ApiError } from "../lib/api"
import { ALERT_EVENT_LABEL, STATUS_TO_FE, formatDateTime } from "../lib/backend"
import type { AlertItem, AlertStatus } from "../lib/synraDomain"
import {
  ApiErrorBanner,
  DataTable,
  FilterField,
  FormField,
  GlassCard,
  PageToolbar,
  Pagination,
  SeverityBadge,
  StatusBadge,
  Toast,
  usePagination,
  type DataTableColumn,
} from "./ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

const statusFlow: AlertStatus[] = [
  "Baru",
  "Diakui",
  "Dalam Penanganan",
  "Menunggu Review",
  "Ditutup",
]

const statusLabels: Record<AlertStatus, string> = {
  Baru: "Baru",
  Diakui: "Diakui",
  "Dalam Penanganan": "Dalam penanganan",
  "Menunggu Review": "Menunggu tinjauan",
  Ditutup: "Ditutup",
}

export function alertStatusTone(status: AlertStatus) {
  if (status === "Ditutup") return "success" as const
  if (status === "Baru") return "danger" as const
  if (status === "Dalam Penanganan" || status === "Menunggu Review") {
    return "warning" as const
  }
  return "neutral" as const
}

function WorkflowForm({
  title,
  requireEvidence = false,
  allowed,
  onSubmit,
}: {
  title: string
  requireEvidence?: boolean
  allowed: boolean
  onSubmit: (note: string, evidence: string) => Promise<void> | void
}) {
  const [note, setNote] = useState("")
  const [evidence, setEvidence] = useState("")
  const [error, setError] = useState("")

  return (
    <form
      className="workflow-form"
      onSubmit={(event) => {
        event.preventDefault()
        if (!note.trim()) {
          setError("Catatan wajib diisi.")
          return
        }
        if (requireEvidence && !evidence.trim()) {
          setError("Bukti remediasi wajib diisi sebelum review.")
          return
        }
        setError("")
        void onSubmit(note.trim(), evidence.trim())
      }}
    >
      <FormField label="Catatan">
        <Textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          placeholder="Tuliskan catatan penanganan"
        />
      </FormField>
      {requireEvidence && (
        <FormField label="Bukti remediasi">
          <Input
            value={evidence}
            onChange={(event) => setEvidence(event.target.value)}
            placeholder="Referensi tiket, log, atau bukti validasi"
          />
        </FormField>
      )}
      {error && (
        <p className="asset-form__error type-meta text-[var(--status-danger)]" role="alert">
          {error}
        </p>
      )}
      <Button
        type="submit"
        {...restrictedAction(allowed)}
      >
        {title}
      </Button>
    </form>
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
  const canEdit = can("edit")
  const canApprove = can("approve")
  const canConfig = can("config")
  const alerts = read("alerts")
  const [severityFilter, setSeverityFilter] = useState("Semua")
  const [statusFilter, setStatusFilter] = useState("Semua")
  const [toast, setToast] = useState("")
  const [busy, setBusy] = useState(false)
  const selected = alerts.find((alert) => alert.id === selectedId) ?? null
  const events = useAlertDetail(selected?.apiId, selected?.status)

  const filtered = useMemo(
    () =>
      alerts.filter(
        (alert) =>
          (severityFilter === "Semua" ||
            alert.severity === severityFilter) &&
          (statusFilter === "Semua" || alert.status === statusFilter),
      ),
    [alerts, severityFilter, statusFilter],
  )

  const {
    page,
    setPage,
    totalPages,
    startIndex,
    endIndex,
    totalRows,
    paginatedRows,
  } = usePagination(filtered, 10)

  /** Perubahan status dikirim ke backend; backend memvalidasi alur, role, dan mencatat audit. */
  const changeStatus = async (
    alert: AlertItem,
    action: AlertTransition,
    target: AlertStatus,
    note?: string,
    evidence?: string,
  ) => {
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
      setToast(
        result.created > 0
          ? `${result.created} alert baru dibuat`
          : "Tidak ada alert baru; duplikat terbuka dilewati",
      )
    } catch (e) {
      setToast(e instanceof ApiError ? e.message : "Evaluasi gagal")
    } finally {
      setBusy(false)
    }
  }

  const columns: DataTableColumn<AlertItem>[] = [
    { key: "id", header: "ID", render: (alert) => alert.id },
    {
      key: "name",
      header: "Alert",
      render: (alert) => (
        <>
          <strong>{alert.name}</strong>
          {alert.conditionActive === false && alert.status !== "Ditutup" && (
            <span className="recovered-tag">kondisi pulih</span>
          )}
        </>
      ),
    },
    { key: "type", header: "Jenis", render: (alert) => alert.type },
    { key: "location", header: "Host", render: (alert) => alert.location },
    { key: "pic", header: "PIC", render: (alert) => alert.pic },
    {
      key: "severity",
      header: "Severity",
      render: (alert) => <SeverityBadge severity={alert.severity} />,
    },
    {
      key: "status",
      header: "Status",
      render: (alert) => (
        <StatusBadge
          status={alert.status}
          tone={alertStatusTone(alert.status)}
        />
      ),
    },
    {
      key: "created",
      header: "Dibuat",
      render: (alert) => alert.createdAt,
    },
  ]

  if (selected) {
    return (
      <div className="alert-detail">
        <GlassCard className="alert-detail__summary">
          <div>
            <span className="type-label text-muted-foreground">{selected.id}</span>
            <h3 className="type-page-title">{selected.name}</h3>
            <p className="type-meta text-muted-foreground">
              {selected.hostname} · {selected.component} · PIC {selected.pic}
            </p>
            <p className="type-meta text-muted-foreground">
              Nilai terakhir {selected.value?.toLocaleString("id-ID")} (batas{" "}
              {selected.threshold?.toLocaleString("id-ID")}) · terdeteksi {selected.createdAt}
              {selected.conditionActive === false && " · kondisi sudah normal kembali"}
            </p>
            <p className="type-body mt-2">
              <strong>Rekomendasi:</strong> {selected.recommendation}
            </p>
            {selected.closeNote && (
              <p className="type-body mt-1">
                <strong>Catatan penutupan:</strong> {selected.closeNote}
              </p>
            )}
          </div>
          <SeverityBadge severity={selected.severity} />
        </GlassCard>

        <div className="alert-detail__grid">
          <GlassCard className="alert-timeline">
            <div className="section-heading mb-4">
              <span className="type-label text-muted-foreground">TIMELINE</span>
              <h3 className="type-card-title">Riwayat Penanganan</h3>
            </div>
            <div className="timeline-list">
              {events.map((event) => (
                <div key={event.id} className="flex flex-col gap-1 pb-3">
                  <strong className="type-body font-medium">
                    {ALERT_EVENT_LABEL[event.action] ?? event.action}
                    {event.fromStatus ? ` · ${STATUS_TO_FE[event.fromStatus]} → ${STATUS_TO_FE[event.toStatus]}` : ""}
                  </strong>
                  {event.note && <span className="type-body text-foreground">{event.note}</span>}
                  {event.evidence && (
                    <span className="type-body text-foreground">Bukti: {event.evidence}</span>
                  )}
                  <span className="type-meta text-muted-foreground">
                    {event.actorUsername} · {formatDateTime(event.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="alert-workflow">
            <div className="section-heading mb-4">
              <span className="type-label text-muted-foreground">TINDAKAN</span>
              <h3 className="type-card-title">Alur Status</h3>
            </div>
            <div className="status-flow mb-6">
              {statusFlow.map((status) => (
                <span
                  key={status}
                  className={cn("type-body", status === selected.status ? "current" : "")}
                >
                  {statusLabels[status]}
                </span>
              ))}
            </div>
            {selected.status === "Baru" && (
              <Button
                {...restrictedAction(canEdit && !busy)}
                onClick={() => changeStatus(selected, "acknowledge", "Diakui")}
              >
                Akui Alert
              </Button>
            )}
            {selected.status === "Diakui" && (
              <WorkflowForm
                title="Mulai Remediasi"
                allowed={canEdit}
                onSubmit={(note) =>
                  changeStatus(selected, "start", "Dalam Penanganan", note)
                }
              />
            )}
            {selected.status === "Dalam Penanganan" && (
              <WorkflowForm
                title="Ajukan Review Penutupan"
                allowed={canEdit}
                requireEvidence
                onSubmit={(note, evidence) =>
                  changeStatus(
                    selected,
                    "submit-review",
                    "Menunggu Review",
                    note,
                    evidence,
                  )
                }
              />
            )}
            {selected.status === "Menunggu Review" && canApprove && (
              <div className="flex flex-col gap-4">
                <WorkflowForm
                  title="Kembalikan"
                  allowed={canApprove}
                  onSubmit={(note) =>
                    changeStatus(selected, "return", "Dalam Penanganan", note)
                  }
                />
                <WorkflowForm
                  title="Setujui & Tutup"
                  allowed={canApprove}
                  onSubmit={(note) =>
                    changeStatus(selected, "close", "Ditutup", note)
                  }
                />
              </div>
            )}
            {selected.status === "Ditutup" && (
              <p className="type-body text-muted-foreground">
                Alert telah ditutup dan tidak memerlukan tindakan lanjutan.
              </p>
            )}
          </GlassCard>
        </div>

        <Toast
          visible={Boolean(toast)}
          message={toast}
          onClose={() => setToast("")}
        />
      </div>
    )
  }

  return (
    <div className="alert-page">
      <ApiErrorBanner message={error} />
      <GlassCard className="alert-table">
        <PageToolbar
          actions={
            <Button
              onClick={() => void evaluateEws()}
              {...restrictedAction(canConfig && !busy)}
            >
              Evaluasi EWS
            </Button>
          }
        >
          <FilterField label="Severity" className="w-[160px]">
            <Select
              value={severityFilter}
              onValueChange={(value) => {
                setSeverityFilter(value ?? "Semua")
                setPage(1)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Semua">Semua</SelectItem>
                <SelectItem value="Normal">Normal</SelectItem>
                <SelectItem value="Info">Info</SelectItem>
                <SelectItem value="Low">Rendah</SelectItem>
                <SelectItem value="Medium">Sedang</SelectItem>
                <SelectItem value="High">Tinggi</SelectItem>
                <SelectItem value="Critical">Kritis</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Status" className="w-[180px]">
            <Select
              value={statusFilter}
              onValueChange={(value) => {
                setStatusFilter(value ?? "Semua")
                setPage(1)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Semua">Semua</SelectItem>
                {statusFlow.map((status) => (
                  <SelectItem key={status} value={status}>
                    {statusLabels[status]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
        </PageToolbar>

        <div className="mt-4">
          <DataTable
            columns={columns}
            rows={paginatedRows}
            rowKey={(alert) => alert.id}
            rowSeverity={(alert) => alert.severity}
            onRowClick={(alert) => onSelectedIdChange(alert.id)}
          />
        </div>

        <Pagination
          page={page}
          totalPages={totalPages}
          totalRows={totalRows}
          startIndex={startIndex}
          endIndex={endIndex}
          onPageChange={setPage}
          itemLabel="alert"
        />
      </GlassCard>
      <Toast
        visible={Boolean(toast)}
        message={toast}
        onClose={() => setToast("")}
      />
    </div>
  )
}
