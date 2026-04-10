import { z } from 'zod';

export const sessionGetStatusPayloadSchema = z.object({});

export const bootstrapCheckStatusSchema = z.enum(['ready', 'warning', 'missing']);

export const bootstrapCheckSchema = z.object({
  id: z.enum(['powershell', 'exchangeModule', 'logDirectory', 'tenantConfig']),
  label: z.string().min(1),
  status: bootstrapCheckStatusSchema,
  detail: z.string().min(1),
});

export const sessionStatusSchema = z.object({
  appVersion: z.string().min(1),
  environment: z.enum(['development', 'production']),
  checks: z.array(bootstrapCheckSchema),
  security: z.object({
    contextIsolation: z.boolean(),
    sandbox: z.boolean(),
    nodeIntegration: z.boolean(),
  }),
});

export type BootstrapCheckStatus = z.infer<typeof bootstrapCheckStatusSchema>;
export type SessionGetStatusPayload = z.infer<typeof sessionGetStatusPayloadSchema>;
export type SessionStatusSchema = z.infer<typeof sessionStatusSchema>;
