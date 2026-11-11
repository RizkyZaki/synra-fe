import { CircleCheck, CircleDashed, History, Send } from "lucide-react"
import { useState } from "react"
import { restrictedAction, useAccess } from "../lib/useAccess"
import { useSynraStore } from "../lib/useSynraStore"
import { ApiError } from "../lib/api"
import type { NotificationItem } from "../lib/synraDomain"
import { EscalationMatrix } from "./EscalationMatrix"
import {
  ApiErrorBanner,
  CardHeading,
  DataTable,
  GlassCard,
  Pagination,
  StatusBadge,
  Toast,
  usePagination,
  type DataTableColumn,
} from "./ui"
import { Button } from "@/components/ui/button"
import { SpotlightCard } from "@/components/aceternity/spotlight-card"
import { cn } from "@/lib/utils"

/** Ikon Telegram sederhana (pesawat kertas). */
function TelegramMark() {
  return (
    <span className="grid size-12 shrink-0 place-items-center rounded-2xl bg-gradient-to-br from-[#37aee2] to-[#1e96c8] text-white shadow-[0_8px_24px_-8px_rgb(55_174_226/70%)]">
      <Send size={20} className="-translate-x-px translate-y-px" />
    </span>
  )
}

export default function NotificationEscalationPage() {
  const { read, actions, api, error } = useSynraStore()
  const { can } = useAccess()
  const canConfig = can("config")
  const notifications = read("notifications")
  const { page, setPage, totalPages, startIndex, endIndex, totalRows, paginatedRows } = usePagination(notifications, 10)
  const [toast, setToast] = useState("")
  const [sending, setSending] = useState(false)
  const configured = api.telegramConfigured === true

  const sendTest = async () => {
    if (!canConfig) return
    setSending(true)
    try {
      await actions.sendTestNotification()
      setToast("Pesan uji terkirim ke Telegram")
    } catch (e) {
      setToast(e instanceof ApiError ? e.message : "Gagal mengirim pesan uji")
    } finally {
      setSending(false)
    }
  }

  const columns: DataTableColumn<NotificationItem>[] = [
    { key: "time", header: "Waktu", render: (item) => <span className="whitespace-nowrap text-muted-foreground">{item.time}</span> },
    { key: "title", header: "Notifikasi", render: (item) => <strong className="font-medium">{item.title}</strong> },
    { key: "channel", header: "Kanal", render: (item) => item.channel },
    { key: "target", header: "Tujuan", render: (item) => item.target },
    {
      key: "status",
      header: "Status",
      render: (item) => (
        <StatusBadge
          status={item.status}
          tone={item.status === "Terkirim" ? "success" : item.status === "Gagal" ? "danger" : "warning"}
        />
      ),
    },
  ]

  const sent = notifications.filter((item) => item.status === "Terkirim").length
  const failed = notifications.filter((item) => item.status === "Gagal").length

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <ApiErrorBanner message={error} />

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <SpotlightCard className="p-5 md:p-6">
          <div className="flex flex-col gap-5 sm:flex-row sm:items-start">
            <TelegramMark />
            <div className="min-w-0 flex-1">
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="type-card-title">Notifikasi Telegram</h3>
                <span
                  className={cn(
                    "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium",
                    configured ? "border-success/30 bg-success/10 text-success" : "border-border bg-muted text-muted-foreground",
                  )}
                >
                  {configured ? <CircleCheck size={12} /> : <CircleDashed size={12} />}
                  {configured ? "Terhubung" : api.telegramConfigured === false ? "Belum dikonfigurasi" : "Memeriksa"}
                </span>
              </div>
              <p className="type-body mt-1.5 text-muted-foreground">
                Dikirim otomatis saat alert dibuat, setiap perubahan status, dan saat alert naik tingkat eskalasi.
                {api.telegramConfigured === false &&
                  " Isi TELEGRAM_BOT_TOKEN dan TELEGRAM_CHAT_ID di server; sampai saat itu notifikasi tercatat sebagai dilewati."}
              </p>
              <Button
                className="mt-4"
                onClick={() => void sendTest()}
                {...restrictedAction(canConfig && configured && !sending)}
              >
                <Send /> {sending ? "Mengirim…" : "Kirim Pesan Uji"}
              </Button>
            </div>
          </div>
        </SpotlightCard>

        <div className="grid grid-cols-3 gap-3">
          {[
            ["Total", notifications.length, ""],
            ["Terkirim", sent, "text-success"],
            ["Gagal", failed, failed ? "text-danger" : ""],
          ].map(([label, value, tone]) => (
            <GlassCard key={label as string} className="flex min-w-0 flex-col justify-center p-4">
              <p className="type-label text-muted-foreground">{label}</p>
              <p className={cn("mt-1 text-2xl font-semibold tabular-nums", tone as string)}>{value}</p>
            </GlassCard>
          ))}
        </div>
      </div>

      <EscalationMatrix />

      <GlassCard className="flex min-w-0 flex-col gap-4 p-5">
        <CardHeading icon={History} title="Riwayat Notifikasi" description={`${notifications.length} notifikasi`} />
        {notifications.length === 0 ? (
          <p className="type-meta">Belum ada notifikasi.</p>
        ) : (
          <>
            <DataTable columns={columns} rows={paginatedRows} rowKey={(item) => item.id} />
            <Pagination
              page={page}
              totalPages={totalPages}
              totalRows={totalRows}
              startIndex={startIndex}
              endIndex={endIndex}
              onPageChange={setPage}
              itemLabel="notifikasi"
            />
          </>
        )}
      </GlassCard>

      <Toast visible={Boolean(toast)} message={toast} onClose={() => setToast("")} />
    </div>
  )
}
