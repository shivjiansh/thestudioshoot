# Software Requirements Specification

TheStudioShot is an AI product photography SaaS for online sellers, retailers, creative agencies, photographers, marketing teams, and developers. It includes a marketing site, authenticated creator workspace, private gallery/history, subscriptions, credit ledger, and a versioned developer API.

Functional requirements: Firebase Google sign-in and server sessions; OpenAI image generation/editing; private asset storage; centralized plan entitlements; credit reservation/refund; Razorpay subscriptions/webhooks; hashed API keys; rate limits; usage metering; documentation; privacy/terms/refund templates; contact UI.

Consumer plan limits are defined centrally in `src/config/plans.ts`: Free ₹0, 100 exports, 0 AI credits, watermark, no AI generation/commercial use, 1K entitlement, batch 1; Pro ₹999, 1,000 exports, 8,000 credits, 2K, batch 50; Max ₹2,799, 3,000 exports, 25,000 credits, 2K, batch 250; Ultra ₹7,999, 10,000 exports, 75,000 credits, 4K entitlement, batch 1,000 and priority queue. API Starter ₹1,699 plus ₹2/successful call, 60 RPM; Scale ₹8,499 plus ₹5/successful call, 600 RPM.

Non-functional requirements: strict TypeScript, validated input, server-side authorization, no browser-trusted billing, privacy by default, accessible responsive UI, traceable usage and documented limitations.
