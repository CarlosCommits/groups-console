import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import { buildGroupMembersWorkbookBuffer, WORKSHEET_NAME } from './build-group-members-workbook';

describe('buildGroupMembersWorkbookBuffer', () => {
  it('creates a workbook with group metadata and member rows', async () => {
    const buffer = await buildGroupMembersWorkbookBuffer(
      {
        group: {
          exchangeIdentity: 'finance-group',
          objectId: null,
          groupKind: 'distributionList',
        },
        groupDisplayName: 'Finance Group',
        groupPrimaryEmail: 'finance@example.com',
      },
      {
        group: {
          exchangeIdentity: 'finance-group',
          objectId: null,
          groupKind: 'distributionList',
        },
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
          {
            objectId: 'guest-1',
            exchangeIdentity: 'Guest_abc123',
            displayName: 'Guest Example',
            primaryEmail: 'guest@example.com',
            alias: null,
            recipientType: 'guestMailUser',
            recipientTypeDetails: 'GuestMailUser',
          },
        ],
      },
      '2026-04-14T12:00:00.000Z',
    );

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

    const worksheet = workbook.getWorksheet(WORKSHEET_NAME);
    expect(worksheet).toBeDefined();
    expect(worksheet?.views[0]).toMatchObject({ state: 'frozen', ySplit: 6 });
    expect(worksheet?.getCell('B1').value).toBe('Finance Group');
    expect(worksheet?.getCell('B2').value).toBe('finance@example.com');
    expect(worksheet?.getCell('B4').value).toBe(2);

    const headerValues = worksheet?.getRow(6).values as Array<unknown>;
    expect(headerValues.slice(1)).toEqual([
      'Display Name',
      'Primary Email',
      'Alias',
      'Recipient Type',
      'Recipient Details',
      'Object ID',
      'Exchange Identity',
    ]);
    expect(worksheet?.getCell('A7').value).toBe('Jane Example');
    expect(worksheet?.getCell('D8').value).toBe('guestMailUser');
  });
});
