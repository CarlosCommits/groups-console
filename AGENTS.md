# groups-console notes

## Repo shape

- Current app is the Electron v2 desktop app in `src/{main,preload,renderer}`. Trust `package.json`, `forge.config.ts`, the root `README.md`, and the current `src/` entrypoints for active dev workflow.
- The supported product/runtime target is Windows. Packaging uses Electron Forge with Squirrel and ZIP makers; architecture documents that describe older builders or layouts are historical unless the live config agrees.
- Process split is strict: `src/main/**` owns Electron/PowerShell orchestration, `src/preload/index.ts` exposes the typed `window.groupsConsole` bridge, `src/renderer/**` is React UI, and `src/shared/**` holds Zod contracts/DTOs used across all three.
- Renderer code must stay browser-only. `eslint.config.mjs` blocks `electron`, `node:*`, `fs`, `path`, `os`, and `child_process` imports under `src/renderer/**`; add new privileged behavior through preload/main instead.
- Security settings are intentional: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `OnlyLoadAppFromAsar: true`, and the packaged PowerShell scripts are shipped via Forge `extraResource`. Do not weaken sandbox/security settings to work around local Linux Electron issues.
- Local bootstrap/readiness depends on four checks: `powershell`, `exchangeModule`, `logDirectory`, and `tenantConfig`. The auth panel preemptively surfaces missing PowerShell, missing `ExchangeOnlineManagement`, and installed-but-not-importable module issues before Exchange sign-in.
- Missing `ExchangeOnlineManagement` can be remediated through the narrow `exchange.installModule` IPC path in main/preload/PowerShell worker code. Do not add renderer-side PowerShell execution or silent persistent `ExecutionPolicy` changes.
- Tenant settings are Zod-validated JSON, not environment variables: prefer the user-data `config/tenant.json` override and fall back to the bundled repo `config/tenant.json`. The client ID is public desktop-app configuration; never add a client secret or certificate credential.

## Command and privilege boundaries

- Privileged features follow the typed pipeline: shared command name and payload/result schemas -> typed preload method -> validated IPC sender/request -> main-process handler/service -> parsed result. Do not expose raw `ipcRenderer`, free-form channels, arbitrary PowerShell, filesystem paths, or Graph requests to the renderer.
- When adding a command, update every applicable layer: `src/shared/contracts/**`, `src/shared/validation/create-command-request.ts`, `src/preload/index.ts`, `src/renderer/env.d.ts`, `src/main/ipc/register-ipc-handlers.ts`, the owning service/backend, and focused tests. Parse data at both IPC boundaries instead of relying on TypeScript types alone.
- Keep trusted-sender validation and request IDs intact. Progress events must remain request-scoped, and listeners must be removed after completion.
- Recipient detail commands intentionally dereference a `stableKey` from the current main-process search cache. Preserve the selected row's source and stable key; do not let the renderer substitute an arbitrary SMTP address, Graph ID, or Exchange identity for a cached selection.

## Commands

- `npm start` starts the Electron Forge dev app.
- `npm run lint` runs the flat ESLint config in `eslint.config.mjs`.
- `npm run typecheck` is required for full coverage; it runs `tsconfig.main.json`, `tsconfig.preload.json`, and `tsconfig.renderer.json` separately.
- `npm run test` runs Vitest only for `src/**/*.test.ts`. Tests are co-located with source; Playwright is present but not wired into the default test script.
- `npm run test:powershell` runs `powershell/tests` with exactly Pester 5.7.1.
- `npm run verify` is the normal behavior-change gate: lint, all three TypeScript projects, Vitest, then Pester. PowerShell behavior changes need focused Pester coverage as well as any TypeScript contract/orchestration tests they affect.
- `npm run package` builds a packaged app; `npm run make` creates distributables.

## PowerShell runtime

- Exchange operations run through one long-lived, app-owned session host (`powershell/bootstrap/exchange-session-host.ps1`) so authentication and connection context survive across commands. The one-shot `worker.ps1` is restricted to environment inspection, capability checks, and module installation.
- Adding a PowerShell command file is not enough: dot-source it in the session host, add its explicit switch case, wire the TypeScript session-manager command and response schema, and test the serialized request/response path. Keep the worker and session-host command sets allowlisted.
- PowerShell stdout is a JSON-lines protocol for responses/progress. Do not write incidental output to the success stream; use returned objects and the existing protocol so parsing cannot be corrupted.
- Packaged code resolves PowerShell and config assets from `process.resourcesPath`; development resolves them from the app path. Use the helpers in `src/main/app/paths.ts` rather than constructing paths ad hoc.

## Exchange / Graph workflow invariants

- Backend ownership is deliberate: Exchange PowerShell owns distribution lists, mail-enabled security groups, Exchange contacts, and their membership reads/writes. Graph owns guest search/invite/profile workflows and may help resolve a selected guest, but must not become the write path for Exchange-backed groups.
- For Exchange group membership reads, treat a mail contact and a guest user / `GuestMailUser` as separate entities even when they share the same email address.
- The selected directory row is the source of truth. Do not collapse or canonicalize membership lookups by `primaryEmail`.
- Primary membership lookup should use the resolved Exchange object's `DistinguishedName` with a `Members -eq '<DN>'` filter and keep only distribution lists + mail-enabled security groups.
- Enumeration of groups and members is a fallback path, not the primary source of truth.
- Preserve selected-principal identity in group flows: Graph guests stay `graphGuest` selections until the main process resolves them by Graph object ID into an Exchange `GuestMailUser`; do not shortcut that to SMTP matching.
- Any Exchange recipient returned for a later membership write must use a unique write identity in this order: `Guid`, then `DistinguishedName`, then Exchange `.Identity` only as a last-resort compatibility fallback. Use `Get-GroupsConsoleRecipientWriteIdentity`; never downgrade a resolved object to display name, alias, or SMTP.
- For membership matching and fallback enumeration, strong identity wins: if either side has an object ID or stable Exchange identity, compare strong identifiers and do not fall back to SMTP/alias when those identifiers disagree. This does not remove SMTP-based contact/guest overlap detection.
- Guest-to-Exchange bridging requires both sessions connected and `exchangeAlignment === 'matched'`. Treat `unknown` and `mismatched` as deferred/blocked for cross-backend identity or conflict decisions; never guess tenant equivalence from an email domain.
- Overlap handling is intentionally asymmetric: inviting a guest over an existing mail contact is allowed, but contact creation must block if a Graph guest already owns that email. Treat SMTP as an overlap signal, not the canonical identity key.
- Combined directory search is designed for partial degradation. Preserve `sourceStatus` and `sourceFailures` and return usable results from one backend when the other is unavailable; fail the whole search only when no requested source can provide a valid result.
- Membership add/remove payloads require `verify: true`, and success is determined from the per-item outcome plus the authoritative post-write Exchange reread. Do not treat a non-throwing cmdlet invocation alone as success.
- Single-group removal and every multi-group removal surface use the same `useRemoveGroupMembersMutation` -> `groups.removeMembers` -> Exchange session-manager/PowerShell path. Multi-group UI actions intentionally iterate one group at a time and aggregate partial results; do not add a divergent removal implementation for another screen.

## Renderer data and mutation behavior

- Server state belongs in TanStack Query hooks under `src/renderer/hooks/**`, with keys from `src/renderer/lib/query-keys.ts`. Scope Exchange, Graph, and combined-recipient caches by the active connection/tenant identity so data cannot bleed between reconnects or tenants.
- Centralize mutations and invalidation in shared hooks. Group membership mutations invalidate the affected group-members query and every relevant selected-principal membership key; invalidate group inventory only for outcomes that can change its counts. Preserve partial-result UI instead of flattening it into all-success/all-failure.
- Keep presentation of classified runtime failures through the shared command/source failure presenters so backend, remediation, and tenant-mismatch guidance remain consistent across screens.

## Logging, files, and release behavior

- Privileged writes, save dialogs, report generation, diagnostics export, auth-cache persistence, updates, and logging stay in main. Excel exports use ExcelJS in main; `ImportExcel` is not a runtime dependency.
- Operational logs carry the operation ID, IPC request ID, backend owner, safe error classification, and tenant/actor context when available. Pass log metadata through the existing redaction utilities, never log tokens/authorization values/secrets/redemption URLs, and never let logging failure change command semantics.
- Graph auth is delegated interactive system-browser auth. Its MSAL cache persists only when Electron `safeStorage` encryption is available; do not introduce password collection or plaintext token storage.
- Release tags matching `v*.*.*` trigger the Windows release workflow, which runs `npm run verify` before `npm run make`. Preserve Squirrel asset naming/update-feed expectations when changing packaging.
- `src/renderer/components/ui/**` has intentional `@typescript-eslint/no-unsafe-*` rule relaxations; do not copy that loosened standard into the rest of the repo.
