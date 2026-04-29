import ExcelJS from 'exceljs';

import type {
  GroupsExportMembersPayload,
  GroupsGetMembersResult,
} from '@/shared/contracts/exchange';

const WORKSHEET_NAME = 'Group Members';

export async function buildGroupMembersWorkbookBuffer(
  payload: GroupsExportMembersPayload,
  membersResult: GroupsGetMembersResult,
  generatedAt: string,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Groups Console';
  workbook.created = new Date(generatedAt);

  const worksheet = workbook.addWorksheet(WORKSHEET_NAME, {
    views: [{ state: 'frozen', ySplit: 5 }],
  });

  worksheet.addRow(['Group', payload.groupDisplayName]);
  worksheet.addRow(['Email', payload.groupPrimaryEmail ?? '']);
  worksheet.addRow(['Exported At', generatedAt]);
  worksheet.addRow(['Member Count', membersResult.items.length]);
  worksheet.addRow([]);

  const headerRow = worksheet.addRow([
    'Display Name',
    'Primary Email',
    'Alias',
    'Recipient Type',
    'Recipient Details',
    'Object ID',
    'Exchange Identity',
  ]);
  headerRow.font = { bold: true };

  membersResult.items.forEach((member) => {
    worksheet.addRow([
      member.displayName,
      member.primaryEmail ?? '',
      member.alias ?? '',
      member.recipientType,
      member.recipientTypeDetails,
      member.objectId ?? '',
      member.exchangeIdentity,
    ]);
  });

  worksheet.columns = [
    { width: 32 },
    { width: 34 },
    { width: 20 },
    { width: 22 },
    { width: 24 },
    { width: 38 },
    { width: 46 },
  ];

  worksheet.autoFilter = {
    from: 'A6',
    to: 'G6',
  };

  const titleCells = ['A1', 'A2', 'A3', 'A4'];
  titleCells.forEach((address) => {
    worksheet.getCell(address).font = { bold: true };
  });

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
}

export { WORKSHEET_NAME };
