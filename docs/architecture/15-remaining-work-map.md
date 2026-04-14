# 15. Remaining Work Map

## Purpose

Catalog what is still missing relative to the original architecture and rollout plans, after accounting for the frontend surfaces and backend slices that are already wired. This document is cross-cutting: it covers backend gaps, frontend gaps, and integration gaps that span both layers.

It does not restate the long-term deferred backlog from `12-backlog-and-commits.md` as immediate work. Items listed here are either in the current v2 scope but not yet implemented, or are consistency gaps that should be resolved before pilot.

## Scope basis

This map is based on:

- `docs/architecture/02-scope-capability-matrix.md`
- `docs/architecture/05-exchange-graph-integration.md`
- `docs/architecture/07-validation-conflicts.md`
- `docs/architecture/08-observability.md`
- `docs/architecture/12-backlog-and-commits.md`
- `docs/architecture/13-backend-gap-analysis.md`
- `docs/architecture/14-permission-matrix.md`
- the current implemented command surface in `src/shared/contracts/command.ts`

## Already implemented or wired

These items are in place and are not the focus of this document. They are listed here so it is clear they are not current blockers.

**Backend slices:**

- Electron main/preload security boundary and typed IPC envelopes
- Exchange bootstrap, runtime checks, and session lifecycle (`exchange.getCapabilities`, `exchange.connect`, `exchange.getConnectionStatus`, `exchange.disconnect`)
- Exchange group operations (`exchange.listGroups`, `groups.getMembers`, `groups.addMembers`, `groups.removeMembers`)
- Recipient search/resolution foundation (`recipients.search`, internal `resolveRecipientForMembership`)
- Graph foundation (`graph.connect`, `graph.getConnectionStatus`, `graph.disconnect`, `guests.search`, `guests.invite`, `guests.updateCompany`)
- Contact company workflows (`contacts.create`, `contacts.updateCompany`)
- Overlap-safe recipient preflight for contact create and guest invite, including typed conflict outcomes and Exchange/Graph ownership checks

**Frontend surfaces:**

- Shell and connection UX
- Groups workspace with member reads and writes
- Directory workspace with search, contact create/update, and guest invite/update
- Directory conflict rendering for blocked contact/guest overlap outcomes
- Dashboard with truthful connection status
- Reports screen in deferred-state presentation

## Remaining work categories

### 1. Report and export backend

**Status:** missing

The capability matrix marks export report support as in-scope for distribution lists and mail-enabled security groups. The IPC contract defines `reports.generateMembershipMatrix`. Neither the command implementation nor the report-side PowerShell command exists yet.

Current reality:

- `reports.generateMembershipMatrix` is listed in the command catalog in `06-ipc-contract.md` but is not present in the implemented `commandNameSchema` in `src/shared/contracts/command.ts`
- `powershell/commands/export-report-data.ps1` is a one-line placeholder
- there is no JS export pipeline or report orchestration command
- the Reports screen in the renderer shows a deferred state rather than a functional export flow

What is needed:

- add `reports.generateMembershipMatrix` to the implemented command surface
- implement the Exchange-side data collection for group and membership reads
- implement the JS-side XLSX generation pipeline
- wire the renderer Reports screen to the live command
- add progress streaming for long report generation

### 2. Guest membership execution path

**Status:** completed

Guest candidates can now be selected in the Groups workflow and resolved into Exchange-visible `GuestMailUser` membership targets before the final Exchange write.

Current reality:

- `src/main/recipients/resolve-recipient-for-membership.ts` now resolves selected Graph guests by Graph object ID and Exchange `GuestMailUser` identity instead of returning `graphDeferred`
- `groups.addMembers` accepts selected principal refs and resolves Graph guests to Exchange member refs in the main process before the Exchange write executes
- the backend bridge validates guest object IDs as GUIDs, re-reads the Graph guest by ID, and resolves the matching Exchange `GuestMailUser`
- the Groups UI now allows `graphBridgeable` guest selections while preserving selected-principal identity instead of collapsing everything to SMTP overlap
- Exchange member reads now surface `guestMailUser` explicitly, including fallback external email display when `PrimarySmtpAddress` is blank

Follow-up that still remains outside this completed slice:

- report/export still needs to cover guest-backed membership reads once the report backend is built
- richer guest/detail read flows are still missing separate detail commands

### 3. Guest/contact overlap-safe validation and remediation

**Status:** completed

The overlap-safe validation and conflict handling plan in `07-validation-conflicts.md` is now enforced for `contacts.create` and `guests.invite`. The application now fails closed with typed conflict outcomes instead of making unsafe cross-system assumptions.

Current reality:

- `contacts.create` and `guests.invite` both run cross-system preflight before mutation
- a dedicated backend conflict service now detects and explains overlap across Exchange and Graph for the same external email
- typed `blockedConflict` outcomes are returned for blocked create/invite paths, including `emailAlreadyOwned`, `guestContactOverlap`, `tenantMismatch`, and `preflightUnavailable` cases
- Exchange recipient ownership checks now cover direct recipient matches, mail contacts, and broader proxy-address overlap lookup before proceeding
- the Directory workflow renders conflict details with record type/source context and blocks unsafe assumptions when overlap is detected
- the coexistence rule is now asymmetric by design: guest invite is allowed over an existing contact, while contact creation remains blocked when a guest already exists

Follow-up that still remains outside this completed slice:

- the broader failure/remediation taxonomy in `14-permission-matrix.md` still needs to be extended as later workflows land

### 4. Richer contact and guest detail reads

**Status:** partially missing

Search exists for both contacts and guests, but dedicated detail/read commands for individual entities are not implemented.

Current reality:

- `contacts.getDetails` does not exist in the command surface
- `guests.getDetails` does not exist in the command surface
- the capability matrix explicitly lists "Get details" as supported for Guest User; contact detail reads are still a richer workflow gap even though they are not called out as explicitly in the matrix
- the renderer currently relies on search result data for display, which may not include all fields needed for detail views

What is needed:

- implement `contacts.getDetails` to fetch full contact properties from Exchange
- implement `guests.getDetails` to fetch full guest profile properties from Graph
- add these commands to the `commandNameSchema`
- wire detail views in the renderer to these commands

This is not a blocker for basic workflows, but it is a real gap relative to the guest-user capability matrix entry and to richer admin workflows where operators need to inspect full entity details before acting.

### 5. Observability, audit, and diagnostics

**Status:** missing

The observability plan in `08-observability.md` and the hardening epic in `12-backlog-and-commits.md` call for structured logs, audit events, and a diagnostics export. None of these are implemented yet.

Current reality:

- there are no structured local logs in the main process
- there are no audit events for mutations
- there is no diagnostics bundle export capability
- there is no secret or token redaction pipeline
- the permission matrix in `14-permission-matrix.md` references logging authorization failures with correlation IDs, but the logging infrastructure to support that does not exist yet

What is needed:

- implement structured JSON-lines logging in the main process with the minimum fields defined in `08-observability.md` (timestamp, level, correlation ID, operation name, backend owner, tenant ID, result, safe error code)
- emit audit events for every mutation with actor, tenant, operation type, target, and result
- implement a diagnostics bundle export that includes recent logs, app version, environment info, module/runtime checks, and anonymized last-error context
- add secret and token redaction to the logging pipeline
- funnel renderer logs through a controlled bridge rather than allowing independent renderer log writes

### 6. Deeper permission and remediation classification

**Status:** partially missing

The permission matrix in `14-permission-matrix.md` documents the current implemented surface and its prerequisites. Several workflows that will need permission classification are not yet implemented, and the deferred areas listed in that document need to be addressed as each workflow is built.

Current reality:

- the permission matrix covers Exchange and Graph session prerequisites and the current command surface
- it explicitly lists deferred areas: report backend permissions, guest membership execution permissions, overlap-safe enforcement permissions, detail read permissions, and scope/role introspection
- the denial behavior and failure classification framework is defined but not yet wired into the running application
- there is no runtime error classification that maps backend errors to the failure categories defined in `14-permission-matrix.md` (connection failure, authorization failure, preflight conflict, partial success, tenant mismatch)

What is needed:

- as each remaining workflow is implemented, add its permission and prerequisite requirements to the matrix
- implement runtime error classification that maps backend errors to the defined failure categories
- wire the renderer to surface authorization failures distinctly from connection failures, with actionable remediation guidance
- do not attempt to pre-check Entra roles, Exchange RBAC, or token scope consent, as documented in `14-permission-matrix.md`

## Secondary consistency gaps

These are lower-priority items that do not block core workflows but represent drift from the planned architecture.

### Internal user company source alignment

The plan in `02-scope-capability-matrix.md` says internal user company data should come from Graph `user.companyName`. The current implementation sources it from Exchange `Get-User` data inside `powershell/commands/search-recipients.ps1`. The data is available, but it is not yet aligned with the planned Graph-owned source rule. This is a consistency gap, not a capability gap.

### Dedicated contact search route

The capability matrix says mail contact list/search is supported. In practice this is partially covered by `recipients.search`, which can already return Exchange contacts. A dedicated `contacts.search` command is not implemented. This is not an immediate blocker if `recipients.search` remains the intended shared picker/search API, but it should be tracked if a contact-focused search surface becomes a product requirement.

## Recommended execution order

The remaining work items are interdependent. This order accounts for dependencies and risk.

1. **Report and export backend** — now the highest-impact missing slice; completes the v1 parity feature set
2. **Observability, audit, and diagnostics** — should be built alongside or immediately after reports so pilot workflows produce traceable logs and exportable diagnostics from the start
3. **Richer contact and guest detail reads** — can be built in parallel with the report backend; not a blocker for core workflows but needed for full capability matrix coverage
4. **Deeper permission and remediation classification** — grows incrementally as each remaining workflow is implemented; the error classification framework should be wired early and extended as new workflows land

Completed since the previous revision:

- **Guest membership execution path** — shipped as Graph-objectId → Exchange `GuestMailUser` resolution with selected-principal preservation in group add flows
- **Guest/contact overlap-safe conflict service** — shipped as typed cross-system preflight and renderer conflict remediation for `contacts.create` and `guests.invite`

## Acceptance criteria

- Every item listed as "missing" in this document has either been implemented or has a tracked follow-up with clear scope.
- The guest membership path resolves guest candidates to Exchange membership targets instead of returning `graphDeferred`. **Completed.**
- Contact creation and guest invitation both run cross-system overlap checks before proceeding. **Completed.**
- The Reports screen is wired to a live export backend, not a deferred placeholder.
- Structured logs are written for every mutation, and a diagnostics bundle can be exported without manual file hunting.
- The permission matrix is updated as each new workflow is implemented.
- No deferred backlog item from `12-backlog-and-commits.md` is treated as an immediate blocker unless it appears in the remaining work categories above.
- Internal user company sourcing is documented as a known consistency gap until it is aligned with the planned Graph source rule.
