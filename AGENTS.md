# groups-console notes

- For Exchange group membership reads, treat a mail contact and a guest user / `GuestMailUser` as separate entities even when they share the same email address.
- The selected directory row is the source of truth. Do not collapse or canonicalize membership lookups by `primaryEmail`.
- Primary membership lookup should use the resolved Exchange object's `DistinguishedName` with a `Members -eq '<DN>'` filter and keep only distribution lists + mail-enabled security groups.
- Enumeration of groups and members is a fallback path, not the primary source of truth.
