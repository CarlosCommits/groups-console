/**
 * Presenter helper for partial source degradation on recipient search results.
 *
 * Converts `sourceStatus` + optional `sourceFailures` into user-facing warning
 * copy. Follows the same presenter pattern as `command-failure-presenter.ts`.
 */

import type { RecipientsSearchResult } from "@/shared/contracts/recipients";

export interface SourceDegradationNote {
  label: string;
  message: string;
  guidance: string | null;
  degradedSources: Array<"exchange" | "graph">;
}

const SOURCE_LABELS: Record<string, string> = {
  exchange: "Exchange",
  graph: "Graph",
};

const CATEGORY_LABELS: Record<string, string> = {
  connectionFailure: "connection failed",
  authorizationFailure: "authorization failed",
  validationFailure: "validation failed",
  conflictFailure: "conflict detected",
  throttlingFailure: "throttled",
  tenantMismatch: "tenant mismatch",
  unknownFailure: "unavailable",
};

const REMEDIATION_GUIDANCE: Record<string, string> = {
  reconnect: "Try reconnecting to the service.",
  verifyPermissions:
    "Verify that your account has the required permissions and try again.",
  correctInput: "Review the submitted values and try again.",
  resolveConflict: "Resolve the conflicting directory state and try again.",
  retryAfterDelay: "Wait briefly, then try again.",
  reconnectMatchedTenant:
    "Reconnect with a tenant that matches your current session.",
  retryFromFreshState:
    "Retry from a fresh application state. If the problem persists, contact an administrator.",
  contactAdministrator: "Contact your administrator for assistance.",
};

function isDegradedStatus(status: string): boolean {
  return status === "unavailable" || status === "deferred";
}

/**
 * Converts `sourceStatus` and optional `sourceFailures` into a structured
 * degradation note.  Returns `null` when no sources are degraded.
 *
 * When `sourceFailures` provides classification data for a degraded source,
 * the message includes the specific failure category (authorization failed,
 * connection failed, tenant mismatch) instead of the generic status label.
 */
export function presentSourceDegradation(
  sourceStatus: RecipientsSearchResult["sourceStatus"],
  sourceFailures?: RecipientsSearchResult["sourceFailures"],
): SourceDegradationNote | null {
  const degradedSources: Array<"exchange" | "graph"> = [];
  const parts: string[] = [];
  const guidances: string[] = [];

  for (const source of ["exchange", "graph"] as const) {
    const status = sourceStatus[source];
    if (!isDegradedStatus(status)) continue;

    degradedSources.push(source);
    const sourceLabel = SOURCE_LABELS[source] ?? source;
    const failure = sourceFailures?.[source];

    if (failure) {
      const categoryLabel =
        CATEGORY_LABELS[failure.classification.category] ?? "unavailable";
      parts.push(`${sourceLabel} ${categoryLabel}`);
      const guidance =
        failure.classification.guidance ||
        REMEDIATION_GUIDANCE[failure.classification.remediation];
      if (guidance) guidances.push(guidance);
    } else {
      if (status === "unavailable") {
        parts.push(`${sourceLabel} unavailable`);
      } else if (status === "deferred") {
        parts.push(`${sourceLabel} deferred`);
      } else {
        parts.push(`${sourceLabel} ${status}`);
      }
    }
  }

  if (degradedSources.length === 0) return null;

  const message = parts.join("; ");
  const guidance = guidances.length > 0 ? guidances.join(" ") : null;

  return {
    label: "Partial results",
    message,
    guidance,
    degradedSources,
  };
}

/** Formats a SourceDegradationNote into a single string, appending guidance when present. */
export function formatSourceDegradationNote(note: SourceDegradationNote): string {
  if (!note.guidance || note.guidance === note.message) {
    return note.message;
  }
  return `${note.message} ${note.guidance}`;
}
