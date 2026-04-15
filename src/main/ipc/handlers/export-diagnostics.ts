import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { app, dialog, type BrowserWindow } from 'electron';

import { diagnosticsExportResultSchema, type DiagnosticsExportResult } from '@/shared/contracts/diagnostics';
import {
  exportDiagnosticsArtifacts,
  readLastErrorSummary,
  sanitizeLastErrorSummaryForDiagnostics,
} from '@/main/logging';

import { getSessionStatus } from './get-session-status';

export async function exportDiagnostics(
  browserWindow: BrowserWindow | null,
): Promise<DiagnosticsExportResult> {
  const targetRoot = await chooseExportDirectory(browserWindow);
  const generatedAt = new Date().toISOString();
  const bundleDirectory = path.join(
    targetRoot,
    `groups-console-diagnostics-${generatedAt.replace(/[:.]/g, '-')}`,
  );

  await mkdir(bundleDirectory, { recursive: true });

  const sessionStatus = await getSessionStatus();
  await writeFile(
    path.join(bundleDirectory, 'session-status.json'),
    JSON.stringify(sanitizeSessionStatusForDiagnostics(sessionStatus), null, 2),
    'utf8',
  );

  const lastErrorSummary = await readLastErrorSummary();
  if (lastErrorSummary) {
    await writeFile(
      path.join(bundleDirectory, 'last-error.json'),
      JSON.stringify(sanitizeLastErrorSummaryForDiagnostics(lastErrorSummary), null, 2),
      'utf8',
    );
  }

  const copiedLogs = await exportDiagnosticsArtifacts(bundleDirectory);
  const fileCount = copiedLogs + 1 + (lastErrorSummary ? 1 : 0) + 1;

  await writeFile(
    path.join(bundleDirectory, 'manifest.json'),
    JSON.stringify(
      {
        generatedAt,
        appVersion: app.getVersion(),
        environment: sessionStatus.environment,
        fileCount,
      },
      null,
      2,
    ),
    'utf8',
  );

  return diagnosticsExportResultSchema.parse({
    outputPath: bundleDirectory,
    generatedAt,
    fileCount,
  });
}

async function chooseExportDirectory(browserWindow: BrowserWindow | null): Promise<string> {
  const result = browserWindow
    ? await dialog.showOpenDialog(browserWindow, {
        title: 'Choose diagnostics export folder',
        properties: ['openDirectory', 'createDirectory'],
      })
    : await dialog.showOpenDialog({
        title: 'Choose diagnostics export folder',
        properties: ['openDirectory', 'createDirectory'],
      });

  if (result.canceled || result.filePaths.length === 0) {
    throw new Error('Diagnostics export was cancelled.');
  }

  return result.filePaths[0];
}

function sanitizeSessionStatusForDiagnostics(sessionStatus: Awaited<ReturnType<typeof getSessionStatus>>) {
  return {
    ...sessionStatus,
    checks: sessionStatus.checks.map((check) => ({
      ...check,
      detail: sanitizeBootstrapCheckDetail(check.id, check.status),
    })),
  };
}

function sanitizeBootstrapCheckDetail(
  checkId: 'powershell' | 'exchangeModule' | 'logDirectory' | 'tenantConfig',
  status: 'ready' | 'warning' | 'missing',
): string {
  switch (checkId) {
    case 'powershell':
      return status === 'ready'
        ? 'PowerShell runtime check passed.'
        : status === 'warning'
          ? 'PowerShell runtime check returned warnings.'
          : 'PowerShell runtime check failed.';
    case 'exchangeModule':
      return status === 'ready'
        ? 'Exchange module is available.'
        : status === 'warning'
          ? 'Exchange module check returned warnings.'
          : 'Exchange module is unavailable.';
    case 'logDirectory':
      return status === 'ready'
        ? 'Log directory is writable.'
        : 'Log directory is unavailable.';
    case 'tenantConfig':
      return status === 'ready'
        ? 'Tenant configuration is readable.'
        : status === 'warning'
          ? 'Tenant configuration check returned warnings.'
          : 'Tenant configuration is unavailable.';
  }
}
