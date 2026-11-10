import { Button as ButtonPrimitive } from "@base-ui/react/button"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"

const buttonVariants = cva(
  "group/button inline-flex shrink-0 items-center justify-center rounded-[var(--radius-control,10px)] border border-transparent bg-clip-padding text-sm font-medium whitespace-nowrap transition-colors outline-none select-none focus-visible:border-ring focus-visible:ring-2 focus-visible:ring-ring/50 disabled:pointer-events-none disabled:opacity-50 disabled:cursor-not-allowed aria-invalid:border-destructive aria-invalid:ring-2 aria-invalid:ring-destructive/20 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4",
  {
    variants: {
      variant: {
        default:
          "bg-primary text-primary-foreground hover:bg-primary/90 border-transparent shadow-none font-medium",
        outline:
          "border border-border bg-card text-foreground hover:bg-muted hover:text-foreground shadow-none font-medium",
        secondary:
          "border border-border bg-card text-foreground hover:bg-muted hover:text-foreground shadow-none font-medium",
        ghost:
          "border-transparent bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground shadow-none font-medium",
        destructive:
          "border-transparent bg-destructive text-destructive-foreground hover:bg-destructive/90 shadow-none font-medium",
        "destructive-outline":
          "border border-destructive/50 bg-card text-destructive hover:bg-destructive/10 shadow-none font-medium",
        link: "text-primary underline-offset-4 hover:underline border-transparent shadow-none font-medium",
      },
      size: {
        default: "h-[38px] px-4 py-2 gap-2 text-sm",
        sm: "h-[32px] px-3 py-1.5 gap-1.5 text-xs",
        lg: "h-[44px] px-5 py-2.5 gap-2 text-base",
        icon: "size-[38px] p-0",
        "icon-sm": "size-[32px] p-0",
        "icon-lg": "size-[44px] p-0",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

function Button({
  className,
  variant = "default",
  size = "default",
  ...props
}: ButtonPrimitive.Props & VariantProps<typeof buttonVariants>) {
  return (
    <ButtonPrimitive
      data-slot="button"
      className={cn(buttonVariants({ variant, size, className }))}
      {...props}
    />
  )
}

export { Button, buttonVariants }
