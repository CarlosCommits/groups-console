import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { app, type BrowserWindow, dialog } from 'electron';

import {
  reportsGenerateMembershipMatrixResultSchema,
  type ReportsGenerateMembershipMatrixPayload,
  type ReportsGenerateMembershipMatrixResult,
} from '@/shared/contracts/reports';
import { exportReportData } from '@/main/exchange/export-report-data';

import { buildMembershipMatrixWorkbookBuffer } from './build-membership-matrix-workbook';

type GenerateMembershipMatrixOptions = {
  browserWindow: BrowserWindow | null;
  outputPathOverride?: string;
  emitProgress?: (event: { phase: 'preflight' | 'executing' | 'verifying' | 'complete'; message: string; percent?: number }) => void;
};

export async function generateMembershipMatrixReport(
  payload: ReportsGenerateMembershipMatrixPayload,
  options: GenerateMembershipMatrixOptions,
): Promise<ReportsGenerateMembershipMatrixResult> {
  const outputPath = await resolveOutputPath(options.outputPathOverride, options.browserWindow);

  const reportData = await exportReportData({ kind: payload.kind }, (event) => {
    options.emitProgress?.({
      phase: event.phase,
      message: event.message,
      percent: event.percent,
    });
  });

  options.emitProgress?.({
    phase: 'verifying',
    message: 'Building workbook file.',
    percent: 96,
  });

  const workbookBuffer = await buildMembershipMatrixWorkbookBuffer(reportData);
  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, workbookBuffer);

  options.emitProgress?.({
    phase: 'complete',
    message: `Saved membership matrix to ${outputPath}.`,
    percent: 100,
  });

  return reportsGenerateMembershipMatrixResultSchema.parse({
    appliedKind: reportData.appliedKind,
    outputPath,
    generatedAt: reportData.generatedAt,
    summary: reportData.summary,
  });
}

async function resolveOutputPath(
  outputPathOverride: string | undefined,
  browserWindow: BrowserWindow | null,
): Promise<string> {
  if (outputPathOverride) {
    return outputPathOverride;
  }

  const defaultPath = path.join(
    app.getPath('downloads'),
    `membership-matrix-${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
  const result = browserWindow
    ? await dialog.showSaveDialog(browserWindow, {
        title: 'Save membership matrix report',
        defaultPath,
        filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
        properties: ['createDirectory', 'showOverwriteConfirmation'],
      })
    : await dialog.showSaveDialog({
        title: 'Save membership matrix report',
        defaultPath,
        filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
        properties: ['createDirectory', 'showOverwriteConfirmation'],
      });

  if (result.canceled || !result.filePath) {
    throw new Error('Membership matrix export was cancelled.');
  }

  return result.filePath;
}
