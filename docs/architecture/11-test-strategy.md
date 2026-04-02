# 11. Test Strategy

## Purpose

Define how Groups Console v2 will be verified before and during rollout.

## Testing principles

- test contracts before polishing UI
- keep Exchange and Graph ownership boundaries testable
- make conflict rules executable via fixtures
- separate unit, contract, integration, and E2E responsibilities
- use a dedicated non-production tenant as the primary real-environment validation target

## Test layers

### TypeScript unit tests

Use Vitest or equivalent for:

- DTO mapping
- validation logic
- conflict classification
- main-process routing logic
- log redaction helpers

### PowerShell unit tests

Use Pester for:

- parameter validation
- Exchange worker command wrappers
- JSON response shaping
- error mapping

### Contract tests

Freeze request/response envelopes for IPC and worker boundaries using fixture files. This is the main guardrail against accidental breaking changes between layers.

### Integration tests

- Exchange worker invoked against mocked or constrained test doubles where possible
- Graph adapter invoked against mocked client responses
- file export tested with generated workbook assertions

### End-to-end tests

Use Playwright for Electron or equivalent to cover:

- connect flow
- group search and details
- add member flow
- create contact flow
- guest invite/search flow
- export flow

## Required fixtures

- distribution list with existing members
- mail-enabled security group
- guest user record
- mail contact record
- overlapping guest/contact email scenario
- tenant mismatch scenario

## Test environment guidance

- Preferred real-environment validation target: dedicated non-production tenant with representative Exchange and Entra configuration.
- Microsoft developer sandbox tenant is optional for smoke testing if available, but should not be the sole sign-off environment for Exchange-admin workflows.

## Minimum release test matrix

| Area | Required before pilot |
|---|---|
| Session connect/disconnect | Yes |
| Distribution list reporting | Yes |
| Add member to DL | Yes |
| Add/remove member to MESG | Yes |
| Create contact | Yes |
| Guest search/invite | Yes |
| Conflict handling | Yes |
| Diagnostics export | Yes |

## Manual QA focus

- Conditional Access/MFA behavior
- tenant mismatch messaging
- large report generation performance
- duplicate membership behavior
- blocked create due to overlap conflict

## Executable QA scenarios

### QA-01: Connect and show unified session status

- Tool: Playwright for Electron + mocked auth harness where needed
- Steps:
  1. launch the desktop app
  2. trigger Graph sign-in
  3. trigger Exchange sign-in
  4. wait for status refresh
- Expected result:
  - app shows connected state only after both sessions are valid
  - tenant mismatch produces blocked status, not partial false green state

### QA-02: Generate membership report export

- Tool: Playwright for Electron + mocked Exchange worker or test tenant read account
- Steps:
  1. open Reports
  2. select distribution-list or MESG report scope
  3. start export
  4. choose output location
  5. inspect produced workbook
- Expected result:
  - progress is shown
  - workbook is created successfully
  - exported rows include normalized recipient data, expected membership columns, and company name when present by object type

### QA-03: Add recipient to distribution list

- Tool: Playwright for Electron + Exchange worker integration test
- Steps:
  1. open Groups
  2. select a distribution list
  3. open membership editor
  4. search for valid recipient
  5. add recipient and submit
  6. wait for verification pass
- Expected result:
  - preflight runs before write
  - duplicate membership is blocked or reported as no-op
  - successful add is verified with a fresh Exchange read

### QA-04: Add recipient to mail-enabled security group

- Tool: Playwright for Electron + Exchange worker integration test
- Steps:
  1. open Groups
  2. filter to mail-enabled security groups
  3. select target group
  4. add valid recipient
  5. confirm write
- Expected result:
  - command routes to Exchange worker, not Graph
  - write result is verified by Exchange readback
  - UI surfaces clear success or partial verification timeout state

### QA-05: Create mail contact with overlap check

- Tool: Playwright + Exchange worker integration test + overlap fixtures
- Steps:
  1. open Contacts
  2. enter first name, last name, company, and target email
  3. submit once with a unique email
  4. submit once with an email already represented by a guest overlap fixture
- Expected result:
  - unique email create succeeds
  - overlap case is blocked during preflight with specific explanation

### QA-06: Invite guest user

- Tool: Playwright + Graph adapter integration test
- Steps:
  1. open Guests
  2. invite a new guest email
  3. inspect resulting guest details view
- Expected result:
  - operation routes to Graph adapter
  - created/invited guest appears in follow-up read
  - audit/log entry is written with safe metadata

### QA-07: Bulk company update from spreadsheet

- Tool: Playwright + fixture spreadsheet + Exchange worker integration test
- Steps:
  1. open Contacts bulk update screen
  2. choose fixture spreadsheet
  3. run preflight
  4. confirm execution
- Expected result:
  - rows with blank company are skipped correctly
  - only eligible contacts are updated
  - final summary contains updated, skipped, and failed counts

### QA-08: Diagnostics bundle export

- Tool: Playwright + filesystem assertions
- Steps:
  1. trigger a controlled failure
  2. open diagnostics export
  3. save bundle
  4. inspect contents
- Expected result:
  - bundle contains logs and environment summary
  - tokens and secrets are redacted
  - correlation IDs for recent jobs are present

## Acceptance criteria

- Contract fixtures exist for the privileged command layer.
- Critical workflows are covered end-to-end before pilot.
- Conflict handling is verified with explicit test data, not best guesses.
- Major epics have executable QA scenarios with tool, steps, and expected result.
