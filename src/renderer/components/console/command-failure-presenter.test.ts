import { describe, expect, it } from "vitest";

import {
  formatPresentedCommandFailure,
  presentCommandFailure,
} from "./command-failure-presenter";

function makeCommandFailure(overrides: {
  message?: string;
  code?: string;
  retryable?: boolean;
  details?: string;
  classification?: {
    category: string;
    remediation: string;
    backend: string;
    operation: string;
    guidance: string;
    statusCode?: number;
    backendCode?: string;
  };
}): Error & {
  code: string;
  retryable: boolean;
  details?: string;
  classification: NonNullable<(typeof overrides)["classification"]>;
} {
  const err = new Error(overrides.message ?? "Command failed") as Error & {
    code: string;
    retryable: boolean;
    details?: string;
    classification: NonNullable<(typeof overrides)["classification"]>;
  };
  err.name = "CommandFailure";
  err.code = overrides.code ?? "app_unknown_failure";
  err.retryable = overrides.retryable ?? false;
  if (overrides.details !== undefined) {
    err.details = overrides.details;
  }
  err.classification = overrides.classification ?? {
    category: "unknownFailure",
    remediation: "retryFromFreshState",
    backend: "app",
    operation: "unknown",
    guidance:
      "Retry from a fresh application state. If the problem persists, export diagnostics and contact an administrator.",
  };
  return err;
}

describe("presentCommandFailure", () => {
  describe("classified CommandFailure inputs", () => {
    it("maps connectionFailure category to 'Connection Failed' title", () => {
      const err = makeCommandFailure({
        classification: {
          category: "connectionFailure",
          remediation: "reconnect",
          backend: "exchange",
          operation: "exchange.connect",
          guidance: "Reconnect to Exchange Online.",
        },
      });
      const result = presentCommandFailure(err, "Fallback", "Fallback body");
      expect(result.title).toBe("Connection Failed");
    });

    it("maps authorizationFailure category to 'Authorization Failed' title", () => {
      const err = makeCommandFailure({
        classification: {
          category: "authorizationFailure",
          remediation: "verifyPermissions",
          backend: "graph",
          operation: "guests.invite",
          guidance: "Verify Graph admin consent.",
        },
      });
      const result = presentCommandFailure(err, "Fallback", "Fallback body");
      expect(result.title).toBe("Authorization Failed");
    });

    it("maps tenantMismatch category to 'Tenant Mismatch' title and warning severity", () => {
      const err = makeCommandFailure({
        classification: {
          category: "tenantMismatch",
          remediation: "reconnectMatchedTenant",
          backend: "graph",
          operation: "graph.connect",
          guidance: "Reconnect with a matching tenant.",
        },
      });
      const result = presentCommandFailure(err, "Fallback", "Fallback body");
      expect(result.title).toBe("Tenant Mismatch");
      expect(result.severity).toBe("warning");
    });

    it("maps unknownFailure category to 'Unexpected Error' title", () => {
      const err = makeCommandFailure({
        classification: {
          category: "unknownFailure",
          remediation: "retryFromFreshState",
          backend: "app",
          operation: "unknown",
          guidance: "Retry from a fresh state.",
        },
      });
      const result = presentCommandFailure(err, "Fallback", "Fallback body");
      expect(result.title).toBe("Unexpected Error");
    });

    it("uses classification guidance when present", () => {
      const err = makeCommandFailure({
        classification: {
          category: "connectionFailure",
          remediation: "reconnect",
          backend: "exchange",
          operation: "exchange.connect",
          guidance: "Check your network and reconnect.",
        },
      });
      const result = presentCommandFailure(err, "Fallback", "Fallback body");
      expect(result.guidance).toBe("Check your network and reconnect.");
    });

    it("falls back to remediation-based guidance when classification guidance is empty", () => {
      const err = makeCommandFailure({
        classification: {
          category: "connectionFailure",
          remediation: "reconnect",
          backend: "exchange",
          operation: "exchange.connect",
          guidance: "",
        },
      });
      const result = presentCommandFailure(err, "Fallback", "Fallback body");
      expect(result.guidance).toBe("Try reconnecting to the service.");
    });

    it("uses details over message for body when details is present", () => {
      const err = makeCommandFailure({
        message: "Short message",
        details: "Detailed explanation of the failure",
        classification: {
          category: "unknownFailure",
          remediation: "retryFromFreshState",
          backend: "app",
          operation: "unknown",
          guidance: "Retry.",
        },
      });
      const result = presentCommandFailure(err, "Fallback", "Fallback body");
      expect(result.body).toBe("Detailed explanation of the failure");
    });

    it("uses message for body when details is absent", () => {
      const err = makeCommandFailure({
        message: "Short message",
        classification: {
          category: "unknownFailure",
          remediation: "retryFromFreshState",
          backend: "app",
          operation: "unknown",
          guidance: "Retry.",
        },
      });
      const result = presentCommandFailure(err, "Fallback", "Fallback body");
      expect(result.body).toBe("Short message");
    });

    it("preserves retryable from the classified failure", () => {
      const err = makeCommandFailure({
        retryable: true,
        classification: {
          category: "connectionFailure",
          remediation: "reconnect",
          backend: "exchange",
          operation: "exchange.connect",
          guidance: "Retry.",
        },
      });
      const result = presentCommandFailure(err, "Fallback", "Fallback body");
      expect(result.retryable).toBe(true);
    });

    it("returns error severity for non-tenantMismatch categories", () => {
      const categories = [
        "connectionFailure",
        "authorizationFailure",
        "unknownFailure",
      ] as const;
      for (const category of categories) {
        const err = makeCommandFailure({
          classification: {
            category,
            remediation: "retryFromFreshState",
            backend: "app",
            operation: "test",
            guidance: "Retry.",
          },
        });
        const result = presentCommandFailure(err, "Fallback", "Fallback body");
        expect(result.severity).toBe("error");
      }
    });

    it("handles unrecognized category by falling back to 'Unexpected Error' title", () => {
      const err = makeCommandFailure({
        classification: {
          category: "newCategoryNotYetKnown",
          remediation: "contactAdministrator",
          backend: "app",
          operation: "test",
          guidance: "Contact support.",
        },
      });
      const result = presentCommandFailure(err, "Fallback", "Fallback body");
      expect(result.title).toBe("Unexpected Error");
    });

    it("handles unrecognized remediation by returning null guidance when classification guidance is empty", () => {
      const err = makeCommandFailure({
        classification: {
          category: "unknownFailure",
          remediation: "newRemediationNotYetKnown",
          backend: "app",
          operation: "test",
          guidance: "",
        },
      });
      const result = presentCommandFailure(err, "Fallback", "Fallback body");
      expect(result.guidance).toBeNull();
    });
  });

  describe("plain Error inputs", () => {
    it("uses fallbackTitle and error.message", () => {
      const err = new Error("Something went wrong");
      const result = presentCommandFailure(err, "Custom Title", "Fallback body");
      expect(result.title).toBe("Custom Title");
      expect(result.body).toBe("Something went wrong");
      expect(result.guidance).toBeNull();
      expect(result.severity).toBe("error");
      expect(result.retryable).toBe(false);
    });
  });

  describe("non-Error inputs", () => {
    it("uses fallbackTitle and fallbackBody for string throws", () => {
      const result = presentCommandFailure("oops", "Custom Title", "Fallback body");
      expect(result.title).toBe("Custom Title");
      expect(result.body).toBe("Fallback body");
      expect(result.guidance).toBeNull();
      expect(result.severity).toBe("error");
      expect(result.retryable).toBe(false);
    });

    it("uses fallbackTitle and fallbackBody for null throws", () => {
      const result = presentCommandFailure(null, "Custom Title", "Fallback body");
      expect(result.title).toBe("Custom Title");
      expect(result.body).toBe("Fallback body");
    });

    it("uses fallbackTitle and fallbackBody for undefined throws", () => {
      const result = presentCommandFailure(undefined, "Custom Title", "Fallback body");
      expect(result.title).toBe("Custom Title");
      expect(result.body).toBe("Fallback body");
    });
  });

  describe("edge cases", () => {
    it("does not treat a plain Error with name 'CommandFailure' but no classification as classified", () => {
      const err = new Error("Fake") as Error & { name: "CommandFailure" };
      err.name = "CommandFailure";
      const result = presentCommandFailure(err, "Fallback", "Fallback body");
      expect(result.title).toBe("Fallback");
      expect(result.body).toBe("Fake");
    });

    it("does not treat an Error with classification but wrong name as classified", () => {
      const err = new Error("Wrong name") as Error & {
        classification: { category: string };
      };
      (err as unknown as Record<string, unknown>).classification = {
        category: "connectionFailure",
      };
      const result = presentCommandFailure(err, "Fallback", "Fallback body");
      expect(result.title).toBe("Fallback");
    });

    it("does not treat an Error with name 'CommandFailure' but null classification as classified", () => {
      const err = new Error("Null cls") as Error & {
        name: string;
        classification: unknown;
      };
      err.name = "CommandFailure";
      err.classification = null;
      const result = presentCommandFailure(err, "Fallback", "Fallback body");
      expect(result.title).toBe("Fallback");
    });

    it("parses plain objects that match the shared command error shape", () => {
      const result = presentCommandFailure(
        {
          code: "graph_authorization_failure",
          message: "Graph denied the operation.",
          retryable: false,
          details: "Authorization_RequestDenied",
          classification: {
            category: "authorizationFailure",
            remediation: "verifyPermissions",
            backend: "graph",
            operation: "guests.invite",
            guidance: "Verify Graph consent before retrying.",
          },
        },
        "Fallback",
        "Fallback body",
      );

      expect(result.title).toBe("Authorization Failed");
      expect(result.body).toBe("Authorization_RequestDenied");
    });
  });
});

describe("formatPresentedCommandFailure", () => {
  it("appends guidance when it is distinct from the body", () => {
    expect(
      formatPresentedCommandFailure({
        title: "Connection Failed",
        body: "Exchange session host is not running.",
        guidance: "Reconnect Exchange Online, then retry the operation.",
        severity: "error",
        retryable: true,
      }),
    ).toBe(
      "Exchange session host is not running. Reconnect Exchange Online, then retry the operation.",
    );
  });

  it("returns the body unchanged when guidance is empty or duplicated", () => {
    expect(
      formatPresentedCommandFailure({
        title: "Unexpected Error",
        body: "Retry from a fresh state.",
        guidance: "Retry from a fresh state.",
        severity: "error",
        retryable: false,
      }),
    ).toBe("Retry from a fresh state.");
  });
});
