import { mkdtemp, readFile } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';

import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('electron', () => ({
  app: {
    getVersion: () => '0.1.0-test',
  },
  dialog: {
    showOpenDialog: vi.fn(),
  },
}));

vi.mock('@/main/logging', () => ({
  exportDiagnosticsArtifacts: vi.fn(),
  readLastErrorSummary: vi.fn(),
  sanitizeLastErrorSummaryForDiagnostics: vi.fn((summary: Record<string, unknown>) => ({
    safeErrorCode: summary.safeErrorCode ?? null,
  })),
}));

vi.mock('./get-session-status', () => ({
  getSessionStatus: vi.fn(),
}));

import { dialog } from 'electron';

import { exportDiagnosticsArtifacts, readLastErrorSummary } from '@/main/logging';

import { getSessionStatus } from './get-session-status';
import { exportDiagnostics } from './export-diagnostics';

describe('exportDiagnostics', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('exports diagnostics into a chosen directory', async () => {
    const tempRoot = await mkdtemp(path.join(os.tmpdir(), 'groups-console-diagnostics-'));
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({
      canceled: false,
      filePaths: [tempRoot],
    } as never);
    vi.mocked(getSessionStatus).mockResolvedValue({
      appVersion: '0.1.0-test',
      environment: 'development',
      checks: [
        {
          id: 'logDirectory',
          label: 'Log directory',
          status: 'ready',
          detail: `Log directory is writable at ${tempRoot}.`,
        },
        {
          id: 'tenantConfig',
          label: 'Tenant configuration',
          status: 'missing',
          detail: `Tenant configuration was not found at ${tempRoot}/tenant.json.`,
        },
      ],
      security: {
        contextIsolation: true,
        sandbox: true,
        nodeIntegration: false,
      },
    });
    vi.mocked(exportDiagnosticsArtifacts).mockResolvedValue(2);
    vi.mocked(readLastErrorSummary).mockResolvedValue({
      operationId: 'op-1',
      safeErrorCode: 'command_failed',
    });

    const result = await exportDiagnostics(null);

    expect(result.fileCount).toBe(5);
    expect(result.outputPath).toContain('groups-console-diagnostics-');
    const exportedLastError = JSON.parse(
      await readFile(path.join(result.outputPath, 'last-error.json'), 'utf8'),
    ) as Record<string, unknown>;
    const exportedSessionStatus = JSON.parse(
      await readFile(path.join(result.outputPath, 'session-status.json'), 'utf8'),
    ) as { checks: Array<{ detail: string }> };
    expect(exportedLastError.operationId).toBeUndefined();
    expect(exportedLastError.safeErrorCode).toBe('command_failed');
    expect(JSON.stringify(exportedSessionStatus)).not.toContain(tempRoot);
    expect(exportedSessionStatus.checks[0]?.detail).toBe('Log directory is writable.');
  });

  it('throws when diagnostics export is cancelled', async () => {
    vi.mocked(dialog.showOpenDialog).mockResolvedValue({
      canceled: true,
      filePaths: [],
    } as never);

    await expect(exportDiagnostics(null)).rejects.toThrow('Diagnostics export was cancelled.');
  });
});
