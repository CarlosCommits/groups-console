import { z } from 'zod';

export const commandNameSchema = z.enum([
  'session.getStatus',
  'exchange.getCapabilities',
  'exchange.connect',
  'exchange.getConnectionStatus',
  'exchange.disconnect',
  'exchange.listGroups',
]);

export const commandRequestSchema = z.object({
  requestId: z.string().min(1),
  command: commandNameSchema,
  issuedAt: z.string().datetime(),
  payload: z.record(z.unknown()),
});

export const commandErrorSchema = z.object({
  code: z.string().min(1),
  message: z.string().min(1),
  retryable: z.boolean(),
  details: z.string().optional(),
});

export const commandResponseSchema = z.object({
  requestId: z.string().min(1),
  success: z.boolean(),
  completedAt: z.string().datetime(),
  data: z.unknown().optional(),
  error: commandErrorSchema.optional(),
});

export const progressEventSchema = z.object({
  requestId: z.string().min(1),
  phase: z.enum(['preflight', 'executing', 'verifying', 'complete']),
  message: z.string().min(1),
  percent: z.number().min(0).max(100).optional(),
});

export type CommandName = z.infer<typeof commandNameSchema>;
export type CommandRequest = z.infer<typeof commandRequestSchema>;
export type CommandResponse<TData = unknown> = Omit<z.infer<typeof commandResponseSchema>, 'data'> & {
  data?: TData;
};
export type CommandError = z.infer<typeof commandErrorSchema>;
export type ProgressEvent = z.infer<typeof progressEventSchema>;
