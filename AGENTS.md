# groups-console notes

## Repo shape

- Current app is the Electron v2 desktop app in `src/{main,preload,renderer}`. Trust `package.json`, `forge.config.ts`, the root `README.md`, and the current `src/` entrypoints for active dev workflow; `groups-console.ps1` is legacy reference material only.
- Process split is strict: `src/main/**` owns Electron/PowerShell orchestration, `src/preload/index.ts` exposes the typed `window.radApp` bridge, `src/renderer/**` is React UI, and `src/shared/**` holds Zod contracts/DTOs used across all three.
- Renderer code must stay browser-only. `eslint.config.mjs` blocks `electron`, `node:*`, `fs`, `path`, `os`, and `child_process` imports under `src/renderer/**`; add new privileged behavior through preload/main instead.
- Security settings are intentional: `contextIsolation: true`, `sandbox: true`, `nodeIntegration: false`, `OnlyLoadAppFromAsar: true`, and the packaged PowerShell scripts are shipped via Forge `extraResource`. Do not weaken sandbox/security settings to work around local Linux Electron issues.
- Local bootstrap/readiness depends on four checks: `powershell`, `exchangeModule`, `logDirectory`, and `tenantConfig`. The auth panel preemptively surfaces missing PowerShell, missing `ExchangeOnlineManagement`, and installed-but-not-importable module issues before Exchange sign-in.
- Missing `ExchangeOnlineManagement` can be remediated through the narrow `exchange.installModule` IPC path in main/preload/PowerShell worker code. Do not add renderer-side PowerShell execution or silent persistent `ExecutionPolicy` changes.
- Tenant settings come from `config/tenant.json`, not environment variables.

## Commands

- `npm start` starts the Electron Forge dev app.
- `npm run lint` runs the flat ESLint config in `eslint.config.mjs`.
- `npm run typecheck` is required for full coverage; it runs `tsconfig.main.json`, `tsconfig.preload.json`, and `tsconfig.renderer.json` separately.
- `npm run test` runs Vitest only for `src/**/*.test.ts`. Tests are co-located with source; Playwright is present but not wired into the default test script.
- `npm run package` builds a packaged app; `npm run make` creates distributables.

## Exchange / Graph workflow invariants

- For Exchange group membership reads, treat a mail contact and a guest user / `GuestMailUser` as separate entities even when they share the same email address.
- The selected directory row is the source of truth. Do not collapse or canonicalize membership lookups by `primaryEmail`.
- Primary membership lookup should use the resolved Exchange object's `DistinguishedName` with a `Members -eq '<DN>'` filter and keep only distribution lists + mail-enabled security groups.
- Enumeration of groups and members is a fallback path, not the primary source of truth.
- Preserve selected-principal identity in group flows: Graph guests stay `graphGuest` selections until the main process resolves them by Graph object ID into an Exchange `GuestMailUser`; do not shortcut that to SMTP matching.
- Overlap handling is intentionally asymmetric: inviting a guest over an existing mail contact is allowed, but contact creation must block if a Graph guest already owns that email. Treat SMTP as an overlap signal, not the canonical identity key.
- `src/renderer/components/ui/**` has intentional `@typescript-eslint/no-unsafe-*` rule relaxations; do not copy that loosened standard into the rest of the repo.
