import { useState } from "react"
import { restrictedAction, useAccess } from "../lib/useAccess"
import { useSynraStore } from "../lib/useSynraStore"
import { ApiError } from "../lib/api"
import type { NotificationItem, Severity } from "../lib/synraDomain"
import {
  ApiErrorBanner,
  DataTable,
  Pagination,
  SeverityBadge,
  usePagination,
  GlassCard,
  ScopeNotice,
  StatusBadge,
  Toast,
  type DataTableColumn,
} from "./ui"
import { Button } from "@/components/ui/button"

const slaMatrix: Array<{
  severity: Severity
  response: string
  target: string
  escalation: string
}> = [
  {
    severity: "Info",
    response: "Dashboard",
    target: "Dashboard",
    escalation: "—",
  },
  {
    severity: "Low",
    response: "24 jam",
    target: "Engineer",
    escalation: "24 jam",
  },
  {
    severity: "Medium",
    response: "8 jam",
    target: "Supervisor",
    escalation: "8 jam",
  },
  {
    severity: "High",
    response: "2 jam",
    target: "Kepala Departemen",
    escalation: "2 jam",
  },
  {
    severity: "Critical",
    response: "15 menit",
    target: "Kepala Divisi / Manajemen",
    escalation: "15 / 30 / 60 / 120 menit",
  },
]

export default function NotificationEscalationPage() {
  const { read, actions, api, error } = useSynraStore()
  const { can } = useAccess()
  const canConfig = can("config")
  const notifications = read("notifications")
  const {
    page,
    setPage,
    totalPages,
    startIndex,
    endIndex,
    totalRows,
    paginatedRows,
  } = usePagination(notifications, 10)
  const [toast, setToast] = useState("")

  const sendTest = async () => {
    if (!canConfig) return
    try {
      await actions.sendTestNotification()
      setToast("Pesan uji terkirim ke Telegram")
    } catch (e) {
      setToast(e instanceof ApiError ? e.message : "Gagal mengirim pesan uji")
    }
  }

  const columns: DataTableColumn<NotificationItem>[] = [
    { key: "time", header: "Waktu", render: (item) => item.time },
    {
      key: "title",
      header: "Notifikasi",
      render: (item) => <strong>{item.title}</strong>,
    },
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

  return (
    <div className="notification-page">
      <ApiErrorBanner message={error} />
      <GlassCard className="notification-actions">
        <div>
          <span className="type-label text-muted-foreground">TELEGRAM</span>
          <h3 className="type-card-title">Notifikasi Telegram</h3>
          <p className="type-body text-muted-foreground">
            Dikirim otomatis saat alert dibuat dan setiap perubahan status alert.
            {api.telegramConfigured === false &&
              " Telegram belum dikonfigurasi di server (TELEGRAM_BOT_TOKEN dan TELEGRAM_CHAT_ID), sehingga notifikasi tercatat sebagai dilewati."}
          </p>
        </div>
        <div>
          <Button
            onClick={() => void sendTest()}
            {...restrictedAction(canConfig && api.telegramConfigured === true)}
          >
            Kirim Pesan Uji
          </Button>
        </div>
      </GlassCard>
      <GlassCard className="sla-matrix">
        <ScopeNotice>Eskalasi berjenjang tidak termasuk cakupan SYNRA. Matriks di bawah hanya referensi.</ScopeNotice>
        <div className="section-heading">
          <span className="type-label text-muted-foreground">SLA</span>
          <h3 className="type-card-title">Matriks Eskalasi</h3>
        </div>
        <div className="forecast-table-wrap">
          <table className="forecast-table">
            <thead>
              <tr>
                <th>Severity</th>
                <th>Respons</th>
                <th>Tujuan</th>
                <th>Eskalasi</th>
              </tr>
            </thead>
            <tbody>
              {slaMatrix.map((item) => (
                <tr key={item.severity}>
                  <td><SeverityBadge severity={item.severity} /></td>
                  <td>{item.response}</td>
                  <td>{item.target}</td>
                  <td>{item.escalation}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>

      <GlassCard className="notification-list">
        <div className="section-heading">
          <span className="type-label text-muted-foreground">RIWAYAT</span>
          <h3 className="type-card-title">Daftar Notifikasi</h3>
        </div>
        <DataTable
          columns={columns}
          rows={notifications}
          rowKey={(item) => item.id}
        />
      </GlassCard>

      <Toast
        visible={Boolean(toast)}
        message={toast}
        onClose={() => setToast("")}
      />
    </div>
  )
}
