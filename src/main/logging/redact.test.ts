import { describe, expect, it } from 'vitest';

import { redactForLog } from './redact';

describe('redactForLog', () => {
  it('redacts sensitive keys and bearer tokens', () => {
    const result = redactForLog({
      authorization: 'Bearer secret-token',
      nested: {
        accessToken: 'eyJhbGciOiJIUzI1NiJ9.payload.signature',
        cookie: 'session=abc',
      },
      safe: 'ok',
    });

    expect(result).toEqual({
      authorization: '[REDACTED]',
      nested: {
        accessToken: '[REDACTED]',
        cookie: '[REDACTED]',
      },
      safe: 'ok',
    });
  });
});
