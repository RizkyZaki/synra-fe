import {
  createContext,
  createElement,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react"
import {
  DEFAULT_EXPIRY_THRESHOLDS,
  daysUntil,
  diskSeverity,
  forecastDays,
  healthDimensions,
  lifecycleSeverity,
  roles,
  type ExpiryThresholds,
  type SynraState,
} from "./synraDomain"
import {
  ApiError,
  apiDownload,
  apiFetch,
  SESSION_EVENT,
  tokenStore,
  UNAUTHORIZED_EVENT,
} from "./api"
import {
  type AlertDto,
  type AssetDto,
  type AuditDto,
  type AvailabilityDto,
  type BackendRole,
  type AssetCategory,
  type HostDto,
  type LifecycleCategoryDto,
  type LifecycleItemDto,
  type LifecycleStatusDto,
  type RenewalDto,
  type SupervisorDto,
  type NotificationDto,
  type Paginated,
  type SummaryDto,
  type ThresholdGroupDto,
  type UserDto,
  type UtilizationDto,
  toAlert,
  toAsset,
  toAudit,
  toLifecycle,
  toNotification,
  toRenewal,
  toRules,
  toUser,
} from "./backend"

export type SynraCollection = keyof SynraState
export type SynraItem<K extends SynraCollection> = SynraState[K][number]

const REFRESH_MS = 60_000
// Versi lama menyimpan data Lifecycle contoh di browser; sekarang semua dari backend.
const LEGACY_LOCAL_KEY = "synra-local-state-v3"

const emptyRemote = (): SynraState => ({
  lifecycle: [],
  requests: [],
  assets: [],
  alerts: [],
  notifications: [],
  audit: [],
  users: [],
  rules: [],
})

export interface ApiData {
  summary: SummaryDto | null
  availability: AvailabilityDto | null
  hosts: HostDto[]
  supervisors: SupervisorDto[]
  /** Batas sisa hari per level urgensi siklus hidup (dari backend, default bila gagal dimuat). */
  expiryThresholds: ExpiryThresholds
  telegramConfigured: boolean | null
}

export interface AssetInput {
  hostname: string
  ipAddress: string
  component: string
  hostId: string
  category: AssetCategory | ""
  type: string
  picName: string
  picContact?: string
  notes?: string
  supervisorInputId?: string
  supervisorUpdateId?: string
}

export interface HostInput {
  code: string
  name: string
  region?: string
}

export interface ThresholdLevelInput {
  severity: string
  operator?: "GT" | "GTE"
  value: number
  enabled?: boolean
}

export interface LifecycleInput {
  name: string
  category: LifecycleCategoryDto
  status?: LifecycleStatusDto
  expiryDate: string
  quantity?: number
  allocated?: number
  location?: string
  picName?: string
  vendor?: string
  notes?: string
}

export type AlertTransition = "acknowledge" | "start" | "submit-review" | "return" | "close"

const seedHelpers = {
  daysUntil,
  lifecycleSeverity,
  forecastDays,
  diskSeverity,
  healthDimensions,
  roles,
} as const

interface SynraStore {
  state: SynraState
  api: ApiData
  loading: boolean
  /** Pesan error pemuatan terakhir (mis. backend tidak dapat dihubungi) */
  error: string
  refresh: () => Promise<void>
  read: <K extends SynraCollection>(collection: K) => SynraState[K]
  actions: {
    createAsset: (input: AssetInput) => Promise<void>
    updateAsset: (apiId: string, input: Partial<AssetInput> & { isActive?: boolean }) => Promise<void>
    transitionAlert: (apiId: string, action: AlertTransition, body?: { note?: string; evidence?: string }) => Promise<void>
    evaluateAlerts: () => Promise<{ created: number; updated: number }>
    createUser: (input: { username: string; fullName: string; password: string; role: BackendRole }) => Promise<void>
    updateUser: (id: string, input: { fullName?: string; role?: BackendRole; isActive?: boolean }) => Promise<void>
    unlockUser: (id: string) => Promise<void>
    updateRule: (id: string, value: number) => Promise<void>
    /** Mengganti semua level satu metrik sekaligus, supaya urutan level divalidasi sebagai satu kesatuan. */
    saveThresholds: (metric: string, levels: ThresholdLevelInput[]) => Promise<void>
    createHost: (input: HostInput) => Promise<void>
    updateHost: (id: string, input: Partial<HostInput>) => Promise<void>
    deleteHost: (id: string) => Promise<void>
    saveExpiryThresholds: (input: ExpiryThresholds) => Promise<void>
    createLifecycle: (input: LifecycleInput) => Promise<void>
    updateLifecycle: (id: string, input: Partial<LifecycleInput>) => Promise<void>
    requestRenewal: (itemId: string, note?: string) => Promise<void>
    decideRenewal: (id: string, status: "APPROVED" | "REJECTED", input?: { note?: string; newExpiryDate?: string }) => Promise<void>
    changePassword: (oldPassword: string, newPassword: string) => Promise<void>
    sendTestNotification: () => Promise<void>
    importCsv: (file: File) => Promise<{ inserted: number; invalidRows: number; errors: { row: number; message: string }[] }>
    download: (path: string, fallbackName: string) => Promise<void>
  }
  helpers: typeof seedHelpers & {
    dashboardKpi: () => {
      online: number
      totalAssets: number
      openAlerts: number
      critical: number
      warning: number
      stale: number
      availabilityPct: number | null
    }
    alertFunnel: () => Array<{ status: string; count: number }>
    assetsByType: () => Array<{ type: string; count: number; pct: number }>
  }
}

const SynraStoreContext = createContext<SynraStore | null>(null)

/** Mengambil data; 403 (role tidak berhak) dan kegagalan per-endpoint tidak menggagalkan yang lain. */
async function optional<T>(path: string): Promise<T | null> {
  try {
    return await apiFetch<T>(path)
  } catch (e) {
    if (e instanceof ApiError && (e.status === 403 || e.status === 404)) return null
    throw e
  }
}

export function SynraStoreProvider({ children }: { children: ReactNode }) {
  const [remote, setRemote] = useState(emptyRemote)
  const [api, setApi] = useState<ApiData>({
    summary: null,
    availability: null,
    hosts: [],
    supervisors: [],
    expiryThresholds: DEFAULT_EXPIRY_THRESHOLDS,
    telegramConfigured: null,
  })
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const inFlight = useRef(false)

  useEffect(() => {
    try {
      localStorage.removeItem(LEGACY_LOCAL_KEY)
    } catch {
      // Storage tidak tersedia: tidak masalah.
    }
  }, [])

  const refresh = useCallback(async () => {
    if (!tokenStore.get() || inFlight.current) return
    inFlight.current = true
    setLoading(true)
    try {
      const [assets, alerts, rules, hosts, summary, availability, notifications, notifStatus, users, audit, supervisors, lifecycle, renewals, expiryThresholds] =
        await Promise.all([
          apiFetch<Paginated<AssetDto>>("/assets?limit=100"),
          apiFetch<Paginated<AlertDto>>("/alerts?limit=100"),
          apiFetch<ThresholdGroupDto[]>("/thresholds"),
          apiFetch<HostDto[]>("/hosts"),
          apiFetch<SummaryDto>("/dashboard/summary"),
          apiFetch<AvailabilityDto>("/dashboard/availability"),
          apiFetch<Paginated<NotificationDto>>("/notifications?limit=100"),
          optional<{ telegramConfigured: boolean }>("/notifications/status"),
          optional<Paginated<UserDto>>("/users?limit=100"),
          optional<Paginated<AuditDto>>("/audit-logs?limit=100"),
          optional<SupervisorDto[]>("/users/supervisors"),
          optional<Paginated<LifecycleItemDto>>("/lifecycle?limit=100"),
          optional<Paginated<RenewalDto>>("/lifecycle/renewals?limit=100"),
          optional<ExpiryThresholds>("/lifecycle/thresholds"),
        ])
      setRemote({
        lifecycle: lifecycle?.data.map(toLifecycle) ?? [],
        requests: renewals?.data.map(toRenewal) ?? [],
        assets: assets.data.map(toAsset),
        alerts: alerts.data.map(toAlert),
        rules: toRules(rules),
        notifications: notifications.data.map(toNotification),
        users: users?.data.map(toUser) ?? [],
        audit: audit?.data.map(toAudit) ?? [],
      })
      setApi({
        summary,
        availability,
        hosts,
        supervisors: supervisors ?? [],
        expiryThresholds: expiryThresholds ?? DEFAULT_EXPIRY_THRESHOLDS,
        telegramConfigured: notifStatus?.telegramConfigured ?? null,
      })
      setError("")
    } catch (e) {
      setError(e instanceof ApiError ? e.message : "Gagal memuat data dari server")
    } finally {
      inFlight.current = false
      setLoading(false)
    }
  }, [])

  // Muat saat ada sesi, kosongkan saat logout, dan perbarui berkala.
  useEffect(() => {
    const onSession = () => {
      if (tokenStore.get()) void refresh()
      else setRemote(emptyRemote())
    }
    onSession()
    window.addEventListener(SESSION_EVENT, onSession)
    window.addEventListener(UNAUTHORIZED_EVENT, onSession)
    const timer = window.setInterval(() => void refresh(), REFRESH_MS)
    return () => {
      window.removeEventListener(SESSION_EVENT, onSession)
      window.removeEventListener(UNAUTHORIZED_EVENT, onSession)
      window.clearInterval(timer)
    }
  }, [refresh])

  const store = useMemo<SynraStore>(() => {
    const state: SynraState = remote
    const read: SynraStore["read"] = (collection) => state[collection]

    // Setiap aksi tulis memanggil API lalu memuat ulang data.
    const mutate = async <T,>(path: string, method: string, body?: unknown): Promise<T> => {
      const result = await apiFetch<T>(path, { method, body: body === undefined ? undefined : JSON.stringify(body) })
      await refresh()
      return result
    }

    const actions: SynraStore["actions"] = {
      createAsset: (input) => mutate("/assets", "POST", input),
      updateAsset: (apiId, input) => mutate(`/assets/${apiId}`, "PATCH", input),
      transitionAlert: (apiId, action, body = {}) => mutate(`/alerts/${apiId}/${action}`, "PATCH", body),
      evaluateAlerts: () => mutate("/alerts/evaluate", "POST"),
      createUser: (input) => mutate("/users", "POST", input),
      updateUser: (id, input) => mutate(`/users/${id}`, "PATCH", input),
      unlockUser: (id) => mutate(`/users/${id}/unlock`, "POST"),
      updateRule: (id, value) => mutate(`/thresholds/rule/${id}`, "PATCH", { value }),
      saveThresholds: (metric, levels) => mutate(`/thresholds/${metric}`, "PUT", { levels }),
      createHost: (input) => mutate("/hosts", "POST", input),
      updateHost: (id, input) => mutate(`/hosts/${id}`, "PATCH", input),
      deleteHost: (id) => mutate(`/hosts/${id}`, "DELETE"),
      saveExpiryThresholds: (input) => mutate("/lifecycle/thresholds", "PUT", input),
      createLifecycle: (input) => mutate("/lifecycle", "POST", input),
      updateLifecycle: (id, input) => mutate(`/lifecycle/${id}`, "PATCH", input),
      requestRenewal: (itemId, note) => mutate(`/lifecycle/${itemId}/renewals`, "POST", { note }),
      decideRenewal: (id, status, input = {}) => mutate(`/lifecycle/renewals/${id}`, "PATCH", { status, ...input }),
      changePassword: (oldPassword, newPassword) =>
        apiFetch("/auth/change-password", { method: "POST", body: JSON.stringify({ oldPassword, newPassword }) }),
      sendTestNotification: () => mutate("/notifications/test", "POST"),
      importCsv: async (file) => {
        const form = new FormData()
        form.append("file", file)
        const result = await apiFetch<{ inserted: number; invalidRows: number; errors: { row: number; message: string }[] }>(
          "/ingestion/import-csv",
          { method: "POST", body: form },
        )
        await refresh()
        return result
      },
      download: async (path, fallbackName) => {
        await apiDownload(path, fallbackName)
        await refresh()
      },
    }

    const summary = api.summary
    const helpers: SynraStore["helpers"] = {
      ...seedHelpers,
      lifecycleSeverity: (days: number) => lifecycleSeverity(days, api.expiryThresholds),
      dashboardKpi: () => ({
        online: summary?.online ?? 0,
        totalAssets: summary?.totalAssets ?? 0,
        openAlerts: summary?.openAlerts ?? 0,
        critical: summary?.openAlertsBySeverity.CRITICAL ?? 0,
        warning: summary?.warning ?? 0,
        stale: summary?.stale ?? 0,
        availabilityPct: api.availability?.averagePct ?? null,
      }),
      alertFunnel: () =>
        ["Baru", "Diakui", "Dalam Penanganan", "Menunggu Review", "Ditutup"].map((status) => ({
          status,
          count: state.alerts.filter((alert) => alert.status === status).length,
        })),
      assetsByType: () => {
        const counts = new Map<string, number>()
        state.assets.forEach((asset) => counts.set(asset.type, (counts.get(asset.type) ?? 0) + 1))
        return [...counts].map(([type, count]) => ({
          type,
          count,
          pct: state.assets.length === 0 ? 0 : Math.round((count / state.assets.length) * 100),
        }))
      },
    }
    return { state, api, loading, error, refresh, read, actions, helpers }
  }, [remote, api, loading, error, refresh])

  return createElement(SynraStoreContext.Provider, { value: store }, children)
}

export function useSynraStore() {
  const store = useContext(SynraStoreContext)
  if (!store) {
    throw new Error("useSynraStore harus digunakan di dalam SynraStoreProvider")
  }
  return store
}

/** Rata-rata utilisasi lintas aset untuk periode grafik dashboard. */
export function useUtilization(period: "24 jam" | "7 hari" | "30 hari") {
  const [data, setData] = useState<Array<{ label: string; cpu: number; memory: number; disk: number }>>([])
  const [error, setError] = useState("")
  useEffect(() => {
    const hours = period === "24 jam" ? 24 : period === "7 hari" ? 24 * 7 : 24 * 30
    const bucket = period === "24 jam" ? 3600 : period === "7 hari" ? 6 * 3600 : 86400
    const from = new Date(Date.now() - hours * 3600_000).toISOString()
    let cancelled = false
    apiFetch<UtilizationDto>(`/dashboard/utilization?from=${encodeURIComponent(from)}&bucketSeconds=${bucket}`)
      .then((res) => {
        if (cancelled) return
        const fmt = new Intl.DateTimeFormat("id-ID", period === "24 jam" ? { hour: "2-digit", minute: "2-digit" } : { day: "2-digit", month: "short" })
        setData(
          res.points.map((p) => ({
            label: fmt.format(new Date(p.t)),
            cpu: Math.round(p.cpu ?? 0),
            memory: Math.round(p.memory ?? 0),
            disk: Math.round(p.disk ?? 0),
          })),
        )
        setError("")
      })
      .catch((e) => !cancelled && setError(e instanceof ApiError ? e.message : "Gagal memuat grafik"))
    return () => {
      cancelled = true
    }
  }, [period])
  return { data, error }
}

/** Detail alert (timeline) dari backend. */
export function useAlertDetail(apiId: string | undefined, version: unknown) {
  const [detail, setDetail] = useState<Pick<import("./backend").AlertDetailDto, "events" | "attachments">>({
    events: [],
    attachments: [],
  })
  const [nonce, setNonce] = useState(0)
  useEffect(() => {
    if (!apiId) return
    let cancelled = false
    apiFetch<import("./backend").AlertDetailDto>(`/alerts/${apiId}`)
      .then((res) => !cancelled && setDetail({ events: res.events, attachments: res.attachments ?? [] }))
      .catch(() => !cancelled && setDetail({ events: [], attachments: [] }))
    return () => {
      cancelled = true
    }
  }, [apiId, version, nonce])
  return { ...detail, reload: () => setNonce((n) => n + 1) }
}
