# TheStudioShot

Next.js App Router / React / TypeScript full-stack scaffold for an AI product photography SaaS. Includes public marketing pages, creator dashboard/studio/gallery/history, Firebase session auth, OpenAI image generation/editing, Firestore credit ledger, private Firebase Storage, Razorpay subscription/webhook integration points, developer API keys and endpoints, usage metering, security rules, tests, and docs.

> This is not yet production-ready. Read `docs/PRODUCTION_READINESS.md` before deployment. Real provider credentials are required for auth, image generation, billing, storage, and distributed rate limiting.

## Setup
Node.js 20 LTS or 22. `cp .env.example .env.local`, configure credentials, then `npm install && npm run dev`. Open http://localhost:3000.

## Checks
`npm run typecheck`, `npm run lint`, `npm test`, `npm run build`.

## Firebase
Enable Google Auth; create Firestore/Storage; set public Firebase vars and server Admin credentials; apply rules, storage rules and indexes in `firebase/`.

## OpenAI
Set `OPENAI_API_KEY` and optional `OPENAI_IMAGE_MODEL` (default `gpt-image-1`). Verify account access and current API capabilities before production.

## Razorpay
Create matching subscription plans and configure `RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`, and plan IDs. Configure `/api/webhooks/razorpay` and test all lifecycle events in test mode.

## Developer API
Create an account, open `/developer/keys`, create a key (shown once), and send it in `Authorization: Bearer ...`. Never embed keys in browser code. Use `Idempotency-Key` for generation POST requests.

## Known gaps
Durable queue/workers, complete checkout/cancellation UI, complete variable API fee collection, account deletion/export, admin UI, full CSRF/CSP, monitoring/retention/backups, and legal review remain outstanding. Metering is not collection. Plan 4K entitlement is not a guarantee of provider-native 4K output.

## Post-generation image editor

After a generation succeeds in `/studio`, the same page opens a canvas-based editor. It supports movable crop frames with common aspect-ratio presets, brightness/contrast/saturation, draggable and layered text/logo/watermark elements, font/color/opacity/rotation controls, and exact X/Y placement. Export formats are JPEG, WEBP, and single-page PDF. Each edited export is processed by an authenticated server route and consumes one export allowance; current plan resolution and watermark rules still apply. Editor source tokens expire after one hour. The editor does not overwrite the original generated asset.

## Image resolution and credits

The studio exposes 1K, 2K, and 4K-class requested output tiers. The selected consumer or Developer API plan is checked on the server. Consumer generation credit costs are configurable by resolution and quality, with a multiplier for image editing. Model support and 4K-class output must be verified against the configured provider account; plan entitlements alone do not guarantee provider output.
