# FilingPulse x402 API (`apps/x402-api`)

Cloudflare Workers API powered by **Hono** + **`@x402/hono`** (USDC on Base `eip155:8453`) + **Stripe subscriber API key rail**.

## 30-Second Walkthrough

1. **Free Endpoints**:
   - `GET /` — API discovery JSON (pricing, x402 terms, Stripe Payment Link, MCP/endpoint metadata)
   - `GET /health` — healthcheck
   - `GET /demo` — interactive signal dashboard + live HTTP 402 header inspector
2. **Monetized Endpoints** (x402 USDC on Base OR valid `x-api-key` header):
   - `GET /v1/signals/:ticker` — `$0.02` USDC — 8-K materiality + Form 4 insider cluster report
   - `GET /v1/insiders/clusters` — `$0.05` USDC — multi-ticker insider buy/sell cluster scan
   - `GET /v1/8k/material-diff/:ticker` — `$0.02` USDC — delta between latest & prior 8-K filings

## Local Development & Verification

```bash
# Run unit & integration tests (from repo root)
npm test --workspace=packages/core
npm test --workspace=apps/x402-api

# Start local Cloudflare Worker dev server
npm run dev --workspace=apps/x402-api

# Verify unpaid HTTP 402 gate
curl -i http://127.0.0.1:8787/v1/signals/AAPL

# Verify subscriber bypass (demo preview key)
curl -H "x-api-key: fp_demo_preview_2026" "http://127.0.0.1:8787/v1/signals/AMD?mode=fixture"
```

## Non-Destructive Build Dry-Run

```bash
npm run deploy:dry-run --workspace=apps/x402-api
```
