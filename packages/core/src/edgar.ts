import { BUILTIN_TICKER_MAP, FIXTURE_DATA, FIXTURE_TICKERS } from "./fixtures.js";
import {
  buildTickerSignalReport,
  computeEightKMaterialDiff,
  padCik,
  parseEightKEvents,
  parseForm4Xml,
  scoreInsiderCluster,
} from "./scoring.js";
import type {
  EdgarSubmissionsPayload,
  EightKMaterialDiff,
  FilingPulseClientOptions,
  Form4Transaction,
  InsiderClustersResponse,
  TickerCikEntry,
  TickerSignalReport,
} from "./types.js";

const DEFAULT_USER_AGENT = "FilingPulse/1.0 (ops@filingpulse.dev)";
const DEFAULT_CLUSTER_UNIVERSE = ["AMD", "AAPL", "PLTR", "MSFT", "NVDA", "TSLA", "ACME"];

export class EdgarClientError extends Error {
  readonly status: number;

  constructor(message: string, status = 500) {
    super(message);
    this.name = "EdgarClientError";
    this.status = status;
  }
}

export class FilingPulseClient {
  private readonly userAgent: string;
  private readonly fixtureMode: boolean;
  private readonly fallbackToFixtureOnError: boolean;
  private readonly fetchImpl: typeof fetch;
  private readonly referenceDate?: string;
  private tickerCache: Map<string, TickerCikEntry> = new Map();
  private remoteTickersLoaded = false;

  constructor(options: FilingPulseClientOptions = {}) {
    this.userAgent = options.userAgent || DEFAULT_USER_AGENT;
    this.fixtureMode = Boolean(options.fixtureMode);
    this.fallbackToFixtureOnError = options.fallbackToFixtureOnError ?? false;
    this.fetchImpl = options.fetchImpl ?? globalThis.fetch.bind(globalThis);
    this.referenceDate = options.referenceDate;

    for (const [ticker, entry] of Object.entries(BUILTIN_TICKER_MAP)) {
      this.tickerCache.set(ticker.toUpperCase(), entry);
    }
  }

  private get headers(): Record<string, string> {
    return {
      "User-Agent": this.userAgent,
      Accept: "application/json, application/xml, text/xml;q=0.9, */*;q=0.8",
    };
  }

  async resolveTickerToCik(rawTicker: string): Promise<TickerCikEntry> {
    const ticker = rawTicker.trim().toUpperCase().replace(/[^A-Z0-9.-]/g, "");
    if (!ticker) {
      throw new EdgarClientError("Invalid ticker symbol", 400);
    }

    const cached = this.tickerCache.get(ticker);
    if (cached) return cached;

    if (this.fixtureMode) {
      throw new EdgarClientError(`Unknown fixture ticker: ${ticker}`, 404);
    }

    if (!this.remoteTickersLoaded) {
      const res = await this.fetchImpl("https://www.sec.gov/files/company_tickers.json", {
        headers: this.headers,
      });
      if (!res.ok) {
        throw new EdgarClientError(`SEC company_tickers lookup failed (${res.status})`, 502);
      }
      const data = (await res.json()) as Record<
        string,
        { cik_str: number | string; ticker: string; title: string }
      >;
      for (const row of Object.values(data)) {
        if (!row?.ticker) continue;
        const sym = row.ticker.toUpperCase();
        this.tickerCache.set(sym, {
          ticker: sym,
          cik: padCik(row.cik_str),
          companyName: row.title || sym,
        });
      }
      this.remoteTickersLoaded = true;
    }

    const resolved = this.tickerCache.get(ticker);
    if (!resolved) {
      throw new EdgarClientError(`Ticker not found in SEC EDGAR registry: ${ticker}`, 404);
    }
    return resolved;
  }

  private async fetchSubmissions(
    entry: TickerCikEntry
  ): Promise<{ payload: EdgarSubmissionsPayload; source: "live_edgar" | "fixture"; requests: number }> {
    const fixture = FIXTURE_DATA[entry.ticker];
    if (this.fixtureMode) {
      if (!fixture) {
        throw new EdgarClientError(`No fixture dataset for ticker ${entry.ticker}`, 404);
      }
      return { payload: fixture.submissions, source: "fixture", requests: 0 };
    }

    try {
      const url = `https://data.sec.gov/submissions/CIK${padCik(entry.cik)}.json`;
      const res = await this.fetchImpl(url, { headers: this.headers });
      if (!res.ok) {
        throw new EdgarClientError(`SEC EDGAR submissions returned HTTP ${res.status}`, 502);
      }
      const payload = (await res.json()) as EdgarSubmissionsPayload;
      return { payload, source: "live_edgar", requests: 1 };
    } catch (err) {
      if (this.fallbackToFixtureOnError && fixture) {
        return { payload: fixture.submissions, source: "fixture", requests: 0 };
      }
      throw err;
    }
  }

  private async fetchForm4Transactions(
    entry: TickerCikEntry,
    payload: EdgarSubmissionsPayload,
    source: "live_edgar" | "fixture",
    maxForm4s = 8
  ): Promise<{ transactions: Form4Transaction[]; requests: number }> {
    const recent = payload.filings?.recent;
    if (!recent || !Array.isArray(recent.form)) {
      return { transactions: [], requests: 0 };
    }

    const transactions: Form4Transaction[] = [];
    let requests = 0;
    let processed = 0;

    for (let i = 0; i < recent.form.length && processed < maxForm4s; i++) {
      const form = recent.form[i];
      if (form !== "4" && form !== "4/A") continue;

      const accessionNumber = recent.accessionNumber[i] ?? "";
      const filingDate = recent.filingDate[i] ?? "";
      const primaryDocument = recent.primaryDocument?.[i] ?? "";
      if (!accessionNumber || !primaryDocument) continue;
      processed++;

      let xml = "";
      if (source === "fixture") {
        xml = FIXTURE_DATA[entry.ticker]?.form4XmlByAccession[accessionNumber] ?? "";
      } else {
        // SEC sometimes prefixes primaryDocument with XSL stylesheet path (e.g. xslF345X05/form4.xml)
        const rawDoc = primaryDocument.includes("/")
          ? primaryDocument.split("/").pop() || primaryDocument
          : primaryDocument;
        const numericCik = String(Number(padCik(entry.cik)));
        const cleanAcc = accessionNumber.replace(/-/g, "");
        const xmlUrl = `https://www.sec.gov/Archives/edgar/data/${numericCik}/${cleanAcc}/${rawDoc}`;
        try {
          const res = await this.fetchImpl(xmlUrl, { headers: this.headers });
          requests++;
          if (res.ok) {
            xml = await res.text();
          }
        } catch {
          // Skip individual Form 4 XML fetch errors gracefully
        }
      }

      if (xml) {
        const parsed = parseForm4Xml(xml, {
          cik: entry.cik,
          accessionNumber,
          filingDate,
          primaryDocument,
        });
        transactions.push(...parsed);
      }
    }

    return { transactions, requests };
  }

  async getTickerSignal(
    rawTicker: string,
    options: { windowDays?: number; max8Ks?: number; maxForm4s?: number } = {}
  ): Promise<TickerSignalReport> {
    const windowDays = options.windowDays ?? 30;
    const max8Ks = options.max8Ks ?? 6;
    const maxForm4s = options.maxForm4s ?? 8;

    const entry = await this.resolveTickerToCik(rawTicker);
    const { payload, source, requests: subReqs } = await this.fetchSubmissions(entry);
    const companyName = payload.name || entry.companyName;

    const latest8K = parseEightKEvents(payload, max8Ks);
    const { transactions, requests: form4Reqs } = await this.fetchForm4Transactions(
      entry,
      payload,
      source,
      maxForm4s
    );

    const refDate =
      this.referenceDate ?? (source === "fixture" ? "2026-11-24" : undefined);

    const insiderCluster = scoreInsiderCluster(
      entry.ticker,
      entry.cik,
      companyName,
      transactions,
      windowDays,
      refDate
    );

    return buildTickerSignalReport({
      ticker: entry.ticker,
      cik: entry.cik,
      companyName,
      source,
      latest8K,
      insiderCluster,
      edgarRequests: subReqs + form4Reqs,
      cacheHit: false,
    });
  }

  async getEightKMaterialDiff(rawTicker: string): Promise<EightKMaterialDiff> {
    const entry = await this.resolveTickerToCik(rawTicker);
    const { payload, source } = await this.fetchSubmissions(entry);
    const companyName = payload.name || entry.companyName;
    const events = parseEightKEvents(payload, 5);

    return computeEightKMaterialDiff(entry.ticker, entry.cik, companyName, events, source);
  }

  async getInsiderClusters(
    options: { tickers?: string[]; windowDays?: number; minAbsScore?: number } = {}
  ): Promise<InsiderClustersResponse> {
    const tickers = (options.tickers && options.tickers.length > 0
      ? options.tickers
      : this.fixtureMode
        ? FIXTURE_TICKERS
        : DEFAULT_CLUSTER_UNIVERSE
    ).slice(0, 15);
    const windowDays = options.windowDays ?? 30;
    const minAbsScore = options.minAbsScore ?? 0;

    const results = await Promise.all(
      tickers.map(async (t) => {
        try {
          return await this.getTickerSignal(t, { windowDays, max8Ks: 1, maxForm4s: 6 });
        } catch {
          return null;
        }
      })
    );

    const valid = results.filter((r): r is TickerSignalReport => r !== null);
    const source: "live_edgar" | "fixture" =
      valid.some((r) => r.source === "live_edgar") ? "live_edgar" : "fixture";

    const clusters = valid
      .map((r) => r.insiderCluster)
      .filter((c) => Math.abs(c.clusterScore) >= minAbsScore)
      .sort((a, b) => Math.abs(b.clusterScore) - Math.abs(a.clusterScore));

    return {
      generatedAt: new Date().toISOString(),
      source,
      windowDays,
      scannedTickers: valid.length,
      clusters,
    };
  }
}

export function createFilingPulseClient(options?: FilingPulseClientOptions): FilingPulseClient {
  return new FilingPulseClient(options);
}
