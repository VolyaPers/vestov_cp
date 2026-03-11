import * as React from "react"
import { cn } from "@/lib/utils"

interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'destructive' | 'outline'
}

const Badge = React.forwardRef<HTMLDivElement, BadgeProps>(
  ({ className, variant = 'default', ...props }, ref) => {
    return (
      <div
        ref={ref}
        className={cn(
          "inline-flex items-center rounded-full border px-3 py-1 text-[0.68rem] font-extrabold uppercase tracking-[0.18em] transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          {
            "border-transparent bg-primary/12 text-primary hover:bg-primary/18": variant === 'default',
            "border-transparent bg-secondary text-secondary-foreground hover:bg-secondary/80": variant === 'secondary',
            "border-transparent bg-destructive/12 text-destructive hover:bg-destructive/18": variant === 'destructive',
            "border-border/60 bg-background/70 text-foreground": variant === 'outline',
          },
          className
        )}
        {...props}
      />
    )
  }
)
Badge.displayName = "Badge"

export { Badge }
