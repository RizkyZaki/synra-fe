import { Plus } from "lucide-react"
import { useState } from "react"
import { restrictedAction, useAccess } from "../lib/useAccess"
import { useSynraStore } from "../lib/useSynraStore"
import { ApiError } from "../lib/api"
import { ROLE_OPTIONS, type BackendRole } from "../lib/backend"
import type { Rule, User } from "../lib/synraDomain"
import {
  DataTable,
  Drawer,
  FormField,
  GlassCard,
  StatusBadge,
  Toast,
  type DataTableColumn,
} from "./ui"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

type AdminTab = "Parameter EWS" | "Pengguna" | "Profil"

const iconProps = {
  size: 20,
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
        className="asset-form"
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
          <input value={fullName} onChange={(event) => setFullName(event.target.value)} required />
        </FormField>
        <FormField label="Username" hint="Huruf kecil, angka, titik, garis bawah, atau strip">
          <input
            value={username}
            onChange={(event) => setUsername(event.target.value)}
            autoCapitalize="none"
            required
          />
        </FormField>
        <FormField label="Kata sandi" hint="Minimal 8 karakter, mengandung huruf dan angka">
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            autoComplete="new-password"
            required
          />
        </FormField>
        <FormField label="Role">
          <Select
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
          <p className="asset-form__error small-copy" role="alert">
            {error}
          </p>
        )}
        <div className="asset-form__actions">
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
    setSaving(true)
    try {
      for (const rule of changed) await actions.updateRule(rule.id!, draft[rule.id!])
      setDraft({})
      setToast(`${changed.length} parameter berhasil disimpan`)
    } catch (e) {
      setToast(errorText(e, "Gagal menyimpan parameter"))
    } finally {
      setSaving(false)
    }
  }

  return (
    <>
      <GlassCard className="ews-parameters">
        <div className="section-heading">
          <span className="pretext">EARLY WARNING SYSTEM</span>
          <h3 className="title-h3">Threshold Alert ({rules.length} level)</h3>
          <p className="small-copy text-muted">
            Nilai level satu metrik harus naik sesuai urutan severity (Warning &lt; Medium &lt; High &lt; Critical).
          </p>
        </div>
        <div className="ews-grid">
          {rules.map((rule) => (
            <label key={rule.id ?? rule.name}>
              <span>
                <strong className="small-copy">{rule.name}</strong>
                <span className="label text-muted">{rule.unit}</span>
              </span>
              <input
                type="number"
                min="0"
                step="any"
                value={valueOf(rule)}
                disabled={!canConfig}
                onChange={(event) =>
                  setDraft((current) => ({ ...current, [rule.id!]: Number(event.target.value) }))
                }
              />
            </label>
          ))}
        </div>
        <div className="admin-save-row">
          <Button
            onClick={() => void save()}
            {...restrictedAction(canConfig && !saving)}
          >
            {saving ? "Menyimpan…" : "Simpan Parameter"}
          </Button>
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
    { key: "name", header: "Nama", render: (user) => <strong>{user.name}</strong> },
    { key: "email", header: "Username", render: (user) => user.email },
    { key: "role", header: "Role", render: (user) => user.backendRole ?? user.role },
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
          <span className="label text-muted">Pengguna aktif</span>
        ) : (
          <span style={{ display: "flex", gap: 12 }}>
            {user.isLocked && (
              <button
                className="text-action"
                onClick={(event) => {
                  event.stopPropagation()
                  void run(() => actions.unlockUser(user.id), "Kunci akun dibuka")
                }}
              >
                Buka kunci
              </button>
            )}
            <button
              className="text-action"
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
            </button>
          </span>
        ),
    },
  ]

  return (
    <>
      <GlassCard className="users-admin">
        <div className="admin-section-header">
          <div className="section-heading">
            <span className="pretext">AKSES</span>
            <h3 className="title-h3">Pengguna</h3>
          </div>
          <Button onClick={() => setDrawerOpen(true)}>
            <Plus {...iconProps} />
            Tambah Pengguna
          </Button>
        </div>
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
      <GlassCard className="profile-admin">
        <div className="section-heading">
          <span className="pretext">PROFIL</span>
          <h3 className="title-h3">{user.username}</h3>
        </div>
        <div className="profile-admin__form">
          <FormField label="Nama">
            <input value={name} onChange={(event) => setName(event.target.value)} />
          </FormField>
        </div>
        <div className="admin-save-row">
          <Button onClick={() => void saveName()}>
            Simpan Nama
          </Button>
        </div>
        <div className="profile-admin__form">
          <FormField label="Kata sandi lama">
            <input
              type="password"
              value={oldPassword}
              autoComplete="current-password"
              onChange={(event) => setOldPassword(event.target.value)}
            />
          </FormField>
          <FormField label="Kata sandi baru" hint="Minimal 8 karakter, mengandung huruf dan angka">
            <input
              type="password"
              value={newPassword}
              autoComplete="new-password"
              onChange={(event) => setNewPassword(event.target.value)}
            />
          </FormField>
        </div>
        <div className="admin-save-row">
          <Button onClick={() => void savePassword()}>
            Ganti Kata Sandi
          </Button>
        </div>
      </GlassCard>
      <Toast visible={Boolean(toast)} message={toast} onClose={() => setToast("")} />
    </>
  )
}

export default function AdministrationPage() {
  const [tab, setTab] = useState<AdminTab>("Parameter EWS")

  return (
    <div className="administration-page">
      <div className="admin-tabs" role="tablist" aria-label="Administrasi">
        {(["Parameter EWS", "Pengguna", "Profil"] as AdminTab[]).map((item) => (
          <button
            key={item}
            role="tab"
            aria-selected={tab === item}
            className={tab === item ? "admin-tabs__active" : ""}
            onClick={() => setTab(item)}
          >
            {item}
          </button>
        ))}
      </div>
      {tab === "Parameter EWS" && <EwsParameters />}
      {tab === "Pengguna" && <UsersAdministration />}
      {tab === "Profil" && <ProfileAdministration />}
    </div>
  )
}
