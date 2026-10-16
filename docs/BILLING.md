# Razorpay billing setup

1. Create test-mode Razorpay credentials.
2. Create subscription plans matching Pro, Max, Ultra, API Starter, API Scale.
3. Set `RAZORPAY_PLAN_PRO`, `RAZORPAY_PLAN_MAX`, `RAZORPAY_PLAN_ULTRA` and API plan IDs in the deployment environment.
4. Configure webhook `/api/webhooks/razorpay` and `RAZORPAY_WEBHOOK_SECRET`; select appropriate current subscription events in Razorpay dashboard.
5. Test activation, renewals, cancellation, failed payment, duplicate event delivery, and webhook signature failures.

Checkout creation and signature helpers exist, but a complete checkout UI, cancellation UI, invoice history, and periodic reconciliation are still required. A verified webhook, not a browser redirect, controls entitlements. Developer per-call fees are metered but not automatically collected. Configure a supported collection/reconciliation workflow before charging customers.
