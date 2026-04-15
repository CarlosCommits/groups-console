import { describe, expect, it } from 'vitest';

import { diagnosticsExportPayloadSchema, diagnosticsExportResultSchema } from './diagnostics';

describe('diagnostics contracts', () => {
  it('accepts an empty export payload', () => {
    expect(() => diagnosticsExportPayloadSchema.parse({})).not.toThrow();
  });

  it('accepts a diagnostics export result payload', () => {
    const result = diagnosticsExportResultSchema.parse({
      outputPath: 'C:/Diagnostics/groups-console-diagnostics-2026-04-15T10-00-00',
      generatedAt: '2026-04-15T10:00:00.000Z',
      fileCount: 4,
    });

    expect(result.fileCount).toBe(4);
  });
});
