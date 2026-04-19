# 22. React Query Phase 5 Execution Plan

## Purpose

Turn Phase 5 from `docs/architecture/16-react-query-roadmap.md` into an implementation-ready execution plan.

Phase 5 standardizes selective mutation adoption only after Phases 1–4 stabilized the shared read model. The goal is to move six existing write paths behind shared mutation-layer logic with consistent invalidation behavior while preserving current dialog/result UX and explicitly avoiding optimistic UI.

Target mutations in this phase:

- `groups.addMembers()`
- `groups.removeMembers()`
- `contacts.create()`
- `contacts.updateCompany()`
- `guests.invite()`
- `guests.updateCompany()`

## Scope basis

This execution plan is based on:

- `docs/architecture/16-react-query-roadmap.md`
- `docs/architecture/19-react-query-phase-2-execution-plan.md`
- `docs/architecture/20-react-query-phase-3-execution-plan.md`
- `docs/architecture/21-react-query-phase-4-execution-plan.md`
- `src/renderer/components/console/screens/groups-screen.tsx`
- `src/renderer/components/console/screens/directory-screen.tsx`
- `src/renderer/components/console/group-members-mutation-outcome.ts`
- `src/renderer/hooks/use-exchange-groups.ts`
- `src/renderer/hooks/use-group-members.ts`
- `src/renderer/hooks/use-recipients-search.ts`
- `src/renderer/hooks/use-contact-details.ts`
- `src/renderer/hooks/use-guest-details.ts`
- `src/renderer/lib/query-client.ts`
- `src/renderer/lib/query-keys.ts`
- `src/shared/contracts/exchange.ts`
- `src/shared/contracts/contacts.ts`
- `src/shared/contracts/guests.ts`

## Phase 5 scope

Phase 5 covers only the six named mutation paths and the invalidation hardening around them.

Included in this phase:

- move the six write paths behind shared mutation-layer logic
- centralize success-path invalidation rules instead of leaving them ad hoc inside screens
- reuse the shared query ownership established in Phases 1–4
- preserve the current result dialogs, form state, and command-failure presentation style
- add tests for invalidation correctness and write-path regressions

## Non-goals

Phase 5 does not include any work outside selective mutation adoption and invalidation correctness.

Explicit non-goals:

- no optimistic UI
- no AppContext or shell-state redesign
- no changes to Settings, Reports, or System Logs
- no migration of unrelated mutations outside the six named APIs
- no redesign of dialog open/close state, form state, or result-state ownership
- no query-key taxonomy redesign unless implementation proves the current keys insufficient

## Current repo baseline

Current reality that this phase must respect:

- Phase 2 already standardized Groups read ownership and outcome-based invalidation semantics for members and inventory refresh.
- `GroupsScreen` still executes `groups.addMembers()` and `groups.removeMembers()` imperatively, but already uses shared invalidation helpers after success.
- `group-members-mutation-outcome.ts` already encodes the add/remove status rules and should remain the source of truth for those outcomes.
- Phase 3 moved Directory reads into query hooks but intentionally kept create/update/invite flows imperative.
- `DirectoryScreen` still executes `contacts.create()`, `contacts.updateCompany()`, `guests.invite()`, and `guests.updateCompany()` directly.
- Directory invalidation is currently mixed into screen handlers and, in the update flow, still partly tied to dialog-close behavior.

This means Phase 5 should centralize write-side invalidation logic without changing the current local ownership of dialog state, form state, and result rendering.

## Decisions to lock before implementation

### 1. Mutation ownership boundary

Use shared mutation-layer hooks or option builders for the six named write paths, but keep screen-local UI ownership intact.

Required rule:

- the mutation layer owns execution and success invalidation
- the screen still owns dialog open/close state, form state, and result rendering

### 2. Query-key reuse rule

Phase 5 should reuse the existing query-key taxonomy from Phases 1–4.

Required rule:

- do not add new query-key families unless implementation proves existing roots cannot express the invalidation target cleanly

### 3. Groups invalidation matrix

Keep the Phase 2 Groups semantics as the Phase 5 contract.

Required rule:

- `added` invalidates shared groups inventory and selected-group members
- `alreadyMember` invalidates selected-group members only
- `removed` invalidates shared groups inventory and selected-group members
- `notMember` invalidates selected-group members only
- `invalid`, `verificationFailed`, and `failed` do not invalidate

### 4. Directory invalidation fanout

Directory writes must invalidate the right search and detail caches on success.

Required rule:

- `contacts.create()` invalidates recipients-search caches for the Exchange-only root and the combined `all` root when creation succeeds
- `guests.invite()` invalidates recipients-search caches for the Graph-only root and the combined `all` root when invitation succeeds
- `contacts.updateCompany()` invalidates relevant recipients-search roots and the targeted contact-details query on success
- `guests.updateCompany()` invalidates relevant recipients-search roots and the targeted guest-details query on success

### 5. Timing rule

Mutation invalidation should happen on mutation success, not on dialog close.

Required rule:

- close handlers may still perform local UI cleanup and search retargeting, but they must not be the only place where cache correctness is restored

### 6. Error and result rule

Preserve the current command-failure presentation and result-state UX.

Required rule:

- shared mutation-layer code must not introduce a second user-facing mutation error language
- screens should continue to display results and failures in the same style they use today

## Mutation/state ownership mapping

Move into shared mutation ownership:

- mutation execution
- success-path invalidation
- mutation-level formatted error mapping if extracted cleanly

Keep local to screens:

- dialog open/close state
- form field state
- pending/result banners and confirmation state
- search retargeting after successful create/invite flows

## Work breakdown

### Work item 1 — add mutation-layer coverage for Groups invalidation

Goal:

- prove the existing Groups invalidation matrix at the hook/helper layer before refactoring screen code

Expected implementation touchpoints:

- `src/renderer/components/console/group-members-mutation-outcome.test.ts`
- new mutation-hook tests if introduced

### Work item 2 — add shared group member mutation hooks

Goal:

- wrap `groups.addMembers()` and `groups.removeMembers()` in shared mutation-layer hooks that own the existing outcome-based invalidation behavior

Expected implementation touchpoints:

- `src/renderer/hooks/use-group-member-mutations.ts`
- `src/renderer/hooks/use-group-member-mutations.test.ts`

### Work item 3 — migrate Groups writes to the shared mutation hooks

Goal:

- move Groups write execution out of `groups-screen.tsx` handlers while preserving current dialog and result UX

Expected implementation touchpoint:

- `src/renderer/components/console/screens/groups-screen.tsx`

### Work item 4 — add Directory contact mutation invalidation coverage

Goal:

- prove the invalidation fanout for `contacts.create()` and `contacts.updateCompany()` before screen migration

Expected implementation touchpoints:

- `src/renderer/hooks/use-contact-mutations.test.ts`
- `src/renderer/components/console/screens/directory-screen.test.ts`

### Work item 5 — add shared contact mutation hooks

Goal:

- wrap `contacts.create()` and `contacts.updateCompany()` in shared mutation hooks with centralized invalidation rules

Expected implementation touchpoints:

- `src/renderer/hooks/use-contact-mutations.ts`
- `src/renderer/hooks/use-contact-mutations.test.ts`

### Work item 6 — migrate Directory contact writes

Goal:

- move contact write execution out of `directory-screen.tsx` while preserving close behavior and search retargeting

Expected implementation touchpoint:

- `src/renderer/components/console/screens/directory-screen.tsx`

### Work item 7 — add Directory guest mutation invalidation coverage

Goal:

- prove the invalidation fanout for `guests.invite()` and `guests.updateCompany()` before screen migration

Expected implementation touchpoints:

- `src/renderer/hooks/use-guest-mutations.test.ts`
- `src/renderer/components/console/screens/directory-screen.test.ts`

### Work item 8 — add shared guest mutation hooks

Goal:

- wrap `guests.invite()` and `guests.updateCompany()` in shared mutation hooks with centralized invalidation rules

Expected implementation touchpoints:

- `src/renderer/hooks/use-guest-mutations.ts`
- `src/renderer/hooks/use-guest-mutations.test.ts`

### Work item 9 — migrate Directory guest writes

Goal:

- move guest write execution out of `directory-screen.tsx` while preserving current dialog/result UX and search retargeting

Expected implementation touchpoint:

- `src/renderer/components/console/screens/directory-screen.tsx`

## TDD execution order

1. Write mutation-hook tests that fail on missing or incorrect invalidation.
2. Implement the smallest shared mutation-layer code to make those tests pass.
3. Refactor screens to consume the new mutation hooks without changing visible UX.
4. Add screen-level regression tests only for local behavior that hook tests cannot prove.
5. Run `npm run typecheck` and `npm test` after each domain slice, not only at the end.

## Verification gates

Phase 5 is complete only when all of the following are true.

### Groups invalidation gates

- `groups.addMembers()` invalidates inventory only for `added`
- `groups.addMembers()` invalidates selected-group members for `added` and `alreadyMember`
- `groups.removeMembers()` invalidates inventory only for `removed`
- `groups.removeMembers()` invalidates selected-group members for `removed` and `notMember`
- failed-only outcomes do not invalidate

### Directory invalidation gates

- `contacts.create()` invalidates the relevant recipients-search roots on successful creation
- `guests.invite()` invalidates the relevant recipients-search roots on successful invitation
- `contacts.updateCompany()` invalidates recipients-search roots and the targeted contact-details query on success
- `guests.updateCompany()` invalidates recipients-search roots and the targeted guest-details query on success
- Directory invalidation no longer depends on dialog close as the only correctness mechanism

### Behavior-preservation gates

- no optimistic UI is introduced
- Groups add/remove dialogs keep their current local state and result rendering
- Directory create/update dialogs keep their current local state and result rendering
- contact create still retargets the search to the created email on close
- guest invite still retargets the search to the invited email on close

### Verification-command gates

- `npm run typecheck` passes
- `npm test` passes

## Baseline regression checklist

- add a member and confirm the selected group members list refreshes correctly
- add an already-member target and confirm the members pane still refreshes without inventory churn
- remove a member and confirm inventory plus members refresh correctly
- remove a non-member and confirm only the members pane refreshes
- create a contact and confirm stale cached Directory search results do not survive
- invite a guest and confirm stale cached guest/all results do not survive
- update a contact company and confirm reopening details does not show stale company data
- update a guest company and confirm reopening details does not show stale company data
- switch between `all`, `contacts`, and `guests` and confirm write-driven invalidation reaches the right cached search scopes

## Atomic commit strategy

For the plan document itself:

1. `docs: add react query phase 5 execution plan`

Recommended implementation sequence:

1. `test: add groups mutation invalidation coverage`
2. `feat: add shared group member mutation hooks`
3. `refactor: migrate groups screen member writes to shared mutations`
4. `test: add directory contact mutation invalidation coverage`
5. `feat: add shared contact mutation hooks`
6. `refactor: migrate directory contact writes to shared mutations`
7. `test: add directory guest mutation invalidation coverage`
8. `feat: add shared guest mutation hooks`
9. `refactor: migrate directory guest writes to shared mutations`
10. `test: verify write-path invalidation regressions`

## Acceptance criteria

- The new doc follows the established execution-plan pattern from Phases 1–4.
- It stays strictly within the six named mutations.
- It explicitly preserves local UI ownership and rejects optimistic UI.
- It locks the invalidation fanout rules for Groups and Directory.
- It names real repo touchpoints instead of generic placeholders.
- It provides a test-first execution order and an implementation commit sequence that can be executed slice by slice.
