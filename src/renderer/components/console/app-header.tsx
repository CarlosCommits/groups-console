import { cn } from "@/renderer/lib/utils";
import { ConnectionStatus, StatusBadge } from "./status-badge";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/renderer/components/ui/tooltip";

export const READY_TOOLTIP = "both exchange and graph connected";

export interface AppHeaderProps {
  graphConnected?: boolean;
  exchangeActive?: boolean;
  className?: string;
}

export function AppHeader({
  graphConnected = false,
  exchangeActive = false,
  className,
}: AppHeaderProps) {
  const bothConnected = graphConnected && exchangeActive;

  return (
    <header
      className={cn(
        "fixed top-0 left-60 right-0 h-14 bg-white/90 backdrop-blur-md border-b border-[var(--color-outline-variant)]/30 flex justify-end items-center px-6 z-40",
        className
      )}
    >
      <div className="flex items-center gap-4">
        {bothConnected ? (
          <TooltipProvider>
            <Tooltip>
              <TooltipTrigger asChild>
                <StatusBadge variant="success" size="sm">
                  Ready
                </StatusBadge>
              </TooltipTrigger>
              <TooltipContent>
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