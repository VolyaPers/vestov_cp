import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-[1rem] text-sm font-semibold ring-offset-background transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50 transform-gpu",
  {
    variants: {
      variant: {
        default: "border border-blue-200/70 bg-[linear-gradient(180deg,rgba(255,255,255,0.34),rgba(255,255,255,0.14)),rgba(37,99,235,0.2)] text-blue-700 shadow-[inset_0_1px_0_rgba(255,255,255,0.72),0_18px_34px_-20px_rgba(37,99,235,0.28)] backdrop-blur-xl hover:-translate-y-0.5 hover:border-blue-300/80 hover:bg-[linear-gradient(180deg,rgba(255,255,255,0.42),rgba(255,255,255,0.18)),rgba(37,99,235,0.24)] hover:text-blue-800 hover:shadow-[inset_0_1px_0_rgba(255,255,255,0.8),0_24px_40px_-20px_rgba(37,99,235,0.3)]",
        destructive:
          "bg-destructive text-destructive-foreground shadow-[0_18px_34px_-18px_hsl(var(--destructive)/0.46)] hover:-translate-y-0.5 hover:bg-destructive/95",
        outline:
          "border border-border/70 bg-background/78 shadow-[0_14px_30px_-24px_rgba(15,23,42,0.35)] backdrop-blur-xl hover:-translate-y-0.5 hover:border-slate-300 hover:bg-white/92 hover:text-accent-foreground",
        secondary:
          "border border-white/70 bg-secondary/86 text-secondary-foreground shadow-[inset_0_1px_0_rgba(255,255,255,0.7),0_14px_30px_-24px_rgba(15,23,42,0.28)] hover:-translate-y-0.5 hover:bg-white/92",
        ghost: "hover:bg-white/72 hover:text-accent-foreground",
        link: "text-primary underline-offset-4 hover:underline",
      },
      size: {
        default: "h-11 px-4 py-2",
        sm: "h-9 rounded-[0.85rem] px-3",
        lg: "h-12 rounded-[1.05rem] px-8",
        icon: "h-11 w-11 rounded-[1rem]",
      },
    },
    defaultVariants: {
      variant: "default",
      size: "default",
    },
  }
)

export interface ButtonProps
  extends React.ButtonHTMLAttributes<HTMLButtonElement>,
    VariantProps<typeof buttonVariants> {
  asChild?: boolean
}

const Button = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant, size, asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button"
    return (
      <Comp
        className={cn(buttonVariants({ variant, size, className }))}
        ref={ref}
        {...props}
      />
    )
  }
)
Button.displayName = "Button"

export { Button, buttonVariants }
