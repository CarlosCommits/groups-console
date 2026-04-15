import { describe, expect, it } from 'vitest';

import {
  reportMembershipMatrixDataSchema,
  reportsGenerateMembershipMatrixPayloadSchema,
  reportsGenerateMembershipMatrixResultSchema,
} from './reports';

describe('reports contracts', () => {
  it('accepts strict membership matrix payloads', () => {
    expect(() =>
      reportsGenerateMembershipMatrixPayloadSchema.parse({
        kind: 'distributionList',
      }),
    ).not.toThrow();

    expect(() =>
      reportsGenerateMembershipMatrixPayloadSchema.parse({
        kind: 'all',
      }),
    ).not.toThrow();

    expect(() =>
      reportsGenerateMembershipMatrixPayloadSchema.parse({
        outputPath: 'C:/Reports/membership-matrix.xlsx',
      }),
    ).toThrow();
  });

  it('accepts normalized membership matrix data', () => {
    const result = reportMembershipMatrixDataSchema.parse({
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
      ],
      summary: {
        groupCount: 1,
        recipientCount: 1,
        membershipCount: 1,
      },
    });

    expect(result.rows[0]?.stableRecipientKey).toBe('exchange:recipient-1');
  });

  it('accepts a membership matrix result payload', () => {
    const result = reportsGenerateMembershipMatrixResultSchema.parse({
      appliedKind: 'mailEnabledSecurityGroup',
      outputPath: 'C:/Reports/membership-matrix.xlsx',
      generatedAt: '2026-04-14T12:00:00.000Z',
      summary: {
        groupCount: 3,
        recipientCount: 25,
        membershipCount: 40,
      },
    });

    expect(result.summary.groupCount).toBe(3);
  });
});
