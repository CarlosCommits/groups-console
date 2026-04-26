import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { PassThrough, type Writable } from 'node:stream';
import readline from 'node:readline';

import { getGroupsConsolePowerShellAssetRoot } from '@/main/app/paths';
import { getCurrentOperationContext, writeOperationalLog } from '@/main/logging';
import type { ProgressEvent } from '@/shared/contracts/command';

export type ExchangeSessionHostCommand =
  | 'connect'
  | 'getStatus'
  | 'disconnect'
  | 'lookupRecipientOwnership'
  | 'resolveGuestMailUser'
  | 'getRecipientDetails'
  | 'createContact'
  | 'getContactDetails'
  | 'updateContactCompany'
  | 'searchRecipients'
  | 'exportReportData'
  | 'listGroups'
  | 'getGroupMembers'
  | 'getGroupMemberships'
  | 'addGroupMembers'
  | 'removeGroupMembers'
  | 'shutdown';

export type ExchangeSessionHost = {
  runtime: {
    command: 'powershell.exe' | 'pwsh.exe';
    label: 'Windows PowerShell' | 'PowerShell';
  };
  request: (
    command: ExchangeSessionHostCommand,
    payload: Record<string, unknown>,
    onProgress?: (event: ProgressEvent) => void,
    requestIdOverride?: string,
  ) => Promise<unknown>;
  dispose: () => Promise<void>;
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
  onProgress?: (event: ProgressEvent) => void;
  operationId: string;
  ipcRequestId: string | null;
  commandName: string;
};

type HostResponse = {
  requestId: string;
  success: boolean;
  data?: unknown;
  error?: {
    message: string;
  };
};

type HostProgress = ProgressEvent;

const WINDOWS_CANDIDATES: Array<{
  command: 'powershell.exe' | 'pwsh.exe';
  label: 'Windows PowerShell' | 'PowerShell';
}> = [
  { command: 'powershell.exe', label: 'Windows PowerShell' },
  { command: 'pwsh.exe', label: 'PowerShell' },
];

export async function startExchangeSessionHost(): Promise<ExchangeSessionHost> {
  if (process.platform !== 'win32') {
    throw new Error(`Exchange session host requires Windows. Current host platform is ${process.platform}.`);
  }

  const hostScriptPath = `${getGroupsConsolePowerShellAssetRoot()}\\bootstrap\\exchange-session-host.ps1`;

  for (const candidate of WINDOWS_CANDIDATES) {
    try {
      const child = await spawnCandidate(candidate.command, hostScriptPath);
      const host = createHostController(child, candidate);

      await host.request('getStatus', {}, undefined, 'host-bootstrap-readiness');

      return host;
    } catch (error) {
      if (
        typeof error === 'object' &&
        error !== null &&
        'code' in error &&
        error.code === 'ENOENT'
      ) {
        continue;
      }

      throw error instanceof Error
        ? error
        : new Error('Unknown Exchange session host startup failure.');
    }
  }

  throw new Error('No supported PowerShell runtime executable was found for the Exchange session host.');
}

async function spawnCandidate(
  command: 'powershell.exe' | 'pwsh.exe',
  hostScriptPath: string,
): Promise<ChildProcessWithoutNullStreams> {
  return await new Promise((resolve, reject) => {
    const child = spawn(
      command,
      [
        '-NoLogo',
        '-NoProfile',
        '-NonInteractive',
        '-ExecutionPolicy',
        'Bypass',
        '-File',
        hostScriptPath,
      ],
      {
        windowsHide: true,
        stdio: 'pipe',
      },
    );

    child.once('spawn', () => {
      resolve(child);
    });

    child.once('error', (error) => {
      reject(error);
    });
  });
}

function createHostController(
  child: ChildProcessWithoutNullStreams,
  runtime: ExchangeSessionHost['runtime'],
): ExchangeSessionHost {
  const pendingRequests = new Map<string, PendingRequest>();
  const stderrBuffer = new PassThrough();
  const output = readline.createInterface({ input: child.stdout });

  child.stderr.pipe(stderrBuffer);

  output.on('line', (line) => {
    if (!line.trim()) {
      return;
    }

    let parsed: HostResponse;

    try {
      const parsedMessage = JSON.parse(line) as HostResponse | HostProgress;

      if ('phase' in parsedMessage && 'message' in parsedMessage) {
        const pending = pendingRequests.get(parsedMessage.requestId);
        pending?.onProgress?.(parsedMessage);
        return;
      }

      parsed = parsedMessage;
    } catch {
      const pending = pendingRequests.values().next().value;
      void writeOperationalLog({
        timestamp: new Date().toISOString(),
        level: 'warn',
        operationId: pending?.operationId ?? 'exchange-host',
        ipcRequestId: pending?.ipcRequestId ?? null,
        operationName: 'exchange.host.parse',
        backendOwner: 'exchange',
        tenantId: null,
        result: 'failed',
        safeErrorCode: 'exchange_host_parse_failed',
        message: 'Received malformed JSON from Exchange session host.',
        metadata: { line },
      });
      return;
    }

    const pending = pendingRequests.get(parsed.requestId);

    if (!pending) {
      if (!parsed.success && parsed.requestId === 'unknown-request') {
        const message = parsed.error?.message ?? 'Exchange session host bootstrap failed.';

        for (const pendingRequest of pendingRequests.values()) {
          pendingRequest.reject(new Error(message));
        }

        pendingRequests.clear();
      }

      return;
    }

    pendingRequests.delete(parsed.requestId);

    if (parsed.success) {
      pending.resolve(parsed.data);
      return;
    }

    pending.reject(new Error(parsed.error?.message ?? 'Exchange session host request failed.'));
  });

  child.once('close', () => {
    const stderrChunk: unknown = stderrBuffer.read();
    const stderr =
      typeof stderrChunk === 'string'
        ? stderrChunk
        : Buffer.isBuffer(stderrChunk)
          ? stderrChunk.toString('utf8')
          : '';

    for (const pending of pendingRequests.values()) {
      pending.reject(
        new Error(
          stderr || 'Exchange session host exited before responding to all pending requests.',
        ),
      );

      void writeOperationalLog({
        timestamp: new Date().toISOString(),
        level: stderr ? 'error' : 'warn',
        operationId: pending.operationId,
        ipcRequestId: pending.ipcRequestId,
        operationName: `exchange.host.${pending.commandName}`,
        backendOwner: 'exchange',
        tenantId: null,
        result: 'failed',
        safeErrorCode: 'exchange_host_exit',
        message: stderr || 'Exchange session host exited before responding to a pending request.',
      });
    }

    pendingRequests.clear();
    output.close();
  });

  return {
    runtime,
    request(command, payload, onProgress, requestIdOverride) {
      return new Promise((resolve, reject) => {
        const currentContext = getCurrentOperationContext();
        const requestId =
          requestIdOverride ?? currentContext?.operationId ?? crypto.randomUUID();
        pendingRequests.set(requestId, {
          resolve,
          reject,
          onProgress,
          operationId: requestId,
          ipcRequestId: currentContext?.ipcRequestId ?? null,
          commandName: command,
        });

        writeHostRequest(child.stdin, {
          requestId,
          command,
          payload,
        }).catch((error: unknown) => {
          pendingRequests.delete(requestId);
          void writeOperationalLog({
            timestamp: new Date().toISOString(),
            level: 'error',
            operationId: requestId,
            ipcRequestId: getCurrentOperationContext()?.ipcRequestId ?? null,
            operationName: `exchange.host.${command}`,
            backendOwner: 'exchange',
            tenantId: null,
            result: 'failed',
            safeErrorCode: 'exchange_host_write_failed',
            message: 'Failed to write request to Exchange session host.',
          });
          reject(
            error instanceof Error ? error : new Error('Failed to write to Exchange session host.'),
          );
        });
      });
    },
    async dispose() {
      if (child.killed || child.exitCode !== null) {
        return;
      }

      try {
        await this.request('shutdown', {});
      } catch {
        child.kill();
      }
    },
  };
}

async function writeHostRequest(
  stdin: Writable,
  request: { requestId: string; command: ExchangeSessionHostCommand; payload: Record<string, unknown> },
): Promise<void> {
  await new Promise<void>((resolve, reject) => {
    stdin.write(`${JSON.stringify(request)}\n`, (error) => {
      if (error) {
        reject(error instanceof Error ? error : new Error('Exchange session host write failed.'));
        return;
      }

      resolve();
    });
  });
}
