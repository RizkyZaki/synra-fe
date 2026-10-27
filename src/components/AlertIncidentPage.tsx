import { useMemo, useState } from "react"
import { createAuditEntry } from "../lib/audit"
import { restrictedAction, useAccess } from "../lib/useAccess"
import { useSynraStore } from "../lib/useSynraStore"
import type {
  AlertItem,
  AlertStatus,
  Asset,
  AuditEntry,
  Severity,
} from "../lib/synraDomain"
import {
  ConfirmDialog,
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

interface EwSCandidate {
  name: string
  type: string
  location: string
  pic: string
  severity: Severity
  note: string
  assetName: string
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
  onSubmit: (note: string, evidence: string) => void
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
        onSubmit(note.trim(), evidence.trim())
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
  const { read, add, update, helpers } = useSynraStore()
  const { user, can } = useAccess()
  const canEdit = can("edit")
  const canApprove = can("approve")
  const canConfig = can("config")
  const alerts = read("alerts")
  const assets = read("assets")
  const lifecycle = read("lifecycle")
  const rules = read("rules")
  const [severityFilter, setSeverityFilter] = useState("Semua")
  const [statusFilter, setStatusFilter] = useState("Semua")
  const [confirmClose, setConfirmClose] = useState(false)
  const [toast, setToast] = useState("")
  const selected = alerts.find((alert) => alert.id === selectedId) ?? null

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

  const logAudit = (action: string, target: string, detail: string) =>
    add(
      "audit",
      createAuditEntry(read("audit"), user, action, target, detail),
    )

  const changeStatus = (
    alert: AlertItem,
    status: AlertStatus,
    note?: string,
    evidence?: string,
  ) => {
    const approvalTransition =
      alert.status === "Menunggu Review" &&
      (status === "Ditutup" || status === "Dalam Penanganan")
    if (approvalTransition ? !canApprove : !canEdit) return

    const detail = [
      `Status: ${alert.status} → ${status}`,
      note,
      evidence ? `Bukti: ${evidence}` : "",
    ]
      .filter(Boolean)
      .join(" · ")
    update(
      "alerts",
      (item) => item.id === alert.id,
      {
        status,
        note:
          note || evidence
            ? `${alert.note} • ${[note, evidence].filter(Boolean).join(" • ")}`
            : alert.note,
      },
    )
    logAudit("Status alert diperbarui", alert.id, detail)
    setToast(`Alert dipindahkan ke ${status}`)
  }

  const evaluateEws = () => {
    if (!canConfig) return

    const rule = (name: string) =>
      rules.find((item) => item.name === name)?.value ?? 0
    const candidates: EwSCandidate[] = []
    const addCandidate = (
      asset: Asset,
      name: string,
      severity: Severity,
      note: string,
      type = asset.type,
    ) =>
      candidates.push({
        name,
        type,
        location: asset.location,
        pic: asset.pic,
        severity,
        note,
        assetName: asset.name,
      })

    assets.forEach((asset) => {
      if (asset.cpu > rule("CPU")) {
        addCandidate(
          asset,
          `CPU melewati threshold ${rule("CPU")}%`,
          "High",
          `${asset.name} • CPU ${asset.cpu}%`,
        )
      }
      if (asset.memory > rule("Memory")) {
        addCandidate(
          asset,
          `Memory melewati threshold ${rule("Memory")}%`,
          "High",
          `${asset.name} • Memory ${asset.memory}%`,
        )
      }
      if (asset.disk > rule("Disk EWS")) {
        addCandidate(
          asset,
          `Disk melewati threshold ${rule("Disk EWS")}%`,
          helpers.diskSeverity(asset.disk),
          `${asset.name} • Disk ${asset.disk}%`,
        )
      }
      if (
        asset.type === "Database" &&
        asset.disk > rule("DB Tablespace")
      ) {
        addCandidate(
          asset,
          "Tablespace database mendekati penuh",
          helpers.diskSeverity(asset.disk),
          `${asset.name} • Tablespace ${asset.disk}%`,
          "Database",
        )
      }
      if (
        asset.type === "Backup" &&
        (asset.status !== "Online" ||
          asset.note.toLowerCase().includes("gagal"))
      ) {
        addCandidate(
          asset,
          "Backup terjadwal gagal",
          "Critical",
          `${asset.name} • ${asset.note}`,
          "Backup",
        )
      }
      const lag = Number(asset.note.match(/lag (\d+)/i)?.[1] ?? 0)
      if (lag > rule("Replication lag")) {
        addCandidate(
          asset,
          "Replication lag melewati threshold",
          "High",
          `${asset.name} • lag ${lag} detik`,
          "Database",
        )
      }
      if (
        helpers.daysUntil(asset.expiry) <= rule("OS EOL") &&
        asset.type === "Server"
      ) {
        addCandidate(
          asset,
          "Lifecycle OS mendekati akhir dukungan",
          "High",
          `${asset.name} • expiry ${asset.expiry}`,
          "Server",
        )
      }
      if (
        asset.type === "Database" &&
        asset.growth > rule("DB Growth abnormal")
      ) {
        addCandidate(
          asset,
          "Pertumbuhan database di atas baseline",
          "High",
          `${asset.name} • growth ${asset.growth}% baseline`,
          "Database",
        )
      }
      if (asset.status === "Offline") {
        addCandidate(
          asset,
          "Service terdeteksi down",
          "Critical",
          `${asset.name} • status Offline`,
        )
      }
      const capacityDays = helpers.forecastDays(
        asset.capacity,
        asset.used,
        asset.growth,
      )
      if (
        capacityDays !== null &&
        capacityDays <= rule("Capacity forecast")
      ) {
        addCandidate(
          asset,
          "Forecast kapasitas melewati batas EWS",
          "High",
          `${asset.name} • prediksi penuh ${capacityDays} hari`,
        )
      }
    })

    lifecycle.forEach((item) => {
      const days = helpers.daysUntil(item.expiry)
      const limit =
        item.type === "certificates"
          ? rule("Certificate expiry")
          : item.type === "licenses"
            ? rule("License expiry")
            : -1
      if (limit >= 0 && days <= limit) {
        candidates.push({
          name:
            item.type === "certificates"
              ? `Sertifikat ${item.name} H-${days}`
              : `Perpanjangan ${item.name} H-${days}`,
          type: item.type === "certificates" ? "Sertifikat" : "Lisensi",
          location: item.location,
          pic: item.pic,
          severity:
            helpers.lifecycleSeverity(days) === "Expired"
              ? "Critical"
              : (helpers.lifecycleSeverity(days) as Severity),
          note: `${item.name} • expiry ${item.expiry}`,
          assetName: item.name,
        })
      }
    })

    const openAlerts = read("alerts").filter(
      (alert) => alert.status !== "Ditutup",
    )
    const uniqueCandidates = candidates.filter(
      (candidate, index) =>
        candidates.findIndex(
          (item) =>
            item.name === candidate.name &&
            item.assetName === candidate.assetName,
        ) === index &&
        !openAlerts.some(
          (alert) =>
            alert.name === candidate.name ||
            (alert.type === candidate.type &&
              (alert.note.includes(candidate.assetName) ||
                alert.name.includes(candidate.assetName))),
        ),
    )
    let nextNumber =
      Math.max(
        0,
        ...read("alerts").map(
          (alert) => Number(alert.id.replace(/\D/g, "")) || 0,
        ),
      ) + 1
    const createdAudits: AuditEntry[] = []

    uniqueCandidates.forEach((candidate) => {
      const alert: AlertItem = {
        id: `ALT-${String(nextNumber).padStart(3, "0")}`,
        name: candidate.name,
        type: candidate.type,
        location: candidate.location,
        pic: candidate.pic,
        status: "Baru",
        severity: candidate.severity,
        note: candidate.note,
        createdAt: new Date().toISOString(),
      }
      nextNumber += 1
      add("alerts", alert)
      const auditEntry = createAuditEntry(
        [...read("audit"), ...createdAudits],
        user,
        "EWS dievaluasi",
        alert.id,
        "Alert baru dibuat",
      )
      createdAudits.push(auditEntry)
      add("audit", auditEntry)
    })

    setToast(
      uniqueCandidates.length > 0
        ? `${uniqueCandidates.length} alert baru dibuat`
        : "Tidak ada alert baru; duplikat terbuka dilewati",
    )
  }

  const columns: DataTableColumn<AlertItem>[] = [
    { key: "id", header: "ID", render: (alert) => alert.id },
    {
      key: "name",
      header: "Alert",
      render: (alert) => <strong>{alert.name}</strong>,
    },
    { key: "type", header: "Jenis", render: (alert) => alert.type },
    { key: "location", header: "Lokasi", render: (alert) => alert.location },
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
    const timeline = read("audit")
      .filter((entry) => entry.target === selected.id)
      .sort(
        (a, b) => new Date(a.time).getTime() - new Date(b.time).getTime(),
      )
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
            <p className="bodycopy text-muted">{selected.note}</p>
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
              <div>
                <strong className="small-copy">Alert dibuat</strong>
                <span className="label text-muted">{selected.createdAt}</span>
              </div>
              {timeline.map((entry) => (
                <div key={entry.id}>
                  <strong className="small-copy">{entry.action}</strong>
                  <span className="label text-muted">{entry.detail}</span>
                  <span className="label text-muted">
                    {entry.user} · {entry.time}
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
                {...restrictedAction(canEdit)}
                onClick={() => changeStatus(selected, "Diakui")}
              >
                Akui Alert
              </button>
            )}
            {selected.status === "Diakui" && (
              <WorkflowForm
                title="Mulai Remediasi"
                allowed={canEdit}
                onSubmit={(note) =>
                  changeStatus(selected, "Dalam Penanganan", note)
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
                    changeStatus(selected, "Dalam Penanganan", note)
                  }
                />
                <button
                  className="button button--primary"
                  onClick={() => setConfirmClose(true)}
                >
                  Setujui & Tutup
                </button>
              </>
            )}
            {selected.status === "Ditutup" && (
              <p className="bodycopy text-muted">
                Alert telah ditutup dan tidak memerlukan tindakan lanjutan.
              </p>
            )}
          </GlassCard>
        </div>

        <ConfirmDialog
          open={confirmClose}
          title="Setujui dan tutup alert?"
          description="Pastikan bukti remediasi telah diverifikasi sebelum menutup alert."
          confirmLabel="Setujui & Tutup"
          onClose={() => setConfirmClose(false)}
          onConfirm={() => {
            changeStatus(selected, "Ditutup")
            setConfirmClose(false)
          }}
        />
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
            onClick={evaluateEws}
            {...restrictedAction(canConfig)}
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
