# 08. Observability, Local System Logs, and Diagnostics

## Purpose

Define what the app logs, what the admin can export, and how support/debugging works without creating a server platform.

## Observability goals

- explain what happened
- explain why something failed
- support local troubleshooting and pilot rollout
- avoid leaking credentials or sensitive tokens

## Logging model

### Local structured logs

The main process writes structured logs in JSON lines or similarly machine-readable form. Renderer logs should be funneled through a controlled bridge rather than writing independently.

### Minimum log fields

- timestamp
- level
- correlation ID
- operation name
- backend owner (`exchange` or `graph`)
- tenant ID
- result (`started`, `succeeded`, `failed`, `partial`)
- safe error code

## Local mutation event log

Every mutation should emit a higher-level local system-log event with:

- actor UPN if available
- tenant ID
- operation type
- target object type
- target object ID
- summary of requested change
- result

## Redaction rules

- never log access tokens
- never log raw auth responses
- redact sensitive headers and secrets
- limit PII in default logs to what is operationally necessary

## Diagnostics bundle

The app should support “export diagnostics” with:

- recent structured logs
- app version and environment info
- module/runtime checks
- anonymized or redacted last-error context
- optionally recent job summaries

## Support posture for v1

No centralized telemetry is required for first release. Local logs plus exportable diagnostics are sufficient.

## Retention guidance

- rotate local log files
- cap total retained size
- preserve enough recent history for pilot support and rollback analysis

## Success metrics for pilot

- connection success rate
- command failure rate by operation
- conflict-detection frequency
- average report generation time
- average add-member completion time

## Acceptance criteria

- A failed mutation can be traced using correlation ID.
- Logs are useful without leaking secrets.
- The app can export a diagnostics bundle without manual file hunting.
