import { Lock, Plus, Save, SlidersHorizontal, UserRound, Users } from "lucide-react"
import { motion } from "motion/react"
import { useState } from "react"
import { restrictedAction, useAccess } from "../lib/useAccess"
import { useSynraStore } from "../lib/useSynraStore"
import { ApiError } from "../lib/api"
import { METRIC_LABEL, ROLE_OPTIONS, type BackendRole } from "../lib/backend"
import type { Rule, User } from "../lib/synraDomain"
import {
  CardHeading,
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { cn } from "@/lib/utils"

type AdminTab = "Parameter EWS" | "Pengguna" | "Profil"

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

/** Threshold dari backend: satu baris per level. Urutan level divalidasi server. */
function EwsParameters() {
  const { read, actions } = useSynraStore()
  const { can } = useAccess()
  const canConfig = can("config")
  const rules = read("rules")
  const [draft, setDraft] = useState<Record<string, number>>({})
  const [toast, setToast] = useState("")
  const [saving, setSaving] = useState(false)

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
  const severityTone: Record<string, string> = {
    LOW: "bg-warning/60",
    MEDIUM: "bg-warning",
    HIGH: "bg-high",
    CRITICAL: "bg-danger",
  }

  return (
    <>
      <GlassCard className="flex min-w-0 flex-col gap-5 p-5 md:p-6">
        <CardHeading
          title={`Threshold Alert (${rules.length} level)`}
          description="Nilai level satu metrik harus naik sesuai urutan severity (Warning < Medium < High < Critical)."
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
                    <label key={rule.id ?? rule.name} className="flex items-center gap-3">
                      <span
                        className={cn("h-8 w-1 shrink-0 rounded-full", severityTone[rule.severity ?? ""] ?? "bg-muted-foreground/40")}
                        aria-hidden="true"
                      />
                      <span className="min-w-0 flex-1 truncate text-[13px]" title={rule.name}>
                        {rule.name.split(" · ").slice(1).join(" · ") || rule.name}
                      </span>
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
                    </label>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
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
      {tab === "Parameter EWS" && <EwsParameters />}
      {tab === "Pengguna" && <UsersAdministration />}
      {tab === "Profil" && <ProfileAdministration />}
    </div>
  )
}
