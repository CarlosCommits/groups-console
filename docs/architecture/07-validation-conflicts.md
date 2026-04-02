# 07. Validation and Conflict Handling

## Purpose

Define the preflight checks and conflict rules that protect the app from bad writes and ambiguous identity resolution.

## Core problem

The same external email address can appear in multiple systems and object types, especially around contacts and guest users. Groups Console v2 must treat SMTP as an attribute, not as the canonical key.

## Canonical identity model

Every entity in app state must carry:

- `source`: `exchange` or `graph`
- `objectId`: stable ID from the owning system
- `recipientType`
- `primaryEmail`
- optional alternate email/proxy metadata

## Normalization rules

- lowercase all email comparisons for validation
- preserve original display casing for presentation only
- treat primary SMTP and proxy addresses separately
- preserve object IDs from source system for write targeting

## Required preflight checks

### Before creating a mail contact

1. check for existing Exchange recipient/mail contact/mail user using the target SMTP
2. check for guest-user overlap that would make the address ambiguous or already claimed
3. if conflict exists, block create and present a conflict explanation

### Before inviting/creating a guest user

1. check for existing guest by email
2. check for Exchange-side contact/recipient overlap
3. decide whether operation is blocked, merged, or requires manual remediation

### Before adding group members

1. verify target group type and owner system
2. verify intended member exists in a supported form
3. verify current membership to prevent duplicate add behavior

## Conflict categories

- `emailAlreadyOwned`
- `guestContactOverlap`
- `tenantMismatch`
- `unsupportedRecipientType`
- `existingMembership`
- `eventualConsistencyDelay`

## Guest/contact overlap policy for v1

When an external email already exists as both a contact-shaped object and a guest-shaped object, the app must not guess. It should:

1. present both records with type and source
2. explain which object is valid for the requested action
3. block destructive assumptions

## User-facing behavior

- preflight problems are blocking, not warnings, for destructive actions
- conflict messages must be specific and actionable
- raw backend exception text is logged but not shown verbatim unless safe

## Batch behavior

For batch operations:

- validate all targets first
- classify each item as ready, duplicate, blocked, or unknown
- require confirmation when proceeding with a partial-ready batch
- record per-item result in final output

## Post-write verification

Write flows should verify on the owning backend after mutation. If the verification window expires, mark the result as `pendingVerification` or `partialSuccess`, not `success`.

## Acceptance criteria

- SMTP-only matching is never the sole identity rule for writes.
- Guest/contact overlap is treated explicitly.
- Batch operations surface per-item outcomes clearly.
