import { AsyncLocalStorage } from 'node:async_hooks';

import type { BackendOwner } from './log-entry';

export interface OperationContext {
  operationId: string;
  ipcRequestId: string | null;
  commandName: string;
  backendOwner: BackendOwner;
}

const operationContextStorage = new AsyncLocalStorage<OperationContext>();

export function runWithOperationContext<T>(
  context: OperationContext,
  callback: () => Promise<T>,
): Promise<T> {
  return operationContextStorage.run(context, callback);
}

export function getCurrentOperationContext(): OperationContext | undefined {
  return operationContextStorage.getStore();
}
