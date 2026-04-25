import * as React from "react";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/renderer/lib/utils";

const statusBadgeVariants = cva(
  "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase tracking-tight",
  {
    variants: {
      variant: {
        success:
          "bg-teal-50 border-teal-100 text-teal-700",
        warning:
          "bg-amber-50 border-amber-100 text-amber-700",
        error:
          "bg-red-50 border-red-100 text-red-700",
        info:
          "bg-blue-50 border-blue-100 text-blue-700",
        neutral:
          "bg-slate-100 border-slate-200 text-slate-600",
      },
      size: {
        default: "",
        sm: "px-1.5 py-0 text-[9px]",
      },
    },
    defaultVariants: {
      variant: "neutral",
      size: "default",
    },
  }
);

export interface StatusBadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof statusBadgeVariants> {
  pulse?: boolean;
  dotOnly?: boolean;
}

export const StatusBadge = React.forwardRef<HTMLSpanElement, StatusBadgeProps>(
  (
    {
      className,
      variant,
      size,
      pulse,
      dotOnly,
      children,
      ...props
    },
    ref
  ) => {
    if (dotOnly) {
      return (
        <span
          ref={ref}
          className={cn(
            "inline-block w-1.5 h-1.5 rounded-full",
            variant === "success" && "bg-teal-600",
            variant === "warning" && "bg-amber-600",
            variant === "error" && "bg-red-600",
            variant === "info" && "bg-blue-600",
            variant === "neutral" && "bg-slate-400",
            pulse && "animate-pulse",
            className
          )}
          {...props}
        />
      );
    }

    return (
      <span
        ref={ref}
        className={cn(statusBadgeVariants({ variant, size }), className)}
        {...props}
      >
        {children}
      </span>
    );
  }
);
StatusBadge.displayName = "StatusBadge";

export interface ConnectionStatusProps {
  graphConnected?: boolean;
  exchangeActive?: boolean;
  className?: string;
}

export function ConnectionStatus({
  graphConnected = false,
  exchangeActive = false,
  className,
}: ConnectionStatusProps) {
  return (
    <div className={cn("flex items-center gap-3 pr-4 border-r border-[var(--color-outline-variant)]/30", className)}>
      <div className="flex items-center gap-1.5 py-1 px-2.5 rounded-full bg-teal-50 border border-teal-100">
        <StatusBadge
          variant={graphConnected ? "success" : "warning"}
          pulse={graphConnected}
          dotOnly
        />
        <span className="text-[11px] font-bold text-teal-700 uppercase tracking-tight">
          Graph {graphConnected ? "Connected" : "Offline"}
        </span>
      </div>
      <div className="flex items-center gap-1.5 py-1 px-2.5 rounded-full bg-teal-50 border border-teal-100">
        <StatusBadge
          variant={exchangeActive ? "success" : "warning"}
          dotOnly
        />
        <span className="text-[11px] font-bold text-teal-700 uppercase tracking-tight">
          Exchange {exchangeActive ? "Active" : "Inactive"}
        </span>
      </div>
    </div>
  );
}
