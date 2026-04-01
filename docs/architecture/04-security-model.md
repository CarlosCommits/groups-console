# 04. Security Model

## Purpose

Define the trust boundaries and security requirements for RAD-app v2.

## Non-negotiable controls

- `contextIsolation: true`
- `sandbox: true`
- `nodeIntegration: false`
- no renderer access to raw IPC or child-process APIs
- no arbitrary PowerShell execution from UI-originated input
- no embedded credential collection forms
- no machine-wide execution policy changes
- signed desktop build required before production rollout

## Trust boundaries

### Renderer

Untrusted presentation layer. It may contain bugs and must be assumed compromise-prone compared with main process.

### Preload

Narrow bridge only. It translates validated UI intent into typed IPC calls.

### Main process

Privileged orchestrator. It validates IPC sender, validates payloads again, selects backend owner, records audit events, and decides which named backend command can run.

### Exchange worker

Runs only allowlisted scripts/functions packaged with the app. It must not accept free-form PowerShell expressions from the UI or from arbitrary app state.

## Authentication model for v1

- delegated interactive auth only
- no password storage
- Graph sign-in uses system-browser-based auth flow
- Exchange Online uses native modern-auth flow launched by the worker
- app must validate tenant identity after both sessions connect

## Authorization requirements

The docs and implementation must include a permission matrix covering:

- Exchange admin role(s) required for supported EXO operations
- Graph delegated scopes required for guest workflows
- explicit denial behavior when auth succeeds but permissions are insufficient

## Tenant enforcement

The app is single-tenant. Before any mutation:

1. verify the signed-in Graph tenant matches configured tenant
2. verify the Exchange connection is for the same tenant
3. block writes on mismatch

## Local secret and token handling

- avoid long-lived local secret storage in v1
- if token cache is used, store with OS-protected mechanisms only
- never write raw tokens to logs
- diagnostics bundles must scrub auth artifacts automatically

## Command safety rules

- use app-owned command identifiers, not user-provided cmdlet names
- validate all string inputs before backend invocation
- prefer structured stdin/stdout JSON envelopes over string interpolation
- allowlist backend command set at both main-process and PowerShell layers

## Logging and privacy

- structured logs only
- redact tokens, cookies, auth codes, and secret-bearing headers
- minimize PII in default logs
- support explicit diagnostic export under admin control

## Packaging security

- code signing required
- installer hash/version should be verifiable by IT
- bundle only app-owned PowerShell scripts and modules needed for v1
- pin tested module versions where supportability depends on them

## Acceptance criteria

- The renderer cannot directly cause arbitrary PowerShell execution.
- Tenant mismatch blocks writes.
- The app can operate under MFA/Conditional Access without credential capture.
