import { Eye, EyeOff } from "lucide-react"
import { type FormEvent, useState } from "react"
import { ApiError } from "../lib/api"
import { login } from "../lib/auth"
import type { SessionUser } from "../lib/useAccess"
import { FormField } from "./ui"

const iconProps = {
  size: 20,
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
      <div className="login-ambient" aria-hidden="true">
        <span className="login-shape login-shape--one" />
        <span className="login-shape login-shape--two" />
        <span className="login-shape login-shape--three" />
        <span className="login-shape login-shape--four" />
      </div>

      <section className="login-card glass-card" aria-labelledby="login-title">
        <div className="login-card__brand">
          <img
            src="/assets/Logo_SYNRA_putih.png"
            alt="SYNRA"
            className="login-logo"
          />
          <h1 id="login-title" className="title-h3">
            Masuk
          </h1>
          <p className="small-copy text-muted">Infrastructure Intelligence</p>
        </div>

        <form className="login-form" onSubmit={submit} noValidate>
          <FormField label="Username" error={errors.username}>
            <span className="login-input">
              <input
                type="text"
                value={username}
                onChange={(event) => setUsername(event.target.value)}
                placeholder="Masukkan username"
                autoComplete="username"
                autoCapitalize="none"
                aria-invalid={Boolean(errors.username)}
              />
            </span>
          </FormField>

          <FormField label="Kata sandi" error={errors.password}>
            <span className="login-input">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(event) => setPassword(event.target.value)}
                placeholder="Masukkan kata sandi"
                autoComplete="current-password"
                aria-invalid={Boolean(errors.password)}
              />
              <button
                type="button"
                className="login-input__action"
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
              </button>
            </span>
          </FormField>

          <button
            type="button"
            className="forgot-password"
            onClick={() =>
              setFormError("Hubungi administrator untuk pemulihan akses")
            }
          >
            Lupa kata sandi?
          </button>

          {formError && (
            <div className="login-error small-copy" role="alert">
              {formError}
            </div>
          )}

          <button
            className="button button--primary login-submit"
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
          </button>

          <div className="login-divider">
            <span>atau lanjutkan dengan</span>
          </div>

          <button
            type="button"
            className="button button--secondary login-submit"
            onClick={() =>
              setFormError("Koneksi SSO AD/LDAP belum tersedia")
            }
          >
            Masuk dengan SSO (AD/LDAP)
          </button>
        </form>
      </section>
    </main>
  )
}
