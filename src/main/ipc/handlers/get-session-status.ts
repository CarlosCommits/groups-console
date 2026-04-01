import { app } from 'electron';

import { getLocalBootstrapChecks } from '@/main/session-status/get-local-bootstrap-checks';
import { isPackagedRuntime } from '@/main/app/runtime-mode';
import type { SessionStatus } from '@/shared/dto/session-status';

export async function getSessionStatus(): Promise<SessionStatus> {
  return {
    appVersion: app.getVersion(),
    environment: isPackagedRuntime() ? 'production' : 'development',
    checks: await getLocalBootstrapChecks(),
    security: {
      contextIsolation: true,
      sandbox: true,
      nodeIntegration: false,
    },
  };
}
