# Recovery readiness – release blocker
The local export is a partial, confidential business record snapshot, not a system backup. Import only validates and counts records for the active owner; it cannot overwrite the workspace. The older unused data-safety.js module must not be activated before review: its merge prefers incoming values, it clears tombstones, and it lacks reliable restore boundaries.

Before launch:
- Verify actual database backup schedule and retention, independent storage object backups, and recovery of Edge Function code/configuration; keep credentials in protected secret management.
- Define RPO/RTO and test restoring both database and actual document bytes in an isolated environment. Include file hashes, missing objects, tenant separation and invoice archive immutability.
- Do not restore directly into a running customer database. Preserve a current recovery point, authorize restore, compare versions, preserve current records and tombstones, use transactions and record audit events.
- Add stable export paging, server authorization and quotas; do not misrepresent partial exports as complete backups.
- Keep backups encrypted, access restricted, retention/deletion documented; no customer data in GitHub.
- Confirm actual restore evidence before claiming disaster recovery is ready. No paid service or new infrastructure activated by this change.

Sources: https://supabase.com/docs/guides/platform/backups ; https://supabase.com/docs/guides/platform/clone-project .
