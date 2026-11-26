import assert from "node:assert/strict";
import { describe, it } from "node:test";
import { FIXTURE_TICKERS } from "@filingpulse/core";
import { createCoreSignalProvider } from "./core-provider.js";
import {
  DEFAULT_MAX_ITEMS,
  EVENT_PRICE_USD,
  HARD_MAX_ITEMS,
  normalizeInput,
  runSignalPipeline,
  type FilingSignalRecord,
} from "./runner.js";

function makeRecord(ticker: string, idx: number): FilingSignalRecord {
  return {
    ticker,
    cik: "0000320193",
    companyName: "Apple Inc.",
    signalType: "8k-material-event",
    formType: "8-K",
    filedAt: "2026-11-24",
    severity: "high",
    score: 75 + idx,
    items: ["2.02"],
    summary: `${ticker} signal #${idx}`,
    filingUrl: `https://www.sec.gov/Archives/edgar/data/320193/${idx}`,
    source: "fixture",
  };
}

describe("normalizeInput", () => {
  it("applies MCP-safe defaults when empty input is supplied", () => {
    const normalized = normalizeInput({});
    assert.deepEqual(normalized.tickers, ["AAPL", "NVDA"]);
    assert.equal(normalized.maxItems, DEFAULT_MAX_ITEMS);
    assert.equal(normalized.include8k, true);
    assert.equal(normalized.includeForm4, true);
    assert.equal(normalized.includeMaterialDiff, true);
    assert.equal(normalized.fixtureMode, false);
  });

  it("sanitizes, uppercases, deduplicates tickers and clamps maxItems", () => {
    const normalized = normalizeInput({
      tickers: [" aapl ", "NVDA", "aapl", "bad ticker!", "BRK.B"],
      maxItems: 9999,
      lookbackDays: 0,
      fixtureMode: true,
    });
    assert.deepEqual(normalized.tickers, ["AAPL", "NVDA", "BRK.B"]);
    assert.equal(normalized.maxItems, HARD_MAX_ITEMS);
    assert.equal(normalized.lookbackDays, 1);
    assert.equal(normalized.fixtureMode, true);
  });

  it("throws when no valid tickers remain", () => {
    assert.throws(() => normalizeInput({ tickers: ["   ", "!!!"] }), /valid stock ticker/i);
  });
});

describe("runSignalPipeline", () => {
  it("enforces maxItems cap across multiple tickers and calculates PPE cost", async () => {
    const emitted: FilingSignalRecord[] = [];
    const input = normalizeInput({
      tickers: ["AAPL", "NVDA", "MSFT"],
      maxItems: 3,
      fixtureMode: true,
    });

    const result = await runSignalPipeline(
      input,
      async (ticker) => [makeRecord(ticker, 1), makeRecord(ticker, 2)],
      async (record) => {
        emitted.push(record);
        return { limitReached: false };
      }
    );

    assert.equal(emitted.length, 3);
    assert.equal(result.emittedCount, 3);
    assert.equal(result.chargedCount, 3);
    assert.equal(result.stoppedByMaxItems, true);
    assert.equal(result.stoppedByBudget, false);
    assert.equal(result.estimatedChargeUsd, Number((3 * EVENT_PRICE_USD).toFixed(4)));
  });

  it("stops immediately when maxTotalChargeUsd budget limit is reached", async () => {
    const emitted: FilingSignalRecord[] = [];
    const input = normalizeInput({
      tickers: ["AAPL", "NVDA"],
      maxItems: 20,
      fixtureMode: true,
    });

    const result = await runSignalPipeline(
      input,
      async (ticker) => [makeRecord(ticker, 1), makeRecord(ticker, 2), makeRecord(ticker, 3)],
      async (record) => {
        emitted.push(record);
        return { limitReached: emitted.length >= 2 };
      }
    );

    assert.equal(emitted.length, 2);
    assert.equal(result.tickersProcessed, 1);
    assert.equal(result.chargedCount, 2);
    assert.equal(result.stoppedByBudget, true);
    assert.equal(result.estimatedChargeUsd, 0.01);
  });
});

describe("@filingpulse/core integration (fixtureMode)", () => {
  it("extracts 8-K, Form 4 insider cluster, and 8-K material diff signals cleanly", async () => {
    assert.ok(FIXTURE_TICKERS.length >= 2, "Expected at least 2 fixture tickers in @filingpulse/core");
    const sampleTickers = FIXTURE_TICKERS.slice(0, 2);
    const emitted: FilingSignalRecord[] = [];

    const input = normalizeInput({
      tickers: sampleTickers,
      maxItems: 20,
      fixtureMode: true,
    });

    const provider = createCoreSignalProvider();
    const result = await runSignalPipeline(input, provider, async (record) => {
      emitted.push(record);
      return { limitReached: false };
    });

    assert.equal(result.tickersProcessed, sampleTickers.length);
    assert.ok(emitted.length >= 3, `Expected >=3 signals, got ${emitted.length}`);

    const signalTypes = new Set(emitted.map((r) => r.signalType));
    assert.ok(signalTypes.has("8k-material-event"), "Missing 8k-material-event signal");
    assert.ok(signalTypes.has("form4-insider-cluster"), "Missing form4-insider-cluster signal");
    assert.ok(signalTypes.has("8k-material-diff"), "Missing 8k-material-diff signal");

    for (const record of emitted) {
      assert.ok(record.ticker.length > 0);
      assert.match(record.cik, /^\d{10}$/);
      assert.equal(record.source, "fixture");
      assert.ok(record.summary.length > 0);
      assert.ok(record.filingUrl.startsWith("https://"));
    }
  });
});
