import { z } from 'zod';

export const diagnosticsExportPayloadSchema = z.object({}).strict();

export const diagnosticsExportResultSchema = z
  .object({
    outputPath: z.string().min(1),
    generatedAt: z.string().datetime(),
    fileCount: z.number().int().nonnegative(),
  })
  .strict();

export type DiagnosticsExportPayload = z.infer<typeof diagnosticsExportPayloadSchema>;
export type DiagnosticsExportResult = z.infer<typeof diagnosticsExportResultSchema>;
