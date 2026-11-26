# FilingPulse — SEC EDGAR 8-K & Form 4 Signal Extractor (Apify PPE Actor)

Deterministic SEC EDGAR 8-K material event classifier and Form 4 insider cluster signal extractor packaged as an **Apify Store Pay-Per-Event (PPE)** and **MCP-ready** Actor (`filing-pulse-sec-signals`).

## 30-Second Walkthrough

1. **What it extracts**: Official `data.sec.gov` Form 8-K material items (`1.01`, `2.02`, `4.02`, `5.02`, `8.01`), 8-K material diffs, and Form 4 open-market insider cluster buy/sell scores—parsed deterministically via `@filingpulse/core` with zero browser scraping or LLM hallucination.
2. **Pay-Per-Event Pricing**:
   - Event: `filing-signal` — **`$0.005` USD per signal returned**
   - Default `maxItems: 20` (`$0.10` max spend per run unless increased)
   - Automatically honors Apify's `maxTotalChargeUsd` (`Actor.getChargingManager()` + `eventChargeLimitReached`) so autonomous MCP agents cannot overspend.
3. **MCP (`mcp.apify.com`) Compatibility**:
   - Exposes strict typed JSON input (`tickers`, `include8k`, `includeForm4`, `includeMaterialDiff`, `maxItems`, `lookbackDays`, `fixtureMode`).
   - Safe defaults prevent runaway token or dollar usage when invoked from Claude, Cursor, or custom MCP hosts.

## Sample Input

```json
{
  "tickers": ["AAPL", "NVDA"],
  "include8k": true,
  "includeForm4": true,
  "includeMaterialDiff": true,
  "maxItems": 20,
  "lookbackDays": 30,
  "fixtureMode": false
}
```

## Sample Dataset Output Item

```json
{
  "ticker": "AAPL",
  "cik": "0000320193",
  "signalType": "8k-material-event",
  "formType": "8-K",
  "filedAt": "2026-11-18T21:14:00.000Z",
  "severity": "high",
  "score": 78,
  "items": ["2.02", "5.02"],
  "summary": "Results of Operations (2.02) and Leadership Change (5.02)",
  "filingUrl": "https://www.sec.gov/Archives/edgar/data/320193/...",
  "source": "sec-edgar"
}
```

## Local Development & Verification

```bash
# Typecheck, build & run unit/integration tests (uses @filingpulse/core fixtureMode)
npm run typecheck
npm run build
npm test

# Local end-to-end Actor smoke run (no live SEC network calls)
mkdir -p /tmp/apify-smoke/key_value_stores/default
printf '{"tickers":["AAPL","NVDA"],"maxItems":5,"fixtureMode":true}\n' > /tmp/apify-smoke/key_value_stores/default/INPUT.json
CRAWLEE_STORAGE_DIR=/tmp/apify-smoke node dist/main.js

# Or via Apify CLI (after `apify login`)
apify run --input='{"tickers":["AAPL","NVDA"],"maxItems":5,"fixtureMode":true}'
```

> **Self-contained cloud build**: `@filingpulse/core@1.0.0` is pre-packed in `./vendor/filingpulse-core-1.0.0.tgz` (`package.json` + `Dockerfile` + `.dockerignore` configured), so `apify push` builds cleanly on Apify Cloud without external monorepo paths. If `packages/core` changes later, refresh via `npm pack ../../packages/core --pack-destination ./vendor`.

## Related Surfaces
- **Edge API (Cloudflare Workers + HTTP 402 Base USDC + Stripe)**: `apps/x402-api/`
- **Shared Deterministic Core**: `packages/core/`
