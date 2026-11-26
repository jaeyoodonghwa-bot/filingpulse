export const EVENT_NAME = "filing-signal" as const;
export const EVENT_PRICE_USD = 0.005;
export const DEFAULT_MAX_ITEMS = 20;
export const HARD_MAX_ITEMS = 200;
export const DEFAULT_LOOKBACK_DAYS = 30;
export const DEFAULT_USER_AGENT = "FilingPulse/1.0 (contact@filingpulse.dev)";

export interface ActorInput {
  tickers?: string[];
  include8k?: boolean;
  includeForm4?: boolean;
  includeMaterialDiff?: boolean;
  maxItems?: number;
  lookbackDays?: number;
  userAgent?: string;
  fixtureMode?: boolean;
}

export interface NormalizedActorInput {
  tickers: string[];
  include8k: boolean;
  includeForm4: boolean;
  includeMaterialDiff: boolean;
  maxItems: number;
  lookbackDays: number;
  userAgent: string;
  fixtureMode: boolean;
}

export interface FilingSignalRecord {
  ticker: string;
  cik: string;
  companyName?: string;
  signalType: "8k-material-event" | "form4-insider-cluster" | "8k-material-diff";
  formType: string;
  filedAt: string;
  severity: "low" | "medium" | "high" | "critical";
  score: number;
  items?: string[];
  summary: string;
  filingUrl: string;
  source: "sec-edgar" | "fixture";
  details?: Record<string, unknown>;
}

export type FilingSignalProvider = (
  ticker: string,
  options: NormalizedActorInput
) => Promise<FilingSignalRecord[]>;

export type EmitAndChargeFn = (
  record: FilingSignalRecord
) => Promise<{ limitReached: boolean }>;

export interface PipelineResult {
  tickersProcessed: number;
  emittedCount: number;
  chargedCount: number;
  stoppedByMaxItems: boolean;
  stoppedByBudget: boolean;
  estimatedChargeUsd: number;
}

const TICKER_REGEX = /^[A-Z][A-Z0-9.-]{0,9}$/;

export function normalizeInput(raw: ActorInput = {}): NormalizedActorInput {
  const rawTickers = Array.isArray(raw.tickers) && raw.tickers.length > 0
    ? raw.tickers
    : ["AAPL", "NVDA"];

  const deduped: string[] = [];
  const seen = new Set<string>();
  for (const item of rawTickers) {
    if (typeof item !== "string") continue;
    const cleaned = item.trim().toUpperCase();
    if (!cleaned || !TICKER_REGEX.test(cleaned) || seen.has(cleaned)) continue;
    seen.add(cleaned);
    deduped.push(cleaned);
    if (deduped.length >= 25) break;
  }

  if (deduped.length === 0) {
    throw new Error(
      "At least one valid stock ticker (e.g., AAPL, NVDA) is required."
    );
  }

  const parsedMaxItems =
    typeof raw.maxItems === "number" && Number.isFinite(raw.maxItems)
      ? Math.floor(raw.maxItems)
      : DEFAULT_MAX_ITEMS;

  const maxItems = Math.max(1, Math.min(HARD_MAX_ITEMS, parsedMaxItems));

  const parsedLookback =
    typeof raw.lookbackDays === "number" && Number.isFinite(raw.lookbackDays)
      ? Math.floor(raw.lookbackDays)
      : DEFAULT_LOOKBACK_DAYS;

  const lookbackDays = Math.max(1, Math.min(365, parsedLookback));

  const userAgent =
    typeof raw.userAgent === "string" && raw.userAgent.trim().length > 0
      ? raw.userAgent.trim()
      : DEFAULT_USER_AGENT;

  return {
    tickers: deduped,
    include8k: raw.include8k !== false,
    includeForm4: raw.includeForm4 !== false,
    includeMaterialDiff: raw.includeMaterialDiff !== false,
    maxItems,
    lookbackDays,
    userAgent,
    fixtureMode: raw.fixtureMode === true,
  };
}

export async function runSignalPipeline(
  input: NormalizedActorInput,
  provider: FilingSignalProvider,
  emitAndCharge: EmitAndChargeFn
): Promise<PipelineResult> {
  let tickersProcessed = 0;
  let emittedCount = 0;
  let chargedCount = 0;
  let stoppedByMaxItems = false;
  let stoppedByBudget = false;

  for (const ticker of input.tickers) {
    if (emittedCount >= input.maxItems) {
      stoppedByMaxItems = true;
      break;
    }

    const records = await provider(ticker, input);
    tickersProcessed += 1;

    for (const record of records) {
      if (emittedCount >= input.maxItems) {
        stoppedByMaxItems = true;
        break;
      }

      const { limitReached } = await emitAndCharge(record);
      emittedCount += 1;
      chargedCount += 1;

      if (limitReached) {
        stoppedByBudget = true;
        break;
      }
    }

    if (stoppedByBudget || stoppedByMaxItems) {
      break;
    }
  }

  return {
    tickersProcessed,
    emittedCount,
    chargedCount,
    stoppedByMaxItems,
    stoppedByBudget,
    estimatedChargeUsd: Number((chargedCount * EVENT_PRICE_USD).toFixed(4)),
  };
}
