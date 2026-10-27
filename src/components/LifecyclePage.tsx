import { Pencil } from "lucide-react"
import { useMemo, useState } from "react"
import { createAuditEntry } from "../lib/audit"
import { restrictedAction, useAccess } from "../lib/useAccess"
import { useSynraStore } from "../lib/useSynraStore"
import type {
  LifecycleItem,
  RenewalRequest,
  Severity,
} from "../lib/synraDomain"
import {
  DataTable,
  Drawer,
  FormField,
  GlassCard,
  SeverityBadge,
  StatusBadge,
  Toast,
  type DataTableColumn,
} from "./ui"

export type LifecyclePageName =
  | "Lifecycle OS"
  | "Lisensi Software"
  | "Sertifikat SSL/TLS"
  | "Garansi Hardware"
  | "Kontrak Vendor"

const typeMap: Record<LifecyclePageName, LifecycleItem["type"] | null> = {
  "Lifecycle OS": null,
  "Lisensi Software": "licenses",
  "Sertifikat SSL/TLS": "certificates",
  "Garansi Hardware": "warranty",
  "Kontrak Vendor": "contracts",
}

const lifecycleTitles: Record<LifecyclePageName, string> = {
  "Lifecycle OS": "Siklus hidup OS",
  "Lisensi Software": "Lisensi perangkat lunak",
  "Sertifikat SSL/TLS": "Sertifikat SSL/TLS",
  "Garansi Hardware": "Garansi perangkat keras",
  "Kontrak Vendor": "Kontrak vendor",
}

const iconProps = {
  size: 20,
  strokeWidth: 1.75,
  "aria-hidden": true,
} as const

function ExpiryStatus({ days }: { days: number }) {
  const { helpers } = useSynraStore()
  const severity = helpers.lifecycleSeverity(days)
  if (severity === "Expired") {
    return <span className="badge badge--danger">Kedaluwarsa</span>
  }
  return <SeverityBadge severity={severity as Severity} />
}

function requestTone(status: RenewalRequest["status"]) {
  if (status === "Disetujui") return "success" as const
  if (status === "Ditolak") return "danger" as const
  return "warning" as const
}

function LifecycleEditDrawer({
  item,
  onClose,
  onSave,
}: {
  item: LifecycleItem
  onClose: () => void
  onSave: (
    values: Pick<
      LifecycleItem,
      "quantity" | "allocated" | "expiry" | "status"
    >,
  ) => string | null
}) {
  const [quantity, setQuantity] = useState(item.quantity)
  const [allocated, setAllocated] = useState(item.allocated)
  const [expiry, setExpiry] = useState(item.expiry)
  const [status, setStatus] = useState(item.status)
  const [error, setError] = useState("")

  return (
    <Drawer open title="Ubah siklus hidup" onClose={onClose}>
      <form
        className="asset-form"
        onSubmit={(event) => {
          event.preventDefault()
          const nextError = onSave({
            quantity,
            allocated,
            expiry,
            status,
          })
          if (nextError) {
            setError(nextError)
            return
          }
          onClose()
        }}
      >
        <FormField label="Jumlah / kuota">
          <input
            type="number"
            min="1"
            value={quantity}
            onChange={(event) => setQuantity(Number(event.target.value))}
          />
        </FormField>
        <FormField label="Terpakai / dialokasikan">
          <input
            type="number"
            min="0"
            value={allocated}
            onChange={(event) => setAllocated(Number(event.target.value))}
          />
        </FormField>
        <FormField label="Tanggal expiry">
          <input
            type="date"
            value={expiry}
            onChange={(event) => setExpiry(event.target.value)}
          />
        </FormField>
        <FormField label="Status">
          <select
            value={status}
            onChange={(event) =>
              setStatus(event.target.value as LifecycleItem["status"])
            }
          >
            <option>Aktif</option>
            <option value="Renewed">Diperpanjang</option>
            <option value="Terminated">Dihentikan</option>
            <option>Nonaktif</option>
          </select>
        </FormField>
        {error && (
          <p className="asset-form__error small-copy" role="alert">
            {error}
          </p>
        )}
        <div className="asset-form__actions">
          <button
            className="button button--secondary"
            type="button"
            onClick={onClose}
          >
            Batal
          </button>
          <button className="button button--primary" type="submit">
            Simpan perubahan
          </button>
        </div>
      </form>
    </Drawer>
  )
}

export default function LifecyclePage({
  name,
  selectedId,
  onSelectedIdChange,
}: {
  name: LifecyclePageName
  selectedId: string | null
  onSelectedIdChange: (id: string | null) => void
}) {
  const { read, add, update, helpers } = useSynraStore()
  const { user, can } = useAccess()
  const canEdit = can("edit")
  const canApprove = can("approve")
  const lifecycle = read("lifecycle")
  const requests = read("requests")
  const audit = read("audit")
  const lifecycleType = typeMap[name]
  const items = useMemo(
    () =>
      lifecycleType === null
        ? []
        : lifecycle.filter((item) => item.type === lifecycleType),
    [lifecycle, lifecycleType],
  )
  const [editing, setEditing] = useState(false)
  const [toast, setToast] = useState("")
  const selected =
    items.find((item) => item.id === selectedId) ??
    lifecycle.find((item) => item.id === selectedId) ??
    null

  const logAudit = (action: string, target: string, detail: string) =>
    add(
      "audit",
      createAuditEntry(read("audit"), user, action, target, detail),
    )

  const submitRequest = (item: LifecycleItem) => {
    if (!canEdit) return

    const existing = requests.find(
      (request) =>
        request.itemId === item.id && request.status === "Menunggu",
    )
    if (existing) {
      setToast("Pengajuan aktif sudah tersedia")
      return
    }
    const nextNumber =
      Math.max(
        0,
        ...requests.map(
          (request) => Number(request.id.replace(/\D/g, "")) || 0,
        ),
      ) + 1
    const request: RenewalRequest = {
      id: `REQ-${String(nextNumber).padStart(3, "0")}`,
      itemId: item.id,
      itemName: item.name,
      requestedBy: user.name,
      status: "Menunggu",
      createdAt: new Date().toISOString(),
    }
    add("requests", request)
    logAudit(
      "Pengajuan perpanjangan",
      request.id,
      `${item.name} diajukan untuk perpanjangan`,
    )
    setToast("Pengajuan perpanjangan berhasil dibuat")
  }

  const decideRequest = (
    request: RenewalRequest,
    status: "Disetujui" | "Ditolak",
  ) => {
    if (!canApprove) return

    update(
      "requests",
      (item) => item.id === request.id,
      { status },
    )
    logAudit(
      status === "Disetujui"
        ? "Pengajuan disetujui"
        : "Pengajuan ditolak",
      request.id,
      `${request.itemName}: ${status}`,
    )
    setToast(`Pengajuan ${status.toLowerCase()}`)
  }

  const columns: DataTableColumn<LifecycleItem>[] = [
    { key: "id", header: "ID", render: (item) => item.id },
    {
      key: "name",
      header: "Nama",
      render: (item) => <strong>{item.name}</strong>,
    },
    { key: "location", header: "Lokasi", render: (item) => item.location },
    { key: "pic", header: "PIC", render: (item) => item.pic },
    {
      key: "quota",
      header: name === "Lisensi Software" ? "Kuota / Terpakai" : "Jumlah",
      render: (item) =>
        name === "Lisensi Software"
          ? `${item.quantity} / ${item.allocated}`
          : item.quantity,
    },
    { key: "expiry", header: "Expiry", render: (item) => item.expiry },
    {
      key: "days",
      header: "Sisa Hari",
      render: (item) => {
        const days = helpers.daysUntil(item.expiry)
        return days < 0 ? `Lewat ${Math.abs(days)} hari` : `${days} hari`
      },
    },
    {
      key: "severity",
      header: "Badge",
      render: (item) => (
        <ExpiryStatus days={helpers.daysUntil(item.expiry)} />
      ),
    },
    {
      key: "status",
      header: "Status",
      render: (item) => (
        <StatusBadge
          status={item.status}
          tone={
            item.status === "Terminated"
              ? "danger"
              : item.status === "Renewed"
                ? "success"
                : "neutral"
          }
        />
      ),
    },
  ]

  if (selected) {
    const relatedRequests = requests.filter(
      (request) => request.itemId === selected.id,
    )
    return (
      <div className="lifecycle-detail">
        <div className="asset-detail__header">
          <button
            className="button button--primary"
            onClick={() => setEditing(true)}
            {...restrictedAction(canEdit)}
          >
            <Pencil {...iconProps} />
            Ubah siklus hidup
          </button>
        </div>
        <GlassCard className="lifecycle-detail__summary">
          <span className="pretext">{selected.id}</span>
          <h3 className="title-h3">{selected.name}</h3>
          <dl className="asset-summary__meta">
            <div>
              <dt>Expiry</dt>
              <dd>{selected.expiry}</dd>
            </div>
            <div>
              <dt>Sisa hari</dt>
              <dd>{helpers.daysUntil(selected.expiry)} hari</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{selected.status}</dd>
            </div>
            <div>
              <dt>Kuota</dt>
              <dd>
                {selected.allocated} / {selected.quantity}
              </dd>
            </div>
          </dl>
          <button
            className="button button--secondary lifecycle-request-button"
            onClick={() => submitRequest(selected)}
            {...restrictedAction(canEdit)}
          >
            Ajukan Perpanjangan
          </button>
        </GlassCard>

        <GlassCard className="lifecycle-requests">
          <div className="section-heading">
            <span className="pretext">PERSETUJUAN</span>
            <h3 className="title-h3">Pengajuan Perpanjangan</h3>
          </div>
          {relatedRequests.length > 0 ? (
            <div className="request-list">
              {relatedRequests.map((request) => (
                <div key={request.id}>
                  <div>
                    <strong className="small-copy">{request.id}</strong>
                    <span className="label text-muted">
                      {request.requestedBy} · {request.createdAt}
                    </span>
                  </div>
                  <StatusBadge
                    status={request.status}
                    tone={requestTone(request.status)}
                  />
                  {request.status === "Menunggu" && canApprove && (
                    <div className="request-list__actions">
                      <button
                        className="text-action"
                        onClick={() => decideRequest(request, "Ditolak")}
                      >
                        Tolak
                      </button>
                      <button
                        className="button button--primary"
                        onClick={() => decideRequest(request, "Disetujui")}
                      >
                        Setujui
                      </button>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ) : (
            <p className="bodycopy text-muted">
              Belum ada pengajuan untuk item ini.
            </p>
          )}
        </GlassCard>

        {editing && (
          <LifecycleEditDrawer
            item={selected}
            onClose={() => setEditing(false)}
            onSave={(values) => {
              if (
                values.quantity <= 0 ||
                values.allocated < 0 ||
                values.allocated > values.quantity
              ) {
                return "Alokasi tidak boleh melebihi kuota."
              }
              if (!values.expiry) return "Tanggal expiry wajib diisi."
              update(
                "lifecycle",
                (item) => item.id === selected.id,
                values,
              )
              logAudit(
                "Lifecycle diperbarui",
                selected.id,
                `Expiry ${values.expiry}, status ${values.status}`,
              )
              setToast("Lifecycle berhasil diperbarui")
              return null
            }}
          />
        )}
        <Toast
          visible={Boolean(toast)}
          message={toast}
          onClose={() => setToast("")}
        />
      </div>
    )
  }

  const pending = requests.filter((request) => request.status === "Menunggu")

  return (
    <div className="lifecycle-page">
      <GlassCard className="lifecycle-table">
        <div className="section-heading">
          <span className="pretext">LIFECYCLE</span>
          <h3 className="title-h3">{lifecycleTitles[name]}</h3>
        </div>
        {items.length > 0 ? (
          <DataTable
            columns={columns}
            rows={items}
            rowKey={(item) => item.id}
            onRowClick={(item) => onSelectedIdChange(item.id)}
          />
        ) : (
          <p className="bodycopy text-muted">
            Belum ada data lifecycle untuk kategori ini.
          </p>
        )}
      </GlassCard>

      {pending.length > 0 && (
        <GlassCard className="lifecycle-requests">
          <div className="section-heading">
            <span className="pretext">ADMINISTRATOR</span>
            <h3 className="title-h3">Pengajuan Menunggu Persetujuan</h3>
          </div>
          <div className="request-list">
            {pending.map((request) => (
              <div key={request.id}>
                <div>
                  <strong className="small-copy">{request.itemName}</strong>
                  <span className="label text-muted">
                    {request.id} · {request.requestedBy}
                  </span>
                </div>
                <StatusBadge status={request.status} tone="warning" />
                {canApprove && (
                  <div className="request-list__actions">
                    <button
                      className="text-action"
                      onClick={() => decideRequest(request, "Ditolak")}
                    >
                      Tolak
                    </button>
                    <button
                      className="button button--primary"
                      onClick={() => decideRequest(request, "Disetujui")}
                    >
                      Setujui
                    </button>
                  </div>
                )}
              </div>
            ))}
          </div>
        </GlassCard>
      )}
      <Toast
        visible={Boolean(toast)}
        message={toast}
        onClose={() => setToast("")}
      />
    </div>
  )
}
