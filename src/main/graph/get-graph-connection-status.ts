import type { GraphConnectionStatus } from '@/shared/contracts/graph';

import { graphSessionManager } from './graph-session-manager';

export async function getGraphConnectionStatus(): Promise<GraphConnectionStatus> {
  return await graphSessionManager.getConnectionStatus();
}
