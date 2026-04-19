import { z } from 'zod';

export const systemLogResultSchema = z.enum(['succeeded', 'failed', 'partial']);

export const systemLogScopeSchema = z.discriminatedUnion('kind', [
  z
    .object({
      kind: z.literal('all'),
    })
    .strict(),
  z
    .object({
      kind: z.literal('targetObject'),
      targetObjectId: z.string().min(1),
      targetObjectTypes: z.array(z.string().min(1)).optional(),
    })
    .strict(),
]);

export const systemLogEventItemSchema = z
  .object({
    timestamp: z.string().datetime(),
    operationId: z.string().min(1),
    ipcRequestId: z.string().min(1).nullable(),
    actorUpn: z.string().min(1).nullable(),
    tenantId: z.string().min(1).nullable(),
    operationType: z.string().min(1),
    targetObjectType: z.string().min(1),
    targetObjectId: z.string().min(1).nullable(),
    summary: z.string().min(1),
    result: systemLogResultSchema,
    authoritative: z.boolean(),
  })
  .strict();

export const systemLogsListEventsPayloadSchema = z
  .object({
    scope: systemLogScopeSchema,
    cursor: z.string().min(1).optional(),
    pageSize: z.number().int().positive().max(100).optional(),
    query: z.string().min(1).optional(),
    operationType: z.string().min(1).optional(),
    result: systemLogResultSchema.optional(),
  })
  .strict();

export const systemLogsListEventsResultSchema = z
  .object({
    items: z.array(systemLogEventItemSchema),
    nextCursor: z.string().min(1).nullable(),
  })
  .strict();

export type SystemLogResult = z.infer<typeof systemLogResultSchema>;
export type SystemLogScope = z.infer<typeof systemLogScopeSchema>;
export type SystemLogEventItem = z.infer<typeof systemLogEventItemSchema>;
export type SystemLogsListEventsPayload = z.infer<typeof systemLogsListEventsPayloadSchema>;
export type SystemLogsListEventsResult = z.infer<typeof systemLogsListEventsResultSchema>;
