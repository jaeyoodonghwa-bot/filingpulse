export type EightKItemCode =
  | "1.01"
  | "1.02"
  | "1.03"
  | "1.05"
  | "2.01"
  | "2.02"
  | "2.04"
  | "2.05"
  | "2.06"
  | "3.01"
  | "3.02"
  | "4.01"
  | "4.02"
  | "5.01"
  | "5.02"
  | "5.03"
  | "5.07"
  | "7.01"
  | "8.01"
  | "9.01";

export type EventSeverity = "critical" | "high" | "medium" | "low";
export type SignalDirection = "bullish" | "bearish" | "neutral" | "mixed";

export interface TickerCikEntry {
  ticker: string;
  cik: string; // 10-digit zero-padded CIK
  companyName: string;
  sic?: string;
  sicDescription?: string;
}

export interface EightKItemDetail {
  code: string;
  title: string;
  category:
    | "m_and_a"
    | "earnings"
    | "accounting_risk"
    | "governance"
    | "cybersecurity"
    | "capital_markets"
    | "other";
  weight: number;
  bias: SignalDirection;
}

export interface EightKEvent {
  accessionNumber: string;
  filingDate: string;
  reportDate: string;
  items: string[];
  materialItems: EightKItemDetail[];
  primaryDocument: string;
  filingUrl: string;
  materialityScore: number; // 0..100
  severity: EventSeverity;
  direction: SignalDirection;
  summary: string;
  tags: string[];
}

export type Form4TransactionCode = "P" | "S" | "A" | "M" | "F" | "G" | "J" | "OTHER";

export interface Form4Transaction {
  accessionNumber: string;
  filingDate: string;
  transactionDate: string;
  insiderName: string;
  insiderTitle: string;
  isOfficer: boolean;
  isDirector: boolean;
  isTenPercentOwner: boolean;
  transactionCode: Form4TransactionCode;
  shares: number;
  pricePerShare: number;
  totalValueUsd: number;
  sharesOwnedFollowing: number;
  is10b51Plan: boolean;
  filingUrl: string;
}

export type ClusterSignalLabel =
  | "strong_buy_cluster"
  | "moderate_buy_cluster"
  | "neutral"
  | "moderate_sell_cluster"
  | "strong_sell_cluster";

export interface InsiderClusterSignal {
  ticker: string;
  cik: string;
  companyName: string;
  windowDays: number;
  uniqueBuyers: number;
  uniqueSellers: number;
  cSuiteBuyers: number;
  cSuiteSellers: number;
  totalBuyValueUsd: number;
  totalSellValueUsd: number;
  planned10b51SellValueUsd: number;
  netValueUsd: number;
  buyToSellRatio: number | null;
  clusterScore: number; // -100..+100
  signal: ClusterSignalLabel;
  transactions: Form4Transaction[];
}

export interface TickerSignalReport {
  ticker: string;
  cik: string;
  companyName: string;
  generatedAt: string;
  source: "live_edgar" | "fixture";
  latest8K: EightKEvent[];
  materialEventCount: number;
  insiderCluster: InsiderClusterSignal;
  compositeScore: number; // -100..+100
  compositeSignal: "bullish" | "slightly_bullish" | "neutral" | "slightly_bearish" | "bearish";
  highlights: string[];
  meta: {
    edgarRequests: number;
    cacheHit: boolean;
    estimatedCogsUsd: number;
  };
}

export interface EightKMaterialDiff {
  ticker: string;
  cik: string;
  companyName: string;
  generatedAt: string;
  source: "live_edgar" | "fixture";
  currentFiling: EightKEvent | null;
  previousFiling: EightKEvent | null;
  addedItems: EightKItemDetail[];
  removedItems: EightKItemDetail[];
  persistedItems: EightKItemDetail[];
  materialityDelta: number;
  severityShift: string;
  headlineDelta: string;
  highlights: string[];
}

export interface InsiderClustersResponse {
  generatedAt: string;
  source: "live_edgar" | "fixture";
  windowDays: number;
  scannedTickers: number;
  clusters: InsiderClusterSignal[];
}

export interface EdgarRecentFilings {
  accessionNumber: string[];
  filingDate: string[];
  reportDate: string[];
  form: string[];
  primaryDocument: string[];
  items?: string[][];
}

export interface EdgarSubmissionsPayload {
  cik: string;
  name: string;
  sic?: string;
  sicDescription?: string;
  tickers?: string[];
  filings: {
    recent: EdgarRecentFilings;
  };
}

export interface FilingPulseClientOptions {
  userAgent?: string;
  fixtureMode?: boolean;
  fallbackToFixtureOnError?: boolean;
  fetchImpl?: typeof fetch;
  referenceDate?: string; // ISO date YYYY-MM-DD for deterministic windowing
}
