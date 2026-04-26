import { EventEmitter } from 'node:events';
import { PassThrough, Writable } from 'node:stream';

import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const { spawnMock } = vi.hoisted(() => ({
  spawnMock: vi.fn(),
}));

vi.mock('node:child_process', () => ({
  spawn: spawnMock,
}));

vi.mock('@/main/app/paths', () => ({
  getRadAppPowerShellAssetRoot: () => 'C:\\GroupsConsole\\powershell',
  getRadAppLogDirectory: () => 'C:\\GroupsConsole\\logs',
}));

import { startExchangeSessionHost } from './start-exchange-session-host';

type BootstrapRequest = { requestId: string; command: string };

function createFakeChild() {
  const emitter = new EventEmitter() as EventEmitter & {
    stdout: PassThrough;
    stderr: PassThrough;
    stdin: Writable;
    killed: boolean;
    exitCode: number | null;
    kill: () => void;
    writes: string[];
    bootstrapHandled: boolean;
    bootstrapResponder: (request: BootstrapRequest) => void;
  };

  emitter.stdout = new PassThrough();
  emitter.stderr = new PassThrough();
  emitter.stdin = new Writable({
    write(chunk, _encoding, callback) {
      callback();
      const value =
        typeof chunk === 'string'
          ? chunk
          : Buffer.isBuffer(chunk)
            ? chunk.toString('utf8')
            : '';

      emitter.writes.push(value);
      emitter.emit('stdin:write', value);

      try {
        const request = JSON.parse(value.trim()) as BootstrapRequest;

        if (
          !emitter.bootstrapHandled &&
          request.command === 'getStatus' &&
          request.requestId === 'host-bootstrap-readiness'
        ) {
          emitter.bootstrapHandled = true;
          emitter.bootstrapResponder(request);
        }
      } catch {
        // Ignore malformed test writes.
      }
    },
  });
  emitter.killed = false;
  emitter.exitCode = null;
  emitter.writes = [];
  emitter.bootstrapHandled = false;
  emitter.bootstrapResponder = (request) => {
    queueMicrotask(() => {
      emitter.stdout.write(
        `${JSON.stringify({ requestId: request.requestId, success: true, data: { state: 'disconnected' } })}\n`,
      );
    });
  };
  emitter.kill = () => {
    emitter.killed = true;
    emitter.exitCode = 0;
    emitter.emit('exit');
    emitter.emit('close');
  };

  return emitter;
}

function mockSpawnWithChild(child: ReturnType<typeof createFakeChild>) {
  spawnMock.mockImplementation(() => {
    queueMicrotask(() => {
      child.emit('spawn');
    });

    return child;
  });
}

describe('startExchangeSessionHost', () => {
  const originalPlatform = process.platform;

  beforeEach(() => {
    spawnMock.mockReset();
  });

  afterEach(() => {
    Object.defineProperty(process, 'platform', {
      value: originalPlatform,
    });
  });

  it('falls back to pwsh.exe when powershell.exe is missing', async () => {
    Object.defineProperty(process, 'platform', {
      value: 'win32',
    });

    const missingEmitter = new EventEmitter();
    const child = createFakeChild();

    spawnMock
      .mockImplementationOnce(() => {
        queueMicrotask(() => {
          missingEmitter.emit('error', Object.assign(new Error('missing'), { code: 'ENOENT' }));
        });

        return missingEmitter;
      })
      .mockImplementationOnce(() => {
        queueMicrotask(() => {
          child.emit('spawn');
        });

        return child;
      });

    const host = await startExchangeSessionHost();

    expect(spawnMock).toHaveBeenNthCalledWith(
      1,
      'powershell.exe',
      expect.any(Array),
      expect.objectContaining({ windowsHide: true }),
    );
    expect(spawnMock).toHaveBeenNthCalledWith(2, 'pwsh.exe', expect.any(Array), expect.any(Object));
    expect(host.runtime.command).toBe('pwsh.exe');
  });

  it('waits for bootstrap readiness before resolving', async () => {
    Object.defineProperty(process, 'platform', {
      value: 'win32',
    });

    const child = createFakeChild();
    child.bootstrapResponder = () => {
      // Defer bootstrap completion until the test explicitly responds.
    };

    mockSpawnWithChild(child);

    let settled = false;
    const hostPromise = startExchangeSessionHost().then(() => {
      settled = true;
    });
    const bootstrapWritten = new Promise<void>((resolve) => {
      child.once('stdin:write', () => resolve());
    });

    await bootstrapWritten;

    expect(settled).toBe(false);
    expect(child.writes).toHaveLength(1);
    expect(JSON.parse(child.writes[0].trim())).toMatchObject({
      requestId: 'host-bootstrap-readiness',
      command: 'getStatus',
    });

    child.stdout.write(
      `${JSON.stringify({ requestId: 'host-bootstrap-readiness', success: true, data: { state: 'disconnected' } })}\n`,
    );

    await expect(hostPromise).resolves.toBeUndefined();
    expect(settled).toBe(true);
  });

  it('rejects startup when bootstrap emits an unknown-request error', async () => {
    Object.defineProperty(process, 'platform', {
      value: 'win32',
    });

    const child = createFakeChild();
    child.bootstrapResponder = () => {
      queueMicrotask(() => {
        child.stdout.write(
          `${JSON.stringify({ requestId: 'unknown-request', success: false, error: { message: 'Exchange session host bootstrap failed: Parse error at get-group-memberships.ps1:118' } })}\n`,
        );
      });
    };

    mockSpawnWithChild(child);

    await expect(startExchangeSessionHost()).rejects.toThrow(
      'Exchange session host bootstrap failed: Parse error at get-group-memberships.ps1:118',
    );
  });

  it('rejects startup when the host exits before bootstrap readiness completes', async () => {
    Object.defineProperty(process, 'platform', {
      value: 'win32',
    });

    const child = createFakeChild();
    child.bootstrapResponder = () => {
      queueMicrotask(() => {
        child.stderr.write('Bootstrap parse failed at get-group-memberships.ps1:118');
        child.exitCode = 1;
        child.emit('exit');
        child.emit('close');
      });
    };

    mockSpawnWithChild(child);

    await expect(startExchangeSessionHost()).rejects.toThrow(
      'Bootstrap parse failed at get-group-memberships.ps1:118',
    );
  });

  it('prefers structured bootstrap errors over generic host close errors', async () => {
    Object.defineProperty(process, 'platform', {
      value: 'win32',
    });

    const child = createFakeChild();
    child.bootstrapResponder = () => {
      queueMicrotask(() => {
        child.stdout.write(
          `${JSON.stringify({ requestId: 'unknown-request', success: false, error: { message: 'Exchange session host bootstrap failed: Parse error at get-group-memberships.ps1:118' } })}\n`,
        );
        child.stderr.write('Generic host close error');
        child.exitCode = 1;
        child.emit('exit');
        child.emit('close');
      });
    };

    mockSpawnWithChild(child);

    await expect(startExchangeSessionHost()).rejects.toThrow(
      'Exchange session host bootstrap failed: Parse error at get-group-memberships.ps1:118',
    );
  });

  it('sends requests and resolves host responses', async () => {
    Object.defineProperty(process, 'platform', {
      value: 'win32',
    });

    const child = createFakeChild();

    spawnMock.mockImplementation(() => {
      queueMicrotask(() => {
        child.emit('spawn');
      });

      return child;
    });

    const host = await startExchangeSessionHost();
    const requestWritten = new Promise<void>((resolve) => {
      child.once('stdin:write', (line: string) => {
        const request = JSON.parse(line.trim()) as { requestId: string };
        child.stdout.write(
          `${JSON.stringify({ requestId: request.requestId, success: true, data: { state: 'disconnected' } })}\n`,
        );
        resolve();
      });
    });
    const requestPromise = host.request('getStatus', {});

    await requestWritten;

    await expect(requestPromise).resolves.toEqual({ state: 'disconnected' });
  });

  it('rejects pending requests when the host emits an unknown-request error', async () => {
    Object.defineProperty(process, 'platform', {
      value: 'win32',
    });

    const child = createFakeChild();

    spawnMock.mockImplementation(() => {
      queueMicrotask(() => {
        child.emit('spawn');
      });

      return child;
    });

    const host = await startExchangeSessionHost();
    const requestWritten = new Promise<void>((resolve) => {
      child.once('stdin:write', () => {
        child.stdout.write(
          `${JSON.stringify({ requestId: 'unknown-request', success: false, error: { message: 'Bootstrap parse failed.' } })}\n`,
        );
        resolve();
      });
    });
    const requestPromise = host.request('connect', { userPrincipalName: 'ccanas@example.com' });

    await requestWritten;

    await expect(requestPromise).rejects.toThrow('Bootstrap parse failed.');
  });

  it('writes listGroups requests through the host protocol', async () => {
    Object.defineProperty(process, 'platform', {
      value: 'win32',
    });

    const child = createFakeChild();

    spawnMock.mockImplementation(() => {
      queueMicrotask(() => {
        child.emit('spawn');
      });

      return child;
    });

    const host = await startExchangeSessionHost();
    const requestWritten = new Promise<void>((resolve) => {
      child.once('stdin:write', (line: string) => {
        const request = JSON.parse(line.trim()) as { requestId: string; command: string };
        expect(request.command).toBe('listGroups');
        child.stdout.write(
          `${JSON.stringify({ requestId: request.requestId, success: true, data: { appliedKind: 'all', items: [] } })}\n`,
        );
        resolve();
      });
    });
    const requestPromise = host.request('listGroups', { kind: 'all' });

    await requestWritten;

    await expect(requestPromise).resolves.toEqual({ appliedKind: 'all', items: [] });
  });

  it('writes getGroupMembers requests through the host protocol', async () => {
    Object.defineProperty(process, 'platform', {
      value: 'win32',
    });

    const child = createFakeChild();

    spawnMock.mockImplementation(() => {
      queueMicrotask(() => {
        child.emit('spawn');
      });

      return child;
    });

    const host = await startExchangeSessionHost();
    const requestWritten = new Promise<void>((resolve) => {
      child.once('stdin:write', (line: string) => {
        const request = JSON.parse(line.trim()) as { requestId: string; command: string };
        expect(request.command).toBe('getGroupMembers');
        child.stdout.write(
          `${JSON.stringify({ requestId: request.requestId, success: true, data: { group: { exchangeIdentity: 'finance-group', objectId: null, groupKind: 'distributionList' }, items: [] } })}\n`,
        );
        resolve();
      });
    });
    const requestPromise = host.request('getGroupMembers', {
      group: {
        exchangeIdentity: 'finance-group',
        objectId: null,
        groupKind: 'distributionList',
      },
    });

    await requestWritten;

    await expect(requestPromise).resolves.toEqual({
      group: {
        exchangeIdentity: 'finance-group',
        objectId: null,
        groupKind: 'distributionList',
      },
      items: [],
    });
  });

  it('writes getGroupMemberships requests through the host protocol', async () => {
    Object.defineProperty(process, 'platform', {
      value: 'win32',
    });

    const child = createFakeChild();

    spawnMock.mockImplementation(() => {
      queueMicrotask(() => {
        child.emit('spawn');
      });

      return child;
    });

    const host = await startExchangeSessionHost();
    const requestWritten = new Promise<void>((resolve) => {
      child.once('stdin:write', (line: string) => {
        const request = JSON.parse(line.trim()) as { requestId: string; command: string };
        expect(request.command).toBe('getGroupMemberships');
        child.stdout.write(
          `${JSON.stringify({ requestId: request.requestId, success: true, data: { member: { exchangeIdentity: 'jane@example.com', objectId: 'recipient-1', primaryEmail: 'jane@example.com' }, items: [] } })}\n`,
        );
        resolve();
      });
    });
    const requestPromise = host.request('getGroupMemberships', {
      member: {
        exchangeIdentity: 'jane@example.com',
        objectId: 'recipient-1',
        primaryEmail: 'jane@example.com',
      },
    });

    await requestWritten;

    await expect(requestPromise).resolves.toEqual({
      member: {
        exchangeIdentity: 'jane@example.com',
        objectId: 'recipient-1',
        primaryEmail: 'jane@example.com',
      },
      items: [],
    });
  });

  it('writes searchRecipients requests through the host protocol', async () => {
    Object.defineProperty(process, 'platform', {
      value: 'win32',
    });

    const child = createFakeChild();

    spawnMock.mockImplementation(() => {
      queueMicrotask(() => {
        child.emit('spawn');
      });

      return child;
    });

    const host = await startExchangeSessionHost();
    const requestWritten = new Promise<void>((resolve) => {
      child.once('stdin:write', (line: string) => {
        const request = JSON.parse(line.trim()) as { requestId: string; command: string };
        expect(request.command).toBe('searchRecipients');
        child.stdout.write(
          `${JSON.stringify({ requestId: request.requestId, success: true, data: { query: 'ja', appliedLimit: 25, appliedTypes: ['mailbox'], sourceStatus: { exchange: 'searched', graph: 'deferred' }, items: [] } })}\n`,
        );
        resolve();
      });
    });
    const requestPromise = host.request('searchRecipients', {
      query: 'ja',
      limit: 25,
      types: ['mailbox'],
    });

    await requestWritten;

    await expect(requestPromise).resolves.toEqual({
      query: 'ja',
      appliedLimit: 25,
      appliedTypes: ['mailbox'],
      sourceStatus: {
        exchange: 'searched',
        graph: 'deferred',
      },
      items: [],
    });
  });

  it('writes createContact requests through the host protocol', async () => {
    Object.defineProperty(process, 'platform', {
      value: 'win32',
    });

    const child = createFakeChild();

    spawnMock.mockImplementation(() => {
      queueMicrotask(() => {
        child.emit('spawn');
      });

      return child;
    });

    const host = await startExchangeSessionHost();
    const requestWritten = new Promise<void>((resolve) => {
      child.once('stdin:write', (line: string) => {
        const request = JSON.parse(line.trim()) as { requestId: string; command: string };
        expect(request.command).toBe('createContact');
        child.stdout.write(
          `${JSON.stringify({ requestId: request.requestId, success: true, data: { contact: { exchangeIdentity: 'jane@example.com', objectId: null, primaryEmail: 'jane@example.com', displayName: 'Jane Example', companyName: 'Example Corp' }, verification: { attempted: true, companyApplied: true, detail: 'Verified contact creation and company assignment.' } } })}\n`,
        );
        resolve();
      });
    });
    const requestPromise = host.request('createContact', {
      displayName: 'Jane Example',
      alias: 'jexample',
      firstName: 'Jane',
      lastName: 'Example',
      email: 'jane@example.com',
      companyName: 'Example Corp',
    });

    await requestWritten;

    await expect(requestPromise).resolves.toMatchObject({
      contact: {
        exchangeIdentity: 'jane@example.com',
      },
    });
  });

  it('writes updateContactCompany requests through the host protocol', async () => {
    Object.defineProperty(process, 'platform', {
      value: 'win32',
    });

    const child = createFakeChild();

    spawnMock.mockImplementation(() => {
      queueMicrotask(() => {
        child.emit('spawn');
      });

      return child;
    });

    const host = await startExchangeSessionHost();
    const requestWritten = new Promise<void>((resolve) => {
      child.once('stdin:write', (line: string) => {
        const request = JSON.parse(line.trim()) as { requestId: string; command: string };
        expect(request.command).toBe('updateContactCompany');
        child.stdout.write(
          `${JSON.stringify({ requestId: request.requestId, success: true, data: { contact: { exchangeIdentity: 'jane@example.com', objectId: null, primaryEmail: 'jane@example.com', companyName: 'New Company' }, verification: { attempted: true, companyApplied: true, detail: 'Verified company update.' } } })}\n`,
        );
        resolve();
      });
    });
    const requestPromise = host.request('updateContactCompany', {
      contact: {
        exchangeIdentity: 'jane@example.com',
        objectId: null,
        primaryEmail: 'jane@example.com',
      },
      companyName: 'New Company',
    });

    await requestWritten;

    await expect(requestPromise).resolves.toMatchObject({
      contact: {
        companyName: 'New Company',
      },
    });
  });

  it('writes getRecipientDetails requests through the host protocol', async () => {
    Object.defineProperty(process, 'platform', {
      value: 'win32',
    });

    const child = createFakeChild();

    spawnMock.mockImplementation(() => {
      queueMicrotask(() => {
        child.emit('spawn');
      });

      return child;
    });

    const host = await startExchangeSessionHost();
    const requestWritten = new Promise<void>((resolve) => {
      child.once('stdin:write', (line: string) => {
        const request = JSON.parse(line.trim()) as { requestId: string; command: string };
        expect(request.command).toBe('getRecipientDetails');
        child.stdout.write(
          `${JSON.stringify({ requestId: request.requestId, success: true, data: { recipient: { exchangeIdentity: 'jane@example.com', objectId: 'recipient-1', primaryEmail: 'jane@example.com', displayName: 'Jane Example', alias: 'jexample', companyName: 'Example Corp', firstName: 'Jane', lastName: 'Example', title: 'Director', department: 'Operations', phone: '+1 555-0100', office: 'HQ-201', userPrincipalName: 'jane@example.com', recipientType: 'mailbox', recipientTypeDetails: 'UserMailbox' } } })}\n`,
        );
        resolve();
      });
    });
    const requestPromise = host.request('getRecipientDetails', {
      exchangeIdentity: 'jane@example.com',
    });

    await requestWritten;

    await expect(requestPromise).resolves.toMatchObject({
      recipient: {
        recipientType: 'mailbox',
      },
    });
  });

  it('writes addGroupMembers requests through the host protocol', async () => {
    Object.defineProperty(process, 'platform', {
      value: 'win32',
    });

    const child = createFakeChild();

    spawnMock.mockImplementation(() => {
      queueMicrotask(() => {
        child.emit('spawn');
      });

      return child;
    });

    const host = await startExchangeSessionHost();
    const requestWritten = new Promise<void>((resolve) => {
      child.once('stdin:write', (line: string) => {
        const request = JSON.parse(line.trim()) as { requestId: string; command: string };
        expect(request.command).toBe('addGroupMembers');
        child.stdout.write(
          `${JSON.stringify({ requestId: request.requestId, success: true, data: { group: { exchangeIdentity: 'finance-group', objectId: null, groupKind: 'distributionList' }, summary: { requested: 1, added: 1, alreadyMember: 0, failed: 0 }, items: [], verification: { attempted: true, verifiedAdded: 1, detail: 'Verified 1 added member.' } } })}\n`,
        );
        resolve();
      });
    });
    const requestPromise = host.request('addGroupMembers', {
      group: {
        exchangeIdentity: 'finance-group',
        objectId: null,
        groupKind: 'distributionList',
      },
      members: [
        {
          exchangeIdentity: 'jane@example.com',
          objectId: null,
          primaryEmail: 'jane@example.com',
        },
      ],
      verify: true,
    });

    await requestWritten;

    await expect(requestPromise).resolves.toMatchObject({
      summary: {
        added: 1,
      },
    });
  });

  it('writes removeGroupMembers requests through the host protocol', async () => {
    Object.defineProperty(process, 'platform', {
      value: 'win32',
    });

    const child = createFakeChild();

    spawnMock.mockImplementation(() => {
      queueMicrotask(() => {
        child.emit('spawn');
      });

      return child;
    });

    const host = await startExchangeSessionHost();
    const requestWritten = new Promise<void>((resolve) => {
      child.once('stdin:write', (line: string) => {
        const request = JSON.parse(line.trim()) as { requestId: string; command: string };
        expect(request.command).toBe('removeGroupMembers');
        child.stdout.write(
          `${JSON.stringify({ requestId: request.requestId, success: true, data: { group: { exchangeIdentity: 'finance-group', objectId: null, groupKind: 'distributionList' }, summary: { requested: 1, removed: 1, notMember: 0, invalid: 0, verificationFailed: 0, failed: 0 }, items: [], verification: { attempted: true, verifiedRemoved: 1, detail: 'Verified removed members.' } } })}\n`,
        );
        resolve();
      });
    });
    const requestPromise = host.request('removeGroupMembers', {
      group: {
        exchangeIdentity: 'finance-group',
        objectId: null,
        groupKind: 'distributionList',
      },
      members: [
        {
          exchangeIdentity: 'jane@example.com',
          objectId: null,
          primaryEmail: 'jane@example.com',
        },
      ],
      verify: true,
    });

    await requestWritten;

    await expect(requestPromise).resolves.toMatchObject({
      summary: {
        removed: 1,
      },
    });
  });

  it('forwards progress events before exportReportData completes', async () => {
    Object.defineProperty(process, 'platform', {
      value: 'win32',
    });

    const child = createFakeChild();

    spawnMock.mockImplementation(() => {
      queueMicrotask(() => {
        child.emit('spawn');
      });

      return child;
    });

    const host = await startExchangeSessionHost();
    const progressEvents: Array<{ phase: string; message: string; percent?: number }> = [];
    const requestWritten = new Promise<void>((resolve) => {
      child.once('stdin:write', (line: string) => {
        const request = JSON.parse(line.trim()) as { requestId: string; command: string };
        expect(request.command).toBe('exportReportData');
        child.stdout.write(
          `${JSON.stringify({ requestId: request.requestId, phase: 'executing', message: 'Reading group members.', percent: 55 })}\n`,
        );
        child.stdout.write(
          `${JSON.stringify({ requestId: request.requestId, success: true, data: { appliedKind: 'all', generatedAt: '2026-04-14T12:00:00.000Z', groups: [], rows: [], summary: { groupCount: 0, recipientCount: 0, membershipCount: 0 } } })}\n`,
        );
        resolve();
      });
    });
    const requestPromise = host.request('exportReportData', { kind: 'all' }, (event) => {
      progressEvents.push({ phase: event.phase, message: event.message, percent: event.percent });
    });

    await requestWritten;

    await expect(requestPromise).resolves.toMatchObject({
      appliedKind: 'all',
    });
    expect(progressEvents).toEqual([
      {
        phase: 'executing',
        message: 'Reading group members.',
        percent: 55,
      },
    ]);
  });
});
