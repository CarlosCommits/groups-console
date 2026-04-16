/**
 * Presenter helper for classified runtime command failures.
 *
 * The preload layer throws `CommandFailure` instances across the IPC bridge.
 * After serialization the object retains `name === "CommandFailure"` together
 * with `code`, `retryable`, `details`, and `classification`.  This helper
 * converts any thrown value into a structured UI model so screens can render
 * consistent, actionable error presentations without duplicating
 * classification-to-label logic.
 */

import { commandErrorSchema } from '@/shared/contracts/command';

export type FailureSeverity = "error" | "warning";

export interface ClassifiedFailurePresentation {
  title: string;
  body: string;
  guidance: string | null;
  severity: FailureSeverity;
  retryable: boolean;
}

const CATEGORY_TITLES: Record<string, string> = {
  connectionFailure: "Connection Failed",
  authorizationFailure: "Authorization Failed",
  tenantMismatch: "Tenant Mismatch",
  unknownFailure: "Unexpected Error",
};

const REMEDIATION_GUIDANCE: Record<string, string> = {
  reconnect: "Try reconnecting to the service.",
  verifyPermissions:
    "Verify that your account has the required permissions and try again.",
  reconnectMatchedTenant:
    "Reconnect with a tenant that matches your current session.",
  retryFromFreshState:
    "Retry from a fresh application state. If the problem persists, export diagnostics and contact an administrator.",
  contactAdministrator: "Contact your administrator for assistance.",
};

function tryParseCommandFailure(
  err: unknown,
): {
  code: string;
  message: string;
  retryable: boolean;
  details?: string;
  classification: {
    category: string;
    remediation: string;
    backend: string;
    operation: string;
    guidance: string;
    statusCode?: number;
    backendCode?: string;
  };
} | null {
  if (typeof err !== 'object' || err === null) {
    return null;
  }

  const parsed = commandErrorSchema.safeParse(err);
  if (parsed.success) {
    return parsed.data;
  }

  const looseParsed = tryParseLooseCommandFailure(err);
  if (looseParsed) {
    return looseParsed;
  }

  if (!(err instanceof Error)) {
    return null;
  }

  const fallbackParsed = commandErrorSchema.safeParse({
    code: (err as Error & { code?: string }).code,
    message: err.message,
    retryable: (err as Error & { retryable?: boolean }).retryable,
    details: (err as Error & { details?: string }).details,
    classification: (err as Error & { classification?: unknown }).classification,
  });

  return fallbackParsed.success ? fallbackParsed.data : null;
}

function tryParseLooseCommandFailure(
  err: unknown,
): {
  code: string;
  message: string;
  retryable: boolean;
  details?: string;
  classification: {
    category: string;
    remediation: string;
    backend: string;
    operation: string;
    guidance: string;
    statusCode?: number;
    backendCode?: string;
  };
} | null {
  if (typeof err !== 'object' || err === null) {
    return null;
  }

  const record = err as Record<string, unknown>;
  const classification =
    typeof record.classification === 'object' && record.classification !== null
      ? (record.classification as Record<string, unknown>)
      : null;

  if (
    typeof record.code !== 'string' ||
    typeof record.message !== 'string' ||
    typeof record.retryable !== 'boolean' ||
    classification === null ||
    typeof classification.category !== 'string' ||
    typeof classification.remediation !== 'string' ||
    typeof classification.backend !== 'string' ||
    typeof classification.operation !== 'string'
  ) {
    return null;
  }

  return {
    code: record.code,
    message: record.message,
    retryable: record.retryable,
    ...(typeof record.details === 'string' ? { details: record.details } : {}),
    classification: {
      category: classification.category,
      remediation: classification.remediation,
      backend: classification.backend,
      operation: classification.operation,
      guidance: typeof classification.guidance === 'string' ? classification.guidance : '',
      ...(typeof classification.statusCode === 'number'
        ? { statusCode: classification.statusCode }
        : {}),
      ...(typeof classification.backendCode === 'string'
        ? { backendCode: classification.backendCode }
        : {}),
    },
  };
}

export function presentCommandFailure(
  err: unknown,
  fallbackTitle: string,
  fallbackBody: string,
): ClassifiedFailurePresentation {
  const classifiedFailure = tryParseCommandFailure(err);

  if (classifiedFailure) {
    const category = classifiedFailure.classification.category;
    const title =
      CATEGORY_TITLES[category] ?? CATEGORY_TITLES.unknownFailure;
    const guidance =
      classifiedFailure.classification.guidance ||
      REMEDIATION_GUIDANCE[classifiedFailure.classification.remediation] ||
      null;
    const severity: FailureSeverity =
      category === "tenantMismatch" ? "warning" : "error";

    return {
      title,
      body: classifiedFailure.details ?? classifiedFailure.message,
      guidance,
      severity,
      retryable: classifiedFailure.retryable,
    };
  }

  if (err instanceof Error) {
    return {
      title: fallbackTitle,
      body: err.message,
      guidance: null,
      severity: "error",
      retryable: false,
    };
  }

  return {
    title: fallbackTitle,
    body: fallbackBody,
    guidance: null,
    severity: "error",
    retryable: false,
  };
}

export function formatPresentedCommandFailure(
  presentation: ClassifiedFailurePresentation,
): string {
  if (!presentation.guidance || presentation.guidance === presentation.body) {
    return presentation.body;
  }

  return `${presentation.body} ${presentation.guidance}`;
}
