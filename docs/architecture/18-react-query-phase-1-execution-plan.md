# 18. React Query Phase 1 Execution Plan

## Purpose

Turn Phase 1 from `docs/architecture/16-react-query-roadmap.md` into an implementation-ready execution plan.

Phase 1 is the first real query migration. The goal is to replace the three duplicated `exchange.listGroups()` renderer flows with one shared, connection-aware TanStack Query groups inventory domain while preserving existing screen behavior and keeping group-members, mutations, and report generation out of scope.

## Scope basis

This execution plan is based on:

- `docs/architecture/16-react-query-roadmap.md`
- `docs/architecture/17-react-query-phase-0-execution-plan.md`
- `src/renderer/main.tsx`
- `src/renderer/lib/query-client.ts`
- `src/renderer/lib/query-keys.ts`
- `src/renderer/components/console/app-context.tsx`
- `src/renderer/components/console/screens/dashboard-screen.tsx`
- `src/renderer/components/console/screens/groups-screen.tsx`
- `src/renderer/components/console/screens/reports-screen.tsx`

## Phase 1 scope

Phase 1 covers only the shared groups inventory read path.

Included in this phase:

- define one canonical shared groups inventory query domain for `window.groupsConsole.exchange.listGroups()`
- migrate Dashboard to use the shared groups inventory query
- migrate Reports to use the shared groups inventory query
- migrate Groups to use the shared groups inventory query for the groups list only
- preserve screen-local UI state while moving duplicated remote-read state into TanStack Query
- define verification that proves cache reuse, background refresh, and connection-safe cache behavior for the shared groups inventory domain

## Non-goals

Phase 1 does not include any work outside the shared groups inventory read.

Explicit non-goals:

- no `groups.getMembers()` migration yet
- no add-member or remove-member mutation migration
- no mutation invalidation work beyond using the Phase 0 connection-boundary cache lifecycle
- no report-generation flow changes
- no Directory or System Logs migration
- no AppContext ownership changes beyond continuing to rely on the Phase 0 cache-boundary scaffold
- no redesign of Group members UX, refresh icon UX, or background-refresh animation beyond what naturally falls out of the shared groups inventory query behavior

## Current repo baseline

Current reality that this phase must respect:

- Phase 0 scaffolding is already in place:
  - `src/renderer/main.tsx` provides one shared `QueryClientProvider`
  - `src/renderer/lib/query-client.ts` owns the QueryClient and its default policy
  - `src/renderer/lib/query-keys.ts` owns the shared key taxonomy
  - `src/renderer/components/console/app-context.tsx` already purges app query cache when the authoritative Graph/Exchange connection boundary changes
- Dashboard currently owns a local `groups`, `groupsLoading`, `groupsError`, and `hasLoadedGroups` state machine around `window.groupsConsole.exchange.listGroups()`.
- Reports currently owns a second local `groups`, `groupsLoading`, `groupsError`, and `hasLoadedGroups` state machine around the same `window.groupsConsole.exchange.listGroups()` call.
- Groups currently owns a third local `groups`, `groupsLoading`, and `groupsError` state machine around the same `window.groupsConsole.exchange.listGroups()` call.
- Groups also owns `selectedGroup`, `groupFilter`, and the entire members/add/remove flow locally; only the groups-list read belongs to Phase 1.
- Dashboard and Reports derive counts from the local groups array after independently loading the same remote data.

This means Phase 1 should remove duplicated groups inventory loading without absorbing local UI state that still belongs inside each screen.

## Decisions to lock before implementation

These decisions must be made clearly before the first Phase 1 code change starts.

### 1. Shared groups query ownership

Lock the canonical groups inventory query behind one shared renderer-facing API.

Recommended implementation surface:

- `src/renderer/hooks/use-exchange-groups.ts`

Recommended exports:

- `getExchangeGroupsQueryOptions`
- `useExchangeGroupsQuery`

Recommended hook return shape:

- `groups: ExchangeGroupListItem[]`
- `appliedKind: "all" | "distributionList" | "mailEnabledSecurityGroup" | null`
- `isLoading: boolean`
- `isFetching: boolean`
- `error: string | null`
- `errorPresentation: ClassifiedFailurePresentation | null`
- `refetch: () => Promise<unknown>`

Required outcome:

- screens consume the same shared hook instead of each screen re-implementing `loadGroups`
- the hook owns the TanStack Query integration details for this domain
- screens keep control of their own local UI state and derivations

### 2. Canonical query-key shape for groups inventory

Lock the groups inventory key under the existing Phase 0 taxonomy.

This plan must define:

- the exact key helper additions for Exchange groups inventory
- the exact connection scope used for Exchange-backed reads
- whether optional filters such as group kind belong in the query key now or stay out of scope for Phase 1

Recommended additions to `src/renderer/lib/query-keys.ts`:

- `exchangeGroupsRoot(connectionIdentity)`
- `exchangeGroupsList(connectionIdentity)`

Recommended key shapes:

- `queryKeys.exchangeGroupsRoot(connectionIdentity)` → `['console', 'exchange', normalizedConnectionScope, 'groups']`
- `queryKeys.exchangeGroupsList(connectionIdentity)` → `['console', 'exchange', normalizedConnectionScope, 'groups', 'list']`

Phase 1 should not add:

- group-detail keys
- group-members keys
- mutation-scoped keys

Required outcome:

- Dashboard, Reports, and Groups all subscribe to the same canonical groups inventory cache when the connection boundary is the same
- the key does not depend on the current screen name

### 3. Error presentation rule

Lock how query failures are presented so TanStack Query does not introduce a second error language.

This plan must define:

- whether the shared query hook returns raw query errors, formatted presentation strings, or both
- how existing `presentCommandFailure` / `formatPresentedCommandFailure` behavior is preserved where needed

Recommended rule:

- the shared hook returns both `error` and `errorPresentation`
- `errorPresentation` should use the existing `ClassifiedFailurePresentation` model from `src/renderer/components/console/command-failure-presenter.ts`
- `error` should be the already-formatted string produced from that presentation so screens can render existing alert/error copy without remapping failures inline

Required outcome:

- error copy remains consistent with the current renderer experience
- screens do not each invent a different query error-mapping pattern

### 4. Loading, stale-data, and background-refresh behavior

Lock the screen-level loading rules before migration.

This plan must define:

- first-load behavior when there is no cached groups data
- revisit behavior when cached groups data already exists
- when to show full loading states versus background-refresh states
- how screen refresh buttons map to query refetch instead of local `loadGroups`

Recommended rules:

- the shared hook uses `enabled: exchangeConnected`
- it inherits the Phase 0 defaults already defined in `src/renderer/lib/query-client.ts`
- `isLoading` means the first fetch for the current connection boundary with no cached groups data
- `isFetching` means any in-flight refresh after cache already exists
- when `groups.length > 0`, screens should continue rendering cached groups while `isFetching` is true
- routine background refresh must not blank the groups list once valid cache exists

Required outcome:

- previously loaded groups can remain visible while the query refreshes in the background
- no screen should blank the groups list during a routine background refresh once valid cache exists

### 5. Local UI state boundary for Groups screen

Lock which pieces of Groups state stay local during Phase 1.

This plan must preserve local ownership of:

- `selectedGroup`
- `groupFilter`
- members list state and loading
- add/remove dialog state
- member filters and member sort state

Required outcome:

- Phase 1 changes only the groups inventory source, not the overall Groups workflow ownership model

## Screen state mapping

Phase 1 should move only duplicated groups inventory server state into the shared query domain.

### Dashboard

Move to shared query:

- `groups`
- groups inventory loading state
- groups inventory error state
- manual groups refetch path

Keep local to the screen:

- derived counts
- recent-groups derivation
- dashboard card copy and presentation-only derivations
- shell refresh action and shell-driven readiness state

### Reports

Move to shared query:

- `groups`
- groups inventory loading state
- groups inventory error state
- manual groups refetch path

Keep local to the screen:

- selected report kind
- generation progress and result state
- generation error state
- coverage summary derivations
- report-generation command flow

### Groups

Move to shared query:

- `groups`
- groups inventory loading state
- groups inventory error state
- manual groups refetch path if one is introduced in this phase

Keep local to the screen:

- `selectedGroup`
- `groupFilter`
- `members`, `membersLoading`, `membersError`
- member filter and sort state
- add/remove dialog state
- add/remove mutation result and pending state

## Work breakdown

### Work item 1 — define the shared groups inventory query domain

Goal:

- create the canonical shared groups inventory query that wraps `window.groupsConsole.exchange.listGroups()` using the Phase 0 QueryClient and key taxonomy

Expected implementation touchpoints:

- `src/renderer/hooks/use-exchange-groups.ts`
- `src/renderer/hooks/use-exchange-groups.test.ts`
- `src/renderer/lib/query-keys.ts`

This work item should also define:

- the exact connection identity input for the shared key helper
- the query function boundary around `window.groupsConsole.exchange.listGroups()`
- the shared error-mapping path using `presentCommandFailure` and `formatPresentedCommandFailure`

Deliverable:

- one shared query hook that all Phase 1 screens can consume

### Work item 2 — migrate Dashboard to the shared groups inventory query

Goal:

- replace Dashboard’s local `loadGroups` state machine with the shared groups inventory query

Expected implementation touchpoints:

- `src/renderer/components/console/screens/dashboard-screen.tsx`

Dashboard must preserve:

- inventory counts
- recent-groups derivation
- shell refresh behavior
- manual refresh behavior

Dashboard migration should explicitly remove:

- local `groups` state
- local `groupsLoading` state
- local `groupsError` state
- local `hasLoadedGroups` state
- the local `loadGroups` callback

Deliverable:

- Dashboard uses the shared cache instead of its own independent groups loader

### Work item 3 — migrate Reports to the shared groups inventory query

Goal:

- replace Reports’ local `loadGroups` state machine with the shared groups inventory query while leaving report generation logic unchanged

Expected implementation touchpoints:

- `src/renderer/components/console/screens/reports-screen.tsx`

Reports must preserve:

- inventory counts
- current selected report kind behavior
- generation progress and result state
- current report-generation command flow

Reports migration should explicitly remove:

- local `groups` state
- local `groupsLoading` state
- local `groupsError` state
- local `hasLoadedGroups` state
- the local `loadGroups` callback

Deliverable:

- Reports reads shared inventory from the canonical groups query and no longer duplicates `listGroups()` loading

### Work item 4 — migrate Groups to the shared groups inventory query

Goal:

- replace Groups’ local groups-list loader with the shared groups inventory query while keeping members and mutation flows out of scope

Expected implementation touchpoints:

- `src/renderer/components/console/screens/groups-screen.tsx`

Groups must preserve:

- selected-group reconciliation by `exchangeIdentity`
- group filtering behavior
- member loading behavior remaining local and imperative
- add/remove workflow state remaining local

Groups migration should explicitly remove:

- local `groups` state
- local `groupsLoading` state
- local `groupsError` state
- the local `loadGroups` callback

Deliverable:

- Groups uses the shared cache for the groups list only

### Work item 5 — align refresh and background-refetch behavior

Goal:

- ensure screen refresh actions and revisit behavior use the shared query correctly

Expected implementation touchpoints:

- `src/renderer/components/console/screens/dashboard-screen.tsx`
- `src/renderer/components/console/screens/reports-screen.tsx`
- `src/renderer/components/console/screens/groups-screen.tsx`

This work item must define:

- what refresh buttons call
- what “loading” means when cached groups data already exists
- how background refetch is surfaced without introducing new UX regressions

Recommended refresh semantics:

1. existing refresh buttons should continue calling `refreshShellState()` for shell status
2. after shell refresh completes, if the Exchange connection boundary is unchanged, the screen should call the shared groups query `refetch()`
3. if the Exchange connection boundary changed, the new query key should drive the fetch automatically and no extra imperative `refetch()` should be required
4. Phase 1 should not add a brand-new Groups refresh control unless that work is explicitly pulled into scope later

Deliverable:

- Phase 1 screens all use one consistent groups inventory refresh model

### Work item 6 — add verification coverage for the shared groups inventory migration

Goal:

- prove the migration is sharing cache correctly without crossing into Phase 2

This work item must cover:

- query-key behavior for shared groups inventory
- shared-cache reuse expectations
- screen-level behavior preservation for Dashboard, Reports, and Groups
- connection-boundary purge safety for groups inventory

Recommended test files:

- `src/renderer/lib/query-keys.test.ts`
- `src/renderer/hooks/use-exchange-groups.test.ts`
- `src/renderer/components/console/screens/dashboard-screen.test.ts` if introduced
- `src/renderer/components/console/screens/reports-screen.test.ts` if introduced
- `src/renderer/components/console/screens/groups-screen.test.ts` if introduced

Recommended TDD order:

1. add or extend query-key tests for `exchangeGroupsRoot` and `exchangeGroupsList`
2. add shared hook tests for enabled/disabled behavior, successful fetch, formatted error output, and connection-boundary cache isolation
3. add screen migration tests for Dashboard and Reports
4. add screen migration tests for the Groups inventory list only

Deliverable:

- a checkable Phase 1 sign-off list

## Verification gates

Phase 1 is complete only when all of the following are true.

### Shared-cache gates

- Dashboard, Reports, and Groups all consume the same canonical groups inventory query domain
- the duplicated local `exchange.listGroups()` loaders are removed from those three screens
- the groups inventory query key is scoped by the active Exchange connection boundary rather than the current screen

### Behavior-preservation gates

- Dashboard still shows the same inventory counts and recent-groups derivation
- Reports still shows the same inventory counts and keeps report generation behavior unchanged
- Groups still preserves selected-group reconciliation and group filtering behavior
- no members/add/remove behavior changes are introduced in this phase

### Cache and refresh gates

- revisiting a screen with valid cached groups data does not require a full blank-state reload
- background refresh does not clear the visible groups list when valid cached data already exists
- refresh actions use query refetch instead of reimplementing local `loadGroups`
- connection-boundary cache purge prevents stale groups inventory from surviving Exchange/Graph boundary changes

### Verification-command gates

- `npm run typecheck` passes
- `npm test` passes
- the app still launches in development mode subject to the same environment limitations already seen in this repo

## Baseline regression checklist

Before Phase 1 is signed off, compare post-migration behavior against the current baseline for:

- Dashboard initial inventory load
- Dashboard refresh action
- Dashboard recent-groups display
- Reports inventory summary display
- Reports error handling for inventory load
- Groups initial list load
- Groups group filtering and selected-group reconciliation
- navigation away from Groups and back again with cached data present
- Exchange disconnect/reconnect behavior for groups inventory cache

The expected outcome is improved cache reuse without any new behavior regressions outside the Phase 1 scope.

## Atomic commit strategy

The implementation should stay small, reviewable, and Phase-1-only.

Recommended commit sequence for Phase 1 code work:

1. `test: add coverage for shared groups inventory query behavior`
2. `feat: add shared exchange groups inventory query`
3. `refactor: migrate dashboard and reports to shared groups inventory query`
4. `refactor: migrate groups screen to shared groups inventory query`
5. `test: verify groups inventory cache reuse across screens`

If the work is small enough, commits 1 and 2 may be combined. The key rule is to keep every commit inside Phase 1 scope.

## Acceptance criteria

- The Phase 1 plan stays within the shared groups inventory scope defined by `docs/architecture/16-react-query-roadmap.md`.
- The plan treats Phase 0 scaffolding as already completed baseline infrastructure.
- The plan references the real duplicated `exchange.listGroups()` sites in Dashboard, Reports, and Groups.
- The plan defines one canonical shared groups inventory query domain.
- The plan keeps group-members work, mutations, Directory, and report-generation internals out of scope.
- The plan defines loading, stale-data, and refresh behavior concretely enough for implementation.
- The plan defines verification gates strong enough to prove cache reuse and connection-safe behavior before Phase 2 begins.
