import {
  Bell,
  ChevronDown,
  LogOut,
  Menu,
  Moon,
  Search,
  Sun,
  X,
} from "lucide-react"
import {
  type KeyboardEvent as ReactKeyboardEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react"
import {
  ConfirmDialog,
  Drawer,
  PageLayout,
  StatusBadge,
  Toast,
} from "./components/ui"
import { Button } from "@/components/ui/button"
import { Toaster } from "@/components/ui/sonner"
import AdministrationPage from "./components/AdministrationPage"
import AuditTrailPage from "./components/AuditTrailPage"
import Dashboard from "./components/Dashboard"
import AssetInventory from "./components/AssetInventory"
import AlertIncidentPage, { alertStatusTone } from "./components/AlertIncidentPage"
import LifecyclePage, {
  type LifecyclePageName,
} from "./components/LifecyclePage"
import LoginPage from "./components/LoginPage"
import MonitoringPage, {
  type MonitoringName,
} from "./components/MonitoringPage"
import NotificationEscalationPage from "./components/NotificationEscalationPage"
import ReportsPage from "./components/ReportsPage"
import InfrastructureHealthPage from "./components/InfrastructureHealthPage"
import { AccessProvider, type SessionUser } from "./lib/useAccess"
import { UNAUTHORIZED_EVENT } from "./lib/api"
import { logout, restoreSession } from "./lib/auth"
import { useSynraStore } from "./lib/useSynraStore"
import type { NotificationItem } from "./lib/synraDomain"
import { can, roleCapabilities } from "./seed"

type Theme = "dark" | "light"
const LEGACY_AUTH_STORAGE_KEY = "synra-auth-user-id"
const READ_NOTIFICATIONS_KEY = "synra-read-notification-ids"
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

const iconProps = {
  strokeWidth: 1.75,
  "aria-hidden": true,
} as const

const dashboardItem: NavItem = {
  label: "Pusat Kendali",
  description: "Ringkasan operasional infrastruktur",
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
    label: "Aset",
    mobileLabel: "ASET",
    items: [
      {
        label: "Inventaris Aset",
        description: "Kelola seluruh aset TI bank",
      },
    ],
  },
  {
    label: "Monitoring",
    mobileLabel: "MONITORING",
    items: [
      {
        label: "Infrastruktur",
        description: "Pantau server dan jaringan utama",
      },
      {
        label: "Database",
        description: "Kondisi dan performa basis data",
      },
      {
        label: "Storage & Kapasitas",
        description: "Utilisasi dan proyeksi kapasitas",
      },
      {
        label: "Availability & Performa",
        description: "Ketersediaan dan metrik layanan",
      },
      {
        label: "Backup & Keamanan",
        description: "Status backup dan kontrol keamanan",
      },
    ],
  },
  {
    label: "Lifecycle",
    mobileLabel: "LIFECYCLE",
    items: [
      {
        label: "Lifecycle OS",
        description: "Siklus dukungan sistem operasi",
      },
      {
        label: "Lisensi Software",
        description: "Alokasi dan masa berlaku lisensi",
      },
      {
        label: "Sertifikat SSL/TLS",
        description: "Pantau sertifikat dan kedaluwarsa",
      },
      {
        label: "Garansi Hardware",
        description: "Masa perlindungan perangkat keras",
      },
      {
        label: "Kontrak Vendor",
        description: "Kontrak dan jadwal perpanjangan",
      },
    ],
  },
  {
    label: "Operasi",
    mobileLabel: "OPERASI",
    items: [
      {
        label: "Alert & Insiden",
        description: "Kelola alert dan penanganan insiden",
      },
      {
        label: "Notifikasi & Eskalasi",
        description: "Atur kanal dan jalur eskalasi",
      },
    ],
  },
  {
    label: "Tata Kelola",
    mobileLabel: "TATA KELOLA",
    items: [
      {
        label: "Laporan",
        description: "Ringkasan dan laporan operasional",
      },
      {
        label: "Audit Trail",
        description: "Riwayat aktivitas dan perubahan",
      },
      {
        label: "Administrasi",
        description: "Pengguna dan parameter sistem",
      },
    ],
  },
]

const routeConfig: Record<string, RouteDefinition> = {
  "Pusat Kendali": {
    href: "#/pusat-kendali",
    eyebrow: "UTAMA",
  },
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

const detailRouteConfig: Record<
  DetailRoute,
  { eyebrow: string; parent: (active: string) => string }
> = {
  asset: { eyebrow: "ASET", parent: () => "Inventaris Aset" },
  alert: { eyebrow: "OPERASI", parent: () => "Alert & Insiden" },
  lifecycle: { eyebrow: "LIFECYCLE", parent: (active) => active },
}

function moveDropdownFocus(
  event: ReactKeyboardEvent<HTMLElement>,
  direction: 1 | -1,
) {
  event.preventDefault()
  const menu = event.currentTarget.closest('[role="menu"]')
  const items = Array.from(
    menu?.querySelectorAll<HTMLButtonElement>('[role="menuitem"]') ?? [],
  )
  const index = items.indexOf(event.currentTarget as HTMLButtonElement)
  items[(index + direction + items.length) % items.length]?.focus()
}

function BrandLogo({ onClick }: { onClick: () => void }) {
  return (
    <button
      className="navbar__brand"
      onClick={onClick}
      aria-label="Buka Pusat Kendali"
    >
      <img
        className="brand-logo brand-logo--dark"
        src="/assets/Logo_SYNRA_putih.png"
        alt="SYNRA"
      />
      <img
        className="brand-logo brand-logo--light"
        src="/assets/Logo_SYNRA_hitam.png"
        alt="SYNRA"
      />
    </button>
  )
}

function DesktopNavigation({
  active,
  onSelect,
  groups,
}: {
  active: string
  onSelect: (label: string) => void
  groups: NavGroup[]
}) {
  const [openMenu, setOpenMenu] = useState<string | null>(null)

  useEffect(() => {
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpenMenu(null)
    }
    document.addEventListener("keydown", closeOnEscape)
    return () => document.removeEventListener("keydown", closeOnEscape)
  }, [])

  return (
    <nav className="desktop-nav" aria-label="Navigasi utama">
      <button
        className={`navbar-link ${
          active === dashboardItem.label ? "navbar-link--active" : ""
        }`}
        onClick={() => {
          onSelect(dashboardItem.label)
          setOpenMenu(null)
        }}
      >
        {dashboardItem.label}
      </button>

      {groups.map((group) => {
        const groupActive = group.items.some((item) => item.label === active)
        const isOpen = openMenu === group.label
        return (
          <div
            className="navbar-menu"
            key={group.label}
            onMouseEnter={() => setOpenMenu(group.label)}
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setOpenMenu(null)
              }
            }}
          >
            <button
              className={`navbar-link ${
                groupActive ? "navbar-link--active" : ""
              }`}
              aria-expanded={isOpen}
              aria-haspopup="menu"
              onClick={() => setOpenMenu(isOpen ? null : group.label)}
              onKeyDown={(event) => {
                if (event.key === "ArrowDown") {
                  event.preventDefault()
                  const trigger = event.currentTarget
                  setOpenMenu(group.label)
                  window.requestAnimationFrame(() => {
                    trigger.parentElement
                      ?.querySelector<HTMLButtonElement>('[role="menuitem"]')
                      ?.focus()
                  })
                }
              }}
            >
              {displayLabel(group.label)}
              <ChevronDown {...iconProps} size={16} />
            </button>

            <div
              className={`nav-dropdown glass-card ${
                isOpen ? "nav-dropdown--open" : ""
              }`}
              role="menu"
              aria-label={group.label}
            >
              {group.items.map((item) => {
                return (
                  <button
                    className={`dropdown-item ${
                      item.label === active ? "dropdown-item--active" : ""
                    }`}
                    key={item.label}
                    role="menuitem"
                    tabIndex={isOpen ? 0 : -1}
                    onClick={() => {
                      onSelect(item.label)
                      setOpenMenu(null)
                    }}
                    onKeyDown={(event) => {
                      if (event.key === "ArrowDown") {
                        moveDropdownFocus(event, 1)
                      } else if (event.key === "ArrowUp") {
                        moveDropdownFocus(event, -1)
                      } else if (event.key === "Escape") {
                        setOpenMenu(null)
                        event.currentTarget
                          .closest(".navbar-menu")
                          ?.querySelector<HTMLButtonElement>(".navbar-link")
                          ?.focus()
                      }
                    }}
                  >
                    <span className="dropdown-item__copy">
                      <strong className="small-copy">
                        {displayLabel(item.label)}
                      </strong>
                    </span>
                  </button>
                )
              })}
            </div>
          </div>
        )
      })}
    </nav>
  )
}

function MobileNavigation({
  open,
  active,
  onSelect,
  onClose,
  groups,
}: {
  open: boolean
  active: string
  onSelect: (label: string) => void
  onClose: () => void
  groups: NavGroup[]
}) {
  useEffect(() => {
    if (!open) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose()
    }
    document.addEventListener("keydown", closeOnEscape)
    return () => document.removeEventListener("keydown", closeOnEscape)
  }, [open, onClose])

  const select = (label: string) => {
    onSelect(label)
    onClose()
  }

  return (
    <div className={`mobile-menu ${open ? "mobile-menu--open" : ""}`}>
      <button
        className="mobile-menu__backdrop"
        aria-label="Tutup navigasi"
        onClick={onClose}
      />
      <div className="mobile-menu__panel glass-panel">
        <nav className="mobile-menu__nav" aria-label="Navigasi mobile">
          <div className="mobile-menu__group">
            <span className="type-label text-muted-foreground">UTAMA</span>
            <button
              className={`mobile-menu__item ${
                active === dashboardItem.label
                  ? "mobile-menu__item--active"
                  : ""
              }`}
              onClick={() => select(dashboardItem.label)}
            >
              {dashboardItem.label}
            </button>
          </div>
          {groups.map((group) => (
            <div className="mobile-menu__group" key={group.label}>
              <span className="type-label text-muted-foreground">{group.mobileLabel}</span>
              {group.items.map((item) => {
                return (
                  <button
                    className={`mobile-menu__item ${
                      active === item.label ? "mobile-menu__item--active" : ""
                    }`}
                    key={item.label}
                    onClick={() => select(item.label)}
                  >
                    {displayLabel(item.label)}
                  </button>
                )
              })}
            </div>
          ))}
        </nav>
      </div>
    </div>
  )
}

export default function App() {
  const { read } = useSynraStore()
  const searchInputRef = useRef<HTMLInputElement>(null)
  const [currentUser, setCurrentUser] = useState<SessionUser | null>(null)
  const [sessionChecked, setSessionChecked] = useState(false)
  const [theme, setTheme] = useState<Theme>(() => {
    return localStorage.getItem("synra-theme") as Theme | null ?? "dark"
  })
  const [active, setActive] = useState("Pusat Kendali")
  const [selectedAssetId, setSelectedAssetId] = useState<string | null>(null)
  const [selectedAlertId, setSelectedAlertId] = useState<string | null>(null)
  const [selectedLifecycleId, setSelectedLifecycleId] = useState<string | null>(
    null,
  )
  const [query, setQuery] = useState("")
  const [searchOpen, setSearchOpen] = useState(false)
  const [mobileNavOpen, setMobileNavOpen] = useState(false)
  const [profileMenuOpen, setProfileMenuOpen] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [notificationOpen, setNotificationOpen] = useState(false)
  const [logoutOpen, setLogoutOpen] = useState(false)
  const [toastVisible, setToastVisible] = useState(false)
  const [readNotificationIds, setReadNotificationIds] = useState<string[]>(
    () => {
      try {
        return JSON.parse(
          localStorage.getItem(READ_NOTIFICATIONS_KEY) ?? "[]",
        ) as string[]
      } catch {
        return []
      }
    },
  )

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
    if (theme === "dark") {
      document.documentElement.classList.add("dark")
    } else {
      document.documentElement.classList.remove("dark")
    }
    localStorage.setItem("synra-theme", theme)
  }, [theme])

  useEffect(() => {
    if (!profileMenuOpen) return
    const closeOnEscape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setProfileMenuOpen(false)
    }
    document.addEventListener("keydown", closeOnEscape)
    return () => document.removeEventListener("keydown", closeOnEscape)
  }, [profileMenuOpen])

  const closeToast = useCallback(() => setToastVisible(false), [])
  const closeMobileNav = useCallback(() => setMobileNavOpen(false), [])
  const capabilities = currentUser
    ? roleCapabilities.find((item) => item.role === currentUser.role)
    : undefined
  const visibleNavGroups = currentUser
    ? navGroups
        .map((group) => ({
          ...group,
          items: group.items.filter(
            (item) =>
              (item.label !== "Administrasi" ||
                can(currentUser.role, "config")) &&
              // Audit log hanya dapat dibaca ADMIN dan AUDITOR (dibatasi juga di backend).
              (item.label !== "Audit Trail" ||
                ["ADMIN", "AUDITOR"].includes(currentUser.backendRole)),
          ),
        }))
        .filter((group) => group.items.length > 0)
    : navGroups
  const notifications = read("notifications")
  const alerts = read("alerts")
  const unreadCount = notifications.filter(
    (notification) => !readNotificationIds.includes(notification.id),
  ).length
  const clearDetailRoutes = () => {
    setSelectedAssetId(null)
    setSelectedAlertId(null)
    setSelectedLifecycleId(null)
  }
  const navigateTo = (label: string) => {
    clearDetailRoutes()
    setActive(label)
  }
  const navigateHref = (href: string) => {
    const destination = Object.entries(routeConfig).find(
      ([, route]) => route.href === href,
    )?.[0]
    if (destination) navigateTo(destination)
  }
  const handleNotificationClick = (notification: NotificationItem) => {
    if (!readNotificationIds.includes(notification.id)) {
      const nextIds = [...readNotificationIds, notification.id]
      localStorage.setItem(READ_NOTIFICATIONS_KEY, JSON.stringify(nextIds))
      setReadNotificationIds(nextIds)
    }
    setNotificationOpen(false)

    const alertIdMatch =
      notification.alertId ||
      notification.title.match(/ALT-\d+/i)?.[0]?.toUpperCase()

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
        : lifecyclePages.includes(active as LifecyclePageName) &&
            selectedLifecycleId
          ? "lifecycle"
          : null
  const detailParent = detailRoute
    ? detailRouteConfig[detailRoute].parent(active)
    : null
  const selectedAlert =
    detailRoute === "alert" && selectedAlertId
      ? alerts.find((a) => a.id === selectedAlertId)
      : undefined
  const currentRoute = routeConfig[active] ?? routeConfig["Pusat Kendali"]
  const pageTitle =
    detailRoute === "asset"
      ? selectedAssetId!
      : detailRoute === "alert"
        ? selectedAlertId!
        : detailRoute === "lifecycle"
          ? selectedLifecycleId!
          : active
  const pageEyebrow = detailRoute
    ? detailRouteConfig[detailRoute].eyebrow
    : currentRoute.eyebrow
  const parentLabel = detailParent ?? currentRoute.parent
  const backTo = parentLabel
    ? {
        label: displayLabel(parentLabel),
        href: routeConfig[parentLabel].href,
      }
    : undefined

  // Hindari kilasan halaman login saat token tersimpan sedang diverifikasi.
  if (!sessionChecked) return null

  if (!currentUser) {
    return (
      <LoginPage
        onSuccess={(user) => {
          setCurrentUser(user)
          navigateTo("Pusat Kendali")
        }}
      />
    )
  }

  const initials = currentUser.initials

  return (
    <AccessProvider user={currentUser}>
    <div className="app-shell">
      <header className="navbar glass-panel">
        <div className="navbar__left">
          <button
            className="navbar__menu"
            onClick={() => setMobileNavOpen((current) => !current)}
            aria-label={mobileNavOpen ? "Tutup menu" : "Buka menu"}
            aria-expanded={mobileNavOpen}
          >
            {mobileNavOpen ? (
              <X {...iconProps} size={20} />
            ) : (
              <Menu {...iconProps} size={20} />
            )}
          </button>
          <BrandLogo onClick={() => navigateTo(dashboardItem.label)} />
          <DesktopNavigation
            active={active}
            onSelect={navigateTo}
            groups={visibleNavGroups}
          />
        </div>

        <div className="navbar__actions">
          <label
            className={`compact-search ${
              searchOpen || query ? "compact-search--open" : ""
            }`}
          >
            <Search {...iconProps} size={20} />
            <input
              ref={searchInputRef}
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              onFocus={() => setSearchOpen(true)}
              onBlur={() => {
                if (!query) setSearchOpen(false)
              }}
              placeholder="Cari aset, alert, lisensi…"
              aria-label="Cari aset, alert, atau lisensi"
            />
            <button
              type="button"
              className="compact-search__trigger"
              aria-label="Buka pencarian"
              onClick={() => {
                setSearchOpen(true)
                window.requestAnimationFrame(() =>
                  searchInputRef.current?.focus(),
                )
              }}
            />
          </label>

          <button
            className="theme-button icon-button"
            onClick={() =>
              setTheme((current) => (current === "dark" ? "light" : "dark"))
            }
            aria-label={`Aktifkan mode ${
              theme === "dark" ? "terang" : "gelap"
            }`}
          >
            {theme === "dark" ? (
              <Moon {...iconProps} size={20} />
            ) : (
              <Sun {...iconProps} size={20} />
            )}
          </button>

          <button
            className="icon-button notification-button"
            onClick={() => { setProfileMenuOpen(false); setNotificationOpen(true) }}
            aria-label={`${unreadCount} notifikasi belum dibaca`}
          >
            <Bell {...iconProps} size={20} />
            {unreadCount > 0 && (
              <span className="notification-indicator" aria-hidden="true" />
            )}
          </button>

          <div
            className="profile-menu"
            onBlur={(event) => {
              if (!event.currentTarget.contains(event.relatedTarget)) {
                setProfileMenuOpen(false)
              }
            }}
          >
            <button
              className="avatar avatar--button"
              onClick={() => setProfileMenuOpen((current) => !current)}
              aria-label={`Buka menu ${currentUser.name}`}
              aria-expanded={profileMenuOpen}
            >
              {initials}
            </button>
            <div
              className={`profile-dropdown glass-card ${
                profileMenuOpen ? "profile-dropdown--open" : ""
              }`}
            >
              <div className="profile-dropdown__identity">
                <strong className="small-copy">{currentUser.name}</strong>
                <span className="label text-muted">{currentUser.role}</span>
              </div>
              <button
                onClick={() => {
                  setProfileMenuOpen(false)
                  setProfileOpen(true)
                }}
              >
                Profil
              </button>
              <button
                onClick={() => {
                  setProfileMenuOpen(false)
                  setLogoutOpen(true)
                }}
              >
                <LogOut {...iconProps} size={16} />
                Keluar
              </button>
            </div>
          </div>
        </div>
      </header>

      <PageLayout
        eyebrow={pageEyebrow}
        title={displayLabel(pageTitle)}
        badge={
          selectedAlert ? (
            <StatusBadge
              status={selectedAlert.status}
              tone={alertStatusTone(selectedAlert.status)}
            />
          ) : undefined
        }
        backTo={backTo}
        onNavigate={navigateHref}
        readOnly={Boolean(capabilities?.readOnly)}
        headerClassName={
          active === "Administrasi" ? "page-heading--administration" : ""
        }
      >
        {active === "Pusat Kendali" ? (
          <Dashboard onNavigate={navigateTo} />
        ) : active === "Kesehatan Infrastruktur" ? (
          <InfrastructureHealthPage />
        ) : active === "Inventaris Aset" ? (
          <AssetInventory
            selectedId={selectedAssetId}
            onSelectedIdChange={setSelectedAssetId}
          />
        ) : monitoringPages.includes(active as MonitoringName) ? (
          <MonitoringPage name={active as MonitoringName} />
        ) : lifecyclePages.includes(active as LifecyclePageName) ? (
          <LifecyclePage
            name={active as LifecyclePageName}
            selectedId={selectedLifecycleId}
            onSelectedIdChange={setSelectedLifecycleId}
          />
        ) : active === "Alert & Insiden" ? (
          <AlertIncidentPage
            selectedId={selectedAlertId}
            onSelectedIdChange={setSelectedAlertId}
          />
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

      <MobileNavigation
        open={mobileNavOpen}
        active={active}
        onSelect={navigateTo}
        onClose={closeMobileNav}
        groups={visibleNavGroups}
      />

      <Drawer
        open={notificationOpen}
        title="Notifikasi"
        onClose={() => setNotificationOpen(false)}
      >
        <div className="notification-panel__heading">
          <span className="type-meta text-muted-foreground">{unreadCount} belum dibaca</span>
          {unreadCount > 0 && (
            <button
              className="text-action"
              onClick={() => {
                const ids = notifications.map((notification) => notification.id)
                localStorage.setItem(
                  READ_NOTIFICATIONS_KEY,
                  JSON.stringify(ids),
                )
                setReadNotificationIds(ids)
              }}
            >
              Tandai semua dibaca
            </button>
          )}
        </div>
        <div className="notification-panel__list">
          {notifications.length === 0 ? (
            <div className="notification-panel__item type-meta text-muted-foreground">
              Tidak ada notifikasi
            </div>
          ) : (
            notifications.map((notification) => {
              const isUnread = !readNotificationIds.includes(notification.id)
              return (
                <button
                  key={notification.id}
                  type="button"
                  className={`notification-panel__item ${isUnread ? "notification-panel__item--unread" : ""}`}
                  onClick={() => handleNotificationClick(notification)}
                >
                  <div className="notification-panel__item-header">
                    <strong className="type-body font-medium">{notification.title}</strong>
                    {isUnread && (
                      <span
                        className="notification-unread-dot"
                        aria-label="Belum dibaca"
                      />
                    )}
                  </div>
                  <span className="label text-muted">
                    {notification.channel} · {notification.target}
                  </span>
                  <span className="label text-muted">{notification.time}</span>
                </button>
              )
            })
          )}
        </div>
      </Drawer>

      <Drawer
        open={profileOpen}
        title="Profil Pengguna"
        onClose={() => setProfileOpen(false)}
      >
        <div className="drawer-profile">
          <div className="avatar avatar--large">{initials}</div>
          <div>
            <p className="strong">{currentUser.name}</p>
            <p className="type-meta text-muted-foreground">{currentUser.email}</p>
          </div>
        </div>
        <div className="drawer-details">
          <div>
            <span className="label text-muted">Akses</span>
            <strong className="small-copy">{currentUser.role}</strong>
          </div>
          <div>
            <span className="label text-muted">Ruang kerja</span>
            <strong className="small-copy">Bank</strong>
          </div>
          <div>
            <span className="label text-muted">Status</span>
            <StatusBadge status="Aktif" tone="success" />
          </div>
        </div>
        <Button
          variant="outline"
          className="drawer__logout w-full"
          onClick={() => {
            setProfileOpen(false)
            setLogoutOpen(true)
          }}
        >
          <LogOut {...iconProps} size={20} />
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

      <Toast
        visible={toastVisible}
        message={`${unreadCount} notifikasi sistem tersedia`}
        onClose={closeToast}
      />
    </div>
    <Toaster />
    </AccessProvider>
  )
}
