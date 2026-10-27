import { Plus } from "lucide-react"
import { useState } from "react"
import { createAuditEntry } from "../lib/audit"
import { restrictedAction, useAccess } from "../lib/useAccess"
import { useSynraStore } from "../lib/useSynraStore"
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

type AdminTab = "Parameter EWS" | "Pengguna" | "Profil"

const iconProps = {
  size: 20,
  strokeWidth: 1.75,
  "aria-hidden": true,
} as const

function AddUserDrawer({
  users,
  roles,
  onClose,
  onSave,
}: {
  users: User[]
  roles: readonly string[]
  onClose: () => void
  onSave: (user: User) => void
}) {
  const [name, setName] = useState("")
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [role, setRole] = useState(roles[0] ?? "Administrator")
  const [error, setError] = useState("")

  return (
    <Drawer open title="Tambah Pengguna" onClose={onClose}>
      <form
        className="asset-form"
        onSubmit={(event) => {
          event.preventDefault()
          if (!name.trim() || !email.trim() || !password) {
            setError("Semua field wajib diisi.")
            return
          }
          if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
            setError("Format email tidak valid.")
            return
          }
          if (
            users.some(
              (user) => user.email.toLowerCase() === email.toLowerCase(),
            )
          ) {
            setError("Email sudah digunakan.")
            return
          }
          const nextNumber =
            Math.max(
              0,
              ...users.map(
                (user) => Number(user.id.replace(/\D/g, "")) || 0,
              ),
            ) + 1
          onSave({
            id: `USR-${String(nextNumber).padStart(3, "0")}`,
            name: name.trim(),
            email: email.trim().toLowerCase(),
            password,
            role,
            status: "Aktif",
          })
          onClose()
        }}
      >
        <FormField label="Nama">
          <input
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </FormField>
        <FormField label="Email">
          <input
            type="email"
            value={email}
            onChange={(event) => setEmail(event.target.value)}
          />
        </FormField>
        <FormField label="Kata sandi">
          <input
            type="password"
            value={password}
            onChange={(event) => setPassword(event.target.value)}
          />
        </FormField>
        <FormField label="Role">
          <select
            value={role}
            onChange={(event) => setRole(event.target.value)}
          >
            {roles.map((item) => (
              <option key={item}>{item}</option>
            ))}
          </select>
        </FormField>
        {error && (
          <p className="asset-form__error small-copy" role="alert">
            {error}
          </p>
        )}
        <div className="asset-form__actions">
          <button
            type="button"
            className="button button--secondary"
            onClick={onClose}
          >
            Batal
          </button>
          <button type="submit" className="button button--primary">
            Tambah Pengguna
          </button>
        </div>
      </form>
    </Drawer>
  )
}

function EwsParameters() {
  const { read, update, add } = useSynraStore()
  const { can } = useAccess()
  const canConfig = can("config")
  const rules = read("rules")
  const admin = read("users").find(
    (user) => user.role === "Administrator" && user.status === "Aktif",
  )!
  const [draft, setDraft] = useState<Record<string, number>>(
    Object.fromEntries(rules.map((rule) => [rule.name, rule.value])),
  )
  const [toast, setToast] = useState("")

  const save = () => {
    if (!canConfig) return

    const invalid = rules.some(
      (rule) =>
        !Number.isFinite(draft[rule.name]) || draft[rule.name] < 0,
    )
    if (invalid) {
      setToast("Nilai parameter harus berupa angka nol atau lebih")
      return
    }
    rules.forEach((rule) =>
      update(
        "rules",
        (item) => item.name === rule.name,
        { value: draft[rule.name] },
      ),
    )
    add(
      "audit",
      createAuditEntry(
        read("audit"),
        admin,
        "Parameter EWS diperbarui",
        "EWS",
        `${rules.length} aturan disimpan`,
      ),
    )
    setToast("Parameter EWS berhasil disimpan")
  }

  return (
    <>
      <GlassCard className="ews-parameters">
        <div className="section-heading">
          <span className="pretext">EARLY WARNING SYSTEM</span>
          <h3 className="title-h3">12 Parameter EWS</h3>
        </div>
        <div className="ews-grid">
          {rules.map((rule: Rule) => (
            <label key={rule.name}>
              <span>
                <strong className="small-copy">{rule.name}</strong>
                <span className="label text-muted">{rule.unit}</span>
              </span>
              <input
                type="number"
                min="0"
                value={draft[rule.name]}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    [rule.name]: Number(event.target.value),
                  }))
                }
              />
            </label>
          ))}
        </div>
        <div className="admin-save-row">
          <button
            className="button button--primary"
            onClick={save}
            {...restrictedAction(canConfig)}
          >
            Simpan Parameter
          </button>
        </div>
      </GlassCard>
      <Toast
        visible={Boolean(toast)}
        message={toast}
        onClose={() => setToast("")}
      />
    </>
  )
}

function UsersAdministration() {
  const { read, add, update, helpers } = useSynraStore()
  const users = read("users")
  const admin = users.find(
    (user) => user.role === "Administrator" && user.status === "Aktif",
  )!
  const [drawerOpen, setDrawerOpen] = useState(false)
  const [toast, setToast] = useState("")

  const columns: DataTableColumn<User>[] = [
    { key: "id", header: "ID", render: (user) => user.id },
    {
      key: "name",
      header: "Nama",
      render: (user) => <strong>{user.name}</strong>,
    },
    { key: "email", header: "Email", render: (user) => user.email },
    { key: "role", header: "Role", render: (user) => user.role },
    {
      key: "status",
      header: "Status",
      render: (user) => (
        <StatusBadge
          status={user.status}
          tone={user.status === "Aktif" ? "success" : "danger"}
        />
      ),
    },
    {
      key: "action",
      header: "Aksi",
      render: (user) =>
        user.id === admin.id ? (
          <span className="label text-muted">Pengguna aktif</span>
        ) : (
          <button
            className="text-action"
            disabled={user.status === "Nonaktif"}
            onClick={(event) => {
              event.stopPropagation()
              update(
                "users",
                (item) => item.id === user.id,
                { status: "Nonaktif" },
              )
              add(
                "audit",
                createAuditEntry(
                  read("audit"),
                  admin,
                  "Pengguna dinonaktifkan",
                  user.id,
                  user.email,
                ),
              )
              setToast("Pengguna berhasil dinonaktifkan")
            }}
          >
            {user.status === "Nonaktif" ? "Nonaktif" : "Nonaktifkan"}
          </button>
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
          <button
            className="button button--primary"
            onClick={() => setDrawerOpen(true)}
          >
            <Plus {...iconProps} />
            Tambah Pengguna
          </button>
        </div>
        <DataTable
          columns={columns}
          rows={users}
          rowKey={(user) => user.id}
        />
      </GlassCard>
      {drawerOpen && (
        <AddUserDrawer
          users={users}
          roles={helpers.roles}
          onClose={() => setDrawerOpen(false)}
          onSave={(user) => {
            add("users", user)
            add(
              "audit",
              createAuditEntry(
                read("audit"),
                admin,
                "Pengguna ditambahkan",
                user.id,
                `${user.email} · ${user.role}`,
              ),
            )
            setToast("Pengguna berhasil ditambahkan")
          }}
        />
      )}
      <Toast
        visible={Boolean(toast)}
        message={toast}
        onClose={() => setToast("")}
      />
    </>
  )
}

function ProfileAdministration() {
  const { read, update, add } = useSynraStore()
  const admin = read("users").find(
    (user) => user.role === "Administrator" && user.status === "Aktif",
  )!
  const [name, setName] = useState(admin.name)
  const [email, setEmail] = useState(admin.email)
  const [password, setPassword] = useState(admin.password)
  const [toast, setToast] = useState("")

  const save = () => {
    if (!name.trim() || !email.trim() || !password) {
      setToast("Nama, email, dan kata sandi wajib diisi")
      return
    }
    if (
      read("users").some(
        (user) =>
          user.id !== admin.id &&
          user.email.toLowerCase() === email.toLowerCase(),
      )
    ) {
      setToast("Email sudah digunakan")
      return
    }
    update(
      "users",
      (user) => user.id === admin.id,
      {
        name: name.trim(),
        email: email.trim().toLowerCase(),
        password,
      },
    )
    add(
      "audit",
      createAuditEntry(
        read("audit"),
        admin,
        "Profil diperbarui",
        admin.id,
        email.trim().toLowerCase(),
      ),
    )
    setToast("Profil berhasil diperbarui")
  }

  return (
    <>
      <GlassCard className="profile-admin">
        <div className="section-heading">
          <span className="pretext">ADMINISTRATOR</span>
          <h3 className="title-h3">Profil</h3>
        </div>
        <div className="profile-admin__form">
          <FormField label="Nama">
            <input
              value={name}
              onChange={(event) => setName(event.target.value)}
            />
          </FormField>
          <FormField label="Email">
            <input
              type="email"
              value={email}
              onChange={(event) => setEmail(event.target.value)}
            />
          </FormField>
          <FormField label="Kata sandi">
            <input
              type="password"
              value={password}
              onChange={(event) => setPassword(event.target.value)}
            />
          </FormField>
        </div>
        <div className="admin-save-row">
          <button className="button button--primary" onClick={save}>
            Simpan Profil
          </button>
        </div>
      </GlassCard>
      <Toast
        visible={Boolean(toast)}
        message={toast}
        onClose={() => setToast("")}
      />
    </>
  )
}

export default function AdministrationPage() {
  const [tab, setTab] = useState<AdminTab>("Parameter EWS")

  return (
    <div className="administration-page">
      <div className="admin-tabs" role="tablist" aria-label="Administrasi">
        {(["Parameter EWS", "Pengguna", "Profil"] as AdminTab[]).map(
          (item) => (
            <button
              key={item}
              role="tab"
              aria-selected={tab === item}
              className={tab === item ? "admin-tabs__active" : ""}
              onClick={() => setTab(item)}
            >
              {item}
            </button>
          ),
        )}
      </div>
      {tab === "Parameter EWS" && <EwsParameters />}
      {tab === "Pengguna" && <UsersAdministration />}
      {tab === "Profil" && <ProfileAdministration />}
    </div>
  )
}
