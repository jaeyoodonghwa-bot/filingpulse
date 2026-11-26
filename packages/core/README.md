# `@filingpulse/core`

Pure TypeScript deterministic SEC EDGAR 8-K & Form 4 signal library. Zero Node-only dependencies — runs identically on **Cloudflare Workers**, **Node.js (Apify Actor)**, and **Browsers**.

## 30-Second Walkthrough

```ts
import { createFilingPulseClient } from "@filingpulse/core";

// Live SEC EDGAR mode (compliant User-Agent built-in)
const liveClient = createFilingPulseClient({
  userAgent: "FilingPulse/1.0 (ops@filingpulse.dev)",
});

// Deterministic offline fixture mode (tests & demos)
const fixtureClient = createFilingPulseClient({ fixtureMode: true });

const signal = await fixtureClient.getTickerSignal("AMD");
const diff = await fixtureClient.getEightKMaterialDiff("AAPL");
const clusters = await fixtureClient.getInsiderClusters({ tickers: ["AMD", "AAPL", "NVDA"] });
```

## Build & Test

```bash
npm run build --workspace=packages/core
npm test --workspace=packages/core
```
