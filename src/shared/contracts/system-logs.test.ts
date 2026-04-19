import { describe, expect, it } from 'vitest';

import {
  systemLogEventItemSchema,
  systemLogsListEventsPayloadSchema,
  systemLogsListEventsResultSchema,
  systemLogScopeSchema,
} from './system-logs';

describe('system log contracts', () => {
  it('accepts the all scope payload shape', () => {
    const payload = systemLogsListEventsPayloadSchema.parse({
      scope: { kind: 'all' },
      pageSize: 50,
    });

    expect(payload.scope.kind).toBe('all');
  });

  it('accepts the target-object scope payload shape', () => {
    const scope = systemLogScopeSchema.parse({
      kind: 'targetObject',
      targetObjectId: 'group-123',
      targetObjectTypes: ['distributionList'],
    });

    expect(scope.kind).toBe('targetObject');
    if (scope.kind === 'targetObject') {
      expect(scope.targetObjectId).toBe('group-123');
    }
  });

  it('rejects extra payload fields', () => {
    expect(() =>
      systemLogsListEventsPayloadSchema.parse({
        scope: { kind: 'all' },
        extra: true,
      }),
    ).toThrow();
  });

  it('accepts system log items with nullable actor and target IDs', () => {
    const item = systemLogEventItemSchema.parse({
      timestamp: '2026-04-17T12:00:00.000Z',
      operationId: 'op-1',
      ipcRequestId: null,
      actorUpn: null,
      tenantId: null,
      operationType: 'groups.addMembers',
      targetObjectType: 'distributionList',
      targetObjectId: 'group-1',
      summary: 'Attempted to add 2 members.',
      result: 'succeeded',
      authoritative: true,
    });

    expect(item.result).toBe('succeeded');
  });

  it('accepts list results with a next cursor', () => {
    const result = systemLogsListEventsResultSchema.parse({
      items: [
        {
          timestamp: '2026-04-17T12:00:00.000Z',
          operationId: 'op-1',
          ipcRequestId: 'req-1',
          actorUpn: 'admin@example.com',
          tenantId: 'tenant-1',
          operationType: 'groups.addMembers',
          targetObjectType: 'distributionList',
          targetObjectId: 'group-1',
          summary: 'Attempted to add 2 members.',
          result: 'partial',
          authoritative: false,
        },
      ],
      nextCursor: 'cursor-1',
    });

    expect(result.nextCursor).toBe('cursor-1');
  });
});
