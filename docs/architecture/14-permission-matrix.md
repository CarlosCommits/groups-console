# 14. Permission Matrix

## Purpose

Formalize the runtime permissions, prerequisites, and denial behavior for every supported workflow in Groups Console v2. This document answers the question: when authentication succeeds but the operation still fails, what happened and what should the app surface?

This matrix is required by `04-security-model.md` and is informed by the ownership rules in `02-scope-capability-matrix.md` and the integration boundary in `05-exchange-graph-integration.md`.

## Scope

This document covers the current implemented command surface. Deferred operations are listed separately and are not part of the permission matrix until they are implemented.

## Shared prerequisites

These are the global conditions the app should evaluate before presenting a ready state. Backend-specific session requirements are listed in the Graph and Exchange sections below.

| Prerequisite | Check | Failure behavior |
|---|---|---|
| Tenant configuration present and valid | Bootstrap check: `tenantConfig` | App shows missing-config message; no backend calls attempted |
| Writable log directory | Bootstrap check: `logDirectory` | App shows directory error; local logging and diagnostics are not ready |

Both sessions must be valid for the same tenant before the app presents a fully connected state. If only one side is connected, the UI must show degraded capability, not false readiness. This is consistent with the session coordination rule in `05-exchange-graph-integration.md`.

## Exchange Online prerequisites

Exchange Online PowerShell operations require a specific local and account environment.

| Prerequisite | Check | Failure behavior |
|---|---|---|
| Supported Windows workstation | Bootstrap check: `powershell` | App shows unsupported-host message; Exchange operations unavailable |
| PowerShell runtime available | Bootstrap check: `powershell` | App shows missing-runtime message; Exchange operations unavailable |
| Windows PowerShell 5.1 preferred | Bootstrap check: `powershell` | If only PowerShell 7 is found, app shows warning; some Exchange module behavior may differ |
| ExchangeOnlineManagement installed | Bootstrap check: `exchangeModule` | App shows module-not-found message; Exchange operations unavailable |
| ExchangeOnlineManagement importable | Bootstrap check: `exchangeModule` | App shows import error detail; Exchange operations unavailable |
| Process-scoped execution policy permits worker scripts | Bootstrap check: `powershell` | App surfaces a clear prerequisite message; does not change user or machine policy |
| Account allowed to use Exchange Online PowerShell | Operation-time: Exchange connection attempt | Connection fails with Exchange-side error; app surfaces the error |

The app handles execution policy at process scope only. It does not require local admin rights or machine-wide execution policy changes. If MachinePolicy or UserPolicy blocks execution, the app surfaces a clear prerequisite error rather than silently mutating policy. This follows the stance in `05-exchange-graph-integration.md` and `09-packaging-deployment.md`.

## Graph guest workflows

Graph operations use delegated interactive auth via system browser flow. The configured Graph scope set is requested at connection time. If tenant config does not override it, the default scope set is `User.Read`, `User.Read.All`, `User.ReadWrite.All`, and `User.Invite.All`.

Graph-owned workflows require a valid Graph session for the configured tenant. If Graph is disconnected or tenant-mismatched, Graph workflows are unavailable even if Exchange is connected.

| Workflow | IPC command | Delegated scope requirement | Additional considerations |
|---|---|---|---|
| Guest search | `guests.search` | Directory read scope (covered by `User.Read.All`) | The operator must be allowed to read directory users in the configured tenant |
| Guest invite | `guests.invite` | `User.Invite.All` | Tenant invitation policy or operator role may also restrict who can invite; the app cannot pre-validate this |
| Guest company update | `guests.updateCompany` | `User.ReadWrite.All` (practical delegated requirement for updating other users) | Updating another user's profile requires delegated write scope; tenant admin role or conditional access policy may also apply |

### Notes on Graph scope and role ambiguity

The app requests its configured Graph scope set at connection time. Even when sign-in succeeds, a permission requirement or tenant policy may still block a specific operation at runtime. The app cannot reliably introspect the token to determine which scopes were actually consented to or which Entra roles the operator holds.

This means:

- Scope consent is verified at operation time, not at connection time.
- Entra directory role requirements (such as Guest Inviter role or specific admin roles) are enforced by the Graph API and are not pre-checked by the app.
- If auth succeeds but the operation is denied, the app must surface the Graph error and classify it as an authorization failure, not a connection failure.

## Exchange recipient and group workflows

Exchange Online PowerShell operations are subject to Exchange RBAC role assignments. The app cannot pre-check exact RBAC role membership.

Exchange-owned workflows require a valid Exchange session for the configured tenant. If Exchange is disconnected or tenant-mismatched, Exchange workflows are unavailable even if Graph is connected.

| Workflow | IPC command | Likely RBAC requirement | Additional considerations |
|---|---|---|---|
| List groups | `exchange.listGroups` | Exchange view-only recipient management or similar read role | Read operations generally require lower privilege |
| Get group members | `groups.getMembers` | Exchange view-only recipient management or similar read role | Read operations generally require lower privilege |
| Add group members | `groups.addMembers` | Distribution group membership management or similar write role | Group owner restrictions and bypass rules may apply; some groups restrict who can add members |
| Remove group members | `groups.removeMembers` | Distribution group membership management or similar write role | Same owner and bypass considerations as add |
| Recipient search | `recipients.search` | Exchange view-only recipient management or similar read role | Combines Exchange and Graph sources |
| Create contact | `contacts.create` | Exchange recipient-creation role (likely Mail Recipient Creation) | Preflight checks for SMTP conflict should run before creation attempt |
| Update contact company | `contacts.updateCompany` | Exchange mail-recipient management role (likely Mail Recipients) | Operates on existing contact objects only |
| Get Exchange capabilities | `exchange.getCapabilities` | None beyond local runtime/bootstrap access | Returns runtime and module metadata, not a mutation |

### Notes on Exchange RBAC ambiguity

Exchange Online uses role-based access control with role groups that vary by tenant configuration. The role group names and assignments listed above are the most common and likely requirements, but they are not universally guaranteed. A tenant administrator may have customized role assignments.

The app cannot enumerate the operator's Exchange RBAC assignments at runtime. If an Exchange operation fails with a permissions error, the app must:

1. classify the error as an authorization failure, not a connection failure
2. surface the Exchange error message to the operator
3. suggest that the operator verify their role assignments with their tenant administrator

### Distribution list and mail-enabled security group ownership rules

Distribution lists and mail-enabled security groups may have owner restrictions. Some groups are configured so that only designated owners or managers can modify membership. The app does not pre-check ownership constraints. If an add-member or remove-member operation is denied because the operator is not an authorized manager, the Exchange API returns an error that the app must surface as an authorization failure.

Mail-enabled security groups are Exchange-only. Graph is not the write path for MESG operations. This is consistent with the ownership boundary in `05-exchange-graph-integration.md`.

## Denial behavior

When authentication succeeds but an operation is denied due to insufficient permissions, the app must distinguish this from other failure categories.

### Failure classification

| Failure category | Source | App behavior |
|---|---|---|
| Connection failure | Graph or Exchange session cannot be established | Show connection error; offer reconnect |
| Authorization failure | Auth succeeds but operation is denied by API | Show specific permission error; suggest role or policy verification; do not retry without operator action |
| Preflight conflict | Validation detects overlap or duplicate before write | Block the operation; present conflict explanation per `07-validation-conflicts.md` |
| Partial success | Batch operation where some items succeed and others fail | Show per-item results and any available backend detail; do not collapse the entire batch into a single generic failure |
| Tenant mismatch | Graph and Exchange sessions are for different tenants | Block all writes; show tenant mismatch message; require reconnect |

### Authorization failure handling

Authorization failures must not be silently retried. The app should:

1. log the failure with correlation ID, operation name, and the backend error code
2. present a human-readable message that identifies the operation and the likely cause
3. suggest that the operator verify their role assignments or contact their tenant administrator
4. not attempt the same operation again without explicit operator action

### Graph-specific denial patterns

- `403 Forbidden` from Graph typically indicates missing scope consent or insufficient directory role.
- The app should not assume that a successful token acquisition implies all requested scopes are usable.

### Exchange-specific denial patterns

- Exchange PowerShell errors referencing role assignments or management roles indicate RBAC restrictions.
- Errors referencing group ownership or manager restrictions indicate that the operator is not an authorized manager for that group.
- The app should not assume that a successful connection implies all Exchange operations are permitted.

## What the app can and cannot check

### Can check at bootstrap or connection time

- PowerShell runtime presence and version
- ExchangeOnlineManagement module presence and importability
- Effective execution policy
- Log directory writability
- Tenant configuration presence and validity
- Graph connection status and tenant identity
- Exchange connection status and tenant identity

### Cannot check at this time

- Exact Entra directory role membership for the operator
- Exact Exchange RBAC role assignments for the operator
- Which Graph scopes were actually consented to in the current token
- Whether a specific group allows the operator to modify membership
- Whether tenant invitation policy permits guest invitations

These are operation-time authorization concerns. The app must handle them as runtime errors and surface actionable remediation guidance rather than attempting pre-validation.

## Deferred areas

The following permission-related areas are not yet in scope and should not be assumed to be implemented:

- Report and export backend: `reports.generateMembershipMatrix` is not yet implemented; its permission requirements will be documented when the backend is built.
- Guest-aware membership execution path: guest candidates currently return `graphDeferred` at the resolution layer; the bridge from Graph guest to Exchange membership target is not yet complete.
- Guest/contact overlap-safe enforcement: cross-system conflict checks are not yet consistently enforced in `contacts.create` and `guests.invite`.
- Contact and guest detail read surfaces: dedicated `contacts.getDetails` and `guests.getDetails` commands are not yet implemented.
- Internal user company sourcing alignment: current implementation sources internal user company from Exchange `Get-User` data; the plan calls for Graph `user.companyName` as the source. This is a consistency gap, not a permission gap.
- Exact scope or role introspection: the app does not currently inspect token claims or query RBAC assignments. If this becomes important, it would require additional Graph or Exchange API calls that are not yet designed.

## Acceptance criteria

- Every implemented workflow has a documented permission or prerequisite requirement in this matrix.
- Authorization failures are classified separately from connection failures and preflight conflicts.
- The app does not claim to pre-check Entra roles, Exchange RBAC, or token scope consent.
- Graph is not listed as the write path for distribution list or mail-enabled security group operations.
- Exchange role group names are described as likely requirements, not as universally mandatory guarantees.
- The app does not require local admin rights or machine-wide execution policy changes.
- Deferred items are listed without implying they are currently implemented.
