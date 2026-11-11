/**
 * ui.tsx — Komponen bersama SYNRA (shadcn + efek Aceternity).
 * Nama export dan kontrak props publik dipertahankan.
 */

import { AlertTriangle, ArrowLeft, Eye, Inbox, type LucideIcon, X } from "lucide-react"
import {
  type ComponentProps,
  type ReactNode,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import { toast as sonnerToast } from "sonner"
import type { Severity } from "../lib/synraDomain"
import { cn } from "../lib/utils"

import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
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
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet"
import { Skeleton } from "@/components/ui/skeleton"
import { SpotlightCard } from "@/components/aceternity/spotlight-card"
import { NumberTicker } from "@/components/aceternity/number-ticker"

// ── Kartu dasar ─────────────────────────────────────────────────────────────
export function GlassCard({ className = "", children, ...props }: ComponentProps<"section">) {
  return (
    <section
      className={cn(
        "glass-card relative rounded-[var(--radius-surface)] border border-border bg-card/90 shadow-[var(--card-shadow)] backdrop-blur-sm",
        className,
      )}
      {...props}
    >
      {children}
    </section>
  )
}

/** Judul kartu standar: judul, keterangan opsional, dan aksi di kanan. */
export function CardHeading({
  title,
  description,
  actions,
  className,
}: {
  title: ReactNode
  description?: ReactNode
  actions?: ReactNode
  className?: string
}) {
  return (
    <div className={cn("flex flex-wrap items-start justify-between gap-3", className)}>
      <div className="min-w-0">
        <h3 className="type-card-title">{title}</h3>
        {description && <p className="type-meta mt-0.5">{description}</p>}
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

// ── BackLink ────────────────────────────────────────────────────────────────
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
      className={cn("-ml-2 h-7 gap-1.5 px-2 text-xs text-muted-foreground hover:text-foreground", className)}
      onClick={(e) => {
        if (onClick) {
          e.preventDefault()
          onClick()
        }
      }}
      nativeButton={!href}
      render={href ? <a href={href} /> : undefined}
    >
      <ArrowLeft size={14} strokeWidth={2} />
      <span>{label}</span>
    </Button>
  )
}

// ── PageHeader ──────────────────────────────────────────────────────────────
export function PageHeader({
  eyebrow,
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
    <div className={cn("col-span-full flex flex-wrap items-end justify-between gap-4", className)}>
      <div className="min-w-0">
        {backTo && (
          <BackLink label={backTo.label} href={backTo.href} onClick={() => onNavigate?.(backTo.href)} className="mb-2" />
        )}
        {eyebrow && !backTo && (
          <p className="mb-1.5 flex items-center gap-2 text-[11px] font-medium uppercase tracking-[0.14em] text-primary">
            <span className="size-1.5 rounded-full bg-primary shadow-[0_0_8px_rgb(255_122_26/90%)]" aria-hidden="true" />
            {eyebrow}
          </p>
        )}
        <div className="flex flex-wrap items-center gap-3">
          <h1 className="type-page-title bg-gradient-to-b from-foreground to-foreground/70 bg-clip-text text-transparent">
            {title}
          </h1>
          {badge}
        </div>
      </div>
      {readOnly && (
        <span className="inline-flex items-center gap-1.5 rounded-full border border-border bg-muted/60 px-3 py-1 text-xs text-muted-foreground">
          <Eye size={13} aria-hidden="true" />
          Akses baca saja
        </span>
      )}
    </div>
  )
}

// ── PageLayout ──────────────────────────────────────────────────────────────
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
    <main className="mx-auto grid w-full max-w-[1480px] grid-cols-12 gap-6 px-4 pb-10 pt-6 md:px-8 md:pt-8 [&>*]:col-span-full">
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

// ── KpiCard ─────────────────────────────────────────────────────────────────
const kpiToneAccent: Record<string, string> = {
  danger: "from-danger/70",
  critical: "from-danger/70",
  high: "from-high/70",
  warning: "from-warning/70",
  success: "from-success/70",
  good: "from-success/70",
  neutral: "from-primary/60",
}

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
    <SpotlightCard
      className="kpi-card cursor-pointer outline-none transition-transform duration-200 hover:-translate-y-0.5 focus-visible:ring-2 focus-visible:ring-ring"
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
      <span
        aria-hidden="true"
        className={cn(
          "absolute inset-x-5 top-0 h-px bg-gradient-to-r to-transparent",
          kpiToneAccent[tone] ?? "from-primary/60",
        )}
      />
      <div className="flex h-full flex-col gap-3 p-5">
        <span className="type-label text-muted-foreground">{label}</span>
        <div className="flex items-baseline gap-2">
          <NumberTicker value={value} className="text-[32px] font-semibold leading-none tracking-tight" />
          {tag && <span className="type-meta">{tag}</span>}
        </div>
        <p className="type-meta mt-auto truncate border-t border-border/70 pt-3" title={note}>
          {note}
        </p>
      </div>
    </SpotlightCard>
  )
}

/** Label filter severity untuk prop `items` pada Select (agar nilai tampil sebagai label). */
export const SEVERITY_FILTER_ITEMS: Record<string, string> = {
  Semua: "Semua",
  Normal: "Normal",
  Info: "Info",
  Low: "Rendah",
  Medium: "Sedang",
  High: "Tinggi",
  Critical: "Kritis",
}

// ── Badge status dan severity ───────────────────────────────────────────────
type Tone = "success" | "warning" | "high" | "danger" | "neutral" | "info"

const toneClass: Record<Tone, string> = {
  danger: "border-danger/25 bg-danger/10 text-danger",
  high: "border-high/25 bg-high/10 text-high",
  warning: "border-warning/25 bg-warning/10 text-warning",
  success: "border-success/25 bg-success/10 text-success",
  info: "border-info/25 bg-info/10 text-info",
  neutral: "border-border bg-muted/70 text-muted-foreground",
}

const dotClass: Record<Tone, string> = {
  danger: "bg-danger shadow-[0_0_6px_var(--status-danger)]",
  high: "bg-high",
  warning: "bg-warning",
  success: "bg-success",
  info: "bg-info",
  neutral: "bg-muted-foreground/60",
}

function Pill({ tone, children, pulse, className }: { tone: Tone; children: ReactNode; pulse?: boolean; className?: string }) {
  return (
    <span
      className={cn(
        "inline-flex h-6 w-fit select-none items-center gap-1.5 whitespace-nowrap rounded-full border px-2.5 text-xs font-medium",
        toneClass[tone],
        className,
      )}
    >
      <span className={cn("size-1.5 rounded-full", dotClass[tone], pulse && "animate-pulse-ring")} aria-hidden="true" />
      {children}
    </span>
  )
}

const severityLabel: Record<Severity, string> = {
  Normal: "Normal",
  Info: "Info",
  Low: "Rendah",
  Medium: "Sedang",
  High: "Tinggi",
  Critical: "Kritis",
  Expired: "Kedaluwarsa",
}

const severityTone: Record<Severity, Tone> = {
  Normal: "success",
  Info: "info",
  Low: "warning",
  Medium: "warning",
  High: "high",
  Critical: "danger",
  Expired: "danger",
}

export function SeverityBadge({ severity, className }: { severity: Severity; className?: string }) {
  return (
    <Pill tone={severityTone[severity]} pulse={severity === "Critical"} className={className}>
      {severityLabel[severity]}
    </Pill>
  )
}

const statusLabels: Record<string, string> = {
  Good: "Baik",
  Warning: "Peringatan",
  Critical: "Kritis",
  Online: "Daring",
  Offline: "Luring",
  Degraded: "Menurun",
  Renewed: "Diperpanjang",
  Terminated: "Dihentikan",
  Active: "Aktif",
  Inactive: "Nonaktif",
  "Menunggu Review": "Menunggu tinjauan",
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
  const resolved = ((): Tone => {
    if (tone) return tone
    const s = status.toLowerCase()
    if (s.includes("kritis") || s.includes("critical") || s.includes("offline") || s.includes("dihentikan")) return "danger"
    if (s.includes("tinggi") || s.includes("high") || s.includes("menurun") || s.includes("degraded")) return "high"
    if (s.includes("peringatan") || s.includes("warning") || s.includes("sedang") || s.includes("rendah") || s.includes("tinjau"))
      return "warning"
    if (
      s.includes("baik") ||
      s.includes("good") ||
      s.includes("online") ||
      s.includes("aktif") ||
      s.includes("normal") ||
      s.includes("pulih") ||
      s.includes("perpanjang")
    )
      return "success"
    return "neutral"
  })()

  return (
    <Pill tone={resolved} className={className}>
      {statusLabels[status] ?? status}
    </Pill>
  )
}

// ── DataTable ───────────────────────────────────────────────────────────────
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
    <div className="w-full overflow-x-auto rounded-xl border border-border">
      <Table className="w-full">
        <TableHeader>
          <TableRow className="border-b border-border bg-muted/50 hover:bg-muted/50">
            {columns.map((col) => (
              <TableHead key={col.key} className="type-label h-10 whitespace-nowrap px-3 text-left text-muted-foreground first:pl-4 last:pr-4">
                {col.header}
              </TableHead>
            ))}
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((row) => {
            const severity = rowSeverity?.(row)
            return (
              <TableRow
                key={rowKey(row)}
                data-severity={severity}
                className={cn(
                  "relative border-b border-border/60 transition-colors last:border-0",
                  "data-[severity=Critical]:bg-danger/[0.06] data-[severity=Expired]:bg-danger/[0.06]",
                  onRowClick && "cursor-pointer outline-none hover:bg-muted/60 focus-visible:bg-muted/60",
                )}
                tabIndex={onRowClick ? 0 : undefined}
                onClick={() => onRowClick?.(row)}
                onKeyDown={(event) => {
                  if (onRowClick && (event.key === "Enter" || event.key === " ")) {
                    event.preventDefault()
                    onRowClick(row)
                  }
                }}
              >
                {columns.map((col, index) => (
                  <TableCell
                    key={col.key}
                    className={cn(
                      "type-body px-3 py-3 first:pl-4 last:pr-4",
                      index === 0 &&
                        (severity === "Critical" || severity === "Expired") &&
                        "shadow-[inset_2px_0_0_var(--status-danger)]",
                    )}
                  >
                    {col.render(row)}
                  </TableCell>
                ))}
              </TableRow>
            )
          })}
        </TableBody>
      </Table>
    </div>
  )
}

// ── FormField ───────────────────────────────────────────────────────────────
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
    <label className="form-field flex w-full flex-col gap-1.5">
      <span className="text-[12.5px] font-medium text-muted-foreground">{label}</span>
      <span className="form-control-slot w-full">{children}</span>
      {(error || hint) && (
        <span className={cn("text-xs", error ? "text-danger" : "text-muted-foreground")}>{error || hint}</span>
      )}
    </label>
  )
}

// ── ConfirmDialog ───────────────────────────────────────────────────────────
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
    <AlertDialog
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose()
      }}
    >
      <AlertDialogContent className="max-w-md rounded-2xl border border-border bg-popover p-6 shadow-2xl">
        <AlertDialogHeader>
          <AlertDialogTitle className="type-card-title">{title}</AlertDialogTitle>
          <AlertDialogDescription className="type-body mt-2 text-muted-foreground">{description}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter className="mt-6 flex justify-end gap-3">
          <AlertDialogCancel onClick={onClose}>{cancelLabel}</AlertDialogCancel>
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

// ── Toast (adapter tipis ke sonner) ─────────────────────────────────────────
export function Toast({ message, visible, onClose }: { message: string; visible: boolean; onClose: () => void }) {
  const shownRef = useRef(false)

  useEffect(() => {
    if (visible && !shownRef.current) {
      shownRef.current = true
      sonnerToast(message, { duration: 3200, onDismiss: onClose, onAutoClose: onClose })
    }
    if (!visible) shownRef.current = false
  }, [visible, message, onClose])

  return null
}

// ── EmptyState ──────────────────────────────────────────────────────────────
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
    <div
      className={cn(
        "relative flex flex-col items-center justify-center overflow-hidden rounded-[var(--radius-surface)] border border-dashed border-border bg-card/50 px-6 py-10 text-center",
        className,
      )}
    >
      <div className="bg-dots absolute inset-0 [mask-image:radial-gradient(circle,black,transparent_70%)]" aria-hidden="true" />
      <div className="relative mb-4 grid size-12 place-items-center rounded-xl border border-border bg-muted text-muted-foreground">
        <Icon size={22} />
      </div>
      <h3 className="type-card-title relative">{title}</h3>
      {description && <p className="type-body relative mt-1 max-w-sm text-muted-foreground">{description}</p>}
      {actionLabel && onAction && (
        <Button className="relative mt-4" onClick={onAction}>
          {actionLabel}
        </Button>
      )}
    </div>
  )
}

// ── Drawer ──────────────────────────────────────────────────────────────────
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
    <Sheet
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose()
      }}
    >
      <SheetContent
        side="right"
        showCloseButton={false}
        className="fixed inset-y-0 right-0 z-[101] flex w-full flex-col border-l border-border bg-popover p-0 shadow-2xl sm:max-w-md"
      >
        <span
          aria-hidden="true"
          className="pointer-events-none absolute inset-x-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent"
        />
        <SheetHeader className="flex flex-row items-center justify-between border-b border-border px-5 py-4">
          <SheetTitle className="type-card-title text-foreground">{title}</SheetTitle>
          <Button
            variant="ghost"
            size="icon-sm"
            onClick={onClose}
            aria-label="Tutup"
            className="text-muted-foreground hover:text-foreground"
          >
            <X aria-hidden="true" size={18} strokeWidth={2} />
          </Button>
        </SheetHeader>
        <div className="drawer__body flex-1 overflow-y-auto p-5">{children}</div>
        {actions && (
          <div className="flex items-center justify-end gap-3 border-t border-border bg-popover px-5 py-4">{actions}</div>
        )}
      </SheetContent>
    </Sheet>
  )
}

// ── LoadingState ────────────────────────────────────────────────────────────
export function LoadingState({ className }: { className?: string }) {
  return (
    <div
      className={cn("flex flex-col gap-3 rounded-[var(--radius-surface)] border border-border bg-card p-6", className)}
      aria-label="Memuat"
    >
      <Skeleton className="h-6 w-48 rounded-lg" />
      <Skeleton className="h-4 w-full rounded-lg" />
      <Skeleton className="h-4 w-3/4 rounded-lg" />
    </div>
  )
}

// ── ErrorState ──────────────────────────────────────────────────────────────
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
    <div
      className={cn(
        "flex flex-col items-center justify-center rounded-[var(--radius-surface)] border border-danger/30 bg-danger/[0.04] p-8 text-center",
        className,
      )}
      role="alert"
    >
      <div className="mb-4 grid size-12 place-items-center rounded-xl bg-danger/10 text-danger">
        <AlertTriangle size={22} />
      </div>
      <h3 className="type-card-title text-danger">{title}</h3>
      <p className="type-body mt-1 max-w-sm text-muted-foreground">{message}</p>
      {onRetry && (
        <Button variant="outline" className="mt-4" onClick={onRetry}>
          Coba lagi
        </Button>
      )}
    </div>
  )
}

// ── ScopeNotice ─────────────────────────────────────────────────────────────
export function ScopeNotice({ children }: { children?: ReactNode }) {
  return (
    <div role="note" className="flex gap-3 rounded-xl border border-warning/30 bg-warning/[0.06] p-4">
      <AlertTriangle size={18} className="mt-0.5 shrink-0 text-warning" aria-hidden="true" />
      <div>
        <p className="text-sm font-medium text-warning">Belum tersedia di backend SYNRA</p>
        <p className="type-body mt-1 text-muted-foreground">
          {children ??
            "Fitur ini di luar cakupan pilot. Data yang tampil di halaman ini adalah contoh dan tidak tersimpan di server."}
        </p>
      </div>
    </div>
  )
}

// ── ApiErrorBanner ──────────────────────────────────────────────────────────
export function ApiErrorBanner({ message, onRetry }: { message: string; onRetry?: () => void }) {
  if (!message) return null
  return (
    <div role="alert" className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-danger/30 bg-danger/[0.06] p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-danger" />
        <div>
          <p className="text-sm font-medium text-danger">Gagal memuat data</p>
          <p className="type-body text-muted-foreground">{message}</p>
        </div>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          Coba lagi
        </Button>
      )}
    </div>
  )
}

// ── FilterField & PageToolbar ───────────────────────────────────────────────
export function FilterField({ label, children, className }: { label: string; children: ReactNode; className?: string }) {
  return (
    <div className={cn("flex flex-col gap-1.5", className)}>
      <span className="text-[12px] font-medium text-muted-foreground">{label}</span>
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
    <div className={cn("flex w-full flex-wrap items-end justify-between gap-3", className)}>
      <div className="flex min-w-0 flex-1 flex-wrap items-end gap-3">{children}</div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}

// ── usePagination & Pagination ──────────────────────────────────────────────
export function usePagination<T>(rows: T[], pageSize = 10) {
  const [page, setPage] = useState(1)
  const totalPages = Math.max(1, Math.ceil(rows.length / pageSize))

  useEffect(() => {
    setPage((current) => Math.min(Math.max(1, current), totalPages))
  }, [rows.length, totalPages])

  const startIndex = (page - 1) * pageSize
  const endIndex = Math.min(startIndex + pageSize, rows.length)
  const paginatedRows = useMemo(() => rows.slice(startIndex, endIndex), [rows, startIndex, endIndex])

  return { page, setPage, totalPages, startIndex, endIndex, totalRows: rows.length, paginatedRows }
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
    totalRows > 0 ? `Menampilkan ${startIndex + 1}–${endIndex} dari ${totalRows} ${itemLabel}` : `Menampilkan 0 ${itemLabel}`

  const pageNumbers = (): (number | "ellipsis")[] => {
    if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1)
    if (page <= 4) return [1, 2, 3, 4, 5, "ellipsis", totalPages]
    if (page >= totalPages - 3)
      return [1, "ellipsis", totalPages - 4, totalPages - 3, totalPages - 2, totalPages - 1, totalPages]
    return [1, "ellipsis", page - 1, page, page + 1, "ellipsis", totalPages]
  }

  return (
    <nav aria-label="Navigasi paginasi" className="flex w-full flex-wrap items-center justify-between gap-3 pt-4">
      <span className="type-meta">{rangeSummary}</span>
      <div className="flex w-full items-center justify-between gap-1 sm:w-auto sm:justify-start">
        <Button variant="ghost" size="sm" disabled={page <= 1} onClick={() => onPageChange(page - 1)}>
          Sebelumnya
        </Button>
        <span className="text-xs tabular-nums text-muted-foreground sm:hidden">
          {page} / {totalPages}
        </span>
        <span className="hidden items-center gap-1 sm:flex">
        {pageNumbers().map((num, idx) =>
          num === "ellipsis" ? (
            <span key={`el-${idx}`} className="select-none px-2 text-muted-foreground">
              …
            </span>
          ) : (
            <Button
              key={num}
              variant={page === num ? "default" : "ghost"}
              size="sm"
              aria-current={page === num ? "page" : undefined}
              className={cn("min-w-8", page === num ? "font-semibold" : "font-normal")}
              onClick={() => onPageChange(num)}
            >
              {num}
            </Button>
          ),
        )}
        </span>
        <Button variant="ghost" size="sm" disabled={page >= totalPages} onClick={() => onPageChange(page + 1)}>
          Berikutnya
        </Button>
      </div>
    </nav>
  )
}
