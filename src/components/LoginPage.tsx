import { Activity, ArrowRight, BellRing, Check, Eye, EyeOff, Loader2, ShieldCheck } from "lucide-react"
import { motion } from "motion/react"
import { type FormEvent, useState } from "react"
import { ApiError } from "../lib/api"
import { login } from "../lib/auth"
import type { SessionUser } from "../lib/useAccess"
import { FormField } from "./ui"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Spotlight } from "@/components/aceternity/spotlight"
import { TextGenerate } from "@/components/aceternity/text-generate"
import { SpotlightCard } from "@/components/aceternity/spotlight-card"

const highlights = [
  { icon: Activity, title: "Early warning", text: "Threshold bertingkat untuk CPU, memori, disk, dan layanan." },
  { icon: BellRing, title: "Eskalasi otomatis", text: "Alert kritis langsung dikirim ke grup Telegram tim NOC." },
  { icon: ShieldCheck, title: "Jejak audit", text: "Setiap perubahan tercatat dan tidak dapat diubah." },
]

function Logo({ className }: { className?: string }) {
  return (
    <span className={className}>
      <img src="/assets/Logo_SYNRA_putih.png" alt="SYNRA" className="hidden h-auto w-full dark:block" />
      <img src="/assets/Logo_SYNRA_hitam.png" alt="SYNRA" className="block h-auto w-full dark:hidden" />
    </span>
  )
}

export default function LoginPage({ onSuccess }: { onSuccess: (user: SessionUser) => void }) {
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
      setFormError(error instanceof ApiError ? error.message : "Gagal masuk. Coba lagi.")
    } finally {
      setLoading(false)
    }
  }

  return (
    <main className="relative grid min-h-dvh overflow-hidden bg-background lg:grid-cols-[1.1fr_1fr]">
      {/* Latar */}
      <div aria-hidden="true" className="bg-grid pointer-events-none absolute inset-0 [mask-image:radial-gradient(ellipse_at_30%_20%,black_25%,transparent_75%)]" />
      <Spotlight className="-top-40 left-0 md:-top-20 md:left-60" />

      {/* Panel kiri: identitas */}
      <section className="relative hidden flex-col justify-between p-12 lg:flex xl:p-16">
        <Logo className="block w-28" />

        <div className="max-w-xl">
          <span className="mb-5 inline-flex items-center gap-2 rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium text-primary">
            <span className="size-1.5 animate-pulse-ring rounded-full bg-primary" aria-hidden="true" />
            Network Operations Center
          </span>
          <h2 className="text-4xl font-semibold leading-tight tracking-tight xl:text-5xl">
            <TextGenerate
              words="Pantau infrastruktur bank sebelum masalah terjadi."
              wordClassName="bg-gradient-to-b from-foreground to-foreground/60 bg-clip-text pb-1 text-transparent"
            />
          </h2>
          <p className="mt-4 max-w-md text-[15px] leading-relaxed text-muted-foreground">
            SYNRA menyatukan monitoring, alert, siklus hidup aset, dan pelaporan dalam satu pusat kendali.
          </p>

          <div className="mt-10 grid gap-3 xl:grid-cols-3">
            {highlights.map((item, index) => (
              <motion.div
                key={item.title}
                initial={{ opacity: 0, y: 12 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.6 + index * 0.1, duration: 0.4 }}
              >
                <SpotlightCard className="h-full bg-card/60 p-4 backdrop-blur">
                  <item.icon size={18} className="mb-3 text-primary" aria-hidden="true" />
                  <p className="text-sm font-medium">{item.title}</p>
                  <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{item.text}</p>
                </SpotlightCard>
              </motion.div>
            ))}
          </div>
        </div>

        <p className="text-xs text-muted-foreground/70">© {new Date().getFullYear()} SYNRA · Infrastructure Intelligence</p>
      </section>

      {/* Panel kanan: formulir */}
      <section className="relative flex items-center justify-center px-4 py-10 sm:px-8">
        <motion.div
          initial={{ opacity: 0, y: 16, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: [0.16, 1, 0.3, 1] }}
          className="relative w-full max-w-[420px]"
        >
          <div
            aria-hidden="true"
            className="absolute -inset-px rounded-[22px] bg-gradient-to-b from-primary/40 via-border to-border opacity-80"
          />
          <div className="relative rounded-[21px] border border-transparent bg-card/95 p-6 shadow-2xl backdrop-blur-xl sm:p-8">
            <Logo className="mb-8 block w-24 lg:hidden" />
            <h1 id="login-title" className="text-2xl font-semibold tracking-tight">
              Selamat datang kembali
            </h1>
            <p className="type-meta mt-1">Masuk dengan akun SYNRA Anda untuk melanjutkan.</p>

            <form className="mt-7 flex flex-col gap-4" onSubmit={submit} noValidate aria-labelledby="login-title">
              <FormField label="Username" error={errors.username}>
                <Input
                  type="text"
                  value={username}
                  onChange={(event) => setUsername(event.target.value)}
                  placeholder="Masukkan username"
                  autoComplete="username"
                  autoCapitalize="none"
                  aria-invalid={Boolean(errors.username)}
                  className="h-11"
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
                    className="h-11 pr-11"
                  />
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="absolute right-1.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    onClick={() => setShowPassword((current) => !current)}
                    aria-label={showPassword ? "Sembunyikan kata sandi" : "Tampilkan kata sandi"}
                  >
                    {showPassword ? <EyeOff size={17} /> : <Eye size={17} />}
                  </Button>
                </div>
              </FormField>

              <button
                type="button"
                className="-mt-1 self-end text-xs text-muted-foreground transition-colors hover:text-primary"
                onClick={() => setFormError("Hubungi administrator untuk pemulihan akses")}
              >
                Lupa kata sandi?
              </button>

              {formError && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  className="rounded-lg border border-danger/30 bg-danger/10 px-3 py-2.5 text-[13px] text-danger"
                  role="alert"
                >
                  {formError}
                </motion.div>
              )}

              <Button
                className="group relative h-11 w-full overflow-hidden text-[14px] shadow-[0_8px_24px_-8px_rgb(255_122_26/70%)]"
                type="submit"
                disabled={loading || success}
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-0 -translate-x-full bg-gradient-to-r from-transparent via-white/25 to-transparent transition-transform duration-700 group-hover:translate-x-full"
                />
                {loading ? (
                  <>
                    <Loader2 className="animate-spin" /> Memeriksa
                  </>
                ) : success ? (
                  <>
                    <Check /> Berhasil
                  </>
                ) : (
                  <>
                    Masuk <ArrowRight className="transition-transform group-hover:translate-x-0.5" />
                  </>
                )}
              </Button>

              <div className="my-1 flex items-center gap-3 text-xs text-muted-foreground">
                <span className="h-px flex-1 bg-border" />
                atau lanjutkan dengan
                <span className="h-px flex-1 bg-border" />
              </div>

              <Button
                type="button"
                variant="outline"
                className="h-11 w-full"
                onClick={() => setFormError("Koneksi SSO AD/LDAP belum tersedia")}
              >
                Masuk dengan SSO (AD/LDAP)
              </Button>
            </form>
          </div>
        </motion.div>
      </section>
    </main>
  )
}
