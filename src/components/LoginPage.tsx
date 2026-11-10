import { Eye, EyeOff } from "lucide-react"
import { type FormEvent, useState } from "react"
import { ApiError } from "../lib/api"
import { login } from "../lib/auth"
import type { SessionUser } from "../lib/useAccess"
import { FormField } from "./ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

const iconProps = {
  size: 18,
  strokeWidth: 1.75,
  "aria-hidden": true,
} as const

export default function LoginPage({
  onSuccess,
}: {
  onSuccess: (user: SessionUser) => void
}) {
  const [username, setUsername] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [formError, setFormError] = useState("")
  const [errors, setErrors] = useState({ username: "", password: "" })

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors = {
      username: !username.trim() ? "Username wajib diisi" : "",
      password: !password ? "Kata sandi wajib diisi" : "",
    }
    setErrors(nextErrors)
    setFormError("")
    if (nextErrors.username || nextErrors.password) return

    setLoading(true)
    try {
      const user = await login(username.trim(), password)
      setSuccess(true)
      window.setTimeout(() => onSuccess(user), 350)
    } catch (error) {
      // Pesan dari backend (salah password, sisa percobaan, akun terkunci) ditampilkan apa adanya.
      setFormError(
        error instanceof ApiError ? error.message : "Gagal masuk. Coba lagi.",
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="login-page">
      <section className="login-card glass-card" aria-labelledby="login-title">
        <div className="login-card__brand">
          <img
            src="/assets/Logo_SYNRA_putih.png"
            alt="SYNRA"
            className="login-logo"
          />
          <h1 id="login-title" className="type-page-title">
            Masuk
          </h1>
          <p className="type-meta text-muted-foreground">Infrastructure Intelligence</p>
        </div>

        <form className="login-form" onSubmit={submit} noValidate>
          <FormField label="Username" error={errors.username}>
            <Input
              type="text"
              value={username}
              onChange={(event) => setUsername(event.target.value)}
              placeholder="Masukkan username"
              autoComplete="username"
              autoCapitalize="none"
              aria-invalid={Boolean(errors.username)}
            />
          </FormField>

          <FormField label="Kata sandi" error={errors.password}>
            <div className="relative w-full">
              <Input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Masukkan kata sandi"
                autoComplete="current-password"
                aria-invalid={Boolean(errors.password)}
                className="pr-10"
              />
              <Button
                type="button"
                variant="ghost"
                size="icon"
                className="absolute right-1 top-1/2 -translate-y-1/2 size-7 text-muted-foreground hover:text-foreground"
                onClick={() => setShowPassword((current) => !current)}
                aria-label={
                  showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"
                }
              >
                {showPassword ? (
                  <EyeOff {...iconProps} />
                ) : (
                  <Eye {...iconProps} />
                )}
              </Button>
            </div>
          </FormField>

          <button
            type="button"
            className="forgot-password type-meta"
            onClick={() =>
              setFormError("Hubungi administrator untuk pemulihan akses")
            }
          >
            Lupa kata sandi?
          </button>

          {formError && (
            <div className="login-error type-meta" role="alert">
              {formError}
            </div>
          )}

          <Button
            className="login-submit w-full"
            type="submit"
            disabled={loading || success}
          >
            {loading ? (
              "Memeriksa"
            ) : success ? (
              "Berhasil"
            ) : (
              "Masuk"
            )}
          </Button>

          <div className="login-divider type-meta">
            <span>atau lanjutkan dengan</span>
          </div>

          <Button
            type="button"
            variant="outline"
            className="login-submit w-full"
            onClick={() =>
              setFormError("Koneksi SSO AD/LDAP belum tersedia")
            }
          >
            Masuk dengan SSO (AD/LDAP)
          </Button>
        </form>
      </section>
    </main>
  )
}
