import { spawn, type ChildProcessWithoutNullStreams } from 'node:child_process';
import { PassThrough, type Writable } from 'node:stream';
import readline from 'node:readline';

import { getRadAppPowerShellAssetRoot } from '@/main/app/paths';

export type ExchangeSessionHostCommand =
  | 'connect'
  | 'getStatus'
  | 'disconnect'
  | 'listGroups'
  | 'shutdown';

export type ExchangeSessionHost = {
  runtime: {
    command: 'powershell.exe' | 'pwsh.exe';
    label: 'Windows PowerShell' | 'PowerShell';
  };
  request: (command: ExchangeSessionHostCommand, payload: Record<string, unknown>) => Promise<unknown>;
  dispose: () => Promise<void>;
};

type PendingRequest = {
  resolve: (value: unknown) => void;
  reject: (error: Error) => void;
};

type HostResponse = {
  requestId: string;
  success: boolean;
  data?: unknown;
  error?: {
    message: string;
  };
};

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

  const hostScriptPath = `${getRadAppPowerShellAssetRoot()}\\bootstrap\\exchange-session-host.ps1`;

  for (const candidate of WINDOWS_CANDIDATES) {
    try {
      const child = await spawnCandidate(candidate.command, hostScriptPath);

      return createHostController(child, candidate);
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
      parsed = JSON.parse(line) as HostResponse;
    } catch {
      return;
    }

    const pending = pendingRequests.get(parsed.requestId);

    if (!pending) {
      return;
    }

    pendingRequests.delete(parsed.requestId);

    if (parsed.success) {
      pending.resolve(parsed.data);
      return;
    }

    pending.reject(new Error(parsed.error?.message ?? 'Exchange session host request failed.'));
  });

  child.once('exit', () => {
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
    }

    pendingRequests.clear();
    output.close();
  });

  return {
    runtime,
    request(command, payload) {
      return new Promise((resolve, reject) => {
        const requestId = crypto.randomUUID();
        pendingRequests.set(requestId, { resolve, reject });

        writeHostRequest(child.stdin, {
          requestId,
          command,
          payload,
        }).catch((error: unknown) => {
          pendingRequests.delete(requestId);
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
