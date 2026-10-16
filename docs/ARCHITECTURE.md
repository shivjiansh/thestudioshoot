# Architecture

- Next.js App Router and strict TypeScript; server components for account reads and client components for forms.
- Firebase Authentication Google popup exchanges an ID token for a 5-day HttpOnly session cookie verified by Firebase Admin.
- Firestore stores account, subscription, generation job, asset, credit ledger, API key, and usage records.
- OpenAI image generation/editing uses server-side SDK and configurable model name.
- Firebase Storage stores generated images under private user paths; result links expire after 10 minutes.
- Razorpay subscription creation and webhook signature verification are implemented as integration points.
- Developer API keys are cryptographically generated; only SHA-256 hashes are persisted.
- Upstash REST rate limiter is used when configured. Production fails closed if it is missing.

## Production gaps
Generation currently runs inside a request handler, not a durable worker. Use Cloud Tasks/PubSub/Cloud Run Jobs or an equivalent queue before high-volume use. Harden webhook leasing and idempotency races, add CSRF/origin controls, export counters/watermarking, variable API fee collection, account deletion, audit UI, and monitoring before calling this production ready.

## Resolution and credit policy

The request schema exposes `resolution` (`1K`, `2K`, `4K`). The backend checks the requested resolution against the active consumer plan or Developer API plan. Consumer credit cost is derived from a centralized resolution × quality table, multiplied by the configured edit multiplier for image edits. API usage is currently priced as a flat billable-success amount per API tier; this is a product-policy assumption to revisit against provider costs. Provider output dimensions must be validated in account-level integration tests.
