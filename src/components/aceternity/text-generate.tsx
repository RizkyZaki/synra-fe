import { motion, useReducedMotion } from "motion/react"
import { cn } from "@/lib/utils"

/** Teks yang muncul kata demi kata dengan efek blur (Aceternity "text generate effect"). */
export function TextGenerate({
  words,
  className,
  wordClassName,
}: {
  words: string
  className?: string
  /** Kelas per kata; efek seperti bg-clip-text harus dipasang di sini, bukan di pembungkus. */
  wordClassName?: string
}) {
  const reduce = useReducedMotion()
  return (
    <span className={cn("inline", className)}>
      {words.split(" ").map((word, index) => (
        <motion.span
          key={`${word}-${index}`}
          className={cn("inline-block", wordClassName)}
          initial={reduce ? false : { opacity: 0, filter: "blur(8px)", y: 4 }}
          animate={{ opacity: 1, filter: "blur(0px)", y: 0 }}
          transition={{ duration: 0.45, delay: 0.15 + index * 0.06 }}
        >
          {word}&nbsp;
        </motion.span>
      ))}
    </span>
  )
}
