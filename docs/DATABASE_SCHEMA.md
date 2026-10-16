# Firestore data model

- `users/{uid}`: identity, role, planId, subscriptionStatus, aiCreditsRemaining, exportsRemaining. Privileged fields are server-write only.
- `subscriptions/{providerSubscriptionId}`: owner UID, plan ID, provider status, webhook event marker.
- `billingEvents/{eventId}`: provider event metadata and processing state; apply payload retention limits.
- `creditLedger/{entryId}`: grant/reservation/consumption/refund events with job IDs and timestamps.
- `usagePeriods/{periodId}`: intended monthly usage aggregation; full rollover job still required.
- `generationJobs/{jobId}`: owner, prompt, mode, status, reserved credits, asset path, timestamps.
- `generatedAssets/{assetId}`: owner, storage path, prompt, model, timestamp.
- `exportEvents/{eventId}`: reserved for export usage tracking; atomic export enforcement remains to be implemented.
- `apiKeys/{keyId}`: owner, label, key hash, prefix, status, last-used timestamp.
- `apiUsage/{requestId}`: endpoint, owner, key, status, billable outcome, amount, duration.
- `apiBilling/{billingId}`: intended accrued variable charges and reconciliation state.
- `idempotencyKeys/{hashedKey}`: request/job state and cached response.
- `auditLogs/{id}` and `adminSettings/{id}`: server-only audit and configuration records.

Rules deny all unlisted reads/writes. Firebase Admin bypasses rules, so each server endpoint must authorize ownership. Indexes are in `firebase/firestore.indexes.json`.
