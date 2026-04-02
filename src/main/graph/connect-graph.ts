import type { GraphConnectionStatus } from '@/shared/contracts/graph';

import { graphSessionManager } from './graph-session-manager';

export async function connectGraph(): Promise<GraphConnectionStatus> {
  return await graphSessionManager.connect();
}
