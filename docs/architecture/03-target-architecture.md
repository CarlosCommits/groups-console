# 03. Target Architecture

## Purpose

Describe the v2 system structure and the boundaries between UI, orchestration, Exchange execution, and Graph integration.

## Architecture principles

- thin desktop shell, not a server product
- keep privileged operations outside the renderer
- normalize data before it crosses IPC
- prefer explicit commands over generic scripting
- optimize for admin clarity, auditability, and low deployment friction

## Topology

### Renderer

- React-based UI with shadcn/ui components
- no Node integration; renderer behaves like a browser surface, not a privileged desktop process
- no direct PowerShell access
- receives typed DTOs and progress events only

### Preload

- minimal `contextBridge` API
- zod or equivalent schema validation for all outgoing requests
- no raw `ipcRenderer` exposure
- exposes only narrow app-owned methods such as group membership actions, guest search, and export commands

### Main process

- trusted orchestrator
- owns app state relevant to sessions and jobs
- routes commands to either Exchange worker or Graph adapter
- manages file dialogs, log writing, update checks, and diagnostics bundle creation
- holds privileged integrations: Graph auth/calls, PowerShell worker launches, and export file writing

### Exchange worker

- PowerShell execution layer launched by the main process
- uses named scripts/functions only
- accepts structured input and emits structured JSON
- owns Exchange Online connection lifecycle and Exchange-specific operations

### Graph adapter

- TypeScript/Node integration path for guest-user operations
- uses delegated interactive auth via system browser flow
- normalizes Graph objects into app DTOs
- is invoked by the trusted Electron main/backend layer, never directly by the renderer

## Proposed repo structure for implementation

```text
src/
  main/
    app/
    auth/
    commands/
    exchange/
    graph/
    ipc/
    jobs/
    logging/
  preload/
  renderer/
    app/
    components/
    features/
    hooks/
    routes/
    state/
  shared/
    contracts/
    dto/
    validation/
powershell/
  bootstrap/
  modules/
    GroupsConsole.Exchange.psm1
    GroupsConsole.Validation.psm1
  commands/
    connect-exchange.ps1
    get-groups.ps1
    get-group-members.ps1
    add-group-member.ps1
    remove-group-member.ps1
    create-contact.ps1
    update-contact-company.ps1
    export-report-data.ps1
docs/
```

## UI surface

### Primary screens

1. Dashboard / connection status
2. Groups workspace
3. Directory workspace
4. Reports / exports
5. Settings / diagnostics

### Workspace model

- **Groups** is the primary operational workspace and contains both group browsing and membership editing.
- **Directory** is the unified people/recipient workspace and replaces separate top-level Contacts, Guests, and Recipients pages.
- `recipients.search` is a shared backend capability, not a separate primary destination.
- Contacts and guests should appear as filtered modes or tabs inside Directory rather than separate top-level pages.

### UX expectations

- searchable lists
- batch selection where appropriate
- explicit dry-run or preflight messaging before writes
- clear distinction between success, partial success, and blocked operations
- first-class bulk membership workflow: select one subject, select many groups, review changes, then execute with per-group results
- one unified recipient search surface with a single results table and explicit Type and Source columns
- type-aware actions inside Directory so contact and guest workflows remain focused without fragmenting navigation

## Job model

Every operation is treated as a job with:

- correlation ID
- operation type
- started/updated/completed timestamps
- progress events
- final success or error envelope

Long-running reads and exports must stream progress to the renderer. Cancellation is best-effort: the UI can request cancel, the main process can terminate worker execution if safe.

## Data normalization

Backend-specific payloads are converted into app-owned DTOs before IPC.

Example normalized recipient shape:

```ts
type RecipientRef = {
  source: 'exchange' | 'graph'
  objectId: string
  recipientType: 'distributionList' | 'mailEnabledSecurityGroup' | 'mailContact' | 'guestUser' | 'mailbox'
  primaryEmail: string | null
  displayName: string
  companyName?: string | null
  companySource?: 'exchangeCompany' | 'graphUserCompany' | 'none'
  externalDirectoryObjectId?: string | null
}
```

## Recommended design choices

- use JavaScript Excel generation to remove `ImportExcel` from the runtime path
- keep Exchange commands coarse-grained and use app-owned command names rather than raw cmdlet names in IPC
- serialize writes per target object to avoid conflicting concurrent mutations
- keep Graph and token-handling logic in main/backend rather than in the renderer

## Deferred architectural features

- background scheduled jobs
- shared team queue or approval flows
- central service/orchestrator
- multi-tenant profile switching

## Acceptance criteria

- The role of each process is explicit.
- The architecture prevents renderer-side privileged execution.
- The plan supports current v1 parity plus guest and mail-enabled security group expansion.
