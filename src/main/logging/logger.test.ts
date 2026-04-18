import { mkdtemp, readFile, writeFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let tempLogDirectory: string;

vi.mock('@/main/app/paths', () => {
  return {
    getRadAppLogDirectory: () => tempLogDirectory,
  };
});

import { readAuditEvents, readLastErrorSummary, writeAuditEvent, writeOperationalLog } from './logger';

describe('logger', () => {
  beforeEach(async () => {
    tempLogDirectory = await mkdtemp(path.join(os.tmpdir(), 'groups-console-logs-'));
  });

  afterEach(() => {
    vi.clearAllMocks();
  });

  it('writes redacted operational log entries', async () => {
    await writeOperationalLog({
      timestamp: '2026-04-15T12:00:00.000Z',
      level: 'error',
      operationId: 'op-1',
      ipcRequestId: 'req-1',
      operationName: 'contacts.create',
      backendOwner: 'exchange',
      tenantId: 'tenant-1',
      result: 'failed',
      safeErrorCode: 'command_failed',
      message: 'Authorization header Bearer secret-token failed.',
      metadata: {
        authorization: 'Bearer secret-token',
      },
    });

    const opsLog = await readFile(path.join(tempLogDirectory, 'ops-current.jsonl'), 'utf8');
    expect(opsLog).toContain('[REDACTED]');
    expect(opsLog).not.toContain('secret-token');

    const lastError = await readLastErrorSummary();
    expect(lastError?.safeErrorCode).toBe('command_failed');
  });

  it('writes audit events to the audit stream', async () => {
    await writeAuditEvent({
      timestamp: '2026-04-15T12:00:00.000Z',
      operationId: 'op-1',
      ipcRequestId: 'req-1',
      actorUpn: 'admin@example.com',
      tenantId: 'tenant-1',
      operationType: 'groups.addMembers',
      targetObjectType: 'distributionList',
      targetObjectId: 'group-1',
      summary: 'Attempted to add 2 members.',
      result: 'succeeded',
      authoritative: true,
    });

    const auditLog = await readFile(path.join(tempLogDirectory, 'audit-current.jsonl'), 'utf8');
    expect(auditLog).toContain('groups.addMembers');
  });

  it('reads audit events newest-first with cursor paging', async () => {
    await writeAuditEvent({
      timestamp: '2026-04-15T12:00:00.000Z',
      operationId: 'op-1',
      ipcRequestId: 'req-1',
      actorUpn: 'admin@example.com',
      tenantId: 'tenant-1',
      operationType: 'groups.addMembers',
      targetObjectType: 'distributionList',
      targetObjectId: 'group-1',
      summary: 'Attempted to add 2 members.',
      result: 'succeeded',
      authoritative: true,
    });
    await writeAuditEvent({
      timestamp: '2026-04-15T12:05:00.000Z',
      operationId: 'op-2',
      ipcRequestId: 'req-2',
      actorUpn: 'admin@example.com',
      tenantId: 'tenant-1',
      operationType: 'guests.invite',
      targetObjectType: 'guestUser',
      targetObjectId: 'guest-1',
      summary: 'Attempted to invite a guest user.',
      result: 'failed',
      authoritative: false,
    });
    await writeAuditEvent({
      timestamp: '2026-04-15T12:10:00.000Z',
      operationId: 'op-3',
      ipcRequestId: 'req-3',
      actorUpn: 'admin@example.com',
      tenantId: 'tenant-1',
      operationType: 'contacts.updateCompany',
      targetObjectType: 'mailContact',
      targetObjectId: 'contact-1',
      summary: 'Updated the contact company.',
      result: 'partial',
      authoritative: false,
    });

    const firstPage = await readAuditEvents({
      scope: { kind: 'all' },
      pageSize: 2,
    });

    expect(firstPage.items.map((item) => item.operationId)).toEqual(['op-3', 'op-2']);
    expect(firstPage.nextCursor).not.toBeNull();

    const secondPage = await readAuditEvents({
      scope: { kind: 'all' },
      cursor: firstPage.nextCursor ?? undefined,
      pageSize: 2,
    });

    expect(secondPage.items.map((item) => item.operationId)).toEqual(['op-1']);
    expect(secondPage.nextCursor).toBeNull();
  });

  it('filters audit events by target object, result, and query while tolerating malformed lines', async () => {
    await writeAuditEvent({
      timestamp: '2026-04-15T12:00:00.000Z',
      operationId: 'op-1',
      ipcRequestId: 'req-1',
      actorUpn: 'admin@example.com',
      tenantId: 'tenant-1',
      operationType: 'groups.addMembers',
      targetObjectType: 'distributionList',
      targetObjectId: 'group-1',
      summary: 'Attempted to add 2 members.',
      result: 'succeeded',
      authoritative: true,
    });
    await writeAuditEvent({
      timestamp: '2026-04-15T12:01:00.000Z',
      operationId: 'op-2',
      ipcRequestId: 'req-2',
      actorUpn: 'admin@example.com',
      tenantId: 'tenant-1',
      operationType: 'groups.removeMembers',
      targetObjectType: 'distributionList',
      targetObjectId: 'group-1',
      summary: 'Removed 1 member from the group.',
      result: 'failed',
      authoritative: false,
    });
    await writeFile(
      path.join(tempLogDirectory, 'audit-older.jsonl'),
      '{bad json}\n' +
        JSON.stringify({
          timestamp: '2026-04-15T11:59:00.000Z',
          operationId: 'op-0',
          ipcRequestId: null,
          actorUpn: null,
          tenantId: null,
          operationType: 'groups.addMembers',
          targetObjectType: 'mailEnabledSecurityGroup',
          targetObjectId: 'group-2',
          summary: 'Attempted to add a member.',
          result: 'succeeded',
          authoritative: true,
        }) +
        '\n',
      'utf8',
    );

    const result = await readAuditEvents({
      scope: {
        kind: 'targetObject',
        targetObjectId: 'group-1',
        targetObjectTypes: ['distributionList'],
      },
      result: 'failed',
      query: 'removed',
      pageSize: 10,
    });

    expect(result.items).toHaveLength(1);
    expect(result.items[0]?.operationId).toBe('op-2');
  });

  it('exports redacted diagnostics log artifacts', async () => {
    await writeOperationalLog({
      timestamp: '2026-04-15T12:00:00.000Z',
      level: 'error',
      operationId: 'op-1',
      ipcRequestId: 'req-1',
      operationName: 'guests.invite',
      backendOwner: 'graph',
      tenantId: 'tenant-1',
      result: 'failed',
      safeErrorCode: 'command_failed',
      message: 'guest@example.com invite failed.',
    });
    await writeAuditEvent({
      timestamp: '2026-04-15T12:00:00.000Z',
      operationId: 'op-1',
      ipcRequestId: 'req-1',
      actorUpn: 'admin@example.com',
      tenantId: 'tenant-1',
      operationType: 'guests.invite',
      targetObjectType: 'guestUser',
      targetObjectId: 'guest-1',
      summary: 'Attempted to invite a guest user.',
      result: 'failed',
      authoritative: false,
    });

    const bundleDirectory = await mkdtemp(path.join(os.tmpdir(), 'groups-console-diagnostics-bundle-'));
    const fileCount = await (await import('./logger')).exportDiagnosticsArtifacts(bundleDirectory);
    const opsExport = await readFile(path.join(bundleDirectory, 'ops-current.jsonl'), 'utf8');
    const auditExport = await readFile(path.join(bundleDirectory, 'audit-current.jsonl'), 'utf8');

    expect(fileCount).toBe(2);
    expect(opsExport).not.toContain('guest@example.com');
    expect(auditExport).not.toContain('admin@example.com');
    expect(auditExport).not.toContain('tenant-1');
    expect(auditExport).not.toContain('guest-1');
  });
});
