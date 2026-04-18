import { describe, expect, it } from 'vitest';

import { commandRequestSchema, commandResponseSchema } from './command';
import { runtimeCommandErrorSchema } from './runtime-errors';

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

  it('accepts the audit.listEvents command name', () => {
    const result = commandRequestSchema.parse({
      requestId: 'req-audit',
      command: 'audit.listEvents',
      issuedAt: new Date().toISOString(),
      payload: {
        scope: { kind: 'all' },
      },
    });

    expect(result.command).toBe('audit.listEvents');
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

  it('accepts contact and guest detail command names', () => {
    const contactRequest = commandRequestSchema.parse({
      requestId: 'req-789',
      command: 'contacts.getDetails',
      issuedAt: new Date().toISOString(),
      payload: {
        stableKey: 'exchange:objectId:contact-1',
      },
    });
    const guestRequest = commandRequestSchema.parse({
      requestId: 'req-790',
      command: 'guests.getDetails',
      issuedAt: new Date().toISOString(),
      payload: {
        stableKey: 'graph:objectId:00000000-0000-0000-0000-000000000002',
      },
    });

    expect(contactRequest.command).toBe('contacts.getDetails');
    expect(guestRequest.command).toBe('guests.getDetails');
  });

  it('accepts the diagnostics.export command name', () => {
    const request = commandRequestSchema.parse({
      requestId: 'req-791',
      command: 'diagnostics.export',
      issuedAt: new Date().toISOString(),
      payload: {},
    });

    expect(request.command).toBe('diagnostics.export');
  });

  it('accepts a classified runtime failure response envelope', () => {
    const response = commandResponseSchema.parse({
      requestId: 'req-792',
      success: false,
      completedAt: new Date().toISOString(),
      error: {
        code: 'graph_authorization_failure',
        message: 'Guest invitation was denied by Microsoft Graph.',
        retryable: false,
        details: 'Authorization_RequestDenied',
        classification: {
          category: 'authorizationFailure',
          remediation: 'verifyPermissions',
          backend: 'graph',
          operation: 'guests.invite',
          guidance: 'Verify Graph consent, tenant policy, and the operator role before retrying.',
          statusCode: 403,
          backendCode: 'Authorization_RequestDenied',
        },
      },
    });

    expect(response.error?.classification.category).toBe('authorizationFailure');
  });

  it('requires classified runtime failures to include guidance', () => {
    expect(() =>
      runtimeCommandErrorSchema.parse({
        code: 'unknown_failure',
        message: 'Something failed.',
        retryable: false,
        classification: {
          category: 'unknownFailure',
          remediation: 'retryFromFreshState',
          backend: 'app',
          operation: 'session.getStatus',
        },
      }),
    ).toThrow();
  });
});
