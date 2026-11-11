import { Download, Lock, Search } from "lucide-react"
import { useMemo, useState } from "react"
import { useSynraStore } from "../lib/useSynraStore"
import { ApiError } from "../lib/api"
import { formatDateTime } from "../lib/backend"
import type { AuditEntry } from "../lib/synraDomain"
import {
  ApiErrorBanner,
  DataTable,
  FilterField,
  GlassCard,
  Pagination,
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

/** Tanggal (YYYY-MM-DD) dalam WIB. Waktu dari server dalam UTC, jadi aksi 00.00–06.59 WIB tidak boleh jatuh ke hari sebelumnya. */
const jakartaFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Asia/Jakarta",
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
})
const jakartaDate = (iso: string) => {
  const d = new Date(iso)
  return Number.isNaN(d.getTime()) ? iso.slice(0, 10) : jakartaFormatter.format(d)
}

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
          (!date || jakartaDate(entry.time) === date) &&
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

  const {
    page,
    setPage,
    totalPages,
    startIndex,
    endIndex,
    totalRows,
    paginatedRows,
  } = usePagination(filtered, 10)

  const columns: DataTableColumn<AuditEntry>[] = [
    { key: "time", header: "Waktu", render: (entry) => <span className="whitespace-nowrap text-muted-foreground">{formatDateTime(entry.time)}</span> },
    {
      key: "user",
      header: "Pengguna",
      render: (entry) => <strong className="font-medium">{entry.user}</strong>,
    },
    { key: "role", header: "Entitas", render: (entry) => entry.role },
    { key: "action", header: "Tindakan", render: (entry) => <span className="inline-flex whitespace-nowrap rounded-md border border-border bg-muted px-2 py-0.5 text-xs">{entry.action}</span> },
    { key: "target", header: "Target", render: (entry) => entry.target },
    { key: "detail", header: "Detail", render: (entry) => <span className="line-clamp-2 min-w-[200px] text-muted-foreground">{entry.detail}</span> },
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
    <div className="flex min-w-0 flex-col gap-6">
      <ApiErrorBanner message={error} />
      <GlassCard className="flex min-w-0 flex-col gap-4 p-4 md:p-5">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
          <label className="relative min-w-0 flex-1">
            <Search size={16} className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
            <Input
              id="audit-search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="Cari pengguna, tindakan, target, atau detail"
              aria-label="Cari audit trail"
              className="pl-9"
            />
          </label>
          <Button variant="outline" onClick={() => void exportCsv()}>
            <Download {...iconProps} />
            Ekspor CSV
          </Button>
        </div>

        <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
          <FilterField label="Tanggal">
            <Input
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value)
                setPage(1)
              }}
            />
          </FilterField>

          <FilterField label="Tindakan">
            <Select
              value={action}
              onValueChange={(val) => {
                setAction(val ?? "Semua")
                setPage(1)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Semua">Semua</SelectItem>
                {actions.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>

          <FilterField label="Pengguna">
            <Select
              value={user}
              onValueChange={(val) => {
                setUser(val ?? "Semua")
                setPage(1)
              }}
            >
              <SelectTrigger className="w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="Semua">Semua</SelectItem>
                {users.map((item) => (
                  <SelectItem key={item} value={item}>
                    {item}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </FilterField>
        </div>

        <DataTable columns={columns} rows={paginatedRows} rowKey={(entry) => entry.id} />

        <Pagination
          page={page}
          totalPages={totalPages}
          totalRows={totalRows}
          startIndex={startIndex}
          endIndex={endIndex}
          onPageChange={setPage}
          itemLabel="entri"
        />

        <p className="flex items-center gap-2 border-t border-border pt-3 text-xs text-muted-foreground">
          <Lock size={13} aria-hidden="true" />
          {filtered.length} dari 100 entri terbaru · append-only (tidak dapat diubah atau dihapus)
        </p>
      </GlassCard>
      <Toast visible={Boolean(toast)} message={toast} onClose={() => setToast("")} />
    </div>
  )
}
