# Project structure and mapping from the DesiGifting reference

The supplied DesiGifting tree uses the Next.js Pages Router (`src/pages`), page-level API routes, Zustand stores, reusable hooks, Firebase utility modules, role-oriented components, and centralized CSS. TheStudioShot retains the **App Router** required in its product brief but uses the same organizational principles.

```text
src/
├── proxy.ts                    # Request-path context for sign-in redirects (not authorization)
├── app/                         # App Router pages, layouts, and route handlers
│   ├── (marketing)/             # Features, pricing, docs, policy, contact pages
│   ├── (auth)/                  # Login
│   ├── (dashboard)/             # Studio, account dashboard, gallery, billing, API
│   └── api/                     # Session, generation, billing, editor source/export, webhook, versioned API
├── components/
│   ├── auth/                    # Google sign-in
│   ├── billing/                 # Hosted checkout controls
│   ├── layout/                  # Workspace shell and navigation
│   ├── editor/                  # Post-generation crop, adjustment, and layer editor
│   └── marketing/               # Marketing navigation and footer
├── hooks/                       # useAuth, useStudio
├── stores/                      # Zustand auth/session UI and studio preference state
├── lib/
│   ├── firebase/                # Client SDK and lazy Admin SDK
│   ├── auth/                    # Session-cookie verification
│   ├── ai/                      # OpenAI image-generation adapter
│   ├── billing/                 # Razorpay helpers and signature verification
│   ├── credits/                 # Transactional reservations and refunds
│   ├── storage/                 # Private image storage / expiring signed URLs
│   ├── developer-api/           # API key hashing and verification
│   └── validation/              # Boundary schemas
├── services/                    # Shared generation orchestration
├── config/                      # Plans and credit costs
└── repositories/                # Reserved for further Firestore data-access extraction
```

## Mapping to the DesiGifting tree
- `src/pages/*` → `src/app/*/page.tsx`
- `src/pages/api/*` → `src/app/api/**/route.ts`
- `src/hooks/useAuth.js` → `src/hooks/useAuth.ts` plus the authoritative server cookie in `src/lib/auth/session.ts`
- `src/stores/authStore.js` → `src/stores/authStore.ts`; transient UI state only, not authorization
- `src/stores/productStore.js` → `src/stores/studioStore.ts` for generation form preferences
- `src/lib/firebase.js` → `src/lib/firebase/client.ts` and lazy `src/lib/firebase/admin.ts`
- `src/lib/firebaseServices.js` → `src/lib/firebaseServices.ts` for session exchange
- `src/components/common/*` → `src/components/layout` and `src/components/marketing`
- seller analytics/order management → account dashboard, generation history, billing, developer usage, and restricted admin overview

## Authority rule
Zustand state is a UX cache only. Never authorize based on store values. The session cookie, Firestore account records, verified Razorpay events, server-side plan catalog, and server-side key status are authoritative.
