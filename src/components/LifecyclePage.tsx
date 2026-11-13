import { CalendarClock, Check, Pencil, Plus, RefreshCw, X } from "lucide-react"
import { motion } from "motion/react"
import { useMemo, useState } from "react"
import { cn } from "@/lib/utils"
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
  CardHeading,
  DataTable,
  Drawer,
  EmptyState,
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
  size: 16,
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
    return <SeverityBadge severity="Expired" />
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
        className="flex flex-col gap-4"
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
        <div className="grid grid-cols-2 gap-3">
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
        </div>
        <FormField label="Tanggal berakhir">
          <Input
            type="date"
            value={values.expiry}
            onChange={(event) => set("expiry", event.target.value)}
          />
        </FormField>
        <FormField label="Status">
          <Select items={{ Aktif: "Aktif", Renewed: "Diperpanjang", Terminated: "Dihentikan", Nonaktif: "Nonaktif" }}
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
          <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger" role="alert">
            {error}
          </p>
        )}
        <div className="sticky bottom-0 -mx-5 -mb-5 mt-2 flex justify-end gap-2 border-t border-border bg-popover px-5 py-4">
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
        className="flex flex-col gap-4"
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
        <p className="rounded-xl border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
          <strong className="font-medium text-foreground">{request.itemName}</strong> · diajukan oleh {request.requestedBy}
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
          <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger" role="alert">
            {error}
          </p>
        )}
        <div className="sticky bottom-0 -mx-5 -mb-5 mt-2 flex justify-end gap-2 border-t border-border bg-popover px-5 py-4">
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
    <div className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-muted/40 p-4 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <strong className="truncate text-sm font-medium">{showItem ? request.itemName : request.code}</strong>
          <StatusBadge status={request.status} tone={requestTone(request.status)} />
        </div>
        <p className="mt-1 text-xs text-muted-foreground">
          {showItem ? `${request.code} · ` : ""}
          {request.requestedBy} · {request.createdAt}
          {request.decidedBy ? ` · diputuskan ${request.decidedBy}` : ""}
        </p>
        {request.note && <p className="mt-1.5 text-xs italic text-muted-foreground">“{request.note}”</p>}
      </div>
      {request.status === "Menunggu" && canApprove && (
        <div className="flex shrink-0 gap-2">
          <Button variant="destructive-outline" size="sm" className="flex-1 sm:flex-none" onClick={() => onDecide(request, "REJECTED")}>
            <X size={14} /> Tolak
          </Button>
          <Button size="sm" className="flex-1 sm:flex-none" onClick={() => onDecide(request, "APPROVED")}>
            <Check size={14} /> Setujui
          </Button>
        </div>
      )}
    </div>
  )
}

/** Bar sisa masa berlaku, skala 365 hari. */
function ExpiryBar({ days }: { days: number }) {
  const { api } = useSynraStore()
  const t = api.expiryThresholds
  const pct = days <= 0 ? 100 : Math.max(4, Math.min(100, (days / 365) * 100))
  const tone = days < 0 ? "bg-danger" : days <= t.CRITICAL ? "bg-danger" : days <= t.HIGH ? "bg-high" : days <= t.MEDIUM ? "bg-warning" : "bg-success"
  return (
    <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
      <motion.div
        className={cn("h-full rounded-full", tone)}
        initial={{ width: 0 }}
        animate={{ width: `${pct}%` }}
        transition={{ duration: 0.8, ease: "easeOut" }}
      />
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
  const { read, actions, helpers, api } = useSynraStore()
  const limits = api.expiryThresholds
  const { can } = useAccess()
  // Mengajukan: ADMIN, SUPERVISOR, OPERATOR. Kelola item dan memutuskan: ADMIN, SUPERVISOR.
  const canRequest = can("edit")
  const canManage = can("approve")
  const lifecycle = read("lifecycle")
  const requests = read("requests")
  const lifecycleType = typeMap[name]
  const items = useMemo(() => lifecycle.filter((item) => item.type === lifecycleType), [lifecycle, lifecycleType])
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

  const openDecide = (request: RenewalRequest, decision: "APPROVED" | "REJECTED") => setDeciding({ request, decision })

  const columns: DataTableColumn<LifecycleItem>[] = [
    { key: "id", header: "ID", render: (item) => <span className="font-mono text-xs text-muted-foreground">{item.code}</span> },
    {
      key: "name",
      header: "Nama",
      render: (item) => (
        <span className="flex min-w-[160px] flex-col">
          <strong className="font-medium">{item.name}</strong>
          {item.vendor && <span className="text-xs text-muted-foreground">{item.vendor}</span>}
        </span>
      ),
    },
    { key: "location", header: "Lokasi", render: (item) => item.location },
    { key: "pic", header: "PIC", render: (item) => item.pic },
    {
      key: "quota",
      header: name === "Lisensi Software" ? "Kuota / Terpakai" : "Jumlah",
      render: (item) => (
        <span className="tabular-nums">{name === "Lisensi Software" ? `${item.quantity} / ${item.allocated}` : item.quantity}</span>
      ),
    },
    {
      key: "expiry",
      header: "Berakhir",
      render: (item) => {
        const days = helpers.daysUntil(item.expiry)
        return (
          <span className="flex w-[140px] flex-col gap-1.5">
            <span className="flex items-baseline justify-between gap-2 whitespace-nowrap">
              <span>{item.expiry}</span>
              <span className={cn("text-xs", days < 0 ? "text-danger" : days <= api.expiryThresholds.CRITICAL ? "text-danger" : "text-muted-foreground")}>
                {days < 0 ? `lewat ${Math.abs(days)}h` : `${days}h`}
              </span>
            </span>
            <ExpiryBar days={days} />
          </span>
        )
      },
    },
    { key: "severity", header: "Badge", render: (item) => <ExpiryStatus days={helpers.daysUntil(item.expiry)} /> },
    {
      key: "status",
      header: "Status",
      render: (item) => (
        <StatusBadge
          status={item.status}
          tone={item.status === "Terminated" ? "danger" : item.status === "Renewed" ? "success" : "neutral"}
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

  const toastEl = <Toast visible={Boolean(toast)} message={toast} onClose={() => setToast("")} />

  if (selected) {
    const relatedRequests = requests.filter((request) => request.itemId === selected.id)
    const hasPending = relatedRequests.some((request) => request.status === "Menunggu")
    const days = helpers.daysUntil(selected.expiry)
    const meta: [string, string][] = [
      ["Berakhir", selected.expiry],
      ["Sisa hari", days < 0 ? `Lewat ${Math.abs(days)} hari` : `${days} hari`],
      ["Kuota", `${selected.allocated} / ${selected.quantity}`],
      ["Lokasi", selected.location],
      ["PIC", selected.pic],
      ["Vendor", selected.vendor || "—"],
    ]
    return (
      <div className="flex min-w-0 flex-col gap-6">
        <GlassCard className="min-w-0 overflow-hidden p-0">
          <div className="flex flex-wrap items-start justify-between gap-4 p-5 md:p-6">
            <div className="min-w-0">
              <span className="font-mono text-xs text-muted-foreground">{selected.code}</span>
              <h2 className="mt-1 text-xl font-semibold tracking-tight md:text-2xl">{selected.name}</h2>
              <div className="mt-3 flex flex-wrap gap-2">
                <StatusBadge
                  status={selected.status}
                  tone={selected.status === "Terminated" ? "danger" : selected.status === "Renewed" ? "success" : "neutral"}
                />
                <ExpiryStatus days={days} />
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
              <Button variant="outline" onClick={() => setForm("edit")} {...restrictedAction(canManage)}>
                <Pencil {...iconProps} />
                Ubah
              </Button>
              <Button onClick={() => void submitRequest(selected)} {...restrictedAction(canRequest && !hasPending)}>
                <RefreshCw {...iconProps} />
                {hasPending ? "Pengajuan sedang diproses" : "Ajukan Perpanjangan"}
              </Button>
            </div>
          </div>
          <div className="px-5 pb-5 md:px-6">
            <ExpiryBar days={days} />
          </div>
          <dl className="grid grid-cols-2 gap-px border-t border-border bg-border sm:grid-cols-3 xl:grid-cols-6">
            {meta.map(([label, value]) => (
              <div key={label} className="min-w-0 bg-card p-4">
                <dt className="type-label text-muted-foreground">{label}</dt>
                <dd className="mt-1 truncate text-sm font-medium" title={value}>
                  {value}
                </dd>
              </div>
            ))}
          </dl>
        </GlassCard>

        <GlassCard className="flex min-w-0 flex-col gap-4 p-5 md:p-6">
          <CardHeading title="Pengajuan Perpanjangan" description={`${relatedRequests.length} pengajuan`} />
          {relatedRequests.length > 0 ? (
            <div className="flex flex-col gap-2">
              {relatedRequests.map((request) => (
                <RequestRow key={request.id} request={request} canApprove={canManage} onDecide={openDecide} showItem={false} />
              ))}
            </div>
          ) : (
            <p className="type-meta">Belum ada pengajuan untuk item ini.</p>
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
    (request) => request.status === "Menunggu" && items.some((item) => item.id === request.itemId),
  )
  const counts = items.reduce(
    (acc, item) => {
      const days = helpers.daysUntil(item.expiry)
      if (days < 0) acc.expired += 1
      else if (days <= limits.CRITICAL) acc.d30 += 1
      else if (days <= limits.HIGH) acc.d90 += 1
      else acc.safe += 1
      return acc
    },
    { expired: 0, d30: 0, d90: 0, safe: 0 },
  )

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Kedaluwarsa", counts.expired, "text-danger", "bg-danger"],
          [`≤ ${limits.CRITICAL} hari`, counts.d30, "text-high", "bg-high"],
          [`${limits.CRITICAL + 1}–${limits.HIGH} hari`, counts.d90, "text-warning", "bg-warning"],
          [`Aman (> ${limits.HIGH} hari)`, counts.safe, "text-success", "bg-success"],
        ].map(([label, value, tone, dot]) => (
          <GlassCard key={label as string} className="min-w-0 p-4">
            <p className="flex items-center gap-2 type-label text-muted-foreground">
              <span className={cn("size-1.5 rounded-full", dot as string)} aria-hidden="true" />
              {label}
            </p>
            <p className={cn("mt-1 text-2xl font-semibold tabular-nums", (value as number) > 0 ? (tone as string) : "")}>{value}</p>
          </GlassCard>
        ))}
      </div>

      {pending.length > 0 && (
        <GlassCard className="flex min-w-0 flex-col gap-4 border-warning/30 p-5 md:p-6">
          <CardHeading
            title="Pengajuan Menunggu Persetujuan"
            description={canManage ? "Setujui dengan tanggal berakhir baru atau tolak" : "Menunggu keputusan Supervisor/Administrator"}
          />
          <div className="flex flex-col gap-2">
            {pending.map((request) => (
              <RequestRow key={request.id} request={request} canApprove={canManage} onDecide={openDecide} showItem />
            ))}
          </div>
        </GlassCard>
      )}

      <GlassCard className="flex min-w-0 flex-col gap-4 p-4 md:p-5">
        <CardHeading
          title={lifecycleCardTitles[name]}
          description={`${items.length} item, urut dari yang paling cepat berakhir`}
          actions={
            <Button onClick={() => setForm("create")} {...restrictedAction(canManage)}>
              <Plus {...iconProps} />
              Tambah
            </Button>
          }
        />
        {items.length > 0 ? (
          <DataTable
            columns={columns}
            rows={items}
            rowKey={(item) => item.id}
            rowSeverity={(item) => (helpers.daysUntil(item.expiry) < 0 ? "Expired" : undefined)}
            onRowClick={(item) => onSelectedIdChange(item.id)}
          />
        ) : (
          <EmptyState title="Belum ada data" description="Belum ada item untuk kategori ini." icon={CalendarClock} />
        )}
      </GlassCard>

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
