import { z } from 'zod';

export const graphConnectionStateSchema = z.enum(['connected', 'disconnected', 'error']);
export const graphTenantAlignmentSchema = z.enum(['matched', 'mismatched', 'unknown']);
export const graphAuthMethodSchema = z.enum(['interactiveBrowser']);

export const graphConnectPayloadSchema = z.object({}).strict();
export const graphGetConnectionStatusPayloadSchema = z.object({}).strict();
export const graphDisconnectPayloadSchema = z.object({}).strict();

export const graphConnectionStatusSchema = z.object({
  state: graphConnectionStateSchema,
  detail: z.string().min(1),
  authMethod: graphAuthMethodSchema.nullable(),
  configuredTenantId: z.string().nullable(),
  tenantId: z.string().nullable(),
  tenantDisplayName: z.string().nullable(),
  accountUsername: z.string().nullable(),
  accountDisplayName: z.string().nullable(),
  tokenExpiresOnUtc: z.string().nullable(),
  exchangeAlignment: graphTenantAlignmentSchema,
});

export const tenantConfigSchema = z.object({
  tenantId: z.string().min(1),
  graph: z.object({
    clientId: z.string().min(1),
    redirectUri: z.string().url(),
    inviteRedirectUrl: z.string().url(),
    authorityHost: z.string().url().optional(),
    scopes: z.array(z.string().min(1)).min(1).optional(),
  }),
});

export type GraphConnectionStatus = z.infer<typeof graphConnectionStatusSchema>;
export type TenantConfig = z.infer<typeof tenantConfigSchema>;
