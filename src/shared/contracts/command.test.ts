import { describe, expect, it } from 'vitest';

import { commandRequestSchema, commandResponseSchema } from './command';

describe('command contracts', () => {
  it('accepts a session.getStatus request envelope', () => {
    const result = commandRequestSchema.parse({
      requestId: 'req-123',
      command: 'session.getStatus',
      issuedAt: new Date().toISOString(),
      payload: {},
    });

    expect(result.command).toBe('session.getStatus');
  });

  it('accepts a successful response envelope', () => {
    const result = commandResponseSchema.parse({
      requestId: 'req-123',
      success: true,
      completedAt: new Date().toISOString(),
      data: { ok: true },
    });

    expect(result.success).toBe(true);
  });

  it('accepts the reports.generateMembershipMatrix command name', () => {
    const result = commandRequestSchema.parse({
      requestId: 'req-456',
      command: 'reports.generateMembershipMatrix',
      issuedAt: new Date().toISOString(),
      payload: {
        kind: 'all',
        outputPath: 'C:/Reports/membership-matrix.xlsx',
      },
    });

    expect(result.command).toBe('reports.generateMembershipMatrix');
  });
});
