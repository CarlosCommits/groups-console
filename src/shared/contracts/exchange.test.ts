import { describe, expect, it } from 'vitest';

import {
  exchangeCapabilitiesSchema,
  exchangeConnectPayloadSchema,
  exchangeConnectionStatusSchema,
  exchangeDisconnectPayloadSchema,
  exchangeGetConnectionStatusPayloadSchema,
  exchangeGetCapabilitiesPayloadSchema,
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
      ],
    });

    expect(result.items[0]?.recipientType).toBe('mailbox');
  });
});
