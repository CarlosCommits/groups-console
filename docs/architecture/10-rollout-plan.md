# 10. Rollout and Migration Plan

## Purpose

Sequence the move from the current PowerShell script to a supported desktop application with minimal operator confusion.

## Release strategy

### Phase 0 — planning and proof of architecture

- finalize docs
- spike Electron shell + signed-in status UI
- spike Exchange worker contract and one read-only command
- spike Graph guest lookup flow

### Phase 1 — parity foundation

- implement session model
- implement distribution-list search/details
- implement report generation
- implement contact create and company update flows

### Phase 2 — scope expansion

- add mail-enabled security group search/details
- add membership edit flows for DL + MESG
- add guest search/invite flows
- add conflict-aware recipient selection

### Phase 3 — pilot hardening

- packaging/signing
- diagnostics export
- support playbook
- bug fixing from pilot feedback

## Pilot plan

- small set of trusted Exchange admins
- dedicated non-production tenant is the primary validation environment
- developer sandbox tenant is optional for early smoke testing only
- real tenant, non-destructive flows first
- then controlled write workflows
- collect failure logs and operator feedback weekly

## Migration guidance for operators

- v1 script remains fallback during pilot
- v2 should clearly label parity and new features
- support docs should explain where outcomes differ because of safer conflict handling

## Rollback plan

If a release is unstable:

1. stop distributing the new installer
2. direct pilot users back to the last stable installer or v1 script
3. preserve diagnostic logs and incident notes
4. fix and revalidate before reopening rollout

## Release gates

- signed build available
- connection/session flows verified in target tenant
- all critical parity workflows pass
- new guest + MESG workflows pass
- diagnostics export works
- pilot support owner identified

## Acceptance criteria

- Rollout is phased, not big-bang.
- v1 fallback remains available during pilot.
- The app has explicit go/no-go gates before broader distribution.
