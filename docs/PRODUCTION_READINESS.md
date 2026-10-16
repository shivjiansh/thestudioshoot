# Production readiness

## Implemented in source (not yet independently integration-tested)
- [x] Marketing pages, pricing, documentation/policy pages, SEO metadata, sitemap, robots rules, responsive workspace shell, loading/error/not-found states
- [x] Centralized consumer and developer API plan catalog
- [x] Firebase Google sign-in, in-memory client auth persistence during session exchange, recent-auth token validation, HttpOnly session cookie, server-side session verification
- [x] OpenAI image generation/editing adapter with request validation, Sharp byte decoding, MIME/content consistency checks, pixel limits, and server-side API key
- [x] Transactional consumer AI-credit reservation and a single-refund ledger workflow
- [x] Private Firebase Storage output, ownership-checked/downscaled preview route, expiring API result URLs, and server-side export route
- [x] Free-plan export watermark, plan-based maximum dimension cap, transactional export allowance decrement/idempotency record, and compressed non-AI source-image import workflow for Free users
- [x] Hashed Developer API keys, revocation, separate API subscription entitlements, versioned endpoints, usage metering, request fingerprinting for idempotency keys, and distributed Upstash rate limiting (in-memory fallback is development-only)
- [x] Razorpay subscription creation, checkout signature helper, signed webhook validation, event de-duplication, activation/cancellation synchronization, and retry response when a first-party subscription webhook arrives before its local record
- [x] Account-data JSON export for profile metadata, subscriptions, credits, generation records, assets metadata, exports, API keys (secrets omitted), and usage
- [x] Firestore deny-by-default rules, required query indexes, unit tests, environment template, setup/architecture/security/deployment docs
- [x] Admin route with server-verified role and bootstrap script

## Not yet production-complete
- [ ] Dependency install, typecheck, lint, automated tests, and production build verified. npm package installation could not resolve the npm registry in the generation environment, so these checks remain unverified.
- [ ] Real Firebase/OpenAI/Razorpay/Upstash credentials and sandbox tests
- [ ] Durable image job queue and worker; generation currently runs inside a request and can hit platform duration limits
- [ ] Retryable job recovery/reconciliation for jobs left in `processing` after process termination
- [ ] A fully leased/transactional webhook processor with scheduled provider subscription reconciliation
- [ ] Self-service account deletion. Data export is implemented; deletion needs a safe recent-auth, cancellation, retention, and cleanup workflow.
- [ ] Full billing portal, invoices/payment history, and recurring subscription reconciliation
- [ ] API variable-charge collection/reconciliation. Successful calls are metered as accrued amounts; meter records do not mean charges were collected.
- [ ] A fully durable billing-cycle usage period system. Free export reset is based on UTC month; paid export/credit grants depend on provider subscription lifecycle events.
- [ ] Validate custom output dimensions against the configured OpenAI model/account in integration tests. The code requests 1K/2K/4K-class sizes and fails closed for non-1K when the configured model is not allowlisted; actual resolution support, latency, cost, aspect ratios, and higher-than-2560×1440 4K-class outputs must be verified with real provider credentials before advertising them. Consumer credit costs vary by resolution/quality; Developer API per-call prices are presently flat by tier and need unit-economics review.
- [x] A non-AI source-image import-to-gallery workflow for Free users. Uploaded assets can be exported with a server-side watermark and current export allowance; AI generation remains blocked.
- [ ] Signed direct-to-storage uploads for very large originals; current request workflow compresses source images to fit serverless JSON payload limits.
- [ ] Batch generation and cancellation of in-flight provider jobs
- [ ] Automatic contact-form delivery; the contact form currently validates but does not send emails
- [ ] Admin audit/abuse tooling, log retention jobs, data-retention automation
- [ ] Production monitoring, alerts, backups/restore drills, object lifecycle policies, dead-letter workflow, rollback runbook
- [ ] Legal review of terms/privacy/refund/commercial-use wording

## Release gate
Do not describe this build as production-ready until blockers are closed, the current provider APIs are validated in sandbox, all configured integration tests pass, the production build succeeds, and security/legal reviews are complete.
