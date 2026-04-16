import { z } from 'zod';

export const runtimeFailureCategorySchema = z.enum([
  'connectionFailure',
  'authorizationFailure',
  'tenantMismatch',
  'unknownFailure',
]);

export const runtimeRemediationSchema = z.enum([
  'reconnect',
  'verifyPermissions',
  'reconnectMatchedTenant',
  'retryFromFreshState',
  'contactAdministrator',
]);

export const runtimeFailureBackendSchema = z.enum(['exchange', 'graph', 'app']);

export const commandErrorClassificationSchema = z
  .object({
    category: runtimeFailureCategorySchema,
    remediation: runtimeRemediationSchema,
    backend: runtimeFailureBackendSchema,
    operation: z.string().min(1),
    guidance: z.string().min(1),
    statusCode: z.number().int().min(100).max(599).optional(),
    backendCode: z.string().min(1).optional(),
  })
  .strict();

export const runtimeCommandErrorSchema = z
  .object({
    code: z.string().min(1),
    message: z.string().min(1),
    retryable: z.boolean(),
    details: z.string().min(1).optional(),
    classification: commandErrorClassificationSchema,
  })
  .strict();

export type RuntimeFailureCategory = z.infer<typeof runtimeFailureCategorySchema>;
export type RuntimeRemediation = z.infer<typeof runtimeRemediationSchema>;
export type RuntimeFailureBackend = z.infer<typeof runtimeFailureBackendSchema>;
export type CommandErrorClassification = z.infer<typeof commandErrorClassificationSchema>;
export type RuntimeCommandError = z.infer<typeof runtimeCommandErrorSchema>;
