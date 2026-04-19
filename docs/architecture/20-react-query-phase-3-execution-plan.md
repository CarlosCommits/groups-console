# 20. React Query Phase 3 Execution Plan

## Purpose

Turn Phase 3 from `docs/architecture/16-react-query-roadmap.md` into an implementation-ready execution plan.

Phase 3 moves the Directory screen’s shared and dialog-driven read paths into TanStack Query while preserving imperative write flows. The goal is to migrate `recipients.search`, `contacts.getDetails`, `guests.getDetails`, and `exchange.getRecipientDetails` into connection-aware query domains without moving debounce, dialog open state, or mutation flows into shared query ownership.

## Scope basis

This execution plan is based on:

- `docs/architecture/16-react-query-roadmap.md`
- `docs/architecture/18-react-query-phase-1-execution-plan.md`
- `docs/architecture/19-react-query-phase-2-execution-plan.md`
- `src/renderer/components/console/screens/directory-screen.tsx`
- `src/renderer/components/console/screens/directory-screen.test.ts`
- `src/renderer/lib/query-keys.ts`
- `src/renderer/hooks/use-exchange-groups.ts`
- `src/renderer/hooks/use-group-members.ts`
- `src/preload/index.ts`
- `src/shared/contracts/recipients.ts`
- `src/shared/contracts/contacts.ts`
- `src/shared/contracts/guests.ts`
- `src/shared/contracts/exchange.ts`

## Phase 3 scope

Phase 3 covers only the Directory screen’s read paths.

Included in this phase:

- define one shared query domain for `window.radApp.recipients.search()`
- define dialog-driven detail query domains for:
  - `window.radApp.contacts.getDetails()`
  - `window.radApp.guests.getDetails()`
  - `window.radApp.exchange.getRecipientDetails()`
- migrate `directory-screen.tsx` to consume those query domains
- preserve debounce and dialog-local state while moving read data/loading/error ownership into TanStack Query
- add tests for query keys, query hooks, and screen behavior relevant to the migrated read paths

## Non-goals

Phase 3 does not include any work outside the Directory screen’s read paths.

Explicit non-goals:

- no migration of `contacts.create()`, `contacts.updateCompany()`, `guests.invite()`, or `guests.updateCompany()` into TanStack Query
- no mutation invalidation architecture beyond preserving current behavior
- no migration of debounce timing or search text ownership into query state
- no migration of dialog open/close state into query state
- no changes to Dashboard, Groups, Reports, or System Logs
- no Phase 4 or Phase 5 work

## Current repo baseline

Current reality that this phase must respect:

- `DirectoryScreen` currently debounces `searchText` into `effectiveQuery` locally and runs `window.radApp.recipients.search()` from an imperative `useEffect`.
- The search surface currently owns local `results`, `loading`, and `error` state.
- Detail dialogs currently run imperative reads for contacts, guests, and exchange recipients.
- `detailRequestIdRef` currently protects against stale or out-of-order detail responses and that safety must be preserved.
- Create, update, and invite flows remain imperative and screen-local and should stay that way in Phase 3.

This means Phase 3 should move read results into query domains without broadening TanStack Query ownership into debounce control, dialog open state, or write flows.

## Decisions to lock before implementation

### 1. Search query ownership

Lock the recipient search behind one shared renderer-facing hook.

Recommended implementation surface:

- `src/renderer/hooks/use-recipients-search.ts`

Recommended exports:

- `getRecipientsSearchQueryOptions`
- `useRecipientsSearchQuery`

Required rule:

- debounce stays in `DirectoryScreen`
- the query hook receives the already-debounced search input and active tab-derived types

### 2. Detail query split

Lock detail reads into separate hooks by backing API instead of one polymorphic detail hook.

Recommended implementation surfaces:

- `src/renderer/hooks/use-contact-details.ts`
- `src/renderer/hooks/use-guest-details.ts`
- `src/renderer/hooks/use-exchange-recipient-details.ts`

This keeps query keys, enabled rules, and error formatting explicit per remote read path.

### 3. Query key shape for Directory reads

Add connection-scoped keys for search and detail dialogs under the existing query key taxonomy.

Recommended additions to `src/renderer/lib/query-keys.ts`:

- `recipientsSearchRoot(connectionIdentity)`
- `recipientsSearch(connectionIdentity, query, types)`
- `contactDetails(connectionIdentity, stableKey)`
- `guestDetails(connectionIdentity, stableKey)`
- `exchangeRecipientDetails(connectionIdentity, stableKey)`

Required rule:

- use the target item’s `stableKey` for detail query identity
- use connection identity in all Directory read keys

### 4. Enabled rules

Search and detail queries must stay conditional.

Required rules:

- search query enabled only when the current tab/connection prerequisites are satisfied and the debounced query length is valid
- detail queries enabled only when the dialog is open and a valid target exists

### 5. Stale-response safety

Phase 3 must preserve the current stale-response guarantees for detail dialogs.

Required rule:

- the execution must preserve the current protection against older in-flight detail responses overwriting newer dialog targets before the imperative guard pattern can be removed with confidence

### 6. Error presentation

Reuse the same formatted query-hook error conventions established in Phases 1 and 2.

Required rule:

- each read hook returns formatted error strings and presentation metadata using the existing command failure presenter utilities

## Screen state mapping

Move to shared query:

- search result data
- search loading/fetching/error state
- detail result data
- detail loading/fetching/error state

Keep local to the screen:

- `searchText`
- `effectiveQuery`
- active tab/filter state
- dialog open/close state
- selected detail target
- create/update form state
- create/update/invite pending/result/error state

## Work breakdown

### Work item 1 — define query-key additions for Directory read paths

Goal:

- extend the query key taxonomy for recipients search and the three detail read paths

Expected implementation touchpoints:

- `src/renderer/lib/query-keys.ts`
- `src/renderer/lib/query-keys.test.ts`

### Work item 2 — add recipients search query hook and tests

Goal:

- create the shared recipients search query domain while keeping debounce in the screen

Expected implementation touchpoints:

- `src/renderer/hooks/use-recipients-search.ts`
- `src/renderer/hooks/use-recipients-search.test.ts`

### Work item 3 — migrate Directory search read path

Goal:

- replace the imperative search `useEffect` state machine with the shared recipients search query

Expected implementation touchpoint:

- `src/renderer/components/console/screens/directory-screen.tsx`

### Work item 4 — add detail query hooks and tests

Goal:

- create separate shared query hooks for contact, guest, and exchange-recipient detail reads

Expected implementation touchpoints:

- `src/renderer/hooks/use-contact-details.ts`
- `src/renderer/hooks/use-contact-details.test.ts`
- `src/renderer/hooks/use-guest-details.ts`
- `src/renderer/hooks/use-guest-details.test.ts`
- `src/renderer/hooks/use-exchange-recipient-details.ts`
- `src/renderer/hooks/use-exchange-recipient-details.test.ts`

### Work item 5 — migrate detail dialog reads

Goal:

- replace imperative detail reads with shared detail query hooks while preserving dialog-local ownership and stale-response safety

Expected implementation touchpoint:

- `src/renderer/components/console/screens/directory-screen.tsx`

### Work item 6 — expand screen regression coverage

Goal:

- prove the Directory read migration preserves current screen behavior and cache boundaries

Expected implementation touchpoint:

- `src/renderer/components/console/screens/directory-screen.test.ts`

## Verification gates

Phase 3 is complete only when all of the following are true.

### Shared-cache gates

- all four Phase 3 reads use connection-scoped query keys
- detail reads use stable-key-based identity
- query cache identity does not leak across connection changes

### Behavior-preservation gates

- search debounce still behaves exactly as before
- dialog open/close state remains local
- create/update/invite flows remain imperative
- tab-specific Directory behavior remains unchanged

### Stale-response gates

- rapid detail target changes do not show the wrong recipient details
- reopening dialogs does not surface older in-flight results for a prior target

### Verification-command gates

- `npm run typecheck` passes
- `npm test` passes

## Baseline regression checklist

- search by query still works
- tab filtering still works
- detail dialogs load correctly for contact, guest, and exchange recipient types
- closing and reopening dialogs behaves correctly
- connection changes do not reuse stale search or detail data
- post-write refresh behavior remains unchanged

## Atomic commit strategy

1. `docs: add react query phase 3 execution plan`
2. `test: add query key coverage for directory read queries`
3. `feat: add shared recipients search query`
4. `refactor: migrate directory search to shared recipients query`
5. `test: add coverage for directory recipient detail queries`
6. `feat: add shared contact guest and exchange recipient detail queries`
7. `refactor: migrate directory detail dialogs to shared queries`
8. `test: verify directory read-path cache behavior and regressions`

## Acceptance criteria

- The Phase 3 plan follows the established Phase 1/2 execution-plan structure.
- The plan stays strictly within the four Directory read paths from the roadmap.
- The plan explicitly preserves imperative write flows.
- The plan explicitly keeps debounce and dialog state local.
- The plan names the real repo touchpoints for implementation and tests.
- The plan includes TDD-first work sequencing and concrete verification gates.
