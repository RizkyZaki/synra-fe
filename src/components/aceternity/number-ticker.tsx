import { animate, useInView, useReducedMotion } from "motion/react"
import { useEffect, useRef } from "react"

/**
 * Menganimasikan angka di dalam teks (misal "98,4%" atau "12") dari 0 ke nilainya.
 * Teks non-angka ditampilkan apa adanya.
 */
export function NumberTicker({ value, className }: { value: string; className?: string }) {
  const ref = useRef<HTMLSpanElement>(null)
  const inView = useInView(ref, { once: true })
  const reduce = useReducedMotion()

  const match = value.match(/^([^\d-]*)(-?[\d.,]+)(.*)$/)

  useEffect(() => {
    const node = ref.current
    if (!node || !match || !inView || reduce) return
    const [, prefix, raw, suffix] = match
    // Format Indonesia: titik ribuan, koma desimal.
    const decimals = raw.includes(",") ? raw.split(",")[1].length : 0
    const target = Number(raw.replace(/\./g, "").replace(",", "."))
    if (!Number.isFinite(target)) return
    const fmt = new Intl.NumberFormat("id-ID", {
      minimumFractionDigits: decimals,
      maximumFractionDigits: decimals,
    })
    const controls = animate(0, target, {
      duration: 1.1,
      ease: [0.16, 1, 0.3, 1],
      onUpdate: (v) => {
        node.textContent = `${prefix}${fmt.format(v)}${suffix}`
      },
    })
    return () => controls.stop()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, inView, reduce])

  return (
    <span ref={ref} className={className}>
      {value}
    </span>
  )
}
