# 17. React Query Phase 0 Execution Plan

## Purpose

Turn Phase 0 from `docs/architecture/16-react-query-roadmap.md` into an implementation-ready execution plan.

Phase 0 is scaffolding only. The goal is to introduce TanStack Query into the renderer with a clear provider boundary, explicit QueryClient policy, shared query-key rules, and connection-safe cache lifecycle behavior without changing feature behavior or migrating any screen reads yet.

## Scope basis

This execution plan is based on:

- `docs/architecture/10-rollout-plan.md`
- `docs/architecture/11-test-strategy.md`
- `docs/architecture/12-backlog-and-commits.md`
- `docs/architecture/16-react-query-roadmap.md`
- `src/renderer/main.tsx`
- `src/renderer/app/app.tsx`
- `src/renderer/components/console/app-context.tsx`
- `src/preload/index.ts`
- `src/renderer/components/console/screens/dashboard-screen.tsx`
- `src/renderer/components/console/screens/groups-screen.tsx`
- `src/renderer/components/console/screens/reports-screen.tsx`
- `src/renderer/components/console/screens/directory-screen.tsx`
- `src/renderer/components/console/system-logs-panel.tsx`

## Phase 0 scope

Phase 0 covers only the foundation needed before the first query migration.

Included in this phase:

- add TanStack Query packages to the renderer
- introduce one shared `QueryClientProvider` at the renderer root
- define the initial global `QueryClient` defaults for this Electron app
- define shared query-key rules and helper ownership
- define cache invalidation and cache-clearing behavior for authoritative connection/session changes
- define the verification gates that must pass before Phase 1 begins

## Non-goals

Phase 0 does not include feature migration.

Explicit non-goals:

- no screen conversion to `useQuery`
- no screen conversion to `useMutation`
- no `exchange.listGroups()` migration yet
- no `groups.getMembers()` migration yet
- no Directory read-path migration yet
- no pagination redesign for System Logs yet
- no AppContext ownership changes beyond making it able to coordinate cache lifecycle
- no UI behavior changes beyond invisible scaffolding needed to support later phases

## Current repo baseline

Current reality that this phase must respect:

- `src/renderer/main.tsx` renders `<App />` inside `React.StrictMode` and is the renderer root insertion point.
- `src/renderer/app/app.tsx` currently wraps the app with `AppProvider` only.
- `src/renderer/components/console/app-context.tsx` owns shell hydration, connection status, pending auth actions, and connect/disconnect refresh behavior.
- `src/preload/index.ts` exposes the renderer's async boundary through `window.radApp`; this remains the data boundary for query functions.
- `package.json` does not currently include `@tanstack/react-query`.
- the current renderer uses manual `useState` + `useEffect` + `useCallback` request flows for read surfaces.
- `exchange.listGroups()` is independently loaded in Dashboard, Groups, and Reports.
- Directory and System Logs also use screen-local async request state rather than a shared cache layer.

This means Phase 0 must introduce a query foundation without broadening scope into screen migration.

## Decisions to lock before implementation

These are not optional alternatives. They are the Phase 0 decisions that must be defined clearly before any Phase 1 work starts.

### 1. Provider placement

Lock the provider boundary as:

- `QueryClientProvider` at the renderer root in `src/renderer/main.tsx`
- `AppProvider` remains below it in `src/renderer/app/app.tsx` unless there is a compelling implementation reason to collapse them into one thin wrapper

Decision to resolve:

- whether `main.tsx` owns the provider directly or whether a tiny renderer bootstrap wrapper is introduced for provider composition

Required outcome:

- one shared renderer-owned QueryClient
- no screen-level providers

### 2. Renderer-only query layer

Lock the query boundary as:

- query functions stay in the renderer
- query functions call `window.radApp`
- no IPC contract redesign for TanStack Query
- no renderer access to main-process internals outside preload

Required outcome:

- TanStack Query is a consumer of the existing preload API, not a reason to reshape the architecture layers

### 3. Global QueryClient policy

Lock the initial policy for this Electron app.

This plan must define the initial default values or decision rules for:

- `staleTime`
- `gcTime`
- retry behavior
- `refetchOnWindowFocus`
- `refetchOnReconnect`

Required outcome:

- the defaults are conservative for IPC-backed reads
- the defaults are documented once, centrally, before any screen migration starts

### 4. Query-key rules

Lock the key taxonomy before the first query is introduced.

This plan must define:

- top-level key naming shape
- parameterized key rules
- connection-identity segment rules
- where shared key builders live
- when inline keys are allowed versus disallowed

Required outcome:

- Exchange-backed query domains cannot be keyed only by screen params
- future phases can invalidate by prefix without redefining naming conventions

### 5. Connection-safe cache lifecycle policy

Lock the cache response to authoritative context changes.

This plan must define what happens on:

- Exchange connect
- Exchange disconnect
- Graph connect
- Graph disconnect
- session reset or tenant mismatch recovery flows

Decision to resolve:

- whether the initial Phase 0 contract uses `invalidateQueries`, `removeQueries`, `clear`, or a mixed strategy for connection-boundary events

Required outcome:

- no stale cross-session or cross-tenant data can survive an authoritative connection change

## Work breakdown

### Work item 1 — capture the baseline and target insertion points

Goal:

- record the current renderer root composition and the current owner of shell/connection refresh behavior

Files to anchor:

- `src/renderer/main.tsx`
- `src/renderer/app/app.tsx`
- `src/renderer/components/console/app-context.tsx`

Deliverable:

- a short implementation note in the code plan or PR description identifying the chosen provider insertion point and why it preserves the current shell boundary

### Work item 2 — add dependency and provider scaffolding only

Goal:

- install TanStack Query and add `QueryClientProvider` without changing screen behavior

Expected implementation touchpoints:

- `package.json`
- `src/renderer/main.tsx`
- one shared QueryClient module under the renderer tree

Deliverable:

- the app boots with a shared QueryClient in place and no query consumers yet

### Work item 3 — define and implement the shared QueryClient module

Goal:

- create one renderer-owned QueryClient with explicit Electron-safe defaults

Expected implementation touchpoints:

- a new renderer module for QueryClient creation and any global helpers needed for policy composition

The module must make the following easy to inspect in one place:

- default query behavior
- cache lifetime behavior
- retry/refetch policy
- any devtools wiring decision

Deliverable:

- a single source of truth for QueryClient configuration

### Work item 4 — define query-key helpers and taxonomy

Goal:

- establish a shared key-shape contract before any query hooks are introduced

Expected implementation touchpoints:

- a new renderer module for query-key builders or key constants/helpers

This work item must define:

- domain naming for Exchange-backed reads
- domain naming for Graph-backed reads when needed later
- parameter placement rules
- connection-identity placement rules

Deliverable:

- implementation-ready key helpers that later phases can reuse without re-litigating taxonomy

### Work item 5 — wire cache lifecycle handling to shell/connection boundaries

Goal:

- ensure authoritative connection changes trigger the agreed cache lifecycle behavior

Expected implementation touchpoints:

- `src/renderer/components/console/app-context.tsx`
- shared QueryClient access point or cache helper module

This work item must keep AppContext's ownership boundaries intact. AppContext remains the owner of connection actions; it only coordinates the agreed cache reset/invalidation behavior.

Deliverable:

- a connection-safe cache lifecycle contract implemented at the control-plane boundary

### Work item 6 — define proof gates for Phase 0 completion

Goal:

- encode what must be true before the team can start Phase 1

This work item must cover:

- boot verification
- unchanged behavior verification for current read screens
- stale-data boundary verification across connection changes
- typecheck and relevant test verification

Deliverable:

- a checkable Phase 0 sign-off list

## Verification gates

Phase 0 is complete only when all of the following are true.

### Boot and boundary gates

- the renderer still boots successfully from `src/renderer/main.tsx`
- the app still renders under `React.StrictMode`
- `AppProvider` remains the owner of shell/auth/navigation state
- no preload or IPC contract boundary is widened to support the query layer

### Behavior-preservation gates

- Dashboard, Groups, Reports, Directory, and System Logs still behave the same from the user’s perspective because no screen migration has happened yet
- no feature path depends on TanStack Query data before Phase 1 intentionally introduces a query consumer

### Cache-safety gates

- authoritative connection changes cannot leave stale query data available for later reuse
- the chosen connection-boundary cache strategy is implemented and documented
- query keys are scoped so future Exchange-backed reads can be separated by connection identity

### Verification-command gates

- `npm run typecheck` passes
- `npm test` remains green or any unrelated pre-existing failures are explicitly documented before Phase 1 starts
- the app can still launch in development mode after Phase 0 scaffolding is added

## Baseline regression checklist

Before Phase 0 is signed off, compare post-scaffolding behavior against the current baseline for:

- Dashboard initial load
- Groups initial load and navigation away/back
- Reports initial load
- Directory search surface initialization
- System Logs initial panel load
- Exchange connect/disconnect flow
- Graph connect/disconnect flow

The expected outcome is no user-visible regression because Phase 0 should only add invisible scaffolding.

## Atomic commit strategy

The implementation should stay small and reviewable.

Recommended commit sequence for Phase 0 code work:

1. `chore: add react query dependency and renderer provider scaffolding`
2. `chore: add shared query client configuration and key helpers`
3. `chore: wire query cache lifecycle to connection boundary events`
4. `test: add or update verification coverage for react query scaffolding`

If the work is small enough, commits 2 and 3 may be combined. The key rule is to keep every commit inside Phase 0 scope.

## Acceptance criteria

- The Phase 0 plan stays within the scaffolding scope defined by `docs/architecture/16-react-query-roadmap.md`.
- The plan identifies `src/renderer/main.tsx` as the renderer-root insertion point to resolve.
- The plan keeps `AppContext` as the owner of shell/auth/navigation state.
- The plan requires one shared renderer-owned QueryClient.
- The plan requires explicit defaults for `staleTime`, `gcTime`, retry behavior, and refetch policy before Phase 1 begins.
- The plan requires shared query-key rules with connection-aware scoping.
- The plan requires connection-boundary cache lifecycle behavior before any screen migration begins.
- The plan defines verification gates that prove scaffolding did not change feature behavior.
- The plan does not include any Phase 1+ screen migration work.
