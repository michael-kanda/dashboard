// src/components/ui/skeleton.tsx
import { cn } from "@/lib/utils"

function Skeleton({
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  return (
    <div
      // bg-border-strong references --dp-border-strong which is
      // #d1d5db in light mode and #334155 in dark mode → correct skeleton tone in both
      className={cn("animate-pulse rounded-md bg-border-strong/50", className)}
      {...props}
    />
  )
}

export { Skeleton }
