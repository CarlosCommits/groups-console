import { z } from 'zod';

export const updateStateSchema = z.enum([
  'unsupported',
  'idle',
  'checking',
  'notAvailable',
  'available',
  'downloaded',
  'error',
]);

export const updateStatusSchema = z.object({
  state: updateStateSchema,
  currentVersion: z.string().min(1),
  updateVersion: z.string().min(1).nullable(),
  detail: z.string().min(1).nullable(),
  checkedAt: z.string().datetime().nullable(),
  canCheck: z.boolean(),
  canInstall: z.boolean(),
});

export type UpdateState = z.infer<typeof updateStateSchema>;
export type UpdateStatus = z.infer<typeof updateStatusSchema>;
