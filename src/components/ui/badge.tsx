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
          "inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2",
          {
            "border-primary/10 bg-primary/10 text-primary hover:bg-primary/15": variant === 'default',
            "border-white/70 bg-secondary/85 text-secondary-foreground hover:bg-secondary/95": variant === 'secondary',
            "border-destructive/10 bg-destructive/10 text-destructive hover:bg-destructive/15": variant === 'destructive',
            "border-border/60 bg-background/72 text-foreground": variant === 'outline',
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
