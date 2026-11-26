import {
  createFilingPulseClient,
  type EventSeverity,
  type FilingPulseClientOptions,
} from "@filingpulse/core";
import type {
  FilingSignalProvider,
  FilingSignalRecord,
} from "./runner.js";

function clusterSeverity(clusterScore: number): EventSeverity {
  const abs = Math.abs(clusterScore);
  if (abs >= 70) return "critical";
  if (abs >= 45) return "high";
  if (abs >= 20) return "medium";
  return "low";
}

function normalizeSource(
  source: "live_edgar" | "fixture"
): "sec-edgar" | "fixture" {
  return source === "fixture" ? "fixture" : "sec-edgar";
}

export function createCoreSignalProvider(
  clientOverrides: Partial<FilingPulseClientOptions> = {}
): FilingSignalProvider {
  return async (ticker, options) => {
    const client = createFilingPulseClient({
      userAgent: options.userAgent,
      fixtureMode: options.fixtureMode,
      ...clientOverrides,
    });

    const report = await client.getTickerSignal(ticker, {
      windowDays: options.lookbackDays,
      max8Ks: options.include8k ? 6 : 0,
      maxForm4s: options.includeForm4 ? 8 : 0,
    });

    const source = normalizeSource(report.source);
    const records: FilingSignalRecord[] = [];

    if (options.include8k) {
      for (const ev of report.latest8K) {
        records.push({
          ticker: report.ticker,
          cik: report.cik,
          companyName: report.companyName,
          signalType: "8k-material-event",
          formType: "8-K",
          filedAt: ev.filingDate,
          severity: ev.severity,
          score: ev.materialityScore,
          items: ev.items,
          summary: ev.summary,
          filingUrl: ev.filingUrl,
          source,
          details: {
            accessionNumber: ev.accessionNumber,
            reportDate: ev.reportDate,
            direction: ev.direction,
            materialItems: ev.materialItems,
            tags: ev.tags,
          },
        });
      }
    }

    if (options.includeForm4) {
      const cluster = report.insiderCluster;
      const latestTx = cluster.transactions[0];
      const latestDate =
        latestTx?.filingDate ?? report.generatedAt.slice(0, 10);
      const latestUrl =
        latestTx?.filingUrl ??
        `https://www.sec.gov/cgi-bin/browse-edgar?action=getcompany&CIK=${encodeURIComponent(report.cik)}&type=4`;

      records.push({
        ticker: report.ticker,
        cik: report.cik,
        companyName: report.companyName,
        signalType: "form4-insider-cluster",
        formType: "4",
        filedAt: latestDate,
        severity: clusterSeverity(cluster.clusterScore),
        score: cluster.clusterScore,
        summary: `${cluster.signal}: ${cluster.uniqueBuyers} buyer(s) ($${Math.round(cluster.totalBuyValueUsd).toLocaleString("en-US")}), ${cluster.uniqueSellers} seller(s) ($${Math.round(cluster.totalSellValueUsd).toLocaleString("en-US")}) over ${cluster.windowDays}d`,
        filingUrl: latestUrl,
        source,
        details: {
          signal: cluster.signal,
          windowDays: cluster.windowDays,
          uniqueBuyers: cluster.uniqueBuyers,
          uniqueSellers: cluster.uniqueSellers,
          cSuiteBuyers: cluster.cSuiteBuyers,
          cSuiteSellers: cluster.cSuiteSellers,
          totalBuyValueUsd: cluster.totalBuyValueUsd,
          totalSellValueUsd: cluster.totalSellValueUsd,
          planned10b51SellValueUsd: cluster.planned10b51SellValueUsd,
          netValueUsd: cluster.netValueUsd,
          buyToSellRatio: cluster.buyToSellRatio,
          transactionCount: cluster.transactions.length,
        },
      });
    }

    if (options.includeMaterialDiff) {
      const diff = await client.getEightKMaterialDiff(ticker);
      if (diff.currentFiling) {
        records.push({
          ticker: diff.ticker,
          cik: diff.cik,
          companyName: diff.companyName,
          signalType: "8k-material-diff",
          formType: "8-K",
          filedAt: diff.currentFiling.filingDate,
          severity: diff.currentFiling.severity,
          score: diff.materialityDelta,
          items: diff.addedItems.map((item) => item.code),
          summary: diff.headlineDelta,
          filingUrl: diff.currentFiling.filingUrl,
          source: normalizeSource(diff.source),
          details: {
            severityShift: diff.severityShift,
            addedItems: diff.addedItems,
            removedItems: diff.removedItems,
            persistedItems: diff.persistedItems,
            highlights: diff.highlights,
          },
        });
      }
    }

    return records;
  };
}
