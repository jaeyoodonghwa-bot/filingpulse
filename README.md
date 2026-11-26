# FilingPulse — Deterministic SEC EDGAR Signal Engine

**One zero-dependency TypeScript core (`packages/core`), three production surfaces:**

1. **Edge Monetized API (`apps/x402-api`)** — Cloudflare Workers + Hono + `@x402/hono` native HTTP `402 Payment Required` USDC micropayments on Base (`eip155:8453`) + Stripe API key dual-rail billing + interactive `/demo` 402 header inspector.
2. **Apify Store PPE MCP Actor (`apps/apify-actor`)** — Pay-Per-Event (`$0.005/filing-signal`) Apify Actor (`filing-pulse-sec-signals`) with `maxItems` (`20`) and `maxTotalChargeUsd` budget guardrails for autonomous MCP clients (`mcp.apify.com`).
3. **Hybrid AI Portfolio Risk Co-Pilot (`apps/hybrid-ai-web`)** — Built for **Devpost `#BuildHybridAI`** using **Firebase AI Logic Hybrid Inference** (`PREFER_ON_DEVICE` Chrome built-in **Gemini Nano** for private, zero-egress portfolio triage + automatic **Cloud Gemini** fallback + zero-secret local demo simulator).

---

## 30-Second Walkthrough

### Architecture

```text
packages/core/          Pure TypeScript SEC EDGAR 8-K & Form 4 deterministic parser & scorer (0 Node-only deps)
├── apps/x402-api/      Cloudflare Worker (Hono + @x402/hono Base USDC + Stripe x-api-key + /demo UI)
├── apps/apify-actor/   Apify Store PPE Actor ($0.005/filing-signal, MCP-ready, self-contained Docker build)
└── apps/hybrid-ai-web/ Vite + TypeScript + Firebase AI Logic Hybrid Inference web app (#BuildHybridAI)
```

### 1. Shared Deterministic Core (`packages/core`)
- Fetches official public `data.sec.gov` submissions & Form 4 XML with SEC Fair Access `User-Agent` compliance (plus offline deterministic `fixtureMode` for reproducible tests).
- Classifies Form 8-K material items (`1.01`, `1.05`, `2.02`, `4.02`, `5.02`, `8.01`, etc.), computes 8-K material diffs against prior filings, and scores open-market Form 4 insider buying/selling clusters (separating C-suite purchases from scheduled 10b5-1 sales).

### 2. Cloudflare Workers x402 + Stripe API (`apps/x402-api`)
| Endpoint | Auth / Price | Description |
| :--- | :--- | :--- |
| `GET /` | Free | Discovery JSON, Base USDC pricing, Stripe Payment Link & MCP tool catalog |
| `GET /health` | Free | Health check (`network: eip155:8453`) |
| `GET /demo` | Free | Interactive SEC signal visualizer & live HTTP 402 header inspector |
| `GET /v1/signals/:ticker` | `$0.02` USDC (Base) or `x-api-key` | Structured 8-K material events + Form 4 insider cluster report |
| `GET /v1/insiders/clusters` | `$0.05` USDC (Base) or `x-api-key` | Multi-ticker Form 4 insider cluster scanner |
| `GET /v1/8k/material-diff/:ticker` | `$0.02` USDC (Base) or `x-api-key` | Deterministic item-level diff vs. previous 8-K filing |

```bash
# Install, build & test core + x402 API (Node >= 22.18)
npm install
npm run build
npm test

# Run local Cloudflare Worker dev server (port 8787)
npm run dev:api
# Open http://127.0.0.1:8787/demo or test unpaid 402 response:
curl -i http://127.0.0.1:8787/v1/signals/AAPL
```

### 3. Apify Store PPE Actor (`apps/apify-actor`)
```bash
cd apps/apify-actor
npm install
npm run typecheck && npm run build && npm test

# Local fixture smoke run (no live SEC network calls)
mkdir -p /tmp/apify-smoke/key_value_stores/default
printf '{"tickers":["AAPL","NVDA"],"maxItems":5,"fixtureMode":true}\n' > /tmp/apify-smoke/key_value_stores/default/INPUT.json
CRAWLEE_STORAGE_DIR=/tmp/apify-smoke node dist/main.js
```

### 4. Hybrid AI Portfolio Risk Co-Pilot (`apps/hybrid-ai-web`)
```bash
cd apps/hybrid-ai-web
npm install
npm test && npm run build
npm run preview
# Open http://127.0.0.1:4173 — toggle On-Device Gemini Nano (0 B egress) vs. Cloud Gemini Fallback
```

---

## Configuration & Security Notes
- Before deploying `apps/x402-api` to production, replace the placeholder `PAY_TO_ADDRESS` and `STRIPE_PAYMENT_LINK` values in `apps/x402-api/wrangler.toml` with your own public Base `0x...` receiving address and public Stripe Payment Link URL, and bind Cloudflare KV namespaces (`API_KEYS_KV`, `CACHE_KV`).
- Never commit private keys, seed phrases, or Stripe secret keys to this repository.

## License
MIT — see [LICENSE](./LICENSE).
