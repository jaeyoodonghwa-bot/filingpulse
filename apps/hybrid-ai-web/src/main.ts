import "./styles.css";
import {
  DEFAULT_PORTFOLIO,
  runHybridPortfolioAnalysis,
} from "./hybridEngine.js";
import type {
  HybridAnalysisResult,
  InferencePreference,
  PortfolioPosition,
} from "./types.js";

let positions: PortfolioPosition[] = DEFAULT_PORTFOLIO.map((p) => ({ ...p }));
let preference: InferencePreference = "PREFER_ON_DEVICE";
let simulateNanoAvailable = true;
let useLiveApi = false;
let filingPulseApiUrl = "http://127.0.0.1:8787";
let filingPulseApiKey = "fp_demo_preview_2026";
let cumulativeSavedUsd = 0;
let runsCompleted = 0;
let latestResult: HybridAnalysisResult | null = null;

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getEnvFirebaseConfig() {
  const env = (import.meta as unknown as { env?: Record<string, string | undefined> }).env ?? {};
  return {
    firebaseApiKey: env.VITE_FIREBASE_API_KEY,
    firebaseProjectId: env.VITE_FIREBASE_PROJECT_ID,
    firebaseAppId: env.VITE_FIREBASE_APP_ID,
  };
}

function render() {
  const root = document.getElementById("app");
  if (!root) return;

  const badgeClass = latestResult
    ? latestResult.isOnDevice
      ? "on-device"
      : "cloud"
    : "neutral";
  const badgeText = latestResult
    ? latestResult.engineBadgeLabel
    : "Initializing Hybrid AI...";

  const riskScore = latestResult?.portfolioRiskScore ?? 0;
  const riskClass = riskScore >= 65 ? "danger" : riskScore >= 35 ? "warn" : "good";
  const totalWeight = positions.reduce((s, p) => s + Number(p.weightPct || 0), 0);

  root.innerHTML = `
    <div class="shell">
      <header class="topbar">
        <div class="brand-wrap">
          <div class="brand-icon">FP</div>
          <div>
            <h1>FilingPulse Hybrid AI — Private Portfolio Risk Co-Pilot</h1>
            <p>Devpost #BuildHybridAI · Firebase AI Logic (<code>PREFER_ON_DEVICE</code> Gemini Nano + Cloud Gemini Fallback) + SEC EDGAR 8-K/Form 4 Signals</p>
          </div>
        </div>
        <div class="badge-row">
          <span class="pill-badge ${badgeClass}" id="inference-badge">
            <span class="dot"></span>
            ${escapeHtml(badgeText)}
          </span>
          <span class="pill-badge neutral">
            Data: ${latestResult?.dataSource === "filingpulse_api" ? "Live FilingPulse API" : "EDGAR Core Fixtures"}
          </span>
        </div>
      </header>

      <section class="kpi-strip" aria-label="Hybrid Inference Telemetry">
        <div class="kpi-card">
          <div class="kpi-label">Portfolio Risk Score</div>
          <div class="kpi-val ${riskClass}" id="kpi-risk">${latestResult ? `${riskScore}/100` : "—"}</div>
          <div class="kpi-sub">Weighted 8-K materiality &amp; Form 4 cluster exposure</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Inference Latency</div>
          <div class="kpi-val" id="kpi-latency">${latestResult ? `${latestResult.latencyMs} ms` : "—"}</div>
          <div class="kpi-sub">Route: ${escapeHtml(latestResult?.engineUsed ?? "pending")}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Cloud Cost Saved</div>
          <div class="kpi-val good" id="kpi-saved">$${cumulativeSavedUsd.toFixed(4)}</div>
          <div class="kpi-sub">Runs: ${runsCompleted} · Current call: $${(latestResult?.estimatedCloudCostUsd ?? 0).toFixed(4)}</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-label">Portfolio Data Off-Device</div>
          <div class="kpi-val ${latestResult?.bytesPortfolioSentOffDevice === 0 ? "good" : "warn"}" id="kpi-egress">${latestResult ? `${latestResult.bytesPortfolioSentOffDevice} B` : "0 B"}</div>
          <div class="kpi-sub">${latestResult?.privacyBoundary === "local_only_zero_egress" ? "100% private local matching" : "Weights redacted before cloud fallback"}</div>
        </div>
      </section>

      <div class="workspace-grid">
        <section class="card" aria-label="Private Portfolio & Hybrid Controls">
          <div class="card-head">
            <h2>Private Portfolio (Local Browser State)</h2>
            <span style="font-family:var(--mono);font-size:12px;color:var(--muted);">Total Weight: ${totalWeight}%</span>
          </div>

          <div class="privacy-callout">
            <strong>Zero-Egress Privacy Boundary:</strong> Your holdings, dollar cost basis, and private thesis notes stay inside this browser tab during <code>PREFER_ON_DEVICE</code> and <code>ONLY_ON_DEVICE</code> inference.
          </div>

          <div>
            <div style="font-size:11px;text-transform:uppercase;color:var(--muted);margin-bottom:7px;font-weight:700;">
              Firebase AI Logic Inference Mode
            </div>
            <div class="mode-selector">
              <button class="mode-btn ${preference === "PREFER_ON_DEVICE" ? "active" : ""}" data-mode="PREFER_ON_DEVICE">
                PREFER_ON_DEVICE
                <span>Gemini Nano · $0 · Private</span>
              </button>
              <button class="mode-btn ${preference === "PREFER_IN_CLOUD" ? "active cloud-mode" : ""}" data-mode="PREFER_IN_CLOUD">
                PREFER_IN_CLOUD
                <span>Cloud Gemini · Deep Diff</span>
              </button>
              <button class="mode-btn ${preference === "ONLY_ON_DEVICE" ? "active" : ""}" data-mode="ONLY_ON_DEVICE">
                ONLY_ON_DEVICE
                <span>Strict Air-Gapped Lock</span>
              </button>
            </div>
          </div>

          <div class="form-row" style="justify-content:space-between;">
            <label class="toggle-label">
              <input type="checkbox" id="toggle-nano-sim" ${simulateNanoAvailable ? "checked" : ""} />
              Simulate On-Device Gemini Nano Available
            </label>
            <label class="toggle-label">
              <input type="checkbox" id="toggle-live-api" ${useLiveApi ? "checked" : ""} />
              Query Local FilingPulse API (${escapeHtml(filingPulseApiUrl)})
            </label>
          </div>

          <table class="portfolio-table">
            <thead>
              <tr>
                <th>Ticker</th>
                <th>Wt %</th>
                <th>Private Thesis Note</th>
                <th></th>
              </tr>
            </thead>
            <tbody>
              ${positions
                .map(
                  (p, idx) => `
                <tr>
                  <td><input class="input-sm ticker" data-field="ticker" data-idx="${idx}" value="${escapeHtml(p.ticker)}" /></td>
                  <td><input class="input-sm num" type="number" min="0" max="100" data-field="weightPct" data-idx="${idx}" value="${p.weightPct}" /></td>
                  <td><input class="input-sm note" data-field="thesisNote" data-idx="${idx}" value="${escapeHtml(p.thesisNote)}" /></td>
                  <td><button class="btn ghost" data-remove="${idx}" aria-label="Remove ${escapeHtml(p.ticker)}">✕</button></td>
                </tr>
              `
                )
                .join("")}
            </tbody>
          </table>

          <div class="form-row">
            <button class="btn" id="btn-add-holding">+ Add Holding</button>
            <button class="btn primary" id="btn-run-analysis">Run Hybrid Risk Analysis</button>
          </div>
        </section>

        <section class="card" aria-label="Hybrid AI Risk Brief & Alerts">
          <div class="card-head">
            <h2>Hybrid AI Executive Risk Brief</h2>
            <span style="font-family:var(--mono);font-size:11.5px;color:var(--muted);">Mode: ${preference}</span>
          </div>

          <div class="brief-box" id="executive-brief">
            ${escapeHtml(latestResult?.executiveBrief ?? "Running initial on-device portfolio risk scan...")}
            ${
              latestResult?.fallbackReason
                ? `<div style="margin-top:8px;font-size:12px;color:#fde68a;"><strong>Route Note:</strong> ${escapeHtml(latestResult.fallbackReason)}</div>`
                : ""
            }
          </div>

          <div>
            <div style="font-size:11px;text-transform:uppercase;color:var(--muted);margin-bottom:8px;font-weight:700;">
              Per-Holding SEC 8-K &amp; Form 4 Signal Cards
            </div>
            <div class="alerts-list" id="alerts-list">
              ${(latestResult?.alerts ?? [])
                .map(
                  (a) => `
                <article class="alert-card ${a.riskLevel}">
                  <div class="alert-top">
                    <strong>${escapeHtml(a.ticker)} · ${escapeHtml(a.companyName)} (${a.weightPct}% wt)</strong>
                    <span class="risk-tag ${a.riskLevel}">${a.riskLevel}</span>
                  </div>
                  <div class="alert-meta">
                    Composite: ${a.compositeScore >= 0 ? "+" : ""}${a.compositeScore} · 8-K Score: ${a.latest8KScore}/100 [Items ${escapeHtml(a.latest8KItems.join(", ") || "None")}] · Cluster: ${escapeHtml(a.clusterSignal)} (${a.clusterScore >= 0 ? "+" : ""}${a.clusterScore})
                  </div>
                  <p class="alert-action">${escapeHtml(a.recommendedAction)}</p>
                </article>
              `
                )
                .join("")}
            </div>
          </div>

          <div>
            <div style="font-size:11px;text-transform:uppercase;color:var(--muted);margin-bottom:6px;font-weight:700;">
              Firebase AI Logic Hybrid Telemetry Snapshot
            </div>
            <pre class="telemetry-code" id="telemetry-json">${escapeHtml(
              JSON.stringify(
                latestResult
                  ? {
                      firebaseInferenceMode: latestResult.preference,
                      engineUsed: latestResult.engineUsed,
                      privacyBoundary: latestResult.privacyBoundary,
                      bytesPortfolioSentOffDevice: latestResult.bytesPortfolioSentOffDevice,
                      latencyMs: latestResult.latencyMs,
                      estimatedCloudCostUsd: latestResult.estimatedCloudCostUsd,
                      estimatedCloudCostSavedUsd: latestResult.estimatedCloudCostSavedUsd,
                      dataSource: latestResult.dataSource,
                    }
                  : { status: "initializing" },
                null,
                2
              )
            )}</pre>
          </div>
        </section>
      </div>

      <footer class="footer-bar">
        <span>FilingPulse Hybrid AI Co-Pilot · Powered by <code>@filingpulse/core</code> + Firebase AI Logic Web SDK</span>
        <span>Zero secrets committed · Configure optional <code>VITE_FIREBASE_*</code> env vars for live Cloud Gemini fallback</span>
      </footer>
    </div>
  `;

  bindEvents();
}

function bindEvents() {
  document.querySelectorAll<HTMLButtonElement>(".mode-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      preference = (btn.dataset.mode as InferencePreference) || "PREFER_ON_DEVICE";
      void executeAnalysis();
    });
  });

  document.getElementById("toggle-nano-sim")?.addEventListener("change", (e) => {
    simulateNanoAvailable = (e.target as HTMLInputElement).checked;
    void executeAnalysis();
  });

  document.getElementById("toggle-live-api")?.addEventListener("change", (e) => {
    useLiveApi = (e.target as HTMLInputElement).checked;
    void executeAnalysis();
  });

  document.querySelectorAll<HTMLInputElement>("[data-field]").forEach((input) => {
    input.addEventListener("change", () => {
      const idx = Number(input.dataset.idx);
      const field = input.dataset.field as keyof PortfolioPosition;
      if (!positions[idx]) return;
      if (field === "weightPct") {
        positions[idx].weightPct = Math.max(0, Math.min(100, Number(input.value) || 0));
      } else if (field === "ticker") {
        positions[idx].ticker = input.value.trim().toUpperCase();
      } else if (field === "thesisNote") {
        positions[idx].thesisNote = input.value;
      }
    });
  });

  document.querySelectorAll<HTMLButtonElement>("[data-remove]").forEach((btn) => {
    btn.addEventListener("click", () => {
      const idx = Number(btn.dataset.remove);
      if (positions.length > 1) {
        positions.splice(idx, 1);
        void executeAnalysis();
      }
    });
  });

  document.getElementById("btn-add-holding")?.addEventListener("click", () => {
    positions.push({
      ticker: "MSFT",
      weightPct: 10,
      costBasisUsd: 10000,
      thesisNote: "Cloud & enterprise software core allocation",
    });
    void executeAnalysis();
  });

  document.getElementById("btn-run-analysis")?.addEventListener("click", () => {
    void executeAnalysis();
  });
}

async function executeAnalysis() {
  const fb = getEnvFirebaseConfig();
  const result = await runHybridPortfolioAnalysis({
    positions,
    preference,
    config: {
      ...fb,
      useLiveApi,
      filingPulseApiUrl,
      filingPulseApiKey,
      simulateOnDeviceAvailable: simulateNanoAvailable,
    },
  });

  latestResult = result;
  runsCompleted += 1;
  cumulativeSavedUsd += result.estimatedCloudCostSavedUsd;
  render();
}

render();
void executeAnalysis();
