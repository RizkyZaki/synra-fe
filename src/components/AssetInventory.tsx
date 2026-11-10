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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const iconProps = {
  size: 18,
  strokeWidth: 1.75,
  "aria-hidden": true,
} as const

type AssetForm = Required<Omit<AssetInput, "supervisorInputId" | "supervisorUpdateId">> & {
  supervisorId: string
}

const emptyForm: AssetForm = {
  hostname: "",
  ipAddress: "",
  component: "CORE_BANKING",
  hostId: "",
  category: "",
  type: "",
  picName: "",
  picContact: "",
  notes: "",
  supervisorId: "",
}

const COMPONENT_SUGGESTIONS = ["CORE_BANKING", "DATABASE", "WEB", "MIDDLEWARE", "NETWORK"]
const CATEGORY_LABEL = { HARDWARE: "Hardware", SOFTWARE: "Software" } as const
const TYPE_SUGGESTIONS = { HARDWARE: ["CPU", "MEMORY", "DISK"], SOFTWARE: ["VM"] } as const

function formatUptime(ms: number | null | undefined) {
  if (!ms) return "—"
  const days = Math.floor(ms / 86_400_000)
  const hours = Math.floor((ms % 86_400_000) / 3_600_000)
  return `${days} hari ${hours} jam`
}

function MetricBar({ label, value }: { label: string; value: number }) {
  return (
    <div className="metric-mini">
      <div className="type-meta">
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
          hostId: asset.hostId ?? "",
          category: asset.category ?? "",
          type: asset.assetType ?? "",
          picName: asset.pic,
          picContact: asset.picContact ?? "",
          notes: asset.note,
          supervisorId: "",
        }
      : { ...emptyForm, hostId: api.hosts[0]?.id ?? "" },
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
          <Input
            value={form.hostname}
            onChange={(event) => updateField("hostname", event.target.value)}
            placeholder="cbs-app-jtg-01"
            required
          />
        </FormField>
        <FormField label="Alamat IP">
          <Input
            value={form.ipAddress}
            onChange={(event) => updateField("ipAddress", event.target.value)}
            placeholder="10.10.1.11"
            required
          />
        </FormField>
        <FormField label="Komponen">
          <Input
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

        <FormField label="Host">
          <Select
            value={form.hostId}
            onValueChange={(value) => updateField("hostId", value ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Pilih host" />
            </SelectTrigger>
            <SelectContent>
              {api.hosts.map((host) => (
                <SelectItem key={host.id} value={host.id}>
                  {host.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="Kategori">
          <Select
            value={form.category}
            onValueChange={(value) =>
              updateField("category", (value ?? "") as AssetForm["category"])
            }
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Pilih kategori" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="HARDWARE">{CATEGORY_LABEL.HARDWARE}</SelectItem>
              <SelectItem value="SOFTWARE">{CATEGORY_LABEL.SOFTWARE}</SelectItem>
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="Tipe" hint="Mis. CPU untuk hardware, VM untuk software">
          <Input
            list="asset-types"
            value={form.type}
            onChange={(event) => updateField("type", event.target.value)}
            required
          />
          <datalist id="asset-types">
            {(form.category ? TYPE_SUGGESTIONS[form.category as keyof typeof TYPE_SUGGESTIONS] ?? [] : []).map((type) => (
              <option key={type} value={type} />
            ))}
          </datalist>
        </FormField>

        <FormField label="Supervisor" hint="Kosongkan bila Anda sendiri supervisornya">
          <Select
            value={form.supervisorId}
            onValueChange={(value) => updateField("supervisorId", value ?? "")}
          >
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Tanpa pilihan" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tanpa pilihan</SelectItem>
              {api.supervisors.map((supervisor) => (
                <SelectItem key={supervisor.id} value={supervisor.id}>
                  {supervisor.fullName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>

        <FormField label="PIC">
          <Input
            value={form.picName}
            onChange={(event) => updateField("picName", event.target.value)}
            placeholder="Tim penanggung jawab"
            required
          />
        </FormField>
        <FormField label="Kontak PIC (opsional)">
          <Input
            value={form.picContact}
            onChange={(event) => updateField("picContact", event.target.value)}
            placeholder="Telepon atau username Telegram"
          />
        </FormField>
        <FormField label="Catatan (opsional)">
          <Input
            value={form.notes}
            onChange={(event) => updateField("notes", event.target.value)}
          />
        </FormField>

        {error && (
          <p className="asset-form__error type-meta text-[var(--status-danger)]" role="alert">
            {error}
          </p>
        )}

        <div className="asset-form__actions">
          <Button
            variant="outline"
            type="button"
            onClick={onClose}
          >
            Batal
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Menyimpan…" : asset ? "Simpan perubahan" : "Tambah aset"}
          </Button>
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
  // Aset boleh ditulis ADMIN dan SUPERVISOR, sama dengan pemegang hak approve.
  const canEdit = can("approve")
  const history = read("alerts").filter((alert) => alert.hostname === asset.name)

  return (
    <div className="asset-detail">
      <div className="asset-detail__header">
        <Button
          onClick={onEdit}
          {...restrictedAction(canEdit)}
        >
          <Pencil {...iconProps} />
          Ubah data
        </Button>
      </div>

      <GlassCard className="asset-summary">
        <div>
          <span className="type-label text-muted-foreground">{asset.ipAddress}</span>
          <h3 className="type-card-title">{asset.name}</h3>
          <p className="type-body text-muted-foreground">{asset.note || "Tanpa catatan"}</p>
        </div>
        <dl className="asset-summary__meta">
          <div>
            <dt className="type-label text-muted-foreground">Komponen</dt>
            <dd className="type-body">{asset.type}</dd>
          </div>
          <div>
            <dt className="type-label text-muted-foreground">Host</dt>
            <dd className="type-body">{asset.location}</dd>
          </div>
          <div>
            <dt className="type-label text-muted-foreground">Kategori</dt>
            <dd className="type-body">{asset.category ? CATEGORY_LABEL[asset.category] : "—"}</dd>
          </div>
          <div>
            <dt className="type-label text-muted-foreground">Tipe</dt>
            <dd className="type-body">{asset.assetType ?? "—"}</dd>
          </div>
          <div>
            <dt className="type-label text-muted-foreground">PIC</dt>
            <dd className="type-body">{asset.pic}</dd>
          </div>
          <div>
            <dt className="type-label text-muted-foreground">Status</dt>
            <dd className="type-body">
              <StatusBadge
                status={asset.status}
                tone={statusTone(asset.status)}
              />
            </dd>
          </div>
          <div>
            <dt className="type-label text-muted-foreground">Severity</dt>
            <dd className="type-body">
              <SeverityBadge severity={asset.severity} />
            </dd>
          </div>
          <div>
            <dt className="type-label text-muted-foreground">Data terakhir</dt>
            <dd className="type-body">{formatDateTime(asset.lastSeenAt ?? null)}</dd>
          </div>
          <div>
            <dt className="type-label text-muted-foreground">User input</dt>
            <dd className="type-body">{asset.userInput ?? "—"}</dd>
          </div>
          <div>
            <dt className="type-label text-muted-foreground">Waktu input</dt>
            <dd className="type-body">{formatDateTime(asset.dtimeInput ?? null)}</dd>
          </div>
          <div>
            <dt className="type-label text-muted-foreground">Supervisor input</dt>
            <dd className="type-body">{asset.supervisorInput ?? "—"}</dd>
          </div>
          <div>
            <dt className="type-label text-muted-foreground">User update</dt>
            <dd className="type-body">{asset.userUpdate ?? "—"}</dd>
          </div>
          <div>
            <dt className="type-label text-muted-foreground">Waktu update</dt>
            <dd className="type-body">{formatDateTime(asset.timeUpdate ?? null)}</dd>
          </div>
          <div>
            <dt className="type-label text-muted-foreground">Supervisor update</dt>
            <dd className="type-body">{asset.supervisorUpdate ?? "—"}</dd>
          </div>
        </dl>
      </GlassCard>

      <div className="asset-detail__grid">
        <GlassCard className="asset-detail__section">
          <span className="type-label text-muted-foreground">METRIK</span>
          <h3 className="type-card-title">Utilisasi Saat Ini</h3>
          <div className="asset-detail__metrics">
            <MetricBar label="CPU" value={asset.cpu} />
            <MetricBar label="Memory" value={asset.memory} />
            <MetricBar label="Disk" value={asset.disk} />
          </div>
        </GlassCard>

        <GlassCard className="asset-detail__section">
          <span className="type-label text-muted-foreground">DISK &amp; HOST</span>
          <h3 className="type-card-title">Mount point</h3>
          <div className="asset-detail__metrics">
            {(asset.disks ?? []).map((disk) => (
              <MetricBar key={disk.mountPoint} label={disk.mountPoint} value={disk.value} />
            ))}
            {(asset.disks ?? []).length === 0 && (
              <p className="type-body text-muted-foreground">Belum ada data disk.</p>
            )}
          </div>
          <p className="type-meta text-muted-foreground">
            Uptime {formatUptime(asset.uptimeMs)} · log ERROR periode terakhir: {asset.logErrors ?? "—"}
          </p>
        </GlassCard>

        <GlassCard className="asset-detail__section asset-detail__history">
          <span className="type-label text-muted-foreground">ALERT</span>
          <h3 className="type-card-title">Riwayat Alert</h3>
          {history.length > 0 ? (
            <div className="detail-history">
              {history.map((alert) => (
                <div key={alert.id}>
                  <strong className="type-body font-medium">
                    {alert.id} · {alert.name}
                  </strong>
                  <span className="type-meta text-muted-foreground">
                    {alert.severity} · {alert.status} · {alert.createdAt}
                  </span>
                </div>
              ))}
            </div>
          ) : (
            <p className="type-body text-muted-foreground">
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
  // Menambah/mengubah aset dibatasi untuk ADMIN dan SUPERVISOR di backend.
  const canEdit = can("approve")
  const assets = read("assets")
  const [search, setSearch] = useState("")
  const [typeFilter, setTypeFilter] = useState("Semua")
  const [categoryFilter, setCategoryFilter] = useState("Semua")
  const [locationFilter, setLocationFilter] = useState("Semua")
  const [statusFilter, setStatusFilter] = useState("Semua")
  const [severityFilter, setSeverityFilter] = useState("Semua")
  const [sortBy, setSortBy] = useState<"name" | "cpu" | "memory" | "disk">(
    "name",
  )
  const [ascending, setAscending] = useState(true)
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
          (categoryFilter === "Semua" || asset.category === categoryFilter) &&
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
    categoryFilter,
    locationFilter,
    statusFilter,
    severityFilter,
    sortBy,
    ascending,
  ])

  const {
    page,
    setPage,
    totalPages,
    startIndex,
    endIndex,
    totalRows,
    paginatedRows,
  } = usePagination(filtered, 10)

  const selected = assets.find((asset) => asset.id === selectedId) ?? null

  const columns: DataTableColumn<Asset>[] = [
    { key: "id", header: "IP", render: (asset) => asset.ipAddress },
    {
      key: "name",
      header: "Hostname",
      render: (asset) => <strong>{asset.name}</strong>,
    },
    { key: "type", header: "Komponen", render: (asset) => asset.type },
    { key: "location", header: "Host", render: (asset) => asset.location },
    {
      key: "category",
      header: "Kategori",
      render: (asset) =>
        asset.category
          ? `${CATEGORY_LABEL[asset.category]} · ${asset.assetType ?? "—"}`
          : "—",
    },
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
    const { supervisorId, ...rest } = values
    const input: AssetInput = {
      ...rest,
      picContact: rest.picContact.trim() || undefined,
      notes: rest.notes.trim() || undefined,
      ...(supervisorId
        ? { [editing ? "supervisorUpdateId" : "supervisorInputId"]: supervisorId }
        : {}),
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
      "Host",
      "Kategori",
      "Tipe",
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
          asset.category ?? "",
          asset.assetType ?? "",
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
        <PageToolbar
          actions={
            <>
              <Button variant="outline" onClick={exportCsv}>
                <Download {...iconProps} />
                Ekspor CSV
              </Button>
              <Button
                {...restrictedAction(canEdit)}
                onClick={() => {
                  setEditing(null)
                  setDrawerOpen(true)
                }}
              >
                <Plus {...iconProps} />
                Tambah aset
              </Button>
            </>
          }
        >
          <FilterField label="Pencarian" className="min-w-[260px] flex-1">
            <Input
              id="asset-search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="Cari hostname, IP, komponen, atau PIC"
            />
          </FilterField>
        </PageToolbar>

        <div className="flex flex-wrap items-end gap-3 mt-4 mb-4">
          <FilterField label="Komponen" className="w-[140px]">
            <Select
              value={typeFilter}
              onValueChange={(value) => {
                setTypeFilter(value ?? "Semua")
                setPage(1)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Semua">Semua</SelectItem>
                {types.map((type) => (
                  <SelectItem key={type} value={type}>
                    {type}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Kategori" className="w-[140px]">
            <Select
              value={categoryFilter}
              onValueChange={(value) => {
                setCategoryFilter(value ?? "Semua")
                setPage(1)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Semua">Semua</SelectItem>
                <SelectItem value="HARDWARE">{CATEGORY_LABEL.HARDWARE}</SelectItem>
                <SelectItem value="SOFTWARE">{CATEGORY_LABEL.SOFTWARE}</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Host" className="w-[150px]">
            <Select
              value={locationFilter}
              onValueChange={(value) => {
                setLocationFilter(value ?? "Semua")
                setPage(1)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Semua">Semua</SelectItem>
                {api.hosts.map((host) => (
                  <SelectItem key={host.id} value={host.name}>
                    {host.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Status" className="w-[140px]">
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
                <SelectItem value="Online">Daring</SelectItem>
                <SelectItem value="Degraded">Menurun</SelectItem>
                <SelectItem value="Offline">Luring (stale)</SelectItem>
                <SelectItem value="Nonaktif">Nonaktif</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Severity" className="w-[130px]">
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

          <FilterField label="Urutkan" className="w-[130px]">
            <Select
              value={sortBy}
              onValueChange={(value) =>
                setSortBy((value ?? "name") as typeof sortBy)
              }
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Hostname</SelectItem>
                <SelectItem value="cpu">CPU</SelectItem>
                <SelectItem value="memory">Memory</SelectItem>
                <SelectItem value="disk">Disk</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>

          <Button
            variant="outline"
            className="h-[38px] px-3 font-normal"
            onClick={() => setAscending((current) => !current)}
          >
            {ascending ? "Naik" : "Turun"}
          </Button>
        </div>

        <DataTable
          columns={columns}
          rows={paginatedRows}
          rowKey={(asset) => asset.id}
          rowSeverity={(asset) => asset.severity}
          onRowClick={(asset) => onSelectedIdChange(asset.id)}
        />

        <Pagination
          page={page}
          totalPages={totalPages}
          totalRows={totalRows}
          startIndex={startIndex}
          endIndex={endIndex}
          onPageChange={setPage}
          itemLabel="aset"
        />
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
