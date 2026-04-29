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

vi.mock('@/main/exchange/get-group-members', () => ({
  getGroupMembers: vi.fn(),
}));

vi.mock('./build-group-members-workbook', () => ({
  buildGroupMembersWorkbookBuffer: vi.fn(),
}));

import { mkdir, writeFile } from 'node:fs/promises';

import { app, dialog } from 'electron';

import { getGroupMembers } from '@/main/exchange/get-group-members';

import { buildGroupMembersWorkbookBuffer } from './build-group-members-workbook';
import { exportGroupMembers } from './export-group-members';

const payload = {
  group: {
    exchangeIdentity: 'finance-group',
    objectId: null,
    groupKind: 'distributionList' as const,
  },
  groupDisplayName: 'Finance Group',
  groupPrimaryEmail: 'finance@example.com',
};

describe('exportGroupMembers', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(getGroupMembers).mockResolvedValue({
      group: payload.group,
      items: [
        {
          objectId: 'recipient-1',
          exchangeIdentity: 'recipient-identity-1',
          displayName: 'Jane Example',
          primaryEmail: 'jane@example.com',
          alias: 'jexample',
          recipientType: 'mailbox',
          recipientTypeDetails: 'UserMailbox',
        },
      ],
    });
    vi.mocked(buildGroupMembersWorkbookBuffer).mockResolvedValue(
      Buffer.from('xlsx-data') as unknown as Buffer,
    );
  });

  it('writes the workbook to an explicit output path', async () => {
    const result = await exportGroupMembers(payload, {
      browserWindow: null,
      outputPathOverride: 'C:/Reports/finance-members.xlsx',
    });

    expect(getGroupMembers).toHaveBeenCalledWith({ group: payload.group });
    expect(buildGroupMembersWorkbookBuffer).toHaveBeenCalledWith(
      payload,
      expect.objectContaining({ items: expect.any(Array) }),
      expect.any(String),
    );
    expect(mkdir).toHaveBeenCalledWith('C:/Reports', { recursive: true });
    expect(writeFile).toHaveBeenCalledWith(
      'C:/Reports/finance-members.xlsx',
      Buffer.from('xlsx-data'),
    );
    expect(result.outputPath).toBe('C:/Reports/finance-members.xlsx');
    expect(result.summary.memberCount).toBe(1);
  });

  it('uses a save dialog with a group-specific default filename', async () => {
    vi.mocked(dialog.showSaveDialog).mockResolvedValue({
      canceled: false,
      filePath: 'C:/Users/Test/Downloads/Finance-Group-members-2026-04-14.xlsx',
    } as never);

    const result = await exportGroupMembers(payload, { browserWindow: null });

    expect(app.getPath).toHaveBeenCalledWith('downloads');
    expect(dialog.showSaveDialog).toHaveBeenCalledWith(
      expect.objectContaining({
        title: 'Save group members export',
        defaultPath: expect.stringContaining('Finance-Group-members-'),
      }),
    );
    expect(result.outputPath).toContain('Finance-Group-members-');
  });

  it('throws when the save dialog is cancelled', async () => {
    vi.mocked(dialog.showSaveDialog).mockResolvedValue({ canceled: true } as never);

    await expect(exportGroupMembers(payload, { browserWindow: null })).rejects.toThrow(
      'Group members export was cancelled.',
    );
  });
});
