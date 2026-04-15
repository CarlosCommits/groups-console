import ExcelJS from 'exceljs';
import { describe, expect, it } from 'vitest';

import { buildMembershipMatrixWorkbookBuffer, WORKSHEET_NAME } from './build-membership-matrix-workbook';

describe('buildMembershipMatrixWorkbookBuffer', () => {
  it('creates a workbook with base recipient columns and group membership markers', async () => {
    const buffer = await buildMembershipMatrixWorkbookBuffer({
      appliedKind: 'all',
      generatedAt: '2026-04-14T12:00:00.000Z',
      groups: [
        {
          exchangeIdentity: 'all-staff',
          objectId: 'group-1',
          groupKind: 'distributionList',
          displayName: 'All Staff',
          primaryEmail: 'allstaff@example.com',
        },
        {
          exchangeIdentity: 'security-team',
          objectId: 'group-2',
          groupKind: 'mailEnabledSecurityGroup',
          displayName: 'Security Team',
          primaryEmail: 'security@example.com',
        },
      ],
      rows: [
        {
          stableRecipientKey: 'exchange:recipient-1',
          source: 'exchange',
          recipientType: 'mailbox',
          recipientTypeDetails: 'UserMailbox',
          objectId: 'recipient-1',
          exchangeIdentity: 'jane@example.com',
          displayName: 'Jane Example',
          primaryEmail: 'jane@example.com',
          companyName: 'Example Corp',
          memberships: ['all-staff'],
        },
        {
          stableRecipientKey: 'exchange:recipient-2',
          source: 'exchange',
          recipientType: 'guestMailUser',
          recipientTypeDetails: 'GuestMailUser',
          objectId: 'recipient-2',
          exchangeIdentity: 'Guest_abc123',
          displayName: 'Guest Example',
          primaryEmail: 'guest@example.com',
          companyName: null,
          memberships: ['all-staff', 'security-team'],
        },
      ],
      summary: {
        groupCount: 2,
        recipientCount: 2,
        membershipCount: 3,
      },
    });

    const workbook = new ExcelJS.Workbook();
    await workbook.xlsx.load(buffer as unknown as Parameters<typeof workbook.xlsx.load>[0]);

    const worksheet = workbook.getWorksheet(WORKSHEET_NAME);
    expect(worksheet).toBeDefined();
    const headerValues = worksheet?.getRow(1).values as Array<unknown>;
    expect(headerValues.slice(1)).toEqual([
      'Display Name',
      'Primary Email',
      'Recipient Type',
      'Source',
      'Company',
      'All Staff',
      'Security Team',
    ]);
    expect(worksheet?.getCell('A2').value).toBe('Jane Example');
    expect(worksheet?.getCell('E2').value).toBe('Example Corp');
    expect(worksheet?.getCell('F2').value).toBe('X');
    expect(worksheet?.getCell('G2').value).toBe('');
    expect(worksheet?.getCell('F3').value).toBe('X');
    expect(worksheet?.getCell('G3').value).toBe('X');
  });
});
