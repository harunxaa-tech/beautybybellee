# Store event ordering / subscription access
Applied 2026-11-25: fail_closed_missing_subscription_and_store_expiry; guard_verified_store_event_order_and_binding.

Missing subscription now restricted; store-managed active/grace/past_due without an expiry or with elapsed expiry restricted. Verified store updates require a timestamp and expiry for access-granting statuses, lock company and subscription rows, reject conflicting active subscription bindings, sandbox proof against a live subscription, older and conflicting same-time events within the same lineage. Duplicate event IDs must match company, subscription and payload hash. Service-only grants rechecked.

Rollback-only SQL tests passed: missing subscription, missing/expired/valid period end, active purchase, exact duplicate, conflicting duplicate hash, cancellation, stale event, conflicting equal-time event, sandbox/live mismatch. Synthetic products remaining: 0. No real payment or Store API call, no checkout enabled. Advisor: 13 SECURITY DEFINER warnings, 1 password protection warning, 6 no-policy informational notices.

Remaining gates: authoritative provider state reconciliation, signed Apple V2 notifications and history recovery, Google lifecycle, signed Store tests, real concurrent delivery tests, cross-provider migration and re-subscription rules, Stripe stale events and provider binding, add-on payment/refund ledger, checkout double-purchase prevention. Equal-time conflicts need authoritative reconciliation. Store verification must correctly handle stale/duplicate responses. Do not enable production purchases.

Sources: https://docs.stripe.com/webhooks ; https://developer.apple.com/documentation/appstoreservernotifications/responding-to-app-store-server-notifications ; https://www.postgresql.org/docs/current/explicit-locking.html
