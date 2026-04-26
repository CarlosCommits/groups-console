import ExcelJS from 'exceljs';

import type { ReportMembershipMatrixData } from '@/shared/contracts/reports';

const WORKSHEET_NAME = 'Membership Matrix';

export async function buildMembershipMatrixWorkbookBuffer(
  data: ReportMembershipMatrixData,
): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Groups Console';
  workbook.created = new Date(data.generatedAt);

  const worksheet = workbook.addWorksheet(WORKSHEET_NAME, {
    views: [{ state: 'frozen', xSplit: 2, ySplit: 1 }],
  });

  const groupColumns = data.groups.map((group) => ({
    key: group.exchangeIdentity,
    header: group.displayName,
    width: Math.max(14, group.displayName.length + 4),
  }));

  worksheet.columns = [
    { header: 'Display Name', key: 'displayName', width: 32 },
    { header: 'Primary Email', key: 'primaryEmail', width: 34 },
    { header: 'Recipient Type', key: 'recipientType', width: 20 },
    { header: 'Source', key: 'source', width: 12 },
    { header: 'Company', key: 'companyName', width: 24 },
    ...groupColumns,
  ];

  const headerRow = worksheet.getRow(1);
  headerRow.font = { bold: true };

  data.rows.forEach((row) => {
    const worksheetRow = worksheet.addRow({
      displayName: row.displayName,
      primaryEmail: row.primaryEmail ?? '',
      recipientType: row.recipientType,
      source: row.source ?? '',
      companyName: row.companyName ?? '',
    });

    data.groups.forEach((group, index) => {
      worksheetRow.getCell(6 + index).value = row.memberships.includes(group.exchangeIdentity) ? 'X' : '';
    });
  });

  worksheet.autoFilter = {
    from: 'A1',
    to: worksheet.getCell(1, Math.max(5, worksheet.columnCount)).address,
  };

  const buffer = await workbook.xlsx.writeBuffer();
  return Buffer.isBuffer(buffer) ? buffer : Buffer.from(buffer);
}

export { WORKSHEET_NAME };
