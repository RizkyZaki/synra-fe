import { Eye, EyeOff } from "lucide-react"
import { type FormEvent, useState } from "react"
import { SAMPLE_users } from "../seed"
import { FormField } from "./ui"

const iconProps = {
  size: 20,
  strokeWidth: 1.75,
  "aria-hidden": true,
} as const

export default function LoginPage({
  onSuccess,
}: {
  onSuccess: (email: string) => void
}) {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [success, setSuccess] = useState(false)
  const [formError, setFormError] = useState("")
  const [errors, setErrors] = useState({ email: "", password: "" })

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault()
    const nextErrors = {
      email: !email
        ? "Email wajib diisi"
        : !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
          ? "Format email tidak valid"
          : "",
      password: !password ? "Kata sandi wajib diisi" : "",
    }
    setErrors(nextErrors)
    setFormError("")
    if (nextErrors.email || nextErrors.password) return

    setLoading(true)
    await new Promise((resolve) => window.setTimeout(resolve, 450))

    const user = SAMPLE_users.find(
      (candidate) =>
        candidate.email.toLowerCase() === email.trim().toLowerCase(),
    )

    if (!user) {
      setLoading(false)
      setFormError("Email atau kata sandi salah")
      return
    }

    setSuccess(true)
    window.setTimeout(() => onSuccess(user.email), 350)
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
          <FormField label="Email" error={errors.email}>
            <span className="login-input">
              <input
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder="nama@bank.co.id"
                autoComplete="email"
                aria-invalid={Boolean(errors.email)}
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
