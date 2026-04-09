import {
  Shield,
  Lock,
  Unlock,
  CheckCircle,
} from "lucide-react";
import { Switch } from "@/renderer/components/ui/switch";
import {
  AppShell,
  StatusBadge,
} from "@/renderer/components/console";

interface SettingRowProps {
  label: string;
  description?: string;
  enabled?: boolean;
  onToggle?: (enabled: boolean) => void;
}

function SettingRow({ label, description, enabled = false, onToggle }: SettingRowProps) {
  return (
    <div className="flex items-center justify-between py-3 border-b border-[var(--color-outline-variant)]/10 last:border-0">
      <div className="flex items-center gap-3">
        {enabled ? (
          <Lock className="size-4 text-emerald-500" />
        ) : (
          <Unlock className="size-4 text-amber-500" />
        )}
        <div>
          <div className="text-sm font-medium">{label}</div>
          {description && (
            <div className="text-xs text-[var(--color-outline)]">
              {description}
            </div>
          )}
        </div>
      </div>
      <Switch checked={enabled} onCheckedChange={onToggle} />
    </div>
  );
}

export function SettingsScreen() {
  return (
    <AppShell>
      <div className="py-6">
        <h1 className="text-2xl font-extrabold text-[var(--color-foreground)] font-headline tracking-tight">
          Settings
        </h1>
        <p className="text-xs text-slate-500 mt-0.5">
          Configure application preferences and security settings.
        </p>
      </div>

      <div className="max-w-3xl space-y-6">
        <div className="bg-white border border-[var(--color-outline-variant)]/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <Shield className="size-5 text-[var(--color-primary)]" />
            <h2 className="text-sm font-extrabold font-headline">
              Security Configuration
            </h2>
          </div>
          <div className="divide-y divide-[var(--color-outline-variant)]/10">
            <SettingRow
              label="Context Isolation"
              description="Enable context isolation for enhanced security"
              enabled={true}
            />
            <SettingRow
              label="Sandbox Mode"
              description="Run renderer process in sandboxed environment"
              enabled={true}
            />
            <SettingRow
              label="Node Integration"
              description="Allow Node.js integration in renderer (not recommended)"
              enabled={false}
            />
          </div>
        </div>

        <div className="bg-white border border-[var(--color-outline-variant)]/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-4">
            <CheckCircle className="size-5 text-[var(--color-primary)]" />
            <h2 className="text-sm font-extrabold font-headline">
              Connection Status
            </h2>
          </div>
          <div className="space-y-3">
            <div className="flex items-center justify-between py-2">
              <div className="text-sm">Microsoft Graph</div>
              <StatusBadge variant="success">Connected</StatusBadge>
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="text-sm">Exchange Online</div>
              <StatusBadge variant="success">Active</StatusBadge>
            </div>
            <div className="flex items-center justify-between py-2">
              <div className="text-sm">PowerShell</div>
              <StatusBadge variant="success">Ready</StatusBadge>
            </div>
          </div>
        </div>

        <div className="bg-white border border-[var(--color-outline-variant)]/30 rounded-lg p-4">
          <h2 className="text-sm font-extrabold font-headline mb-4">
            About
          </h2>
          <div className="space-y-2 text-sm text-[var(--color-outline)]">
            <p>Groups Console v1.0.0</p>
            <p>Electron renderer process with secure IPC bridge</p>
          </div>
        </div>
      </div>
    </AppShell>
  );
}
