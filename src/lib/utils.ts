export { cn } from "cn"

export const menuContentClass =
  "z-50 min-w-[var(--anchor-width,144px)] overflow-x-hidden overflow-y-auto rounded-[var(--menu-radius,12px)] border border-border bg-popover p-[var(--menu-padding,4px)] text-popover-foreground shadow-[var(--menu-shadow)] duration-100 outline-none data-open:animate-in data-open:fade-in-0 data-open:zoom-in-95 data-closed:animate-out data-closed:fade-out-0 data-closed:zoom-out-95"

export const menuItemClass =
  "relative flex w-full cursor-default items-center gap-2 rounded-[calc(var(--menu-radius,12px)-4px)] px-[var(--menu-item-px,12px)] h-[var(--menu-item-height,36px)] text-sm outline-hidden select-none hover:bg-muted focus:bg-muted focus:text-foreground data-highlighted:bg-muted data-highlighted:text-foreground data-disabled:pointer-events-none data-disabled:opacity-50 data-[state=checked]:text-primary data-[state=checked]:font-medium [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4"
