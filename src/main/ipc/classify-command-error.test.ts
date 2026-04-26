import { describe, expect, it } from 'vitest';

import { classifyCommandError } from './classify-command-error';

describe('classifyCommandError', () => {
  it('classifies graph 403 failures as authorization failures', () => {
    const result = classifyCommandError({
      commandName: 'guests.invite',
      backendOwner: 'graph',
      error: Object.assign(new Error('Microsoft Graph request failed with 403 Forbidden.'), {
        statusCode: 403,
        backendCode: 'Authorization_RequestDenied',
      }),
    });

    expect(result.code).toBe('graph_authorization_failure');
    expect(result.classification.category).toBe('authorizationFailure');
    expect(result.classification.backendCode).toBe('Authorization_RequestDenied');
    expect(result.classification.guidance).toContain('Microsoft/IT admin');
    expect(result.classification.guidance).toContain('User.Invite.All');
  });

  it('gives a specific access tip for guest profile company update authorization failures', () => {
    const result = classifyCommandError({
      commandName: 'guests.updateCompany',
      backendOwner: 'graph',
      error: Object.assign(new Error('Microsoft Graph request failed with 403 Forbidden.'), {
        statusCode: 403,
        backendCode: 'Authorization_RequestDenied',
      }),
    });

    expect(result.code).toBe('graph_authorization_failure');
    expect(result.classification.guidance).toContain('Microsoft Entra User Administrator');
    expect(result.classification.guidance).toContain('User.ReadWrite.All');
  });

  it('classifies exchange disconnected failures as connection failures', () => {
    const result = classifyCommandError({
      commandName: 'groups.getMembers',
      backendOwner: 'exchange',
      error: new Error('Exchange session host is not running. Connect to Exchange Online first.'),
    });

    expect(result.code).toBe('exchange_connection_failure');
    expect(result.retryable).toBe(true);
    expect(result.classification.category).toBe('connectionFailure');
  });

  it('honors an error-provided backend owner for composite commands', () => {
    const result = classifyCommandError({
      commandName: 'recipients.search',
      backendOwner: 'app',
      error: Object.assign(new Error('Exchange session host is not running. Connect to Exchange Online first.'), {
        backendOwner: 'exchange',
      }),
    });

    expect(result.code).toBe('exchange_connection_failure');
    expect(result.classification.backend).toBe('exchange');
  });

  it('classifies tenant mismatch failures separately', () => {
    const result = classifyCommandError({
      commandName: 'guests.updateCompany',
      backendOwner: 'graph',
      error: new Error('Microsoft Graph is connected, but the tenant does not match the current Exchange session. Reconnect with a matching tenant.'),
    });

    expect(result.classification.category).toBe('tenantMismatch');
    expect(result.classification.remediation).toBe('reconnectMatchedTenant');
  });

  it('classifies graph validation failures separately', () => {
    const result = classifyCommandError({
      commandName: 'guests.invite',
      backendOwner: 'graph',
      error: Object.assign(new Error('Microsoft Graph request failed with 400 Bad Request.'), {
        statusCode: 400,
        backendCode: 'Request_BadRequest',
        details: 'The invited user email address is invalid.',
      }),
    });

    expect(result.code).toBe('graph_validation_failure');
    expect(result.classification.category).toBe('validationFailure');
    expect(result.details).toBe('The invited user email address is invalid.');
  });

  it('classifies graph conflict failures separately', () => {
    const result = classifyCommandError({
      commandName: 'guests.invite',
      backendOwner: 'graph',
      error: Object.assign(new Error('Microsoft Graph request failed with 409 Conflict.'), {
        statusCode: 409,
        backendCode: 'Directory_ConcurrencyViolation',
      }),
    });

    expect(result.code).toBe('graph_conflict_failure');
    expect(result.classification.category).toBe('conflictFailure');
  });

  it('classifies graph throttling failures as retryable', () => {
    const result = classifyCommandError({
      commandName: 'guests.invite',
      backendOwner: 'graph',
      error: Object.assign(new Error('Microsoft Graph request failed with 429 Too Many Requests.'), {
        statusCode: 429,
        backendCode: 'TooManyRequests',
      }),
    });

    expect(result.code).toBe('graph_throttling_failure');
    expect(result.retryable).toBe(true);
    expect(result.classification.category).toBe('throttlingFailure');
  });
});
