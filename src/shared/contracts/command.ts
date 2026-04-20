import { z } from 'zod';

import { runtimeCommandErrorSchema } from './runtime-errors';

export const commandNameSchema = z.enum([
  'session.getStatus',
  'systemLogs.listEvents',
  'exchange.getCapabilities',
  'exchange.connect',
  'exchange.getConnectionStatus',
  'exchange.disconnect',
  'exchange.listGroups',
  'exchange.getRecipientDetails',
  'groups.getMembers',
  'groups.getMemberships',
  'groups.addMembers',
  'groups.removeMembers',
  'diagnostics.export',
  'reports.generateMembershipMatrix',
  'recipients.search',
  'graph.connect',
  'graph.getConnectionStatus',
  'graph.disconnect',
  'guests.search',
  'guests.getDetails',
  'guests.invite',
  'guests.updateCompany',
  'contacts.getDetails',
  'contacts.create',
  'contacts.updateCompany',
]);

export const commandRequestSchema = z.object({
  requestId: z.string().min(1),
  command: commandNameSchema,
  issuedAt: z.string().datetime(),
  payload: z.record(z.unknown()),
});

export const commandErrorSchema = runtimeCommandErrorSchema;

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
