import { Download, Pencil, Plus } from "lucide-react"
import { useMemo, useState } from "react"
import { restrictedAction, useAccess } from "../lib/useAccess"
import { type AssetInput, useSynraStore } from "../lib/useSynraStore"
import { ApiError } from "../lib/api"
import { formatDateTime } from "../lib/backend"
import type { Asset } from "../lib/synraDomain"
import {
  ApiErrorBanner,
  DataTable,
  Drawer,
  FormField,
  GlassCard,
  SeverityBadge,
  StatusBadge,
  Toast,
  type DataTableColumn,
} from "./ui"

const iconProps = {
  size: 20,
  strokeWidth: 1.75,
  "aria-hidden": true,
} as const

const PAGE_SIZE = 10

type AssetForm = Required<AssetInput>

const emptyForm: AssetForm = {
  hostname: "",
  ipAddress: "",
  component: "CORE_BANKING",
  bpdId: "",
  picName: "",
  picContact: "",
  notes: "",
}

const COMPONENT_SUGGESTIONS = ["CORE_BANKING", "DATABASE", "WEB", "MIDDLEWARE", "NETWORK"]

function formatUptime(ms: number | null | undefined) {
  if (!ms) return "—"
  const days = Math.floor(ms / 86_400_000)
  const hours = Math.floor((ms % 86_400_000) / 3_600_000)
  return `${days} hari ${hours} jam`
}

function MetricBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric-mini">
      <div>
        <span>{label}</span>
        <span>{value.toLocaleString("id-ID")}%</span>
      </div>
      <div className="metric-mini__track">
        <span
          className={
            value >= 90
              ? "metric-mini__fill metric-mini__fill--critical"
              : value >= 80
                ? "metric-mini__fill metric-mini__fill--warning"
                : "metric-mini__fill"
          }
          style={{ width: `${Math.min(value, 100)}%` }}
        />
      </div>
    </div>
  )
}

function statusTone(status: Asset["status"]) {
  if (status === "Online") return "success" as const
  if (status === "Degraded" || status === "Offline") return "danger" as const
  return "neutral" as const
}

function AssetFormDrawer({
  open,
  asset,
  types,
  onClose,
  onSave,
}: {
  open: boolean
  asset: Asset | null
  types: string[]
  onClose: () => void
  onSave: (values: AssetForm) => Promise<string | null>
}) {
  const { api } = useSynraStore()
  const [form, setForm] = useState<AssetForm>(
    asset
      ? {
          hostname: asset.name,
          ipAddress: asset.ipAddress ?? "",
          component: asset.type,
          bpdId: asset.bpdId ?? "",
          picName: asset.pic,
          picContact: asset.picContact ?? "",
          notes: asset.note,
        }
      : { ...emptyForm, bpdId: api.bpds[0]?.id ?? "" },
  )
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const components = [...new Set([...COMPONENT_SUGGESTIONS, ...types])].sort()

  const updateField = <K extends keyof AssetForm>(
    key: K,
    value: AssetForm[K],
  ) => setForm((current) => ({ ...current, [key]: value }))

  return (
    <Drawer
      open={open}
      title={asset ? "Ubah data aset" : "Tambah aset"}
      onClose={onClose}
    >
      <form
        className="asset-form"
        onSubmit={async (event) => {
          event.preventDefault()
          setSaving(true)
          const nextError = await onSave(form)
          setSaving(false)
          if (nextError) {
            setError(nextError)
            return
          }
          onClose()
        }}
      >
        <FormField label="Hostname" hint="Harus sama dengan host.name di Metricbeat">
          <input
            value={form.hostname}
            onChange={(event) => updateField("hostname", event.target.value)}
            placeholder="cbs-app-jtg-01"
            required
          />
        </FormField>
        <FormField label="Alamat IP">
          <input
            value={form.ipAddress}
            onChange={(event) => updateField("ipAddress", event.target.value)}
            placeholder="10.10.1.11"
            required
          />
        </FormField>
        <FormField label="Komponen">
          <input
            list="asset-components"
            value={form.component}
            onChange={(event) => updateField("component", event.target.value)}
            required
          />
          <datalist id="asset-components">
            {components.map((type) => (
              <option key={type} value={type} />
            ))}
          </datalist>
        </FormField>
        <FormField label="BPD">
          <select
            value={form.bpdId}
            onChange={(event) => updateField("bpdId", event.target.value)}
            required
          >
            {api.bpds.map((bpd) => (
              <option key={bpd.id} value={bpd.id}>
                {bpd.name}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="PIC">
          <input
            value={form.picName}
            onChange={(event) => updateField("picName", event.target.value)}
            placeholder="Tim penanggung jawab"
            required
          />
        </FormField>
        <FormField label="Kontak PIC (opsional)">
          <input
            value={form.picContact}
            onChange={(event) => updateField("picContact", event.target.value)}
            placeholder="Telepon atau username Telegram"
          />
        </FormField>
        <FormField label="Catatan (opsional)">
          <input
            value={form.notes}
            onChange={(event) => updateField("notes", event.target.value)}
          />
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
          <button className="button button--primary" type="submit" disabled={saving}>
            {saving ? "Menyimpan…" : asset ? "Simpan perubahan" : "Tambah aset"}
          </button>
        </div>
      </form>
    </Drawer>
  )
}

function AssetDetail({
  asset,
  onEdit,
}: {
  asset: Asset
  onEdit: () => void
}) {
  const { read } = useSynraStore()
  const { can } = useAccess()
  const canEdit = can("config")
  const history = read("alerts").filter((alert) => alert.hostname === asset.name)

  return (
    <div className="asset-detail">
      <div className="asset-detail__header">
        <button
          className="button button--primary"
          onClick={onEdit}
          {...restrictedAction(canEdit)}
        >
          <Pencil {...iconProps} />
          Ubah data
        </button>
      </div>

      <GlassCard className="asset-summary">
        <div>
          <span className="pretext">{asset.ipAddress}</span>
          <h3 className="title-h3">{asset.name}</h3>
          <p className="bodycopy text-muted">{asset.note || "Tanpa catatan"}</p>
        </div>
        <dl className="asset-summary__meta">
          <div>
            <dt>Komponen</dt>
            <dd>{asset.type}</dd>
          </div>
          <div>
            <dt>BPD</dt>
            <dd>{asset.location}</dd>
          </div>
          <div>
            <dt>PIC</dt>
            <dd>{asset.pic}</dd>
          </div>
          <div>
            <dt>Status</dt>
            <dd>
              <StatusBadge
                status={asset.status}
                tone={statusTone(asset.status)}
              />
            </dd>
          </div>
          <div>
            <dt>Severity</dt>
            <dd>
              <SeverityBadge severity={asset.severity} />
            </dd>
          </div>
          <div>
            <dt>Data terakhir</dt>
            <dd>{formatDateTime(asset.lastSeenAt ?? null)}</dd>
          </div>
        </dl>
      </GlassCard>

      <div className="asset-detail__grid">
        <GlassCard className="asset-detail__section">
          <span className="pretext">METRIK</span>
          <h3 className="title-h3">Utilisasi Saat Ini</h3>
          <div className="asset-detail__metrics">
            <MetricBar label="CPU" value={asset.cpu} />
            <MetricBar label="Memory" value={asset.memory} />
            <MetricBar label="Disk" value={asset.disk} />
          </div>
        </GlassCard>

        <GlassCard className="asset-detail__section">
          <span className="pretext">DISK & HOST</span>
          <h3 className="title-h3">Mount point</h3>
          <div className="asset-detail__metrics">
            {(asset.disks ?? []).map((disk) => (
              <MetricBar key={disk.mountPoint} label={disk.mountPoint} value={disk.value} />
            ))}
            {(asset.disks ?? []).length === 0 && (
              <p className="bodycopy text-muted">Belum ada data disk.</p>
            )}
          </div>
          <p className="bodycopy-em text-muted">
            Uptime {formatUptime(asset.uptimeMs)} · log ERROR periode terakhir: {asset.logErrors ?? "—"}
          </p>
        </GlassCard>

        <GlassCard className="asset-detail__section asset-detail__history">
          <span className="pretext">ALERT</span>
          <h3 className="title-h3">Riwayat Alert</h3>
          {history.length > 0 ? (
            <div className="detail-history">
              {history.map((alert) => (
                <div key={alert.id}>
                  <strong className="small-copy">
                    {alert.id} · {alert.name}
                  </strong>
                  <span className="label text-muted">
                    {alert.severity} · {alert.status} · {alert.createdAt}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="bodycopy text-muted">
              Belum ada alert untuk aset ini.
            </p>
          )}
        </GlassCard>
      </div>
    </div>
  )
}

export default function AssetInventory({
  selectedId,
  onSelectedIdChange,
}: {
  selectedId: string | null
  onSelectedIdChange: (id: string | null) => void
}) {
  const { read, actions, api, error } = useSynraStore()
  const { can } = useAccess()
  // Menambah/mengubah aset adalah konfigurasi (ADMIN) di backend.
  const canEdit = can("config")
  const assets = read("assets")
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("Semua")
  const [locationFilter, setLocationFilter] = useState("Semua")
  const [statusFilter, setStatusFilter] = useState("Semua")
  const [severityFilter, setSeverityFilter] = useState("Semua")
  const [sortBy, setSortBy] = useState<"name" | "cpu" | "memory" | "disk">(
    "name",
  )
  const [ascending, setAscending] = useState(true)
  const [page, setPage] = useState(1)
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [editing, setEditing] = useState<Asset | null>(null)
  const [toastVisible, setToastVisible] = useState(false)

  const types = [...new Set(assets.map((asset) => asset.type))].sort()
  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return assets
      .filter(
        (asset) =>
          (!query ||
            [asset.name, asset.ipAddress ?? "", asset.type, asset.pic].some((value) =>
              value.toLowerCase().includes(query),
            )) &&
          (typeFilter === "Semua" || asset.type === typeFilter) &&
          (locationFilter === "Semua" || asset.location === locationFilter) &&
          (statusFilter === "Semua" || asset.status === statusFilter) &&
          (severityFilter === "Semua" ||
            asset.severity === severityFilter),
      )
      .sort((a, b) => {
        const left = a[sortBy]
        const right = b[sortBy]
        const compared =
          typeof left === "number" && typeof right === "number"
            ? left - right
            : String(left).localeCompare(String(right), "id")
        return ascending ? compared : -compared
      })
  }, [
    assets,
    search,
    typeFilter,
    locationFilter,
    statusFilter,
    severityFilter,
    sortBy,
    ascending,
  ])

  const totalPages = Math.max(1, Math.ceil(filtered.length / PAGE_SIZE))
  const visibleRows = filtered.slice(
    (page - 1) * PAGE_SIZE,
    page * PAGE_SIZE,
  )
  const selected = assets.find((asset) => asset.id === selectedId) ?? null

  const columns: DataTableColumn<Asset>[] = [
    { key: "id", header: "IP", render: (asset) => asset.ipAddress },
    {
      key: "name",
      header: "Hostname",
      render: (asset) => <strong>{asset.name}</strong>,
    },
    { key: "type", header: "Komponen", render: (asset) => asset.type },
    { key: "location", header: "BPD", render: (asset) => asset.location },
    { key: "pic", header: "PIC", render: (asset) => asset.pic },
    {
      key: "status",
      header: "Status",
      render: (asset) => (
        <StatusBadge status={asset.status} tone={statusTone(asset.status)} />
      ),
    },
    {
      key: "severity",
      header: "Severity",
      render: (asset) => <SeverityBadge severity={asset.severity} />,
    },
    {
      key: "metrics",
      header: "CPU / Mem / Disk",
      render: (asset) => (
        <div className="table-metrics">
          <MetricBar label="C" value={asset.cpu} />
          <MetricBar label="M" value={asset.memory} />
          <MetricBar label="D" value={asset.disk} />
        </div>
      ),
    },
  ]

  const saveAsset = async (values: AssetForm): Promise<string | null> => {
    if (!canEdit) return "Anda tidak memiliki akses untuk tindakan ini."
    const input: AssetInput = {
      ...values,
      picContact: values.picContact.trim() || undefined,
      notes: values.notes.trim() || undefined,
    }
    try {
      if (editing?.apiId) await actions.updateAsset(editing.apiId, input)
      else await actions.createAsset(input)
    } catch (e) {
      if (e instanceof ApiError) return e.errors.length ? e.errors.join(" ") : e.message
      return "Gagal menyimpan aset."
    }
    setToastVisible(true)
    return null
  }

  const exportCsv = () => {
    const headers = [
      "IP",
      "Hostname",
      "Komponen",
      "BPD",
      "PIC",
      "Status",
      "Severity",
      "CPU",
      "Memory",
      "Disk",
    ]
    const escape = (value: string | number) =>
      `"${String(value).replace(/"/g, '""')}"`
    const csv = [
      headers.join(","),
      ...filtered.map((asset) =>
        [
          asset.ipAddress ?? "",
          asset.name,
          asset.type,
          asset.location,
          asset.pic,
          asset.status,
          asset.severity,
          asset.cpu,
          asset.memory,
          asset.disk,
        ]
          .map(escape)
          .join(","),
      ),
    ].join("\n")
    const url = URL.createObjectURL(
      new Blob([csv], { type: "text/csv;charset=utf-8" }),
    )
    const link = document.createElement("a")
    link.href = url
    link.download = "inventaris-aset-synra.csv"
    link.click()
    URL.revokeObjectURL(url)
  }

  if (selected) {
    return (
      <>
        <AssetDetail
          asset={selected}
          onEdit={() => {
            setEditing(selected)
            setDrawerOpen(true)
          }}
        />
        {drawerOpen && (
          <AssetFormDrawer
            key={editing?.id ?? "new"}
            open={drawerOpen}
            asset={editing}
            types={types}
            onClose={() => setDrawerOpen(false)}
            onSave={saveAsset}
          />
        )}
        <Toast
          visible={toastVisible}
          message="Data aset berhasil diperbarui"
          onClose={() => setToastVisible(false)}
        />
      </>
    )
  }

  return (
    <div className="inventory-page">
      <ApiErrorBanner message={error} />
      <GlassCard className="inventory-panel">
        <div className="inventory-toolbar">
          <div className="inventory-search">
            <label className="label" htmlFor="asset-search">
              Pencarian
            </label>
            <input
              id="asset-search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="Cari hostname, IP, komponen, atau PIC"
            />
          </div>
          <div className="inventory-actions">
            <button className="button button--secondary" onClick={exportCsv}>
              <Download {...iconProps} />
              Ekspor CSV
            </button>
            <button
              className="button button--primary"
              {...restrictedAction(canEdit)}
              onClick={() => {
                setEditing(null)
                setDrawerOpen(true)
              }}
            >
              <Plus {...iconProps} />
              Tambah aset
            </button>
          </div>
        </div>

        <div className="inventory-filters">
          <label>
            <span className="label">Komponen</span>
            <select
              value={typeFilter}
              onChange={(event) => {
                setTypeFilter(event.target.value)
                setPage(1)
              }}
            >
              <option>Semua</option>
              {types.map((type) => (
                <option key={type}>{type}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">BPD</span>
            <select
              value={locationFilter}
              onChange={(event) => {
                setLocationFilter(event.target.value)
                setPage(1)
              }}
            >
              <option>Semua</option>
              {api.bpds.map((bpd) => (
                <option key={bpd.id}>{bpd.name}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Status</span>
            <select
              value={statusFilter}
              onChange={(event) => {
                setStatusFilter(event.target.value)
                setPage(1)
              }}
            >
              <option>Semua</option>
              <option value="Online">Daring</option>
              <option value="Degraded">Menurun</option>
              <option value="Offline">Luring (stale)</option>
              <option>Nonaktif</option>
            </select>
          </label>
          <label>
            <span className="label">Severity</span>
            <select
              value={severityFilter}
              onChange={(event) => {
                setSeverityFilter(event.target.value)
                setPage(1)
              }}
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
            <span className="label">Urutkan</span>
            <select
              value={sortBy}
              onChange={(event) =>
                setSortBy(event.target.value as typeof sortBy)
              }
            >
              <option value="name">Hostname</option>
              <option value="cpu">CPU</option>
              <option value="memory">Memory</option>
              <option value="disk">Disk</option>
            </select>
          </label>
          <button
            className="text-action inventory-sort-direction"
            onClick={() => setAscending((current) => !current)}
          >
            {ascending ? "Naik" : "Turun"}
          </button>
        </div>

        <DataTable
          columns={columns}
          rows={visibleRows}
          rowKey={(asset) => asset.id}
          rowSeverity={(asset) => asset.severity}
          onRowClick={(asset) => onSelectedIdChange(asset.id)}
        />

        <div className="pagination">
          <span className="label text-muted">
            {filtered.length} aset · 10 per halaman
          </span>
          <div>
            <button
              disabled={page === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Sebelumnya
            </button>
            {Array.from({ length: totalPages }, (_, index) => index + 1).map(
              (number) => (
                <button
                  key={number}
                  className={page === number ? "pagination__active" : ""}
                  onClick={() => setPage(number)}
                >
                  {number}
                </button>
              ),
            )}
            <button
              disabled={page === totalPages}
              onClick={() =>
                setPage((current) => Math.min(totalPages, current + 1))
              }
            >
              Berikutnya
            </button>
          </div>
        </div>
      </GlassCard>

      {drawerOpen && (
        <AssetFormDrawer
          key={editing?.id ?? "new"}
          open={drawerOpen}
          asset={editing}
          types={types}
          onClose={() => setDrawerOpen(false)}
          onSave={saveAsset}
        />
      )}
      <Toast
        visible={toastVisible}
        message="Data aset berhasil disimpan"
        onClose={() => setToastVisible(false)}
      />
    </div>
  )
}
