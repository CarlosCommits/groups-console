import { ShieldCheck } from "lucide-react";
import { AppShell, PageHeader } from "@/renderer/components/console";
import { AuditEventsPanel } from "@/renderer/components/console/audit-events-panel";

const GLOBAL_AUDIT_SCOPE = { kind: "all" } as const;

export function AuditScreen() {
  return (
    <AppShell>
      <PageHeader
        title="Audit"
        description="Operation audit trail and event log viewer."
        actions={
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5 px-2.5 py-1 rounded-full bg-teal-50 border border-teal-100">
              <ShieldCheck className="size-3.5 text-teal-600" />
              <span className="text-[11px] font-bold text-teal-700 uppercase tracking-tight">
                All Scopes
              </span>
            </div>
          </div>
        }
      />
      <AuditEventsPanel mode="screen" scope={GLOBAL_AUDIT_SCOPE} />
    </AppShell>
  );
}
