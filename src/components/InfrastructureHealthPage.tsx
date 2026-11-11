import { HeartPulse } from "lucide-react"
import { motion } from "motion/react"
import { CardHeading, GlassCard, ScopeNotice, StatusBadge } from "./ui"
import { cn } from "@/lib/utils"

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

const statusTone = { Baik: "success", Peringatan: "warning", Kritis: "danger" } as const
const TOTAL = 80

export default function InfrastructureHealthPage() {
  const circumference = 2 * Math.PI * 52
  return (
    <div className="flex min-w-0 flex-col gap-6">
      <ScopeNotice>Health score tidak termasuk cakupan SYNRA. Angka di halaman ini adalah ilustrasi.</ScopeNotice>

      <div className="grid min-w-0 gap-6 lg:grid-cols-[minmax(0,340px)_minmax(0,1fr)]">
        <GlassCard className="flex flex-col items-center gap-4 p-6 text-center">
          <div className="relative size-40">
            <svg viewBox="0 0 120 120" className="size-full -rotate-90">
              <circle cx="60" cy="60" r="52" fill="none" stroke="var(--muted)" strokeWidth="10" />
              <motion.circle
                cx="60"
                cy="60"
                r="52"
                fill="none"
                stroke="var(--status-success)"
                strokeWidth="10"
                strokeLinecap="round"
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset: circumference * (1 - TOTAL / 100) }}
                transition={{ duration: 1.2, ease: "easeOut" }}
              />
            </svg>
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <span className="text-4xl font-semibold tracking-tight">{TOTAL}</span>
              <span className="type-meta">dari 100</span>
            </div>
          </div>
          <StatusBadge status="Baik" tone="success" />
          <p className="type-body text-muted-foreground">
            Kondisi infrastruktur stabil dengan perhatian pada kapasitas, pencadangan, dan siklus hidup.
          </p>
        </GlassCard>

        <GlassCard className="flex min-w-0 flex-col gap-5 p-5 md:p-6">
          <CardHeading icon={HeartPulse} title="Rincian Kesehatan Infrastruktur" description="7 dimensi berbobot" />
          <ul className="flex flex-col gap-4">
            {healthDimensions.map((dimension, index) => (
              <li key={dimension.name} className="min-w-0">
                <div className="mb-1.5 flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-medium">{dimension.name}</span>
                  <span className="flex items-center gap-3">
                    <span className="text-xs text-muted-foreground">bobot {dimension.weight}%</span>
                    <StatusBadge status={dimension.status} tone={statusTone[dimension.status]} />
                  </span>
                </div>
                <div className="flex items-center gap-3">
                  <div className="h-2 flex-1 overflow-hidden rounded-full bg-muted">
                    <motion.div
                      className={cn("h-full rounded-full", dimension.score >= 80 ? "bg-success" : dimension.score >= 60 ? "bg-warning" : "bg-danger")}
                      initial={{ width: 0 }}
                      animate={{ width: `${dimension.score}%` }}
                      transition={{ duration: 0.8, delay: index * 0.06 }}
                    />
                  </div>
                  <span className="w-8 text-right text-sm font-semibold tabular-nums">{dimension.score}</span>
                </div>
              </li>
            ))}
          </ul>
        </GlassCard>
      </div>
    </div>
  )
}
