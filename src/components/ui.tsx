import { ArrowLeft, X } from "lucide-react"
import {
  type ComponentProps,
  type ReactNode,
  useEffect,
  useRef,
} from "react"
import type { Severity } from "../lib/synraDomain"

export function GlassCard({
  className = "",
  children,
  ...props
}: ComponentProps<"section">) {
  return (
    <section className={`glass-card ${className}`} {...props}>
      {children}
    </section>
  )
}

export function PageHeader({
  eyebrow,
  title,
  badge,
  backTo,
  onNavigate,
  readOnly = false,
  className = "",
}: {
  eyebrow: string
  title: string
  badge?: ReactNode
  backTo?: { label: string; href: string }
  onNavigate?: (href: string) => void
  readOnly?: boolean
  className?: string
}) {
  return (
    <div className={`page-heading ${className}`}>
      <div className="page-heading__copy">
        {backTo && (
          <a
            className="page-heading__back"
            href={backTo.href}
            onClick={(event) => {
              if (!onNavigate) return
              event.preventDefault()
              onNavigate(backTo.href)
            }}
          >
            <ArrowLeft aria-hidden="true" size={16} strokeWidth={1.75} />
            {backTo.label}
          </a>
        )}
        <div>
          <span className="pretext page-heading__pretext">{eyebrow}</span>
          <div className="page-heading__title-row">
            <h2 className="title-h2">{title}</h2>
            {badge}
          </div>
          {readOnly && (
            <span className="page-heading__access">Akses baca saja</span>
          )}
        </div>
      </div>
      <div className="location-pills" />
    </div>
  )
}

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
  eyebrow: string
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

export function KpiCard({
  label,
  value,
  tag,
  tone,
  description,
  note,
  onAction,
}: {
  label: string
  value: string
  tag: string
  tone: string
  description: string
  note: string
  onAction: () => void
}) {
  return (
    <GlassCard
      className={`kpi-card kpi-card--interactive kpi-card--tone-${tone}`}
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
        <span className="small-copy">{label}</span>
      </div>
      <div className="kpi-card__value">
        <strong className="bigcopy">{value}</strong>
        <span className="kpi-card__tag">{tag}</span>
      </div>
      <div className="kpi-card__note">
        <span className="kpi-card__note-copy" title={note}>{note}</span>
        <button
          className="kpi-card__link"
          onClick={(event) => {
            event.stopPropagation()
            onAction()
          }}
        >
          Lihat
        </button>
      </div>
    </GlassCard>
  )
}

const severityConfig = {
  Normal: "badge--success",
  Info: "badge--success",
  Low: "badge--warning",
  Medium: "badge--warning",
  High: "badge--high",
  Critical: "badge--danger",
  Expired: "badge--danger",
} satisfies Record<Severity, string>

const severityLabel = {
  Normal: "Normal",
  Info: "Info",
  Low: "Rendah",
  Medium: "Sedang",
  High: "Tinggi",
  Critical: "Kritis",
  Expired: "Kedaluwarsa",
} satisfies Record<Severity, string>

export function SeverityBadge({ severity }: { severity: Severity }) {
  return (
    <span className={`badge ${severityConfig[severity]}`}>
      {severityLabel[severity]}
    </span>
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
  tone = "neutral",
}: {
  status: string
  tone?: "success" | "warning" | "danger" | "neutral"
}) {
  return (
    <span className={`badge badge--${tone}`}>
      {statusLabels[status] ?? status}
    </span>
  )
}

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
    <div className="table-wrap">
      <table className="data-table">
        <thead>
          <tr>
            {columns.map((column) => (
              <th key={column.key}>{column.header}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr
              key={rowKey(row)}
              data-severity={rowSeverity?.(row)}
              className={onRowClick ? "data-table__clickable" : undefined}
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
              {columns.map((column) => (
                <td key={column.key}>{column.render(row)}</td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  )
}

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
    <label className="form-field">
      <span className="label">{label}</span>
      <span className="form-control-slot">
        {children}
      </span>
      {(error || hint) && (
        <span className={`label ${error ? "text-danger" : "text-muted"}`}>
          {error || hint}
        </span>
      )}
    </label>
  )
}

function useFocusTrap(open: boolean, onClose: () => void) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const dialog = ref.current
    const previouslyFocused = document.activeElement as HTMLElement | null
    const selector =
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    const focusable = Array.from(
      dialog?.querySelectorAll<HTMLElement>(selector) ?? [],
    )
    focusable[0]?.focus()

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
      if (event.key !== "Tab" || focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener("keydown", onKeyDown)
    return () => {
      document.removeEventListener("keydown", onKeyDown)
      previouslyFocused?.focus()
    }
  }, [open, onClose])

  return ref
}

export function ConfirmDialog({
  open,
  title,
  description,
  confirmLabel = "Konfirmasi",
  cancelLabel = "Batal",
  onConfirm,
  onClose,
}: {
  open: boolean
  title: string
  description: string
  confirmLabel?: string
  cancelLabel?: string
  onConfirm: () => void
  onClose: () => void
}) {
  const ref = useFocusTrap(open, onClose)
  if (!open) return null

  return (
    <div className="modal-backdrop" role="presentation" onMouseDown={onClose}>
      <div
        ref={ref}
        className="dialog glass-card"
        role="dialog"
        aria-modal="true"
        aria-labelledby="dialog-title"
        onMouseDown={(event) => event.stopPropagation()}
      >
        <div>
          <h3 id="dialog-title" className="title-h3">
            {title}
          </h3>
          <p className="bodycopy text-muted">{description}</p>
        </div>
        <div className="dialog__actions">
          <button className="button button--secondary" onClick={onClose}>
            {cancelLabel}
          </button>
          <button className="button button--primary" onClick={onConfirm}>
            {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export function Toast({
  message,
  visible,
  onClose,
}: {
  message: string
  visible: boolean
  onClose: () => void
}) {
  useEffect(() => {
    if (!visible) return
    const timer = window.setTimeout(onClose, 3200)
    return () => window.clearTimeout(timer)
  }, [visible, onClose])

  return (
    <div
      className={`toast glass-card ${visible ? "toast--visible" : ""}`}
      role="status"
      aria-live="polite"
    >
      <span className="small-copy">{message}</span>
      <button className="icon-button icon-button--small" onClick={onClose}>
        <X aria-hidden="true" size={16} strokeWidth={1.75} />
        <span className="sr-only">Tutup notifikasi</span>
      </button>
    </div>
  )
}

export function EmptyState({
  title,
  description,
  actionLabel,
  onAction,
}: {
  title: string
  description: string
  actionLabel: string
  onAction: () => void
}) {
  return (
    <div className="empty-state">
      <h3 className="title-h3">{title}</h3>
      <p className="bodycopy text-muted">{description}</p>
      <button className="button button--primary" onClick={onAction}>
        {actionLabel}
      </button>
    </div>
  )
}

export function Drawer({
  open,
  title,
  children,
  onClose,
}: {
  open: boolean
  title: string
  children: ReactNode
  onClose: () => void
}) {
  useEffect(() => {
    if (!open) return
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", onKeyDown)
    return () => document.removeEventListener("keydown", onKeyDown)
  }, [open, onClose])

  return (
    <div className={`drawer-layer ${open ? "drawer-layer--open" : ""}`}>
      <button
        className="drawer-backdrop"
        aria-label="Tutup panel"
        onClick={onClose}
      />
      <aside className="drawer glass-card" aria-hidden={!open}>
        <div className="drawer__header">
          <h3 className="title-h3">{title}</h3>
          <button className="icon-button" onClick={onClose}>
            <X aria-hidden="true" size={20} strokeWidth={1.75} />
            <span className="sr-only">Tutup</span>
          </button>
        </div>
        <div className="drawer__body">
          {children}
        </div>
      </aside>
    </div>
  )
}

export function LoadingState() {
  return (
    <div className="loading-state" aria-label="Memuat">
      <div className="skeleton skeleton--title" />
      <div className="skeleton" />
      <div className="skeleton skeleton--short" />
    </div>
  )
}

export function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="empty-state">
      <h3 className="title-h3">Data tidak dapat dimuat</h3>
      <p className="bodycopy text-muted">
        Periksa koneksi sistem lalu coba kembali.
      </p>
      <button className="button button--secondary" onClick={onRetry}>
        Coba lagi
      </button>
    </div>
  )
}

/** Penanda fitur yang belum didukung backend SYNRA (di luar cakupan pilot); data di halaman adalah contoh. */
export function ScopeNotice({ children }: { children?: ReactNode }) {
  return (
    <div className="scope-notice" role="note">
      <strong className="small-copy">Belum tersedia di backend SYNRA</strong>
      <span className="label">
        {children ??
          "Fitur ini di luar cakupan pilot. Data yang tampil di halaman ini adalah contoh dan tidak tersimpan di server."}
      </span>
    </div>
  )
}

/** Banner status koneksi backend (error pemuatan data). */
export function ApiErrorBanner({ message }: { message: string }) {
  if (!message) return null
  return (
    <div className="scope-notice scope-notice--danger" role="alert">
      <strong className="small-copy">Gagal memuat data</strong>
      <span className="label">{message}</span>
    </div>
  )
}
