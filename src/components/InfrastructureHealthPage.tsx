import { GlassCard, ScopeNotice, StatusBadge } from "./ui"

type HealthStatus = "Baik" | "Peringatan" | "Kritis"

interface HealthDimension {
  name: string
  weight: number
  score: number
  status: HealthStatus
}

// TODO: Ganti data sementara ini dengan sumber Health Score asli saat endpoint tersedia.
const healthDimensions: HealthDimension[] = [
  { name: "Ketersediaan layanan", weight: 20, score: 92, status: "Baik" },
  { name: "Performa komputasi", weight: 15, score: 84, status: "Baik" },
  { name: "Kapasitas penyimpanan", weight: 15, score: 76, status: "Peringatan" },
  { name: "Kesehatan basis data", weight: 15, score: 82, status: "Baik" },
  { name: "Keamanan infrastruktur", weight: 15, score: 86, status: "Baik" },
  { name: "Keandalan pencadangan", weight: 10, score: 71, status: "Peringatan" },
  { name: "Kepatuhan siklus hidup", weight: 10, score: 73, status: "Peringatan" },
]

const statusTone = {
  Baik: "success",
  Peringatan: "warning",
  Kritis: "danger",
} as const

export default function InfrastructureHealthPage() {
  return (
    <div className="health-page">
      <ScopeNotice>Health score tidak termasuk cakupan SYNRA. Angka di halaman ini adalah ilustrasi.</ScopeNotice>
      <GlassCard className="health-score-summary">
        <div>
          <span className="pretext">SKOR TOTAL</span>
          <strong className="health-score-summary__value">80</strong>
        </div>
        <div>
          <span className="label text-muted">Status infrastruktur</span>
          <StatusBadge status="Baik" tone="success" />
          <p className="bodycopy text-muted">
            Kondisi infrastruktur stabil dengan perhatian pada kapasitas,
            pencadangan, dan siklus hidup.
          </p>
        </div>
      </GlassCard>

      <GlassCard className="health-dimensions">
        <div className="section-heading">
          <span className="pretext">7 DIMENSI BERBOBOT</span>
          <h3 className="title-h3">Rincian Kesehatan Infrastruktur</h3>
        </div>
        <div className="table-wrap">
          <table className="data-table">
            <thead>
              <tr>
                <th>Dimensi</th>
                <th>Bobot</th>
                <th>Skor</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              {healthDimensions.map((dimension) => (
                <tr key={dimension.name}>
                  <td className="strong">{dimension.name}</td>
                  <td>{dimension.weight}%</td>
                  <td>{dimension.score}</td>
                  <td>
                    <StatusBadge
                      status={dimension.status}
                      tone={statusTone[dimension.status]}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </GlassCard>
    </div>
  )
}
