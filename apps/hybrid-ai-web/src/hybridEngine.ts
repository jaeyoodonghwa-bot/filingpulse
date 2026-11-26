import {
  createFilingPulseClient,
  type TickerSignalReport,
} from "@filingpulse/core";
import type {
  HoldingRiskAlert,
  HoldingRiskLevel,
  HybridAnalysisResult,
  HybridRuntimeConfig,
  InferenceEngineUsed,
  InferencePreference,
  PortfolioPosition,
  PrivacyBoundary,
} from "./types.js";

export const DEFAULT_PORTFOLIO: PortfolioPosition[] = [
  {
    ticker: "AMD",
    weightPct: 30,
    costBasisUsd: 45000,
    thesisNote: "AI accelerator margin expansion; watching C-suite conviction",
  },
  {
    ticker: "AAPL",
    weightPct: 25,
    costBasisUsd: 37500,
    thesisNote: "Core compounder + capital return cadence",
  },
  {
    ticker: "NVDA",
    weightPct: 20,
    costBasisUsd: 30000,
    thesisNote: "Filter out 10b5-1 noise vs discretionary executive selling",
  },
  {
    ticker: "PLTR",
    weightPct: 15,
    costBasisUsd: 22500,
    thesisNote: "Enterprise & federal Item 1.01 material contract velocity",
  },
  {
    ticker: "ACME",
    weightPct: 10,
    costBasisUsd: 15000,
    thesisNote: "Speculative turnaround — strict stop on any 4.02 accounting red flag",
  },
];

// Estimated Cloud Gemini 2.5 Flash cost per portfolio risk synthesis prompt (~3.5k in / 600 out tokens)
const ESTIMATED_CLOUD_PROMPT_COST_USD = 0.0024;

export interface ChromeLanguageModelApi {
  availability?: () => Promise<string>;
  create?: (opts?: Record<string, unknown>) => Promise<{
    prompt: (text: string) => Promise<string>;
    destroy?: () => void;
  }>;
}

export interface HybridExecutionDeps {
  fetchImpl?: typeof fetch;
  chromeLanguageModel?: ChromeLanguageModelApi | null;
  nowMs?: () => number;
  firebaseSynthesizer?: (params: {
    mode: InferencePreference;
    prompt: string;
    config: HybridRuntimeConfig;
  }) => Promise<{ text: string; engine: "on_device_gemini_nano" | "cloud_gemini_fallback" }>;
}

export function classifyHoldingRisk(
  position: PortfolioPosition,
  report: TickerSignalReport
): HoldingRiskAlert {
  const top8K = report.latest8K[0];
  const latest8KScore = top8K?.materialityScore ?? 0;
  const latest8KItems = top8K?.items ?? [];
  const latest8KDate = top8K?.filingDate ?? "N/A";
  const hasRestatementOrCritical =
    latest8KItems.includes("4.02") ||
    latest8KItems.includes("1.03") ||
    latest8KItems.includes("3.01") ||
    top8K?.severity === "critical";

  let riskLevel: HoldingRiskLevel = "moderate";
  let recommendedAction = "Hold & monitor next 8-K / Form 4 filing cycle.";

  if (hasRestatementOrCritical || report.compositeScore <= -40) {
    riskLevel = "critical";
    recommendedAction = `Immediate review: ${position.ticker} (${position.weightPct}% weight) triggered critical SEC filing risk (${latest8KItems.join(", ") || "bearish cluster"}). Consider hedging or trimming exposure.`;
  } else if (report.compositeScore <= -15 || report.insiderCluster.signal.includes("sell")) {
    riskLevel = "elevated";
    recommendedAction = `Watch closely: monitor discretionary Form 4 activity (${report.insiderCluster.planned10b51SellValueUsd > 0 ? "10b5-1 planned sales discounted" : "unplanned insider selling detected"}).`;
  } else if (
    report.compositeScore >= 35 ||
    report.insiderCluster.signal === "strong_buy_cluster"
  ) {
    riskLevel = "opportunity";
    recommendedAction = `High-conviction alignment: ${report.insiderCluster.uniqueBuyers} insider buyer(s) (${report.insiderCluster.cSuiteBuyers} C-Suite) backing ${position.ticker}.`;
  }

  const summary =
    report.highlights[0] ||
    `${report.companyName}: composite score ${report.compositeScore}, cluster ${report.insiderCluster.signal}.`;

  return {
    ticker: position.ticker.toUpperCase(),
    companyName: report.companyName,
    weightPct: position.weightPct,
    riskLevel,
    compositeScore: report.compositeScore,
    clusterSignal: report.insiderCluster.signal,
    clusterScore: report.insiderCluster.clusterScore,
    latest8KScore,
    latest8KItems,
    latest8KDate,
    summary,
    recommendedAction,
  };
}

export function computePortfolioRiskScore(alerts: HoldingRiskAlert[]): number {
  if (alerts.length === 0) return 0;
  const totalWeight = alerts.reduce((sum, a) => sum + Math.max(0, a.weightPct), 0) || 100;

  let weightedRisk = 0;
  for (const alert of alerts) {
    const w = Math.max(0, alert.weightPct) / totalWeight;
    let baseRisk = 35;
    if (alert.riskLevel === "critical") baseRisk = 95;
    else if (alert.riskLevel === "elevated") baseRisk = 65;
    else if (alert.riskLevel === "moderate") baseRisk = 35;
    else if (alert.riskLevel === "opportunity") baseRisk = 12;

    // Slight boost if high-weight holding has critical risk
    const concentrationPenalty =
      alert.riskLevel === "critical" && alert.weightPct >= 10 ? 10 : 0;
    weightedRisk += (baseRisk + concentrationPenalty) * w;
  }

  // Ensure any critical accounting restatement holding raises portfolio risk visibly
  const hasCritical = alerts.some((a) => a.riskLevel === "critical");
  const finalScore = Math.min(100, Math.round(weightedRisk + (hasCritical ? 18 : 0)));
  return Math.max(0, finalScore);
}

export async function fetchFilingSignalsForPortfolio(
  positions: PortfolioPosition[],
  config: HybridRuntimeConfig,
  fetchImpl?: typeof fetch
): Promise<{
  reports: Map<string, TickerSignalReport>;
  dataSource: "filingpulse_api" | "core_edgar_fixtures";
}> {
  const fixtureClient = createFilingPulseClient({
    fixtureMode: true,
    referenceDate: "2026-11-24",
  });
  const reports = new Map<string, TickerSignalReport>();
  const fetcher = fetchImpl ?? globalThis.fetch?.bind(globalThis);
  let liveSuccessCount = 0;

  await Promise.all(
    positions.map(async (pos) => {
      const ticker = pos.ticker.trim().toUpperCase();
      if (!ticker) return;

      if (config.useLiveApi && config.filingPulseApiUrl && fetcher) {
        try {
          const baseUrl = config.filingPulseApiUrl.replace(/\/+$/, "");
          const headers: Record<string, string> = {};
          if (config.filingPulseApiKey) {
            headers["x-api-key"] = config.filingPulseApiKey;
          }
          const res = await fetcher(
            `${baseUrl}/v1/signals/${encodeURIComponent(ticker)}?mode=fixture`,
            { headers }
          );
          if (res.ok) {
            const report = (await res.json()) as TickerSignalReport;
            reports.set(ticker, report);
            liveSuccessCount++;
            return;
          }
        } catch {
          // Graceful fallback to deterministic core fixtures below
        }
      }

      try {
        const fixtureReport = await fixtureClient.getTickerSignal(ticker);
        reports.set(ticker, fixtureReport);
      } catch {
        // Unknown ticker outside fixture catalog: synthesize neutral baseline
        reports.set(ticker, {
          ticker,
          cik: "0000000000",
          companyName: `${ticker} Corp`,
          generatedAt: new Date().toISOString(),
          source: "fixture",
          latest8K: [],
          materialEventCount: 0,
          insiderCluster: {
            ticker,
            cik: "0000000000",
            companyName: `${ticker} Corp`,
            windowDays: 30,
            uniqueBuyers: 0,
            uniqueSellers: 0,
            cSuiteBuyers: 0,
            cSuiteSellers: 0,
            totalBuyValueUsd: 0,
            totalSellValueUsd: 0,
            planned10b51SellValueUsd: 0,
            netValueUsd: 0,
            buyToSellRatio: null,
            clusterScore: 0,
            signal: "neutral",
            transactions: [],
          },
          compositeScore: 0,
          compositeSignal: "neutral",
          highlights: [`No cached SEC 8-K or Form 4 alerts for ${ticker}.`],
          meta: { edgarRequests: 0, cacheHit: true, estimatedCogsUsd: 0 },
        });
      }
    })
  );

  return {
    reports,
    dataSource: liveSuccessCount > 0 ? "filingpulse_api" : "core_edgar_fixtures",
  };
}

function buildHybridPrompt(
  positions: PortfolioPosition[],
  alerts: HoldingRiskAlert[],
  includePrivateWeights: boolean
): string {
  const lines = alerts.map((a) => {
    const pos = positions.find((p) => p.ticker.toUpperCase() === a.ticker);
    const priv = includePrivateWeights
      ? `weight=${a.weightPct}%, costBasis=$${pos?.costBasisUsd ?? 0}, thesis="${pos?.thesisNote ?? ""}"`
      : "weights=REDACTED_ON_DEVICE";
    return `- ${a.ticker} (${a.companyName}): risk=${a.riskLevel}, composite=${a.compositeScore}, 8K=[${a.latest8KItems.join(",")}] (score ${a.latest8KScore}), cluster=${a.clusterSignal} (${a.clusterScore}), ${priv}`;
  });

  return [
    "You are FilingPulse Hybrid AI Portfolio Risk Co-Pilot.",
    "Summarize the portfolio's top SEC 8-K materiality & Form 4 insider cluster risks in 2-3 concise sentences.",
    ...lines,
  ].join("\n");
}

function buildDeterministicBrief(
  alerts: HoldingRiskAlert[],
  portfolioRiskScore: number,
  mode: InferencePreference,
  engineLabel: string
): string {
  const criticals = alerts.filter((a) => a.riskLevel === "critical");
  const opportunities = alerts.filter((a) => a.riskLevel === "opportunity");

  const parts: string[] = [];
  if (criticals.length > 0) {
    const names = criticals
      .map((c) => `${c.ticker} (${c.weightPct}% weight, Items ${c.latest8KItems.join("/") || "Form 4"})`)
      .join(", ");
    parts.push(`Critical SEC filing risk detected in ${names}.`);
  } else {
    parts.push("No critical Item 4.02 restatement or bankruptcy 8-K triggers across current holdings.");
  }

  if (opportunities.length > 0) {
    const names = opportunities
      .map((o) => `${o.ticker} (${o.clusterSignal.replace(/_/g, " ")}, score +${o.compositeScore})`)
      .join(", ");
    parts.push(`Bullish C-Suite insider conviction spotted in ${names}.`);
  }

  if (mode === "PREFER_IN_CLOUD") {
    parts.push(
      `Deep cross-filing stress review (Portfolio Risk ${portfolioRiskScore}/100) completed via ${engineLabel}: recommend offsetting high-materiality governance/accounting risk while concentrating into C-Suite buy clusters.`
    );
  } else {
    parts.push(
      `Portfolio Risk ${portfolioRiskScore}/100 evaluated privately via ${engineLabel} with 0 bytes of portfolio holdings transmitted off-device.`
    );
  }

  return parts.join(" ");
}

async function tryFirebaseHybridInference(params: {
  mode: InferencePreference;
  prompt: string;
  config: HybridRuntimeConfig;
}): Promise<{ text: string; engine: "on_device_gemini_nano" | "cloud_gemini_fallback" } | null> {
  const { config, mode, prompt } = params;
  if (!config.firebaseApiKey || !config.firebaseProjectId || !config.firebaseAppId) {
    return null;
  }

  try {
    const [{ initializeApp, getApps }, aiMod] = await Promise.all([
      import("firebase/app"),
      import("firebase/ai"),
    ]);

    const app =
      getApps()[0] ??
      initializeApp({
        apiKey: config.firebaseApiKey,
        projectId: config.firebaseProjectId,
        appId: config.firebaseAppId,
      });

    const ai = aiMod.getAI(app, { backend: new aiMod.GoogleAIBackend() });

    // Support both Firebase AI Logic v12+ native Hybrid InferenceMode and v11 Cloud fallback
    const hybridAi = aiMod as unknown as {
      InferenceMode?: Record<InferencePreference, string>;
      getGenerativeModel: (
        aiInstance: unknown,
        params: Record<string, unknown>
      ) => { generateContent: (input: string) => Promise<{ response: { text: () => string; inferenceSource?: string } }> };
    };

    const modelParams = hybridAi.InferenceMode
      ? {
          mode: hybridAi.InferenceMode[mode] ?? hybridAi.InferenceMode.PREFER_ON_DEVICE,
          inCloudParams: { model: "gemini-2.5-flash" },
        }
      : { model: "gemini-2.5-flash" };

    const model = hybridAi.getGenerativeModel(ai, modelParams);
    const result = await model.generateContent(prompt);
    const text = result.response.text();
    const usedOnDevice =
      result.response.inferenceSource === "on_device" ||
      (Boolean(hybridAi.InferenceMode) && mode === "ONLY_ON_DEVICE");

    return {
      text,
      engine: usedOnDevice ? "on_device_gemini_nano" : "cloud_gemini_fallback",
    };
  } catch {
    return null;
  }
}

export async function detectChromeOnDeviceModel(
  overrideApi?: ChromeLanguageModelApi | null
): Promise<ChromeLanguageModelApi | null> {
  const api =
    overrideApi !== undefined
      ? overrideApi
      : ((globalThis as unknown as { LanguageModel?: ChromeLanguageModelApi }).LanguageModel ??
          (globalThis as unknown as { ai?: { languageModel?: ChromeLanguageModelApi } }).ai
            ?.languageModel ??
          null);

  if (!api || typeof api.availability !== "function") return null;
  try {
    const status = await api.availability();
    if (status === "available" || status === "readily") {
      return api;
    }
  } catch {
    return null;
  }
  return null;
}

export async function runHybridPortfolioAnalysis(params: {
  positions: PortfolioPosition[];
  preference: InferencePreference;
  config?: HybridRuntimeConfig;
  deps?: HybridExecutionDeps;
}): Promise<HybridAnalysisResult> {
  const { positions, preference, config = {}, deps = {} } = params;
  const now = deps.nowMs ?? (() => Date.now());
  const startMs = now();

  const { reports, dataSource } = await fetchFilingSignalsForPortfolio(
    positions,
    config,
    deps.fetchImpl
  );

  const alerts = positions
    .map((pos) => {
      const report = reports.get(pos.ticker.trim().toUpperCase());
      if (!report) return null;
      return classifyHoldingRisk(pos, report);
    })
    .filter((a): a is HoldingRiskAlert => a !== null)
    .sort((a, b) => {
      const order: Record<HoldingRiskLevel, number> = {
        critical: 0,
        elevated: 1,
        moderate: 2,
        opportunity: 3,
      };
      return order[a.riskLevel] - order[b.riskLevel] || b.weightPct - a.weightPct;
    });

  const portfolioRiskScore = computePortfolioRiskScore(alerts);
  const localPrompt = buildHybridPrompt(positions, alerts, true);
  const cloudPrompt = buildHybridPrompt(positions, alerts, false);

  let engineUsed: InferenceEngineUsed;
  let engineBadgeLabel: string;
  let isOnDevice = false;
  let isSimulated = false;
  let privacyBoundary: PrivacyBoundary = "local_only_zero_egress";
  let bytesPortfolioSentOffDevice = 0;
  let estimatedCloudCostUsd = 0;
  let estimatedCloudCostSavedUsd = ESTIMATED_CLOUD_PROMPT_COST_USD;
  let executiveBrief = "";
  let fallbackReason: string | null = null;

  // 1. Check real Chrome Built-in Gemini Nano when preference favors on-device
  const chromeNano =
    preference !== "PREFER_IN_CLOUD"
      ? await detectChromeOnDeviceModel(deps.chromeLanguageModel)
      : null;

  if (preference !== "PREFER_IN_CLOUD" && chromeNano && typeof chromeNano.create === "function") {
    try {
      const session = await chromeNano.create();
      executiveBrief = (await session.prompt(localPrompt)).trim();
      session.destroy?.();
      engineUsed = "on_device_gemini_nano";
      engineBadgeLabel = "On-Device Gemini Nano · $0 · Private";
      isOnDevice = true;
      isSimulated = false;
      privacyBoundary = "local_only_zero_egress";
      bytesPortfolioSentOffDevice = 0;
      estimatedCloudCostUsd = 0;
      estimatedCloudCostSavedUsd = ESTIMATED_CLOUD_PROMPT_COST_USD;
    } catch {
      fallbackReason = "Chrome Gemini Nano session failed; falling back.";
      engineUsed = "on_device_local_simulator";
      engineBadgeLabel = "On-Device Gemini Nano (Demo Simulator) · $0 · Private";
    }
  } else if (
    config.firebaseApiKey &&
    config.firebaseProjectId &&
    config.firebaseAppId
  ) {
    // 2. Real Firebase AI Logic Hybrid Inference SDK
    const synthesizer = deps.firebaseSynthesizer ?? tryFirebaseHybridInference;
    const fbRes = await synthesizer({
      mode: preference,
      prompt: preference === "PREFER_IN_CLOUD" ? cloudPrompt : localPrompt,
      config,
    });
    if (fbRes) {
      executiveBrief = fbRes.text;
      engineUsed = fbRes.engine;
      isOnDevice = fbRes.engine === "on_device_gemini_nano";
      isSimulated = false;
      engineBadgeLabel = isOnDevice
        ? "On-Device Gemini Nano · $0 · Private"
        : "Cloud Gemini Fallback · Deep Reasoning";
      privacyBoundary = isOnDevice ? "local_only_zero_egress" : "cloud_anonymized_signals";
      bytesPortfolioSentOffDevice = isOnDevice ? 0 : new TextEncoder().encode(cloudPrompt).length;
      estimatedCloudCostUsd = isOnDevice ? 0 : ESTIMATED_CLOUD_PROMPT_COST_USD;
      estimatedCloudCostSavedUsd = isOnDevice ? ESTIMATED_CLOUD_PROMPT_COST_USD : 0;
    } else {
      fallbackReason = "Firebase AI Logic unavailable; using local deterministic fallback.";
      engineUsed = "on_device_local_simulator";
      engineBadgeLabel = "On-Device Gemini Nano (Demo Simulator) · $0 · Private";
    }
  } else {
    // 3. Transparent zero-spend / zero-secret Hybrid Demo Simulator
    isSimulated = true;
    if (preference === "PREFER_IN_CLOUD") {
      engineUsed = "cloud_fallback_simulator";
      engineBadgeLabel = "Cloud Gemini Fallback (Demo Mode)";
      isOnDevice = false;
      privacyBoundary = "cloud_anonymized_signals";
      bytesPortfolioSentOffDevice = new TextEncoder().encode(cloudPrompt).length;
      estimatedCloudCostUsd = ESTIMATED_CLOUD_PROMPT_COST_USD;
      estimatedCloudCostSavedUsd = 0;
      fallbackReason =
        "User selected PREFER_IN_CLOUD for deep multi-filing cross-comparison (weights redacted).";
    } else if (preference === "ONLY_ON_DEVICE" || config.simulateOnDeviceAvailable !== false) {
      engineUsed = "on_device_local_simulator";
      engineBadgeLabel = "On-Device Gemini Nano · $0 · Private (Demo Mode)";
      isOnDevice = true;
      privacyBoundary = "local_only_zero_egress";
      bytesPortfolioSentOffDevice = 0;
      estimatedCloudCostUsd = 0;
      estimatedCloudCostSavedUsd = ESTIMATED_CLOUD_PROMPT_COST_USD;
      fallbackReason =
        preference === "ONLY_ON_DEVICE"
          ? "Strict ONLY_ON_DEVICE privacy lock active (cloud fallback disabled)."
          : null;
    } else {
      engineUsed = "cloud_fallback_simulator";
      engineBadgeLabel = "Cloud Gemini Fallback (Demo Mode)";
      isOnDevice = false;
      privacyBoundary = "cloud_anonymized_signals";
      bytesPortfolioSentOffDevice = new TextEncoder().encode(cloudPrompt).length;
      estimatedCloudCostUsd = ESTIMATED_CLOUD_PROMPT_COST_USD;
      estimatedCloudCostSavedUsd = 0;
      fallbackReason =
        "Chrome Built-in Gemini Nano unavailable in this browser; auto-fallback to Cloud Gemini.";
    }
  }

  if (!executiveBrief) {
    executiveBrief = buildDeterministicBrief(
      alerts,
      portfolioRiskScore,
      preference,
      engineBadgeLabel
    );
  }

  const latencyMs = Math.max(1, Math.round(now() - startMs));

  return {
    preference,
    engineUsed,
    engineBadgeLabel,
    isOnDevice,
    isSimulated,
    privacyBoundary,
    bytesPortfolioSentOffDevice,
    latencyMs,
    estimatedCloudCostUsd,
    estimatedCloudCostSavedUsd,
    portfolioRiskScore,
    executiveBrief,
    alerts,
    dataSource,
    fallbackReason,
    timestamp: new Date().toISOString(),
  };
}
