import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

import { app, type BrowserWindow, dialog } from 'electron';

import {
  groupsExportMembersResultSchema,
  type GroupsExportMembersPayload,
  type GroupsExportMembersResult,
} from '@/shared/contracts/exchange';
import { getGroupMembers } from '@/main/exchange/get-group-members';

import { buildGroupMembersWorkbookBuffer } from './build-group-members-workbook';

type ExportGroupMembersOptions = {
  browserWindow: BrowserWindow | null;
  outputPathOverride?: string;
};

export async function exportGroupMembers(
  payload: GroupsExportMembersPayload,
  options: ExportGroupMembersOptions,
): Promise<GroupsExportMembersResult> {
  const outputPath = await resolveOutputPath(
    options.outputPathOverride,
    options.browserWindow,
    payload.groupDisplayName,
  );
  const generatedAt = new Date().toISOString();
  const membersResult = await getGroupMembers({ group: payload.group });
  const workbookBuffer = await buildGroupMembersWorkbookBuffer(payload, membersResult, generatedAt);

  await mkdir(path.dirname(outputPath), { recursive: true });
  await writeFile(outputPath, workbookBuffer);

  return groupsExportMembersResultSchema.parse({
    group: payload.group,
    outputPath,
    generatedAt,
    summary: {
      memberCount: membersResult.items.length,
    },
  });
}

async function resolveOutputPath(
  outputPathOverride: string | undefined,
  browserWindow: BrowserWindow | null,
  groupDisplayName: string,
): Promise<string> {
  if (outputPathOverride) {
    return outputPathOverride;
  }

  const defaultPath = path.join(
    app.getPath('downloads'),
    `${sanitizeFilename(groupDisplayName)}-members-${new Date().toISOString().slice(0, 10)}.xlsx`,
  );
  const dialogOptions: Electron.SaveDialogOptions = {
    title: 'Save group members export',
    defaultPath,
    filters: [{ name: 'Excel Workbook', extensions: ['xlsx'] }],
    properties: ['createDirectory', 'showOverwriteConfirmation'],
  };
  const result = browserWindow
    ? await dialog.showSaveDialog(browserWindow, dialogOptions)
    : await dialog.showSaveDialog(dialogOptions);

  if (result.canceled || !result.filePath) {
    throw new Error('Group members export was cancelled.');
  }

  return result.filePath;
}

function sanitizeFilename(value: string): string {
  const sanitized = value
    .trim()
    .split('')
    .map((character) => (isUnsafeFilenameCharacter(character) ? '-' : character))
    .join('')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .replace(/^-|-$/g, '');

  return sanitized || 'group';
}

function isUnsafeFilenameCharacter(character: string): boolean {
  return character.charCodeAt(0) < 32 || /[<>:"/\\|?*]/.test(character);
}
