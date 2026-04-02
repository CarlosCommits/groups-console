# 01. Current State Assessment

## Purpose

Document how Groups Console works today so v2 preserves the useful behavior, removes the risky parts, and avoids accidental regressions.

## Current repository shape

- `groups-console.ps1` — single monolithic PowerShell script
- `README.md` — user-facing setup and usage notes

## Current workflows

### Startup

The script currently:

1. prints ASCII branding
2. checks execution policy and sets `RemoteSigned` for the current user
3. installs `ExchangeOnlineManagement` if missing
4. installs `ImportExcel` if missing
5. prompts for an email address
6. connects to Exchange Online interactively
7. shows a console menu loop

### Supported actions in v1

1. Generate a distribution-list report
2. Add a contact to multiple distribution lists
3. Create a new mail contact
4. Update contact company values from an Excel file

## Exchange cmdlets in current use

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

## Current UI/UX characteristics

- console-driven menu via `Write-Host` and `Read-Host`
- one Windows GUI selection step via `Out-GridView`
- one Windows GUI file picker via `System.Windows.Forms.OpenFileDialog`
- progress only in the report flow via `Write-Progress`
- mail notification uses `mailto:` launch rather than app-owned message composition

## Current technical problems

### Monolithic implementation

UI, validation, orchestration, Exchange calls, Excel handling, and error output are all in one file. There is no module system, no typed contract boundary, and no reusable service layer.

### Unsafe environment behavior

The script changes execution policy during startup. v2 must not do this. Runtime invocation should be self-contained and local to the process.

### Windows-only control dependencies

`Out-GridView` and `OpenFileDialog` are embedded in business workflows. They must move into Electron UI and main-process dialog APIs.

### Identity ambiguity

The report and group-add flows key heavily off `PrimarySmtpAddress`. That is insufficient for future guest-user support because the same external email may be represented by multiple object types across systems.

### Missing operational protections

- minimal error handling
- no structured logs
- no audit trail under app control
- no tenant pinning
- no preflight conflict model
- no job model for long-running operations

## Natural v2 split points

### Move to Electron UI

- menu/navigation
- forms
- group selectors
- file dialogs
- progress indicators
- confirmations
- error presentation
- report download/export UX

### Move to PowerShell worker modules

- Exchange connection lifecycle
- distribution group reads/writes
- mail-enabled security group reads/writes
- mail contact create/update
- Exchange-side recipient lookup and preflight checks

### Move to TypeScript main-process adapters

- Graph guest operations
- app logging
- job orchestration
- IPC validation
- report file writing with JavaScript libraries

## Migration implications

- v2 should preserve the current administrator mental model: sign in, browse entities, inspect details, run a workflow, see a clear result.
- v2 should not preserve the current implementation shape.
- report generation should no longer depend on `ImportExcel`; JavaScript-side export is lower-friction.
- Exchange-only features should stay close to the current Exchange cmdlets so behavior remains predictable.

## Acceptance criteria

- The v2 plan clearly identifies what behavior is preserved from v1.
- Every current Windows UI dependency has a replacement strategy.
- Every current PowerShell responsibility has a target home in v2.
