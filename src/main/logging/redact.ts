const REDACTED = '[REDACTED]';

const SENSITIVE_KEY_PATTERN = /(authorization|cookie|token|secret|password|redeemurl)/i;
const JWT_PATTERN = /eyJ[A-Za-z0-9_-]+\.[A-Za-z0-9._-]+\.[A-Za-z0-9._-]+/g;
const BEARER_PATTERN = /Bearer\s+[A-Za-z0-9._-]+/gi;

export function redactForLog<T>(value: T): T {
  return redactValue(value) as T;
}

function redactValue(value: unknown): unknown {
  if (typeof value === 'string') {
    return value.replace(BEARER_PATTERN, REDACTED).replace(JWT_PATTERN, REDACTED);
  }

  if (Array.isArray(value)) {
    return value.map((entry) => redactValue(entry));
  }

  if (value && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entryValue]) => [
        key,
        SENSITIVE_KEY_PATTERN.test(key) ? REDACTED : redactValue(entryValue),
      ]),
    );
  }

  return value;
}
