import * as React from "react";
import { cn } from "@/renderer/lib/utils";

export interface PageHeaderProps {
  title: string;
  description?: string;
  actions?: React.ReactNode;
  className?: string;
}

export function PageHeader({
  title,
  description,
  actions,
  className,
}: PageHeaderProps) {
  return (
    <div className={cn("py-6 flex justify-between items-start", className)}>
      <div>
        <h1 className="text-2xl font-extrabold text-[var(--color-foreground)] font-headline tracking-tight">
          {title}
        </h1>
        {description && (
          <p className="text-xs text-[var(--color-outline)] mt-0.5">
            {description}
          </p>
        )}
      </div>
      {actions && <div className="flex gap-2">{actions}</div>}
    </div>
  );
}
