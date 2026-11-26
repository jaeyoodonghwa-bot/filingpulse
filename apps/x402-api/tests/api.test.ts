import { describe, expect, it } from "vitest";
import { createApp, type Env } from "../src/index.js";

const TEST_ENV: Env = {
  PAY_TO_ADDRESS: "0x1111111111111111111111111111111111111111",
  FACILITATOR_URL: "http://127.0.0.1:1/unreachable-facilitator",
  X402_NETWORK: "eip155:8453",
  STRIPE_PAYMENT_LINK: "https://buy.stripe.com/test_filingpulse",
  DEMO_API_KEY: "fp_test_key_123",
  DEFAULT_DATA_MODE: "fixture",
  FALLBACK_TO_FIXTURE: "true",
};

function decodePaymentRequiredHeader(res: Response) {
  const raw = res.headers.get("payment-required") || res.headers.get("x-payment-required");
  if (!raw) return null;
  const decoded = Buffer.from(raw, "base64").toString("utf8");
  return JSON.parse(decoded);
}

describe("FilingPulse x402 Cloudflare Worker API", () => {
  const app = createApp();

  it("GET / returns API discovery JSON with x402 Base USDC & Stripe terms", async () => {
    const res = await app.request("/", undefined, TEST_ENV);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, any>;
    expect(body.service).toContain("FilingPulse");
    expect(body.monetization.x402.network).toBe("eip155:8453");
    expect(body.monetization.x402.asset).toBe("USDC");
    expect(body.monetization.x402.payTo).toBe(TEST_ENV.PAY_TO_ADDRESS);
    expect(body.monetization.stripe.paymentLink).toBe(TEST_ENV.STRIPE_PAYMENT_LINK);
    expect(body.monetization.economics.grossMarginPct).toBeGreaterThan(95);
  });

  it("GET /health returns 200 OK", async () => {
    const res = await app.request("/health", undefined, TEST_ENV);
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, any>;
    expect(body.status).toBe("ok");
    expect(body.network).toBe("eip155:8453");
  });

  it("GET /demo returns 200 HTML interactive dashboard", async () => {
    const res = await app.request("/demo", undefined, TEST_ENV);
    expect(res.status).toBe(200);
    expect(res.headers.get("content-type")).toContain("text/html");
    const html = await res.text();
    expect(html).toContain("FilingPulse");
    expect(html).toContain("HTTP 402 x402 Gate Inspector");
    expect(html).toContain(TEST_ENV.STRIPE_PAYMENT_LINK!);
  });

  it("GET /v1/signals/AAPL without payment returns HTTP 402 with Base USDC x402 requirements", async () => {
    const res = await app.request("/v1/signals/AAPL", undefined, TEST_ENV);
    expect(res.status).toBe(402);

    const reqs = decodePaymentRequiredHeader(res);
    expect(reqs).not.toBeNull();
    expect(reqs.x402Version).toBe(2);
    expect(Array.isArray(reqs.accepts)).toBe(true);
    expect(reqs.accepts[0]).toMatchObject({
      scheme: "exact",
      network: "eip155:8453",
      amount: "20000",
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      payTo: TEST_ENV.PAY_TO_ADDRESS,
    });

    const body = (await res.json()) as Record<string, any>;
    expect(body.protocol).toBe("x402");
    expect(body.accepts[0].network).toBe("eip155:8453");
    expect(body.accepts[0].amount).toBe("20000");
    expect(body.stripeAlternative.paymentLink).toBe(TEST_ENV.STRIPE_PAYMENT_LINK);
  });

  it("GET /v1/insiders/clusters without payment returns HTTP 402 with $0.05 USDC amount (50000)", async () => {
    const res = await app.request("/v1/insiders/clusters", undefined, TEST_ENV);
    expect(res.status).toBe(402);

    const reqs = decodePaymentRequiredHeader(res);
    expect(reqs).not.toBeNull();
    expect(reqs.accepts[0]).toMatchObject({
      scheme: "exact",
      network: "eip155:8453",
      amount: "50000",
      asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      payTo: TEST_ENV.PAY_TO_ADDRESS,
    });
  });

  it("GET /v1/signals/AAPL with invalid x-api-key still returns HTTP 402", async () => {
    const res = await app.request(
      "/v1/signals/AAPL",
      { headers: { "x-api-key": "invalid-key" } },
      TEST_ENV
    );
    expect(res.status).toBe(402);
  });

  it("GET /v1/signals/AAPL with valid x-api-key returns 200 structured signal JSON", async () => {
    const res = await app.request(
      "/v1/signals/AAPL",
      { headers: { "x-api-key": TEST_ENV.DEMO_API_KEY! } },
      TEST_ENV
    );
    expect(res.status).toBe(200);
    expect(res.headers.get("x-auth-rail")).toBe("stripe-api-key");

    const body = (await res.json()) as Record<string, any>;
    expect(body.ticker).toBe("AAPL");
    expect(body.cik).toBe("0000320193");
    expect(body.latest8K.length).toBeGreaterThan(0);
    expect(body.insiderCluster.uniqueBuyers).toBe(2);
    expect(typeof body.compositeScore).toBe("number");
  });

  it("GET /v1/insiders/clusters with valid x-api-key returns ranked cluster JSON", async () => {
    const res = await app.request(
      "/v1/insiders/clusters?tickers=AMD,AAPL,ACME&windowDays=30",
      { headers: { "x-api-key": TEST_ENV.DEMO_API_KEY! } },
      TEST_ENV
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, any>;
    expect(body.scannedTickers).toBe(3);
    expect(body.clusters[0].ticker).toBe("AMD");
    expect(body.clusters[0].signal).toBe("strong_buy_cluster");
  });

  it("GET /v1/8k/material-diff/ACME with valid x-api-key returns critical restatement delta", async () => {
    const res = await app.request(
      "/v1/8k/material-diff/ACME",
      { headers: { "x-api-key": TEST_ENV.DEMO_API_KEY! } },
      TEST_ENV
    );
    expect(res.status).toBe(200);
    const body = (await res.json()) as Record<string, any>;
    expect(body.ticker).toBe("ACME");
    expect(body.severityShift).toBe("medium -> critical");
    expect(body.addedItems.map((i: any) => i.code)).toEqual(["4.02", "5.02"]);
  });

  it("returns HTTP 402 for Base mainnet even when facilitator /supported returns only testnet eip155:84532", async () => {
    const originalFetch = globalThis.fetch;
    globalThis.fetch = (async (input: RequestInfo | URL, init?: RequestInit) => {
      const url = String(input);
      if (url.includes("testnet-only-facilitator.local/supported")) {
        return new Response(
          JSON.stringify({
            kinds: [{ x402Version: 2, scheme: "exact", network: "eip155:84532" }],
            extensions: [],
            signers: {},
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      return originalFetch(input, init);
    }) as typeof fetch;

    try {
      const freshApp = createApp();
      const res = await freshApp.request("/v1/signals/AAPL", undefined, {
        ...TEST_ENV,
        FACILITATOR_URL: "https://testnet-only-facilitator.local",
      });
      expect(res.status).toBe(402);
      const reqs = decodePaymentRequiredHeader(res);
      expect(reqs?.accepts?.[0]).toMatchObject({
        scheme: "exact",
        network: "eip155:8453",
        amount: "20000",
        asset: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
      });
    } finally {
      globalThis.fetch = originalFetch;
    }
  });
});
