import { Hono } from "hono";
import { cors } from "hono/cors";
import { paymentMiddleware, x402ResourceServer } from "@x402/hono";
import { ExactEvmScheme } from "@x402/evm/exact/server";
import {
  HTTPFacilitatorClient,
  type FacilitatorClient,
  type RoutesConfig,
} from "@x402/core/server";
import type { Network, PaymentPayload, PaymentRequirements, SupportedResponse } from "@x402/core/types";
import {
  createFilingPulseClient,
  EdgarClientError,
  FILING_PULSE_SCHEMAS,
} from "@filingpulse/core";
import { renderDemoHtml } from "./demo.js";

export interface Env {
  PAY_TO_ADDRESS?: string;
  FACILITATOR_URL?: string;
  X402_NETWORK?: string;
  STRIPE_PAYMENT_LINK?: string;
  SEC_USER_AGENT?: string;
  DEMO_API_KEY?: string;
  VALID_API_KEYS?: string;
  DEFAULT_DATA_MODE?: string;
  FALLBACK_TO_FIXTURE?: string;
  API_KEYS_KV?: KVNamespace;
  CACHE_KV?: KVNamespace;
}

const DEFAULT_PAY_TO = "0x000000000000000000000000000000000000dEaD";
const DEFAULT_FACILITATOR = "https://x402.org/facilitator";
const DEFAULT_NETWORK: Network = "eip155:8453";
const DEFAULT_STRIPE_LINK = "https://buy.stripe.com/placeholder-filingpulse-pro";
const DEFAULT_DEMO_KEY = "fp_demo_preview_2026";

/**
 * Wraps HTTPFacilitatorClient so payment verification & settlement always execute
 * strictly against the live facilitator, while getSupported() degrades gracefully
 * to canonical exact EVM network metadata if the facilitator is unreachable
 * (e.g. offline tests or sandboxed local dev), ensuring HTTP 402 challenges still work.
 */
class ResilientFacilitatorClient implements FacilitatorClient {
  private readonly inner: HTTPFacilitatorClient;
  private readonly network: Network;

  constructor(url: string, network: Network) {
    this.inner = new HTTPFacilitatorClient({ url });
    this.network = network;
  }

  async verify(paymentPayload: PaymentPayload, paymentRequirements: PaymentRequirements) {
    return this.inner.verify(paymentPayload, paymentRequirements);
  }

  async settle(paymentPayload: PaymentPayload, paymentRequirements: PaymentRequirements) {
    return this.inner.settle(paymentPayload, paymentRequirements);
  }

  async getSupported(): Promise<SupportedResponse> {
    const ensureNetworkKind = (supported?: SupportedResponse): SupportedResponse => {
      const kinds = Array.isArray(supported?.kinds) ? [...supported.kinds] : [];
      const hasRequired = kinds.some(
        (k) => k.scheme === "exact" && k.network === this.network
      );
      if (!hasRequired) {
        kinds.push({
          x402Version: 2,
          scheme: "exact",
          network: this.network,
        });
      }
      return {
        kinds,
        extensions: Array.isArray(supported?.extensions) ? supported.extensions : [],
        signers: supported?.signers ?? {},
      };
    };

    try {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 1500);
      try {
        const result = await Promise.race([
          this.inner.getSupported(),
          new Promise<never>((_, reject) => {
            controller.signal.addEventListener("abort", () =>
              reject(new Error("Facilitator getSupported timed out"))
            );
          }),
        ]);
        return ensureNetworkKind(result);
      } finally {
        clearTimeout(timer);
      }
    } catch {
      return ensureNetworkKind();
    }
  }
}

function getNetwork(env?: Env): Network {
  return (env?.X402_NETWORK || DEFAULT_NETWORK) as Network;
}

function getPayTo(env?: Env): `0x${string}` {
  return (env?.PAY_TO_ADDRESS || DEFAULT_PAY_TO) as `0x${string}`;
}

function parseBool(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined) return defaultValue;
  return value.toLowerCase() === "true" || value === "1";
}

function parsePositiveInt(raw: string | undefined, fallback: number, max: number): number {
  if (!raw) return fallback;
  const parsed = Number.parseInt(raw, 10);
  if (Number.isNaN(parsed) || parsed <= 0) return fallback;
  return Math.min(parsed, max);
}

async function isAuthorizedApiKey(apiKey: string, env?: Env): Promise<boolean> {
  const trimmed = apiKey.trim();
  if (!trimmed) return false;

  const demoKey = env?.DEMO_API_KEY || DEFAULT_DEMO_KEY;
  if (trimmed === demoKey) return true;

  if (env?.VALID_API_KEYS) {
    const allowed = env.VALID_API_KEYS.split(",")
      .map((k) => k.trim())
      .filter(Boolean);
    if (allowed.includes(trimmed)) return true;
  }

  if (env?.API_KEYS_KV) {
    const record = await env.API_KEYS_KV.get(`key:${trimmed}`);
    if (record) return true;
  }

  return false;
}

function buildFilingClient(env: Env | undefined, modeParam: string | undefined) {
  const requestedMode = (modeParam || env?.DEFAULT_DATA_MODE || "live").toLowerCase();
  const fixtureMode = requestedMode === "fixture";
  const fallbackToFixtureOnError = parseBool(env?.FALLBACK_TO_FIXTURE, true);

  return createFilingPulseClient({
    userAgent: env?.SEC_USER_AGENT || "FilingPulse/1.0 (ops@filingpulse.dev)",
    fixtureMode,
    fallbackToFixtureOnError,
  });
}

export function createApp() {
  const app = new Hono<{ Bindings: Env }>();

  app.use(
    "*",
    cors({
      origin: "*",
      allowHeaders: [
        "Content-Type",
        "x-api-key",
        "PAYMENT-SIGNATURE",
        "X-PAYMENT",
      ],
      exposeHeaders: [
        "PAYMENT-REQUIRED",
        "PAYMENT-RESPONSE",
        "X-Payment-Required",
        "X-Payment-Response",
        "X-Auth-Rail",
      ],
    })
  );

  app.get("/", (c) => {
    const network = getNetwork(c.env);
    const payTo = getPayTo(c.env);
    const stripeLink = c.env?.STRIPE_PAYMENT_LINK || DEFAULT_STRIPE_LINK;

    return c.json({
      service: FILING_PULSE_SCHEMAS.service,
      version: FILING_PULSE_SCHEMAS.version,
      demo_url: "/demo",
      health_url: "/health",
      monetization: {
        x402: {
          protocol: "x402 v2",
          scheme: "exact",
          network,
          asset: "USDC",
          assetContract: "0x833589fCD6eDb6E08f4c7C32D4f71b54bdA02913",
          payTo,
          facilitator: c.env?.FACILITATOR_URL || DEFAULT_FACILITATOR,
          pricing: {
            "GET /v1/signals/:ticker": "$0.02",
            "GET /v1/insiders/clusters": "$0.05",
            "GET /v1/8k/material-diff/:ticker": "$0.02",
          },
        },
        stripe: {
          plan: "FilingPulse Pro — $29/mo (5,000 API calls)",
          paymentLink: stripeLink,
          header: "x-api-key",
        },
        economics: {
          estimatedCogsUsd: 0.00051,
          grossMarginPct: 97.4,
        },
      },
      endpoints: FILING_PULSE_SCHEMAS.endpoints,
      mcpTools: FILING_PULSE_SCHEMAS.mcpTools,
    });
  });

  app.get("/health", (c) =>
    c.json({
      status: "ok",
      service: "filingpulse-x402-api",
      network: getNetwork(c.env),
      timestamp: new Date().toISOString(),
    })
  );

  app.get("/demo", (c) => {
    const html = renderDemoHtml({
      stripePaymentLink: c.env?.STRIPE_PAYMENT_LINK || DEFAULT_STRIPE_LINK,
      payToAddress: getPayTo(c.env),
      network: getNetwork(c.env),
      demoApiKey: c.env?.DEMO_API_KEY || DEFAULT_DEMO_KEY,
    });
    return c.html(html);
  });

  // Cache x402 middleware per config key so Worker isolate reuses initialized server state
  const middlewareCache = new Map<string, ReturnType<typeof paymentMiddleware>>();

  function getX402Middleware(env?: Env) {
    const network = getNetwork(env);
    const payTo = getPayTo(env);
    const facilitatorUrl = env?.FACILITATOR_URL || DEFAULT_FACILITATOR;
    const cacheKey = `${network}|${payTo}|${facilitatorUrl}`;

    const existing = middlewareCache.get(cacheKey);
    if (existing) return existing;

    const facilitator = new ResilientFacilitatorClient(facilitatorUrl, network);
    const resourceServer = new x402ResourceServer(facilitator).register(
      network,
      new ExactEvmScheme()
    );

    const routes: RoutesConfig = {
      "GET /v1/signals/*": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.02",
            network,
            payTo,
          },
        ],
        description: "Structured SEC EDGAR 8-K materiality & Form 4 insider cluster signal JSON",
        mimeType: "application/json",
      },
      "GET /v1/insiders/clusters": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.05",
            network,
            payTo,
          },
        ],
        description: "Multi-ticker Form 4 insider cluster buy/sell scanner",
        mimeType: "application/json",
      },
      "GET /v1/8k/material-diff/*": {
        accepts: [
          {
            scheme: "exact",
            price: "$0.02",
            network,
            payTo,
          },
        ],
        description: "SEC Form 8-K item-level material event diff vs prior filing",
        mimeType: "application/json",
      },
    };

    const mw = paymentMiddleware(routes, resourceServer);
    middlewareCache.set(cacheKey, mw);
    return mw;
  }

  // Dual-rail auth gate for /v1/*:
  // 1) Valid Stripe-provisioned (or demo) x-api-key bypasses x402
  // 2) Otherwise enforce x402 HTTP 402 Payment Required (USDC on Base eip155:8453)
  app.use("/v1/*", async (c, next) => {
    const apiKey = c.req.header("x-api-key");
    if (apiKey && (await isAuthorizedApiKey(apiKey, c.env))) {
      c.header("X-Auth-Rail", "stripe-api-key");
      return next();
    }

    const mw = getX402Middleware(c.env);
    const result = await mw(c, next);
    const response = result instanceof Response ? result : c.res;
    if (response && response.status === 402) {
      const headers = new Headers(response.headers);
      headers.set("X-Auth-Rail", "x402");
      const contentType = headers.get("content-type") || "";
      const paymentHeader =
        headers.get("payment-required") || headers.get("x-payment-required");

      if (contentType.includes("application/json") && paymentHeader) {
        try {
          const decoded = JSON.parse(atob(paymentHeader));
          const enrichedBody = {
            error: "Payment Required",
            protocol: "x402",
            ...decoded,
            stripeAlternative: {
              plan: "FilingPulse Pro — $29/mo (5,000 calls)",
              paymentLink: c.env?.STRIPE_PAYMENT_LINK || DEFAULT_STRIPE_LINK,
              header: "x-api-key",
            },
          };
          headers.delete("content-length");
          const enriched = new Response(JSON.stringify(enrichedBody, null, 2), {
            status: 402,
            headers,
          });
          c.res = enriched;
          return enriched;
        } catch {
          const patched = new Response(response.body, { status: 402, headers });
          c.res = patched;
          return patched;
        }
      }
      const patched = new Response(response.body, { status: 402, headers });
      c.res = patched;
      return patched;
    }
    return result;
  });

  app.get("/v1/signals/:ticker", async (c) => {
    const ticker = c.req.param("ticker").trim().toUpperCase();
    const windowDays = parsePositiveInt(c.req.query("windowDays"), 30, 365);
    const mode = c.req.query("mode");

    const cacheKey = `signal:${ticker}:${windowDays}:${mode || "default"}`;
    if (c.env?.CACHE_KV) {
      const cached = await c.env.CACHE_KV.get(cacheKey);
      if (cached) {
        const parsed = JSON.parse(cached);
        if (parsed?.meta) parsed.meta.cacheHit = true;
        return c.json(parsed);
      }
    }

    try {
      const client = buildFilingClient(c.env, mode);
      const report = await client.getTickerSignal(ticker, { windowDays });
      if (c.env?.CACHE_KV) {
        await c.env.CACHE_KV.put(cacheKey, JSON.stringify(report), {
          expirationTtl: 900,
        });
      }
      return c.json(report);
    } catch (err) {
      if (err instanceof EdgarClientError) {
        return c.json({ error: err.message, ticker }, err.status as 400 | 404 | 502);
      }
      return c.json({ error: "Failed to fetch SEC EDGAR signal", ticker }, 500);
    }
  });

  app.get("/v1/insiders/clusters", async (c) => {
    const rawTickers = c.req.query("tickers");
    const tickers = rawTickers
      ? rawTickers
          .split(",")
          .map((t) => t.trim().toUpperCase())
          .filter(Boolean)
      : undefined;
    const windowDays = parsePositiveInt(c.req.query("windowDays"), 30, 365);
    const minAbsScore = parsePositiveInt(c.req.query("minAbsScore"), 0, 100);
    const mode = c.req.query("mode");

    try {
      const client = buildFilingClient(c.env, mode);
      const clusters = await client.getInsiderClusters({
        tickers,
        windowDays,
        minAbsScore: c.req.query("minAbsScore") ? minAbsScore : 0,
      });
      return c.json(clusters);
    } catch (err) {
      if (err instanceof EdgarClientError) {
        return c.json({ error: err.message }, err.status as 400 | 404 | 502);
      }
      return c.json({ error: "Failed to scan insider clusters" }, 500);
    }
  });

  app.get("/v1/8k/material-diff/:ticker", async (c) => {
    const ticker = c.req.param("ticker").trim().toUpperCase();
    const mode = c.req.query("mode");

    try {
      const client = buildFilingClient(c.env, mode);
      const diff = await client.getEightKMaterialDiff(ticker);
      return c.json(diff);
    } catch (err) {
      if (err instanceof EdgarClientError) {
        return c.json({ error: err.message, ticker }, err.status as 400 | 404 | 502);
      }
      return c.json({ error: "Failed to compute 8-K material diff", ticker }, 500);
    }
  });

  return app;
}

const app = createApp();
export default app;
