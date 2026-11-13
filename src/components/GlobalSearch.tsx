import { AlertTriangle, CalendarClock, Search, Server } from "lucide-react"
import { forwardRef, useMemo, useState, type ReactNode } from "react"
import type { LifecyclePageName } from "./LifecyclePage"
import type { LifecycleItem } from "@/lib/synraDomain"
import { useSynraStore } from "@/lib/useSynraStore"
import { cn } from "@/lib/utils"

export type GlobalSearchTarget =
  | { kind: "asset"; id: string }
  | { kind: "alert"; id: string }
  | { kind: "lifecycle"; id: string; page: LifecyclePageName }

const lifecyclePageByType: Record<LifecycleItem["type"], LifecyclePageName> = {
  os: "Lifecycle OS",
  licenses: "Lisensi Software",
  certificates: "Sertifikat SSL/TLS",
  warranty: "Garansi Hardware",
  contracts: "Kontrak Vendor",
}

const MAX_PER_GROUP = 5

interface Result {
  key: string
  group: string
  icon: ReactNode
  title: string
  subtitle: string
  target: GlobalSearchTarget
}

const matches = (query: string, values: (string | null | undefined)[]) =>
  values.some((value) => value?.toLowerCase().includes(query))

const GlobalSearch = forwardRef<HTMLInputElement, { onSelect: (target: GlobalSearchTarget) => void }>(
  function GlobalSearch({ onSelect }, ref) {
    const { read } = useSynraStore()
    const assets = read("assets")
    const alerts = read("alerts")
    const lifecycle = read("lifecycle")
    const [query, setQuery] = useState("")
    const [open, setOpen] = useState(false)
    const [activeIndex, setActiveIndex] = useState(0)

    const results = useMemo<Result[]>(() => {
      const q = query.trim().toLowerCase()
      if (!q) return []
      const assetResults: Result[] = assets
        .filter((a) => matches(q, [a.name, a.ipAddress, a.type, a.pic, a.location]))
        .slice(0, MAX_PER_GROUP)
        .map((a) => ({
          key: `asset-${a.id}`,
          group: "Aset",
          icon: <Server size={15} />,
          title: a.name,
          subtitle: [a.ipAddress, a.type, a.location].filter(Boolean).join(" • "),
          target: { kind: "asset", id: a.id },
        }))
      const alertResults: Result[] = alerts
        .filter((a) => matches(q, [a.id, a.name, a.type, a.location, a.note]))
        .slice(0, MAX_PER_GROUP)
        .map((a) => ({
          key: `alert-${a.id}`,
          group: "Alert",
          icon: <AlertTriangle size={15} />,
          title: `${a.id} — ${a.name}`,
          subtitle: [a.status, a.location].filter(Boolean).join(" • "),
          target: { kind: "alert", id: a.id },
        }))
      const lifecycleResults: Result[] = lifecycle
        .filter((item) => lifecyclePageByType[item.type])
        .filter((item) => matches(q, [item.code, item.name, item.vendor, item.pic, item.location]))
        .slice(0, MAX_PER_GROUP)
        .map((item) => ({
          key: `lifecycle-${item.id}`,
          group: "Lisensi & Lifecycle",
          icon: <CalendarClock size={15} />,
          title: `${item.code} — ${item.name}`,
          subtitle: [lifecyclePageByType[item.type], item.expiry].filter(Boolean).join(" • "),
          target: { kind: "lifecycle", id: item.id, page: lifecyclePageByType[item.type] },
        }))
      return [...assetResults, ...alertResults, ...lifecycleResults]
    }, [query, assets, alerts, lifecycle])

    const choose = (result: Result) => {
      onSelect(result.target)
      setQuery("")
      setOpen(false)
      ;(document.activeElement as HTMLElement | null)?.blur()
    }

    const showPanel = open && query.trim().length > 0

    return (
      <div className="relative hidden items-center sm:flex">
        <Search size={15} className="pointer-events-none absolute left-3 text-muted-foreground" aria-hidden="true" />
        <input
          ref={ref}
          value={query}
          onChange={(event) => {
            setQuery(event.target.value)
            setActiveIndex(0)
            setOpen(true)
          }}
          onFocus={() => setOpen(true)}
          onBlur={() => setOpen(false)}
          onKeyDown={(event) => {
            if (event.key === "Escape") {
              setOpen(false)
              event.currentTarget.blur()
            } else if (event.key === "ArrowDown" && results.length) {
              event.preventDefault()
              setActiveIndex((i) => (i + 1) % results.length)
            } else if (event.key === "ArrowUp" && results.length) {
              event.preventDefault()
              setActiveIndex((i) => (i - 1 + results.length) % results.length)
            } else if (event.key === "Enter" && results[activeIndex]) {
              event.preventDefault()
              choose(results[activeIndex])
            }
          }}
          placeholder="Cari aset, alert, lisensi…"
          aria-label="Cari aset, alert, atau lisensi"
          role="combobox"
          aria-expanded={showPanel}
          aria-controls="global-search-results"
          aria-activedescendant={showPanel && results[activeIndex] ? results[activeIndex].key : undefined}
          className="h-9 w-56 rounded-lg border border-border bg-card/70 pl-9 pr-14 text-[13px] outline-none transition-[width,border-color] placeholder:text-muted-foreground/70 focus:w-72 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
        />
        <kbd className="pointer-events-none absolute right-2.5 rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-[10px] text-muted-foreground">
          Ctrl K
        </kbd>

        {showPanel && (
          <div
            id="global-search-results"
            role="listbox"
            className="absolute right-0 top-full z-50 mt-2 max-h-[min(420px,70vh)] w-[min(380px,calc(100vw-2rem))] overflow-y-auto rounded-xl border border-border bg-popover p-1 text-popover-foreground shadow-2xl"
            // Cegah blur input sebelum klik pada hasil terproses.
            onMouseDown={(event) => event.preventDefault()}
          >
            {results.length === 0 ? (
              <p className="px-3 py-6 text-center text-[13px] text-muted-foreground">
                Tidak ada hasil untuk “{query.trim()}”
              </p>
            ) : (
              results.map((result, index) => (
                <div key={result.key}>
                  {(index === 0 || results[index - 1].group !== result.group) && (
                    <p className="px-2.5 pb-1 pt-2 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">
                      {result.group}
                    </p>
                  )}
                  <button
                    id={result.key}
                    type="button"
                    role="option"
                    aria-selected={index === activeIndex}
                    onMouseEnter={() => setActiveIndex(index)}
                    onClick={() => choose(result)}
                    className={cn(
                      "flex w-full items-start gap-2.5 rounded-lg px-2.5 py-2 text-left",
                      index === activeIndex ? "bg-accent text-accent-foreground" : "hover:bg-accent/60",
                    )}
                  >
                    <span className="mt-0.5 shrink-0 text-muted-foreground">{result.icon}</span>
                    <span className="min-w-0 flex-1">
                      <span className="block truncate text-[13px] font-medium">{result.title}</span>
                      {result.subtitle && (
                        <span className="block truncate text-xs text-muted-foreground">{result.subtitle}</span>
                      )}
                    </span>
                  </button>
                </div>
              ))
            )}
          </div>
        )}
      </div>
    )
  },
)

export default GlobalSearch
