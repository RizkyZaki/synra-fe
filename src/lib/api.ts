// Client HTTP ke backend SYNRA. Saat dev, "/api" diteruskan oleh proxy Vite ke backend.
const API_BASE = import.meta.env.VITE_API_URL ?? "/api/v1"
const TOKEN_KEY = "synra-access-token"

/** Event yang dikirim saat token tidak valid/kedaluwarsa agar App kembali ke halaman login. */
export const UNAUTHORIZED_EVENT = "synra:unauthorized"

export class ApiError extends Error {
  constructor(
    message: string,
    readonly status: number,
    readonly errors: string[] = [],
  ) {
    super(message)
  }
}

export const tokenStore = {
  get: () => localStorage.getItem(TOKEN_KEY),
  set: (token: string) => localStorage.setItem(TOKEN_KEY, token),
  clear: () => localStorage.removeItem(TOKEN_KEY),
}

export async function apiFetch<T>(
  path: string,
  init: RequestInit = {},
): Promise<T> {
  const token = tokenStore.get()
  const headers = new Headers(init.headers)
  if (init.body && !(init.body instanceof FormData)) {
    headers.set("Content-Type", "application/json")
  }
  if (token) headers.set("Authorization", `Bearer ${token}`)

  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, { ...init, headers })
  } catch {
    throw new ApiError("Tidak dapat terhubung ke server SYNRA", 0)
  }

  if (response.status === 204) return undefined as T

  const body = await response.json().catch(() => null)
  if (!response.ok) {
    // 401 pada request ber-token berarti sesi berakhir; login gagal ditangani pemanggil.
    if (response.status === 401 && token) {
      tokenStore.clear()
      window.dispatchEvent(new Event(UNAUTHORIZED_EVENT))
    }
    throw new ApiError(
      body?.message ?? "Terjadi kesalahan pada server",
      response.status,
      body?.errors ?? [],
    )
  }
  return body as T
}

/** Mengunduh file dari endpoint ber-auth (ekspor laporan/audit). */
export async function apiDownload(path: string, fallbackName: string): Promise<void> {
  const token = tokenStore.get()
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    })
  } catch {
    throw new ApiError("Tidak dapat terhubung ke server SYNRA", 0)
  }
  if (!response.ok) {
    const body = await response.json().catch(() => null)
    throw new ApiError(body?.message ?? "Gagal mengunduh file", response.status)
  }
  const disposition = response.headers.get("Content-Disposition") ?? ""
  const name = disposition.match(/filename="?([^"]+)"?/)?.[1] ?? fallbackName
  const url = URL.createObjectURL(await response.blob())
  const link = document.createElement("a")
  link.href = url
  link.download = name
  link.click()
  URL.revokeObjectURL(url)
}

/** Event saat login/logout agar store memuat atau mengosongkan data. */
export const SESSION_EVENT = "synra:session"

/** Membuka file dari endpoint ber-auth di tab baru (lampiran gambar/PDF) atau mengunduhnya. */
export async function apiOpenFile(path: string, fileName: string, inline: boolean): Promise<void> {
  const token = tokenStore.get()
  // Tab dibuka lebih dulu (masih dalam gestur klik) agar tidak diblokir popup blocker.
  const tab = inline ? window.open("", "_blank") : null
  let response: Response
  try {
    response = await fetch(`${API_BASE}${path}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} })
  } catch {
    tab?.close()
    throw new ApiError("Tidak dapat terhubung ke server SYNRA", 0)
  }
  if (!response.ok) {
    tab?.close()
    const body = await response.json().catch(() => null)
    throw new ApiError(body?.message ?? "Gagal membuka file", response.status)
  }
  const url = URL.createObjectURL(await response.blob())
  if (tab) {
    tab.location.href = url
  } else {
    const link = document.createElement("a")
    link.href = url
    link.download = fileName
    link.click()
  }
  setTimeout(() => URL.revokeObjectURL(url), 60_000)
}
