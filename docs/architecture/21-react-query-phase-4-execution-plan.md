# 21. React Query Phase 4 Execution Plan

## Purpose

Turn Phase 4 from `docs/architecture/16-react-query-roadmap.md` into an implementation-ready execution plan.

Phase 4 converts the current cursor-based `window.groupsConsole.systemLogs.listEvents()` read path in `src/renderer/components/console/system-logs-panel.tsx` into a TanStack Query pagination flow while preserving the current panel UX and staying out of mutation, filter, or settings redesign work.

## Scope basis

This execution plan is based on:

- `docs/architecture/16-react-query-roadmap.md`
- `docs/architecture/18-react-query-phase-1-execution-plan.md`
- `docs/architecture/19-react-query-phase-2-execution-plan.md`
- `docs/architecture/20-react-query-phase-3-execution-plan.md`
- `src/renderer/components/console/system-logs-panel.tsx`
- `src/renderer/components/console/screens/settings-screen.tsx`
- `src/renderer/lib/query-client.ts`
- `src/renderer/lib/query-keys.ts`
- `src/shared/contracts/system-logs.ts`
- `src/preload/index.ts`

## Phase 4 scope

Phase 4 covers only the System Logs panel’s paginated read path.

Included in this phase:

- define one shared paginated query domain for `window.groupsConsole.systemLogs.listEvents()`
- migrate the current cursor bookkeeping into TanStack Query pagination
- preserve current loading, error, empty, refresh, and load-more behavior
- add tests for query keys, query hook behavior, and System Logs panel behavior

## Non-goals

Phase 4 does not include any work outside the System Logs panel read path.

Explicit non-goals:

- no mutation work
- no filter/query/result/operationType UI additions
- no Settings screen redesign
- no diagnostics changes
- no IPC/preload/contract redesign unless implementation proves one is necessary
- no broader observability or telemetry work

## Current repo baseline

Current reality that this phase must respect:

- `SystemLogsPanel` currently owns `events`, `loading`, `error`, `nextCursor`, `loadingMore`, and `requestIdRef`
- initial load clears rows and fetches page 1 with `pageSize: 25`
- `Load more` appends rows using the current `nextCursor`
- `Refresh` resets the panel to page 1 rather than refetching all previously loaded pages
- any error currently flips the panel into the full error branch
- current visible usage is `SettingsScreen` with `{ kind: "all" }`, but the component API also accepts `targetObject` scope and Phase 4 must preserve that scope isolation

This means Phase 4 should move pagination state into TanStack Query without broadening the panel into filters or a more complex browsing UX.

## Decisions to lock before implementation

### 1. Shared system logs query ownership

Lock the paginated system logs read behind one shared renderer-facing hook.

Recommended implementation surface:

- `src/renderer/hooks/use-system-logs.ts`

Recommended exports:

- `getSystemLogsQueryOptions`
- `getSystemLogScopeKey`
- `useSystemLogsQuery`

### 2. Canonical query-key shape for system logs

Add system logs query keys under the existing query key taxonomy.

Recommended additions to `src/renderer/lib/query-keys.ts`:

- `systemLogsRoot()`
- `systemLogsList(scopeKey)`

Recommended scope identity rule:

- all-scope key: `all`
- target-object scope key: stable string derived from `targetObjectId` and optional `targetObjectTypes`

### 3. Pagination model

Use `useInfiniteQuery`, not plain `useQuery`, because the current behavior is cursor-based and explicitly appends pages.

Recommended hook return shape:

- `events`
- `hasNextPage`
- `isLoading`
- `isFetching`
- `isFetchingNextPage`
- `error`
- `errorPresentation`
- `loadMore`
- `refresh`

### 4. Refresh semantics

Preserve the current UX rule:

- `Refresh` resets the panel to page 1 only
- it must not refetch every previously loaded page

### 5. Loading and error rules

Preserve current visible UX:

- initial load shows the existing loading branch
- next-page fetch shows the existing `Load more` spinner state
- panel-level error branch remains the visible error path

### 6. Page-size rule

Keep `pageSize: 25` fixed in this phase.

## System Logs panel state mapping

Move to shared query ownership:

- event page data
- first-page loading state
- next-page loading state
- error state
- refresh path
- load-more path

Keep local to the component:

- timestamp formatting
- table rendering
- empty-state copy
- button labels and panel layout

## Work breakdown

### Work item 1 — define query-key additions for system logs

Goal:

- extend the query key taxonomy for system logs scope-aware pagination

Expected implementation touchpoints:

- `src/renderer/lib/query-keys.ts`
- `src/renderer/lib/query-keys.test.ts`

### Work item 2 — add system logs pagination hook and tests

Goal:

- create the shared paginated system logs query domain using `useInfiniteQuery`

Expected implementation touchpoints:

- `src/renderer/hooks/use-system-logs.ts`
- `src/renderer/hooks/use-system-logs.test.ts`

### Work item 3 — migrate System Logs panel to shared pagination query

Goal:

- replace local cursor/request bookkeeping with the shared system logs query hook while preserving current visible branches

Expected implementation touchpoints:

- `src/renderer/components/console/system-logs-panel.tsx`

### Work item 4 — add panel regression coverage

Goal:

- prove the panel preserves current loading, empty, error, refresh, and load-more behavior after the migration

Expected implementation touchpoints:

- `src/renderer/components/console/system-logs-panel.test.ts`

## Verification gates

Phase 4 is complete only when all of the following are true.

### Query-domain gates

- system logs queries are keyed by scope identity
- the hook uses cursor-based pagination rather than manual state bookkeeping
- different scopes do not share cached pages incorrectly

### Behavior-preservation gates

- initial loading branch remains intact
- empty-state copy remains intact
- panel-level error branch remains intact
- refresh still resets to page 1 only
- load more still appends rows and keeps previous rows visible

### Pagination gates

- first page uses `pageSize: 25`
- next page uses the previous `nextCursor`
- pages flatten into one event list in display order

### Verification-command gates

- `npm run typecheck` passes
- `npm test` passes

## Baseline regression checklist

- open Settings and confirm initial system logs load
- confirm empty state or rows render correctly
- click `Load more` and confirm rows append
- click `Refresh` after loading more and confirm the panel returns to first-page behavior
- force a failing load and confirm retry still works
- confirm different scopes do not reuse stale pages incorrectly

## Atomic commit strategy

1. `docs: add react query phase 4 execution plan`
2. `test: add system logs query key and pagination coverage`
3. `feat: add shared system logs pagination query`
4. `refactor: migrate system logs panel to shared pagination query`
5. `test: verify system logs panel refresh and load-more behavior`

## Acceptance criteria

- The Phase 4 plan follows the established execution-plan structure used in Phases 1–3.
- The plan stays strictly within system logs pagination scope from the roadmap.
- The plan preserves current panel UX, especially refresh-to-first-page behavior.
- The plan names the real repo touchpoints for implementation and tests.
- The plan includes concrete pagination and verification gates.
