import { useEffect, useState } from "react";
import {
  CheckCircle2,
  AlertCircle,
  XCircle,
  Shield,
  Lock,
  Unlock,
  Power,
  ArrowRight,
} from "lucide-react";

import type { SessionStatus } from "@/shared/dto/session-status";
import { Badge } from "@/renderer/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/renderer/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/renderer/components/ui/alert";
import { Separator } from "@/renderer/components/ui/separator";

const statusIcon = {
  ready: <CheckCircle2 className="size-4 text-emerald-500" />,
  warning: <AlertCircle className="size-4 text-amber-500" />,
  missing: <XCircle className="size-4 text-destructive" />,
};

const bootstrapCheckDetail: Record<SessionStatus["checks"][number]["id"], string> = {
  powershell: "Windows PowerShell 5.1+ or PowerShell 7+",
  exchangeModule: "ExchangeOnlineManagement module",
  logDirectory: "Application log directory accessible",
  tenantConfig: "Office 365 tenant configuration",
};

function SecurityBadge({ enabled, label }: { enabled: boolean; label: string }) {
  return (
    <div className="flex items-center gap-2">
      {enabled ? (
        <Lock className="size-3.5 text-emerald-500" />
      ) : (
        <Unlock className="size-3.5 text-amber-500" />
      )}
      <span className="text-sm text-muted-foreground">{label}</span>
      <Badge variant={enabled ? "success" : "warning"} className="text-xs">
        {enabled ? "ON" : "OFF"}
      </Badge>
    </div>
  );
}

function BootstrapCheckItem({
  check,
}: {
  check: SessionStatus["checks"][number];
}) {
  const isReady = check.status === "ready";
  const isWarning = check.status === "warning";

  return (
    <div className="flex items-start gap-3 rounded-lg border p-3">
      <div className="mt-0.5">{statusIcon[check.status]}</div>
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium">{check.label}</span>
          <Badge
            variant={
              isReady ? "secondary" : isWarning ? "warning" : "destructive"
            }
            className="text-xs"
          >
            {check.status}
          </Badge>
        </div>
        <p className="mt-0.5 text-sm text-muted-foreground">{check.detail}</p>
        <p className="mt-1 text-xs text-muted-foreground">
          {bootstrapCheckDetail[check.id]}
        </p>
      </div>
    </div>
  );
}

function NextSteps({ checks }: { checks: SessionStatus["checks"] }) {
  const missingChecks = checks.filter((c) => c.status === "missing");
  const warningChecks = checks.filter((c) => c.status === "warning");

  if (missingChecks.length > 0) {
    return (
      <Alert variant="destructive">
        <XCircle className="size-4" />
        <AlertTitle>Bootstrap Incomplete</AlertTitle>
        <AlertDescription>
          The following prerequisites are missing:{" "}
          {missingChecks.map((c) => c.label).join(", ")}. Please resolve these
          issues before using the application.
        </AlertDescription>
      </Alert>
    );
  }

  if (warningChecks.length > 0) {
    return (
      <Alert className="border-amber-500/20 bg-amber-500/10">
        <AlertCircle className="size-4 text-amber-500" />
        <AlertTitle className="text-amber-500">Configuration Warning</AlertTitle>
        <AlertDescription>
          Some checks have warnings: {warningChecks.map((c) => c.label).join(", ")}. 
          Review these for optimal operation.
        </AlertDescription>
      </Alert>
    );
  }

  return (
    <Alert className="border-emerald-500/20 bg-emerald-500/10">
      <CheckCircle2 className="size-4 text-emerald-500" />
      <AlertTitle className="text-emerald-500">Ready to Proceed</AlertTitle>
      <AlertDescription>
        All bootstrap checks passed. The application is ready for use.
      </AlertDescription>
    </Alert>
  );
}

export function App() {
  const [status, setStatus] = useState<SessionStatus | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    void window.radApp.session
      .getStatus()
      .then((nextStatus) => {
        setStatus(nextStatus);
      })
      .catch((nextError: unknown) => {
        setError(
          nextError instanceof Error
            ? nextError.message
            : "Unknown bootstrap error."
        );
      });
  }, []);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Alert variant="destructive" className="max-w-md">
          <XCircle className="size-4" />
          <AlertTitle>Bootstrap Error</AlertTitle>
          <AlertDescription>{error}</AlertDescription>
        </Alert>
      </div>
    );
  }

  if (!status) {
    return (
      <div className="flex min-h-screen items-center justify-center p-6">
        <Card className="w-full max-w-md">
          <CardHeader>
            <CardTitle>Groups Console</CardTitle>
            <CardDescription>Loading application status…</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="flex items-center justify-center py-8">
              <div className="size-8 animate-spin rounded-full border-2 border-primary border-t-transparent" />
            </div>
          </CardContent>
        </Card>
      </div>
    );
  }

  const allChecks = status.checks;
  const passingChecks = allChecks.filter((c) => c.status === "ready").length;

  return (
    <div className="flex min-h-screen flex-col">
      <header className="border-b bg-card">
        <div className="mx-auto max-w-4xl px-6 py-6">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex size-10 items-center justify-center rounded-lg bg-primary/10">
                <Power className="size-5 text-primary" />
              </div>
              <div>
                <h1 className="text-xl font-semibold">Groups Console</h1>
                <p className="text-sm text-muted-foreground">
                  v{status.appVersion}
                </p>
              </div>
            </div>
            <Badge
              variant={status.environment === "production" ? "default" : "secondary"}
              className="text-sm"
            >
              {status.environment}
            </Badge>
          </div>
        </div>
      </header>

      <main className="flex-1">
        <div className="mx-auto max-w-4xl px-6 py-8">
          <div className="grid gap-8">
            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <Shield className="size-5 text-primary" />
                  <CardTitle>Security Boundary</CardTitle>
                </div>
                <CardDescription>
                  Electron renderer process security configuration
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-4 sm:grid-cols-3">
                <SecurityBadge
                  enabled={status.security.contextIsolation}
                  label="Context Isolation"
                />
                <SecurityBadge
                  enabled={status.security.sandbox}
                  label="Sandbox"
                />
                <SecurityBadge
                  enabled={!status.security.nodeIntegration}
                  label="Node Integration"
                />
              </CardContent>
            </Card>

            <Card>
              <CardHeader>
                <div className="flex items-center gap-2">
                  <CheckCircle2 className="size-5 text-primary" />
                  <CardTitle>Bootstrap Checks</CardTitle>
                </div>
                <CardDescription>
                  {passingChecks} of {allChecks.length} checks passing
                </CardDescription>
              </CardHeader>
              <CardContent className="grid gap-3">
                {allChecks.map((check) => (
                  <BootstrapCheckItem key={check.id} check={check} />
                ))}
              </CardContent>
            </Card>

            <NextSteps checks={allChecks} />

            <Separator />

            <div className="flex items-center justify-between text-sm text-muted-foreground">
              <span>Renderer ready via secure IPC bridge</span>
              <div className="flex items-center gap-1">
                <span>Next:</span>
                <ArrowRight className="size-3.5" />
                <span>Connect to backend services</span>
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
