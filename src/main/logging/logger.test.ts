import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

let tempLogDirectory: string;

vi.mock('@/main/app/paths', () => {
  return {
    getRadAppLogDirectory: () => tempLogDirectory,
  };
});

import { readLastErrorSummary, writeAuditEvent, writeOperationalLog } from './logger';

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
