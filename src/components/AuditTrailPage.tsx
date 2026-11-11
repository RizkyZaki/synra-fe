import { Download } from "lucide-react"
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
  PageToolbar,
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
        <PageToolbar
          actions={
            <Button variant="outline" onClick={() => void exportCsv()}>
              <Download {...iconProps} />
              Ekspor CSV
            </Button>
          }
        >
          <FilterField label="Pencarian" className="min-w-[260px] flex-1">
            <Input
              id="audit-search"
              value={search}
              onChange={(event) => {
                setSearch(event.target.value)
                setPage(1)
              }}
              placeholder="Cari pengguna, tindakan, target, atau detail"
            />
          </FilterField>
        </PageToolbar>

        <div className="flex flex-wrap items-end gap-3 mt-4 mb-4">
          <FilterField label="Tanggal" className="w-[180px]">
            <Input
              type="date"
              value={date}
              onChange={(event) => {
                setDate(event.target.value)
                setPage(1)
              }}
            />
          </FilterField>

          <FilterField label="Tindakan" className="w-[180px]">
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

          <FilterField label="Pengguna" className="w-[180px]">
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

        <DataTable
          columns={columns}
          rows={paginatedRows}
          rowKey={(entry) => entry.id}
        />

        <Pagination
          page={page}
          totalPages={totalPages}
          totalRows={totalRows}
          startIndex={startIndex}
          endIndex={endIndex}
          onPageChange={setPage}
          itemLabel="entri"
        />

        <p className="type-meta text-muted-foreground audit-count mt-3">
          {filtered.length} dari 100 entri terbaru · append-only (tidak dapat diubah atau dihapus)
        </p>
      </GlassCard>
      <Toast visible={Boolean(toast)} message={toast} onClose={() => setToast("")} />
    </div>
  )
}
