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
  getRadAppPowerShellAssetRoot: () => 'C:\\RADApp\\powershell',
}));

import { startExchangeSessionHost } from './start-exchange-session-host';

function createFakeChild() {
  const emitter = new EventEmitter() as EventEmitter & {
    stdout: PassThrough;
    stderr: PassThrough;
    stdin: Writable;
    killed: boolean;
    exitCode: number | null;
    kill: () => void;
    writes: string[];
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
    },
  });
  emitter.killed = false;
  emitter.exitCode = null;
  emitter.writes = [];
  emitter.kill = () => {
    emitter.killed = true;
    emitter.exitCode = 0;
    emitter.emit('exit');
  };

  return emitter;
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
});
