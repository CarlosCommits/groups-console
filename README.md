# Groups Console

Windows-first Electron desktop app for Exchange Online and Microsoft Graph administration.

> Status: this repository is the current Electron v2 app. The legacy `groups-console.ps1` script is still in the repo for reference, but it is not the primary active workflow anymore.

## What it does today

Groups Console currently supports:

- Exchange group browsing for distribution lists and mail-enabled security groups
- Group membership reads and membership add/remove flows
- Unified directory search across Exchange and Graph-backed identities
- Contact creation and contact company updates
- Guest search, guest invite, and guest company updates
- Membership matrix export to `.xlsx`
- Local system logs and diagnostics export

The app is still evolving. It is already useful for real tenant workflows, but the project is not yet presented as a finished general-availability product.

## Architecture at a glance

- **Renderer:** React UI running in a sandboxed Electron renderer
- **Preload:** narrow typed `window.groupsConsole` bridge
- **Main process:** orchestration, dialogs, logging, diagnostics, Graph integration
- **Exchange layer:** app-owned PowerShell worker/session host for Exchange Online operations
- **Shared contracts:** Zod-validated DTOs and IPC contracts under `src/shared/**`

Exchange remains the write path for distribution lists, mail-enabled security groups, and Exchange contacts. Microsoft Graph is used for guest-user lifecycle and selected directory reads.

## Requirements

### Workstation requirements

- Windows admin workstation (`win32` is the supported runtime target)
- Windows PowerShell 5.1 preferred
- PowerShell 7 (`pwsh`) may be usable, but the app currently treats Windows PowerShell 5.1 as the preferred Exchange runtime
- Internet access to Microsoft 365 / Microsoft Graph endpoints
- Writable local app-data directory for logs and config

### Required PowerShell module

- `ExchangeOnlineManagement` must be installed and importable for the detected PowerShell runtime

The app checks for the module at startup/readiness time. If it is missing, the auth panel can offer an `Install Exchange module` action that installs `ExchangeOnlineManagement` for the current Windows user through the app-owned main-process/PowerShell worker path. If the module is installed but not importable, the app blocks Exchange sign-in and shows the import error with IT remediation guidance.

The current v2 app no longer depends on `ImportExcel` at runtime. Report export is generated on the JavaScript/Electron side.

### Tenant / app requirements

This app uses one multi-tenant Microsoft Entra app registration and can sign operators into any organizational Microsoft Entra tenant that has authorized the app.

You will need:

- a multi-tenant Entra app registration client ID for delegated desktop/public-client Graph sign-in
- an invitation redirect URL for guest invite flows
- delegated Graph consent for the scopes your tenant will use
- an operator account that can both connect to Exchange Online PowerShell and perform the intended Graph operations

## Microsoft tenant setup

### 1. Create or choose a multi-tenant Entra app registration

Groups Console uses delegated, interactive, system-browser-based Graph authentication through `@azure/msal-node`.

The app registration should be configured as:

- Supported account types: **Accounts in any organizational directory**
- Platform: **Mobile and desktop applications**
- Redirect URI: `http://localhost`
- Public client flow enabled
- No client secret or certificate for the desktop app

Your tenant config supplies:

- `graph.clientId`
- `graph.inviteRedirectUrl`
- optional `graph.authorityHost`
- optional `graph.authorityTenant`
- optional `graph.allowedTenantIds`
- optional `graph.scopes`

If you do not override scopes, the app requests these delegated Graph scopes by default:

- `User.Read`
- `User.Read.All`
- `User.ReadWrite.All`
- `User.Invite.All`

In many tenants, granting these scopes will require tenant-admin consent.

The normal distribution model is one app registration owned by the publisher and one Enterprise Application/service principal created in each customer tenant when a tenant admin grants consent. Customer tenants should not create client secrets for this desktop app.

### 2. Understand what the app can and cannot pre-validate

The app can verify:

- tenant config exists and parses
- Exchange tenant matches the active Graph tenant for write-safe workflows
- local PowerShell/module prerequisites

If `tenantId` or `graph.allowedTenantIds` is configured, the app can also verify that the signed-in Graph tenant is allowed by local configuration. Without those optional pins, any organizational tenant can sign in once that tenant has authorized the app.

The app cannot reliably pre-check:

- exact Entra directory roles held by the operator
- exact Graph scopes actually consented in the current token
- exact Exchange RBAC assignments
- tenant invitation policy behavior for every guest-invite scenario
- per-group ownership/manager restrictions before every Exchange write

If sign-in succeeds but an operation is denied, the app treats that as an authorization/runtime error and surfaces the backend failure instead of pretending the environment is ready.

## Operator permissions

For full operator access in the current app, the practical role set is:

- **Exchange Recipient Administrator** for Exchange Online recipient work, including contacts, recipient lookup, distribution group membership, and mail-enabled security group membership changes.
- **Microsoft Entra User Administrator** for Microsoft Graph guest work, including guest invitations and guest profile updates.
- Tenant-admin consent for the delegated Microsoft Graph scopes requested by the app: `User.Read`, `User.Read.All`, `User.ReadWrite.All`, and `User.Invite.All`.

This is the clean built-in-role answer for an operator who should be able to use every current app workflow. More restrictive setups may be possible with custom Exchange RBAC and tenant-specific Entra policy, but they need to be validated in the target tenant.

### Microsoft Graph side

For the current guest workflows, the repo documents these practical delegated requirements:

- **Guest search:** directory read capability, typically covered by `User.Read.All`
- **Guest invite:** `User.Invite.All`, plus whatever tenant invitation policy or Entra role rules your tenant enforces
- **Guest company update:** `User.ReadWrite.All` in practice for updating other users, plus any tenant role/policy requirements

The exact Entra role model varies by tenant. Do not assume a universal built-in role name will always be sufficient.

### Exchange side

Exchange operations require Exchange Online PowerShell access plus the RBAC rights needed for the specific action.

Likely requirements include:

- read-oriented Exchange roles for listing groups, reading members, and recipient search
- write-oriented Exchange roles for adding/removing group members
- recipient-management roles for creating contacts and updating contact company fields

These are **likely** requirements, not guaranteed universal role group names. Exchange RBAC differs by tenant customization.

## Local configuration

### `tenant.json`

The tenant config schema is:

```json
{
  "graph": {
    "clientId": "<multi-tenant-entra-app-client-id>",
    "inviteRedirectUrl": "https://www.microsoft365.com",
    "authorityHost": "https://login.microsoftonline.com",
    "authorityTenant": "organizations",
    "allowedTenantIds": [
      "<optional-tenant-allowlist-entry>"
    ],
    "scopes": [
      "User.Read",
      "User.Read.All",
      "User.ReadWrite.All",
      "User.Invite.All"
    ]
  }
}
```

Notes:

- `authorityHost` is optional
- `authorityTenant` is optional; if omitted, the app uses `tenantId` for legacy pinned configs or `organizations` for multi-tenant configs
- `tenantId` is optional legacy tenant pinning; omit it for normal multi-tenant sign-in
- `allowedTenantIds` is optional; use it only when you want the local installation to reject tenants outside a known allowlist
- If `authorityTenant` is set to `organizations` while `tenantId` or `allowedTenantIds` is also configured, sign-in can show the broad organizational account picker but the app will still reject tenants outside the local pin or allowlist after Graph returns the tenant identity
- `scopes` is optional; if omitted, the app uses the default scope set above
- `inviteRedirectUrl` is used for guest invitation flows; override it in user-data config if your tenant wants guests returned to a tenant-specific landing page after invite redemption

Location rules:

- The app first looks for `tenant.json` under the app user-data config directory.
- If that file is not present, the app uses the bundled `config/tenant.json`, which contains the publisher-owned multi-tenant app registration client ID.
- A user-data `tenant.json` is only needed when an operator wants to override scopes, authority host, invite redirect URL, or add local tenant allowlisting.

## Bootstrap and readiness checks

The app’s local readiness model depends on four checks:

- `powershell`
- `exchangeModule`
- `logDirectory`
- `tenantConfig`

If any of these are missing or degraded, the app should show that state instead of pretending it is fully ready.

The auth panel uses these checks before Exchange sign-in. It can block Exchange setup when PowerShell is missing, offer the current-user `ExchangeOnlineManagement` install action when the module is missing, and surface installed-but-not-importable module failures without trying to connect Exchange.

Tenant mismatch also matters: the app is designed to block writes when Graph and Exchange are connected to different tenants. Multi-tenant Graph sign-in does not loosen that safety check.

## Security and runtime model

Security constraints are intentional, not accidental:

- `contextIsolation: true`
- `sandbox: true`
- `nodeIntegration: false`
- renderer code cannot directly import Node/Electron privileged modules
- PowerShell execution is allowlisted and app-owned; the UI does not send free-form PowerShell
- the app does not collect or store admin passwords
- Graph auth uses system-browser interactive flow
- production packaging is intended to be code-signed

Execution policy stance:

- the app launches its PowerShell workers with **process-scoped** execution policy handling
- the app does **not** require machine-wide or user-wide execution policy changes as a normal setup step
- if `MachinePolicy` or `UserPolicy` blocks execution, the app should surface a prerequisite error instead of mutating policy silently
- the module install remediation path must not call persistent `Set-ExecutionPolicy`

## Development setup

```bash
npm install
npm start
```

Available scripts:

- `npm start` — start the Electron Forge dev app
- `npm run lint` — run ESLint
- `npm run lint:fix` — auto-fix lintable issues
- `npm run typecheck` — run the three TypeScript projects (`main`, `preload`, `renderer`)
- `npm run test` — run Vitest for `src/**/*.test.ts`
- `npm run test:watch` — run Vitest in watch mode
- `npm run package` — package the app with Electron Forge
- `npm run make` — build distributables

Notes:

- packaging is currently based on **Electron Forge**, not `electron-builder`
- packaged PowerShell assets are shipped via Forge `extraResource`
- the renderer is browser-like by design; add privileged behavior through preload/main, not by importing Node APIs in `src/renderer/**`
- on some Linux development hosts, Electron startup can fail if the local `chrome-sandbox` helper is not configured correctly; treat that as an environment issue and do not weaken the app sandbox/security settings to work around it

## Verification expectations for contributors

For changes that affect code behavior, the normal verification baseline is:

```bash
npm run lint
npm run typecheck
npm run test
```

The repo’s Vitest config currently targets `src/**/*.test.ts`. Playwright is present in the repo, but it is not wired into the default `npm test` script.

## Supported workflow boundaries

Current scope is centered on:

- Exchange-backed group administration
- Graph-backed guest workflows
- overlap-safe handling when contacts and guests share the same SMTP address
- local diagnostics and supportability

Notable constraints:

- delegated interactive auth only
- no server-hosted orchestration
- no Graph write path for distribution lists or mail-enabled security groups
- no assumption that SMTP alone is the canonical identity key

## Legacy note

The repo still contains `groups-console.ps1` and legacy architecture references because the project evolved from a PowerShell script into a desktop app. For current development and future open-source onboarding, use the Electron v2 workflow described above.

## Further reading

- `docs/architecture/03-target-architecture.md`
- `docs/architecture/04-security-model.md`
- `docs/architecture/05-exchange-graph-integration.md`
- `docs/architecture/09-packaging-deployment.md` *(some packaging details are historical; the live repo uses Electron Forge)*
- `docs/architecture/11-test-strategy.md`
- `docs/architecture/14-permission-matrix.md`
- `docs/architecture/15-remaining-work-map.md`
