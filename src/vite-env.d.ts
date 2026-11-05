/// <reference types="vite/client" />

interface ImportMetaEnv {
  /** Base URL API backend. Default "/api/v1" (diteruskan proxy Vite saat dev). */
  readonly VITE_API_URL?: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
