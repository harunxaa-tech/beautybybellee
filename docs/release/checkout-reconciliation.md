# Durable checkout guard — prelaunch, not deployed to payment handler

Database migration durable_checkout_attempt_guard applied and rollback-only SQL checks passed. Reservation is serialized per company, independent of payment provider; existing non-cancelled provider subscriptions block new reservations. Only service_role may execute reserve/release. Matching attempt UUID required to release. The table has RLS, no client access. No permanent synthetic test rows remain.

The exact-anchor script scripts/patch-stripe-checkout.mjs was applied in memory to stripe-billing v15. It reserves before customer/checkout provider calls, validates current terms and plan, passes attempt ID to checkout and subscription metadata and Stripe idempotency key, and bounds the external fetch. This is staging only: do not deploy until a reconciliation worker and test cases prove recovery from uncertain provider outcomes. The same reservation must be integrated before StoreKit/Google billing launches; the database primitive alone does not prevent their current client-side purchase path.

Release only after authoritative provider verification: a confirmed subscription is durably recorded; or the session is proven expired and no subscription exists; or provider confirms the request never created a session. Browser cancellation or timeout is not sufficient. For uncertain results, preserve attempt and reconcile; never blind-retry a paid checkout. Implement stable customer identity and persist provider session reference before returning URL. Add safe retry/resume for the same attempt and Stripe test-mode concurrency tests. Existing subscriptions, upgrade payment behavior and refunds still require independent verification. No real payments, no new paid services.

Apple V2: verify signedPayload using Apple server library and trusted roots, validate bundle/app/environment, record notificationUUID durably, fetch authoritative current state before applying, reconcile missed notification history with pagination, never treat historic notification state as current. Configure endpoints and test notifications in App Store Connect after activation. Refunds, expiry, renewal, billing retry and revocation must have signed sandbox test evidence.

References:
https://docs.stripe.com/webhooks
https://docs.stripe.com/api/idempotent_requests
https://developer.apple.com/documentation/appstoreservernotifications/responding-to-app-store-server-notifications
https://developer.apple.com/documentation/appstoreserverapi/get-notification-history
