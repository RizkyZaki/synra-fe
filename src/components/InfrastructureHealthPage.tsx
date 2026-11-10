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
          <span className="type-label text-muted-foreground">SKOR TOTAL</span>
          <strong className="health-score-summary__value">80</strong>
        </div>
        <div>
          <span className="type-meta text-muted-foreground">Status infrastruktur</span>
          <StatusBadge status="Baik" tone="success" />
          <p className="type-body text-muted-foreground">
            Kondisi infrastruktur stabil dengan perhatian pada kapasitas,
            pencadangan, dan siklus hidup.
          </p>
        </div>
      </GlassCard>

      <GlassCard className="health-dimensions">
        <div className="section-heading mb-4">
          <span className="type-label text-muted-foreground">7 DIMENSI BERBOBOT</span>
          <h3 className="type-card-title">Rincian Kesehatan Infrastruktur</h3>
        </div>
        <div className="table-wrap overflow-x-auto">
          <table className="data-table w-full">
            <thead>
              <tr className="border-b border-border">
                <th className="type-label text-muted-foreground text-left py-2 px-3">Dimensi</th>
                <th className="type-label text-muted-foreground text-left py-2 px-3">Bobot</th>
                <th className="type-label text-muted-foreground text-left py-2 px-3">Skor</th>
                <th className="type-label text-muted-foreground text-left py-2 px-3">Status</th>
              </tr>
            </thead>
            <tbody>
              {healthDimensions.map((dimension) => (
                <tr key={dimension.name} className="border-b border-border/50">
                  <td className="type-body font-medium py-2.5 px-3">{dimension.name}</td>
                  <td className="type-body py-2.5 px-3">{dimension.weight}%</td>
                  <td className="type-body py-2.5 px-3">{dimension.score}</td>
                  <td className="type-body py-2.5 px-3">
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
