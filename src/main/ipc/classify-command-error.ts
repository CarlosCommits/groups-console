import type { BackendOwner } from '@/main/logging';
import type { CommandError, CommandName } from '@/shared/contracts/command';

type ErrorLike = {
  message?: unknown;
  status?: unknown;
  statusCode?: unknown;
  code?: unknown;
  backendCode?: unknown;
  details?: unknown;
  backendOwner?: unknown;
};

type NormalizedError = {
  message: string;
  statusCode?: number;
  backendCode?: string;
  details?: string;
};

const EXCHANGE_CONNECTION_PATTERNS = [
  /exchange session host is not running/i,
  /connect to exchange online first/i,
  /exchange session host is unavailable/i,
  /exchange session host exited/i,
];

const EXCHANGE_AUTHORIZATION_PATTERNS = [
  /not authorized/i,
  /insufficient permissions/i,
  /access is denied/i,
  /permission denied/i,
  /management role/i,
  /role assignment/i,
  /not a manager/i,
  /isn't a manager/i,
  /is not a manager/i,
  /authorized manager/i,
  /group owner/i,
  /managedby/i,
];

const TENANT_MISMATCH_PATTERNS = [
  /tenant mismatch/i,
  /different tenants/i,
  /matching tenant/i,
  /tenant alignment/i,
];

export function classifyCommandError(input: {
  commandName: CommandName | string;
  backendOwner: BackendOwner;
  error: unknown;
}): CommandError {
  const backend = normalizeBackendOwner(resolveBackendOwner(input.backendOwner, input.error));
  const normalized = normalizeError(input.error);

  if (isTenantMismatch(normalized.message)) {
    return {
      code: `${backend}_tenant_mismatch`,
      message: normalized.message,
      retryable: false,
      details: normalized.details,
      classification: {
        category: 'tenantMismatch',
        remediation: 'reconnectMatchedTenant',
        backend,
        operation: input.commandName,
        guidance:
          'Reconnect Microsoft Graph and Exchange with the same tenant, then retry the operation.',
        ...(normalized.statusCode ? { statusCode: normalized.statusCode } : {}),
        ...(normalized.backendCode ? { backendCode: normalized.backendCode } : {}),
      },
    };
  }

  if (isConnectionFailure(backend, normalized)) {
    return {
      code: `${backend}_connection_failure`,
      message: normalized.message,
      retryable: true,
      details: normalized.details,
      classification: {
        category: 'connectionFailure',
        remediation: 'reconnect',
        backend,
        operation: input.commandName,
        guidance:
          backend === 'graph'
            ? 'Reconnect Microsoft Graph, confirm the session is active, then retry the operation.'
            : backend === 'exchange'
              ? 'Reconnect Exchange Online, confirm the session host is healthy, then retry the operation.'
              : 'Reconnect the required service or refresh the application state, then retry the operation.',
        ...(normalized.statusCode ? { statusCode: normalized.statusCode } : {}),
        ...(normalized.backendCode ? { backendCode: normalized.backendCode } : {}),
      },
    };
  }

  if (isAuthorizationFailure(backend, normalized)) {
    return {
      code: `${backend}_authorization_failure`,
      message: normalized.message,
      retryable: false,
      details: normalized.details,
      classification: {
        category: 'authorizationFailure',
        remediation: 'verifyPermissions',
        backend,
        operation: input.commandName,
        guidance:
          backend === 'graph'
            ? 'Verify Microsoft Graph admin consent, guest invitation policy, and the operator directory role before retrying.'
            : backend === 'exchange'
              ? 'Verify Exchange RBAC, manager or owner requirements, and the operator account permissions before retrying.'
              : 'Verify the operator permissions and any required policy approvals before retrying.',
        ...(normalized.statusCode ? { statusCode: normalized.statusCode } : {}),
        ...(normalized.backendCode ? { backendCode: normalized.backendCode } : {}),
      },
    };
  }

  return {
    code: `${backend}_unknown_failure`,
    message: normalized.message,
    retryable: false,
    details: normalized.details,
    classification: {
      category: 'unknownFailure',
      remediation: 'retryFromFreshState',
      backend,
      operation: input.commandName,
      guidance:
        'Retry from a fresh application state. If the problem persists, export diagnostics and contact an administrator.',
      ...(normalized.statusCode ? { statusCode: normalized.statusCode } : {}),
      ...(normalized.backendCode ? { backendCode: normalized.backendCode } : {}),
    },
  };
}

function normalizeBackendOwner(backendOwner: BackendOwner): 'exchange' | 'graph' | 'app' {
  return backendOwner ?? 'app';
}

function resolveBackendOwner(
  backendOwner: BackendOwner,
  error: unknown,
): BackendOwner {
  if (typeof error === 'object' && error !== null && 'backendOwner' in error) {
    const candidate = (error as ErrorLike).backendOwner;
    if (candidate === 'exchange' || candidate === 'graph' || candidate === 'app') {
      return candidate;
    }
  }

  return backendOwner;
}

function normalizeError(error: unknown): NormalizedError {
  const fallbackMessage = error instanceof Error ? error.message : 'Unknown command failure.';

  if (typeof error !== 'object' || error === null) {
    return { message: fallbackMessage };
  }

  const typed = error as ErrorLike;
  const statusCandidate =
    typeof typed.statusCode === 'number'
      ? typed.statusCode
      : typeof typed.status === 'number'
        ? typed.status
        : undefined;
  const backendCode =
    typeof typed.backendCode === 'string'
      ? typed.backendCode
      : typeof typed.code === 'string' && !typed.code.startsWith('ERR_') && !typed.code.startsWith('E')
        ? typed.code
        : undefined;
  const details = typeof typed.details === 'string' ? typed.details : undefined;

  return {
    message: typeof typed.message === 'string' && typed.message.length > 0 ? typed.message : fallbackMessage,
    ...(statusCandidate ? { statusCode: statusCandidate } : {}),
    ...(backendCode ? { backendCode } : {}),
    ...(details ? { details } : {}),
  };
}

function isTenantMismatch(message: string): boolean {
  return TENANT_MISMATCH_PATTERNS.some((pattern) => pattern.test(message));
}

function isConnectionFailure(backendOwner: BackendOwner, error: NormalizedError): boolean {
  if (backendOwner === 'graph') {
    return (
      error.statusCode === 401 ||
      error.backendCode === 'graph_session_not_connected' ||
      error.backendCode === 'graph_token_unavailable' ||
      error.backendCode === 'graph_transport_failure' ||
      /graph session is not connected/i.test(error.message) ||
      /graph token acquisition failed/i.test(error.message) ||
      /network request failed/i.test(error.message) ||
      /fetch failed/i.test(error.message)
    );
  }

  if (backendOwner === 'exchange') {
    return EXCHANGE_CONNECTION_PATTERNS.some((pattern) => pattern.test(error.message));
  }

  return /bridge is not available/i.test(error.message);
}

function isAuthorizationFailure(backendOwner: BackendOwner, error: NormalizedError): boolean {
  if (backendOwner === 'graph') {
    return error.statusCode === 403;
  }

  if (backendOwner === 'exchange') {
    return EXCHANGE_AUTHORIZATION_PATTERNS.some((pattern) => pattern.test(error.message));
  }

  return /unauthorized/i.test(error.message) || /forbidden/i.test(error.message);
}
