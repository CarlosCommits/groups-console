import { describe, expect, it } from 'vitest';

import {
  exchangeCapabilitiesSchema,
  exchangeConnectPayloadSchema,
  exchangeConnectionStatusSchema,
  exchangeDisconnectPayloadSchema,
  exchangeGetConnectionStatusPayloadSchema,
  exchangeRecipientGetDetailsPayloadSchema,
  exchangeRecipientGetDetailsResultSchema,
  exchangeGetCapabilitiesPayloadSchema,
  guestMembershipTargetResultSchema,
  groupsAddMembersPayloadSchema,
  groupsAddMembersResultSchema,
  groupsRemoveMembersPayloadSchema,
  groupsRemoveMembersResultSchema,
  groupsGetMembersPayloadSchema,
  groupsGetMembersResultSchema,
  exchangeListGroupsPayloadSchema,
  exchangeListGroupsResultSchema,
} from './exchange';

describe('exchange contracts', () => {
  it('accepts an empty strict capabilities payload', () => {
    expect(() => exchangeGetCapabilitiesPayloadSchema.parse({})).not.toThrow();
    expect(() => exchangeGetCapabilitiesPayloadSchema.parse({ extra: true })).toThrow();
  });

  it('accepts strict connect and connection status payloads', () => {
    expect(() =>
      exchangeConnectPayloadSchema.parse({
        userPrincipalName: 'admin@example.com',
      }),
    ).not.toThrow();
    expect(() => exchangeGetConnectionStatusPayloadSchema.parse({})).not.toThrow();
    expect(() => exchangeDisconnectPayloadSchema.parse({})).not.toThrow();
  });

  it('accepts strict list-groups payloads', () => {
    expect(() => exchangeListGroupsPayloadSchema.parse({})).not.toThrow();
    expect(() => exchangeListGroupsPayloadSchema.parse({ kind: 'distributionList' })).not.toThrow();
    expect(() => exchangeListGroupsPayloadSchema.parse({ extra: true })).toThrow();
  });

  it('accepts strict recipient detail payloads', () => {
    expect(() =>
      exchangeRecipientGetDetailsPayloadSchema.parse({
        stableKey: 'exchange:objectId:recipient-1',
      }),
    ).not.toThrow();
    expect(() => exchangeRecipientGetDetailsPayloadSchema.parse({})).toThrow();
    expect(() =>
      exchangeRecipientGetDetailsPayloadSchema.parse({
        stableKey: 'exchange:objectId:recipient-1',
        extra: true,
      }),
    ).toThrow();
  });

  it('accepts strict group member payloads', () => {
    expect(() =>
      groupsGetMembersPayloadSchema.parse({
        group: {
          exchangeIdentity: 'finance-group',
          objectId: null,
          groupKind: 'distributionList',
        },
      }),
    ).not.toThrow();
    expect(() => groupsGetMembersPayloadSchema.parse({})).toThrow();
  });

  it('accepts strict add-members payloads and rejects duplicates', () => {
    expect(() =>
      groupsAddMembersPayloadSchema.parse({
        group: {
          exchangeIdentity: 'finance-group',
          objectId: null,
          groupKind: 'distributionList',
        },
        members: [
          {
            kind: 'exchangeRecipient',
            exchangeIdentity: 'jane@example.com',
            objectId: null,
            primaryEmail: 'jane@example.com',
            displayName: 'Jane Example',
          },
        ],
        verify: true,
      }),
    ).not.toThrow();

    expect(() =>
      groupsAddMembersPayloadSchema.parse({
        group: {
          exchangeIdentity: 'finance-group',
          objectId: null,
          groupKind: 'distributionList',
        },
        members: [
          {
            kind: 'graphGuest',
            objectId: '00000000-0000-0000-0000-000000000001',
            primaryEmail: 'jane@example.com',
            displayName: 'Jane Example Guest',
          },
          {
            kind: 'graphGuest',
            objectId: '00000000-0000-0000-0000-000000000001',
            primaryEmail: 'jane@example.com',
            displayName: 'Jane Example Guest',
          },
        ],
        verify: true,
      }),
    ).toThrow();

    expect(() =>
      groupsAddMembersPayloadSchema.parse({
        group: {
          exchangeIdentity: 'finance-group',
          objectId: null,
          groupKind: 'distributionList',
        },
        members: [
          {
            kind: 'graphGuest',
            objectId: 'guest-1',
            primaryEmail: 'jane@example.com',
            displayName: 'Jane Example Guest',
          },
        ],
        verify: true,
      }),
    ).toThrow();
  });

  it('accepts strict remove-members payloads and rejects duplicates', () => {
    expect(() =>
      groupsRemoveMembersPayloadSchema.parse({
        group: {
          exchangeIdentity: 'finance-group',
          objectId: null,
          groupKind: 'distributionList',
        },
        members: [
          {
            exchangeIdentity: 'jane@example.com',
            objectId: null,
            primaryEmail: 'jane@example.com',
          },
        ],
        verify: true,
      }),
    ).not.toThrow();

    expect(() =>
      groupsRemoveMembersPayloadSchema.parse({
        group: {
          exchangeIdentity: 'finance-group',
          objectId: null,
          groupKind: 'distributionList',
        },
        members: [
          {
            exchangeIdentity: 'jane@example.com',
            objectId: null,
            primaryEmail: 'jane@example.com',
          },
          {
            exchangeIdentity: 'jane@example.com',
            objectId: null,
            primaryEmail: 'jane@example.com',
          },
        ],
        verify: true,
      }),
    ).toThrow();
  });

  it('accepts a capabilities response payload', () => {
    const result = exchangeCapabilitiesSchema.parse({
      status: 'ready',
      detail: 'Exchange module is importable.',
      runtime: {
        command: 'powershell.exe',
        label: 'Windows PowerShell',
        version: '5.1.19041.1',
        edition: 'Desktop',
      },
      exchangeModule: {
        installed: true,
        importable: true,
        version: '3.9.0',
        moduleBase: 'C:/Users/test/Documents/WindowsPowerShell/Modules/ExchangeOnlineManagement',
        importError: null,
        commandChecks: {
          connectExchangeOnline: true,
          disconnectExchangeOnline: true,
          getConnectionInformation: true,
        },
      },
    });

    expect(result.status).toBe('ready');
  });

  it('accepts a connection status payload', () => {
    const result = exchangeConnectionStatusSchema.parse({
      state: 'connected',
      detail: 'Connected to Exchange Online.',
      runtime: {
        command: 'powershell.exe',
        label: 'Windows PowerShell',
        version: '5.1.19041.1',
        edition: 'Desktop',
      },
      userPrincipalName: 'admin@example.com',
      connectionId: 'connection-1',
      tenantId: 'tenant-1',
      tokenStatus: 'Active',
      tokenExpiryTimeUtc: '2026-04-01T12:00:00.000Z',
      connectedAtUtc: '2026-04-01T10:00:00.000Z',
    });

    expect(result.state).toBe('connected');
  });

  it('accepts a group list result payload', () => {
    const result = exchangeListGroupsResultSchema.parse({
      appliedKind: 'all',
      items: [
        {
          objectId: null,
          exchangeIdentity: 'group-identity-1',
          displayName: 'Finance Distribution',
          alias: 'finance',
          primaryEmail: 'finance@example.com',
          groupKind: 'distributionList',
          managedByDisplayNames: ['Owner One'],
          whenChangedUtc: '2026-04-01T12:00:00.000Z',
        },
      ],
    });

    expect(result.items[0]?.groupKind).toBe('distributionList');
  });

  it('accepts an exchange recipient details result payload', () => {
    const result = exchangeRecipientGetDetailsResultSchema.parse({
      recipient: {
        exchangeIdentity: 'jane@example.com',
        objectId: 'recipient-1',
        primaryEmail: 'jane@example.com',
        externalEmailAddress: null,
        displayName: 'Jane Example',
        alias: 'jexample',
        companyName: 'Example Corp',
        firstName: 'Jane',
        lastName: 'Example',
        title: 'Director',
        department: 'Operations',
        phone: '+1 555-0100',
        office: 'HQ-201',
        userPrincipalName: 'jane@example.com',
        recipientType: 'mailbox',
        recipientTypeDetails: 'UserMailbox',
      },
    });

    expect(result.recipient.recipientType).toBe('mailbox');
  });

  it('accepts a mail user recipient details result with a distinct external email target', () => {
    const result = exchangeRecipientGetDetailsResultSchema.parse({
      recipient: {
        exchangeIdentity: 'jane.external@example.com',
        objectId: 'recipient-2',
        primaryEmail: 'jane@yourcompany.com',
        externalEmailAddress: 'jane@gmail.com',
        displayName: 'Jane External',
        alias: 'jexternal',
        companyName: 'Example Corp',
        firstName: 'Jane',
        lastName: 'External',
        title: null,
        department: null,
        phone: null,
        office: null,
        userPrincipalName: 'jane_external#EXT#@tenant.onmicrosoft.com',
        recipientType: 'mailUser',
        recipientTypeDetails: 'MailUser',
      },
    });

    expect(result.recipient.primaryEmail).toBe('jane@yourcompany.com');
    expect(result.recipient.externalEmailAddress).toBe('jane@gmail.com');
  });

  it('accepts a group members result payload', () => {
    const result = groupsGetMembersResultSchema.parse({
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
    });

    expect(result.items[1]?.recipientType).toBe('guestMailUser');
  });

  it('accepts an add-members result payload', () => {
    const result = groupsAddMembersResultSchema.parse({
      group: {
        exchangeIdentity: 'finance-group',
        objectId: null,
        groupKind: 'distributionList',
      },
      summary: {
        requested: 2,
        added: 1,
        alreadyMember: 1,
        invalid: 0,
        verificationFailed: 0,
        failed: 0,
      },
      items: [
        {
          member: {
            exchangeIdentity: 'jane@example.com',
            objectId: null,
            primaryEmail: 'jane@example.com',
          },
          status: 'added',
          detail: 'Added successfully.',
        },
      ],
      verification: {
        attempted: true,
        verifiedAdded: 1,
        detail: 'Verified added members.',
      },
    });

    expect(result.summary.added).toBe(1);
  });

  it('accepts a remove-members result payload', () => {
    const result = groupsRemoveMembersResultSchema.parse({
      group: {
        exchangeIdentity: 'finance-group',
        objectId: null,
        groupKind: 'distributionList',
      },
      summary: {
        requested: 2,
        removed: 1,
        notMember: 1,
        invalid: 0,
        verificationFailed: 0,
        failed: 0,
      },
      items: [
        {
          member: {
            exchangeIdentity: 'jane@example.com',
            objectId: null,
            primaryEmail: 'jane@example.com',
          },
          status: 'removed',
          detail: 'Removed successfully.',
        },
      ],
      verification: {
        attempted: true,
        verifiedRemoved: 1,
        detail: 'Verified removed members.',
      },
    });

    expect(result.summary.removed).toBe(1);
  });

  it('accepts a guest membership target response payload', () => {
    const result = guestMembershipTargetResultSchema.parse({
      resolved: true,
      member: {
        exchangeIdentity: 'Guest_abc123',
        objectId: 'guest-1',
        primaryEmail: 'guest@example.com',
      },
      detail: 'Resolved the selected guest to an Exchange GuestMailUser.',
    });

    expect(result.resolved).toBe(true);
  });
});
