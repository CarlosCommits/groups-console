import * as React from "react";
import { Filter } from "lucide-react";
import { cn } from "@/renderer/lib/utils";
import { Button } from "@/renderer/components/ui/button";
import {
  InputGroup,
  InputGroupInput,
} from "@/renderer/components/ui/input-group";

export interface TableToolbarProps {
  searchPlaceholder?: string;
  searchValue?: string;
  onSearch?: (value: string) => void;
  filters?: React.ReactNode;
  actions?: React.ReactNode;
  className?: string;
}

export function TableToolbar({
  searchPlaceholder = "Search...",
  searchValue,
  onSearch,
  filters,
  actions,
  className,
}: TableToolbarProps) {
  return (
    <div
      className={cn(
        "p-2 border-b border-[var(--color-outline-variant)]/10 flex flex-wrap items-center gap-3 bg-slate-50/50",
        className
      )}
    >
      <InputGroup className="flex-1 min-w-[300px] bg-white border-[var(--color-outline-variant)]/30 rounded">
        <InputGroupInput
          className="px-4 text-sm"
          placeholder={searchPlaceholder}
          value={searchValue}
          onChange={(e) => onSearch?.(e.target.value)}
          type="text"
        />
      </InputGroup>
      {filters && <div className="flex gap-2">{filters}</div>}
      {actions && <div className="flex gap-2 ml-auto">{actions}</div>}
    </div>
  );
}

export interface FilterSegmentedControlProps {
  tabs: { label: string; value: string; count?: number }[];
  activeTab: string;
  onTabChange: (value: string) => void;
  className?: string;
}

export function FilterSegmentedControl({
  tabs,
  activeTab,
  onTabChange,
  className,
}: FilterSegmentedControlProps) {
  return (
    <fieldset
      className={cn(
        "flex rounded-md bg-[var(--color-surface-container)] p-1",
        className
      )}
    >
        <legend className="sr-only">View filters</legend>
        {tabs.map((tab) => (
          <button
            key={tab.value}
            type="button"
            aria-pressed={activeTab === tab.value}
            onClick={() => onTabChange(tab.value)}
            className={cn(
              "flex-none rounded px-3 py-1.5 text-xs font-semibold transition-colors",
              activeTab === tab.value
                ? "bg-white text-[var(--color-primary)] shadow-sm"
                : "text-slate-600 hover:text-[var(--color-primary)]"
            )}
          >
            {tab.label}
            {tab.count !== undefined && (
              <span className="ml-1 text-[11px] text-slate-400">({tab.count})</span>
            )}
          </button>
        ))}
    </fieldset>
  );
}

export interface TableFilterButtonProps {
  label?: string;
  onClick?: () => void;
  className?: string;
}

export function TableFilterButton({
  label = "Filters",
  onClick,
  className,
}: TableFilterButtonProps) {
  return (
    <Button
      variant="outline"
      size="sm"
      onClick={onClick}
      className={cn(
        "flex items-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[var(--color-primary)] px-3 py-1.5 border border-[var(--color-outline-variant)]/30 rounded bg-white transition-colors",
        className
      )}
    >
      <Filter className="size-3.5" />
      {label}
    </Button>
  );
}
