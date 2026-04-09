import * as React from "react";
import { cn } from "@/renderer/lib/utils";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
} from "@/renderer/components/ui/card";

export interface StatCardProps {
  label: string;
  value: string | number;
  trend?: string;
  trendType?: "success" | "warning" | "error" | "neutral";
  icon?: React.ReactNode;
  className?: string;
}

export function StatCard({
  label,
  value,
  trend,
  trendType = "neutral",
  icon,
  className,
}: StatCardProps) {
  const trendColors = {
    success: "text-teal-600",
    warning: "text-amber-600",
    error: "text-red-600",
    neutral: "text-muted-foreground",
  };

  return (
    <Card className={cn("bg-white border-[var(--color-outline-variant)] rounded-lg shadow-sm", className)}>
      <CardHeader className="p-3 pb-0 space-y-0">
        <CardTitle className="text-[10px] font-bold text-[var(--color-outline)] uppercase tracking-wider">
          {label}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 pt-1">
        <div className="flex items-end gap-2">
          <span className="text-xl font-extrabold text-[var(--color-foreground)]">
            {value}
          </span>
          {trend && (
            <span
              className={cn(
                "text-[10px] font-bold mb-1",
                trendColors[trendType]
              )}
            >
              {trend}
            </span>
          )}
        </div>
        {icon && <div className="mt-2">{icon}</div>}
      </CardContent>
    </Card>
  );
}