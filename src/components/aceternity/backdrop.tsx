import { cn } from "@/lib/utils"

/**
 * Latar halaman: grid halus yang memudar ke bawah plus pendaran oranye di atas.
 * Diletakkan sekali di belakang konten aplikasi.
 */
export function AppBackdrop({ className }: { className?: string }) {
  return (
    <div aria-hidden="true" className={cn("pointer-events-none fixed inset-0 -z-10 overflow-hidden", className)}>
      <div className="bg-grid mask-radial absolute inset-0" />
      <div className="absolute -top-48 left-1/2 h-[420px] w-[980px] -translate-x-1/2 rounded-full bg-[radial-gradient(closest-side,var(--glow),transparent)] blur-2xl" />
    </div>
  )
}
