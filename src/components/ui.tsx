/**
 * ui.tsx — Komponen bersama SYNRA
 *
 * Implementasi menggunakan shadcn/ui.
 * Semua nama export dan kontrak props publik DIPERTAHANKAN untuk kompatibilitas mundur.
 */

import { ArrowLeft, X, AlertTriangle, Inbox, type LucideIcon } from "lucide-react"
import {
  type ComponentProps,
  type HTMLAttributes,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { toast as sonnerToast } from "sonner"
import type { Severity } from "../lib/synraDomain"
import { cn } from "../lib/utils"

// ── shadcn primitives ────────────────────────────────────────────────────────
import { Button } from "@/components/ui/button"
import { Card } from "@/components/ui/card"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"

// ── GlassCard ────────────────────────────────────────────────────────────────
/**
 * Kartu solid (nama export GlassCard tetap untuk backward-compatibility).
 */
export function GlassCard({
  className = "",
  children,
  ...props
}: ComponentProps<"section">) {
  return (
    <section className={cn("glass-card rounded-[var(--radius-surface,12px)] border border-border bg-card shadow-xs", className)} {...props}>
      {children}
    </section>
  )
}

// ── BackLink ─────────────────────────────────────────────────────────────────
export function BackLink({
  label,
  href,
  onClick,
  className,
}: {
  label: string
  href?: string
  onClick?: () => void
  className?: string
}) {
  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn(
        "h-[var(--control-height,38px)] gap-2 px-3 rounded-[var(--radius-control,10px)] text-sm font-medium text-muted-foreground hover:text-foreground inline-flex items-center",
        className
      )}
      onClick={(e) => {
        if (onClick) {
          e.preventDefault()
          onClick()
        }
      }}
      render={href ? <a href={href} /> : undefined}
    >
      <ArrowLeft size={16} strokeWidth={2} />
      <span>{label}</span>
    </Button>
  )
}

// ── PageHeader ───────────────────────────────────────────────────────────────
export function PageHeader({
  eyebrow: _eyebrow,
  title,
  badge,
  backTo,
  onNavigate,
  readOnly = false,
  className = "",
}: {
  eyebrow?: string
  title: string
  badge?: ReactNode
  backTo?: { label: string; href: string }
  onNavigate?: (href: string) => void
  readOnly?: boolean
  className?: string
}) {
  return (
    <div className={cn("page-heading", className)}>
      <div className="page-heading__copy">
        {backTo && (
          <div className="mb-2">
            <BackLink
              label={backTo.label}
              href={backTo.href}
              onClick={() => onNavigate?.(backTo.href)}
            />
          </div>
        )}
        <div>
          {/* Eyebrow dihapus dari render agar kartu/halaman punya satu judul bersih */}
          <div className="page-heading__title-row flex items-center gap-3">
            <h2 className="type-page-title">{title}</h2>
            {badge}
          </div>
          {readOnly && (
            <span className="type-meta text-muted-foreground mt-1 inline-block">
              Akses baca saja
            </span>
          )}
        </div>
      </div>
      <div className="location-pills" />
    </div>
  )
}

// ── PageLayout ───────────────────────────────────────────────────────────────
export function PageLayout({
  eyebrow,
  title,
  badge,
  backTo,
  onNavigate,
  readOnly = false,
  headerClassName = "",
  children,
}: {
  eyebrow?: string
  title: string
  badge?: ReactNode
  backTo?: { label: string; href: string }
  onNavigate?: (href: string) => void
  readOnly?: boolean
  headerClassName?: string
  children: ReactNode
}) {
  return (
    <main className="content">
      <PageHeader
        eyebrow={eyebrow}
        title={title}
        badge={badge}
        backTo={backTo}
        onNavigate={onNavigate}
        readOnly={readOnly}
        className={headerClassName}
      />
      {children}
    </main>
  )
}

// ── KpiCard ──────────────────────────────────────────────────────────────────
export function KpiCard({
  label,
  value,
  tag,
  tone,
  description: _description,
  note,
  onAction,
}: {
  label: string
  value: string
  tag: string
  tone: string
  description?: string
  note: string
  onAction: () => void
}) {
  return (
    <GlassCard
      className={cn("kpi-card kpi-card--interactive flex flex-col justify-between p-5", `kpi-card--tone-${tone}`)}
      role="link"
      tabIndex={0}
      onClick={onAction}
      onKeyDown={(event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault()
          onAction()
        }
      }}
    >
      <div className="kpi-card__top">
        <span className="type-label text-muted-foreground">{label}</span>
      </div>
      <div className="kpi-card__value my-2 flex items-baseline gap-2">
        <strong className="text-2xl font-bold tracking-tight">{value}</strong>
        {tag && <span className="type-meta text-muted-foreground">{tag}</span>}
      </div>
      <div className="kpi-card__note flex items-center justify-between gap-2 pt-2 border-t border-border/50">
        <span className="type-meta truncate" title={note}>{note}</span>
        <Button
          variant="ghost"
          size="sm"
          className="h-auto p-0 text-primary hover:bg-transparent font-medium"
          onClick={(event) => {
            event.stopPropagation()
            onAction()
          }}
        >
          Lihat
        </Button>
      </div>
    </GlassCard>
  )
}

// ── SeverityBadge (Teks Murni Berwarna Tanpa Bungkus) ─────────────────────────
const severityLabel: Record<Severity, string> = {
  Normal:   "Normal",
  Info:     "Info",
  Low:      "Rendah",
  Medium:   "Sedang",
  High:     "Tinggi",
  Critical: "Kritis",
  Expired:  "Kedaluwarsa",
}

const severityTextClass: Record<Severity, string> = {
  Normal:   "text-[var(--status-success)]",
  Info:     "text-[var(--status-success)]",
  Low:      "text-[var(--status-warning)]",
  Medium:   "text-[var(--status-warning)]",
  High:     "text-[var(--status-high)]",
  Critical: "text-[var(--status-danger)]",
  Expired:  "text-[var(--status-danger)]",
}

export function SeverityBadge({
  severity,
  className,
}: {
  severity: Severity
  className?: string
}) {
  return (
    <span className={cn("type-body font-semibold select-none", severityTextClass[severity], className)}>
      {severityLabel[severity]}
    </span>
  )
}

// ── StatusBadge (Teks Murni Berwarna Tanpa Bungkus) ───────────────────────────
const statusLabels: Record<string, string> = {
  Good:               "Baik",
  Warning:            "Peringatan",
  Critical:           "Kritis",
  Online:             "Daring",
  Offline:            "Luring",
  Degraded:           "Menurun",
  Renewed:            "Diperpanjang",
  Terminated:         "Dihentikan",
  Active:             "Aktif",
  Inactive:           "Nonaktif",
  "Menunggu Review":  "Menunggu tinjauan",
}

export function StatusBadge({
  status,
  tone,
  className,
}: {
  status: string
  tone?: "success" | "warning" | "danger" | "neutral"
  className?: string
}) {
  const getTone = (): "success" | "warning" | "high" | "danger" | "neutral" => {
    if (tone === "danger") return "danger"
    if (tone === "warning") return "warning"
    if (tone === "success") return "success"
    if (tone === "neutral") return "neutral"
    const s = status.toLowerCase()
    if (s.includes("kritis") || s.includes("critical") || s.includes("offline") || s.includes("dihentikan")) return "danger"
    if (s.includes("tinggi") || s.includes("high") || s.includes("menurun") || s.includes("degraded")) return "high"
    if (s.includes("peringatan") || s.includes("warning") || s.includes("sedang") || s.includes("rendah") || s.includes("tinjau")) return "warning"
    if (s.includes("baik") || s.includes("good") || s.includes("online") || s.includes("aktif") || s.includes("normal") || s.includes("pulih") || s.includes("perpanjang")) return "success"
    return "neutral"
  }

  const toneClass: Record<string, string> = {
    danger:  "text-[var(--status-danger)]",
    high:    "text-[var(--status-high)]",
    warning: "text-[var(--status-warning)]",
    success: "text-[var(--status-success)]",
    neutral: "text-[var(--status-neutral)]",
  }

  return (
    <span className={cn("type-body font-semibold select-none", toneClass[getTone()], className)}>
      {statusLabels[status] ?? status}
    </span>
  )
}

// ── DataTable ────────────────────────────────────────────────────────────────
export interface DataTableColumn<T> {
  key: string
  header: string
  render: (row: T) => ReactNode
}

export function DataTable<T>({
  columns,
  rows,
  rowKey,
  rowSeverity,
  onRowClick,
}: {
  columns: DataTableColumn<T>[]
  rows: T[]
  rowKey: (row: T) => string
  rowSeverity?: (row: T) => Severity | undefined
  onRowClick?: (row: T) => void
}) {
  return (
    <div className="table-wrap overflow-x-auto w-full">
      <Table className="data-table w-full">
        <TableHeader>
          <TableRow className="border-b border-border">
            {columns.map((col) => (
              <TableHead key={col.key} className="type-label text-muted-foreground h-10 px-3 py-2 text-left">
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => (
            <TableRow
              key={rowKey(row)}
              data-severity={rowSeverity?.(row)}
              className={cn(
                "border-b border-border/50 transition-colors",
                "data-[severity=Critical]:bg-[color-mix(in_srgb,var(--status-danger)_8%,transparent)]",
                onRowClick && "cursor-pointer hover:bg-muted/50 focus-visible:bg-muted/50 outline-none"
              )}
              tabIndex={onRowClick ? 0 : undefined}
              onClick={() => onRowClick?.(row)}
              onKeyDown={(event) => {
                if (
                  onRowClick &&
                  (event.key === "Enter" || event.key === " ")
                ) {
                  event.preventDefault()
                  onRowClick(row)
                }
              }}
            >
              {columns.map((col) => (
                <TableCell key={col.key} className="type-body px-3 py-2.5">
                  {col.render(row)}
                </TableCell>
              ))}
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </div>
  )
}

// ── FormField ────────────────────────────────────────────────────────────────
export function FormField({
  label,
  hint,
  error,
  children,
}: {
  label: string
  hint?: string
  error?: string
  children: ReactNode
}) {
  return (
    <label className="form-field flex flex-col gap-1.5 w-full">
      <span className="type-label text-muted-foreground">{label}</span>
      <span className="form-control-slot w-full">
        {children}
      </span>
      {(error || hint) && (
        <span className={cn("type-meta", error ? "text-[var(--status-danger)]" : "text-muted-foreground")}>
          {error || hint}
        </span>
      )}
    </label>
  )
}

// ── ConfirmDialog ─────────────────────────────────────────────────────────────
export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Konfirmasi",
  cancelLabel = "Batal",
  tone = "danger",
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  tone?: "danger" | "warning" | "primary"
  onConfirm: () => void
  onClose: () => void
}) {
  return (
    <AlertDialog open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <AlertDialogContent className="max-w-md p-6 bg-card border border-border rounded-[var(--radius-surface,12px)] shadow-xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="type-card-title">{title}</AlertDialogTitle>
          <AlertDialogDescription className="type-body text-muted-foreground mt-2">
            {description}
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-6 flex justify-end gap-3">
          <AlertDialogCancel onClick={onClose}>
            {cancelLabel}
          </AlertDialogCancel>
          <AlertDialogAction
            onClick={onConfirm}
            className={tone === "danger" ? "bg-destructive text-destructive-foreground hover:bg-destructive/90" : ""}
          >
            {confirmLabel}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}

// ── Toast (adapter tipis → sonner) ───────────────────────────────────────────
export function Toast({
  message,
  visible,
  onClose,
}: {
  message: string
  visible: boolean
  onClose: () => void
}) {
  const shownRef = useRef(false)

  useEffect(() => {
    if (visible && !shownRef.current) {
      shownRef.current = true
      sonnerToast(message, {
        duration: 3200,
        onDismiss: onClose,
        onAutoClose: onClose,
      })
    }
    if (!visible) {
      shownRef.current = false
    }
  }, [visible, message, onClose])

  return null
}

// ── EmptyState ───────────────────────────────────────────────────────────────
export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
  icon: Icon = Inbox,
  className,
}: {
  title: string
  description?: string
  actionLabel?: string
  onAction?: () => void
  icon?: LucideIcon
  className?: string
}) {
  return (
    <div className={cn("empty-state flex flex-col items-center justify-center p-8 text-center rounded-[var(--radius-surface,12px)] border border-border bg-card", className)}>
      <div className="flex size-12 items-center justify-center rounded-[var(--radius-control,10px)] bg-muted text-muted-foreground mb-4">
        <Icon size={24} />
      </div>
      <h3 className="type-card-title">{title}</h3>
      {description && <p className="type-body text-muted-foreground mt-1 max-w-sm">{description}</p>}
      {actionLabel && onAction && (
        <Button variant="default" className="mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}

// ── Drawer (Sheet side="right" as fixed overlay) ──────────────────────────────
export function Drawer({
  open,
  title,
  children,
  onClose,
  actions,
}: {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
  actions?: ReactNode
}) {
  return (
    <Sheet open={open} onOpenChange={(isOpen) => { if (!isOpen) onClose() }}>
      <SheetContent
        side="right"
        showCloseButton={false}
        className="fixed inset-y-0 right-0 z-[101] w-full sm:max-w-md flex flex-col p-0 border-l border-border bg-card shadow-2xl"
      >
        <SheetHeader className="drawer__header flex flex-row items-center justify-between p-5 pb-4 border-b border-border">
          <SheetTitle className="type-card-title text-foreground">{title}</SheetTitle>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Tutup"
            className="rounded-[var(--radius-control,10px)] text-muted-foreground hover:text-foreground"
          >
            <X aria-hidden="true" size={18} strokeWidth={2} />
            <span className="sr-only">Tutup</span>
          </Button>
        </SheetHeader>
        <div className="drawer__body flex-1 overflow-y-auto p-5">
          {children}
        </div>
        {actions && (
          <div className="drawer__footer flex items-center justify-end gap-3 p-5 pt-4 border-t border-border bg-card">
            {actions}
          </div>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ── LoadingState ──────────────────────────────────────────────────────────────
export function LoadingState({ className }: { className?: string }) {
  return (
    <div className={cn("loading-state p-6 flex flex-col gap-3 rounded-[var(--radius-surface,12px)] border border-border bg-card", className)} aria-label="Memuat">
      <Skeleton className="h-6 w-48 rounded-[var(--radius-control,10px)]" />
      <Skeleton className="h-4 w-full rounded-[var(--radius-control,10px)]" />
      <Skeleton className="h-4 w-3/4 rounded-[var(--radius-control,10px)]" />
    </div>
  )
}

// ── ErrorState ────────────────────────────────────────────────────────────────
export function ErrorState({
  title = "Data tidak dapat dimuat",
  message = "Periksa koneksi sistem lalu coba kembali.",
  onRetry,
  className,
}: {
  title?: string
  message?: string
  onRetry?: () => void
  className?: string
}) {
  return (
    <div className={cn("empty-state flex flex-col items-center justify-center p-8 text-center rounded-[var(--radius-surface,12px)] border border-destructive/30 bg-card", className)} role="alert">
      <div className="flex size-12 items-center justify-center rounded-[var(--radius-control,10px)] bg-destructive/10 text-destructive mb-4">
        <AlertTriangle size={24} />
      </div>
      <h3 className="type-card-title text-destructive">{title}</h3>
      <p className="type-body text-muted-foreground mt-1 max-w-sm">{message}</p>
      {onRetry && (
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          Coba lagi
        </Button>
      )}
    </div>
  )
}

// ── ScopeNotice ───────────────────────────────────────────────────────────────
export function ScopeNotice({ children }: { children?: ReactNode }) {
  return (
    <Alert className="scope-notice mb-4 border-warning/50 bg-warning/5 text-[var(--status-warning)]" role="note">
      <AlertTitle className="type-label font-semibold">Belum tersedia di backend SYNRA</AlertTitle>
      <AlertDescription className="type-body mt-1">
        {children ??
          "Fitur ini di luar cakupan pilot. Data yang tampil di halaman ini adalah contoh dan tidak tersimpan di server."}
      </AlertDescription>
    </Alert>
  )
}

// ── ApiErrorBanner ────────────────────────────────────────────────────────────
export function ApiErrorBanner({
  message,
  onRetry,
}: {
  message: string
  onRetry?: () => void
}) {
  if (!message) return null
  return (
    <Alert variant="destructive" className="mb-4 flex items-center justify-between" role="alert">
      <div className="flex items-center gap-2">
        <AlertTriangle className="size-4 shrink-0" />
        <div>
          <AlertTitle className="type-label font-semibold">Gagal memuat data</AlertTitle>
          <AlertDescription className="type-body">{message}</AlertDescription>
        </div>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Coba lagi
        </Button>
      )}
    </Alert>
  )
}

// ── FilterField & PageToolbar (Step 4F) ─────────────────────────────────────────
export function FilterField({
  label,
  children,
  className,
}: {
  label: string
  children: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="type-label text-muted-foreground">{label}</span>
      {children}
    </div>
  )
}

export function PageToolbar({
  children,
  actions,
  className,
}: {
  children?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap items-end justify-between gap-3 w-full", className)}>
      <div className="flex flex-wrap items-end gap-3 flex-1 min-w-0">
        {children}
      </div>
      {actions && (
        <div className="flex items-center gap-2 shrink-0">
          {actions}
        </div>
      )}
    </div>
  )
}

// ── usePagination & Pagination (Step 4F) ───────────────────────────────────────
export function usePagination<T>(rows: T[], pageSize = 10) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))

  useEffect(() => {
    setPage((current) => Math.min(Math.max(1, current), totalPages))
  }, [rows.length, totalPages])

  const startIndex = (page - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, rows.length)
  const paginatedRows = useMemo(
    () => rows.slice(startIndex, endIndex),
    [rows, startIndex, endIndex]
  )

  return {
    page,
    setPage,
    totalPages,
    startIndex,
    endIndex,
    totalRows: rows.length,
    paginatedRows,
  }
}

export function Pagination({
  page,
  totalPages,
  totalRows,
  startIndex,
  endIndex,
  onPageChange,
  itemLabel = "data",
}: {
  page: number
  totalPages: number
  totalRows: number
  startIndex: number
  endIndex: number
  onPageChange: (page: number) => void
  itemLabel?: string
}) {
  const rangeSummary =
    totalRows > 0
      ? `Menampilkan ${startIndex + 1}–${endIndex} dari ${totalRows} ${itemLabel}`
      : `Menampilkan 0 ${itemLabel}`

  const getPageNumbers = () => {
    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, i) => i + 1)
    }
    if (page <= 4) {
      return [1, 2, 3, 4, 5, "ellipsis", totalPages]
    }
    if (page >= totalPages - 3) {
      return [1, "ellipsis", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    }
    return [1, "ellipsis", page - 1, page, page + 1, "ellipsis", totalPages]
  }

  return (
    <nav aria-label="Navigasi paginasi" className="flex flex-wrap items-center justify-between gap-3 pt-3 w-full">
      <span className="type-meta">{rangeSummary}</span>
      <div className="flex items-center gap-1.5">
        <Button
          variant="outline"
          size="sm"
          disabled={page <= 1}
          onClick={() => onPageChange(page - 1)}
        >
          Sebelumnya
        </Button>
        {getPageNumbers().map((num, idx) =>
          num === "ellipsis" ? (
            <span key={`el-${idx}`} className="px-2 text-muted-foreground select-none">
              …
            </span>
          ) : (
            <Button
              key={num}
              variant={page === num ? "default" : "outline"}
              size="sm"
              aria-current={page === num ? "page" : undefined}
              className={page === num ? "border-transparent font-medium" : "font-normal"}
              onClick={() => onPageChange(num as number)}
            >
              {num}
            </Button>
          )
        )}
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => onPageChange(page + 1)}
        >
          Berikutnya
        </Button>
      </div>
    </nav>
  )
}
