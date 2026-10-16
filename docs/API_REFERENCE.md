# Developer API reference

Base path `/api/v1`. Send `Authorization: Bearer tss_live_...`. Never send keys in URLs or browser code.

- `POST /images/generate`: prompt, mode (`studio|lifestyle|background|catalog|social`), quality (`low|medium|high`), aspectRatio (`square|portrait|landscape`), `resolution` (`1K|2K|4K`), optional `imageDataUrl`. The selected Developer API plan limits output to 1K for Starter and 2K for Scale.
- `POST /images/edit`: alias of generation route; current schema is shared.
- `GET /jobs/:id`: owner-scoped job lookup.
- `GET /usage`: last 100 metered records.
- `GET /account`: plan and current balances.

POST generation requires `Idempotency-Key`. Errors use `{error:{code,message},requestId}`. Status codes include 400 validation, 401 authentication, 402 insufficient credits, 403 entitlement, 404 not found, 409 duplicate/in progress, 429 rate limit, 500 unexpected error, and 503 missing integration. Usage metering is not fee collection.

## Resolution and credits

Consumer credit costs depend on requested resolution and quality; editing requests use a configured multiplier. Developer API per-call rates are currently flat by API tier. The server rejects requests above plan ceilings and fails closed for higher-resolution requests if the configured AI model is not allowlisted. Verify custom output sizes, quality, aspect-ratio support, provider cost, and account access in provider-backed integration tests before production.
