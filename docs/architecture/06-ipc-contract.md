# 06. IPC and Backend Contract

## Purpose

Define the application-owned command contract between renderer, preload, main process, and backend executors.

## Contract rules

- renderer sends typed requests only
- preload validates shape before forwarding
- main validates again before execution
- backend returns structured JSON only
- all requests and responses carry correlation IDs

## Request envelope

```ts
type CommandRequest<TPayload> = {
  requestId: string
  command: string
  issuedAt: string
  payload: TPayload
}
```

## Response envelope

```ts
type CommandResponse<TData> = {
  requestId: string
  success: boolean
  completedAt: string
  data?: TData
  error?: {
    code: string
    message: string
    retryable: boolean
    details?: string
  }
}
```

## Progress event envelope

```ts
type ProgressEvent = {
  requestId: string
  phase: 'preflight' | 'executing' | 'verifying' | 'complete'
  message: string
  percent?: number
}
```

## Renderer-visible command catalog

### Session

- `session.connectGraph`
- `session.connectExchange`
- `session.disconnectAll`
- `session.getStatus`

### Groups

- `groups.searchDistributionLists`
- `groups.searchMailEnabledSecurityGroups`
- `groups.getMembers`
- `groups.addMembers`
- `groups.removeMembers`

### Contacts

- `contacts.search`
- `contacts.create`
- `contacts.updateCompanyFromSpreadsheet`

### Guests

- `guests.search`
- `guests.invite`
- `guests.update`

### Reports

- `reports.generateMembershipMatrix`

## Backend routing rules

- commands beginning with `groups.` route to EXO worker unless explicitly guest-directory only
- commands beginning with `contacts.` route to EXO worker
- commands beginning with `guests.` route to Graph adapter
- `reports.generateMembershipMatrix` uses EXO reads and JS export

## Example write command

```ts
type AddMembersPayload = {
  group: {
    objectId: string
    recipientType: 'distributionList' | 'mailEnabledSecurityGroup'
  }
  members: Array<{
    objectId?: string
    primaryEmail: string
    recipientType: 'mailContact' | 'guestUser' | 'mailbox'
  }>
  verify: true
}
```

## Validation rules

- reject unknown commands
- reject extra fields when strict schemas are defined
- reject write requests without required target identity
- reject requests when session/tenant preconditions are not met

## PowerShell worker contract

PowerShell commands should accept JSON input and emit one final JSON response, plus optional progress lines or structured progress events where supported. The main process is responsible for converting raw worker output into app envelopes.

## Versioning

- command contract is versioned inside `src/shared/contracts`
- breaking changes require coordinated updates to renderer, main, and worker layers
- backend payloads are internal and must not leak directly to the renderer

## Acceptance criteria

- IPC does not expose generic scripting.
- The contract is narrow enough to test with contract fixtures.
- Error and progress messages are first-class, not ad hoc text streams.
