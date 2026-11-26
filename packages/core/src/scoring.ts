import type {
  ClusterSignalLabel,
  EdgarSubmissionsPayload,
  EightKEvent,
  EightKItemDetail,
  EightKMaterialDiff,
  EventSeverity,
  Form4Transaction,
  Form4TransactionCode,
  InsiderClusterSignal,
  SignalDirection,
  TickerSignalReport,
} from "./types.js";

export const EIGHT_K_ITEM_CATALOG: Record<string, EightKItemDetail> = {
  "1.01": {
    code: "1.01",
    title: "Entry into a Material Definitive Agreement",
    category: "m_and_a",
    weight: 80,
    bias: "bullish",
  },
  "1.02": {
    code: "1.02",
    title: "Termination of a Material Definitive Agreement",
    category: "m_and_a",
    weight: 78,
    bias: "bearish",
  },
  "1.03": {
    code: "1.03",
    title: "Bankruptcy or Receivership",
    category: "accounting_risk",
    weight: 100,
    bias: "bearish",
  },
  "1.05": {
    code: "1.05",
    title: "Material Cybersecurity Incidents",
    category: "cybersecurity",
    weight: 86,
    bias: "bearish",
  },
  "2.01": {
    code: "2.01",
    title: "Completion of Acquisition or Disposition of Assets",
    category: "m_and_a",
    weight: 85,
    bias: "mixed",
  },
  "2.02": {
    code: "2.02",
    title: "Results of Operations and Financial Condition",
    category: "earnings",
    weight: 72,
    bias: "mixed",
  },
  "2.04": {
    code: "2.04",
    title: "Triggering Events That Accelerate or Increase a Direct Financial Obligation",
    category: "accounting_risk",
    weight: 88,
    bias: "bearish",
  },
  "2.05": {
    code: "2.05",
    title: "Costs Associated with Exit or Disposal Activities",
    category: "capital_markets",
    weight: 74,
    bias: "bearish",
  },
  "2.06": {
    code: "2.06",
    title: "Material Impairments",
    category: "accounting_risk",
    weight: 84,
    bias: "bearish",
  },
  "3.01": {
    code: "3.01",
    title: "Notice of Delisting or Failure to Satisfy a Continued Listing Rule",
    category: "capital_markets",
    weight: 94,
    bias: "bearish",
  },
  "3.02": {
    code: "3.02",
    title: "Unregistered Sales of Equity Securities",
    category: "capital_markets",
    weight: 62,
    bias: "bearish",
  },
  "4.01": {
    code: "4.01",
    title: "Changes in Registrant's Certifying Accountant",
    category: "accounting_risk",
    weight: 90,
    bias: "bearish",
  },
  "4.02": {
    code: "4.02",
    title: "Non-Reliance on Previously Issued Financial Statements or Audit Report",
    category: "accounting_risk",
    weight: 98,
    bias: "bearish",
  },
  "5.01": {
    code: "5.01",
    title: "Changes in Control of Registrant",
    category: "governance",
    weight: 90,
    bias: "mixed",
  },
  "5.02": {
    code: "5.02",
    title: "Departure of Directors or Certain Officers; Election of Directors; Appointment of Certain Officers",
    category: "governance",
    weight: 78,
    bias: "mixed",
  },
  "5.03": {
    code: "5.03",
    title: "Amendments to Articles of Incorporation or Bylaws",
    category: "governance",
    weight: 48,
    bias: "neutral",
  },
  "5.07": {
    code: "5.07",
    title: "Submission of Matters to a Vote of Security Holders",
    category: "governance",
    weight: 40,
    bias: "neutral",
  },
  "7.01": {
    code: "7.01",
    title: "Regulation FD Disclosure",
    category: "other",
    weight: 55,
    bias: "neutral",
  },
  "8.01": {
    code: "8.01",
    title: "Other Events",
    category: "other",
    weight: 50,
    bias: "neutral",
  },
  "9.01": {
    code: "9.01",
    title: "Financial Statements and Exhibits",
    category: "other",
    weight: 15,
    bias: "neutral",
  },
};

export function padCik(cik: string | number): string {
  const digits = String(cik).replace(/\D/g, "");
  return digits.padStart(10, "0");
}

export function buildEdgarFilingUrl(
  cik: string,
  accessionNumber: string,
  primaryDocument: string
): string {
  const numericCik = String(Number(padCik(cik)));
  const cleanAcc = accessionNumber.replace(/-/g, "");
  const cleanDoc = primaryDocument.replace(/^\/+/, "");
  return `https://www.sec.gov/Archives/edgar/data/${numericCik}/${cleanAcc}/${cleanDoc}`;
}

export function classifyItem(code: string): EightKItemDetail {
  const normalized = code.trim();
  const known = EIGHT_K_ITEM_CATALOG[normalized];
  if (known) return known;
  return {
    code: normalized,
    title: `Form 8-K Item ${normalized}`,
    category: "other",
    weight: 35,
    bias: "neutral",
  };
}

export function scoreToSeverity(score: number): EventSeverity {
  if (score >= 90) return "critical";
  if (score >= 75) return "high";
  if (score >= 50) return "medium";
  return "low";
}

export function parseEightKEvents(
  payload: EdgarSubmissionsPayload,
  limit = 10
): EightKEvent[] {
  const recent = payload.filings?.recent;
  if (!recent || !Array.isArray(recent.form)) return [];

  const cik10 = padCik(payload.cik);
  const events: EightKEvent[] = [];

  for (let i = 0; i < recent.form.length && events.length < limit; i++) {
    const form = recent.form[i];
    if (form !== "8-K" && form !== "8-K/A") continue;

    const accessionNumber = recent.accessionNumber[i] ?? "";
    const filingDate = recent.filingDate[i] ?? "";
    const reportDate = recent.reportDate?.[i] || filingDate;
    const primaryDocument = recent.primaryDocument?.[i] ?? "";
    const rawItems = recent.items?.[i] ?? [];
    const items = (Array.isArray(rawItems) ? rawItems : String(rawItems).split(","))
      .map((s) => s.trim())
      .filter(Boolean);

    const materialItems = items.map(classifyItem);
    const substantiveItems = materialItems.filter((item) => item.code !== "9.01");
    const scoredSet = substantiveItems.length > 0 ? substantiveItems : materialItems;

    const maxWeight = scoredSet.reduce((max, item) => Math.max(max, item.weight), 20);
    const multiItemBonus = Math.min(12, Math.max(0, scoredSet.length - 1) * 5);
    const amendmentBonus = form === "8-K/A" ? 4 : 0;
    const materialityScore = Math.min(100, Math.round(maxWeight + multiItemBonus + amendmentBonus));
    const severity = scoreToSeverity(materialityScore);

    let bullishCount = 0;
    let bearishCount = 0;
    let mixedCount = 0;
    for (const item of scoredSet) {
      if (item.bias === "bullish") bullishCount++;
      else if (item.bias === "bearish") bearishCount++;
      else if (item.bias === "mixed") mixedCount++;
    }

    let direction: SignalDirection = "neutral";
    if (bearishCount > 0 && bullishCount === 0) direction = "bearish";
    else if (bullishCount > 0 && bearishCount === 0) direction = "bullish";
    else if (bullishCount > 0 && bearishCount > 0) direction = "mixed";
    else if (mixedCount > 0) direction = "mixed";

    const tags = Array.from(
      new Set([
        ...scoredSet.map((m) => m.category),
        ...(form === "8-K/A" ? ["amendment"] : []),
        ...items.map((code) => `item_${code.replace(".", "_")}`),
      ])
    );

    const primaryTitles = scoredSet
      .slice(0, 2)
      .map((m) => `Item ${m.code} (${m.title})`)
      .join(" + ");

    const summary = primaryTitles
      ? `${form} filed ${filingDate}: ${primaryTitles}`
      : `${form} filed ${filingDate}`;

    events.push({
      accessionNumber,
      filingDate,
      reportDate,
      items,
      materialItems,
      primaryDocument,
      filingUrl: buildEdgarFilingUrl(cik10, accessionNumber, primaryDocument),
      materialityScore,
      severity,
      direction,
      summary,
      tags,
    });
  }

  return events;
}

function extractXmlTag(xml: string, tagName: string): string {
  const re = new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, "i");
  const match = xml.match(re);
  return match ? match[1].replace(/<[^>]+>/g, "").trim() : "";
}

function extractXmlNestedValue(block: string, parentTag: string): string {
  const parentMatch = block.match(
    new RegExp(`<${parentTag}[^>]*>([\\s\\S]*?)<\\/${parentTag}>`, "i")
  );
  if (!parentMatch) return "";
  const inner = parentMatch[1];
  const value = extractXmlTag(inner, "value");
  return value || inner.replace(/<[^>]+>/g, "").trim();
}

function parseBoolTag(val: string): boolean {
  const normalized = val.trim().toLowerCase();
  return normalized === "1" || normalized === "true";
}

function normalizeTxCode(raw: string): Form4TransactionCode {
  const c = raw.trim().toUpperCase();
  if (c === "P" || c === "S" || c === "A" || c === "M" || c === "F" || c === "G" || c === "J") {
    return c;
  }
  return "OTHER";
}

export function parseForm4Xml(
  xml: string,
  meta: {
    cik: string;
    accessionNumber: string;
    filingDate: string;
    primaryDocument: string;
  }
): Form4Transaction[] {
  if (!xml || !xml.includes("<ownershipDocument")) return [];

  const ownerBlockMatch = xml.match(/<reportingOwner[^>]*>[\s\S]*?<\/reportingOwner>/i);
  const ownerBlock = ownerBlockMatch ? ownerBlockMatch[0] : xml;

  const insiderName = extractXmlTag(ownerBlock, "rptOwnerName") || "Unknown Insider";
  const insiderTitle = extractXmlTag(ownerBlock, "officerTitle") || "";
  const isOfficer = parseBoolTag(extractXmlTag(ownerBlock, "isOfficer"));
  const isDirector = parseBoolTag(extractXmlTag(ownerBlock, "isDirector"));
  const isTenPercentOwner = parseBoolTag(extractXmlTag(ownerBlock, "isTenPercentOwner"));

  const is10b51Plan =
    /10b5-1/i.test(xml) ||
    parseBoolTag(extractXmlTag(xml, "aff10b5One"));

  const filingUrl = buildEdgarFilingUrl(meta.cik, meta.accessionNumber, meta.primaryDocument);
  const txRegex = /<nonDerivativeTransaction[^>]*>([\s\S]*?)<\/nonDerivativeTransaction>/gi;
  const transactions: Form4Transaction[] = [];

  let match: RegExpExecArray | null;
  while ((match = txRegex.exec(xml)) !== null) {
    const block = match[1];
    const transactionDate = extractXmlNestedValue(block, "transactionDate") || meta.filingDate;
    const transactionCode = normalizeTxCode(extractXmlTag(block, "transactionCode"));
    const shares = Number(extractXmlNestedValue(block, "transactionShares")) || 0;
    const pricePerShare = Number(extractXmlNestedValue(block, "transactionPricePerShare")) || 0;
    const sharesOwnedFollowing =
      Number(extractXmlNestedValue(block, "sharesOwnedFollowingTransaction")) || 0;

    if (shares <= 0) continue;

    transactions.push({
      accessionNumber: meta.accessionNumber,
      filingDate: meta.filingDate,
      transactionDate,
      insiderName,
      insiderTitle: insiderTitle || (isDirector ? "Director" : isTenPercentOwner ? "10% Owner" : "Insider"),
      isOfficer,
      isDirector,
      isTenPercentOwner,
      transactionCode,
      shares,
      pricePerShare,
      totalValueUsd: Math.round(shares * pricePerShare * 100) / 100,
      sharesOwnedFollowing,
      is10b51Plan,
      filingUrl,
    });
  }

  return transactions;
}

function isCSuiteTitle(title: string, isOfficer: boolean): boolean {
  if (!isOfficer) return false;
  return /\b(ceo|cfo|coo|cto|president|chief|general counsel|evp|svp)\b/i.test(title);
}

export function scoreInsiderCluster(
  ticker: string,
  cik: string,
  companyName: string,
  transactions: Form4Transaction[],
  windowDays = 30,
  referenceDate?: string
): InsiderClusterSignal {
  const refMs = referenceDate ? Date.parse(`${referenceDate}T23:59:59Z`) : Date.now();
  const cutoffMs = refMs - windowDays * 24 * 60 * 60 * 1000;

  const inWindow = transactions.filter((tx) => {
    const txMs = Date.parse(`${tx.transactionDate || tx.filingDate}T12:00:00Z`);
    return Number.isNaN(txMs) ? true : txMs >= cutoffMs;
  });

  const buyers = new Set<string>();
  const sellers = new Set<string>();
  const cSuiteBuyerSet = new Set<string>();
  const cSuiteSellerSet = new Set<string>();

  let totalBuyValueUsd = 0;
  let totalSellValueUsd = 0;
  let planned10b51SellValueUsd = 0;
  let discretionarySellValueUsd = 0;

  for (const tx of inWindow) {
    const key = tx.insiderName.toUpperCase().trim();
    const cSuite = isCSuiteTitle(tx.insiderTitle, tx.isOfficer);

    if (tx.transactionCode === "P") {
      buyers.add(key);
      if (cSuite) cSuiteBuyerSet.add(key);
      totalBuyValueUsd += tx.totalValueUsd;
    } else if (tx.transactionCode === "S") {
      sellers.add(key);
      if (cSuite) cSuiteSellerSet.add(key);
      totalSellValueUsd += tx.totalValueUsd;
      if (tx.is10b51Plan) {
        planned10b51SellValueUsd += tx.totalValueUsd;
      } else {
        discretionarySellValueUsd += tx.totalValueUsd;
      }
    }
  }

  // Open-market purchases are high conviction; 10b5-1 sales are heavily discounted (25% weight)
  const effectiveSellValue = discretionarySellValueUsd + planned10b51SellValueUsd * 0.25;
  const buyConviction =
    buyers.size * 16 +
    cSuiteBuyerSet.size * 12 +
    (buyers.size >= 3 ? 18 : 0) +
    Math.min(30, Math.log10(Math.max(1, totalBuyValueUsd / 10000)) * 12);

  const sellConviction =
    sellers.size * 10 +
    cSuiteSellerSet.size * 7 +
    (sellers.size >= 3 && discretionarySellValueUsd > 0 ? 12 : 0) +
    Math.min(24, Math.log10(Math.max(1, effectiveSellValue / 25000)) * 9);

  const rawScore =
    (buyers.size > 0 ? buyConviction : 0) - (sellers.size > 0 ? sellConviction : 0);
  const clusterScore = Math.max(-100, Math.min(100, Math.round(rawScore)));

  let signal: ClusterSignalLabel = "neutral";
  if (clusterScore >= 45) signal = "strong_buy_cluster";
  else if (clusterScore >= 18) signal = "moderate_buy_cluster";
  else if (clusterScore <= -45) signal = "strong_sell_cluster";
  else if (clusterScore <= -18) signal = "moderate_sell_cluster";

  const buyToSellRatio =
    totalSellValueUsd > 0
      ? Math.round((totalBuyValueUsd / totalSellValueUsd) * 100) / 100
      : totalBuyValueUsd > 0
        ? 999
        : null;

  return {
    ticker: ticker.toUpperCase(),
    cik: padCik(cik),
    companyName,
    windowDays,
    uniqueBuyers: buyers.size,
    uniqueSellers: sellers.size,
    cSuiteBuyers: cSuiteBuyerSet.size,
    cSuiteSellers: cSuiteSellerSet.size,
    totalBuyValueUsd: Math.round(totalBuyValueUsd * 100) / 100,
    totalSellValueUsd: Math.round(totalSellValueUsd * 100) / 100,
    planned10b51SellValueUsd: Math.round(planned10b51SellValueUsd * 100) / 100,
    netValueUsd: Math.round((totalBuyValueUsd - totalSellValueUsd) * 100) / 100,
    buyToSellRatio,
    clusterScore,
    signal,
    transactions: inWindow,
  };
}

export function computeEightKMaterialDiff(
  ticker: string,
  cik: string,
  companyName: string,
  events: EightKEvent[],
  source: "live_edgar" | "fixture"
): EightKMaterialDiff {
  const currentFiling = events[0] ?? null;
  const previousFiling = events[1] ?? null;

  const currentMap = new Map<string, EightKItemDetail>();
  for (const item of currentFiling?.materialItems ?? []) {
    if (item.code !== "9.01") currentMap.set(item.code, item);
  }

  const prevMap = new Map<string, EightKItemDetail>();
  for (const item of previousFiling?.materialItems ?? []) {
    if (item.code !== "9.01") prevMap.set(item.code, item);
  }

  const addedItems: EightKItemDetail[] = [];
  const persistedItems: EightKItemDetail[] = [];
  const removedItems: EightKItemDetail[] = [];

  for (const [code, detail] of currentMap.entries()) {
    if (prevMap.has(code)) persistedItems.push(detail);
    else addedItems.push(detail);
  }
  for (const [code, detail] of prevMap.entries()) {
    if (!currentMap.has(code)) removedItems.push(detail);
  }

  const currScore = currentFiling?.materialityScore ?? 0;
  const prevScore = previousFiling?.materialityScore ?? 0;
  const materialityDelta = currScore - prevScore;
  const severityShift =
    currentFiling && previousFiling
      ? `${previousFiling.severity} -> ${currentFiling.severity}`
      : currentFiling
        ? `none -> ${currentFiling.severity}`
        : "none -> none";

  const highlights: string[] = [];
  if (addedItems.length > 0) {
    highlights.push(
      `New material items: ${addedItems.map((i) => `${i.code} (${i.title})`).join("; ")}`
    );
  }
  if (removedItems.length > 0) {
    highlights.push(
      `No longer reported vs prior 8-K: ${removedItems.map((i) => i.code).join(", ")}`
    );
  }
  if (materialityDelta >= 15) {
    highlights.push(`Materiality escalated by +${materialityDelta} pts (${severityShift})`);
  } else if (materialityDelta <= -15) {
    highlights.push(`Materiality cooled by ${materialityDelta} pts (${severityShift})`);
  }

  const headlineDelta =
    !currentFiling
      ? `No recent 8-K filings found for ${ticker.toUpperCase()}.`
      : addedItems.length > 0
        ? `${ticker.toUpperCase()} introduced ${addedItems.map((i) => `Item ${i.code}`).join(", ")} (materiality ${materialityDelta >= 0 ? "+" : ""}${materialityDelta} pts vs prior 8-K).`
        : `${ticker.toUpperCase()} 8-K materiality delta ${materialityDelta >= 0 ? "+" : ""}${materialityDelta} pts (${severityShift}).`;

  return {
    ticker: ticker.toUpperCase(),
    cik: padCik(cik),
    companyName,
    generatedAt: new Date().toISOString(),
    source,
    currentFiling,
    previousFiling,
    addedItems,
    removedItems,
    persistedItems,
    materialityDelta,
    severityShift,
    headlineDelta,
    highlights,
  };
}

export function buildTickerSignalReport(params: {
  ticker: string;
  cik: string;
  companyName: string;
  source: "live_edgar" | "fixture";
  latest8K: EightKEvent[];
  insiderCluster: InsiderClusterSignal;
  edgarRequests: number;
  cacheHit: boolean;
}): TickerSignalReport {
  const { ticker, cik, companyName, source, latest8K, insiderCluster, edgarRequests, cacheHit } =
    params;

  let eightKBias = 0;
  const topEvent = latest8K[0];
  if (topEvent) {
    const scale = topEvent.materialityScore / 100;
    if (topEvent.direction === "bullish") eightKBias = Math.round(35 * scale);
    else if (topEvent.direction === "bearish") eightKBias = Math.round(-45 * scale);
  }

  const compositeScore = Math.max(
    -100,
    Math.min(100, Math.round(insiderCluster.clusterScore * 0.65 + eightKBias * 0.85))
  );

  let compositeSignal: TickerSignalReport["compositeSignal"] = "neutral";
  if (compositeScore >= 35) compositeSignal = "bullish";
  else if (compositeScore >= 12) compositeSignal = "slightly_bullish";
  else if (compositeScore <= -35) compositeSignal = "bearish";
  else if (compositeScore <= -12) compositeSignal = "slightly_bearish";

  const highlights: string[] = [];
  if (topEvent) {
    highlights.push(
      `Latest 8-K (${topEvent.filingDate}, score ${topEvent.materialityScore}/100, ${topEvent.severity}): ${topEvent.summary}`
    );
  }
  if (insiderCluster.uniqueBuyers > 0) {
    highlights.push(
      `${insiderCluster.uniqueBuyers} unique insider buyer(s) totaling $${insiderCluster.totalBuyValueUsd.toLocaleString("en-US")} (${insiderCluster.cSuiteBuyers} C-Suite) in ${insiderCluster.windowDays}d`
    );
  }
  if (insiderCluster.uniqueSellers > 0) {
    highlights.push(
      `${insiderCluster.uniqueSellers} unique insider seller(s) totaling $${insiderCluster.totalSellValueUsd.toLocaleString("en-US")} ($${insiderCluster.planned10b51SellValueUsd.toLocaleString("en-US")} via 10b5-1 plans)`
    );
  }
  if (highlights.length === 0) {
    highlights.push(`No material 8-K or open-market Form 4 cluster triggers in window.`);
  }

  return {
    ticker: ticker.toUpperCase(),
    cik: padCik(cik),
    companyName,
    generatedAt: new Date().toISOString(),
    source,
    latest8K,
    materialEventCount: latest8K.filter((e) => e.materialityScore >= 70).length,
    insiderCluster,
    compositeScore,
    compositeSignal,
    highlights,
    meta: {
      edgarRequests,
      cacheHit,
      estimatedCogsUsd: 0.00051,
    },
  };
}
