import { Download, Pencil, Plus } from "lucide-react"
import { useMemo, useState } from "react"
import { createAuditEntry } from "../lib/audit"
import { restrictedAction, useAccess } from "../lib/useAccess"
import { useSynraStore } from "../lib/useSynraStore"
import type { Asset } from "../lib/synraDomain"
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

const iconProps = {
  size: 20,
  strokeWidth: 1.75,
  "aria-hidden": true,
} as const

const PAGE_SIZE = 10
const MAX_CAPACITY = 1_000_000

type AssetForm = Pick<
  Asset,
  "name" | "pic" | "type" | "location" | "capacity" | "expiry"
>

const emptyForm: AssetForm = {
  name: "",
  pic: "",
  type: "Server",
  location: "DC Serpong",
  capacity: 0,
  expiry: "",
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
  onSave: (values: AssetForm) => string | null
}) {
  const [form, setForm] = useState<AssetForm>(
    asset
      ? {
          name: asset.name,
          pic: asset.pic,
          type: asset.type,
          location: asset.location,
          capacity: asset.capacity,
          expiry: asset.expiry,
        }
      : emptyForm,
  )
  const [error, setError] = useState("")

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
        onSubmit={(event) => {
          event.preventDefault()
          const nextError = onSave(form)
          if (nextError) {
            setError(nextError)
            return
          }
          onClose()
        }}
      >
        <FormField label="Nama aset">
          <input
            value={form.name}
            onChange={(event) => updateField("name", event.target.value)}
            placeholder="Nama aset"
            required
          />
        </FormField>
        <FormField label="PIC">
          <input
            value={form.pic}
            onChange={(event) => updateField("pic", event.target.value)}
            placeholder="Tim penanggung jawab"
            required
          />
        </FormField>
        <FormField label="Jenis">
          <select
            value={form.type}
            onChange={(event) => updateField("type", event.target.value)}
          >
            {types.map((type) => (
              <option key={type} value={type}>
                {type}
              </option>
            ))}
          </select>
        </FormField>
        <FormField label="Lokasi">
          <select
            value={form.location}
            onChange={(event) =>
              updateField(
                "location",
                event.target.value as Asset["location"],
              )
            }
          >
            <option value="DC Serpong">DC Serpong</option>
            <option value="DRC Surabaya">DRC Surabaya</option>
          </select>
        </FormField>
        <FormField
          label="Kapasitas (GB)"
          hint={`Maksimum ${MAX_CAPACITY.toLocaleString("id-ID")} GB`}
        >
          <input
            type="number"
            min="1"
            max={MAX_CAPACITY}
            value={form.capacity || ""}
            onChange={(event) =>
              updateField("capacity", Number(event.target.value))
            }
            required
          />
        </FormField>
        <FormField label="Lifecycle / kedaluwarsa">
          <input
            type="date"
            value={form.expiry}
            onChange={(event) => updateField("expiry", event.target.value)}
            required
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
          <button className="button button--primary" type="submit">
            {asset ? "Simpan perubahan" : "Tambah aset"}
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
  const { read, helpers } = useSynraStore()
  const { can } = useAccess()
  const canEdit = can("edit")
  const history = read("audit").filter(
    (entry) =>
      entry.target === asset.id ||
      entry.detail.toLowerCase().includes(asset.name.toLowerCase()),
  )
  const forecast90 = helpers.forecastDays(
    asset.capacity,
    asset.used,
    asset.growth,
    0.9,
  )
  const forecast95 = helpers.forecastDays(
    asset.capacity,
    asset.used,
    asset.growth,
    0.95,
  )
  const forecast100 = helpers.forecastDays(
    asset.capacity,
    asset.used,
    asset.growth,
  )

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
          <span className="pretext">{asset.id}</span>
          <h3 className="title-h3">{asset.name}</h3>
          <p className="bodycopy text-muted">{asset.note || "Tanpa catatan"}</p>
        </div>
        <dl className="asset-summary__meta">
          <div>
            <dt>Jenis</dt>
            <dd>{asset.type}</dd>
          </div>
          <div>
            <dt>Lokasi</dt>
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
            <dt>Kedaluwarsa</dt>
            <dd>{asset.expiry}</dd>
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
          <span className="pretext">FORECAST LINEAR</span>
          <h3 className="title-h3">Kapasitas</h3>
          <dl className="forecast-list">
            <div>
              <dt>Target 90%</dt>
              <dd>{forecast90 === null ? "—" : `${forecast90} hari`}</dd>
            </div>
            <div>
              <dt>Target 95%</dt>
              <dd>{forecast95 === null ? "—" : `${forecast95} hari`}</dd>
            </div>
            <div>
              <dt>Target 100%</dt>
              <dd>{forecast100 === null ? "—" : `${forecast100} hari`}</dd>
            </div>
          </dl>
          <p className="bodycopy-em text-muted">
            Pertumbuhan {asset.growth.toLocaleString("id-ID")} GB per hari.
          </p>
        </GlassCard>

        <GlassCard className="asset-detail__section asset-detail__history">
          <span className="pretext">AUDIT TRAIL</span>
          <h3 className="title-h3">Riwayat Aset</h3>
          {history.length > 0 ? (
            <div className="detail-history">
              {history.map((entry) => (
                <div key={entry.id}>
                  <strong className="small-copy">{entry.action}</strong>
                  <span className="label text-muted">
                    {entry.user} · {entry.detail}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="bodycopy text-muted">
              Belum ada riwayat khusus untuk aset ini.
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
  const { read, add, update } = useSynraStore()
  const { user, can } = useAccess()
  const canEdit = can("edit")
  const assets = read("assets")
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("Semua")
  const [locationFilter, setLocationFilter] = useState("Semua")
  const [statusFilter, setStatusFilter] = useState("Semua")
  const [severityFilter, setSeverityFilter] = useState("Semua")
  const [sortBy, setSortBy] = useState<"id" | "name" | "cpu" | "memory" | "disk">(
    "id",
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
            [asset.id, asset.name, asset.type, asset.pic].some((value) =>
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
    { key: "id", header: "ID", render: (asset) => asset.id },
    {
      key: "name",
      header: "Nama",
      render: (asset) => <strong>{asset.name}</strong>,
    },
    { key: "type", header: "Jenis", render: (asset) => asset.type },
    { key: "location", header: "Lokasi", render: (asset) => asset.location },
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

  const saveAsset = (values: AssetForm) => {
    if (!canEdit) return "Anda tidak memiliki akses untuk tindakan ini."
    const name = values.name.trim()
    const duplicate = assets.some(
      (asset) =>
        asset.name.toLowerCase() === name.toLowerCase() &&
        asset.id !== editing?.id,
    )
    if (!name || !values.pic.trim() || !values.expiry) {
      return "Semua field wajib diisi."
    }
    if (duplicate) return "Nama aset sudah digunakan."
    if (
      !Number.isFinite(values.capacity) ||
      values.capacity <= 0 ||
      values.capacity > MAX_CAPACITY
    ) {
      return `Kapasitas harus antara 1 dan ${MAX_CAPACITY.toLocaleString("id-ID")} GB.`
    }
    if (editing && values.capacity < editing.used) {
      return "Kapasitas tidak boleh lebih kecil dari kapasitas terpakai."
    }

    if (editing) {
      update(
        "assets",
        (asset) => asset.id === editing.id,
        {
          ...values,
          name,
          pic: values.pic.trim(),
        },
      )
      add(
        "audit",
        createAuditEntry(
          read("audit"),
          user,
          "Data aset diperbarui",
          editing.id,
          name,
        ),
      )
    } else {
      const nextNumber =
        Math.max(
          0,
          ...assets.map((asset) => Number(asset.id.replace(/\D/g, "")) || 0),
        ) + 1
      const id = `AST-${String(nextNumber).padStart(3, "0")}`
      add("assets", {
        id,
        ...values,
        name,
        pic: values.pic.trim(),
        status: "Nonaktif",
        severity: "Normal",
        cpu: 0,
        memory: 0,
        disk: 0,
        used: 0,
        growth: 0,
        note: "",
      })
      add(
        "audit",
        createAuditEntry(
          read("audit"),
          user,
          "Aset ditambahkan",
          id,
          name,
        ),
      )
    }
    setToastVisible(true)
    return null
  }

  const exportCsv = () => {
    const headers = [
      "ID",
      "Nama",
      "Jenis",
      "Lokasi",
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
          asset.id,
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
              placeholder="Cari ID, nama, jenis, atau PIC"
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
            <span className="label">Jenis</span>
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
            <span className="label">Lokasi</span>
            <select
              value={locationFilter}
              onChange={(event) => {
                setLocationFilter(event.target.value)
                setPage(1)
              }}
            >
              <option>Semua</option>
              <option>DC Serpong</option>
              <option>DRC Surabaya</option>
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
              <option value="Offline">Luring</option>
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
              <option value="id">ID</option>
              <option value="name">Nama</option>
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
