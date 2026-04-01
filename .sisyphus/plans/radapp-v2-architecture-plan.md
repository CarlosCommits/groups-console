# RAD-app v2 Architecture Plan

## Purpose

Define the target architecture and rollout plan for RAD-app v2: a Windows-first Electron desktop application for Exchange Online admins, with a PowerShell execution layer for Exchange Online operations and a Graph integration path for guest-user features.

## Non-negotiable constraints

- Windows-first, x64, single-tenant, Exchange-admin-only desktop application.
- Initial release uses delegated interactive admin authentication only.
- The app must not capture or store administrator passwords.
- Exchange Online PowerShell remains the authoritative write path for:
  - distribution lists
  - mail-enabled security groups
  - Exchange mail contacts
- Microsoft Graph is used only for supported guest-user and directory operations.
- Mail-enabled security groups and distribution lists are not to be modeled as Graph-write targets.
- The renderer never executes PowerShell directly.
- The app must not require permanent machine-wide execution policy changes.
- The app should prefer process-scoped execution policy handling when launching its PowerShell worker.

## Recommended document set

- `docs/architecture/01-current-state.md`
- `docs/architecture/02-scope-capability-matrix.md`
- `docs/architecture/03-target-architecture.md`
- `docs/architecture/04-security-model.md`
- `docs/architecture/05-exchange-graph-integration.md`
- `docs/architecture/06-ipc-contract.md`
- `docs/architecture/07-validation-conflicts.md`
- `docs/architecture/08-observability.md`
- `docs/architecture/09-packaging-deployment.md`
- `docs/architecture/10-rollout-plan.md`
- `docs/architecture/11-test-strategy.md`
- `docs/architecture/12-backlog-and-commits.md`

## Architecture summary

- Renderer: Electron UI only, built with React and shadcn/ui.
- Preload: minimal, typed, schema-validated bridge.
- Main process: orchestration, security boundary, job lifecycle, local logging, file dialogs, Graph integration, and export generation.
- PowerShell worker: Exchange Online session handling and Exchange-specific commands.
- Graph adapter: guest-user and selected directory reads/writes, normalized into app DTOs.
- Excel/report generation: JavaScript side in v2 to remove `ImportExcel` dependency.

## Key design decisions

1. Use a thin Electron shell instead of a browser/server rewrite.
2. Split privileged operations into:
   - Exchange worker (PowerShell)
   - Graph adapter (Node/TypeScript)
3. Normalize all backend responses into app-owned DTOs before they cross IPC.
4. Canonical identity is never SMTP alone; use stable object identifiers plus source system and recipient type.
5. Version one ships with signed installer, no in-app auto-update requirement, and enterprise deployment friendliness.
6. Bulk membership UX centers on one selected subject and many selected groups, with per-group result reporting.
7. Company name is sourced by object type, not treated as a universal field.

## Highest-risk areas to address in the docs

- Tenant and account mismatch between Graph and Exchange sessions.
- Guest-user and contact overlap for the same external email address.
- Partial success behavior when one backend succeeds and the other fails.
- Long-running Exchange operations and progress/cancellation UX.
- Packaging assumptions around PowerShell, Exchange module bootstrap, and code signing.

## Runtime choice

- Default runtime for v1 backend execution: Windows PowerShell 5.1.
- Rationale: already present on target admin machines, matches current app assumptions, avoids making PowerShell 7 a hard prerequisite.
- Optional future enhancement: detect and support PowerShell 7 where validated, but do not make architecture depend on it for the first release.
- Exchange worker launches should use process-scoped execution policy handling where required rather than persisting `Set-ExecutionPolicy` changes.

## Test environment choice

- Preferred validation target: dedicated non-production tenant that reflects the real Exchange and Entra topology.
- Developer sandbox tenant is useful for early smoke testing if available, but it is not the primary sign-off environment for Exchange-admin behavior.

## Acceptance criteria for the planning package

- Every supported entity and operation has a documented owner: UI, Graph, or Exchange worker.
- The package includes secure IPC, auth/session behavior, validation/conflict rules, logging, packaging, rollout, and test strategy.
- The package is specific enough that implementation can begin without re-deciding major architectural questions.
