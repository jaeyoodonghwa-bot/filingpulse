export const FILING_PULSE_SCHEMAS = {
  service: "FilingPulse SEC EDGAR 8-K & Form 4 Signal API",
  version: "1.0.0",
  endpoints: {
    tickerSignal: {
      method: "GET",
      path: "/v1/signals/:ticker",
      priceUsd: 0.02,
      description:
        "Deterministic SEC EDGAR 8-K materiality & Form 4 insider cluster signal JSON for a US public equity ticker.",
      parameters: {
        ticker: { type: "string", pattern: "^[A-Za-z0-9.-]{1,10}$", example: "AAPL" },
        windowDays: { type: "integer", minimum: 1, maximum: 365, default: 30 },
        mode: { type: "string", enum: ["live", "fixture"], default: "live" },
      },
    },
    insiderClusters: {
      method: "GET",
      path: "/v1/insiders/clusters",
      priceUsd: 0.05,
      description:
        "Multi-ticker Form 4 insider cluster buy/sell scanner with C-Suite weighting and Rule 10b5-1 noise discount.",
      parameters: {
        tickers: { type: "string", description: "Comma-separated tickers (max 15)", example: "AMD,AAPL,NVDA,PLTR" },
        windowDays: { type: "integer", minimum: 1, maximum: 365, default: 30 },
        minAbsScore: { type: "integer", minimum: 0, maximum: 100, default: 0 },
      },
    },
    eightKMaterialDiff: {
      method: "GET",
      path: "/v1/8k/material-diff/:ticker",
      priceUsd: 0.02,
      description:
        "Compares the latest Form 8-K against the immediately preceding 8-K to isolate added/removed material items and severity shifts.",
      parameters: {
        ticker: { type: "string", pattern: "^[A-Za-z0-9.-]{1,10}$", example: "AAPL" },
      },
    },
  },
  mcpTools: [
    {
      name: "filingpulse_get_ticker_signal",
      description: "Fetch deterministic SEC EDGAR 8-K materiality and Form 4 insider cluster signals for a ticker.",
      inputSchema: {
        type: "object",
        properties: {
          ticker: { type: "string", description: "US stock ticker symbol (e.g., AAPL, AMD, NVDA)" },
          windowDays: { type: "integer", description: "Form 4 lookback window in days (default 30)" },
        },
        required: ["ticker"],
      },
    },
    {
      name: "filingpulse_scan_insider_clusters",
      description: "Scan multiple tickers for high-conviction C-Suite Form 4 open-market buy/sell clusters.",
      inputSchema: {
        type: "object",
        properties: {
          tickers: {
            type: "array",
            items: { type: "string" },
            description: "List of up to 15 US stock tickers",
          },
          windowDays: { type: "integer", description: "Lookback window in days (default 30)" },
        },
      },
    },
    {
      name: "filingpulse_get_8k_material_diff",
      description: "Compute item-level material event delta between the two most recent Form 8-K filings.",
      inputSchema: {
        type: "object",
        properties: {
          ticker: { type: "string", description: "US stock ticker symbol (e.g., AAPL, ACME)" },
        },
        required: ["ticker"],
      },
    },
  ],
} as const;
