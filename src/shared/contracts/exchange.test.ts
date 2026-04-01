import { describe, expect, it } from 'vitest';

import {
  exchangeCapabilitiesSchema,
  exchangeConnectPayloadSchema,
  exchangeConnectionStatusSchema,
  exchangeDisconnectPayloadSchema,
  exchangeGetConnectionStatusPayloadSchema,
  exchangeGetCapabilitiesPayloadSchema,
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
});
