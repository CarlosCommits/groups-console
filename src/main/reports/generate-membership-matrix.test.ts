import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('node:fs/promises', () => ({
  mkdir: vi.fn(),
  writeFile: vi.fn(),
}));

vi.mock('electron', () => ({
  app: {
    getPath: vi.fn(() => 'C:/Users/Test/Downloads'),
  },
  dialog: {
    showSaveDialog: vi.fn(),
  },
}));

vi.mock('@/main/exchange/export-report-data', () => ({
  exportReportData: vi.fn(),
}));

vi.mock('./build-membership-matrix-workbook', () => ({
  buildMembershipMatrixWorkbookBuffer: vi.fn(),
}));

import { mkdir, writeFile } from 'node:fs/promises';

import { app, dialog } from 'electron';

import { exportReportData } from '@/main/exchange/export-report-data';

import { buildMembershipMatrixWorkbookBuffer } from './build-membership-matrix-workbook';
import { generateMembershipMatrixReport } from './generate-membership-matrix';

describe('generateMembershipMatrixReport', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(exportReportData).mockResolvedValue({
      appliedKind: 'all',
      generatedAt: '2026-04-14T12:00:00.000Z',
      groups: [],
      rows: [],
      summary: {
        groupCount: 2,
        recipientCount: 5,
        membershipCount: 8,
      },
    });
    vi.mocked(buildMembershipMatrixWorkbookBuffer).mockResolvedValue(
      Buffer.from('xlsx-data') as unknown as Buffer,
    );
  });

  it('writes the workbook to an explicit output path', async () => {
    const progressEvents: Array<{ phase: string; message: string; percent?: number }> = [];

    const result = await generateMembershipMatrixReport(
      {
        kind: 'all',
      },
      {
        browserWindow: null,
        outputPathOverride: 'C:/Reports/membership-matrix.xlsx',
        emitProgress: (event) => progressEvents.push(event),
      },
    );

    expect(exportReportData).toHaveBeenCalledWith({ kind: 'all' }, expect.any(Function));
    expect(mkdir).toHaveBeenCalledWith('C:/Reports', { recursive: true });
    expect(writeFile).toHaveBeenCalledWith(
      'C:/Reports/membership-matrix.xlsx',
      Buffer.from('xlsx-data'),
    );
    expect(progressEvents.at(-1)).toEqual({
      phase: 'complete',
      message: 'Saved membership matrix to C:/Reports/membership-matrix.xlsx.',
      percent: 100,
    });
    expect(result.summary.membershipCount).toBe(8);
  });

  it('uses a save dialog when no output path is provided', async () => {
    vi.mocked(dialog.showSaveDialog).mockResolvedValue({
      canceled: false,
      filePath: 'C:/Users/Test/Downloads/membership-matrix-2026-04-14.xlsx',
    } as never);

    const result = await generateMembershipMatrixReport(
      { kind: 'distributionList' },
      { browserWindow: null },
    );

    expect(app.getPath).toHaveBeenCalledWith('downloads');
    expect(dialog.showSaveDialog).toHaveBeenCalled();
    expect(result.outputPath).toContain('membership-matrix-');
  });

  it('throws when the save dialog is cancelled', async () => {
    vi.mocked(dialog.showSaveDialog).mockResolvedValue({ canceled: true } as never);

    await expect(
      generateMembershipMatrixReport({ kind: 'all' }, { browserWindow: null }),
    ).rejects.toThrow('Membership matrix export was cancelled.');
  });
});
