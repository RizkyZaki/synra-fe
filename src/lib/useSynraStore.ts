import {
  createContext,
  createElement,
  type ReactNode,
  useContext,
  useEffect,
  useMemo,
  useState,
} from "react"
import {
  dashboardKpi,
  daysUntil,
  diskSeverity,
  forecastDays,
  healthDimensions,
  lifecycleSeverity,
  roles,
  seedAll,
  type SynraState,
} from "./synraDomain"

export type SynraCollection = keyof SynraState
export type SynraItem<K extends SynraCollection> = SynraState[K][number]

const STORAGE_KEY = "synra-admin-state-v2"

function loadState(): SynraState {
  try {
    const stored = localStorage.getItem(STORAGE_KEY)
    if (stored) return JSON.parse(stored) as SynraState
  } catch {
    // A corrupt cache falls back to the canonical seed.
  }
  return seedAll()
}

const seedHelpers = {
  dashboardKpi,
  daysUntil,
  lifecycleSeverity,
  forecastDays,
  diskSeverity,
  healthDimensions,
  roles,
} as const

interface SynraStore {
  state: SynraState
  read: <K extends SynraCollection>(collection: K) => SynraState[K]
  add: <K extends SynraCollection>(
    collection: K,
    item: SynraItem<K>,
  ) => void
  update: <K extends SynraCollection>(
    collection: K,
    predicate: (item: SynraItem<K>) => boolean,
    changes: Partial<SynraItem<K>>,
  ) => void
  reset: () => void
  helpers: typeof seedHelpers & {
    dashboardKpi: () => ReturnType<typeof dashboardKpi>
    alertFunnel: () => Array<{ status: string; count: number }>
    assetsByType: () => Array<{ type: string; count: number; pct: number }>
    utilizationSeries: (
      period: "24 jam" | "7 hari" | "30 hari",
    ) => Array<{ label: string; cpu: number; memory: number; disk: number }>
  }
}

const SynraStoreContext = createContext<SynraStore | null>(null)

export function SynraStoreProvider({ children }: { children: ReactNode }) {
  const [state, setState] = useState<SynraState>(loadState)

  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state))
  }, [state])

  const store = useMemo<SynraStore>(() => {
    const read: SynraStore["read"] = (collection) => state[collection]
    const add: SynraStore["add"] = (collection, item) => {
      setState((current) => ({
        ...current,
        [collection]: [...current[collection], item],
      }))
    }
    const update: SynraStore["update"] = (
      collection,
      predicate,
      changes,
    ) => {
      setState((current) => ({
        ...current,
        [collection]: current[collection].map((item) =>
          predicate(item as SynraItem<typeof collection>)
            ? { ...item, ...changes }
            : item,
        ),
      }))
    }
    const reset = () => setState(seedAll())
    const helpers: SynraStore["helpers"] = {
      ...seedHelpers,
      dashboardKpi: () => {
        const seeded = dashboardKpi()
        const open = state.alerts.filter((alert) => alert.status !== "Ditutup")
        return {
          ...seeded,
          online: state.assets.filter((asset) => asset.status === "Online")
            .length,
          totalAssets: state.assets.length,
          openAlerts: open.length,
          critical: open.filter((alert) => alert.severity === "Critical")
            .length,
          expiring: state.lifecycle.filter(
            (item) => daysUntil(item.expiry) <= 30,
          ).length,
        }
      },
      alertFunnel: () =>
        [
          "Baru",
          "Diakui",
          "Dalam Penanganan",
          "Menunggu Review",
          "Ditutup",
        ].map((status) => ({
          status,
          count: state.alerts.filter((alert) => alert.status === status).length,
        })),
      assetsByType: () => {
        const counts = new Map<string, number>()
        state.assets.forEach((asset) =>
          counts.set(asset.type, (counts.get(asset.type) ?? 0) + 1),
        )
        return [...counts].map(([type, count]) => ({
          type,
          count,
          pct:
            state.assets.length === 0
              ? 0
              : Math.round((count / state.assets.length) * 100),
        }))
      },
      utilizationSeries: (period) => {
        const count = period === "24 jam" ? 8 : period === "7 hari" ? 7 : 10
        const average = (key: "cpu" | "memory" | "disk") =>
          Math.round(
            state.assets.reduce((sum, asset) => sum + asset[key], 0) /
              Math.max(state.assets.length, 1),
          )
        return Array.from({ length: count }, (_, index) => ({
          label:
            period === "24 jam"
              ? `${String(index * 3).padStart(2, "0")}:00`
              : period === "7 hari"
                ? `H-${count - index - 1}`
                : `${(index + 1) * 3} Okt`,
          cpu: Math.max(0, average("cpu") + ((index % 3) - 1) * 4),
          memory: Math.max(0, average("memory") + ((index % 4) - 2) * 3),
          disk: average("disk"),
        }))
      },
    }
    return { state, read, add, update, reset, helpers }
  }, [state])

  return createElement(SynraStoreContext.Provider, { value: store }, children)
}

export function useSynraStore() {
  const store = useContext(SynraStoreContext)
  if (!store) {
    throw new Error("useSynraStore harus digunakan di dalam SynraStoreProvider")
  }
  return store
}
