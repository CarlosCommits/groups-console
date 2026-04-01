import { describe, expect, it } from 'vitest';

import {
  exchangeCapabilitiesSchema,
  exchangeGetCapabilitiesPayloadSchema,
} from './exchange';

describe('exchange contracts', () => {
  it('accepts an empty strict capabilities payload', () => {
    expect(() => exchangeGetCapabilitiesPayloadSchema.parse({})).not.toThrow();
    expect(() => exchangeGetCapabilitiesPayloadSchema.parse({ extra: true })).toThrow();
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
});
