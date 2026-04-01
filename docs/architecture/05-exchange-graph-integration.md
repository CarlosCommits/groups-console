# 05. Exchange Online and Graph Integration

## Purpose

Define the exact ownership boundary and runtime behavior between Exchange Online PowerShell and Microsoft Graph.

## Integration rule of thumb

If the change is fundamentally Exchange-recipient state, use Exchange Online PowerShell. If the change is guest-user lifecycle within documented Graph capability, use Graph.

## Confirmed ownership boundary

| Area | Owner |
|---|---|
| Distribution lists | Exchange Online PowerShell |
| Mail-enabled security groups | Exchange Online PowerShell |
| Exchange mail contacts | Exchange Online PowerShell |
| Guest-user lifecycle | Microsoft Graph |
| Directory reads supporting guest workflows | Microsoft Graph |

## Exchange worker responsibilities

- connect/disconnect Exchange Online
- search groups and recipients
- get group members
- add/remove group members
- create contacts
- update contact company
- produce normalized report data for exports

## Core Exchange operations to support first

- `Get-DistributionGroup`
- `Get-DistributionGroupMember`
- `Add-DistributionGroupMember`
- `Remove-DistributionGroupMember`
- `Get-MailContact`
- `Get-Contact`
- `New-MailContact`
- `Set-Contact`
- recipient lookup helpers as needed

## Graph responsibilities

- search guest users
- read guest-user profile details
- invite/create guest users
- update supported guest metadata

## Auth/session model

### Graph

- delegated interactive sign-in
- system browser flow only
- tenant pinned after sign-in

### Exchange

- delegated interactive sign-in through Exchange Online module
- no credential collection by the app
- tenant/account details retrieved after connection for verification

## Session coordination

The app should expose a single “connected” experience only when both conditions are true for the active operator:

1. Graph session is valid for the configured tenant
2. Exchange session is valid for the same tenant

If only one side is connected, the UI must show degraded capability, not false readiness.

## Post-write verification

Every mutation should include verification rules:

- Exchange writes are verified with Exchange reads from the same source of truth
- Graph writes are verified with Graph reads from the same source of truth
- verification timeout window is documented in UI and logs for eventual consistency cases

## Partial failure semantics

Two-system workflows must explicitly define failure modes. Example: create guest + update Exchange-facing visibility metadata is not one atomic transaction. The app must either:

- treat it as separate visible steps, or
- define compensating/manual-remediation guidance

## Data mapping rules

- normalize every returned object into app DTOs
- preserve backend-native IDs in metadata fields
- never use SMTP address alone as the canonical object identity

## Acceptance criteria

- There is no ambiguity about which backend owns each supported write.
- The app has a documented way to detect session mismatch and partial success.
- Unsupported Graph writes are excluded from the design.
