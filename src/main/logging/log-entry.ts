export type LogLevel = 'info' | 'warn' | 'error';

export type OperationResult = 'started' | 'succeeded' | 'failed' | 'partial';

export type BackendOwner = 'exchange' | 'graph' | 'app' | null;

export interface OperationalLogEntry {
  timestamp: string;
  level: LogLevel;
  operationId: string;
  ipcRequestId: string | null;
  operationName: string;
  backendOwner: BackendOwner;
  tenantId: string | null;
  result: OperationResult;
  safeErrorCode: string | null;
  message: string;
  metadata?: Record<string, unknown>;
}
