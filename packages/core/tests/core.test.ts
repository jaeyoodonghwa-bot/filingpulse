import { describe, expect, it } from "vitest";
import {
  createFilingPulseClient,
  EIGHT_K_ITEM_CATALOG,
  FIXTURE_DATA,
  padCik,
  parseEightKEvents,
  parseForm4Xml,
  scoreInsiderCluster,
} from "../src/index.js";

describe("@filingpulse/core deterministic EDGAR engine", () => {
  it("pads CIK numbers to 10 digits", () => {
    expect(padCik("320193")).toBe("0000320193");
    expect(padCik(2488)).toBe("0000002488");
  });

  it("parses 8-K filings with materiality scoring and severity classification", () => {
    const events = parseEightKEvents(FIXTURE_DATA.ACME.submissions);
    expect(events).toHaveLength(2);

    const latest = events[0];
    expect(latest.items).toContain("4.02");
    expect(latest.items).toContain("5.02");
    expect(latest.severity).toBe("critical");
    expect(latest.materialityScore).toBeGreaterThanOrEqual(95);
    expect(latest.direction).toBe("bearish");
    expect(latest.filingUrl).toContain("sec.gov/Archives/edgar/data/9999001/");
  });

  it("parses Form 4 XML including C-suite officer title and Rule 10b5-1 flag", () => {
    const xml = FIXTURE_DATA.NVDA.form4XmlByAccession["0001045810-26-000305"];
    const txs = parseForm4Xml(xml, {
      cik: "0001045810",
      accessionNumber: "0001045810-26-000305",
      filingDate: "2026-11-15",
      primaryDocument: "form4_huang.xml",
    });

    expect(txs).toHaveLength(1);
    expect(txs[0].insiderName).toBe("HUANG JEN HSUN");
    expect(txs[0].isOfficer).toBe(true);
    expect(txs[0].transactionCode).toBe("S");
    expect(txs[0].shares).toBe(75000);
    expect(txs[0].totalValueUsd).toBe(10987500);
    expect(txs[0].is10b51Plan).toBe(true);
  });

  it("scores strong C-suite open-market buy clusters positively (AMD fixture)", async () => {
    const client = createFilingPulseClient({
      fixtureMode: true,
      referenceDate: "2026-11-24",
    });
    const report = await client.getTickerSignal("AMD");

    expect(report.source).toBe("fixture");
    expect(report.ticker).toBe("AMD");
    expect(report.insiderCluster.uniqueBuyers).toBe(3);
    expect(report.insiderCluster.cSuiteBuyers).toBe(3);
    expect(report.insiderCluster.signal).toBe("strong_buy_cluster");
    expect(report.insiderCluster.clusterScore).toBeGreaterThanOrEqual(70);
    expect(report.compositeSignal).toBe("bullish");
  });

  it("discounts Rule 10b5-1 planned sales compared to discretionary selling", () => {
    const plannedXml = FIXTURE_DATA.NVDA.form4XmlByAccession["0001045810-26-000305"];
    const plannedTxs = parseForm4Xml(plannedXml, {
      cik: "0001045810",
      accessionNumber: "0001045810-26-000305",
      filingDate: "2026-11-15",
      primaryDocument: "form4_huang.xml",
    });
    const discretionaryTxs = plannedTxs.map((t) => ({ ...t, is10b51Plan: false }));

    const plannedScore = scoreInsiderCluster(
      "NVDA",
      "0001045810",
      "NVIDIA CORP",
      plannedTxs,
      30,
      "2026-11-24"
    );
    const discretionaryScore = scoreInsiderCluster(
      "NVDA",
      "0001045810",
      "NVIDIA CORP",
      discretionaryTxs,
      30,
      "2026-11-24"
    );

    expect(plannedScore.planned10b51SellValueUsd).toBe(10987500);
    expect(discretionaryScore.planned10b51SellValueUsd).toBe(0);
    expect(plannedScore.clusterScore).toBeGreaterThan(discretionaryScore.clusterScore);
  });

  it("computes 8-K material diff between latest and prior filings", async () => {
    const client = createFilingPulseClient({
      fixtureMode: true,
      referenceDate: "2026-11-24",
    });

    const diff = await client.getEightKMaterialDiff("ACME");
    expect(diff.addedItems.map((i) => i.code)).toEqual(["4.02", "5.02"]);
    expect(diff.removedItems.map((i) => i.code)).toEqual(["8.01"]);
    expect(diff.materialityDelta).toBeGreaterThan(40);
    expect(diff.severityShift).toBe("medium -> critical");
  });

  it("scans multi-ticker insider clusters ranked by absolute conviction", async () => {
    const client = createFilingPulseClient({
      fixtureMode: true,
      referenceDate: "2026-11-24",
    });

    const scan = await client.getInsiderClusters({
      tickers: ["AMD", "AAPL", "ACME", "NVDA"],
      windowDays: 30,
    });
    expect(scan.scannedTickers).toBe(4);
    expect(scan.clusters.length).toBe(4);
    expect(Math.abs(scan.clusters[0].clusterScore)).toBeGreaterThanOrEqual(
      Math.abs(scan.clusters[1].clusterScore)
    );
    expect(EIGHT_K_ITEM_CATALOG["4.02"].weight).toBe(98);
  });

  it("supports custom fetchImpl for live EDGAR mode without real network calls", async () => {
    const mockFetch: typeof fetch = async (input) => {
      const url = String(input);
      if (url.includes("CIK0000320193.json")) {
        return new Response(JSON.stringify(FIXTURE_DATA.AAPL.submissions), {
          status: 200,
          headers: { "content-type": "application/json" },
        });
      }
      if (url.includes("wk-form4_1763480001.xml")) {
        return new Response(
          FIXTURE_DATA.AAPL.form4XmlByAccession["0000320193-26-000138"],
          { status: 200, headers: { "content-type": "application/xml" } }
        );
      }
      return new Response("Not Found", { status: 404 });
    };

    const client = createFilingPulseClient({
      fixtureMode: false,
      fetchImpl: mockFetch,
      referenceDate: "2026-11-24",
    });

    const report = await client.getTickerSignal("AAPL");
    expect(report.source).toBe("live_edgar");
    expect(report.meta.edgarRequests).toBeGreaterThanOrEqual(2);
    expect(report.latest8K.length).toBe(2);
    expect(report.insiderCluster.uniqueBuyers).toBe(1);
  });
});
