import {
  Activity,
  BadgeCheck,
  Bell,
  BellRing,
  Boxes,
  ChevronRight,
  ChevronsUpDown,
  Cpu,
  Database,
  FileChartColumn,
  FileSignature,
  HardDrive,
  History,
  KeyRound,
  LayoutDashboard,
  LogOut,
  type LucideIcon,
  Menu,
  Moon,
  PanelLeftClose,
  PanelLeftOpen,
  Search,
  Server,
  Settings2,
  ShieldCheck,
  Siren,
  Sun,
  UserRound,
  Wrench,
} from "lucide-react"
import { AnimatePresence, LayoutGroup, motion } from "motion/react"
import { type CSSProperties, useCallback, useEffect, useRef, useState } from "react"
import { ConfirmDialog, Drawer, PageLayout, StatusBadge, Toast } from "./components/ui"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/sonner"
import { Sheet, SheetContent, SheetTitle } from "@/components/ui/sheet"
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import { AppBackdrop } from "@/components/aceternity/backdrop"
import AdministrationPage from "./components/AdministrationPage"
import AuditTrailPage from "./components/AuditTrailPage"
import Dashboard from "./components/Dashboard"
import AssetInventory from "./components/AssetInventory"
import AlertIncidentPage, { alertStatusTone } from "./components/AlertIncidentPage"
import LifecyclePage, { type LifecyclePageName } from "./components/LifecyclePage"
import LoginPage from "./components/LoginPage"
import MonitoringPage, { type MonitoringName } from "./components/MonitoringPage"
import BackupSecurityPage from "./components/BackupSecurityPage"
import NotificationEscalationPage from "./components/NotificationEscalationPage"
import ReportsPage from "./components/ReportsPage"
import InfrastructureHealthPage from "./components/InfrastructureHealthPage"
import { AccessProvider, type SessionUser } from "./lib/useAccess"
import { UNAUTHORIZED_EVENT } from "./lib/api"
import { logout, restoreSession } from "./lib/auth"
import { useSynraStore } from "./lib/useSynraStore"
import type { NotificationItem } from "./lib/synraDomain"
import { can, roleCapabilities } from "./seed"
import { cn } from "./lib/utils"

type Theme = "dark" | "light"
const LEGACY_AUTH_STORAGE_KEY = "synra-auth-user-id"
const READ_NOTIFICATIONS_KEY = "synra-read-notification-ids"
const SIDEBAR_KEY = "synra-sidebar-collapsed"
const monitoringPages: MonitoringName[] = [
  "Infrastruktur",
  "Database",
  "Storage & Kapasitas",
  "Availability & Performa",
  "Backup & Keamanan",
]
const lifecyclePages: LifecyclePageName[] = [
  "Lifecycle OS",
  "Lisensi Software",
  "Sertifikat SSL/TLS",
  "Garansi Hardware",
  "Kontrak Vendor",
]

interface NavItem {
  label: string
  description: string
  icon: LucideIcon
}

interface NavGroup {
  label: string
  mobileLabel: string
  items: NavItem[]
}

interface RouteDefinition {
  href: string
  eyebrow: string
  parent?: string
}

const dashboardItem: NavItem = {
  label: "Pusat Kendali",
  description: "Ringkasan operasional infrastruktur",
  icon: LayoutDashboard,
}

const displayLabels: Record<string, string> = {
  Database: "Basis data",
  "Storage & Kapasitas": "Penyimpanan & kapasitas",
  "Availability & Performa": "Ketersediaan & performa",
  "Backup & Keamanan": "Pencadangan & keamanan",
  Lifecycle: "Siklus hidup",
  "Lifecycle OS": "Siklus hidup OS",
  "Lisensi Software": "Lisensi perangkat lunak",
  "Kesehatan Infrastruktur": "Kesehatan infrastruktur",
}

const displayLabel = (label: string) => displayLabels[label] ?? label

const navGroups: NavGroup[] = [
  {
    label: "Operasi",
    mobileLabel: "OPERASI",
    items: [
      { label: "Alert & Insiden", description: "Kelola alert dan penanganan insiden", icon: Siren },
      { label: "Notifikasi & Eskalasi", description: "Atur kanal dan jalur eskalasi", icon: BellRing },
    ],
  },
  {
    label: "Monitoring",
    mobileLabel: "MONITORING",
    items: [
      { label: "Infrastruktur", description: "Pantau server dan jaringan utama", icon: Server },
      { label: "Database", description: "Kondisi dan performa basis data", icon: Database },
      { label: "Storage & Kapasitas", description: "Utilisasi dan proyeksi kapasitas", icon: HardDrive },
      { label: "Availability & Performa", description: "Ketersediaan dan metrik layanan", icon: Activity },
      { label: "Backup & Keamanan", description: "Status backup dan kontrol keamanan", icon: ShieldCheck },
    ],
  },
  {
    label: "Aset",
    mobileLabel: "ASET",
    items: [{ label: "Inventaris Aset", description: "Kelola seluruh aset TI bank", icon: Boxes }],
  },
  {
    label: "Lifecycle",
    mobileLabel: "LIFECYCLE",
    items: [
      { label: "Lifecycle OS", description: "Siklus dukungan sistem operasi", icon: Cpu },
      { label: "Lisensi Software", description: "Alokasi dan masa berlaku lisensi", icon: KeyRound },
      { label: "Sertifikat SSL/TLS", description: "Pantau sertifikat dan kedaluwarsa", icon: BadgeCheck },
      { label: "Garansi Hardware", description: "Masa perlindungan perangkat keras", icon: Wrench },
      { label: "Kontrak Vendor", description: "Kontrak dan jadwal perpanjangan", icon: FileSignature },
    ],
  },
  {
    label: "Tata Kelola",
    mobileLabel: "TATA KELOLA",
    items: [
      { label: "Laporan", description: "Ringkasan dan laporan operasional", icon: FileChartColumn },
      { label: "Audit Trail", description: "Riwayat aktivitas dan perubahan", icon: History },
      { label: "Administrasi", description: "Pengguna dan parameter sistem", icon: Settings2 },
    ],
  },
]

const routeConfig: Record<string, RouteDefinition> = {
  "Pusat Kendali": { href: "#/pusat-kendali", eyebrow: "UTAMA" },
  ...Object.fromEntries(
    navGroups.flatMap((group) =>
      group.items.map((item) => [
        item.label,
        {
          href: `#/${item.label.toLowerCase().replace(/ & /g, "-").replace(/ /g, "-")}`,
          eyebrow: group.mobileLabel,
          parent: "Pusat Kendali",
        },
      ]),
    ),
  ),
  "Kesehatan Infrastruktur": {
    href: "#/kesehatan-infrastruktur",
    eyebrow: "MONITORING",
    parent: "Pusat Kendali",
  },
}

type DetailRoute = "asset" | "alert" | "lifecycle"

const detailRouteConfig: Record<DetailRoute, { eyebrow: string; parent: (active: string) => string }> = {
  asset: { eyebrow: "ASET", parent: () => "Inventaris Aset" },
  alert: { eyebrow: "OPERASI", parent: () => "Alert & Insiden" },
  lifecycle: { eyebrow: "LIFECYCLE", parent: (active) => active },
}

// ── Merek ────────────────────────────────────────────────────────────────────
function BrandMark({ collapsed, onClick }: { collapsed: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label="Buka Pusat Kendali"
      className="flex h-10 items-center gap-3 rounded-lg px-1 outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <motion.span
        initial={false}
        animate={{ width: collapsed ? 44 : 72 }}
        transition={{ type: "spring", stiffness: 380, damping: 38 }}
        className="block shrink-0"
      >
        <img src="/assets/Logo_SYNRA_putih.png" alt="SYNRA" className="hidden h-auto w-full dark:block" />
        <img src="/assets/Logo_SYNRA_hitam.png" alt="SYNRA" className="block h-auto w-full dark:hidden" />
      </motion.span>
      <AnimatePresence initial={false}>
        {!collapsed && (
          <motion.span
            initial={{ opacity: 0, x: -6 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -6 }}
            transition={{ duration: 0.15 }}
            className="border-l border-border pl-3 text-left text-[10.5px] leading-tight text-muted-foreground"
          >
            Monitoring
            <br />
            Infrastruktur
          </motion.span>
        )}
      </AnimatePresence>
    </button>
  )
}

// ── Item navigasi dengan highlight beranimasi (Aceternity-style) ─────────────
function NavButton({
  item,
  active,
  collapsed,
  onSelect,
  layoutScope,
}: {
  item: NavItem
  active: boolean
  collapsed: boolean
  onSelect: (label: string) => void
  layoutScope: string
}) {
  const Icon = item.icon
  return (
    <button
      type="button"
      onClick={() => onSelect(item.label)}
      title={collapsed ? displayLabel(item.label) : undefined}
      aria-current={active ? "page" : undefined}
      className={cn(
        "group/nav relative flex h-9 w-full items-center gap-3 rounded-lg px-2.5 text-[13.5px] outline-none transition-colors focus-visible:ring-2 focus-visible:ring-ring",
        active ? "text-foreground" : "text-muted-foreground hover:text-foreground",
      )}
    >
      {active && (
        <motion.span
          layoutId={`nav-active-${layoutScope}`}
          className="absolute inset-0 rounded-lg border border-primary/25 bg-gradient-to-r from-primary/15 to-primary/[0.03]"
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
        />
      )}
      {active && (
        <motion.span
          layoutId={`nav-bar-${layoutScope}`}
          className="absolute -left-3 top-1.5 h-6 w-[3px] rounded-r-full bg-primary shadow-[0_0_12px_rgb(255_122_26/80%)]"
          transition={{ type: "spring", stiffness: 420, damping: 34 }}
        />
      )}
      <span className="absolute inset-0 rounded-lg bg-muted opacity-0 transition-opacity group-hover/nav:opacity-60" aria-hidden="true" />
      <Icon
        size={17}
        strokeWidth={1.75}
        aria-hidden="true"
        className={cn("relative shrink-0 transition-colors", active ? "text-primary" : "")}
      />
      {!collapsed && <span className="relative truncate">{displayLabel(item.label)}</span>}
    </button>
  )
}

function NavList({
  groups,
  active,
  collapsed,
  onSelect,
  layoutScope,
}: {
  groups: NavGroup[]
  active: string
  collapsed: boolean
  onSelect: (label: string) => void
  layoutScope: string
}) {
  return (
    <LayoutGroup id={layoutScope}>
      <nav aria-label="Navigasi utama" className="flex flex-col gap-5">
        <NavButton
          item={dashboardItem}
          active={active === dashboardItem.label || active === "Kesehatan Infrastruktur"}
          collapsed={collapsed}
          onSelect={onSelect}
          layoutScope={layoutScope}
        />
        {groups.map((group) => (
          <div key={group.label} className="flex flex-col gap-0.5">
            {collapsed ? (
              <span className="mx-auto mb-1.5 h-px w-6 bg-border" aria-hidden="true" />
            ) : (
              <span className="mb-1.5 px-2.5 text-[10.5px] font-medium uppercase tracking-[0.12em] text-muted-foreground/70">
                {displayLabel(group.label)}
              </span>
            )}
            {group.items.map((item) => (
              <NavButton
                key={item.label}
                item={item}
                active={active === item.label}
                collapsed={collapsed}
                onSelect={onSelect}
                layoutScope={layoutScope}
              />
            ))}
          </div>
        ))}
      </nav>
    </LayoutGroup>
  )
}

function UserCard({ user, collapsed, onProfile, onLogout }: {
  user: SessionUser
  collapsed: boolean
  onProfile: () => void
  onLogout: () => void
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger
        className={cn(
          "flex w-full items-center gap-2.5 rounded-xl border border-border bg-card/60 p-2 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
          collapsed && "justify-center border-transparent bg-transparent p-1",
        )}
        aria-label={`Buka menu ${user.name}`}
      >
        <span className="grid size-8 shrink-0 place-items-center rounded-lg bg-gradient-to-br from-secondary to-muted text-xs font-semibold ring-1 ring-border">
          {user.initials}
        </span>
        {!collapsed && (
          <>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[13px] font-medium">{user.name}</span>
              <span className="block truncate text-[11px] text-muted-foreground">{user.role}</span>
            </span>
            <ChevronsUpDown size={15} className="shrink-0 text-muted-foreground" aria-hidden="true" />
          </>
        )}
      </DropdownMenuTrigger>
      <DropdownMenuContent side="top" align="start" sideOffset={8} className="w-56">
        <div className="px-3 py-2">
          <p className="truncate text-sm font-medium">{user.name}</p>
          <p className="truncate text-xs text-muted-foreground">{user.role}</p>
        </div>
        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onProfile}>
          <UserRound /> Profil
        </DropdownMenuItem>
        <DropdownMenuItem variant="destructive" onClick={onLogout}>
          <LogOut /> Keluar
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  )
}

export default function App() {
  const { read } = useSynraStore()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => (localStorage.getItem("synra-theme") as Theme | null) ?? "dark")
  const [collapsed, setCollapsed] = useState(() => {
    try {
      return localStorage.getItem(SIDEBAR_KEY) === "1"
    } catch {
      return false
    }
  })
  const [active, setActive] = useState("Pusat Kendali")
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null)
  const [selectedLifecycleId, setSelectedLifecycleId] = useState<string | null>(null)
  const [query, setQuery] = useState("")
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [toastVisible, setToastVisible] = useState(false)
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem(READ_NOTIFICATIONS_KEY) ?? "[]") as string[]
    } catch {
      return []
    }
  })

  useEffect(() => {
    // Sisa sesi mock versi lama tidak dipakai lagi.
    localStorage.removeItem(LEGACY_AUTH_STORAGE_KEY)
    restoreSession()
      .then(setCurrentUser)
      .finally(() => setSessionChecked(true))

    const onUnauthorized = () => setCurrentUser(null)
    window.addEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
    return () => window.removeEventListener(UNAUTHORIZED_EVENT, onUnauthorized)
  }, [])

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    document.documentElement.classList.toggle("dark", theme === "dark")
    localStorage.setItem("synra-theme", theme)
  }, [theme])

  useEffect(() => {
    try {
      localStorage.setItem(SIDEBAR_KEY, collapsed ? "1" : "0")
    } catch {
      /* penyimpanan lokal tidak tersedia */
    }
  }, [collapsed])

  // Ctrl/Cmd+K memfokuskan pencarian.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault()
        searchInputRef.current?.focus()
      }
    }
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [])

  const closeToast = useCallback(() => setToastVisible(false), [])
  const capabilities = currentUser ? roleCapabilities.find((item) => item.role === currentUser.role) : undefined
  const visibleNavGroups = currentUser
    ? navGroups
        .map((group) => ({
          ...group,
          items: group.items.filter(
            (item) =>
              (item.label !== "Administrasi" || can(currentUser.role, "config")) &&
              // Audit log hanya dapat dibaca ADMIN dan AUDITOR (dibatasi juga di backend).
              (item.label !== "Audit Trail" || ["ADMIN", "AUDITOR"].includes(currentUser.backendRole)),
          ),
        }))
        .filter((group) => group.items.length > 0)
    : navGroups
  const notifications = read("notifications")
  const alerts = read("alerts")
  const unreadCount = notifications.filter((notification) => !readNotificationIds.includes(notification.id)).length
  const clearDetailRoutes = () => {
    setSelectedAssetId(null)
    setSelectedAlertId(null)
    setSelectedLifecycleId(null)
  }
  const navigateTo = (label: string) => {
    clearDetailRoutes()
    setActive(label)
    setMobileNavOpen(false)
    window.scrollTo({ top: 0 })
  }
  const navigateHref = (href: string) => {
    const destination = Object.entries(routeConfig).find(([, route]) => route.href === href)?.[0]
    if (destination) navigateTo(destination)
  }
  const handleNotificationClick = (notification: NotificationItem) => {
    if (!readNotificationIds.includes(notification.id)) {
      const nextIds = [...readNotificationIds, notification.id]
      localStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify(nextIds))
      setReadNotificationIds(nextIds)
    }
    setNotificationOpen(false)

    const alertIdMatch = notification.alertId || notification.title.match(/ALT-\d+/i)?.[0]?.toUpperCase()

    if (alertIdMatch) {
      clearDetailRoutes()
      setSelectedAlertId(alertIdMatch)
      setActive("Alert & Insiden")
    } else {
      navigateTo("Notifikasi & Eskalasi")
    }
  }
  const detailRoute: DetailRoute | null =
    active === "Inventaris Aset" && selectedAssetId
      ? "asset"
      : active === "Alert & Insiden" && selectedAlertId
        ? "alert"
        : lifecyclePages.includes(active as LifecyclePageName) && selectedLifecycleId
          ? "lifecycle"
          : null
  const detailParent = detailRoute ? detailRouteConfig[detailRoute].parent(active) : null
  const selectedAlert =
    detailRoute === "alert" && selectedAlertId ? alerts.find((a) => a.id === selectedAlertId) : undefined
  const currentRoute = routeConfig[active] ?? routeConfig["Pusat Kendali"]
  const pageTitle =
    detailRoute === "asset"
      ? selectedAssetId!
      : detailRoute === "alert"
        ? selectedAlertId!
        : detailRoute === "lifecycle"
          ? (read("lifecycle").find((item) => item.id === selectedLifecycleId)?.code ?? selectedLifecycleId!)
          : active
  const pageEyebrow = detailRoute ? detailRouteConfig[detailRoute].eyebrow : currentRoute.eyebrow
  const parentLabel = detailParent ?? currentRoute.parent
  const backTo = parentLabel ? { label: displayLabel(parentLabel), href: routeConfig[parentLabel].href } : undefined
  const breadcrumb = [
    pageEyebrow.charAt(0) + pageEyebrow.slice(1).toLowerCase(),
    ...(detailRoute && detailParent ? [displayLabel(detailParent)] : []),
    displayLabel(pageTitle),
  ]

  // Hindari kilasan halaman login saat token tersimpan sedang diverifikasi.
  if (!sessionChecked) return null

  if (!currentUser) {
    return (
      <>
        <LoginPage
          onSuccess={(user) => {
            setCurrentUser(user)
            navigateTo("Pusat Kendali")
          }}
        />
        <Toaster />
      </>
    )
  }

  const sidebarWidth = collapsed ? 76 : 264

  return (
    <AccessProvider user={currentUser}>
      <div className="relative min-h-dvh">
        <AppBackdrop />

        {/* Sidebar desktop */}
        <motion.aside
          initial={false}
          animate={{ width: sidebarWidth }}
          transition={{ type: "spring", stiffness: 380, damping: 38 }}
          className="fixed inset-y-0 left-0 z-40 hidden flex-col print:!hidden border-r border-sidebar-border bg-sidebar/85 backdrop-blur-xl lg:flex"
        >
          <div className={cn("flex h-16 items-center px-4", collapsed && "justify-center px-0")}>
            <BrandMark collapsed={collapsed} onClick={() => navigateTo(dashboardItem.label)} />
          </div>
          <div className="flex-1 overflow-y-auto overflow-x-hidden px-4 pb-4 pt-2 [scrollbar-width:thin]">
            <NavList
              groups={visibleNavGroups}
              active={active}
              collapsed={collapsed}
              onSelect={navigateTo}
              layoutScope="desktop"
            />
          </div>
          <div className="flex flex-col gap-2 border-t border-sidebar-border p-3">
            <UserCard
              user={currentUser}
              collapsed={collapsed}
              onProfile={() => setProfileOpen(true)}
              onLogout={() => setLogoutOpen(true)}
            />
            <button
              type="button"
              onClick={() => setCollapsed((value) => !value)}
              className={cn(
                "flex h-8 items-center gap-2 rounded-lg px-2.5 text-xs text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-ring",
                collapsed && "justify-center px-0",
              )}
              aria-label={collapsed ? "Lebarkan sidebar" : "Ciutkan sidebar"}
            >
              {collapsed ? <PanelLeftOpen size={16} /> : <PanelLeftClose size={16} />}
              {!collapsed && "Ciutkan"}
            </button>
          </div>
        </motion.aside>

        {/* Navigasi mobile */}
        <Sheet open={mobileNavOpen} onOpenChange={setMobileNavOpen}>
          <SheetContent side="left" className="w-[290px] max-w-[85vw] bg-sidebar p-0" showCloseButton={false}>
            <SheetTitle className="sr-only">Navigasi</SheetTitle>
            <div className="flex h-16 items-center px-4">
              <BrandMark collapsed={false} onClick={() => navigateTo(dashboardItem.label)} />
            </div>
            <div className="flex-1 overflow-y-auto px-4 pb-6">
              <NavList
                groups={visibleNavGroups}
                active={active}
                collapsed={false}
                onSelect={navigateTo}
                layoutScope="mobile"
              />
            </div>
          </SheetContent>
        </Sheet>

        <div
          style={{ "--sidebar-w": `${sidebarWidth}px` } as CSSProperties}
          className="flex min-h-dvh flex-col transition-[padding] duration-300 ease-out lg:pl-[var(--sidebar-w)] print:!pl-0"
        >
          {/* Topbar */}
          <header className="sticky top-0 z-30 flex h-16 print:hidden items-center gap-3 border-b border-border/70 bg-background/70 px-4 backdrop-blur-xl md:px-6">
            <Button
              variant="ghost"
              size="icon"
              className="lg:hidden"
              onClick={() => setMobileNavOpen(true)}
              aria-label="Buka menu"
            >
              <Menu size={20} />
            </Button>
            <button type="button" onClick={() => navigateTo(dashboardItem.label)} className="w-14 lg:hidden" aria-label="Buka Pusat Kendali">
              <img src="/assets/Logo_SYNRA_putih.png" alt="SYNRA" className="hidden h-auto w-full dark:block" />
              <img src="/assets/Logo_SYNRA_hitam.png" alt="SYNRA" className="block h-auto w-full dark:hidden" />
            </button>

            <nav aria-label="Lokasi halaman" className="hidden min-w-0 items-center gap-1.5 text-[13px] md:flex">
              {breadcrumb.map((crumb, index) => (
                <span key={`${crumb}-${index}`} className="flex min-w-0 items-center gap-1.5">
                  {index > 0 && <ChevronRight size={14} className="shrink-0 text-muted-foreground/60" aria-hidden="true" />}
                  <span
                    className={cn(
                      "truncate",
                      index === breadcrumb.length - 1 ? "font-medium text-foreground" : "text-muted-foreground",
                    )}
                  >
                    {crumb}
                  </span>
                </span>
              ))}
            </nav>

            <div className="ml-auto flex items-center gap-1.5">
              <label className="group relative hidden items-center sm:flex">
                <Search size={15} className="pointer-events-none absolute left-3 text-muted-foreground" aria-hidden="true" />
                <input
                  ref={searchInputRef}
                  value={query}
                  onChange={(event) => setQuery(event.target.value)}
                  placeholder="Cari aset, alert, lisensi…"
                  aria-label="Cari aset, alert, atau lisensi"
                  className="h-9 w-56 rounded-lg border border-border bg-card/70 pl-9 pr-14 text-[13px] outline-none transition-[width,border-color] placeholder:text-muted-foreground/70 focus:w-72 focus:border-primary/50 focus:ring-2 focus:ring-primary/20"
                />
                <kbd className="pointer-events-none absolute right-2.5 rounded border border-border bg-muted px-1.5 py-0.5 font-sans text-[10px] text-muted-foreground">
                  Ctrl K
                </kbd>
              </label>

              <Button
                variant="ghost"
                size="icon"
                onClick={() => setTheme((current) => (current === "dark" ? "light" : "dark"))}
                aria-label={`Aktifkan mode ${theme === "dark" ? "terang" : "gelap"}`}
              >
                <AnimatePresence mode="wait" initial={false}>
                  <motion.span
                    key={theme}
                    initial={{ rotate: -90, opacity: 0 }}
                    animate={{ rotate: 0, opacity: 1 }}
                    exit={{ rotate: 90, opacity: 0 }}
                    transition={{ duration: 0.18 }}
                    className="grid place-items-center"
                  >
                    {theme === "dark" ? <Moon size={18} /> : <Sun size={18} />}
                  </motion.span>
                </AnimatePresence>
              </Button>

              <Button
                variant="ghost"
                size="icon"
                className="relative"
                onClick={() => setNotificationOpen(true)}
                aria-label={`${unreadCount} notifikasi belum dibaca`}
              >
                <Bell size={18} />
                {unreadCount > 0 && (
                  <span className="absolute -right-0.5 -top-0.5 flex h-4 min-w-4 px-1 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground ring-2 ring-background">
                    {unreadCount > 9 ? "9+" : unreadCount}
                  </span>
                )}
              </Button>

              <div className="lg:hidden">
                <UserCard
                  user={currentUser}
                  collapsed
                  onProfile={() => setProfileOpen(true)}
                  onLogout={() => setLogoutOpen(true)}
                />
              </div>
            </div>
          </header>

          <AnimatePresence mode="wait" initial={false}>
            <motion.div
              key={`${active}-${detailRoute ?? ""}`}
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              transition={{ duration: 0.2, ease: "easeOut" }}
              className="flex-1"
            >
              <PageLayout
                eyebrow={pageEyebrow}
                title={displayLabel(pageTitle)}
                badge={
                  selectedAlert ? (
                    <StatusBadge status={selectedAlert.status} tone={alertStatusTone(selectedAlert.status)} />
                  ) : undefined
                }
                backTo={backTo}
                onNavigate={navigateHref}
                readOnly={Boolean(capabilities?.readOnly)}
              >
                {active === "Pusat Kendali" ? (
                  <Dashboard onNavigate={navigateTo} />
                ) : active === "Kesehatan Infrastruktur" ? (
                  <InfrastructureHealthPage />
                ) : active === "Inventaris Aset" ? (
                  <AssetInventory selectedId={selectedAssetId} onSelectedIdChange={setSelectedAssetId} />
                ) : active === "Backup & Keamanan" ? (
                  <BackupSecurityPage />
                ) : monitoringPages.includes(active as MonitoringName) ? (
                  <MonitoringPage name={active as MonitoringName} />
                ) : lifecyclePages.includes(active as LifecyclePageName) ? (
                  <LifecyclePage
                    name={active as LifecyclePageName}
                    selectedId={selectedLifecycleId}
                    onSelectedIdChange={setSelectedLifecycleId}
                  />
                ) : active === "Alert & Insiden" ? (
                  <AlertIncidentPage selectedId={selectedAlertId} onSelectedIdChange={setSelectedAlertId} />
                ) : active === "Notifikasi & Eskalasi" ? (
                  <NotificationEscalationPage />
                ) : active === "Laporan" ? (
                  <ReportsPage />
                ) : active === "Audit Trail" ? (
                  <AuditTrailPage />
                ) : active === "Administrasi" ? (
                  <AdministrationPage />
                ) : (
                  <Dashboard onNavigate={navigateTo} />
                )}
              </PageLayout>
            </motion.div>
          </AnimatePresence>
        </div>

        <Drawer open={notificationOpen} title="Notifikasi" onClose={() => setNotificationOpen(false)}>
          <div className="mb-3 flex items-center justify-between">
            <span className="type-meta">{unreadCount} belum dibaca</span>
            {unreadCount > 0 && (
              <Button
                variant="link"
                size="sm"
                className="h-auto p-0"
                onClick={() => {
                  const ids = notifications.map((notification) => notification.id)
                  localStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify(ids))
                  setReadNotificationIds(ids)
                }}
              >
                Tandai semua dibaca
              </Button>
            )}
          </div>
          <div className="flex flex-col gap-2">
            {notifications.length === 0 ? (
              <p className="rounded-xl border border-dashed border-border p-6 text-center type-meta">Tidak ada notifikasi</p>
            ) : (
              notifications.map((notification) => {
                const isUnread = !readNotificationIds.includes(notification.id)
                return (
                  <button
                    key={notification.id}
                    type="button"
                    className={cn(
                      "flex flex-col gap-1 rounded-xl border p-3 text-left outline-none transition-colors hover:bg-muted focus-visible:ring-2 focus-visible:ring-ring",
                      isUnread ? "border-primary/30 bg-primary/[0.05]" : "border-border bg-card",
                    )}
                    onClick={() => handleNotificationClick(notification)}
                  >
                    <span className="flex items-start justify-between gap-3">
                      <strong className="text-[13.5px] font-medium">{notification.title}</strong>
                      {isUnread && (
                        <span className="mt-1.5 size-2 shrink-0 rounded-full bg-primary shadow-[0_0_8px_rgb(255_122_26/80%)]" aria-label="Belum dibaca" />
                      )}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {notification.channel} · {notification.target}
                    </span>
                    <span className="text-[11px] text-muted-foreground/80">{notification.time}</span>
                  </button>
                )
              })
            )}
          </div>
        </Drawer>

        <Drawer open={profileOpen} title="Profil Pengguna" onClose={() => setProfileOpen(false)}>
          <div className="relative mb-5 overflow-hidden rounded-2xl border border-border bg-gradient-to-br from-primary/15 via-card to-card p-5">
            <div className="flex items-center gap-4">
              <span className="grid size-14 place-items-center rounded-2xl border border-primary/30 bg-primary/15 text-lg font-semibold text-primary">
                {currentUser.initials}
              </span>
              <div className="min-w-0">
                <p className="truncate text-base font-semibold">{currentUser.name}</p>
                <p className="truncate text-sm text-muted-foreground">{currentUser.email}</p>
              </div>
            </div>
          </div>
          <dl className="mb-6 grid grid-cols-1 divide-y divide-border rounded-xl border border-border">
            {[
              ["Akses", <span key="r">{currentUser.role}</span>],
              ["Ruang kerja", <span key="w">Bank</span>],
              ["Status", <StatusBadge key="s" status="Aktif" tone="success" />],
            ].map(([label, value]) => (
              <div key={label as string} className="flex items-center justify-between px-4 py-3">
                <dt className="type-label text-muted-foreground">{label}</dt>
                <dd className="text-sm font-medium">{value}</dd>
              </div>
            ))}
          </dl>
          <Button
            variant="outline"
            className="w-full"
            onClick={() => {
              setProfileOpen(false)
              setLogoutOpen(true)
            }}
          >
            <LogOut size={16} />
            Keluar
          </Button>
        </Drawer>

        <ConfirmDialog
          open={logoutOpen}
          title="Keluar dari SYNRA?"
          description="Sesi pengguna akan diakhiri pada perangkat ini."
          confirmLabel="Keluar"
          onClose={() => setLogoutOpen(false)}
          onConfirm={() => {
            setLogoutOpen(false)
            logout()
            setCurrentUser(null)
          }}
        />

        <Toast visible={toastVisible} message={`${unreadCount} notifikasi sistem tersedia`} onClose={closeToast} />
      </div>
      <Toaster />
    </AccessProvider>
  )
}
