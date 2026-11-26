import { describe, expect, it } from "vitest";
import {
  DEFAULT_PORTFOLIO,
  runHybridPortfolioAnalysis,
  type ChromeLanguageModelApi,
} from "../src/hybridEngine.js";

describe("FilingPulse Hybrid AI Portfolio Risk Engine (#BuildHybridAI)", () => {
  it("routes PREFER_ON_DEVICE to Chrome Gemini Nano when available with $0 cloud cost & 0B portfolio egress", async () => {
    const mockNano: ChromeLanguageModelApi = {
      async availability() {
        return "available";
      },
      async create() {
        return {
          async prompt(text: string) {
            expect(text).toContain("ACME");
            expect(text).toContain("AMD");
            return "On-device Gemini Nano summary: ACME Item 4.02 requires immediate review; AMD shows C-Suite buying.";
          },
          destroy() {},
        };
      },
    };

    const result = await runHybridPortfolioAnalysis({
      positions: DEFAULT_PORTFOLIO,
      preference: "PREFER_ON_DEVICE",
      deps: { chromeLanguageModel: mockNano },
    });

    expect(result.engineUsed).toBe("on_device_gemini_nano");
    expect(result.isOnDevice).toBe(true);
    expect(result.isSimulated).toBe(false);
    expect(result.bytesPortfolioSentOffDevice).toBe(0);
    expect(result.estimatedCloudCostUsd).toBe(0);
    expect(result.estimatedCloudCostSavedUsd).toBeGreaterThan(0);
    expect(result.privacyBoundary).toBe("local_only_zero_egress");
    expect(result.executiveBrief).toContain("On-device Gemini Nano summary");
  });

  it("automatically falls back to Cloud Gemini simulator when Gemini Nano is unavailable", async () => {
    const result = await runHybridPortfolioAnalysis({
      positions: DEFAULT_PORTFOLIO,
      preference: "PREFER_ON_DEVICE",
      config: { simulateOnDeviceAvailable: false },
      deps: { chromeLanguageModel: null },
    });

    expect(result.engineUsed).toBe("cloud_fallback_simulator");
    expect(result.isOnDevice).toBe(false);
    expect(result.privacyBoundary).toBe("cloud_anonymized_signals");
    expect(result.estimatedCloudCostUsd).toBeGreaterThan(0);
    expect(result.fallbackReason).toContain("auto-fallback to Cloud Gemini");
  });

  it("enforces ONLY_ON_DEVICE privacy lock even when Chrome Nano is absent", async () => {
    const result = await runHybridPortfolioAnalysis({
      positions: DEFAULT_PORTFOLIO,
      preference: "ONLY_ON_DEVICE",
      config: { simulateOnDeviceAvailable: false },
      deps: { chromeLanguageModel: null },
    });

    expect(result.isOnDevice).toBe(true);
    expect(result.bytesPortfolioSentOffDevice).toBe(0);
    expect(result.privacyBoundary).toBe("local_only_zero_egress");
    expect(result.fallbackReason).toContain("Strict ONLY_ON_DEVICE");
  });

  it("routes PREFER_IN_CLOUD explicitly to Cloud Gemini deep cross-filing mode", async () => {
    const result = await runHybridPortfolioAnalysis({
      positions: DEFAULT_PORTFOLIO,
      preference: "PREFER_IN_CLOUD",
      deps: { chromeLanguageModel: null },
    });

    expect(result.engineUsed).toBe("cloud_fallback_simulator");
    expect(result.isOnDevice).toBe(false);
    expect(result.privacyBoundary).toBe("cloud_anonymized_signals");
  });

  it("flags ACME Item 4.02 restatement as critical risk and AMD C-Suite cluster as opportunity", async () => {
    const result = await runHybridPortfolioAnalysis({
      positions: DEFAULT_PORTFOLIO,
      preference: "PREFER_ON_DEVICE",
      deps: { chromeLanguageModel: null },
    });

    const acme = result.alerts.find((a) => a.ticker === "ACME");
    const amd = result.alerts.find((a) => a.ticker === "AMD");

    expect(acme).toBeDefined();
    expect(acme?.riskLevel).toBe("critical");
    expect(acme?.latest8KItems).toContain("4.02");

    expect(amd).toBeDefined();
    expect(amd?.riskLevel).toBe("opportunity");
    expect(amd?.clusterSignal).toBe("strong_buy_cluster");

    expect(result.portfolioRiskScore).toBeGreaterThanOrEqual(40);
  });

  it("consumes live FilingPulse x402 API when configured and falls back gracefully on HTTP 402", async () => {
    const mockFetch: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("/v1/signals/AMD")) {
        return new Response(
          JSON.stringify({
            ticker: "AMD",
            cik: "0000002488",
            companyName: "ADVANCED MICRO DEVICES INC",
            generatedAt: "2026-11-24T08:00:00Z",
            source: "fixture",
            latest8K: [
              {
                accessionNumber: "0000002488-26-000210",
                filingDate: "2026-11-22",
                reportDate: "2026-11-21",
                items: ["1.01"],
                materialItems: [],
                primaryDocument: "amd.htm",
                filingUrl: "https://www.sec.gov/",
                materialityScore: 80,
                severity: "high",
                direction: "bullish",
                summary: "Material Agreement",
                tags: ["m_and_a"],
              },
            ],
            materialEventCount: 1,
            insiderCluster: {
              ticker: "AMD",
              cik: "0000002488",
              companyName: "ADVANCED MICRO DEVICES INC",
              windowDays: 30,
              uniqueBuyers: 3,
              uniqueSellers: 0,
              cSuiteBuyers: 3,
              cSuiteSellers: 0,
              totalBuyValueUsd: 6000000,
              totalSellValueUsd: 0,
              planned10b51SellValueUsd: 0,
              netValueUsd: 6000000,
              buyToSellRatio: 999,
              clusterScore: 95,
              signal: "strong_buy_cluster",
              transactions: [],
            },
            compositeScore: 88,
            compositeSignal: "bullish",
            highlights: ["Live API signal verified"],
            meta: { edgarRequests: 0, cacheHit: true, estimatedCogsUsd: 0.00051 },
          }),
          { status: 200, headers: { "content-type": "application/json" } }
        );
      }
      // Simulate HTTP 402 for unpaid ticker -> graceful fallback to local fixtures
      return new Response(JSON.stringify({ error: "Payment Required" }), { status: 402 });
    };

    const result = await runHybridPortfolioAnalysis({
      positions: DEFAULT_PORTFOLIO.slice(0, 2),
      preference: "PREFER_ON_DEVICE",
      config: {
        useLiveApi: true,
        filingPulseApiUrl: "http://127.0.0.1:8787",
        filingPulseApiKey: "fp_demo_preview_2026",
      },
      deps: { fetchImpl: mockFetch, chromeLanguageModel: null },
    });

    expect(result.dataSource).toBe("filingpulse_api");
    expect(result.alerts).toHaveLength(2);
    expect(result.alerts.find((a) => a.ticker === "AMD")?.compositeScore).toBe(88);
  });
});
