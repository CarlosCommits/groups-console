import { Download, LoaderCircle } from "lucide-react";

import { cn } from "@/renderer/lib/utils";
import type { UpdateStatus } from "@/shared/contracts/updates";
import { ConnectionStatus, StatusBadge } from "./status-badge";
import { Button } from "@/renderer/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/renderer/components/ui/tooltip";

export const READY_TOOLTIP = "Both exchange and graph connected";

export interface AppHeaderProps {
  title: string;
  graphConnected?: boolean;
  exchangeActive?: boolean;
  updateStatus?: UpdateStatus | null;
  onInstallUpdate?: () => void;
  className?: string;
}

export function AppHeader({
  title,
  graphConnected = false,
  exchangeActive = false,
  updateStatus = null,
  onInstallUpdate,
  className,
}: AppHeaderProps) {
  const bothConnected = graphConnected && exchangeActive;
  const showUpdateButton =
    updateStatus?.state === "available" ||
    updateStatus?.state === "downloaded" ||
    updateStatus?.state === "checking";
  const updateButtonLabel =
    updateStatus?.state === "downloaded"
      ? "Update Available"
      : updateStatus?.state === "checking"
        ? "Checking for updates"
        : "Downloading updates";
  const updateButtonTitle =
    updateStatus?.detail ??
    (updateStatus?.state === "downloaded"
      ? "Restart Groups Console to install the downloaded update."
      : "Groups Console update status");
  const updateButtonClassName =
    updateStatus?.state === "checking"
      ? "rounded-full border-amber-300/70 bg-amber-100/70 text-amber-900 shadow-none hover:bg-amber-100/70 disabled:opacity-100"
      : updateStatus?.state === "available"
        ? "rounded-full border-emerald-300/70 bg-emerald-100/70 text-emerald-900 shadow-none hover:bg-emerald-100/70 disabled:opacity-100"
        : "rounded-full border-sky-300/70 bg-sky-100/80 text-sky-900 shadow-none hover:bg-sky-200/80";

  return (
    <header
      className={cn(
        "fixed top-[var(--app-title-bar-safe-height)] left-60 right-0 z-40 flex h-14 items-center justify-between border-b border-[var(--color-outline-variant)]/30 bg-white/90 px-6 backdrop-blur-md",
        className
      )}
    >
      <h1 className="font-headline text-lg font-extrabold tracking-tight text-[var(--color-foreground)]">
        {title}
      </h1>
      <div className="flex items-center gap-4">
        {showUpdateButton && (
          <Button
            type="button"
            size="sm"
            variant="outline"
            className={updateButtonClassName}
            onClick={onInstallUpdate}
            disabled={updateStatus?.state !== "downloaded"}
            title={updateButtonTitle}
          >
            {updateStatus?.state === "checking" ? (
              <LoaderCircle data-icon="inline-start" className="size-3.5 animate-spin" />
            ) : updateStatus?.state === "available" ? (
              <Download data-icon="inline-start" className="size-3.5 animate-bounce" />
            ) : (
              <Download data-icon="inline-start" className="size-3.5" />
            )}
            {updateButtonLabel}
          </Button>
        )}
        {bothConnected ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <StatusBadge variant="success" size="sm">
                  Ready
                </StatusBadge>
              </TooltipTrigger>
              <TooltipContent side="bottom" align="end" sideOffset={6}>
                {READY_TOOLTIP}
              </TooltipContent>
            </Tooltip>
          </TooltipProvider>
        ) : (
          <ConnectionStatus
            graphConnected={graphConnected}
            exchangeActive={exchangeActive}
          />
        )}
      </div>
    </header>
  );
}
