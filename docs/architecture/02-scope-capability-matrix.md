# 02. Scope and Capability Matrix

## Purpose

Define the exact v2 scope and the system of authority for every supported entity and operation.

## Assumptions

- Windows-first desktop application
- multi-tenant organizational use through one publisher-owned Entra app registration
- Exchange-admin-only users
- delegated interactive auth in v1

## Entity model

- Distribution List
- Mail-Enabled Security Group
- Mail Contact
- Guest User
- Mailbox / internal user (lookup and membership target only in v1)

## Capability matrix

| Entity | Operation | v2 status | Source of authority | Notes |
|---|---|---:|---|---|
| Distribution List | List/search | Yes | Exchange Online PowerShell | Graph is not the write path |
| Distribution List | Get details/members | Yes | Exchange Online PowerShell | Post-write verification also via EXO |
| Distribution List | Add/remove member | Yes | Exchange Online PowerShell | Includes preflight validation |
| Distribution List | Export report | Yes | EXO read + JS export | XLSX generated app-side |
| Distribution List | Create/update/delete | Deferred | Exchange Online PowerShell | Not required for v1 parity+ |
| Mail-Enabled Security Group | List/search | Yes | Exchange Online PowerShell | Graph may read but is not owner |
| Mail-Enabled Security Group | Get details/members | Yes | Exchange Online PowerShell | Consistent ownership rule |
| Mail-Enabled Security Group | Add/remove member | Yes | Exchange Online PowerShell | Core v2 expansion |
| Mail-Enabled Security Group | Export report | Yes | EXO read + JS export | Same export surface as DL |
| Mail-Enabled Security Group | Create/update/delete | Deferred | Exchange Online PowerShell | Architecture must support later |
| Mail Contact | List/search | Yes | Exchange Online PowerShell | Primary admin object in v1 |
| Mail Contact | Create | Yes | Exchange Online PowerShell | Includes SMTP/proxy preflight |
| Mail Contact | Display/export company | Yes | Exchange Online PowerShell | Source field is Exchange `Company` |
| Mail Contact | Update company | Yes | Exchange Online PowerShell | Preserves existing flow |
| Mail Contact | Update broader fields | Deferred | Exchange Online PowerShell | Future expansion |
| Guest User | List/search | Yes | Microsoft Graph | Core v2 expansion |
| Guest User | Get details | Yes | Microsoft Graph | Normalize into app DTOs |
| Guest User | Display/export company | Yes, when present | Microsoft Graph | Source field is Graph `user.companyName`; may be blank |
| Guest User | Create/invite | Yes | Microsoft Graph | Exchange visibility handled separately |
| Guest User | Update selected metadata | Yes | Microsoft Graph | Within documented Graph support |
| Guest User | Disable/delete | Deferred | Microsoft Graph | Out of first-release core scope |
| Mailbox/Internal User | Lookup for membership | Yes | Exchange Online PowerShell | Lookup target only |
| Mailbox/Internal User | Display/export company | Yes, when present | Microsoft Graph | Source field is Graph `user.companyName`; may be blank |

## Explicit non-goals for initial release

- simultaneous multi-tenant sessions inside one app window
- unattended scheduled jobs
- server-hosted orchestration
- in-app auto-update requirement
- full contact management beyond current parity and guest expansion
- Graph-based write operations for distribution lists or mail-enabled security groups

## Feature groupings for v2

### Parity features

- Distribution list reporting
- Add recipient to multiple distribution lists
- Create mail contact
- Bulk update company from spreadsheet

### Expansion features

- Search and export mail-enabled security groups
- Add/remove members on mail-enabled security groups
- Add or remove one recipient across many distribution lists or mail-enabled security groups
- Search guest users
- Create/invite guest users
- Handle guest/contact overlap safely

## Company-name source rules

- Mail contacts use Exchange Online `Company`.
- Guest users use Microsoft Graph `user.companyName`.
- Internal users use Microsoft Graph `user.companyName`.
- Blank company values remain blank in the UI and exports; the app does not infer company from email domain.

## Ownership rules

1. If the operation changes Exchange recipient state, default to Exchange Online PowerShell.
2. If the operation is guest-user lifecycle or supported directory metadata, default to Graph.
3. Reads should follow the same owner used for writes unless there is a strong reason not to.
4. The renderer never decides the owner; the main process routes by operation contract.

## Acceptance criteria

- Every supported operation has one documented source of authority.
- Unsupported Graph write paths are explicitly excluded.
- The first release scope is clear enough to drive backlog and test planning.
