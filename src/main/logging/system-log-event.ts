export interface SystemLogEvent {
  timestamp: string;
  operationId: string;
  ipcRequestId: string | null;
  actorUpn: string | null;
  tenantId: string | null;
  operationType: string;
  targetObjectType: string;
  targetObjectId: string | null;
  summary: string;
  result: 'succeeded' | 'failed' | 'partial';
  authoritative: boolean;
}
