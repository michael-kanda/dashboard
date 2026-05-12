// src/components/ui/button.tsx
import * as React from "react"
import { Slot } from "@radix-ui/react-slot"
import { cva, type VariantProps } from "class-variance-authority"

import { cn } from "@/lib/utils"

const buttonVariants = cva(
  "inline-flex items-center justify-center whitespace-nowrap rounded-md text-sm font-medium ring-offset-background transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:pointer-events-none disabled:opacity-50",
  {
    variants: {
      variant: {
        // Primary brand action – uses --dp-brand, works in light and dark
        default:
          "bg-brand text-brand-foreground hover:bg-brand-hover",

        destructive:
          "bg-accent-red text-white hover:bg-accent-red/90",

        // Secondary/neutral – inherits theme border and text via CSS vars
        outline:
          "border border-border text-body bg-surface hover:bg-surface-secondary hover:text-heading",

        secondary:
          "bg-surface-tertiary text-body hover:bg-surface-quaternary",

        ghost:
          "hover:bg-surface-tertiary hover:text-heading",

        link:
          "text-brand underline-offset-4 hover:underline",
      },
      size: {
        default: "h-9 px-3 py-1",
        sm:      "h-9 rounded-md px-3",
        lg:      "h-11 rounded-md px-8",
        icon:    "h-10 w-10",
      },
    },
    defaultVariants: {
      variant: "default",
      size:    "default",
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
