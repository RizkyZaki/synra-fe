import { Download } from "lucide-react"
import { useMemo, useState } from "react"
import { useSynraStore } from "../lib/useSynraStore"
import { ApiError } from "../lib/api"
import { formatDateTime } from "../lib/backend"
import type { AuditEntry } from "../lib/synraDomain"
import { ApiErrorBanner, DataTable, GlassCard, Toast, type DataTableColumn } from "./ui"
import { Button } from "@/components/ui/button"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"

const iconProps = {
  size: 20,
  strokeWidth: 1.75,
  "aria-hidden": true,
} as const

export default function AuditTrailPage() {
  const { read, actions: storeActions, error } = useSynraStore()
  const audit = read("audit")
  const [toast, setToast] = useState("")
  const [date, setDate] = useState("")
  const [action, setAction] = useState("Semua")
  const [user, setUser] = useState("Semua")
  const [search, setSearch] = useState("")
  const actions = [...new Set(audit.map((entry) => entry.action))].sort()
  const users = [...new Set(audit.map((entry) => entry.user))].sort()

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase()
    return [...audit]
      .filter(
        (entry) =>
          (!date || entry.time.slice(0, 10) === date) &&
          (action === "Semua" || entry.action === action) &&
          (user === "Semua" || entry.user === user) &&
          (!query ||
            [
              entry.id,
              entry.user,
              entry.role,
              entry.action,
              entry.target,
              entry.detail,
            ].some((value) => value.toLowerCase().includes(query))),
      )
      .sort(
        (a, b) => new Date(b.time).getTime() - new Date(a.time).getTime(),
      )
  }, [audit, date, action, user, search])

  const columns: DataTableColumn<AuditEntry>[] = [
    { key: "time", header: "Waktu", render: (entry) => formatDateTime(entry.time) },
    {
      key: "user",
      header: "Pengguna",
      render: (entry) => <strong>{entry.user}</strong>,
    },
    { key: "role", header: "Entitas", render: (entry) => entry.role },
    { key: "action", header: "Tindakan", render: (entry) => entry.action },
    { key: "target", header: "Target", render: (entry) => entry.target },
    { key: "detail", header: "Detail", render: (entry) => entry.detail },
  ]

  /** Ekspor dari server: seluruh audit (bukan hanya 100 entri terbaru), dan ekspornya ikut diaudit. */
  const exportCsv = async () => {
    try {
      await storeActions.download("/audit-logs/export", "audit-trail-synra.csv")
      setToast("Audit trail berhasil diekspor")
    } catch (e) {
      setToast(e instanceof ApiError ? e.message : "Gagal mengekspor audit trail")
    }
  }

  return (
    <div className="audit-page">
      <ApiErrorBanner message={error} />
      <GlassCard className="audit-panel">
        <div className="audit-toolbar">
          <div className="audit-search">
            <label className="label" htmlFor="audit-search">
              Pencarian
            </label>
            <input
              id="audit-search"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Cari pengguna, tindakan, target, atau detail"
            />
          </div>
          <Button onClick={() => void exportCsv()}><Download {...iconProps} />Ekspor CSV</Button>
        </div>

        <div className="audit-filters">
          <label>
            <span className="label">Tanggal</span>
            <input
              type="date"
              value={date}
              onChange={(event) => setDate(event.target.value)}
            />
          </label>
          <label>
            <span className="label">Tindakan</span>
            <select
              value={action}
              onChange={(event) => setAction(event.target.value)}
            >
              <option>Semua</option>
              {actions.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
          <label>
            <span className="label">Pengguna</span>
            <select
              value={user}
              onChange={(event) => setUser(event.target.value)}
            >
              <option>Semua</option>
              {users.map((item) => (
                <option key={item}>{item}</option>
              ))}
            </select>
          </label>
        </div>

        <DataTable
          columns={columns}
          rows={filtered}
          rowKey={(entry) => entry.id}
        />
        <p className="label text-muted audit-count">
          {filtered.length} dari 100 entri terbaru · append-only (tidak dapat diubah atau dihapus)
        </p>
      </GlassCard>
      <Toast visible={Boolean(toast)} message={toast} onClose={() => setToast("")} />
    </div>
  )
}
