import { ArrowRight, Clock, Layers, Pencil, Plus, Siren, Trash2 } from "lucide-react"
import { useCallback, useEffect, useState } from "react"
import { ApiError, apiFetch } from "../lib/api"
import {
  type BackendSeverity,
  type EscalationActiveDto,
  type EscalationPolicyDto,
  SEVERITY_TO_FE,
  STATUS_TO_FE,
  formatDateTime,
  formatMinutes,
  relativeTime,
} from "../lib/backend"
import { restrictedAction, useAccess } from "../lib/useAccess"
import {
  CardHeading,
  DataTable,
  Drawer,
  EmptyState,
  ErrorState,
  FormField,
  GlassCard,
  LoadingState,
  SeverityBadge,
  StatusBadge,
  type DataTableColumn,
} from "./ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

type ActiveItem = EscalationActiveDto["items"][number]
type StepDraft = { afterMinutes: string; targetLabel: string; mention: string; telegramChatId: string }

/**
 * Matriks eskalasi per severity (dari backend) dan alert terbuka yang sedang berjalan di matriks itu.
 * Backend memeriksa setiap menit: bila alert belum ditutup melewati waktu suatu tingkat,
 * pesan eskalasi dikirim ke Telegram dan tercatat di timeline alert.
 */
export function EscalationMatrix({ onOpenAlert }: { onOpenAlert?: (code: string) => void }) {
  const { can } = useAccess()
  const canConfig = can("config")
  const [policies, setPolicies] = useState<EscalationPolicyDto[] | null>(null)
  const [active, setActive] = useState<EscalationActiveDto | null>(null)
  const [error, setError] = useState("")
  const [editing, setEditing] = useState<EscalationPolicyDto | null>(null)

  const load = useCallback(() => {
    Promise.all([apiFetch<EscalationPolicyDto[]>("/escalation/policies"), apiFetch<EscalationActiveDto>("/escalation/active")])
      .then(([p, a]) => {
        setPolicies(p)
        setActive(a)
        setError("")
      })
      .catch((e) => setError(e instanceof ApiError ? e.message : "Matriks eskalasi tidak dapat dimuat"))
  }, [])

  useEffect(() => {
    load()
    const timer = setInterval(load, 60_000)
    return () => clearInterval(timer)
  }, [load])

  if (error && !policies) return <ErrorState message={error} onRetry={load} />
  if (!policies || !active) return <LoadingState />

  const s = active.summary
  const columns: DataTableColumn<ActiveItem>[] = [
    {
      key: "alert",
      header: "Alert",
      render: (i) => (
        <div className="min-w-[200px] max-w-[300px] whitespace-normal">
          <p className="font-mono text-xs text-muted-foreground">{i.code}</p>
          <p className="line-clamp-2 font-medium" title={i.problem}>{i.problem}</p>
          <p className="type-meta">
            {i.asset.hostname} · {i.asset.host.name}
          </p>
        </div>
      ),
    },
    { key: "sev", header: "Severity", render: (i) => <SeverityBadge severity={SEVERITY_TO_FE[i.severity]} /> },
    { key: "status", header: "Status", render: (i) => <StatusBadge status={STATUS_TO_FE[i.status]} /> },
    {
      key: "level",
      header: "Eskalasi",
      render: (i) =>
        i.escalationLevel ? (
          <div className="min-w-[130px] whitespace-normal">
            <p className="font-medium text-high">Tingkat {i.escalationLevel}</p>
            <p className="type-meta truncate">{i.currentTarget}</p>
          </div>
        ) : (
          <span className="text-muted-foreground">Belum</span>
        ),
    },
    {
      key: "next",
      header: "Berikutnya",
      render: (i) =>
        i.next && i.conditionActive ? (
          <div className="min-w-[110px] whitespace-normal">
            <p className="whitespace-nowrap">{relativeTime(i.next.at)}</p>
            <p className="type-meta truncate">{i.next.targetLabel}</p>
          </div>
        ) : (
          <span className="text-muted-foreground">{i.conditionActive ? "—" : "Kondisi pulih"}</span>
        ),
    },
    {
      key: "sla",
      header: "SLA",
      render: (i) => (
        <div className="flex min-w-[110px] flex-col gap-1 whitespace-nowrap text-xs">
          <span className={i.ackBreached ? "font-medium text-danger" : "text-muted-foreground"}>
            Respon {i.ackBreached ? "terlewati" : relativeTime(i.ackDueAt)}
          </span>
          <span className={i.resolveBreached ? "font-medium text-danger" : "text-muted-foreground"}>
            Selesai {i.resolveBreached ? "terlewati" : relativeTime(i.resolveDueAt)}
          </span>
        </div>
      ),
    },
  ]

  return (
    <div className="flex min-w-0 flex-col gap-6">
      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        {[
          ["Alert terbuka", String(s.open), ""],
          ["Sedang dieskalasi", String(s.escalated), s.escalated ? "text-high" : ""],
          ["SLA respon terlewati", String(s.ackBreached), s.ackBreached ? "text-danger" : ""],
          ["Kepatuhan SLA 30 hari", s.resolveCompliancePct === null ? "—" : `${s.resolveCompliancePct.toLocaleString("id-ID")}%`, ""],
        ].map(([label, value, tone]) => (
          <GlassCard key={label} className="flex min-w-0 flex-col justify-center p-4">
            <p className="type-label truncate text-muted-foreground">{label}</p>
            <p className={cn("mt-1 text-2xl font-semibold tabular-nums", tone)}>{value}</p>
            {label === "Kepatuhan SLA 30 hari" && (
              <p className="type-meta truncate">
                {s.closed30d} alert ditutup · respon {s.ackCompliancePct === null ? "—" : `${s.ackCompliancePct.toLocaleString("id-ID")}%`}
              </p>
            )}
          </GlassCard>
        ))}
      </div>

      <GlassCard className="flex min-w-0 flex-col gap-4 p-5">
        <CardHeading
          icon={Layers}
          title="Matriks Eskalasi"
          description="Diperiksa setiap menit. Alert yang belum ditutup naik tingkat sesuai waktu sejak terdeteksi."
        />
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 xl:grid-cols-5">
          {policies.map((p) => (
            <div
              key={p.severity}
              className={cn("flex min-w-0 flex-col rounded-xl border border-border bg-muted/40 p-4", !p.enabled && "opacity-60")}
            >
              <div className="flex items-center justify-between gap-2">
                <SeverityBadge severity={SEVERITY_TO_FE[p.severity]} />
                {canConfig && (
                  <Button size="icon-sm" variant="ghost" aria-label={`Ubah matriks ${p.severity}`} onClick={() => setEditing(p)}>
                    <Pencil />
                  </Button>
                )}
              </div>
              <dl className="mt-3 flex flex-col gap-1.5 text-sm">
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Respon</dt>
                  <dd className="text-right font-medium">{formatMinutes(p.ackMinutes)}</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="text-muted-foreground">Selesai</dt>
                  <dd className="text-right font-medium">{formatMinutes(p.resolveMinutes)}</dd>
                </div>
              </dl>
              <div className="mt-3 border-t border-border pt-3">
                {!p.enabled ? (
                  <p className="type-meta">Eskalasi nonaktif</p>
                ) : p.steps.length === 0 ? (
                  <p className="type-meta">Tanpa tingkat eskalasi</p>
                ) : (
                  <ol className="flex flex-col gap-2">
                    {p.steps.map((step) => (
                      <li key={step.level} className="flex min-w-0 items-start gap-2 text-sm">
                        <span className="mt-0.5 grid size-5 shrink-0 place-items-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">
                          {step.level}
                        </span>
                        <div className="min-w-0">
                          <p className="truncate font-medium" title={step.targetLabel}>
                            {step.targetLabel}
                          </p>
                          <p className="type-meta truncate">
                            setelah {formatMinutes(step.afterMinutes)}
                            {step.mention ? ` · ${step.mention}` : ""}
                          </p>
                        </div>
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          ))}
        </div>
      </GlassCard>

      <GlassCard className="flex min-w-0 flex-col gap-4 p-5">
        <CardHeading icon={Siren} title="Eskalasi Berjalan" description="Alert terbuka, yang melewati SLA ditampilkan paling atas" />
        {active.items.length === 0 ? (
          <EmptyState icon={Clock} title="Tidak ada alert terbuka" description="Semua alert sudah ditutup." />
        ) : (
          <DataTable
            columns={columns}
            rows={active.items.slice(0, 50)}
            rowKey={(i) => i.id}
            rowSeverity={(i) => (i.resolveBreached ? "Critical" : undefined)}
            onRowClick={onOpenAlert ? (i) => onOpenAlert(i.code) : undefined}
          />
        )}
      </GlassCard>

      <PolicyEditor
        policy={editing}
        onClose={() => setEditing(null)}
        onSaved={() => {
          setEditing(null)
          load()
        }}
      />
    </div>
  )
}

function PolicyEditor({ policy, onClose, onSaved }: { policy: EscalationPolicyDto | null; onClose: () => void; onSaved: () => void }) {
  const { can } = useAccess()
  const [ack, setAck] = useState("")
  const [resolve, setResolve] = useState("")
  const [enabled, setEnabled] = useState(true)
  const [steps, setSteps] = useState<StepDraft[]>([])
  const [errors, setErrors] = useState<string[]>([])
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!policy) return
    setAck(String(policy.ackMinutes))
    setResolve(String(policy.resolveMinutes))
    setEnabled(policy.enabled)
    setSteps(
      policy.steps.map((s) => ({
        afterMinutes: String(s.afterMinutes),
        targetLabel: s.targetLabel,
        mention: s.mention ?? "",
        telegramChatId: s.telegramChatId ?? "",
      })),
    )
    setErrors([])
  }, [policy])

  const update = (index: number, patch: Partial<StepDraft>) => setSteps((list) => list.map((s, i) => (i === index ? { ...s, ...patch } : s)))

  const save = async () => {
    if (!policy) return
    setSaving(true)
    setErrors([])
    try {
      await apiFetch(`/escalation/policies/${policy.severity}`, {
        method: "PUT",
        body: JSON.stringify({
          ackMinutes: Number(ack),
          resolveMinutes: Number(resolve),
          enabled,
          steps: steps.map((s) => ({
            afterMinutes: Number(s.afterMinutes),
            targetLabel: s.targetLabel,
            mention: s.mention.trim() || null,
            telegramChatId: s.telegramChatId.trim() || null,
          })),
        }),
      })
      onSaved()
    } catch (e) {
      setErrors(e instanceof ApiError ? (e.errors.length ? e.errors : [e.message]) : ["Gagal menyimpan matriks"])
    } finally {
      setSaving(false)
    }
  }

  const severity = policy?.severity as BackendSeverity | undefined
  return (
    <Drawer
      open={Boolean(policy)}
      title={severity ? `Matriks eskalasi · ${SEVERITY_TO_FE[severity]}` : ""}
      onClose={onClose}
      actions={
        <>
          <Button variant="outline" onClick={onClose}>
            Batal
          </Button>
          <Button onClick={() => void save()} {...restrictedAction(can("config") && !saving)}>
            {saving ? "Menyimpan…" : "Simpan"}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-5">
        <div className="flex items-center justify-between gap-3 rounded-xl border border-border bg-muted/40 p-3">
          <span>
            <span className="block text-sm font-medium">Eskalasi aktif</span>
            <span className="type-meta">Bila nonaktif, SLA tetap dihitung tetapi pesan eskalasi tidak dikirim.</span>
          </span>
          <button
            type="button"
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled((v) => !v)}
            className={cn(
              "relative h-6 w-11 shrink-0 rounded-full border transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              enabled ? "border-primary bg-primary" : "border-border bg-muted",
            )}
          >
            <span
              className={cn(
                "absolute top-0.5 size-[18px] rounded-full bg-white shadow transition-transform",
                enabled ? "translate-x-[22px]" : "translate-x-0.5",
              )}
            />
          </button>
        </div>
        <div className="grid grid-cols-2 gap-3">
          <FormField label="Batas respon (menit)">
            <Input type="number" min={1} value={ack} onChange={(e) => setAck(e.target.value)} />
          </FormField>
          <FormField label="Batas selesai (menit)">
            <Input type="number" min={1} value={resolve} onChange={(e) => setResolve(e.target.value)} />
          </FormField>
        </div>
        <p className="type-meta -mt-3">
          Respon = alert harus diakui. Selesai = alert harus ditutup. Dihitung sejak alert terdeteksi.
        </p>

        <div className="flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium">Tingkat eskalasi</p>
            <Button
              size="sm"
              variant="outline"
              disabled={steps.length >= 6}
              onClick={() => setSteps((list) => [...list, { afterMinutes: "", targetLabel: "", mention: "", telegramChatId: "" }])}
            >
              <Plus /> Tambah tingkat
            </Button>
          </div>
          {steps.length === 0 && <p className="type-meta">Belum ada tingkat. Alert hanya dinotifikasi saat dibuat.</p>}
          {steps.map((step, index) => (
            <div key={index} className="flex flex-col gap-3 rounded-xl border border-border p-3">
              <div className="flex items-center justify-between">
                <span className="inline-flex items-center gap-2 text-sm font-medium">
                  <span className="grid size-5 place-items-center rounded-full bg-primary/15 text-[11px] font-semibold text-primary">{index + 1}</span>
                  Tingkat {index + 1}
                  {index > 0 && <ArrowRight size={12} className="text-muted-foreground" />}
                </span>
                <Button size="icon-sm" variant="ghost" aria-label={`Hapus tingkat ${index + 1}`} onClick={() => setSteps((list) => list.filter((_, i) => i !== index))}>
                  <Trash2 />
                </Button>
              </div>
              <div className="grid grid-cols-[110px_minmax(0,1fr)] gap-3">
                <FormField label="Setelah (menit)">
                  <Input type="number" min={1} value={step.afterMinutes} onChange={(e) => update(index, { afterMinutes: e.target.value })} />
                </FormField>
                <FormField label="Tujuan">
                  <Input value={step.targetLabel} onChange={(e) => update(index, { targetLabel: e.target.value })} placeholder="Mis. Supervisor NOC" />
                </FormField>
              </div>
              <FormField label="Mention Telegram (opsional)">
                <Input value={step.mention} onChange={(e) => update(index, { mention: e.target.value })} placeholder="@budi_noc @sari_infra" />
              </FormField>
              <FormField label="Chat ID tambahan (opsional)">
                <Input
                  value={step.telegramChatId}
                  onChange={(e) => update(index, { telegramChatId: e.target.value })}
                  placeholder="Kosong = grup utama"
                />
              </FormField>
            </div>
          ))}
        </div>

        {errors.length > 0 && (
          <ul className="flex flex-col gap-1 rounded-xl border border-danger/30 bg-danger/[0.06] p-3 text-xs text-danger" role="alert">
            {errors.map((e) => (
              <li key={e}>{e}</li>
            ))}
          </ul>
        )}
      </div>
    </Drawer>
  )
}
