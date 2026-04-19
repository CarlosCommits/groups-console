# 16. React Query Roadmap

## Purpose

Define a phased, repo-specific plan for introducing TanStack Query into the Electron renderer without destabilizing the current shell/auth model, IPC contract, or progress-heavy workflows.

This document is a rollout roadmap, not an implementation diff. It describes what should move into TanStack Query, what should stay imperative, and the order that minimizes risk for the current codebase.

## Scope basis

This roadmap is based on:

- `docs/architecture/06-ipc-contract.md`
- `docs/architecture/10-rollout-plan.md`
- `docs/architecture/15-remaining-work-map.md`
- `src/renderer/app/app.tsx`
- `src/renderer/components/console/app-context.tsx`
- `src/renderer/components/console/screens/dashboard-screen.tsx`
- `src/renderer/components/console/screens/groups-screen.tsx`
- `src/renderer/components/console/screens/reports-screen.tsx`
- `src/renderer/components/console/screens/directory-screen.tsx`
- `src/renderer/components/console/system-logs-panel.tsx`
- `src/preload/index.ts`

## Current renderer data-loading state

The renderer currently uses manual `useState` + `useEffect` + `useCallback` flows for most read operations.

Current reality:

- `AppContext` owns shell/session/navigation state and performs renderer bootstrap reads through `refreshShellState()`.
- `exchange.listGroups()` is loaded separately in Dashboard, Groups, and Reports.
- `groups.getMembers()` is loaded inside `GroupsScreen` and is keyed off the selected group.
- `recipients.search()` is used in both the Directory workflow and the Groups add-members workflow with screen-local debounce and transient state.
- `systemLogs.listEvents()` is handled through manual cursor state in `system-logs-panel.tsx`.
- report generation uses progress callbacks and request-state tracking rather than plain request/response rendering.

This means the app currently has duplicated loading logic, no shared renderer-side cache for read data, and no standard invalidation model after writes.

## Why TanStack Query fits this repo

TanStack Query is a good fit for the renderer because the preload layer already exposes promise-returning methods on `window.radApp`. The app does not need HTTP-specific APIs to benefit from query caching, background refresh, and invalidation.

For this repo specifically, the strongest immediate fit is shared Exchange read data:

- group inventory is duplicated across three screens
- group member reads are dependent on the selected group and map naturally to keyed queries
- detail dialogs and system-log pagination are read-heavy and currently reimplement request lifecycle handling in component state

The goal is not to replace all state management. The goal is to separate shared server-state-like reads from local UI state.

## Ownership model

The rollout should preserve a clear split of responsibilities.

### AppContext keeps ownership of

- current screen and navigation
- shell/auth/connection state
- connection actions (`exchange.connect`, `exchange.disconnect`, `graph.connect`, `graph.disconnect`)
- top-level pending-action UX
- exchange UPN form state and related shell error handling

### TanStack Query should own

- shared read caches backed by `window.radApp`
- background refresh for read queries
- cache invalidation after successful writes
- read deduplication across screens

### Local component state should keep ownership of

- selected tabs
- filters and search text
- dialog open/closed state
- transient form input
- selected rows/items
- progress indicators for long-running write/export workflows
- request-local UI state that is not useful to share across screens

This boundary is important. `AppContext` should not become a data cache, and TanStack Query should not absorb purely local UI state.

## Foundation decisions

These decisions should be made before the first query migration.

### 1. Provider placement

Add a single `QueryClientProvider` at the renderer root above `AppProvider`.

This keeps query policy centralized and allows AppContext-owned actions to invalidate or clear query domains when connection state changes.

### 2. Renderer-only query layer

Keep query functions in the renderer and back them with the existing `window.radApp` preload bridge.

Do not change the IPC contract boundary to accommodate TanStack Query. The contract in `src/shared/contracts` and the preload bridge in `src/preload/index.ts` remain the source of truth.

### 3. Electron-safe defaults

Do not rely on browser-default query behavior without review.

The initial QueryClient policy should be conservative because this app uses IPC-backed reads, not browser fetches:

- use a non-zero `staleTime` for read-heavy screens so navigation does not immediately trigger another fetch
- keep a meaningful `gcTime` so recent screen data survives navigation away/back
- review `refetchOnWindowFocus` and `refetchOnReconnect` explicitly before enabling them
- use query defaults that are appropriate for Electron and local IPC, not generic browser tab behavior

### 4. Query-key rules

Query keys must be tied to connection identity, not just screen params.

At minimum, Exchange-backed query domains should account for current connection identity so stale tenant/session data is not reused after connect/disconnect or tenant changes. This matters more than naming style.

## Proposed rollout phases

### Phase 0 — baseline and scaffolding

Goal: introduce TanStack Query without changing feature behavior.

Work in this phase:

- add TanStack Query packages to the renderer
- add `QueryClientProvider` at the renderer root
- define initial QueryClient defaults for Electron
- define shared query-key helpers and naming rules
- document cache-clearing rules for Exchange/Graph connect and disconnect flows
- add development-time query devtools only if they fit the existing developer workflow

Exit criteria:

- the app boots with the provider in place
- no feature behavior changes yet
- query key and invalidation rules are documented before any screen migration

### Phase 1 — shared groups inventory

Goal: migrate the highest-value duplicated read first.

Primary targets:

- `src/renderer/components/console/screens/dashboard-screen.tsx`
- `src/renderer/components/console/screens/groups-screen.tsx`
- `src/renderer/components/console/screens/reports-screen.tsx`

Why this phase comes first:

- `exchange.listGroups()` is duplicated across three screens
- the data is read-only and broadly shared
- it directly addresses the current Groups page reload problem
- it proves cache reuse and background refresh without forcing mutation design too early

Expected outcome:

- one canonical groups query domain replaces three separate loading implementations
- cached group data survives screen navigation
- background refresh becomes possible without clearing the visible list first

Implementation guidance:

- migrate reads before mutations
- keep group filters and selected-group UI state local to screens
- derive dashboard counts and reports pickers from the shared cached groups data rather than reloading per screen

### Phase 2 — group members and Groups-screen refresh UX

Goal: complete the most visible TanStack Query win in the Groups workflow.

Primary targets:

- `src/renderer/components/console/screens/groups-screen.tsx`

Work in this phase:

- move `groups.getMembers()` into a query keyed by selected group identity
- keep selected group, filters, add/remove dialog state, and tab state local
- invalidate the relevant group-members query after add/remove member mutations
- introduce stale-while-refresh UI for the groups list and members list where appropriate

This is the phase that should unlock the intended UX improvement:

- previously loaded groups remain visible on return to the screen
- background refetch updates the cache after the screen becomes active again
- refresh indicators can reflect `isFetching` instead of forcing a full loading blank state

### Phase 3 — directory read paths

Goal: move shared and dialog-driven reads into queries while preserving imperative write flows.

Primary targets:

- `src/renderer/components/console/screens/directory-screen.tsx`

Candidate reads for migration:

- `recipients.search()`
- `contacts.getDetails()`
- `guests.getDetails()`
- `exchange.getRecipientDetails()`

Important constraints:

- search debounce still belongs to renderer UI logic
- dialog open/close state stays local
- create/update/invite actions remain imperative at first
- existing request-id and stale-response protections should not be dropped until query-driven replacements are verified

This phase should produce reusable query conventions for detail dialogs and search-backed screens.

### Phase 4 — system logs pagination

Goal: migrate a read path that benefits from built-in pagination patterns.

Primary targets:

- `src/renderer/components/console/system-logs-panel.tsx`

Why it belongs after the simpler read migrations:

- it is paginated, not a simple one-shot read
- the current implementation manages cursor state manually
- a successful migration here validates how the app should handle paginated/preloaded read domains

If this phase is done with TanStack Query pagination helpers, it should reduce manual request bookkeeping while preserving current UX.

### Phase 5 — selective mutation adoption and invalidation hardening

Goal: standardize mutation invalidation only after shared read conventions are stable.

Candidate mutations for later review:

- `groups.addMembers()`
- `groups.removeMembers()`
- `contacts.create()`
- `contacts.updateCompany()`
- `guests.invite()`
- `guests.updateCompany()`

This phase should not start until:

- query-key rules are stable
- invalidation targets are well understood
- the app has already proven the read-cache model on Groups and Directory surfaces

The first mutation work should focus on invalidation correctness, not optimistic UI.

## What should not move first

The roadmap should be explicit about non-goals for the first rollout.

Do not migrate these first:

- shell bootstrap and auth orchestration in `AppContext`
- connect/disconnect workflows for Exchange and Graph
- report generation with progress callbacks in `reports-screen.tsx`
- diagnostics export in `settings-screen.tsx`
- purely local UI state such as filters, tabs, selected rows, and form inputs

Reasoning:

- auth/shell state is already the renderer's connection gate and should stay single-owned during rollout
- report generation is progress-heavy and not a strong first fit for query-style caching
- local UI state is not shared read data and gains little from TanStack Query

## Invalidation and cache lifecycle rules

This is the most important safety section in the roadmap.

### Required invalidation triggers

- Exchange connect
- Exchange disconnect
- Graph connect
- Graph disconnect
- tenant mismatch or session reset flows
- successful member-write operations that affect current group membership
- successful create/update/invite operations that change Directory-visible results

### Cache-clearing rule

When the authoritative connection context changes, affected query domains must be invalidated or cleared immediately.

The roadmap should treat this as a release gate, not a polish item. Without it, the renderer can show stale cross-session or cross-tenant data.

## Error handling approach

Current screens use the command-failure presentation pipeline already present in the renderer.

The migration should preserve that behavior. TanStack Query should not introduce a second user-facing error language. The preferred direction is:

- keep existing presentation rules for command failures
- standardize query wrappers or query hooks so they map preload errors into the same renderer-facing presentation model
- avoid having each screen reinvent its own query error formatting after migration

## Testing and verification plan

The rollout should include verification at each phase.

### Baseline checks before migration

- record current behavior for Groups, Dashboard, Reports, Directory, and System Logs
- note current loading, retry, and empty-state behavior
- note current connection/disconnection effects on visible data

### Per-phase verification

- typecheck passes
- relevant renderer tests pass
- no duplicate fetch regression is introduced on simple screen revisits
- connect/disconnect transitions do not leak stale read data
- mutation-triggered invalidation refreshes the correct visible surfaces

### UX checks for the Groups migration

- leaving Groups and returning should show previously cached data immediately when valid cache exists
- background refresh should not blank the entire workspace
- manual refresh controls should map to query refetch rather than screen reinitialization

## Risks and sequencing traps

### Dual ownership risk

If AppContext and TanStack Query both own the same fetched dataset, loading and error states will drift and maintenance cost will go up.

### Cross-tenant stale cache risk

If query keys or cache-clearing rules ignore connection identity, the app can display stale data after a session change.

### Over-migrating too early

If Directory mutations, auth flows, and report progress handling are migrated before the shared read model is stable, complexity will rise faster than value.

### Electron default-behavior risk

Refetch-on-focus and retry defaults must be reviewed intentionally. Browser-oriented defaults can produce unexpected IPC or backend churn in a desktop app.

## Recommended execution order

1. add provider and query policy scaffolding
2. define query-key and invalidation rules
3. migrate shared groups inventory across Dashboard, Groups, and Reports
4. migrate group members and complete the Groups refresh UX
5. migrate Directory read paths and detail dialogs
6. migrate System Logs pagination
7. adopt mutation invalidation patterns selectively
8. re-evaluate whether any shell bootstrap reads belong in query land after the rest is stable

## Acceptance criteria

- The roadmap keeps `AppContext` as the owner of shell/auth/navigation state for the first rollout.
- The roadmap identifies `exchange.listGroups()` as the first shared query migration target.
- The roadmap explicitly defers progress-heavy and auth-heavy workflows from the first TanStack Query phase.
- The roadmap requires query-key and invalidation rules before broad screen migration.
- The roadmap treats connection-context cache clearing as a mandatory safety rule.
- The roadmap covers both read migration order and verification requirements.
