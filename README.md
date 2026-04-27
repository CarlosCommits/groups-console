<p align="center">
  <img src="logos/Groups%20Console%20logo%20design%20concept%202%20bottom-trimmed.png" alt="Groups Console logo" width="270">
</p>

<h1 align="center">Groups Console</h1>

<p align="center">
  Windows-first Electron desktop app for Exchange Online and Microsoft Graph administration.
</p>

<p align="center">
  <strong>Electron v2 desktop app</strong> &middot; Exchange Online &middot; Microsoft Graph &middot; Local diagnostics
</p>

> Status: this repository is the current Electron v2 app.

![Groups Console dashboard](images/Dashboard%20image%20rounded.png)

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

| Layer | Responsibility |
| --- | --- |
| Renderer | React UI running in a sandboxed Electron renderer |
| Preload | Narrow typed `window.groupsConsole` bridge |
| Main process | Orchestration, dialogs, logging, diagnostics, and Graph integration |
| Exchange layer | App-owned PowerShell worker/session host for Exchange Online operations |
| Shared contracts | Zod-validated DTOs and IPC contracts under `src/shared/**` |

Exchange remains the write path for distribution lists, mail-enabled security groups, and Exchange contacts. Microsoft Graph is used for guest-user lifecycle and selected directory reads.

## Requirements

### Workstation requirements

| Requirement | Notes |
| --- | --- |
| Windows admin workstation | `win32` is the supported runtime target |
| Windows PowerShell 5.1 | Preferred Exchange runtime |
| PowerShell 7 (`pwsh`) | May be usable, but Windows PowerShell 5.1 is preferred |
| Internet access | Required for Microsoft 365 and Microsoft Graph endpoints |
| Writable app-data directory | Required for logs and local config |

### Required PowerShell module

- `ExchangeOnlineManagement` must be installed and importable for the detected PowerShell runtime

The app checks for the module at startup/readiness time. If it is missing, the auth panel can offer an `Install Exchange module` action that installs `ExchangeOnlineManagement` for the current Windows user through the app-owned main-process/PowerShell worker path. If the module is installed but not importable, the app blocks Exchange sign-in and shows the import error with IT remediation guidance.

The current v2 app no longer depends on `ImportExcel` at runtime. Report export is generated on the JavaScript/Electron side.

### Tenant / app requirements

This app uses the bundled publisher-owned multi-tenant Microsoft Entra app registration and can sign operators into any organizational Microsoft Entra tenant that has authorized the app.

You will need:

- tenant-admin consent for the bundled Enterprise Application / service principal in the target tenant
- delegated Graph consent for the scopes your tenant will use
- an operator account that can both connect to Exchange Online PowerShell and perform the intended Graph operations

## Tenant authorization

Groups Console does not require each tenant to create its own app registration for normal use. The repo ships with `config/tenant.json`, which points at the publisher-owned multi-tenant Microsoft Entra app registration.

Groups Console uses delegated, interactive, system-browser-based Graph authentication through `@azure/msal-node`.

For a tenant to use Graph-backed workflows, a tenant admin must authorize the app in that tenant. That creates the tenant-local Enterprise Application / service principal for the bundled multi-tenant app registration. Customer tenants should not create client secrets or certificates for this desktop app.

If you do not override scopes, the app requests these delegated Graph scopes by default:

- `User.Read`
- `User.Read.All`
- `User.ReadWrite.All`
- `User.Invite.All`

In many tenants, granting these scopes will require tenant-admin consent.

### What the app can and cannot pre-validate

The app can verify:

- bundled or user-data tenant config exists and parses
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

## Bootstrap and readiness checks

The app's local readiness model depends on four checks:

| Check | Purpose |
| --- | --- |
| `powershell` | Confirms a supported PowerShell runtime is available |
| `exchangeModule` | Confirms `ExchangeOnlineManagement` is installed and importable |
| `logDirectory` | Confirms the app can write local diagnostics |
| `tenantConfig` | Confirms tenant configuration exists and parses |

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

## Development

Developer setup, scripts, verification commands, and architecture references live in [DEVELOPMENT.md](DEVELOPMENT.md).

Release versioning, git tags, GitHub Release assets, and distribution guidance live in [docs/release.md](docs/release.md).

## Supported workflow boundaries

| Area | Current stance |
| --- | --- |
| Exchange-backed group administration | Supported |
| Graph-backed guest workflows | Supported |
| Contact / guest SMTP overlap handling | Supported with asymmetric safety rules |
| Local diagnostics and supportability | Supported |
| Authentication model | Delegated interactive auth only |
| Server-hosted orchestration | Not in scope |
| Graph writes for distribution lists or mail-enabled security groups | Not in scope |
| SMTP as canonical identity key | Not assumed |
