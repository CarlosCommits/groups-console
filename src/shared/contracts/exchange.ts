import { z } from 'zod';

import { bootstrapCheckStatusSchema } from './session';

export const exchangeGetCapabilitiesPayloadSchema = z.object({}).strict();
export const exchangeConnectPayloadSchema = z
  .object({
    userPrincipalName: z.string().min(3),
  })
  .strict();
export const exchangeGetConnectionStatusPayloadSchema = z.object({}).strict();
export const exchangeDisconnectPayloadSchema = z.object({}).strict();

export const exchangeRuntimeSchema = z.object({
  command: z.enum(['powershell.exe', 'pwsh.exe']),
  label: z.enum(['Windows PowerShell', 'PowerShell']),
  version: z.string().min(1),
  edition: z.string().min(1),
});

export const exchangeModuleCapabilitiesSchema = z.object({
  installed: z.boolean(),
  importable: z.boolean(),
  version: z.string().nullable(),
  moduleBase: z.string().nullable(),
  importError: z.string().nullable(),
  commandChecks: z.object({
    connectExchangeOnline: z.boolean(),
    disconnectExchangeOnline: z.boolean(),
    getConnectionInformation: z.boolean(),
  }),
});

export const exchangeCapabilitiesSchema = z.object({
  status: bootstrapCheckStatusSchema,
  detail: z.string().min(1),
  runtime: exchangeRuntimeSchema.nullable(),
  exchangeModule: exchangeModuleCapabilitiesSchema,
});

export const exchangeConnectionStateSchema = z.enum(['connected', 'disconnected', 'error']);

export const exchangeConnectionStatusSchema = z.object({
  state: exchangeConnectionStateSchema,
  detail: z.string().min(1),
  runtime: exchangeRuntimeSchema.nullable(),
  userPrincipalName: z.string().nullable(),
  connectionId: z.string().nullable(),
  tenantId: z.string().nullable(),
  tokenStatus: z.string().nullable(),
  tokenExpiryTimeUtc: z.string().nullable(),
  connectedAtUtc: z.string().nullable(),
});

export type ExchangeGetCapabilitiesPayload = z.infer<typeof exchangeGetCapabilitiesPayloadSchema>;
export type ExchangeCapabilities = z.infer<typeof exchangeCapabilitiesSchema>;
export type ExchangeConnectPayload = z.infer<typeof exchangeConnectPayloadSchema>;
export type ExchangeConnectionStatus = z.infer<typeof exchangeConnectionStatusSchema>;
