import { describe, expect, it } from 'vitest';

import {
  auditEventItemSchema,
  auditListEventsPayloadSchema,
  auditListEventsResultSchema,
  auditScopeSchema,
} from './audit';

describe('audit contracts', () => {
  it('accepts the all scope payload shape', () => {
    const payload = auditListEventsPayloadSchema.parse({
      scope: { kind: 'all' },
      pageSize: 50,
    });

    expect(payload.scope.kind).toBe('all');
  });

  it('accepts the target-object scope payload shape', () => {
    const scope = auditScopeSchema.parse({
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
      auditListEventsPayloadSchema.parse({
        scope: { kind: 'all' },
        extra: true,
      }),
    ).toThrow();
  });

  it('accepts audit event items with nullable actor and target IDs', () => {
    const item = auditEventItemSchema.parse({
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
    const result = auditListEventsResultSchema.parse({
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
