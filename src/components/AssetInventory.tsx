import { ArrowDownWideNarrow, ArrowUpNarrowWide, Download, Pencil, Plus, Search } from "lucide-react"
import { motion } from "motion/react"
import { type ReactNode, useMemo, useState } from "react"
import { cn } from "@/lib/utils"
import { restrictedAction, useAccess } from "../lib/useAccess"
import { type AssetInput, useSynraStore } from "../lib/useSynraStore"
import { ApiError } from "../lib/api"
import { formatDateTime } from "../lib/backend"
import type { Asset } from "../lib/synraDomain"
import {
  SEVERITY_FILTER_ITEMS,
  ApiErrorBanner,
  CardHeading,
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

function MetricBar({ label, value, compact = false }: { label: string; value: number; compact?: boolean }) {
  const tone = value >= 90 ? "bg-danger" : value >= 80 ? "bg-warning" : "bg-primary"
  return (
    <div className={cn("min-w-0", compact ? "w-[120px]" : "w-full")}>
      <div className={cn("mb-1 flex items-center justify-between gap-2", compact ? "text-[11px]" : "text-xs")}>
        <span className="truncate text-muted-foreground">{label}</span>
        <span className={cn("font-medium tabular-nums", value >= 90 ? "text-danger" : value >= 80 ? "text-warning" : "")}>
          {value.toLocaleString("id-ID")}%
        </span>
      </div>
      <div className={cn("overflow-hidden rounded-full bg-muted", compact ? "h-1" : "h-1.5")}>
        <motion.div
          className={cn("h-full rounded-full", tone)}
          initial={{ width: 0 }}
          animate={{ width: `${Math.min(value, 100)}%` }}
          transition={{ duration: 0.7, ease: "easeOut" }}
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
        className="flex flex-col gap-4"
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
          <Select items={Object.fromEntries(api.hosts.map((h) => [h.id, h.name]))}
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
          <Select items={CATEGORY_LABEL}
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
          <Select items={{ "": "Tanpa pilihan", ...Object.fromEntries(api.supervisors.map((s) => [s.id, s.fullName])) }}
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
          <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger" role="alert">
            {error}
          </p>
        )}

        <div className="sticky bottom-0 -mx-5 -mb-5 mt-2 flex justify-end gap-2 border-t border-border bg-popover px-5 py-4">
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

function AssetDetail({ asset, onEdit }: { asset: Asset; onEdit: () => void }) {
  const { read } = useSynraStore()
  const { can } = useAccess()
  // Aset boleh ditulis ADMIN dan SUPERVISOR, sama dengan pemegang hak approve.
  const canEdit = can("approve")
  const history = read("alerts").filter((alert) => alert.hostname === asset.name)

  const meta: [string, ReactNode][] = [
    ["Komponen", asset.type],
    ["Host", asset.location],
    ["Kategori", asset.category ? CATEGORY_LABEL[asset.category] : "—"],
    ["Tipe", asset.assetType ?? "—"],
    ["PIC", asset.pic],
    ["Data terakhir", formatDateTime(asset.lastSeenAt ?? null)],
  ]
  const audit: [string, string][] = [
    ["User input", asset.userInput ?? "—"],
    ["Waktu input", formatDateTime(asset.dtimeInput ?? null)],
    ["Supervisor input", asset.supervisorInput ?? "—"],
    ["User update", asset.userUpdate ?? "—"],
    ["Waktu update", formatDateTime(asset.timeUpdate ?? null)],
    ["Supervisor update", asset.supervisorUpdate ?? "—"],
  ]

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <GlassCard className="min-w-0 overflow-hidden p-0">
        <div className="flex flex-wrap items-start justify-between gap-4 border-b border-border p-5 md:p-6">
          <div className="min-w-0">
            <span className="font-mono text-xs text-muted-foreground">{asset.ipAddress}</span>
            <h2 className="mt-1 truncate text-xl font-semibold tracking-tight md:text-2xl">{asset.name}</h2>
            <p className="type-body mt-1 text-muted-foreground">{asset.note || "Tanpa catatan"}</p>
            <div className="mt-3 flex flex-wrap gap-2">
              <StatusBadge status={asset.status} tone={statusTone(asset.status)} />
              <SeverityBadge severity={asset.severity} />
            </div>
          </div>
          <Button onClick={onEdit} {...restrictedAction(canEdit)}>
            <Pencil {...iconProps} />
            Ubah data
          </Button>
        </div>
        <dl className="grid grid-cols-2 gap-px bg-border sm:grid-cols-3 xl:grid-cols-6">
          {meta.map(([label, value]) => (
            <div key={label} className="min-w-0 bg-card p-4">
              <dt className="type-label text-muted-foreground">{label}</dt>
              <dd className="mt-1 truncate text-sm font-medium">{value}</dd>
            </div>
          ))}
        </dl>
        <details className="group border-t border-border">
          <summary className="flex cursor-pointer list-none items-center justify-between px-5 py-3 text-xs text-muted-foreground hover:text-foreground md:px-6">
            Jejak input & perubahan
            <span className="transition-transform group-open:rotate-180">▾</span>
          </summary>
          <dl className="grid grid-cols-1 gap-x-6 gap-y-3 px-5 pb-5 sm:grid-cols-2 lg:grid-cols-3 md:px-6">
            {audit.map(([label, value]) => (
              <div key={label} className="flex min-w-0 justify-between gap-3 border-b border-border/60 pb-2 text-sm">
                <dt className="text-muted-foreground">{label}</dt>
                <dd className="truncate text-right">{value}</dd>
              </div>
            ))}
          </dl>
        </details>
      </GlassCard>

      <div className="grid min-w-0 gap-6 md:grid-cols-2 xl:grid-cols-3">
        <GlassCard className="flex min-w-0 flex-col gap-5 p-5">
          <CardHeading title="Utilisasi Saat Ini" description="Nilai metrik terbaru" />
          <div className="flex flex-col gap-4">
            <MetricBar label="CPU" value={asset.cpu} />
            <MetricBar label="Memori" value={asset.memory} />
            <MetricBar label="Disk" value={asset.disk} />
          </div>
        </GlassCard>

        <GlassCard className="flex min-w-0 flex-col gap-5 p-5">
          <CardHeading title="Mount Point" description={`Uptime ${formatUptime(asset.uptimeMs)}`} />
          <div className="flex flex-col gap-4">
            {(asset.disks ?? []).map((disk) => (
              <MetricBar key={disk.mountPoint} label={disk.mountPoint} value={disk.value} />
            ))}
            {(asset.disks ?? []).length === 0 && <p className="type-meta">Belum ada data disk.</p>}
          </div>
          <p className="type-meta mt-auto border-t border-border pt-3">
            Log ERROR periode terakhir: <span className="font-medium text-foreground">{asset.logErrors ?? "—"}</span>
          </p>
        </GlassCard>

        <GlassCard className="flex min-w-0 flex-col gap-5 p-5 md:col-span-2 xl:col-span-1">
          <CardHeading title="Riwayat Alert" description={`${history.length} alert tercatat`} />
          {history.length > 0 ? (
            <ul className="flex max-h-[320px] flex-col gap-2 overflow-y-auto">
              {history.map((alert) => (
                <li key={alert.id} className="min-w-0 rounded-lg border border-border bg-muted/40 p-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="truncate text-sm font-medium">{alert.name}</span>
                    <SeverityBadge severity={alert.severity} />
                  </div>
                  <span className="mt-1 block text-xs text-muted-foreground">
                    {alert.id} · {alert.status} · {alert.createdAt}
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="type-meta">Belum ada alert untuk aset ini.</p>
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
    { key: "id", header: "IP", render: (asset) => <span className="font-mono text-xs text-muted-foreground">{asset.ipAddress}</span> },
    {
      key: "name",
      header: "Hostname",
      render: (asset) => <strong className="whitespace-nowrap font-medium">{asset.name}</strong>,
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
        <div className="flex flex-col gap-1.5">
          <MetricBar compact label="CPU" value={asset.cpu} />
          <MetricBar compact label="Mem" value={asset.memory} />
          <MetricBar compact label="Disk" value={asset.disk} />
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
    <div className="flex min-w-0 flex-col gap-6">
      <ApiErrorBanner message={error} />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Total aset", assets.length, "text-foreground"],
          ["Daring", assets.filter((a) => a.status === "Online").length, "text-success"],
          ["Menurun / luring", assets.filter((a) => a.status === "Degraded" || a.status === "Offline").length, "text-danger"],
          ["Ditampilkan", filtered.length, "text-primary"],
        ].map(([label, value, tone]) => (
          <GlassCard key={label as string} className="min-w-0 p-4">
            <p className="type-label text-muted-foreground">{label}</p>
            <p className={cn("mt-1 text-2xl font-semibold tabular-nums", tone as string)}>{value}</p>
          </GlassCard>
        ))}
      </div>

      <GlassCard className="flex min-w-0 flex-col gap-4 p-4 md:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative min-w-0 flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="asset-search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="Cari hostname, IP, komponen, atau PIC"
              aria-label="Cari aset"
              className="pl-9"
            />
          </label>
          <div className="flex gap-2">
            <Button variant="outline" className="flex-1 sm:flex-none" onClick={exportCsv}>
              <Download {...iconProps} />
              Ekspor CSV
            </Button>
            <Button
              className="flex-1 sm:flex-none"
              {...restrictedAction(canEdit)}
              onClick={() => {
                setEditing(null)
                setDrawerOpen(true)
              }}
            >
              <Plus {...iconProps} />
              Tambah aset
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-[repeat(6,minmax(0,1fr))_auto] lg:items-end">
          <FilterField label="Komponen">
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

          <FilterField label="Kategori">
            <Select items={{ Semua: "Semua", ...CATEGORY_LABEL }}
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

          <FilterField label="Host">
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

          <FilterField label="Status">
            <Select items={{ Semua: "Semua", Online: "Daring", Degraded: "Menurun", Offline: "Luring (stale)", Nonaktif: "Nonaktif" }}
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

          <FilterField label="Severity">
            <Select items={SEVERITY_FILTER_ITEMS}
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

          <FilterField label="Urutkan">
            <Select items={{ name: "Hostname", cpu: "CPU", memory: "Memori", disk: "Disk" }} value={sortBy} onValueChange={(value) => setSortBy((value ?? "name") as typeof sortBy)}>
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="name">Hostname</SelectItem>
                <SelectItem value="cpu">CPU</SelectItem>
                <SelectItem value="memory">Memori</SelectItem>
                <SelectItem value="disk">Disk</SelectItem>
              </SelectContent>
            </Select>
          </FilterField>

          <Button
            variant="outline"
            className="self-end"
            onClick={() => setAscending((current) => !current)}
            aria-label={ascending ? "Urutan naik" : "Urutan turun"}
          >
            {ascending ? <ArrowUpNarrowWide {...iconProps} /> : <ArrowDownWideNarrow {...iconProps} />}
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
      <Toast visible={toastVisible} message="Data aset berhasil disimpan" onClose={() => setToastVisible(false)} />
    </div>
  )
}
