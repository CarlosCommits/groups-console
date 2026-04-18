import { z } from 'zod';

export const auditResultSchema = z.enum(['succeeded', 'failed', 'partial']);

export const auditScopeSchema = z.discriminatedUnion('kind', [
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

export const auditEventItemSchema = z
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
    result: auditResultSchema,
    authoritative: z.boolean(),
  })
  .strict();

export const auditListEventsPayloadSchema = z
  .object({
    scope: auditScopeSchema,
    cursor: z.string().min(1).optional(),
    pageSize: z.number().int().positive().max(100).optional(),
    query: z.string().min(1).optional(),
    operationType: z.string().min(1).optional(),
    result: auditResultSchema.optional(),
  })
  .strict();

export const auditListEventsResultSchema = z
  .object({
    items: z.array(auditEventItemSchema),
    nextCursor: z.string().min(1).nullable(),
  })
  .strict();

export type AuditResult = z.infer<typeof auditResultSchema>;
export type AuditScope = z.infer<typeof auditScopeSchema>;
export type AuditEventItem = z.infer<typeof auditEventItemSchema>;
export type AuditListEventsPayload = z.infer<typeof auditListEventsPayloadSchema>;
export type AuditListEventsResult = z.infer<typeof auditListEventsResultSchema>;
