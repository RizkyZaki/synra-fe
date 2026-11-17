import { Lock, Pencil, Plus, ShieldCheck, Trash2, Users } from "lucide-react"
import { useState } from "react"
import { useAccess } from "../lib/useAccess"
import { useSynraStore } from "../lib/useSynraStore"
import { ApiError } from "../lib/api"
import type { RoleDto } from "../lib/backend"
import type { Permission, PermissionGroup } from "../lib/permissions"
import { CardHeading, ConfirmDialog, Drawer, EmptyState, FormField, GlassCard, Toast } from "./ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { cn } from "@/lib/utils"

const errorText = (e: unknown, fallback: string) =>
  e instanceof ApiError ? (e.errors.length ? e.errors.join(" ") : e.message) : fallback

/**
 * Hak tindakan yang tidak berguna tanpa menunya. Mencentang tindakan otomatis mencentang menunya,
 * supaya admin tidak membuat role yang punya tombol tapi tidak bisa membuka halamannya.
 */
const REQUIRES_MENU: Partial<Record<Permission, Permission>> = {
  "alerts.handle": "alerts.view",
  "alerts.review": "alerts.view",
  "alerts.evaluate": "alerts.view",
  "escalation.manage": "notifications.view",
  "notifications.test": "notifications.view",
  "ingestion.manage": "monitoring.view",
  "security.view": "backup.view",
  "assets.manage": "assets.view",
  "assets.supervise": "assets.view",
  "lifecycle.request": "lifecycle.view",
  "lifecycle.manage": "lifecycle.view",
  "lifecycle.delete": "lifecycle.view",
}

function PermissionChecklist({
  catalog,
  selected,
  disabled,
  canGrant,
  onChange,
}: {
  catalog: PermissionGroup[]
  selected: Set<string>
  /** Semua centang terkunci (role ADMIN) */
  disabled: boolean
  /** Hak yang boleh dicentang oleh user yang login */
  canGrant: (key: Permission) => boolean
  onChange: (next: Set<string>) => void
}) {
  const toggle = (key: Permission, checked: boolean) => {
    const next = new Set(selected)
    if (checked) {
      next.add(key)
      const menu = REQUIRES_MENU[key]
      if (menu && canGrant(menu)) next.add(menu)
    } else {
      next.delete(key)
    }
    onChange(next)
  }

  const toggleGroup = (group: PermissionGroup, checked: boolean) => {
    const next = new Set(selected)
    for (const { key } of group.items) {
      if (!canGrant(key)) continue
      if (checked) {
        next.add(key)
        const menu = REQUIRES_MENU[key]
        if (menu && canGrant(menu)) next.add(menu)
      } else {
        next.delete(key)
      }
    }
    onChange(next)
  }

  return (
    <div className="flex flex-col gap-4">
      {catalog.map((group) => {
        const grantable = group.items.filter((item) => canGrant(item.key))
        const allOn = grantable.length > 0 && grantable.every((item) => selected.has(item.key))
        const someOn = group.items.some((item) => selected.has(item.key))
        return (
          <fieldset key={group.group} className="min-w-0 rounded-xl border border-border bg-muted/30">
            <legend className="sr-only">{group.group}</legend>
            <div className="flex items-center justify-between gap-3 border-b border-border px-3.5 py-2.5">
              <span className="text-[13px] font-semibold">{group.group}</span>
              <label className="flex cursor-pointer items-center gap-2 text-xs text-muted-foreground has-[:disabled]:cursor-not-allowed">
                <input
                  type="checkbox"
                  className="size-3.5 accent-primary"
                  checked={allOn}
                  ref={(el) => {
                    if (el) el.indeterminate = someOn && !allOn
                  }}
                  disabled={disabled || grantable.length === 0}
                  onChange={(event) => toggleGroup(group, event.target.checked)}
                />
                Pilih semua
              </label>
            </div>
            <div className="flex flex-col">
              {group.items.map((item) => {
                const locked = disabled || (!canGrant(item.key) && !selected.has(item.key))
                return (
                  <label
                    key={item.key}
                    className={cn(
                      "flex cursor-pointer items-start gap-3 px-3.5 py-2.5 transition-colors hover:bg-muted/60",
                      locked && "cursor-not-allowed opacity-60 hover:bg-transparent",
                    )}
                    title={!disabled && locked ? "Anda tidak dapat memberikan hak yang tidak Anda miliki" : undefined}
                  >
                    <input
                      type="checkbox"
                      className="mt-0.5 size-4 shrink-0 accent-primary"
                      checked={selected.has(item.key)}
                      disabled={locked}
                      onChange={(event) => toggle(item.key, event.target.checked)}
                    />
                    <span className="min-w-0">
                      <span className="block text-[13px] font-medium">{item.label}</span>
                      <span className="block text-xs text-muted-foreground">{item.description}</span>
                    </span>
                  </label>
                )
              })}
            </div>
          </fieldset>
        )
      })}
    </div>
  )
}

function RoleDrawer({
  role,
  catalog,
  onClose,
  onSaved,
}: {
  /** null = role baru */
  role: RoleDto | null
  catalog: PermissionGroup[]
  onClose: () => void
  onSaved: (message: string) => void
}) {
  const { actions } = useSynraStore()
  const { can } = useAccess()
  const [name, setName] = useState(role?.name ?? "")
  const [description, setDescription] = useState(role?.description ?? "")
  const [selected, setSelected] = useState(() => new Set(role?.permissions ?? []))
  const [error, setError] = useState("")
  const [saving, setSaving] = useState(false)
  const locked = Boolean(role?.locked)
  const total = catalog.reduce((sum, group) => sum + group.items.length, 0)

  return (
    <Drawer open title={role ? `Ubah Role ${role.name}` : "Tambah Role"} onClose={onClose}>
      <form
        className="flex flex-col gap-4"
        onSubmit={async (event) => {
          event.preventDefault()
          setSaving(true)
          setError("")
          const input = {
            name: name.trim(),
            description: description.trim(),
            ...(locked ? {} : { permissions: [...selected] }),
          }
          try {
            if (role) await actions.updateRole(role.id, input)
            else await actions.createRole({ ...input, permissions: [...selected] })
            onSaved(role ? `Role ${input.name} diperbarui` : `Role ${input.name} ditambahkan`)
            onClose()
          } catch (e) {
            setError(errorText(e, role ? "Gagal memperbarui role." : "Gagal menambah role."))
          } finally {
            setSaving(false)
          }
        }}
      >
        <FormField label="Nama role" hint={role ? `Kode: ${role.code}` : "Kode role dibuat otomatis dari nama"}>
          <Input value={name} onChange={(event) => setName(event.target.value)} maxLength={50} required />
        </FormField>
        <FormField label="Deskripsi" hint="Opsional, mis. tugas atau wilayah role ini">
          <Textarea rows={2} value={description} onChange={(event) => setDescription(event.target.value)} maxLength={200} />
        </FormField>

        <div className="flex items-baseline justify-between gap-3">
          <span className="text-[12.5px] font-medium text-muted-foreground">Hak akses</span>
          <span className="text-xs tabular-nums text-muted-foreground">
            {selected.size} dari {total} dipilih
          </span>
        </div>
        {locked ? (
          <div role="note" className="flex items-start gap-2 rounded-xl border border-primary/30 bg-primary/[0.06] p-3 text-sm">
            <Lock size={15} className="mt-0.5 shrink-0 text-primary" aria-hidden="true" />
            Administrator selalu memiliki semua hak akses, termasuk hak baru yang ditambahkan kemudian.
          </div>
        ) : (
          <p className="-mt-2 text-xs text-muted-foreground">
            Mencentang sebuah tindakan otomatis mencentang menunya. Perubahan berlaku langsung untuk semua pengguna role ini.
          </p>
        )}
        <PermissionChecklist
          catalog={catalog}
          selected={selected}
          disabled={locked}
          canGrant={(key) => can(key)}
          onChange={setSelected}
        />

        {error && (
          <p className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2 text-xs text-danger" role="alert">
            {error}
          </p>
        )}
        <div className="sticky bottom-0 -mx-5 -mb-5 mt-2 flex justify-end gap-2 border-t border-border bg-popover px-5 py-4">
          <Button type="button" variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button type="submit" disabled={saving || !name.trim()}>
            {saving ? "Menyimpan…" : role ? "Simpan Perubahan" : "Tambah Role"}
          </Button>
        </div>
      </form>
    </Drawer>
  )
}

/** Daftar role dan pengaturan hak aksesnya. Butuh hak roles.manage. */
export default function RolesAdministration() {
  const { api, actions } = useSynraStore()
  const roles = api.roles
  const catalog = api.permissionCatalog
  /** undefined = drawer tertutup, null = tambah, RoleDto = ubah */
  const [editing, setEditing] = useState<RoleDto | null | undefined>(undefined)
  const [deleting, setDeleting] = useState<RoleDto | null>(null)
  const [toast, setToast] = useState("")
  const labelOf = new Map(catalog.flatMap((group) => group.items.map((item) => [item.key, item.label] as const)))
  const total = labelOf.size

  const remove = async (role: RoleDto) => {
    setDeleting(null)
    try {
      await actions.deleteRole(role.id)
      setToast(`Role ${role.name} dihapus`)
    } catch (e) {
      setToast(errorText(e, "Gagal menghapus role"))
    }
  }

  return (
    <>
      <GlassCard className="flex min-w-0 flex-col gap-5 p-5 md:p-6">
        <CardHeading
          title="Role & Hak Akses"
          description={`${roles.length} role. Buat role baru lalu centang menu dan tindakan yang boleh diakses. Role bawaan tidak dapat dihapus.`}
          actions={
            <Button onClick={() => setEditing(null)} disabled={catalog.length === 0}>
              <Plus size={16} strokeWidth={1.75} aria-hidden="true" />
              Tambah Role
            </Button>
          }
        />
        {roles.length === 0 ? (
          <EmptyState icon={ShieldCheck} title="Belum ada data role" description="Daftar role belum termuat. Coba muat ulang halaman." />
        ) : (
          <div className="grid grid-cols-1 gap-4 md:grid-cols-2 2xl:grid-cols-3">
            {roles.map((role) => {
              const shown = role.permissions.slice(0, 6).map((key) => labelOf.get(key as Permission) ?? key)
              const deleteBlocked = role.isSystem
                ? "Role bawaan tidak dapat dihapus"
                : role.userCount > 0
                  ? "Pindahkan pengguna role ini ke role lain terlebih dahulu"
                  : undefined
              return (
                <article key={role.id} className="flex min-w-0 flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4">
                  <div className="flex items-start justify-between gap-3">
                    <div className="min-w-0">
                      <h3 className="truncate text-sm font-semibold">{role.name}</h3>
                      <p className="truncate font-mono text-[11px] text-muted-foreground">{role.code}</p>
                    </div>
                    <div className="flex shrink-0 flex-wrap justify-end gap-1.5">
                      {role.locked && (
                        <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[11px] text-primary">Akses penuh</span>
                      )}
                      {role.isSystem && (
                        <span className="rounded-md border border-border bg-muted px-2 py-0.5 text-[11px] text-muted-foreground">Bawaan</span>
                      )}
                    </div>
                  </div>
                  {role.description && <p className="text-xs text-muted-foreground">{role.description}</p>}
                  <p className="flex items-center gap-3 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Users size={13} aria-hidden="true" />
                      {role.userCount} pengguna
                    </span>
                    <span className="flex items-center gap-1">
                      <ShieldCheck size={13} aria-hidden="true" />
                      {role.permissions.length}/{total} hak akses
                    </span>
                  </p>
                  {shown.length > 0 && (
                    <ul className="flex flex-wrap gap-1.5" aria-label={`Hak akses ${role.name}`}>
                      {shown.map((label) => (
                        <li key={label} className="rounded-md border border-border bg-card px-2 py-0.5 text-[11px]">
                          {label}
                        </li>
                      ))}
                      {role.permissions.length > shown.length && (
                        <li className="px-1 py-0.5 text-[11px] text-muted-foreground">+{role.permissions.length - shown.length} lainnya</li>
                      )}
                    </ul>
                  )}
                  <div className="mt-auto flex items-center gap-2 pt-1">
                    <Button variant="outline" size="sm" onClick={() => setEditing(role)} disabled={catalog.length === 0}>
                      <Pencil size={14} aria-hidden="true" />
                      {role.locked ? "Lihat" : "Ubah"}
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={Boolean(deleteBlocked)}
                      title={deleteBlocked}
                      className="text-danger hover:text-danger"
                      onClick={() => setDeleting(role)}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                      Hapus
                    </Button>
                  </div>
                </article>
              )
            })}
          </div>
        )}
      </GlassCard>
      {editing !== undefined && (
        <RoleDrawer role={editing} catalog={catalog} onClose={() => setEditing(undefined)} onSaved={setToast} />
      )}
      <ConfirmDialog
        open={deleting !== null}
        title={`Hapus role ${deleting?.name ?? ""}?`}
        description="Role akan dihapus permanen. Tindakan ini tercatat di audit log."
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
