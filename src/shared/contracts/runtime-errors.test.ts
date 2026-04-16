import { describe, expect, it } from 'vitest';

import { commandErrorClassificationSchema, runtimeCommandErrorSchema } from './runtime-errors';

describe('runtime error contracts', () => {
  it('accepts a classified authorization failure', () => {
    const classification = commandErrorClassificationSchema.parse({
      category: 'authorizationFailure',
      remediation: 'verifyPermissions',
      backend: 'graph',
      operation: 'guests.invite',
      guidance: 'Verify Graph consent and directory role assignments before retrying.',
      statusCode: 403,
      backendCode: 'Authorization_RequestDenied',
    });

    expect(classification.backend).toBe('graph');
  });

  it('rejects unknown remediation values', () => {
    expect(() =>
      commandErrorClassificationSchema.parse({
        category: 'authorizationFailure',
        remediation: 'askTheCloud',
        backend: 'graph',
        operation: 'guests.invite',
        guidance: 'Nope.',
      }),
    ).toThrow();
  });

  it('accepts a runtime command error with classification metadata', () => {
    const error = runtimeCommandErrorSchema.parse({
      code: 'exchange_connection_failure',
      message: 'Exchange session host is not running. Connect to Exchange Online first.',
      retryable: true,
      classification: {
        category: 'connectionFailure',
        remediation: 'reconnect',
        backend: 'exchange',
        operation: 'groups.getMembers',
        guidance: 'Reconnect to Exchange Online, then try the group action again.',
      },
    });

    expect(error.classification.category).toBe('connectionFailure');
  });
});
