# 12. Implementation Backlog and Atomic Commit Plan

## Purpose

Turn the architecture package into a practical execution order.

## Epic order

### Epic 1 — project scaffolding

- Electron + TypeScript app shell
- lint/format/test setup
- secure preload and IPC skeleton

### Epic 2 — shared contracts and DTOs

- command envelopes
- error model
- recipient/group DTOs
- validation schemas

### Epic 3 — Exchange worker foundation

- worker bootstrap
- connect/disconnect
- read-only group/recipient commands
- structured JSON output

### Epic 4 — Graph foundation

- delegated interactive sign-in
- tenant pinning
- guest search
- guest invite command

### Epic 5 — core admin workflows

- distribution-list explorer
- report generation
- add/remove member flows
- create contact
- update contact company

### Epic 6 — expansion workflows

- mail-enabled security group explorer
- shared membership editor for DL + MESG
- unified directory workspace with guest-aware recipient picker

### Epic 7 — hardening

- structured logs
- diagnostics export
- packaging/signing
- pilot fixes

## Suggested atomic commit sequence

1. `chore: scaffold electron and typescript desktop shell`
2. `chore: add shared command contracts and validation schemas`
3. `feat: add secure preload bridge and main-process IPC routing`
4. `feat: add exchange worker bootstrap and session commands`
5. `feat: add exchange read models for groups and recipients`
6. `feat: add graph auth and guest search foundation`
7. `feat: add distribution list explorer and report generation`
8. `feat: add contact create and company update workflows`
9. `feat: add shared membership editor for distribution lists`
10. `feat: add mail-enabled security group support`
11. `feat: add guest invite flow and overlap-aware validation`
12. `chore: add logging, diagnostics, packaging, and pilot readiness`

## Definition of done for each workflow

- UI path exists
- contract tests exist
- backend owner is explicit
- validation and conflict cases handled
- logs and audit events emitted
- manual QA notes recorded for pilot

## Epic-level verification map

### Epic 1 — project scaffolding

- Tool: Vitest + Electron smoke launch
- Verification:
  1. app boots in development mode
  2. preload API is available
  3. renderer has no direct Node access
- Expected result: secure shell starts and renderer can only use typed bridge methods

### Epic 2 — shared contracts and DTOs

- Tool: Vitest contract fixtures
- Verification:
  1. validate accepted request payloads
  2. reject malformed payloads
  3. snapshot normalized DTO shapes
- Expected result: contract layer is deterministic and versionable

### Epic 3 — Exchange worker foundation

- Tool: Pester + main-process integration tests
- Verification:
  1. connect/disconnect commands emit structured results
  2. unknown command is rejected
  3. worker failure maps to app error envelope
- Expected result: Exchange worker is safe, named-command-only, and parseable

### Epic 4 — Graph foundation

- Tool: Vitest with mocked Graph client + Electron integration smoke
- Verification:
  1. delegated sign-in state can be established
  2. tenant pinning blocks mismatched tenant
  3. guest search returns normalized DTOs
- Expected result: Graph path is usable without leaking raw provider shapes into renderer

### Epic 5 — core admin workflows

- Tool: Playwright for Electron + targeted integration fixtures
- Verification:
  1. report export flow succeeds
  2. contact create flow succeeds for unique address
  3. company bulk update returns accurate summary counts
- Expected result: v1 parity workflows are demonstrably working in v2 shell

### Epic 6 — expansion workflows

- Tool: Playwright for Electron + Exchange/Graph integration fixtures
- Verification:
  1. member add/remove works for DL and MESG
  2. guest invite works
  3. overlap conflict is blocked with actionable message
- Expected result: v2 expansion scope is working and conflict-safe

### Epic 7 — hardening

- Tool: Playwright + filesystem assertions + packaging smoke checks
- Verification:
  1. diagnostics bundle exports correctly
  2. logs redact secrets
  3. packaged build launches on clean test workstation
- Expected result: pilot build is supportable and deployable

## First implementation milestone recommendation

Aim first for a thin but real slice:

1. shell boots
2. connect status visible
3. search distribution lists
4. open group details
5. generate report export

That slice validates the architecture before the first write-capable workflows are added.

## Final verification wave before pilot

- Run QA-01 through QA-08 from `11-test-strategy.md`
- Confirm all critical workflows pass on a managed Windows admin workstation
- Capture diagnostics bundle from at least one forced failure scenario
- Verify signed installer installation and clean launch behavior

## Deferred backlog

- full contact editing beyond company
- create/update/delete groups
- guest lifecycle beyond invite and selected updates
- centralized orchestration service
- unattended jobs and scheduled reporting
- spreadsheet-based company update workflow

## Acceptance criteria

- Work can begin in dependency order without re-opening the main architecture choices.
- The backlog starts with validating the shell and privileged boundaries before high-risk writes.
