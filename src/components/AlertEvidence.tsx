import { FileImage, FileText, ShieldCheck, Upload } from "lucide-react"
import { useRef, useState } from "react"
import { ApiError, apiFetch, apiOpenFile } from "../lib/api"
import { type AlertAttachmentDto, formatBytes, formatDateTime } from "../lib/backend"
import { CardHeading, GlassCard } from "./ui"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

const ACCEPT = ".png,.jpg,.jpeg,.webp,.pdf,.txt,.log,.csv"
const MAX_BYTES = 10 * 1024 * 1024
const MAX_FILES = 5

/**
 * Lampiran bukti remediasi: screenshot, log, atau PDF hasil perbaikan.
 * Diunggah saat alert masih terbuka; lampiran tidak bisa dihapus agar bukti tetap utuh.
 */
export function AlertEvidence({
  alertApiId,
  attachments,
  canUpload,
  onUploaded,
}: {
  alertApiId: string
  attachments: AlertAttachmentDto[]
  canUpload: boolean
  onUploaded: (count: number) => void
}) {
  const inputRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")

  const upload = async (list: FileList | File[]) => {
    const files = [...list]
    if (files.length === 0) return
    if (files.length > MAX_FILES) return setError(`Maksimal ${MAX_FILES} file sekali unggah.`)
    const tooBig = files.find((f) => f.size > MAX_BYTES)
    if (tooBig) return setError(`"${tooBig.name}" lebih dari 10 MB.`)
    const badType = files.find((f) => !ACCEPT.split(",").some((ext) => f.name.toLowerCase().endsWith(ext)))
    if (badType) return setError(`"${badType.name}" tidak didukung. Gunakan PNG, JPG, WEBP, PDF, TXT, LOG, atau CSV.`)

    const body = new FormData()
    files.forEach((f) => body.append("files", f))
    setBusy(true)
    setError("")
    try {
      await apiFetch(`/alerts/${alertApiId}/attachments`, { method: "POST", body })
      onUploaded(files.length)
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal mengunggah lampiran")
    } finally {
      setBusy(false)
      if (inputRef.current) inputRef.current.value = ""
    }
  }

  const open = (a: AlertAttachmentDto) => {
    const inline = a.mimeType.startsWith("image/") || a.mimeType === "application/pdf"
    apiOpenFile(`/alerts/${alertApiId}/attachments/${a.id}`, a.fileName, inline).catch((e) =>
      setError(e instanceof ApiError ? e.message : "Gagal membuka lampiran"),
    )
  }

  return (
    <GlassCard className="min-w-0 p-5 md:p-6">
      <CardHeading
        title="Bukti Remediasi"
        description={attachments.length ? `${attachments.length} lampiran` : "Screenshot, log, atau dokumen hasil perbaikan"}
        className="mb-4"
      />

      {canUpload && (
        <div
          role="button"
          tabIndex={0}
          aria-label="Unggah lampiran bukti remediasi"
          onClick={() => !busy && inputRef.current?.click()}
          onKeyDown={(e) => (e.key === "Enter" || e.key === " ") && inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={(e) => {
            e.preventDefault()
            setDragging(false)
            if (!busy) void upload(e.dataTransfer.files)
          }}
          className={cn(
            "mb-4 flex cursor-pointer flex-col items-center gap-2 rounded-xl border border-dashed border-border bg-muted/30 px-4 py-6 text-center transition-colors",
            "hover:border-primary/50 hover:bg-primary/[0.04] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
            dragging && "border-primary bg-primary/[0.08]",
            busy && "pointer-events-none opacity-60",
          )}
        >
          <Upload size={20} className="text-primary" aria-hidden="true" />
          <p className="text-sm font-medium">{busy ? "Mengunggah…" : "Tarik file ke sini atau klik untuk memilih"}</p>
          <p className="type-meta">PNG, JPG, WEBP, PDF, TXT, LOG, CSV · maks. 10 MB per file · 5 file sekali unggah</p>
          <input
            ref={inputRef}
            type="file"
            multiple
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => e.target.files && void upload(e.target.files)}
          />
        </div>
      )}

      {error && (
        <p className="mb-3 text-xs text-danger" role="alert">
          {error}
        </p>
      )}

      {attachments.length === 0 ? (
        <p className="type-meta">Belum ada lampiran.</p>
      ) : (
        <ul className="flex flex-col gap-2">
          {attachments.map((a) => {
            const Icon = a.mimeType.startsWith("image/") ? FileImage : FileText
            return (
              <li key={a.id} className="flex min-w-0 items-center gap-3 rounded-lg border border-border bg-muted/30 px-3 py-2.5">
                <Icon size={18} className="shrink-0 text-muted-foreground" aria-hidden="true" />
                <div className="min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() => open(a)}
                    className="block max-w-full truncate text-left text-sm font-medium text-foreground hover:text-primary hover:underline"
                    title={a.fileName}
                  >
                    {a.fileName}
                  </button>
                  <p className="type-meta truncate">
                    {formatBytes(a.sizeBytes)} · {a.uploadedByName} · {formatDateTime(a.createdAt)}
                  </p>
                </div>
                <span className="hidden shrink-0 items-center gap-1 text-[11px] text-muted-foreground sm:inline-flex" title={`SHA-256 ${a.sha256}`}>
                  <ShieldCheck size={12} aria-hidden="true" /> {a.sha256.slice(0, 8)}
                </span>
                <Button size="sm" variant="ghost" onClick={() => open(a)}>
                  Buka
                </Button>
              </li>
            )
          })}
        </ul>
      )}
    </GlassCard>
  )
}
