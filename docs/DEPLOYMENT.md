# Local and production setup

## Local
Use Node.js 20 LTS or 22. Copy `.env.example` to `.env.local`, add Firebase client/Admin credentials, then run `npm install`, `npm run dev`. Visit http://localhost:3000.

## Firebase
Create a project; enable Google Authentication; create Firestore and Storage; add localhost and production domains to Authorized Domains; configure `NEXT_PUBLIC_FIREBASE_*` and server-only Admin credentials; deploy `firebase/firestore.rules`, `firebase/storage.rules`, and `firebase/firestore.indexes.json`.

## OpenAI
Set `OPENAI_API_KEY` and optional `OPENAI_IMAGE_MODEL`. Verify current account/model access, image API parameters, usage cost, output sizes, and terms before production.

## Razorpay
Configure credentials, subscription plan IDs, webhook secret and `/api/webhooks/razorpay`. Test in sandbox before enabling real billing.

## Vercel
Import the project, set environment variables per environment, set `APP_URL`, configure Firebase authorized domains and webhook URL. Deploy a preview with test credentials. For production add a durable worker, distributed limiter, retention, monitoring, backups, and reconciliation.
