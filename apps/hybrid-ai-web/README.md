# FilingPulse Hybrid AI Portfolio Risk Co-Pilot (`apps/hybrid-ai-web`)

Devpost **`#BuildHybridAI`** (Nov 30, 2026 deadline · $30K prize pool) submission built on **Vite + TypeScript + Firebase AI Logic Web SDK + `@filingpulse/core`**.

## Why Hybrid AI?

Private investors and portfolio managers cannot upload sensitive holdings, cost bases, and proprietary investment theses to third-party cloud LLM endpoints. FilingPulse Hybrid AI solves this using **Firebase AI Logic Hybrid Inference**:

- **`PREFER_ON_DEVICE` (Default)**: Matches your private portfolio holdings against real-time **SEC EDGAR 8-K & Form 4** signals inside **Chrome Built-in Gemini Nano** — **$0 inference cost, 0 bytes of portfolio data transmitted off-device**.
- **`PREFER_IN_CLOUD` / Automatic Fallback**: Seamlessly falls back to **Cloud Gemini (`gemini-2.5-flash`)** when on-device Gemini Nano is unavailable or when deep multi-filing cross-comparison is requested — automatically redacting private weights before cloud synthesis.
- **`ONLY_ON_DEVICE`**: Air-gapped privacy lock that forbids cloud fallback entirely.
- **Zero-Secret Demo Mode**: Works offline and in local `/browser` verification out of the box with zero API keys and zero spend.

## 30-Second Walkthrough

```bash
cd apps/hybrid-ai-web
npm install
npm test
npm run build
npm run dev   # http://127.0.0.1:4173
```

## Optional Live Firebase AI Logic Configuration

Never commit secrets to git. To enable live Cloud Gemini fallback locally, create an untracked `.env.local`:

```bash
VITE_FIREBASE_API_KEY=...
VITE_FIREBASE_PROJECT_ID=...
VITE_FIREBASE_APP_ID=...
```
