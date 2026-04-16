import { describe, expect, it } from 'vitest';

import { CommandFailure, createCommandFailure } from './command-failure';

describe('command-failure', () => {
  it('creates a typed command failure from a classified IPC error', () => {
    const failure = createCommandFailure(
      {
        code: 'graph_authorization_failure',
        message: 'Guest invitation was denied by Microsoft Graph.',
        retryable: false,
        classification: {
          category: 'authorizationFailure',
          remediation: 'verifyPermissions',
          backend: 'graph',
          operation: 'guests.invite',
          guidance: 'Verify Graph admin consent before retrying.',
          statusCode: 403,
          backendCode: 'Authorization_RequestDenied',
        },
      },
      'fallback',
    );

    expect(failure).toBeInstanceOf(CommandFailure);
    expect(failure.classification.category).toBe('authorizationFailure');
  });

  it('falls back to an unknown classified failure when the IPC error is absent', () => {
    const failure = createCommandFailure(undefined, 'Fallback message');

    expect(failure.message).toBe('Fallback message');
    expect(failure.classification.category).toBe('unknownFailure');
  });
});
