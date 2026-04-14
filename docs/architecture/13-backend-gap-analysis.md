# 13. Backend Gap Analysis

## Purpose

List the backend logic and features that are still missing relative to the current architecture plans and the latest product direction.

This document is intentionally backend-only. It does not track missing UI work.

## Scope basis

This gap analysis is based on:

- `docs/architecture/02-scope-capability-matrix.md`
- `docs/architecture/12-backlog-and-commits.md`
- the current implemented command surface in `src/shared/contracts/command.ts`

## Already implemented backend foundations

The following backend slices are already in place:

- Electron main/preload security boundary and typed IPC envelopes
- Exchange bootstrap/runtime checks
- Exchange session lifecycle:
  - `exchange.getCapabilities`
  - `exchange.connect`
  - `exchange.getConnectionStatus`
  - `exchange.disconnect`
- Exchange group operations:
  - `exchange.listGroups`
  - `groups.getMembers`
  - `groups.addMembers`
  - `groups.removeMembers`
- Recipient search/resolution foundation:
  - `recipients.search`
  - internal `resolveRecipientForMembership`
- Graph foundation:
  - `graph.connect`
  - `graph.getConnectionStatus`
  - `graph.disconnect`
  - `guests.search`
  - `guests.invite`
  - `guests.updateCompany`
- Contact company workflows:
  - `contacts.create`
  - `contacts.updateCompany`

## Missing backend work in current planned scope

These items are still missing even after the currently implemented slices.

### 1. Report/export backend

**Status:** missing

Planned docs expect report/export support for:

- distribution lists
- mail-enabled security groups
- membership matrix export

Current reality:

- `reports.generateMembershipMatrix` does not exist in `src/shared/contracts/command.ts`
- `powershell/commands/export-report-data.ps1` is still a placeholder
- there is no JS export pipeline or report orchestration command yet

### 2. Guest/contact overlap-safe backend enforcement

**Status:** completed

The backend now enforces overlap-safe preflight for `contacts.create` and `guests.invite`, including typed conflict outcomes and an asymmetric coexistence rule that allows guest invite over an existing contact while still blocking contact creation over an existing guest.

Related plan references:

- `docs/architecture/02-scope-capability-matrix.md` — “Handle guest/contact overlap safely”
- `docs/architecture/07-validation-conflicts.md`

### 3. Guest-aware membership execution path

**Status:** completed

Guest membership is now resolved through a Graph-objectId → Exchange-`GuestMailUser` bridge before the Exchange add-members write executes.

Current reality:

- `src/main/recipients/resolve-recipient-for-membership.ts` resolves `graphGuest` selections into Exchange membership targets instead of returning `graphDeferred`
- `groups.addMembers` now accepts selected principal refs and resolves them in the main process before Exchange write execution
- the backend validates guest object IDs as GUIDs and rechecks Graph guest type before Exchange resolution

This closes the main backend guest-membership gap that previously blocked practical guest group-write support.

### 4. Contact/guest read-detail surfaces

**Status:** partially missing

Search exists, but dedicated detail/read commands for individual entities are still missing.

Examples not yet implemented:

- `contacts.getDetails`
- `guests.getDetails`

This is not strictly required for low-level command execution, but it is a real backend gap relative to a richer admin workflow surface.

### 5. Internal user / mailbox company sourcing per plan

**Status:** partially missing / implementation drift

The plan says internal user company data should come from Graph when displayed/exported. Current recipient search gets mailbox/mail user company from Exchange-side `Get-User` data inside `powershell/commands/search-recipients.ps1`.

That means:

- internal-user company display is available now
- but it is **not yet aligned with the planned Graph-owned source rule**

This is a backend consistency gap rather than a total capability gap.

### 6. Observability and diagnostics backend

**Status:** missing

Planned hardening items still not implemented:

- structured local logs
- audit events for mutations
- diagnostics bundle export
- secret/token redaction pipeline

Related plan references:

- `docs/architecture/08-observability.md`
- `docs/architecture/12-backlog-and-commits.md` Epic 7

### 7. Contact list/search dedicated route

**Status:** optional gap / partially covered

The capability matrix says mail contact list/search is supported. In practice this is partially covered by `recipients.search`, which can already return Exchange contacts.

What is missing is a dedicated contact-focused backend command surface such as:

- `contacts.search`

This is not an immediate blocker if `recipients.search` remains the intended shared picker/search API.

## Explicitly deferred or not currently targeted

These items are still not implemented, but they are either explicitly deferred in the plan or intentionally out of the current scope.

### Deferred by plan

- distribution list create/update/delete
- mail-enabled security group create/update/delete
- guest disable/delete and broader lifecycle management
- full contact editing beyond company
- centralized orchestration service
- unattended jobs and scheduled reporting

### Intentionally not prioritized right now

- spreadsheet-based contact company update workflow

This was in the earlier parity plan, but the current product direction explicitly deprioritized it in favor of:

- direct contact create with company
- direct contact company editing
- direct guest invite/create with company
- direct guest company editing

So it should not be treated as the next required backend item unless priorities change again.

## Recommended backend next steps

In recommended order:

1. **Guest/contact overlap-safe conflict service**
2. **Guest-aware membership resolution and execution path**
3. **Report/export backend**
4. **Structured logging and diagnostics export**

## Practical completion assessment

### Complete enough for current direct entity-management workflows

- Exchange contact create + company update
- Graph guest invite + company update
- Exchange membership reads/writes for DL/MESG

### Not complete enough for the full v2 backend plan

- guest/contact conflict-safe membership workflows
- reporting/export
- observability/diagnostics
- full plan-consistent data sourcing and detail surfaces
