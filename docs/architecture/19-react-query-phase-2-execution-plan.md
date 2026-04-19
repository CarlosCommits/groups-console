# 19. React Query Phase 2 Execution Plan

## Purpose

Turn Phase 2 from `docs/architecture/16-react-query-roadmap.md` into an implementation-ready execution plan.

Phase 2 extends the Groups workflow from shared group inventory into shared group-members reads. The goal is to replace the imperative `groups.getMembers()` flow in `GroupsScreen` with a TanStack Query domain keyed by Exchange connection identity and selected group identity, while preserving local UI state and adding scoped invalidation after successful add/remove member mutations.

## Scope basis

This execution plan is based on:

- `docs/architecture/16-react-query-roadmap.md`
- `docs/architecture/18-react-query-phase-1-execution-plan.md`
- `src/renderer/hooks/use-exchange-groups.ts`
- `src/renderer/lib/query-client.ts`
- `src/renderer/lib/query-keys.ts`
- `src/renderer/components/console/screens/groups-screen.tsx`
- `src/preload/index.ts`
- `src/shared/contracts/exchange.ts`

## Phase 2 scope

Phase 2 covers only the shared group-members read path inside the Groups workflow.

Included in this phase:

- define one canonical shared query domain for `window.radApp.groups.getMembers()`
- key the members query by Exchange connection identity and selected group identity
- migrate the members list in `GroupsScreen` from imperative `useEffect` loading to the shared query
- preserve stale members data during background refreshes where cached data already exists
- invalidate the affected group-members query after successful add/remove member mutations

## Non-goals

Phase 2 does not include any work outside the shared members read path.

Explicit non-goals:

- no query migration for owners or settings tabs
- no migration of recipient search debounce/results into TanStack Query
- no Dashboard, Reports, Directory, or System Logs changes
- no AppContext ownership changes
- no optimistic update system for add/remove member mutations
- no redesign of the add/remove dialogs beyond the minimal UI state changes required by the new members query

## Current repo baseline

Current reality that this phase must respect:

- Phase 1 already moved group inventory into `useExchangeGroupsQuery`.
- `GroupsScreen` still owns local `members`, `membersLoading`, and `membersError` state and populates them via an imperative `loadMembers()` callback triggered by `useEffect`.
- `selectedGroup` is reconciled locally from the shared groups inventory and must stay local.
- add-member and remove-member workflows remain imperative, screen-local flows with dialog state, result state, and error state that should remain local.
- successful add/remove operations currently invalidate the shared groups inventory query and then manually call `loadMembers()`.

This means Phase 2 should move only the members read model into TanStack Query and replace manual post-mutation member refreshes with scoped invalidation.

## Decisions to lock before implementation

### 1. Shared members query ownership

Lock the canonical members query behind one shared renderer-facing API.

Recommended implementation surface:

- `src/renderer/hooks/use-group-members.ts`

Recommended exports:

- `getGroupMembersQueryOptions`
- `invalidateGroupMembersQueryForGroup`
- `useGroupMembersQuery`

Recommended hook return shape:

- `members: GroupMemberListItem[]`
- `isLoading: boolean`
- `isFetching: boolean`
- `error: string | null`
- `errorPresentation: ClassifiedFailurePresentation | null`
- `hasData: boolean`
- `refetch: () => Promise<unknown>`

### 2. Canonical query-key shape for group members

Lock the members key under the existing Phase 0 / Phase 1 taxonomy.

Recommended additions to `src/renderer/lib/query-keys.ts`:

- `exchangeGroupMembersRoot(connectionIdentity)`
- `exchangeGroupMembersList(connectionIdentity, groupExchangeIdentity)`

Recommended key shapes:

- `queryKeys.exchangeGroupMembersRoot(connectionIdentity)` → `['console', 'exchange', normalizedConnectionScope, 'groups', 'members']`
- `queryKeys.exchangeGroupMembersList(connectionIdentity, groupExchangeIdentity)` → `['console', 'exchange', normalizedConnectionScope, 'groups', 'members', groupExchangeIdentity]`

### 3. Dependent-query rule

The members query must not execute until both of these are true:

- Exchange is connected
- `selectedGroup` exists

Recommended rule:

- use `enabled: exchangeConnected && selectedGroup !== null`

### 4. Error presentation rule

Use the same failure presentation model already standardized in Phase 1.

Recommended rule:

- the shared members hook returns both `error` and `errorPresentation`
- formatting should reuse `presentCommandFailure` and `formatPresentedCommandFailure`

### 5. Mutation invalidation rule

Keep inventory invalidation from Phase 1 and add scoped members invalidation in Phase 2.

Recommended rule:

- after `groups.addMembers()`, invalidate the selected group-members query if at least one result item has status `added` or `alreadyMember`
- after `groups.removeMembers()`, invalidate the selected group-members query if at least one result item has status `removed` or `notMember`
- do not invalidate the members query for failed-only or verification-failed-only mutation results

Refined split:

- keep shared groups inventory invalidation limited to actual membership changes (`added` / `removed`)
- broaden selected group-members query invalidation to authoritative clean no-op outcomes as well (`alreadyMember` / `notMember`) so the members pane can repair stale cached state after a write confirms current server truth

## Groups screen state mapping

Move to shared query:

- members list data
- members loading state
- members error state
- members refresh path

Keep local to the screen:

- `selectedGroup`
- `groupFilter`
- `memberFilter`
- `sortBy`
- `activeTab`
- add dialog open/search/selection/results state
- remove confirmation/result state

## Work breakdown

### Work item 1 — define the shared group-members query domain

Goal:

- create the canonical shared members query wrapping `window.radApp.groups.getMembers()`

Expected implementation touchpoints:

- `src/renderer/hooks/use-group-members.ts`
- `src/renderer/lib/query-keys.ts`

### Work item 2 — add members query key coverage and hook tests

Goal:

- verify key shape, disabled behavior, cache isolation, formatted errors, and scoped invalidation

Expected implementation touchpoints:

- `src/renderer/lib/query-keys.test.ts`
- `src/renderer/hooks/use-group-members.test.ts`

### Work item 3 — migrate Groups screen members flow to the shared members query

Goal:

- replace local `members`, `membersLoading`, `membersError`, and `loadMembers()` with the shared hook while preserving the current UI branches and local filtering/sorting state

Expected implementation touchpoints:

- `src/renderer/components/console/screens/groups-screen.tsx`

### Work item 4 — wire scoped invalidation after successful member mutations

Goal:

- replace imperative `await loadMembers()` refreshes with query invalidation for the selected group’s members query

Expected implementation touchpoints:

- `src/renderer/components/console/screens/groups-screen.tsx`
- `src/renderer/hooks/use-group-members.ts`

## Verification gates

Phase 2 is complete only when all of the following are true.

### Query-domain gates

- `groups.getMembers()` is no longer loaded through an imperative screen-local `useEffect`
- the members query is keyed by Exchange connection identity and selected group identity
- switching between groups uses distinct cache entries

### Behavior-preservation gates

- selected group reconciliation still works the same way
- member filtering and sorting remain local and behave the same way
- add/remove dialog state and search debounce behavior remain local and unchanged
- owners/settings tabs remain unchanged

### Mutation-refresh gates

- actual membership changes (`added` / `removed`) invalidate both the shared groups inventory query and the affected group-members query
- authoritative clean no-op outcomes (`alreadyMember` / `notMember`) invalidate the affected group-members query without invalidating shared groups inventory
- failed-only or verification-failed-only mutation results do not invalidate the affected group-members query

### Verification-command gates

- `npm run typecheck` passes
- `npm test` passes

## Baseline regression checklist

- open Groups and load members for the initially selected group
- switch from one group to another and confirm a new members query runs for the new key
- switch back and confirm cached members remain visible during background refresh
- add a member and confirm the selected group’s members list refreshes
- remove a member and confirm the selected group’s members list refreshes
- confirm recipient search debounce still behaves the same way
- confirm owners/settings tabs remain unchanged

## Atomic commit strategy

1. `docs: add react query phase 2 execution plan`
2. `feat: add scoped group members query with tests`
3. `refactor: migrate groups screen members flow to scoped members query`

## Acceptance criteria

- The Phase 2 plan stays within the group-members scope defined by `docs/architecture/16-react-query-roadmap.md`.
- The plan defines a members query keyed by Exchange connection identity and selected group identity.
- The plan keeps selected group, filters, tabs, dialogs, and search debounce local.
- The plan defines scoped invalidation after successful add/remove member mutations.
- The plan keeps owners/settings queries out of scope.
