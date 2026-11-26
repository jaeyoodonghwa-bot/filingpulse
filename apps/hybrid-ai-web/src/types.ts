export type InferencePreference =
  | "PREFER_ON_DEVICE"
  | "PREFER_IN_CLOUD"
  | "ONLY_ON_DEVICE";

export type InferenceEngineUsed =
  | "on_device_gemini_nano"
  | "cloud_gemini_fallback"
  | "on_device_local_simulator"
  | "cloud_fallback_simulator";

export type PrivacyBoundary = "local_only_zero_egress" | "cloud_anonymized_signals";

export type HoldingRiskLevel = "critical" | "elevated" | "moderate" | "opportunity";

export interface PortfolioPosition {
  ticker: string;
  weightPct: number;
  costBasisUsd: number;
  thesisNote: string;
}

export interface HoldingRiskAlert {
  ticker: string;
  companyName: string;
  weightPct: number;
  riskLevel: HoldingRiskLevel;
  compositeScore: number;
  clusterSignal: string;
  clusterScore: number;
  latest8KScore: number;
  latest8KItems: string[];
  latest8KDate: string;
  summary: string;
  recommendedAction: string;
}

export interface HybridRuntimeConfig {
  firebaseApiKey?: string;
  firebaseProjectId?: string;
  firebaseAppId?: string;
  filingPulseApiUrl?: string;
  filingPulseApiKey?: string;
  useLiveApi?: boolean;
  simulateOnDeviceAvailable?: boolean;
}

export interface HybridAnalysisResult {
  preference: InferencePreference;
  engineUsed: InferenceEngineUsed;
  engineBadgeLabel: string;
  isOnDevice: boolean;
  isSimulated: boolean;
  privacyBoundary: PrivacyBoundary;
  bytesPortfolioSentOffDevice: number;
  latencyMs: number;
  estimatedCloudCostUsd: number;
  estimatedCloudCostSavedUsd: number;
  portfolioRiskScore: number; // 0 (low risk) .. 100 (critical risk)
  executiveBrief: string;
  alerts: HoldingRiskAlert[];
  dataSource: "filingpulse_api" | "core_edgar_fixtures";
  fallbackReason: string | null;
  timestamp: string;
}
