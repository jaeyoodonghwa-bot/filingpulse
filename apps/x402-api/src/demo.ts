export interface DemoPageConfig {
  stripePaymentLink: string;
  payToAddress: string;
  network: string;
  demoApiKey: string;
}

function escapeHtml(input: string): string {
  return input
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

export function renderDemoHtml(config: DemoPageConfig): string {
  const safeStripe = escapeHtml(config.stripePaymentLink);
  const safePayTo = escapeHtml(config.payToAddress);
  const safeNetwork = escapeHtml(config.network);
  const safeDemoKey = escapeHtml(config.demoApiKey);

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>FilingPulse — SEC EDGAR 8-K &amp; Form 4 Real-Time x402 Signal API</title>
  <style>
    :root {
      --bg: #0b0f17;
      --surface: #121826;
      --surface-2: #182133;
      --border: #26324a;
      --text: #f1f5f9;
      --muted: #94a3b8;
      --accent: #38bdf8;
      --accent-strong: #0284c7;
      --green: #22c55e;
      --green-bg: rgba(34, 197, 94, 0.14);
      --red: #f43f5e;
      --red-bg: rgba(244, 63, 94, 0.14);
      --amber: #f59e0b;
      --amber-bg: rgba(245, 158, 11, 0.14);
      --mono: ui-monospace, SFMono-Regular, Menlo, Monaco, Consolas, monospace;
      --sans: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, Inter, sans-serif;
    }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      font-family: var(--sans);
      background: var(--bg);
      color: var(--text);
      line-height: 1.5;
    }
    .container {
      max-width: 1220px;
      margin: 0 auto;
      padding: 24px 20px 64px;
    }
    header {
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      align-items: center;
      gap: 16px;
      padding-bottom: 20px;
      border-bottom: 1px solid var(--border);
      margin-bottom: 24px;
    }
    .brand {
      display: flex;
      align-items: center;
      gap: 12px;
    }
    .logo {
      width: 40px;
      height: 40px;
      border-radius: 10px;
      background: linear-gradient(135deg, #0ea5e9, #22c55e);
      display: grid;
      place-items: center;
      font-weight: 800;
      color: #06101a;
      font-size: 18px;
      letter-spacing: -0.04em;
    }
    h1 {
      margin: 0;
      font-size: 22px;
      letter-spacing: -0.02em;
    }
    .subtitle {
      margin: 2px 0 0;
      font-size: 13px;
      color: var(--muted);
    }
    .header-actions {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
    }
    .badge {
      display: inline-flex;
      align-items: center;
      gap: 6px;
      padding: 5px 10px;
      border-radius: 999px;
      font-size: 12px;
      font-weight: 600;
      border: 1px solid var(--border);
      background: var(--surface);
      color: var(--text);
    }
    .badge.live { border-color: rgba(34,197,94,0.4); color: #86efac; }
    .dot {
      width: 8px;
      height: 8px;
      border-radius: 50%;
      background: var(--green);
      display: inline-block;
    }
    .cta-btn {
      display: inline-flex;
      align-items: center;
      gap: 8px;
      padding: 9px 16px;
      border-radius: 8px;
      background: #22c55e;
      color: #052e16;
      font-weight: 700;
      font-size: 13px;
      text-decoration: none;
      border: none;
      cursor: pointer;
    }
    .cta-btn:hover { filter: brightness(1.06); }
    .metrics-grid {
      display: grid;
      grid-template-columns: repeat(4, minmax(0, 1fr));
      gap: 14px;
      margin-bottom: 24px;
    }
    @media (max-width: 900px) {
      .metrics-grid { grid-template-columns: repeat(2, minmax(0, 1fr)); }
    }
    .metric-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 16px;
    }
    .metric-label {
      font-size: 12px;
      color: var(--muted);
      text-transform: uppercase;
      letter-spacing: 0.06em;
    }
    .metric-value {
      font-size: 24px;
      font-weight: 800;
      margin-top: 6px;
      font-family: var(--mono);
    }
    .metric-sub {
      font-size: 12px;
      color: var(--muted);
      margin-top: 4px;
    }
    .controls-panel {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px;
      margin-bottom: 22px;
    }
    .controls-row {
      display: flex;
      flex-wrap: wrap;
      gap: 10px;
      align-items: center;
      justify-content: space-between;
    }
    .ticker-pills {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    .pill {
      padding: 7px 12px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--surface-2);
      color: var(--text);
      font-family: var(--mono);
      font-size: 13px;
      font-weight: 700;
      cursor: pointer;
    }
    .pill.active {
      border-color: var(--accent);
      background: rgba(56, 189, 248, 0.16);
      color: #bae6fd;
    }
    .input-group {
      display: flex;
      flex-wrap: wrap;
      gap: 8px;
      align-items: center;
    }
    input[type="text"] {
      background: var(--bg);
      border: 1px solid var(--border);
      color: var(--text);
      border-radius: 8px;
      padding: 8px 12px;
      font-family: var(--mono);
      font-size: 13px;
      width: 110px;
      text-transform: uppercase;
    }
    .btn {
      padding: 8px 14px;
      border-radius: 8px;
      border: 1px solid var(--border);
      background: var(--surface-2);
      color: var(--text);
      font-size: 13px;
      font-weight: 600;
      cursor: pointer;
    }
    .btn.primary {
      background: var(--accent-strong);
      border-color: var(--accent);
      color: #fff;
    }
    .btn.warn {
      background: rgba(245, 158, 11, 0.18);
      border-color: var(--amber);
      color: #fde68a;
    }
    .btn:hover { filter: brightness(1.1); }
    .main-grid {
      display: grid;
      grid-template-columns: 1.25fr 1fr;
      gap: 18px;
    }
    @media (max-width: 960px) {
      .main-grid { grid-template-columns: 1fr; }
    }
    .panel {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: 12px;
      padding: 18px;
      display: flex;
      flex-direction: column;
      gap: 14px;
    }
    .panel-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      gap: 10px;
      border-bottom: 1px solid var(--border);
      padding-bottom: 10px;
    }
    .panel-title {
      margin: 0;
      font-size: 15px;
      font-weight: 700;
    }
    .status-pill {
      padding: 3px 10px;
      border-radius: 999px;
      font-family: var(--mono);
      font-size: 12px;
      font-weight: 700;
    }
    .status-200 { background: var(--green-bg); color: #86efac; border: 1px solid rgba(34,197,94,0.4); }
    .status-402 { background: var(--amber-bg); color: #fde68a; border: 1px solid rgba(245,158,11,0.5); }
    .status-err { background: var(--red-bg); color: #fda4af; border: 1px solid rgba(244,63,94,0.5); }
    .signal-summary {
      display: grid;
      grid-template-columns: repeat(3, minmax(0, 1fr));
      gap: 10px;
    }
    .stat-box {
      background: var(--surface-2);
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px;
    }
    .stat-box .lbl { font-size: 11px; color: var(--muted); text-transform: uppercase; }
    .stat-box .val { font-size: 20px; font-weight: 800; font-family: var(--mono); margin-top: 4px; }
    .val.pos { color: var(--green); }
    .val.neg { color: var(--red); }
    .val.neu { color: var(--accent); }
    .highlights {
      margin: 0;
      padding-left: 18px;
      font-size: 13px;
      color: #cbd5e1;
    }
    .highlights li { margin-bottom: 6px; }
    table {
      width: 100%;
      border-collapse: collapse;
      font-size: 12px;
    }
    th, td {
      text-align: left;
      padding: 8px 8px;
      border-bottom: 1px solid var(--border);
    }
    th { color: var(--muted); font-weight: 600; text-transform: uppercase; font-size: 11px; }
    .code-box {
      background: #070b12;
      border: 1px solid var(--border);
      border-radius: 10px;
      padding: 12px;
      font-family: var(--mono);
      font-size: 12px;
      color: #cbd5e1;
      overflow-x: auto;
      max-height: 280px;
      overflow-y: auto;
      white-space: pre-wrap;
      word-break: break-word;
      margin: 0;
    }
    .tag {
      display: inline-block;
      padding: 2px 7px;
      border-radius: 6px;
      font-size: 11px;
      font-weight: 700;
      font-family: var(--mono);
    }
    .tag.critical { background: var(--red-bg); color: #fda4af; }
    .tag.high { background: var(--amber-bg); color: #fde68a; }
    .tag.medium { background: rgba(56,189,248,0.16); color: #7dd3fc; }
    .tag.low { background: rgba(148,163,184,0.16); color: #cbd5e1; }
    .tag.buy { background: var(--green-bg); color: #86efac; }
    .tag.sell { background: var(--red-bg); color: #fda4af; }
    .footer-note {
      margin-top: 24px;
      padding-top: 16px;
      border-top: 1px solid var(--border);
      display: flex;
      flex-wrap: wrap;
      justify-content: space-between;
      gap: 12px;
      font-size: 12px;
      color: var(--muted);
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <div class="brand">
        <div class="logo">FP</div>
        <div>
          <h1>FilingPulse — SEC EDGAR 8-K &amp; Form 4 Signal API</h1>
          <p class="subtitle">Deterministic Edge Parser on Cloudflare Workers · Dual-Rail Monetization (x402 USDC on Base + Stripe)</p>
        </div>
      </div>
      <div class="header-actions">
        <span class="badge live"><span class="dot"></span> x402 Base Mainnet (${safeNetwork})</span>
        <span class="badge">PayTo: <code style="font-family:var(--mono)">${safePayTo.slice(0, 8)}…${safePayTo.slice(-4)}</code></span>
        <a class="cta-btn" href="${safeStripe}" target="_blank" rel="noopener noreferrer">Stripe Pro $29/mo (5,000 calls)</a>
      </div>
    </header>

    <section class="metrics-grid" aria-label="Unit Economics">
      <div class="metric-card">
        <div class="metric-label">x402 Per-Call Price</div>
        <div class="metric-value">$0.02</div>
        <div class="metric-sub">USDC on Base · $0.05 Cluster Scan</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Est. Unit COGS</div>
        <div class="metric-value">$0.00051</div>
        <div class="metric-sub">SEC EDGAR $0.00 + Edge CPU + Base gas</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Gross Margin</div>
        <div class="metric-value" style="color:var(--green)">97.4%</div>
        <div class="metric-sub">$19.49 net profit / 1,000 x402 calls</div>
      </div>
      <div class="metric-card">
        <div class="metric-label">Channels Ready</div>
        <div class="metric-value">3 Rails</div>
        <div class="metric-sub">x402 Agent Pay · Stripe Key · Apify MCP</div>
      </div>
    </section>

    <section class="controls-panel" aria-label="Interactive API Tester">
      <div class="controls-row">
        <div class="ticker-pills" id="ticker-pills">
          <button class="pill active" data-ticker="AMD">AMD</button>
          <button class="pill" data-ticker="AAPL">AAPL</button>
          <button class="pill" data-ticker="NVDA">NVDA</button>
          <button class="pill" data-ticker="PLTR">PLTR</button>
          <button class="pill" data-ticker="MSFT">MSFT</button>
          <button class="pill" data-ticker="TSLA">TSLA</button>
          <button class="pill" data-ticker="ACME">ACME (Risk)</button>
        </div>
        <div class="input-group">
          <input id="ticker-input" type="text" value="AMD" maxlength="10" aria-label="Ticker symbol" />
          <button class="btn primary" id="btn-fetch-signal">Fetch Signal (200)</button>
          <button class="btn" id="btn-fetch-diff">8-K Material Diff</button>
          <button class="btn" id="btn-fetch-clusters">Scan Clusters</button>
          <button class="btn warn" id="btn-test-402">Probe HTTP 402 Gate</button>
        </div>
      </div>
    </section>

    <div class="main-grid">
      <section class="panel" aria-label="Signal Visualizer">
        <div class="panel-header">
          <h2 class="panel-title" id="signal-heading">FilingPulse Signal Output</h2>
          <span class="status-pill status-200" id="signal-status">READY</span>
        </div>

        <div class="signal-summary" id="signal-summary">
          <div class="stat-box">
            <div class="lbl">Composite Score</div>
            <div class="val neu" id="stat-composite">—</div>
          </div>
          <div class="stat-box">
            <div class="lbl">Insider Cluster</div>
            <div class="val neu" id="stat-cluster">—</div>
          </div>
          <div class="stat-box">
            <div class="lbl">Latest 8-K Score</div>
            <div class="val neu" id="stat-8k">—</div>
          </div>
        </div>

        <div>
          <strong style="font-size:12px;color:var(--muted);text-transform:uppercase;">Signal Highlights</strong>
          <ul class="highlights" id="signal-highlights">
            <li>Loading deterministic fixture signal...</li>
          </ul>
        </div>

        <div>
          <strong style="font-size:12px;color:var(--muted);text-transform:uppercase;">Form 4 Insider Transactions &amp; 8-K Events</strong>
          <div id="signal-table-wrap" style="margin-top:8px;"></div>
        </div>

        <div>
          <strong style="font-size:12px;color:var(--muted);text-transform:uppercase;">Raw JSON Payload</strong>
          <pre class="code-box" id="signal-json">{}</pre>
        </div>
      </section>

      <section class="panel" aria-label="x402 Payment Required Inspector">
        <div class="panel-header">
          <h2 class="panel-title">Live HTTP 402 x402 Gate Inspector</h2>
          <span class="status-pill status-402" id="x402-status">PROBING...</span>
        </div>
        <p style="margin:0;font-size:13px;color:var(--muted);">
          Requests to <code style="font-family:var(--mono)">/v1/*</code> without an <code style="font-family:var(--mono)">x-api-key</code> or valid <code style="font-family:var(--mono)">PAYMENT-SIGNATURE</code> header automatically return <strong>HTTP 402 Payment Required</strong> with Base USDC (<code style="font-family:var(--mono)">${safeNetwork}</code>) terms.
        </p>

        <div>
          <strong style="font-size:12px;color:var(--muted);text-transform:uppercase;">HTTP 402 Response Headers</strong>
          <pre class="code-box" id="x402-headers">Probing unpaid GET /v1/signals/AAPL...</pre>
        </div>

        <div>
          <strong style="font-size:12px;color:var(--muted);text-transform:uppercase;">Decoded x402 Payment Requirements</strong>
          <pre class="code-box" id="x402-body">{}</pre>
        </div>

        <div>
          <strong style="font-size:12px;color:var(--muted);text-transform:uppercase;">Quick cURL Commands</strong>
          <pre class="code-box" id="curl-snippet">curl -i /v1/signals/AAPL
curl -H "x-api-key: ${safeDemoKey}" "/v1/signals/AMD?mode=fixture"</pre>
        </div>
      </section>
    </div>

    <footer class="footer-note">
      <span>FilingPulse v1.0.0 · Pure TypeScript Core · Zero Node-only Deps</span>
      <span>Data Source: Official SEC EDGAR REST/XML APIs + Deterministic Offline Fixture Mode</span>
    </footer>
  </div>

  <script>
    (function () {
      const DEMO_API_KEY = ${JSON.stringify(config.demoApiKey)};
      const tickerInput = document.getElementById("ticker-input");
      const pills = Array.from(document.querySelectorAll(".pill"));
      const signalHeading = document.getElementById("signal-heading");
      const signalStatus = document.getElementById("signal-status");
      const statComposite = document.getElementById("stat-composite");
      const statCluster = document.getElementById("stat-cluster");
      const stat8k = document.getElementById("stat-8k");
      const signalHighlights = document.getElementById("signal-highlights");
      const signalTableWrap = document.getElementById("signal-table-wrap");
      const signalJson = document.getElementById("signal-json");
      const x402Status = document.getElementById("x402-status");
      const x402Headers = document.getElementById("x402-headers");
      const x402Body = document.getElementById("x402-body");

      function setActiveTicker(t) {
        const clean = (t || "AMD").trim().toUpperCase();
        tickerInput.value = clean;
        pills.forEach((p) => p.classList.toggle("active", p.dataset.ticker === clean));
        return clean;
      }

      function fmtMoney(n) {
        if (typeof n !== "number") return "$0";
        return "$" + Math.round(n).toLocaleString("en-US");
      }

      function scoreClass(n) {
        if (n >= 15) return "val pos";
        if (n <= -15) return "val neg";
        return "val neu";
      }

      function setListItems(el, items) {
        el.innerHTML = "";
        (items || []).forEach((text) => {
          const li = document.createElement("li");
          li.textContent = text;
          el.appendChild(li);
        });
      }

      async function fetchSignal(ticker) {
        const sym = setActiveTicker(ticker);
        signalHeading.textContent = sym + " — 8-K & Form 4 Signal";
        signalStatus.textContent = "LOADING...";
        try {
          const res = await fetch("/v1/signals/" + encodeURIComponent(sym) + "?mode=fixture", {
            headers: { "x-api-key": DEMO_API_KEY }
          });
          const data = await res.json();
          signalStatus.textContent = "HTTP " + res.status;
          signalStatus.className = "status-pill " + (res.ok ? "status-200" : "status-err");
          signalJson.textContent = JSON.stringify(data, null, 2);

          if (!res.ok) return;

          statComposite.textContent = (data.compositeScore >= 0 ? "+" : "") + data.compositeScore;
          statComposite.className = scoreClass(data.compositeScore);

          const cScore = data.insiderCluster ? data.insiderCluster.clusterScore : 0;
          statCluster.textContent = (cScore >= 0 ? "+" : "") + cScore;
          statCluster.className = scoreClass(cScore);

          const top8k = data.latest8K && data.latest8K[0];
          stat8k.textContent = top8k ? top8k.materialityScore + "/100" : "0/100";
          stat8k.className = "val neu";

          setListItems(signalHighlights, data.highlights || []);

          const txs = (data.insiderCluster && data.insiderCluster.transactions) || [];
          const events = data.latest8K || [];
          let html = "<table><thead><tr><th>Type</th><th>Date</th><th>Actor / Items</th><th>Details</th></tr></thead><tbody>";
          events.slice(0, 3).forEach((ev) => {
            html += "<tr><td><span class=\\"tag " + ev.severity + "\\">8-K " + ev.severity.toUpperCase() + "</span></td>"
              + "<td>" + ev.filingDate + "</td>"
              + "<td>Items " + ev.items.join(", ") + "</td>"
              + "<td>Score " + ev.materialityScore + "/100 (" + ev.direction + ")</td></tr>";
          });
          txs.slice(0, 4).forEach((tx) => {
            const cls = tx.transactionCode === "P" ? "buy" : "sell";
            const label = tx.transactionCode === "P" ? "FORM 4 BUY" : "FORM 4 SELL";
            html += "<tr><td><span class=\\"tag " + cls + "\\">" + label + "</span></td>"
              + "<td>" + tx.transactionDate + "</td>"
              + "<td>" + tx.insiderName + " (" + tx.insiderTitle + ")</td>"
              + "<td>" + fmtMoney(tx.totalValueUsd) + (tx.is10b51Plan ? " · 10b5-1" : "") + "</td></tr>";
          });
          html += "</tbody></table>";
          signalTableWrap.innerHTML = html;
        } catch (err) {
          signalStatus.textContent = "ERROR";
          signalStatus.className = "status-pill status-err";
          signalJson.textContent = String(err);
        }
      }

      async function fetchDiff(ticker) {
        const sym = setActiveTicker(ticker);
        signalHeading.textContent = sym + " — 8-K Material Diff";
        const res = await fetch("/v1/8k/material-diff/" + encodeURIComponent(sym) + "?mode=fixture", {
          headers: { "x-api-key": DEMO_API_KEY }
        });
        const data = await res.json();
        signalStatus.textContent = "HTTP " + res.status;
        signalStatus.className = "status-pill " + (res.ok ? "status-200" : "status-err");
        statComposite.textContent = (data.materialityDelta >= 0 ? "+" : "") + (data.materialityDelta ?? 0);
        statComposite.className = "val neu";
        statCluster.textContent = data.severityShift || "—";
        statCluster.className = "val neu";
        stat8k.textContent = (data.addedItems ? data.addedItems.length : 0) + " new";
        stat8k.className = "val neu";
        setListItems(signalHighlights, [data.headlineDelta, ...(data.highlights || [])]);
        signalTableWrap.innerHTML = "";
        signalJson.textContent = JSON.stringify(data, null, 2);
      }

      async function fetchClusters() {
        signalHeading.textContent = "Multi-Ticker Insider Cluster Scan ($0.05)";
        const res = await fetch("/v1/insiders/clusters?mode=fixture", {
          headers: { "x-api-key": DEMO_API_KEY }
        });
        const data = await res.json();
        signalStatus.textContent = "HTTP " + res.status;
        signalStatus.className = "status-pill " + (res.ok ? "status-200" : "status-err");
        statComposite.textContent = String(data.scannedTickers || 0) + " tickers";
        statComposite.className = "val neu";
        const top = data.clusters && data.clusters[0];
        statCluster.textContent = top ? top.ticker + " (" + top.clusterScore + ")" : "—";
        statCluster.className = top ? scoreClass(top.clusterScore) : "val neu";
        stat8k.textContent = (data.windowDays || 30) + "d";
        stat8k.className = "val neu";
        setListItems(signalHighlights, (data.clusters || []).slice(0, 4).map((c) =>
          c.ticker + ": " + c.signal + " (score " + c.clusterScore + ", buyers=" + c.uniqueBuyers + ", sellers=" + c.uniqueSellers + ")"
        ));
        let html = "<table><thead><tr><th>Ticker</th><th>Signal</th><th>Score</th><th>Net USD</th></tr></thead><tbody>";
        (data.clusters || []).forEach((c) => {
          const cls = c.clusterScore >= 0 ? "buy" : "sell";
          html += "<tr><td><strong>" + c.ticker + "</strong></td>"
            + "<td><span class=\\"tag " + cls + "\\">" + c.signal + "</span></td>"
            + "<td>" + c.clusterScore + "</td>"
            + "<td>" + fmtMoney(c.netValueUsd) + "</td></tr>";
        });
        html += "</tbody></table>";
        signalTableWrap.innerHTML = html;
        signalJson.textContent = JSON.stringify(data, null, 2);
      }

      async function probe402(ticker) {
        const sym = (ticker || tickerInput.value || "AAPL").trim().toUpperCase();
        x402Status.textContent = "PROBING...";
        try {
          const res = await fetch("/v1/signals/" + encodeURIComponent(sym), {
            method: "GET"
          });
          x402Status.textContent = "HTTP " + res.status + " " + (res.status === 402 ? "PAYMENT REQUIRED" : "");
          x402Status.className = "status-pill " + (res.status === 402 ? "status-402" : "status-err");

          const headerLines = [];
          res.headers.forEach((value, key) => {
            headerLines.push(key + ": " + value);
          });
          x402Headers.textContent = headerLines.join("\\n") || "(no headers)";

          const paymentReqHeader = res.headers.get("payment-required") || res.headers.get("x-payment-required");
          const rawText = await res.text();
          let decoded = null;
          if (paymentReqHeader) {
            try {
              decoded = JSON.parse(atob(paymentReqHeader));
            } catch {
              try { decoded = JSON.parse(paymentReqHeader); } catch {}
            }
          }
          if (!decoded && rawText) {
            try { decoded = JSON.parse(rawText); } catch { decoded = { raw: rawText }; }
          }
          x402Body.textContent = JSON.stringify(decoded || { status: res.status }, null, 2);
        } catch (err) {
          x402Status.textContent = "PROBE ERROR";
          x402Status.className = "status-pill status-err";
          x402Body.textContent = String(err);
        }
      }

      pills.forEach((pill) => {
        pill.addEventListener("click", () => {
          const sym = pill.dataset.ticker;
          fetchSignal(sym);
          probe402(sym);
        });
      });

      document.getElementById("btn-fetch-signal").addEventListener("click", () => fetchSignal(tickerInput.value));
      document.getElementById("btn-fetch-diff").addEventListener("click", () => fetchDiff(tickerInput.value));
      document.getElementById("btn-fetch-clusters").addEventListener("click", () => fetchClusters());
      document.getElementById("btn-test-402").addEventListener("click", () => probe402(tickerInput.value));

      // Initial render: load AMD signal + probe unpaid AAPL 402 gate
      fetchSignal("AMD");
      probe402("AAPL");
    })();
  </script>
</body>
</html>`;
}
