import { CalendarClock, Lock, NotebookPen, Pencil, Plus, Save, Server, SlidersHorizontal, Trash2, UserRound, Users } from "lucide-react"
import { motion } from "motion/react"
import { useState } from "react"
import { restrictedAction, useAccess } from "../lib/useAccess"
import { useSynraStore } from "../lib/useSynraStore"
import { ApiError } from "../lib/api"
import { METRIC_LABEL, ROLE_OPTIONS, type BackendRole, type HostDto } from "../lib/backend"
import type { ExpiryThresholds, Rule, User } from "../lib/synraDomain"
import {
  CardHeading,
  ConfirmDialog,
  DataTable,
  Drawer,
  FormField,
  GlassCard,
  StatusBadge,
  Toast,
  type DataTableColumn,
} from "./ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import {
  AlertDialog,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

type AdminTab = "Parameter EWS" | "Host" | "Pengguna" | "Profil"

const iconProps = {
  size: 16,
  strokeWidth: 1.75,
  "aria-hidden": true,
} as const

const errorText = (e: unknown, fallback: string) =>
  e instanceof ApiError ? (e.errors.length ? e.errors.join(" ") : e.message) : fallback

function AddUserDrawer({
  onClose,
  onSaved,
}: {
  onClose: () => void
  onSaved: () => void
}) {
  const { actions } = useSynraStore()
  const [fullName, setFullName] = useState("")
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState<BackendRole>("OPERATOR")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  return (
    <Drawer open title="Tambah Pengguna" onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={async (event) => {
          event.preventDefault()
          setSaving(true)
          try {
            await actions.createUser({ username, fullName, password, role })
            onSaved()
            onClose()
          } catch (e) {
            setError(errorText(e, "Gagal menambah pengguna."))
          } finally {
            setSaving(false)
          }
        }}
      >
        <FormField label="Nama lengkap">
          <Input value={fullName} onChange={(event) => setFullName(event.target.value)} required />
        </FormField>
        <FormField label="Username" hint="Huruf kecil, angka, titik, garis bawah, atau strip">
          <Input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoCapitalize="none"
            required
          />
        </FormField>
        <FormField label="Kata sandi" hint="Minimal 8 karakter, mengandung huruf dan angka">
          <Input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            required
          />
        </FormField>
        <FormField label="Role">
          <Select items={Object.fromEntries(ROLE_OPTIONS.map((o) => [o.value, o.label]))}
            value={role}
            onValueChange={(value) => setRole((value ?? "OPERATOR") as BackendRole)}
          >
            <SelectTrigger className="w-full">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {ROLE_OPTIONS.map((item) => (
                <SelectItem key={item.value} value={item.value}>
                  {item.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </FormField>
        {error && (
          <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger" role="alert">
            {error}
          </p>
        )}
        <div className="sticky bottom-0 -mx-5 -mb-5 mt-2 flex justify-end gap-2 border-t border-border bg-popover px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Menyimpan…" : "Tambah Pengguna"}
          </Button>
        </div>
      </form>
    </Drawer>
  )
}

/** Sama dengan batas MaxLength di DTO threshold backend. */
const REC_MAX = 500

const SEVERITY_TONE: Record<string, string> = {
  LOW: "bg-warning/60",
  MEDIUM: "bg-warning",
  HIGH: "bg-high",
  CRITICAL: "bg-danger",
}

/** Modal untuk mengubah teks rekomendasi satu level threshold. Langsung tersimpan ke server. */
function RecommendationDialog({
  rule,
  canEdit,
  onClose,
  onSaved,
}: {
  rule: Rule | null
  canEdit: boolean
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const { actions } = useSynraStore()
  const [text, setText] = useState("")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  // Isi ulang form setiap kali modal dibuka untuk level lain.
  const [openedFor, setOpenedFor] = useState<string | undefined>()
  if (rule?.id !== openedFor) {
    setOpenedFor(rule?.id)
    setText(rule?.recommendation ?? "")
    setError("")
  }

  const unchanged = text.trim() === (rule?.recommendation ?? "").trim()

  const save = async () => {
    if (!rule?.id || !canEdit) return
    setSaving(true)
    setError("")
    try {
      await actions.updateRuleRecommendation(rule.id, text.trim())
      onSaved(text.trim() ? "Rekomendasi berhasil disimpan" : "Rekomendasi dikembalikan ke teks default")
      onClose()
    } catch (e) {
      setError(errorText(e, "Gagal menyimpan rekomendasi"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <AlertDialog
      open={rule !== null}
      onOpenChange={(isOpen) => {
        if (!isOpen && !saving) onClose()
      }}
    >
      <AlertDialogContent className="w-[calc(100%-2rem)] rounded-2xl border border-border bg-popover p-6 shadow-2xl data-[size=default]:max-w-lg data-[size=default]:sm:max-w-lg">
        <AlertDialogHeader className="text-left">
          <AlertDialogTitle className="type-card-title flex items-center gap-2">
            <span
              className={cn("h-4 w-1 shrink-0 rounded-full", SEVERITY_TONE[rule?.severity ?? ""] ?? "bg-muted-foreground/40")}
              aria-hidden="true"
            />
            Rekomendasi · {rule?.name}
          </AlertDialogTitle>
          <AlertDialogDescription className="type-body mt-1 text-muted-foreground">
            Ditampilkan di detail alert dan notifikasi saat level ini terlewati. Berlaku untuk alert yang dibuat setelah disimpan.
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="flex flex-col gap-1.5">
          <Textarea
            rows={6}
            maxLength={REC_MAX}
            value={text}
            disabled={!canEdit || saving}
            placeholder="Kosongkan untuk memakai rekomendasi default"
            aria-label={`Rekomendasi ${rule?.name ?? ""}`}
            onChange={(event) => setText(event.target.value)}
          />
          <p className="flex justify-between gap-3 text-xs text-muted-foreground">
            <span>Kosongkan lalu simpan untuk kembali ke teks default.</span>
            <span className="tabular-nums">
              {text.length}/{REC_MAX}
            </span>
          </p>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </div>
        <AlertDialogFooter className="mt-2 flex justify-end gap-3">
          <AlertDialogCancel disabled={saving} onClick={onClose}>
            {canEdit ? "Batal" : "Tutup"}
          </AlertDialogCancel>
          {canEdit && (
            <Button onClick={() => void save()} disabled={saving || unchanged}>
              <Save {...iconProps} />
              {saving ? "Menyimpan…" : "Simpan"}
            </Button>
          )}
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

/** Threshold dari backend: satu baris per level. Urutan level divalidasi server. */
function EwsParameters() {
  const { read, actions } = useSynraStore()
  const { can } = useAccess()
  const canConfig = can("config")
  const rules = read("rules")
  const [draft, setDraft] = useState<Record<string, number>>({})
  const [toast, setToast] = useState("")
  const [saving, setSaving] = useState(false)
  const [recRuleId, setRecRuleId] = useState<string | null>(null)
  const recRule = rules.find((rule) => rule.id === recRuleId) ?? null

  const valueOf = (rule: Rule) => draft[rule.id!] ?? rule.value

  const save = async () => {
    if (!canConfig) return
    const changed = rules.filter((rule) => rule.id && draft[rule.id] !== undefined && draft[rule.id] !== rule.value)
    if (changed.length === 0) {
      setToast("Tidak ada perubahan")
      return
    }
    if (changed.some((rule) => !Number.isFinite(draft[rule.id!]) || draft[rule.id!] < 0)) {
      setToast("Nilai parameter harus berupa angka nol atau lebih")
      return
    }
    // Simpan per metrik sekaligus (PUT), supaya menaikkan beberapa level bersamaan
    // tidak ditolak karena urutan sementara yang belum lengkap.
    const metrics = [...new Set(changed.map((rule) => rule.metric!))]
    setSaving(true)
    let saved = 0
    try {
      for (const metric of metrics) {
        const levels = rules
          .filter((rule) => rule.metric === metric)
          .map((rule) => ({
            severity: rule.severity!,
            operator: rule.operator,
            value: valueOf(rule),
            enabled: rule.enabled,
          }))
        await actions.saveThresholds(metric, levels)
        saved += changed.filter((rule) => rule.metric === metric).length
        setDraft((current) =>
          Object.fromEntries(
            Object.entries(current).filter(([id]) => !rules.some((rule) => rule.id === id && rule.metric === metric)),
          ),
        )
      }
      setToast(`${saved} parameter berhasil disimpan`)
    } catch (e) {
      const message = errorText(e, "Gagal menyimpan parameter")
      setToast(saved > 0 ? `${saved} parameter tersimpan, sisanya gagal: ${message}` : message)
    } finally {
      setSaving(false)
    }
  }

  const groups = rules.reduce<Record<string, Rule[]>>((acc, rule) => {
    const key = rule.metric ?? "Lainnya"
    ;(acc[key] ??= []).push(rule)
    return acc
  }, {})
  const dirty = rules.some((rule) => rule.id && draft[rule.id] !== undefined && draft[rule.id] !== rule.value)

  return (
    <>
      <GlassCard className="flex min-w-0 flex-col gap-5 p-5 md:p-6">
        <CardHeading
          title={`Threshold Alert (${rules.length} level)`}
          description="Nilai level satu metrik harus naik sesuai urutan severity (Warning < Medium < High < Critical). Klik ikon catatan di tiap level untuk mengatur rekomendasi yang tampil di alert."
          actions={
            <Button onClick={() => void save()} {...restrictedAction(canConfig && !saving)}>
              <Save {...iconProps} />
              {saving ? "Menyimpan…" : dirty ? "Simpan perubahan" : "Simpan Parameter"}
            </Button>
          }
        />
        {!canConfig && (
          <div role="note" className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/[0.06] p-3 text-sm text-warning">
            <Lock size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            Hanya akun Administrator yang dapat mengubah threshold. Anda masuk sebagai role lain, jadi nilai di bawah hanya bisa
            dilihat.
          </div>
        )}
        <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
          {Object.entries(groups).map(([metric, items]) => (
            <div key={metric} className="min-w-0 rounded-xl border border-border bg-muted/30 p-4">
              <p className="mb-3 flex items-center justify-between gap-2">
                <span className="text-sm font-semibold">{METRIC_LABEL[metric as keyof typeof METRIC_LABEL] ?? metric}</span>
                <span className="text-xs text-muted-foreground">{items[0]?.unit}</span>
              </p>
              <div className="flex flex-col gap-2.5">
                {items.map((rule) => {
                  const changed = rule.id !== undefined && draft[rule.id] !== undefined && draft[rule.id] !== rule.value
                  return (
                    <div key={rule.id ?? rule.name} className="flex items-center gap-3">
                      <span
                        className={cn("h-8 w-1 shrink-0 rounded-full", SEVERITY_TONE[rule.severity ?? ""] ?? "bg-muted-foreground/40")}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate text-[13px]" title={rule.name}>
                        {rule.name.split(" · ").slice(1).join(" · ") || rule.name}
                      </span>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon-sm"
                        className="shrink-0 text-muted-foreground hover:text-foreground"
                        title={rule.recommendation ? `Rekomendasi: ${rule.recommendation}` : "Atur rekomendasi"}
                        aria-label={`${canConfig ? "Ubah" : "Lihat"} rekomendasi ${rule.name}`}
                        disabled={!rule.id}
                        onClick={() => setRecRuleId(rule.id ?? null)}
                      >
                        <NotebookPen size={15} aria-hidden="true" />
                      </Button>
                      <Input
                        type="number"
                        min="0"
                        step="any"
                        value={valueOf(rule)}
                        disabled={!canConfig}
                        aria-label={rule.name}
                        className={cn("h-8 w-24 text-right tabular-nums", changed && "border-primary ring-2 ring-primary/20")}
                        onChange={(event) => setDraft((current) => ({ ...current, [rule.id!]: Number(event.target.value) }))}
                      />
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      </GlassCard>
      <RecommendationDialog rule={recRule} canEdit={canConfig} onClose={() => setRecRuleId(null)} onSaved={setToast} />
      <Toast visible={Boolean(toast)} message={toast} onClose={() => setToast("")} />
    </>
  )
}

function HostDrawer({
  host,
  onClose,
  onSaved,
}: {
  /** null = tambah Host baru */
  host: HostDto | null
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const { actions } = useSynraStore()
  const [code, setCode] = useState(host?.code ?? "")
  const [name, setName] = useState(host?.name ?? "")
  const [region, setRegion] = useState(host?.region ?? "")
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)

  return (
    <Drawer open title={host ? `Ubah Host ${host.code}` : "Tambah Host"} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={async (event) => {
          event.preventDefault()
          setSaving(true)
          setError("")
          const input = { code: code.trim().toUpperCase(), name: name.trim(), region: region.trim() || undefined }
          try {
            if (host) await actions.updateHost(host.id, input)
            else await actions.createHost(input)
            onSaved(host ? "Host berhasil diperbarui" : "Host berhasil ditambahkan")
            onClose()
          } catch (e) {
            setError(errorText(e, host ? "Gagal memperbarui Host." : "Gagal menambah Host."))
          } finally {
            setSaving(false)
          }
        }}
      >
        <FormField label="Kode" hint="2–20 karakter: huruf besar, angka, atau strip. Mis. BPD-JTG">
          <Input
            value={code}
            onChange={(event) => setCode(event.target.value.toUpperCase())}
            maxLength={20}
            autoCapitalize="characters"
            required
          />
        </FormField>
        <FormField label="Nama">
          <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={100} required />
        </FormField>
        <FormField label="Wilayah" hint="Opsional">
          <Input value={region} onChange={(event) => setRegion(event.target.value)} maxLength={100} />
        </FormField>
        {error && (
          <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger" role="alert">
            {error}
          </p>
        )}
        <div className="sticky bottom-0 -mx-5 -mb-5 mt-2 flex justify-end gap-2 border-t border-border bg-popover px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={saving}>
            {saving ? "Menyimpan…" : host ? "Simpan Perubahan" : "Tambah Host"}
          </Button>
        </div>
      </form>
    </Drawer>
  )
}

/** Daftar Host (bank/instansi) beserta jumlah aset. Kelola: ADMIN dan SUPERVISOR. */
function HostsAdministration() {
  const { api, actions } = useSynraStore()
  const { user } = useAccess()
  const canManage = user.backendRole === "ADMIN" || user.backendRole === "SUPERVISOR"
  const hosts = api.hosts
  /** undefined = drawer tertutup, null = tambah, HostDto = ubah */
  const [editing, setEditing] = useState<HostDto | null | undefined>(undefined)
  const [deleting, setDeleting] = useState<HostDto | null>(null)
  const [toast, setToast] = useState("")

  const remove = async (host: HostDto) => {
    setDeleting(null)
    try {
      await actions.deleteHost(host.id)
      setToast(`Host ${host.code} dihapus`)
    } catch (e) {
      setToast(errorText(e, "Gagal menghapus Host"))
    }
  }

  const columns: DataTableColumn<HostDto>[] = [
    { key: "code", header: "Kode", render: (host) => <span className="font-mono text-xs">{host.code}</span> },
    { key: "name", header: "Nama", render: (host) => <strong className="font-medium">{host.name}</strong> },
    { key: "region", header: "Wilayah", render: (host) => host.region || <span className="text-muted-foreground">–</span> },
    { key: "assets", header: "Aset", render: (host) => <span className="tabular-nums">{host.assetCount}</span> },
  ]
  if (canManage) {
    columns.push({
      key: "action",
      header: "Aksi",
      render: (host) => (
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => setEditing(host)}>
            <Pencil size={14} aria-hidden="true" />
            Ubah
          </Button>
          <Button
            variant="outline"
            size="sm"
            disabled={host.assetCount > 0}
            title={host.assetCount > 0 ? "Pindahkan atau hapus aset Host ini terlebih dahulu" : undefined}
            className="text-danger hover:text-danger"
            onClick={() => setDeleting(host)}
          >
            <Trash2 size={14} aria-hidden="true" />
            Hapus
          </Button>
        </div>
      ),
    })
  }

  return (
    <>
      <GlassCard className="flex min-w-0 flex-col gap-4 p-5 md:p-6">
        <CardHeading
          title="Host"
          description={`${hosts.length} Host terdaftar. Host yang masih memiliki aset tidak dapat dihapus.`}
          actions={
            <Button onClick={() => setEditing(null)} {...restrictedAction(canManage)}>
              <Plus {...iconProps} />
              Tambah Host
            </Button>
          }
        />
        {!canManage && (
          <div role="note" className="flex items-start gap-2 rounded-xl border border-warning/30 bg-warning/[0.06] p-3 text-sm text-warning">
            <Lock size={15} className="mt-0.5 shrink-0" aria-hidden="true" />
            Hanya Administrator dan Supervisor yang dapat menambah, mengubah, atau menghapus Host.
          </div>
        )}
        <DataTable columns={columns} rows={hosts} rowKey={(host) => host.id} />
      </GlassCard>
      {editing !== undefined && <HostDrawer host={editing} onClose={() => setEditing(undefined)} onSaved={setToast} />}
      <ConfirmDialog
        open={deleting !== null}
        title={`Hapus Host ${deleting?.code ?? ""}?`}
        description={`Host "${deleting?.name ?? ""}" akan dihapus permanen. Tindakan ini tercatat di audit log.`}
        confirmLabel="Hapus"
        onConfirm={() => {
          if (deleting) void remove(deleting)
        }}
        onClose={() => setDeleting(null)}
      />
      <Toast visible={Boolean(toast)} message={toast} onClose={() => setToast("")} />
    </>
  )
}

const EXPIRY_LEVEL_ROWS: { key: keyof ExpiryThresholds; label: string; tone: string }[] = [
  { key: "CRITICAL", label: "Critical", tone: "bg-danger" },
  { key: "HIGH", label: "High", tone: "bg-high" },
  { key: "MEDIUM", label: "Medium", tone: "bg-warning" },
  { key: "LOW", label: "Low", tone: "bg-warning/60" },
]

/** Batas sisa hari untuk badge urgensi Siklus Hidup (lisensi, sertifikat, OS, garansi, kontrak). */
function ExpiryThresholdSettings() {
  const { api, actions } = useSynraStore()
  const { can } = useAccess()
  const canConfig = can("config")
  const current = api.expiryThresholds
  const [draft, setDraft] = useState<Partial<ExpiryThresholds>>({})
  const [toast, setToast] = useState("")
  const [saving, setSaving] = useState(false)

  const values: ExpiryThresholds = { ...current, ...draft }
  const dirty = EXPIRY_LEVEL_ROWS.some(({ key }) => values[key] !== current[key])

  const save = async () => {
    if (!canConfig) return
    if (!dirty) {
      setToast("Tidak ada perubahan")
      return
    }
    if (EXPIRY_LEVEL_ROWS.some(({ key }) => !Number.isInteger(values[key]) || values[key] < 0)) {
      setToast("Batas hari harus bilangan bulat nol atau lebih")
      return
    }
    setSaving(true)
    try {
      await actions.saveExpiryThresholds(values)
      setDraft({})
      setToast("Batas masa berlaku berhasil disimpan")
    } catch (e) {
      setToast(errorText(e, "Gagal menyimpan batas masa berlaku"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <GlassCard className="flex min-w-0 flex-col gap-5 p-5 md:p-6">
        <CardHeading
          title="Batas Masa Berlaku"
          description="Sisa hari sebelum berakhir yang menentukan badge item Siklus Hidup. Harus naik berurutan: Critical < High < Medium < Low."
          actions={
            <Button onClick={() => void save()} {...restrictedAction(canConfig && !saving)}>
              <Save {...iconProps} />
              {saving ? "Menyimpan…" : dirty ? "Simpan perubahan" : "Simpan Batas"}
            </Button>
          }
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-4">
          {EXPIRY_LEVEL_ROWS.map(({ key, label, tone }) => {
            const changed = values[key] !== current[key]
            return (
              <label key={key} className="flex items-center gap-3 rounded-xl border border-border bg-muted/30 p-3">
                <span className={cn("h-8 w-1 shrink-0 rounded-full", tone)} aria-hidden="true" />
                <span className="min-w-0 flex-1 text-[13px]">
                  {label}
                  <span className="block text-xs text-muted-foreground">sisa ≤ hari</span>
                </span>
                <Input
                  type="number"
                  min="0"
                  max="3650"
                  step="1"
                  value={values[key]}
                  disabled={!canConfig}
                  aria-label={`Batas hari ${label}`}
                  className={cn("h-8 w-20 text-right tabular-nums", changed && "border-primary ring-2 ring-primary/20")}
                  onChange={(event) => setDraft((d) => ({ ...d, [key]: Number(event.target.value) }))}
                />
              </label>
            )
          })}
        </div>
        <p className="flex items-center gap-2 text-xs text-muted-foreground">
          <CalendarClock size={14} aria-hidden="true" />
          Item yang sudah lewat tanggal berakhir selalu Expired; sisa lebih dari batas Low ditandai Info.
        </p>
      </GlassCard>
      <Toast visible={Boolean(toast)} message={toast} onClose={() => setToast("")} />
    </>
  )
}

function UsersAdministration() {
  const { read, actions } = useSynraStore()
  const { user: me } = useAccess()
  const users = read("users")
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [toast, setToast] = useState("")

  const run = async (fn: () => Promise<void>, success: string) => {
    try {
      await fn()
      setToast(success)
    } catch (e) {
      setToast(errorText(e, "Gagal memperbarui pengguna"))
    }
  }

  const columns: DataTableColumn<User>[] = [
    {
      key: "name",
      header: "Nama",
      render: (user) => (
        <span className="flex items-center gap-2.5 whitespace-nowrap">
          <span className="grid size-7 shrink-0 place-items-center rounded-lg bg-muted text-[11px] font-semibold">
            {user.name.split(" ").map((part) => part[0]).slice(0, 2).join("").toUpperCase()}
          </span>
          <strong className="font-medium">{user.name}</strong>
        </span>
      ),
    },
    { key: "email", header: "Username", render: (user) => user.email },
    { key: "role", header: "Role", render: (user) => <span className="inline-flex rounded-md border border-border bg-muted px-2 py-0.5 text-xs">{user.backendRole ?? user.role}</span> },
    {
      key: "status",
      header: "Status",
      render: (user) => (
        <StatusBadge
          status={user.isLocked ? "Terkunci" : user.status}
          tone={user.status === "Aktif" && !user.isLocked ? "success" : "danger"}
        />
      ),
    },
    {
      key: "action",
      header: "Aksi",
      render: (user) =>
        user.id === me.id ? (
          <span className="type-meta text-muted-foreground">Pengguna aktif</span>
        ) : (
          <div className="flex items-center gap-2">
            {user.isLocked && (
              <Button
                variant="outline"
                size="sm"
                onClick={(event) => {
                  event.stopPropagation()
                  void run(() => actions.unlockUser(user.id), "Kunci akun dibuka")
                }}
              >
                Buka kunci
              </Button>
            )}
            <Button
              variant="outline"
              size="sm"
              onClick={(event) => {
                event.stopPropagation()
                const activate = user.status === "Nonaktif"
                void run(
                  () => actions.updateUser(user.id, { isActive: activate }),
                  activate ? "Pengguna diaktifkan" : "Pengguna dinonaktifkan",
                )
              }}
            >
              {user.status === "Nonaktif" ? "Aktifkan" : "Nonaktifkan"}
            </Button>
          </div>
        ),
    },
  ]

  return (
    <>
      <GlassCard className="flex min-w-0 flex-col gap-4 p-5 md:p-6">
        <CardHeading
          title="Pengguna"
          description={`${users.length} akun terdaftar`}
          actions={
            <Button onClick={() => setDrawerOpen(true)}>
              <Plus {...iconProps} />
              Tambah Pengguna
            </Button>
          }
        />
        <DataTable columns={columns} rows={users} rowKey={(user) => user.id} />
      </GlassCard>
      {drawerOpen && (
        <AddUserDrawer onClose={() => setDrawerOpen(false)} onSaved={() => setToast("Pengguna berhasil ditambahkan")} />
      )}
      <Toast visible={Boolean(toast)} message={toast} onClose={() => setToast("")} />
    </>
  )
}

function ProfileAdministration() {
  const { actions } = useSynraStore()
  const { user } = useAccess()
  const [name, setName] = useState(user.name)
  const [oldPassword, setOldPassword] = useState("")
  const [newPassword, setNewPassword] = useState("")
  const [toast, setToast] = useState("")

  const saveName = async () => {
    if (!name.trim()) {
      setToast("Nama wajib diisi")
      return
    }
    try {
      await actions.updateUser(user.id, { fullName: name.trim() })
      setToast("Nama berhasil diperbarui")
    } catch (e) {
      setToast(errorText(e, "Gagal memperbarui profil"))
    }
  }

  const savePassword = async () => {
    try {
      await actions.changePassword(oldPassword, newPassword)
      setOldPassword("")
      setNewPassword("")
      setToast("Kata sandi berhasil diganti")
    } catch (e) {
      setToast(errorText(e, "Gagal mengganti kata sandi"))
    }
  }

  return (
    <>
      <div className="grid min-w-0 gap-6 lg:grid-cols-2">
        <GlassCard className="flex min-w-0 flex-col gap-5 p-5 md:p-6">
          <CardHeading title="Profil" description={`@${user.username} · ${user.role}`} />
          <FormField label="Nama">
            <Input value={name} onChange={(event) => setName(event.target.value)} />
          </FormField>
          <Button className="self-start" onClick={() => void saveName()}>
            <Save {...iconProps} />
            Simpan Nama
          </Button>
        </GlassCard>

        <GlassCard className="flex min-w-0 flex-col gap-5 p-5 md:p-6">
          <CardHeading title="Kata Sandi" description="Ganti kata sandi akun ini" />
          <FormField label="Kata sandi lama">
            <Input
              type="password"
              value={oldPassword}
              autoComplete="current-password"
              onChange={(event) => setOldPassword(event.target.value)}
            />
          </FormField>
          <FormField label="Kata sandi baru" hint="Minimal 8 karakter, mengandung huruf dan angka">
            <Input
              type="password"
              value={newPassword}
              autoComplete="new-password"
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </FormField>
          <Button className="self-start" onClick={() => void savePassword()}>
            Ganti Kata Sandi
          </Button>
        </GlassCard>
      </div>
      <Toast visible={Boolean(toast)} message={toast} onClose={() => setToast("")} />
    </>
  )
}

const adminTabs: { id: AdminTab; icon: typeof SlidersHorizontal }[] = [
  { id: "Parameter EWS", icon: SlidersHorizontal },
  { id: "Host", icon: Server },
  { id: "Pengguna", icon: Users },
  { id: "Profil", icon: UserRound },
]

export default function AdministrationPage() {
  const [tab, setTab] = useState<AdminTab>("Parameter EWS")

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div role="tablist" aria-label="Administrasi" className="flex w-full overflow-x-auto rounded-xl border border-border bg-muted/50 p-1 sm:w-fit">
        {adminTabs.map(({ id, icon: Icon }) => (
          <button
            key={id}
            role="tab"
            type="button"
            aria-selected={tab === id}
            onClick={() => setTab(id)}
            className={cn(
              "relative flex h-9 flex-1 items-center justify-center gap-2 whitespace-nowrap rounded-lg px-4 text-sm font-medium outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring sm:flex-none",
              tab === id ? "text-foreground" : "text-muted-foreground hover:text-foreground",
            )}
          >
            {tab === id && (
              <motion.span
                layoutId="admin-tab"
                className="absolute inset-0 rounded-lg border border-border bg-card shadow-sm"
                transition={{ type: "spring", stiffness: 500, damping: 38 }}
              />
            )}
            <Icon size={15} className="relative" aria-hidden="true" />
            <span className="relative">{id}</span>
          </button>
        ))}
      </div>
      {tab === "Parameter EWS" && (
        <>
          <EwsParameters />
          <ExpiryThresholdSettings />
        </>
      )}
      {tab === "Host" && <HostsAdministration />}
      {tab === "Pengguna" && <UsersAdministration />}
      {tab === "Profil" && <ProfileAdministration />}
    </div>
  )
}
