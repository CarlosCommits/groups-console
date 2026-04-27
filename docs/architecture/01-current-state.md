# 01. Prototype State Assessment

## Purpose

Document how the original PowerShell prototype worked so v2 preserves the useful behavior, removes the risky parts, and avoids accidental regressions.

## Historical Repository Shape

- one monolithic PowerShell script
- user-facing setup and usage notes

## Historical Workflows

### Startup

The original script:

1. printed ASCII branding
2. checked execution policy and set `RemoteSigned` for the current user
3. installed `ExchangeOnlineManagement` if missing
4. installed `ImportExcel` if missing
5. prompted for an email address
6. connected to Exchange Online interactively
7. showed a console menu loop

### Supported Actions In V1

1. Generate a distribution-list report
2. Add a contact to multiple distribution lists
3. Create a new mail contact
4. Update contact company values from an Excel file

## Exchange Cmdlets In V1 Use

- `Connect-ExchangeOnline`
- `Disconnect-ExchangeOnline`
- `Get-DistributionGroup`
- `Get-DistributionGroupMember`
- `Add-DistributionGroupMember`
- `Get-MailContact`
- `Get-Mailbox`
- `Get-Contact`
- `New-MailContact`
- `Set-Contact`

## Historical UI/UX Characteristics

- console-driven menu via `Write-Host` and `Read-Host`
- one Windows GUI selection step via `Out-GridView`
- one Windows GUI file picker via `System.Windows.Forms.OpenFileDialog`
- progress only in the report flow via `Write-Progress`
- mail notification used `mailto:` launch rather than app-owned message composition

## Historical Technical Problems

### Monolithic Implementation

UI, validation, orchestration, Exchange calls, Excel handling, and error output were all in one file. There was no module system, no typed contract boundary, and no reusable service layer.

### Unsafe Environment Behavior

The script changed execution policy during startup. v2 must not do this. Runtime invocation should be self-contained and local to the process.

### Windows-Only Control Dependencies

`Out-GridView` and `OpenFileDialog` were embedded in business workflows. They moved into Electron UI and main-process dialog APIs.

### Identity Ambiguity

The report and group-add flows keyed heavily off `PrimarySmtpAddress`. That is insufficient for guest-user support because the same external email may be represented by multiple object types across systems.

### Missing Operational Protections

- minimal error handling
- no structured logs
- no audit trail under app control
- no tenant pinning
- no preflight conflict model
- no job model for long-running operations

## Natural V2 Split Points

### Move To Electron UI

- menu/navigation
- forms
- group selectors
- file dialogs
- progress indicators
- confirmations
- error presentation
- report download/export UX

### Move To PowerShell Worker Modules

- Exchange connection lifecycle
- distribution group reads/writes
- mail-enabled security group reads/writes
- mail contact create/update
- Exchange-side recipient lookup and preflight checks

### Move To TypeScript Main-Process Adapters

- Graph guest operations
- app logging
- job orchestration
- IPC validation
- report file writing with JavaScript libraries

## Migration Implications

- v2 should preserve the administrator mental model: sign in, browse entities, inspect details, run a workflow, see a clear result.
- v2 should not preserve the prototype implementation shape.
- report generation should no longer depend on `ImportExcel`; JavaScript-side export is lower-friction.
- Exchange-only features should stay close to the Exchange cmdlets so behavior remains predictable.

## Acceptance Criteria

- The v2 plan clearly identifies what behavior is preserved from v1.
- Every historical Windows UI dependency has a replacement strategy.
- Every historical PowerShell responsibility has a target home in v2.
