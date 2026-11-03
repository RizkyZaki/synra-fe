import { useMemo, useState } from "react"
import { restrictedAction, useAccess } from "../lib/useAccess"
import { type AlertTransition, useAlertDetail, useSynraStore } from "../lib/useSynraStore"
import { ApiError } from "../lib/api"
import { ALERT_EVENT_LABEL, STATUS_TO_FE, formatDateTime } from "../lib/backend"
import type { AlertItem, AlertStatus } from "../lib/synraDomain"
import {
  ApiErrorBanner,
  DataTable,
  FormField,
  GlassCard,
  SeverityBadge,
  StatusBadge,
  Toast,
  type DataTableColumn,
} from "./ui"

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

function alertStatusTone(status: AlertStatus) {
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
        <textarea
          value={note}
          onChange={(event) => setNote(event.target.value)}
          rows={3}
          placeholder="Tuliskan catatan penanganan"
        />
      </FormField>
      {requireEvidence && (
        <FormField label="Bukti remediasi">
          <input
            value={evidence}
            onChange={(event) => setEvidence(event.target.value)}
            placeholder="Referensi tiket, log, atau bukti validasi"
          />
        </FormField>
      )}
      {error && (
        <p className="asset-form__error small-copy" role="alert">
          {error}
        </p>
      )}
      <button
        className="button button--primary"
        type="submit"
        {...restrictedAction(allowed)}
      >
        {title}
      </button>
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
    { key: "location", header: "BPD", render: (alert) => alert.location },
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
        <div className="asset-detail__header">
          <StatusBadge
            status={selected.status}
            tone={alertStatusTone(selected.status)}
          />
        </div>
        <GlassCard className="alert-detail__summary">
          <div>
            <span className="pretext">{selected.id}</span>
            <h3 className="title-h3">{selected.name}</h3>
            <p className="bodycopy text-muted">
              {selected.hostname} · {selected.component} · PIC {selected.pic}
            </p>
            <p className="bodycopy text-muted">
              Nilai terakhir {selected.value?.toLocaleString("id-ID")} (batas{" "}
              {selected.threshold?.toLocaleString("id-ID")}) · terdeteksi {selected.createdAt}
              {selected.conditionActive === false && " · kondisi sudah normal kembali"}
            </p>
            <p className="bodycopy">
              <strong>Rekomendasi:</strong> {selected.recommendation}
            </p>
            {selected.closeNote && (
              <p className="bodycopy">
                <strong>Catatan penutupan:</strong> {selected.closeNote}
              </p>
            )}
          </div>
          <SeverityBadge severity={selected.severity} />
        </GlassCard>

        <div className="alert-detail__grid">
          <GlassCard className="alert-timeline">
            <div className="section-heading">
              <span className="pretext">TIMELINE</span>
              <h3 className="title-h3">Riwayat Penanganan</h3>
            </div>
            <div className="timeline-list">
              {events.map((event) => (
                <div key={event.id}>
                  <strong className="small-copy">
                    {ALERT_EVENT_LABEL[event.action] ?? event.action}
                    {event.fromStatus ? ` · ${STATUS_TO_FE[event.fromStatus]} → ${STATUS_TO_FE[event.toStatus]}` : ""}
                  </strong>
                  {event.note && <span className="label text-muted">{event.note}</span>}
                  {event.evidence && (
                    <span className="label text-muted">Bukti: {event.evidence}</span>
                  )}
                  <span className="label text-muted">
                    {event.actorUsername} · {formatDateTime(event.createdAt)}
                  </span>
                </div>
              ))}
            </div>
          </GlassCard>

          <GlassCard className="alert-workflow">
            <div className="section-heading">
              <span className="pretext">TINDAKAN</span>
              <h3 className="title-h3">Alur Status</h3>
            </div>
            <div className="status-flow">
              {statusFlow.map((status) => (
                <span
                  key={status}
                  className={status === selected.status ? "current" : ""}
                >
                  {statusLabels[status]}
                </span>
              ))}
            </div>
            {selected.status === "Baru" && (
              <button
                className="button button--primary"
                {...restrictedAction(canEdit && !busy)}
                onClick={() => changeStatus(selected, "acknowledge", "Diakui")}
              >
                Akui Alert
              </button>
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
              <>
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
              </>
            )}
            {selected.status === "Ditutup" && (
              <p className="bodycopy text-muted">
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
        <div className="alert-toolbar">
          <div className="inventory-filters alert-filters">
            <label>
              <span className="label">Severity</span>
              <select
                value={severityFilter}
                onChange={(event) => setSeverityFilter(event.target.value)}
              >
                <option>Semua</option>
                <option value="Normal">Normal</option>
                <option value="Info">Info</option>
                <option value="Low">Rendah</option>
                <option value="Medium">Sedang</option>
                <option value="High">Tinggi</option>
                <option value="Critical">Kritis</option>
              </select>
            </label>
            <label>
              <span className="label">Status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option>Semua</option>
                {statusFlow.map((status) => (
                  <option key={status} value={status}>
                    {statusLabels[status]}
                  </option>
                ))}
              </select>
            </label>
          </div>
          <button
            className="button button--primary"
            onClick={() => void evaluateEws()}
            {...restrictedAction(canConfig && !busy)}
          >
            Evaluasi EWS
          </button>
        </div>
        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(alert) => alert.id}
          rowSeverity={(alert) => alert.severity}
          onRowClick={(alert) => onSelectedIdChange(alert.id)}
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
