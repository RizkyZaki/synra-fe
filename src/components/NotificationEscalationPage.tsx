import { useState } from "react"
import { createAuditEntry } from "../lib/audit"
import { restrictedAction, useAccess } from "../lib/useAccess"
import { useSynraStore } from "../lib/useSynraStore"
import type {
  AlertItem,
  NotificationItem,
  Severity,
} from "../lib/synraDomain"
import { DataTable, GlassCard, StatusBadge, Toast, type DataTableColumn } from "./ui"

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

const severityRank: Record<Severity, number> = {
  Normal: 0,
  Info: 1,
  Low: 2,
  Medium: 3,
  High: 4,
  Critical: 5,
  Expired: 6,
}

function notificationTarget(alert: AlertItem) {
  return (
    slaMatrix.find((item) => item.severity === alert.severity)?.target ??
    alert.pic
  )
}

export default function NotificationEscalationPage() {
  const { read, add } = useSynraStore()
  const { user, can } = useAccess()
  const canEdit = can("edit")
  const notifications = read("notifications")
  const alerts = read("alerts")
  const [toast, setToast] = useState("")

  const highestOpenAlert = [...alerts]
    .filter((alert) => alert.status !== "Ditutup")
    .sort(
      (a, b) => severityRank[b.severity] - severityRank[a.severity],
    )[0]

  const logAudit = (action: string, target: string, detail: string) =>
    add(
      "audit",
      createAuditEntry(read("audit"), user, action, target, detail),
    )

  const createNotification = (
    alert: AlertItem,
    title: string,
  ): NotificationItem => {
    const nextNumber =
      Math.max(
        0,
        ...read("notifications").map(
          (item) => Number(item.id.replace(/\D/g, "")) || 0,
        ),
      ) + 1
    return {
      id: `NTF-${String(nextNumber).padStart(3, "0")}`,
      title,
      channel: alert.severity === "Info" ? "Dashboard" : "Email",
      target: notificationTarget(alert),
      time: new Date().toISOString(),
      status: "Terkirim",
    }
  }

  const sendNotification = () => {
    if (!canEdit) return

    if (!highestOpenAlert) {
      setToast("Tidak ada alert terbuka untuk dinotifikasikan")
      return
    }
    const notification = createNotification(
      highestOpenAlert,
      `${highestOpenAlert.severity}: ${highestOpenAlert.name}`,
    )
    add("notifications", notification)
    logAudit(
      "Notifikasi dikirim",
      notification.id,
      `${notification.title} → ${notification.target}`,
    )
    setToast("Notifikasi berhasil dikirim")
  }

  const escalate = () => {
    if (!canEdit) return

    if (!highestOpenAlert) {
      setToast("Tidak ada alert terbuka untuk dieskalasi")
      return
    }
    const notification = createNotification(
      highestOpenAlert,
      `Eskalasi ${highestOpenAlert.severity}: ${highestOpenAlert.name}`,
    )
    add("notifications", notification)
    logAudit(
      "Alert dieskalasi",
      highestOpenAlert.id,
      `${notification.title} → ${notification.target}`,
    )
    setToast("Eskalasi berhasil dikirim")
  }

  const columns: DataTableColumn<NotificationItem>[] = [
    { key: "id", header: "ID", render: (item) => item.id },
    {
      key: "title",
      header: "Notifikasi",
      render: (item) => <strong>{item.title}</strong>,
    },
    { key: "channel", header: "Kanal", render: (item) => item.channel },
    { key: "target", header: "Tujuan", render: (item) => item.target },
    { key: "time", header: "Waktu", render: (item) => item.time },
    {
      key: "status",
      header: "Status",
      render: (item) => <StatusBadge status={item.status} tone="success" />,
    },
  ]

  return (
    <div className="notification-page">
      <GlassCard className="notification-actions">
        <div>
          <span className="pretext">OPERASI</span>
          <h3 className="title-h3">Notifikasi & Eskalasi</h3>
          <p className="bodycopy text-muted">
            Pengiriman mengikuti severity tertinggi dari alert yang masih
            terbuka.
          </p>
        </div>
        <div>
          <button
            className="button button--secondary"
            onClick={escalate}
            {...restrictedAction(canEdit)}
          >
            Eskalasi
          </button>
          <button
            className="button button--primary"
            onClick={sendNotification}
            {...restrictedAction(canEdit)}
          >
            Kirim Notifikasi
          </button>
        </div>
      </GlassCard>

      <GlassCard className="sla-matrix">
        <div className="section-heading">
          <span className="pretext">SLA</span>
          <h3 className="title-h3">Matriks Eskalasi</h3>
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
                  <td>
                    <span
                      className={`badge ${
                        item.severity === "Critical"
                          ? "badge--danger"
                          : item.severity === "High"
                            ? "badge--high"
                            : item.severity === "Medium" ||
                                item.severity === "Low"
                              ? "badge--warning"
                              : "badge--success"
                      }`}
                    >
                      {item.severity}
                    </span>
                  </td>
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
          <span className="pretext">RIWAYAT</span>
          <h3 className="title-h3">Daftar Notifikasi</h3>
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
