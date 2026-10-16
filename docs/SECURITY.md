# Security and production review

Implemented: server-side session verification; server-only privileged SDKs; Zod input validation for core generation/key routes; hashed API keys and revocation; private storage and signed URLs; basic security headers; webhook signature verification; Firestore deny-by-default rules; optional distributed Upstash rate limiting.

Before production: add CSRF/origin protections to cookie-authenticated mutations; validate actual image bytes/dimensions with Sharp; add CSP; make idempotency reservation atomic; add a durable queue and dead-letter policy; harden webhook concurrency; enforce export counters and server-side watermarks; implement account deletion/export; add distributed limits to all endpoints; configure retention, audit logs, backups, monitoring, and abuse response. Independent security review is recommended.
