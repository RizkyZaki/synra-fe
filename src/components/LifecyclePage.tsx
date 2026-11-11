import { Pencil, Plus } from "lucide-react"
import { useMemo, useState } from "react"
import { ApiError } from "../lib/api"
import {
  LIFECYCLE_CATEGORY_TO_BE,
  LIFECYCLE_STATUS_TO_BE,
} from "../lib/backend"
import { restrictedAction, useAccess } from "../lib/useAccess"
import { useSynraStore, type LifecycleInput } from "../lib/useSynraStore"
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

export type LifecyclePageName =
  | "Lifecycle OS"
  | "Lisensi Software"
  | "Sertifikat SSL/TLS"
  | "Garansi Hardware"
  | "Kontrak Vendor"

const typeMap: Record<LifecyclePageName, LifecycleItem["type"]> = {
  "Lifecycle OS": "os",
  "Lisensi Software": "licenses",
  "Sertifikat SSL/TLS": "certificates",
  "Garansi Hardware": "warranty",
  "Kontrak Vendor": "contracts",
}

const lifecycleCardTitles: Record<LifecyclePageName, string> = {
  "Lifecycle OS": "Daftar Sistem Operasi",
  "Lisensi Software": "Daftar Lisensi",
  "Sertifikat SSL/TLS": "Daftar Sertifikat",
  "Garansi Hardware": "Daftar Garansi",
  "Kontrak Vendor": "Daftar Kontrak",
}

const iconProps = {
  size: 20,
  strokeWidth: 1.75,
  "aria-hidden": true,
} as const

const errorText = (e: unknown, fallback: string) =>
  e instanceof ApiError ? e.message : fallback

/** Tanggal YYYY-MM-DD ditambah n tahun (untuk usulan tanggal berakhir baru). */
const plusYears = (date: string, years: number) => {
  const [y, m, d] = date.split("-").map(Number)
  return `${y + years}-${String(m).padStart(2, "0")}-${String(d).padStart(2, "0")}`
}

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

interface FormValues {
  name: string
  location: string
  picName: string
  vendor: string
  quantity: number
  allocated: number
  expiry: string
  status: string
}

/** Form tambah dan ubah item. Kategori mengikuti halaman yang sedang dibuka. */
function LifecycleFormDrawer({
  item,
  title,
  onClose,
  onSave,
}: {
  item: LifecycleItem | null
  title: string
  onClose: () => void
  onSave: (values: FormValues) => Promise<string | null>
}) {
  const [values, setValues] = useState<FormValues>({
    name: item?.name ?? "",
    location: item && item.location !== "—" ? item.location : "",
    picName: item && item.pic !== "—" ? item.pic : "",
    vendor: item?.vendor ?? "",
    quantity: item?.quantity ?? 1,
    allocated: item?.allocated ?? 0,
    expiry: item?.expiry ?? "",
    status: item?.status ?? "Aktif",
  })
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const set = <K extends keyof FormValues>(key: K, value: FormValues[K]) =>
    setValues((current) => ({ ...current, [key]: value }))

  return (
    <Drawer open title={title} onClose={onClose}>
      <form
        className="asset-form"
        onSubmit={async (event) => {
          event.preventDefault()
          if (!values.name.trim()) return setError("Nama wajib diisi.")
          if (!values.expiry) return setError("Tanggal berakhir wajib diisi.")
          if (values.quantity <= 0 || values.allocated < 0 || values.allocated > values.quantity) {
            return setError("Jumlah terpakai tidak boleh melebihi kuota.")
          }
          setSaving(true)
          const nextError = await onSave(values)
          setSaving(false)
          if (nextError) {
            setError(nextError)
            return
          }
          onClose()
        }}
      >
        <FormField label="Nama">
          <Input value={values.name} onChange={(event) => set("name", event.target.value)} />
        </FormField>
        <FormField label="Lokasi">
          <Input value={values.location} onChange={(event) => set("location", event.target.value)} />
        </FormField>
        <FormField label="PIC">
          <Input value={values.picName} onChange={(event) => set("picName", event.target.value)} />
        </FormField>
        <FormField label="Vendor">
          <Input value={values.vendor} onChange={(event) => set("vendor", event.target.value)} />
        </FormField>
        <FormField label="Jumlah / kuota">
          <Input
            type="number"
            min="1"
            value={values.quantity}
            onChange={(event) => set("quantity", Number(event.target.value))}
          />
        </FormField>
        <FormField label="Terpakai / dialokasikan">
          <Input
            type="number"
            min="0"
            value={values.allocated}
            onChange={(event) => set("allocated", Number(event.target.value))}
          />
        </FormField>
        <FormField label="Tanggal berakhir">
          <Input
            type="date"
            value={values.expiry}
            onChange={(event) => set("expiry", event.target.value)}
          />
        </FormField>
        <FormField label="Status">
          <Select
            value={values.status}
            onValueChange={(val) => set("status", val ?? "Aktif")}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="Aktif">Aktif</SelectItem>
              <SelectItem value="Renewed">Diperpanjang</SelectItem>
              <SelectItem value="Terminated">Dihentikan</SelectItem>
              <SelectItem value="Nonaktif">Nonaktif</SelectItem>
            </SelectContent>
          </Select>
        </FormField>
        {error && (
          <p className="asset-form__error type-meta text-[var(--status-danger)]" role="alert">
            {error}
          </p>
        )}
        <div className="asset-form__actions">
          <Button variant="outline" type="button" onClick={onClose}>Batal</Button>
          <Button type="submit" disabled={saving}>{saving ? "Menyimpan…" : "Simpan"}</Button>
        </div>
      </form>
    </Drawer>
  )
}

/** Setujui (dengan tanggal berakhir baru) atau tolak pengajuan perpanjangan. */
function DecideDrawer({
  request,
  decision,
  currentExpiry,
  onClose,
  onDecide,
}: {
  request: RenewalRequest
  decision: "APPROVED" | "REJECTED"
  currentExpiry: string | null
  onClose: () => void
  onDecide: (input: { note?: string; newExpiryDate?: string }) => Promise<string | null>
}) {
  const approve = decision === "APPROVED"
  const [newExpiry, setNewExpiry] = useState(currentExpiry ? plusYears(currentExpiry, 1) : "")
  const [note, setNote] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  return (
    <Drawer open title={approve ? `Setujui ${request.code}` : `Tolak ${request.code}`} onClose={onClose}>
      <form
        className="asset-form"
        onSubmit={async (event) => {
          event.preventDefault()
          if (approve && currentExpiry && newExpiry && newExpiry <= currentExpiry) {
            return setError("Tanggal berakhir baru harus setelah tanggal berakhir saat ini.")
          }
          setSaving(true)
          const nextError = await onDecide({
            note: note.trim() || undefined,
            newExpiryDate: approve && newExpiry ? newExpiry : undefined,
          })
          setSaving(false)
          if (nextError) return setError(nextError)
          onClose()
        }}
      >
        <p className="type-body text-muted-foreground">
          {request.itemName} · diajukan oleh {request.requestedBy}
          {request.note ? ` · "${request.note}"` : ""}
        </p>
        {approve && (
          <FormField label="Tanggal berakhir baru" hint={currentExpiry ? `Saat ini ${currentExpiry}` : undefined}>
            <Input type="date" value={newExpiry} onChange={(event) => setNewExpiry(event.target.value)} />
          </FormField>
        )}
        <FormField label="Catatan">
          <Textarea value={note} onChange={(event) => setNote(event.target.value)} />
        </FormField>
        {error && (
          <p className="asset-form__error type-meta text-[var(--status-danger)]" role="alert">
            {error}
          </p>
        )}
        <div className="asset-form__actions">
          <Button variant="outline" type="button" onClick={onClose}>Batal</Button>
          <Button type="submit" variant={approve ? "default" : "destructive"} disabled={saving}>
            {saving ? "Menyimpan…" : approve ? "Setujui" : "Tolak"}
          </Button>
        </div>
      </form>
    </Drawer>
  )
}

function toInput(values: FormValues, type: LifecycleItem["type"]): LifecycleInput {
  return {
    name: values.name.trim(),
    category: LIFECYCLE_CATEGORY_TO_BE[type],
    status: LIFECYCLE_STATUS_TO_BE[values.status],
    expiryDate: values.expiry,
    quantity: values.quantity,
    allocated: values.allocated,
    location: values.location.trim(),
    picName: values.picName.trim(),
    vendor: values.vendor.trim(),
  }
}

function RequestRow({
  request,
  canApprove,
  onDecide,
  showItem,
}: {
  request: RenewalRequest
  canApprove: boolean
  onDecide: (request: RenewalRequest, decision: "APPROVED" | "REJECTED") => void
  showItem: boolean
}) {
  return (
    <div>
      <div>
        <strong className="type-body">{showItem ? request.itemName : request.code}</strong>
        <span className="type-meta text-muted-foreground">
          {showItem ? `${request.code} · ` : ""}
          {request.requestedBy} · {request.createdAt}
          {request.decidedBy ? ` · diputuskan ${request.decidedBy}` : ""}
        </span>
      </div>
      <StatusBadge status={request.status} tone={requestTone(request.status)} />
      {request.status === "Menunggu" && canApprove && (
        <div className="request-list__actions">
          <Button variant="destructive-outline" size="sm" onClick={() => onDecide(request, "REJECTED")}>
            Tolak
          </Button>
          <Button variant="default" size="sm" onClick={() => onDecide(request, "APPROVED")}>
            Setujui
          </Button>
        </div>
      )}
    </div>
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
  const { read, actions, helpers } = useSynraStore()
  const { can } = useAccess()
  // Mengajukan: ADMIN, SUPERVISOR, OPERATOR. Kelola item dan memutuskan: ADMIN, SUPERVISOR.
  const canRequest = can("edit")
  const canManage = can("approve")
  const lifecycle = read("lifecycle")
  const requests = read("requests")
  const lifecycleType = typeMap[name]
  const items = useMemo(
    () => lifecycle.filter((item) => item.type === lifecycleType),
    [lifecycle, lifecycleType],
  )
  const [form, setForm] = useState<"create" | "edit" | null>(null)
  const [deciding, setDeciding] = useState<{ request: RenewalRequest; decision: "APPROVED" | "REJECTED" } | null>(null)
  const [toast, setToast] = useState("")
  const selected = lifecycle.find((item) => item.id === selectedId) ?? null

  const submitRequest = async (item: LifecycleItem) => {
    if (!canRequest) return
    try {
      await actions.requestRenewal(item.id)
      setToast("Pengajuan perpanjangan berhasil dibuat")
    } catch (e) {
      setToast(errorText(e, "Gagal membuat pengajuan"))
    }
  }

  const openDecide = (request: RenewalRequest, decision: "APPROVED" | "REJECTED") =>
    setDeciding({ request, decision })

  const columns: DataTableColumn<LifecycleItem>[] = [
    { key: "id", header: "ID", render: (item) => item.code },
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
    { key: "expiry", header: "Berakhir", render: (item) => item.expiry },
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

  const decideDrawer = deciding && (
    <DecideDrawer
      request={deciding.request}
      decision={deciding.decision}
      currentExpiry={lifecycle.find((item) => item.id === deciding.request.itemId)?.expiry ?? null}
      onClose={() => setDeciding(null)}
      onDecide={async (input) => {
        try {
          await actions.decideRenewal(deciding.request.id, deciding.decision, input)
          setToast(deciding.decision === "APPROVED" ? "Pengajuan disetujui" : "Pengajuan ditolak")
          return null
        } catch (e) {
          return errorText(e, "Gagal menyimpan keputusan")
        }
      }}
    />
  )

  const toastEl = (
    <Toast visible={Boolean(toast)} message={toast} onClose={() => setToast("")} />
  )

  if (selected) {
    const relatedRequests = requests.filter(
      (request) => request.itemId === selected.id,
    )
    const hasPending = relatedRequests.some((request) => request.status === "Menunggu")
    return (
      <div className="lifecycle-detail">
        <div className="asset-detail__header">
          <Button
            onClick={() => setForm("edit")}
            {...restrictedAction(canManage)}
          >
            <Pencil {...iconProps} />
            Ubah siklus hidup
          </Button>
        </div>
        <GlassCard className="lifecycle-detail__summary">
          <span className="type-label text-muted-foreground">{selected.code}</span>
          <h3 className="type-card-title">{selected.name}</h3>
          <dl className="asset-summary__meta">
            <div>
              <dt>Berakhir</dt>
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
            {selected.vendor && (
              <div>
                <dt>Vendor</dt>
                <dd>{selected.vendor}</dd>
              </div>
            )}
          </dl>
          <Button
            variant="outline"
            className="lifecycle-request-button"
            onClick={() => void submitRequest(selected)}
            {...restrictedAction(canRequest && !hasPending)}
          >
            {hasPending ? "Pengajuan sedang diproses" : "Ajukan Perpanjangan"}
          </Button>
        </GlassCard>

        <GlassCard className="lifecycle-requests">
          <div className="section-heading">
            <span className="type-label text-muted-foreground">PERSETUJUAN</span>
            <h3 className="type-card-title">Pengajuan Perpanjangan</h3>
          </div>
          {relatedRequests.length > 0 ? (
            <div className="request-list">
              {relatedRequests.map((request) => (
                <RequestRow
                  key={request.id}
                  request={request}
                  canApprove={canManage}
                  onDecide={openDecide}
                  showItem={false}
                />
              ))}
            </div>
          ) : (
            <p className="type-body text-muted-foreground">
              Belum ada pengajuan untuk item ini.
            </p>
          )}
        </GlassCard>

        {form === "edit" && (
          <LifecycleFormDrawer
            item={selected}
            title="Ubah siklus hidup"
            onClose={() => setForm(null)}
            onSave={async (values) => {
              try {
                await actions.updateLifecycle(selected.id, toInput(values, selected.type))
                setToast("Siklus hidup berhasil diperbarui")
                return null
              } catch (e) {
                return errorText(e, "Gagal menyimpan perubahan")
              }
            }}
          />
        )}
        {decideDrawer}
        {toastEl}
      </div>
    )
  }

  const pending = requests.filter(
    (request) =>
      request.status === "Menunggu" &&
      items.some((item) => item.id === request.itemId),
  )

  return (
    <div className="lifecycle-page">
      <GlassCard className="lifecycle-table">
        <div className="section-heading flex items-start justify-between gap-4">
          <div>
            <span className="type-label text-muted-foreground">LIFECYCLE</span>
            <h3 className="type-card-title">{lifecycleCardTitles[name]}</h3>
          </div>
          <Button onClick={() => setForm("create")} {...restrictedAction(canManage)}>
            <Plus {...iconProps} />
            Tambah
          </Button>
        </div>
        {items.length > 0 ? (
          <DataTable
            columns={columns}
            rows={items}
            rowKey={(item) => item.id}
            onRowClick={(item) => onSelectedIdChange(item.id)}
          />
        ) : (
          <p className="type-body text-muted-foreground">
            Belum ada data untuk kategori ini.
          </p>
        )}
      </GlassCard>

      {pending.length > 0 && (
        <GlassCard className="lifecycle-requests">
          <div className="section-heading">
            <span className="type-label text-muted-foreground">PERSETUJUAN</span>
            <h3 className="type-card-title">Pengajuan Menunggu Persetujuan</h3>
          </div>
          <div className="request-list">
            {pending.map((request) => (
              <RequestRow
                key={request.id}
                request={request}
                canApprove={canManage}
                onDecide={openDecide}
                showItem
              />
            ))}
          </div>
        </GlassCard>
      )}

      {form === "create" && (
        <LifecycleFormDrawer
          item={null}
          title={`Tambah ${lifecycleCardTitles[name].replace(/^Daftar /, "").toLowerCase()}`}
          onClose={() => setForm(null)}
          onSave={async (values) => {
            try {
              await actions.createLifecycle(toInput(values, lifecycleType))
              setToast("Item berhasil ditambahkan")
              return null
            } catch (e) {
              return errorText(e, "Gagal menambahkan item")
            }
          }}
        />
      )}
      {decideDrawer}
      {toastEl}
    </div>
  )
}
