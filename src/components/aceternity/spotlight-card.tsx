import { motion, useMotionTemplate, useMotionValue } from "motion/react"
import type { ComponentProps, MouseEvent } from "react"
import { cn } from "@/lib/utils"

/**
 * Kartu dengan sorotan yang mengikuti kursor (Aceternity "card spotlight").
 * Garis tepi ikut menyala di posisi kursor sehingga kartu terasa hidup tanpa mengganggu isi.
 */
export function SpotlightCard({
  className,
  children,
  glow = "var(--glow)",
  radius = 320,
  onMouseMove,
  ...props
}: ComponentProps<"div"> & { glow?: string; radius?: number }) {
  const x = useMotionValue(-radius)
  const y = useMotionValue(-radius)

  const handleMove = (event: MouseEvent<HTMLDivElement>) => {
    const rect = event.currentTarget.getBoundingClientRect()
    x.set(event.clientX - rect.left)
    y.set(event.clientY - rect.top)
    onMouseMove?.(event)
  }

  const fill = useMotionTemplate`radial-gradient(${radius}px circle at ${x}px ${y}px, ${glow}, transparent 70%)`
  const ring = useMotionTemplate`radial-gradient(${radius * 0.6}px circle at ${x}px ${y}px, rgb(255 140 50 / 45%), transparent 70%)`

  return (
    <div
      className={cn(
        "group/spot relative overflow-hidden rounded-[var(--radius-surface)] border border-border bg-card",
        className,
      )}
      onMouseMove={handleMove}
      {...props}
    >
      {/* Tepi yang menyala */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 rounded-[inherit] opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100"
        style={{
          background: ring,
          padding: 1,
          mask: "linear-gradient(#000 0 0) content-box exclude, linear-gradient(#000 0 0)",
          WebkitMask: "linear-gradient(#000 0 0) content-box, linear-gradient(#000 0 0)",
          WebkitMaskComposite: "xor",
        }}
      />
      {/* Cahaya isi */}
      <motion.div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 opacity-0 transition-opacity duration-300 group-hover/spot:opacity-100"
        style={{ background: fill }}
      />
      <div className="relative h-full">{children}</div>
    </div>
  )
}
