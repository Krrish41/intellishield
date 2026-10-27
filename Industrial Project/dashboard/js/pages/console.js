/**
 * IntelliShield Live Console Page Component (#/console)
 * Unified command and telemetry console combining real-time telemetry streaming,
 * canvas charts, sortable IP table, terminal event log, microservice health tiles,
 * and integrated multi-vector attack simulation suite.
 */

import { dataManager } from '../datasource.js';
import { backgroundEngine } from '../background.js';
import { cursorEngine } from '../cursor.js';
import { toastManager, DrawerManager } from '../components/modal.js';
import { Icons } from '../components/icons.js';
import { RpsTimelineChart, LatencyChart, TierDonutChart, RadarChart } from '../components/charts.js';

export class ConsolePage {
  constructor() {
    this.container = null;
    this.unsubscribe = null;
    this.rpsChart = null;
    this.latencyChart = null;
    this.donutChart = null;
    this.radarChart = null;

    this.selectedClient = null;
    this.logFilter = 'all'; // all, 200, 429, 403
    this.isLogPaused = false;
    this.lastWorstTier = 'Clean';
    this.sortCol = 'score';
    this.sortAsc = false;
    this.ipSearchTerm = '';

    // Attack simulation & demo runner state
    this.demoTimer = null;
    this.demoElapsedInterval = null;
    this.demoStartTime = 0;
    this.isDemoRunning = false;
    this.isLiveAttackActive = false;
    this.liveAttackAbortController = null;
  }

  mount(container) {
    this.container = container;
    this.renderSkeleton();
    this.initCharts();
    this.attachEvents();

    // Subscribe to unified telemetry feed
    this.unsubscribe = dataManager.subscribe(state => this.update(state));
  }

  unmount() {
    if (this.unsubscribe) {
      this.unsubscribe();
      this.unsubscribe = null;
    }
    if (this.tierFilterHandler) {
      window.removeEventListener('tier-filter-selected', this.tierFilterHandler);
      this.tierFilterHandler = null;
    }
    if (this.demoTimer) {
      clearTimeout(this.demoTimer);
      this.demoTimer = null;
    }
    if (this.demoElapsedInterval) {
      clearInterval(this.demoElapsedInterval);
      this.demoElapsedInterval = null;
    }
    if (this.liveAttackAbortController) {
      this.liveAttackAbortController.abort();
      this.liveAttackAbortController = null;
    }
    this.isDemoRunning = false;
    this.isLiveAttackActive = false;
  }

  renderSkeleton() {
    this.container.innerHTML = `
      <div class="page-view active">
        <!-- Page Header -->
        <div class="page-header reveal">
          <div class="page-header-title">
            <h2>Live Telemetry Console</h2>
            <p>Real-time ingress request flow, continuous anomaly inference, dynamic token bucket mitigation, and attack simulation suite.</p>
          </div>
          <div class="page-actions" style="display: flex; flex-wrap: wrap; gap: 8px;">
            <button class="btn btn-primary btn-sm" id="btnRunFullDemo"
                    data-tooltip-title="Run Full Review 3 Demo Sequence"
                    data-tooltip-desc="Executes automated 4-phase sequence: Benign Baseline -> Low-and-Slow Bot -> Volumetric Flood -> Flash Crowd Recovery."
                    data-tooltip-action="Click to auto-play viva presentation sequence"
                    data-tooltip-badge="AUTOMATED DEMO"
                    data-cursor="Demo">
              ${Icons.play(14)} Run Full Review 3 Demo
            </button>
            <button class="btn btn-secondary btn-sm" id="btnStopAll"
                    data-tooltip-title="Emergency Stop / Cut-Off"
                    data-tooltip-desc="Immediately terminates running scenario, aborts live ingress probes, and restores traffic to normal baseline."
                    data-tooltip-action="Click to abort all attack simulations"
                    data-tooltip-badge="EMERGENCY STOP"
                    data-tooltip-tier="blocked"
                    data-cursor="Halt">
              ${Icons.pause(14)} Stop All
            </button>
            <button class="btn btn-ghost btn-sm" id="btnResetConsole"
                    data-tooltip-title="Reset Telemetry Ledger"
                    data-tooltip-desc="Flushes the sliding-window telemetry deque, clears all recorded events, and restores client token buckets to base capacity."
                    data-tooltip-action="Click to flush all telemetry and reset tokens"
                    data-tooltip-badge="MAINTENANCE"
                    data-cursor="Reset">
              ${Icons.refresh(14)} Reset
            </button>
          </div>
        </div>

        <!-- Full Review 3 Automated Walkthrough Panel (Visible during demo sequence) -->
        <div id="demoWalkthroughPanel" class="glass-panel reveal delay1" style="display: none; padding: 20px 24px; margin-bottom: 24px; border-left: 4px solid var(--primary-cyan); box-shadow: var(--shadow-glow);">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px; flex-wrap: wrap; gap: 8px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span class="chip chip-clean" id="demoPhasePill">PHASE 1 OF 4</span>
              <h3 style="font-size: 1.15rem; margin: 0;" id="demoPhaseTitle">Normal Benign Traffic Baseline</h3>
            </div>
            <div style="display: flex; align-items: center; gap: 12px;">
              <div style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--primary-cyan);" id="demoPhaseElapsed">00:00</div>
              <button class="btn btn-ghost btn-sm" id="btnStopWalkthrough"
                      data-tooltip-title="Cancel Demo Walkthrough"
                      data-tooltip-desc="Halts the 4-phase automated demonstration sequence."
                      data-tooltip-action="Click to stop demo"
                      data-tooltip-badge="DEMO CONTROL">
                ${Icons.cross(14)} Stop Demo
              </button>
            </div>
          </div>
          <p id="demoPhaseDesc" style="font-size: 0.88rem; color: var(--text-primary); line-height: 1.6; margin-bottom: 16px;">
            Simulating legitimate browsing traffic: clients send standard GET requests to /api/v1/users.
          </p>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px; font-family: var(--font-mono); font-size: 0.8rem; background: var(--bg-surface-elevated); padding: 12px; border-radius: var(--radius-sm);">
            <div>Detection Latency: <strong id="demoDetectLatency" style="color: var(--primary-cyan);">85 ms</strong></div>
            <div>Threat Score: <strong id="demoThreatScore">0.12 (Clean)</strong></div>
            <div>Enforcement: <strong id="demoAction" style="color: var(--tier-clean);">HTTP 200 OK</strong></div>
            <div>Backend Saturation: <strong style="color: var(--tier-clean);">0.0% (Protected)</strong></div>
          </div>
        </div>

        <!-- Alert Notification Banner (hidden by default) -->
        <div id="tierAlertBanner" class="glass-panel" style="display: none; padding: 12px 16px; margin-bottom: 20px; border-left: 4px solid var(--tier-blocked); align-items: center; justify-content: space-between;">
          <div style="display: flex; align-items: center; gap: 10px;">
            <span style="color: var(--tier-blocked);">${Icons.cross(18)}</span>
            <span id="tierAlertText" style="font-weight: 600; font-size: 0.88rem;">Malicious attack traffic detected</span>
          </div>
          <button class="btn btn-ghost btn-sm" id="dismissAlertBtn"
                  data-tooltip-title="Dismiss Alert"
                  data-tooltip-desc="Hides this critical attack notification banner."
                  data-tooltip-action="Click to dismiss banner"
                  data-tooltip-badge="ALERT">${Icons.cross(14)}</button>
        </div>

        <!-- Microservice Health Tiles -->
        <div class="health-tiles-grid reveal delay1">
          <div class="glass-panel health-tile"
               data-tooltip-title="Ingress Proxy Core (:8080)"
               data-tooltip-desc="High-throughput reverse proxy core. Executes fast-path token bucket checks and zero-copy packet forwarding."
               data-tooltip-action="Monitors HTTP ingress availability on port 8080"
               data-tooltip-badge="MICROSERVICE">
            <div class="health-icon-box">
              <span style="color: var(--primary-cyan);">${Icons.network(20)}</span>
            </div>
            <div>
              <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700;">INGRESS PROXY</div>
              <div style="font-family: var(--font-mono); font-weight: 700; font-size: 0.95rem;">:8080 (Rust Core)</div>
              <div id="proxyHealthStatus" class="chip chip-clean" style="margin-top: 4px; font-size: 0.65rem;">OPERATIONAL</div>
            </div>
          </div>

          <div class="glass-panel health-tile"
               data-tooltip-title="Upstream Origin Backend (:3000)"
               data-tooltip-desc="Simulated protected application backend serving /api/v1/products, /user/profile, and /auth/login."
               data-tooltip-action="Protected by IntelliShield fast-path rate limiting"
               data-tooltip-badge="MICROSERVICE">
            <div class="health-icon-box">
              <span style="color: var(--tier-monitored);">${Icons.cpu(20)}</span>
            </div>
            <div>
              <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700;">UPSTREAM BACKEND</div>
              <div style="font-family: var(--font-mono); font-weight: 700; font-size: 0.95rem;">:3000 (Protected API)</div>
              <div id="backendHealthStatus" class="chip chip-clean" style="margin-top: 4px; font-size: 0.65rem;">HEALTHY</div>
            </div>
          </div>

          <div class="glass-panel health-tile"
               data-tooltip-title="ML Threat Inference Worker (:5001)"
               data-tooltip-desc="Asynchronous Isolation Forest threat scoring engine. Evaluates 8D feature vectors outside the critical forwarding loop."
               data-tooltip-action="Asynchronous threat scoring with 1000ms sliding evaluation"
               data-tooltip-badge="MICROSERVICE">
            <div class="health-icon-box">
              <span style="color: var(--tier-throttled);">${Icons.terminal(20)}</span>
            </div>
            <div>
              <div style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700;">ML INFERENCE WORKER</div>
              <div style="font-family: var(--font-mono); font-weight: 700; font-size: 0.95rem;">:5001 (Isolation Forest)</div>
              <div id="mlHealthStatus" class="chip chip-clean" style="margin-top: 4px; font-size: 0.65rem;">EVAL INTERVAL: 1000MS</div>
            </div>
          </div>
        </div>

        <!-- Global KPI Strip -->
        <div class="kpi-grid reveal delay2">
          <div class="glass-panel kpi-card"
               data-tooltip-title="Ingress Throughput (req/s)"
               data-tooltip-desc="Live aggregated request volume processed per second across all active connections. Measured at proxy socket ingress."
               data-tooltip-badge="GLOBAL KPI">
            <div class="kpi-label">
              <span>Ingress Throughput</span>
              ${Icons.activity(16)}
            </div>
            <div class="kpi-val">
              <span id="kpiGlobalRps">0.0</span>
            </div>
            <div class="kpi-sub">
              <span>Peak: 88,740 req/s</span>
            </div>
          </div>

          <div class="glass-panel kpi-card"
               data-tooltip-title="Forwarding Latency (Sub-Millisecond)"
               data-tooltip-desc="Rust Axum zero-copy forwarding overhead. Does not block on ML inference; guarantees sub-millisecond median response time."
               data-tooltip-badge="GLOBAL KPI">
            <div class="kpi-label">
              <span>Forwarding Latency</span>
              ${Icons.zap(16)}
            </div>
            <div class="kpi-val">
              <span id="kpiP50">0.85</span><span style="font-size: 0.95rem; font-weight: 400; margin-left: 4px;">ms</span>
            </div>
            <div class="kpi-sub">
              <span>P99: <span id="kpiP99">2.74</span> ms</span>
            </div>
          </div>

          <div class="glass-panel kpi-card"
               data-tooltip-title="Monitored Client IPs"
               data-tooltip-desc="Number of distinct IP addresses actively tracked in the sliding-window state store with behavioral metrics."
               data-tooltip-badge="GLOBAL KPI">
            <div class="kpi-label">
              <span>Monitored IPs</span>
              ${Icons.network(16)}
            </div>
            <div class="kpi-val">
              <span id="kpiActiveIps">0</span>
            </div>
            <div class="kpi-sub">
              <span>Sliding window: 5.0 s</span>
            </div>
          </div>

          <div class="glass-panel kpi-card"
               data-tooltip-title="Mitigated Requests Total"
               data-tooltip-desc="Total requests rate-limited (HTTP 429) via quadratic token bucket reduction or dropped (HTTP 403) by threat isolation."
               data-tooltip-badge="GLOBAL KPI">
            <div class="kpi-label">
              <span>Mitigated Requests</span>
              ${Icons.shield(16)}
            </div>
            <div class="kpi-val">
              <span id="kpiMitigated">0</span>
            </div>
            <div class="kpi-sub">
              <span style="color: var(--tier-throttled);"><span id="kpiThrottled">0</span> 429</span>
              <span>&bull;</span>
              <span style="color: var(--tier-blocked);"><span id="kpiBlocked">0</span> 403</span>
            </div>
          </div>
        </div>

        <!-- Integrated Attack Simulation & Ingress Probe Center -->
        <div class="glass-panel reveal delay2" style="padding: 20px 24px; margin-bottom: 24px; border: 1px solid var(--border-medium);">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 14px; flex-wrap: wrap; gap: 10px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="color: var(--primary-cyan);">${Icons.zap(20)}</span>
              <div>
                <h3 style="font-size: 1.05rem; margin: 0;">Multi-Vector Layer-7 Attack & Validation Suite</h3>
                <p style="font-size: 0.78rem; color: var(--text-muted); margin: 2px 0 0 0;">Trigger instant behavioral attack injections or fire real same-origin rate-capped ingress probes.</p>
              </div>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="chip chip-clean" style="font-size: 0.7rem;">SANDBOX READY</span>
            </div>
          </div>

          <!-- Scenario Trigger Pills Grid -->
          <div style="display: flex; flex-wrap: wrap; gap: 10px; margin-bottom: 16px;">
            <button class="btn btn-secondary btn-sm sim-scenario-btn" data-scenario="benign"
                    data-tooltip-title="Launch Benign Baseline Traffic"
                    data-tooltip-desc="Normal user session with natural inter-arrival jitter, balanced GET payloads, and multi-endpoint navigation. Keeps anomaly score <0.20."
                    data-tooltip-action="Click to inject benign human traffic (5 req/s)"
                    data-tooltip-badge="BENIGN TRAFFIC"
                    data-tooltip-tier="clean">
              <span class="chip chip-clean" style="font-size: 0.65rem; padding: 2px 6px;">5 req/s</span>
              Benign Human
            </button>

            <button class="btn btn-secondary btn-sm sim-scenario-btn" data-scenario="ddos"
                    data-tooltip-title="Inject Volumetric Flood (DDoS)"
                    data-tooltip-desc="Automated flood script blasting /api/v1/users to exhaust socket threads and saturate backend pools. Flags within 85 ms -> HTTP 429."
                    data-tooltip-action="Click to inject 80 req/s volumetric flood"
                    data-tooltip-badge="ATTACK INJECTION"
                    data-tooltip-tier="throttled">
              <span class="chip chip-throttled" style="font-size: 0.65rem; padding: 2px 6px;">80 req/s</span>
              Volumetric Flood
            </button>

            <button class="btn btn-secondary btn-sm sim-scenario-btn" data-scenario="scrape"
                    data-tooltip-title="Inject Low-and-Slow Scraper"
                    data-tooltip-desc="Programmatic scraper maintaining low velocity below fixed RPM limits but exhibiting rigid timer variance (σ² ≈ 0). Isolated via feature f_1."
                    data-tooltip-action="Click to inject low-and-slow bot"
                    data-tooltip-badge="ATTACK INJECTION"
                    data-tooltip-tier="monitored">
              <span class="chip chip-monitored" style="font-size: 0.65rem; padding: 2px 6px;">4 req/s</span>
              Stealth Scraper
            </button>

            <button class="btn btn-secondary btn-sm sim-scenario-btn" data-scenario="credential"
                    data-tooltip-title="Inject Credential Stuffing Burst"
                    data-tooltip-desc="Distributed bot probe injecting credential lists at /api/v1/auth/login, producing high HTTP 401 error ratios and triggering Booster 4 -> HTTP 403."
                    data-tooltip-action="Click to inject credential stuffing attack"
                    data-tooltip-badge="ATTACK INJECTION"
                    data-tooltip-tier="blocked">
              <span class="chip chip-blocked" style="font-size: 0.65rem; padding: 2px 6px;">POST Bursts</span>
              Credential Stuffing
            </button>

            <button class="btn btn-secondary btn-sm sim-scenario-btn" data-scenario="flash"
                    data-tooltip-title="Test Benign Flash Crowd Resilience"
                    data-tooltip-desc="Surge of 15 human users browsing simultaneously during a product drop. High velocity but natural jitter. Verifies zero false drops (100% 200 OK)."
                    data-tooltip-action="Click to test flash crowd resilience"
                    data-tooltip-badge="FALSE-POSITIVE TEST"
                    data-tooltip-tier="clean">
              <span class="chip chip-clean" style="font-size: 0.65rem; padding: 2px 6px;">50 req/s Surge</span>
              Flash Crowd
            </button>

            <button class="btn btn-secondary btn-sm sim-scenario-btn" data-scenario="cooldown"
                    data-tooltip-title="Trigger Traffic Cooldown & Reset"
                    data-tooltip-desc="Attack traffic terminates. Rolling 5.0-second sliding-window ring buffer flushes stale events, resetting token bucket to Clean parameters."
                    data-tooltip-action="Click to trigger cooldown"
                    data-tooltip-badge="AUTO RESTORATION"
                    data-tooltip-tier="clean">
              ${Icons.refresh(12)} Cooldown & Restore
            </button>
          </div>

          <!-- Live Ingress Attack Generator (Same-Origin Only) -->
          <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; padding: 12px 16px; background: var(--bg-surface-elevated); border-radius: var(--radius-sm); border: 1px dashed var(--border-medium);">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span style="color: var(--tier-blocked);">${Icons.terminal(16)}</span>
              <span style="font-size: 0.82rem; font-weight: 600;">Live HTTP Probe (Same-Origin):</span>
              <span id="liveAttackStatusText" style="font-size: 0.8rem; font-family: var(--font-mono); color: var(--text-muted);">
                Idle (Ready for live probe)
              </span>
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-danger btn-sm" id="btnStartLiveAttack"
                      data-tooltip-title="Execute Live Ingress Probe"
                      data-tooltip-desc="Sends real HTTP fetch() calls directly to /api/v1/users on localhost:8080 to test proxy mitigation live."
                      data-tooltip-action="Click to start live HTTP traffic stream"
                      data-tooltip-badge="LIVE PROBE"
                      data-cursor="Live Probe">
                Execute Live Ingress Probe
              </button>
              <button class="btn btn-secondary btn-sm" id="btnStopLiveAttack" style="display: none;"
                      data-tooltip-title="Stop Live Probe"
                      data-tooltip-desc="Aborts ongoing live HTTP fetch() requests immediately via AbortController."
                      data-tooltip-action="Click to abort live probe stream"
                      data-tooltip-badge="LIVE PROBE"
                      data-cursor="Stop Probe">
                Stop Probe
              </button>
            </div>
          </div>
        </div>

        <!-- Real-Time Charts Grid -->
        <div class="console-charts-grid reveal delay3" id="telemetryChartsGrid">
          <!-- Timeline Chart -->
          <div class="glass-panel chart-card" id="requestVelocityCard">
            <div class="chart-header">
              <div>
                <h4 style="font-size: 0.95rem;">Real-Time Request Velocity</h4>
                <p style="font-size: 0.78rem; color: var(--text-muted);">Rolling requests/sec colored by worst threat tier (Hover line for data points)</p>
              </div>
              <div style="font-family: var(--font-mono); font-size: 0.8rem; color: var(--primary-cyan);" id="chartRpsBadge">0 req/s</div>
            </div>
            <div class="chart-canvas-container">
              <canvas id="rpsTimelineCanvas"></canvas>
            </div>
          </div>

          <!-- Tier Distribution Donut -->
          <div class="glass-panel chart-card">
            <div class="chart-header">
              <div>
                <h4 style="font-size: 0.95rem;">Reputation Distribution</h4>
                <p style="font-size: 0.78rem; color: var(--text-muted);">Active client sessions per tier (Hover & Click slices)</p>
              </div>
            </div>
            <div class="chart-canvas-container" style="display: flex; align-items: center; justify-content: center;">
              <canvas id="tierDonutCanvas"></canvas>
            </div>
          </div>
        </div>

        <!-- Latency Chart Row -->
        <div class="glass-panel chart-card reveal delay3" style="margin-bottom: 24px;">
          <div class="chart-header">
            <div>
              <h4 style="font-size: 0.95rem;">Fast-Path Latency Timeline (P50 vs P99)</h4>
              <p style="font-size: 0.78rem; color: var(--text-muted);">Zero-copy Rust Axum forwarding overhead (sub-millisecond)</p>
            </div>
            <div style="display: flex; gap: 14px; font-size: 0.75rem; font-family: var(--font-mono);">
              <span style="color: var(--primary-cyan);">&bull; P50 Median</span>
              <span style="color: var(--tier-throttled);">&bull; P99 Tail</span>
            </div>
          </div>
          <div class="chart-canvas-container" style="height: 160px;">
            <canvas id="latencyCanvas"></canvas>
          </div>
        </div>

        <!-- Client Telemetry Table -->
        <div class="glass-panel reveal delay4" style="margin-bottom: 24px; padding: 20px;">
          <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 16px;">
            <div>
              <h3 style="font-size: 1.1rem;">Active Client Telemetry & Tokens</h3>
              <p style="font-size: 0.78rem; color: var(--text-muted);">Live per-IP reputation state, Isolation Forest threat score, and token bucket reserves.</p>
            </div>
            <div style="display: flex; align-items: center; gap: 10px;">
              <div class="search-box" style="position: relative;">
                <input type="text" id="ipSearchInput" placeholder="Filter by IP or Tier..." style="padding: 6px 12px; border-radius: var(--radius-sm); border: 1px solid var(--border-medium); background: var(--bg-surface-elevated); color: var(--text-primary); font-size: 0.82rem; outline: none;"
                       data-tooltip-title="Client Search Filter"
                       data-tooltip-desc="Filters client telemetry table rows in real-time by IPv4 address or reputation tier (Clean, Monitored, Throttled, Blocked)."
                       data-tooltip-action="Type to filter client sessions"
                       data-tooltip-badge="FILTER">
              </div>
            </div>
          </div>

          <div class="table-responsive">
            <table class="data-table" id="clientsTable">
              <thead>
                <tr>
                  <th class="sortable" data-col="ip" data-tooltip-title="Sort by IP Address" data-tooltip-desc="Sort client telemetry rows by client IPv4 address." data-tooltip-action="Click to toggle ascending/descending order">IP Address</th>
                  <th class="sortable" data-col="tier" data-tooltip-title="Sort by Reputation Tier" data-tooltip-desc="Sort by assigned policy tier: Clean, Monitored, Throttled, or Blocked." data-tooltip-action="Click to sort by tier">Reputation Tier</th>
                  <th class="sortable" data-col="score" data-tooltip-title="Sort by Threat Score" data-tooltip-desc="Isolation Forest normalized threat score [0.0 - 1.0]. Above 0.85 triggers immediate block." data-tooltip-action="Click to sort by anomaly score">Threat Score</th>
                  <th class="sortable" data-col="tokens" data-tooltip-title="Sort by Token Balance" data-tooltip-desc="Current available token capacity in adaptive token bucket." data-tooltip-action="Click to sort by remaining tokens">Bucket Tokens</th>
                  <th class="sortable" data-col="refill" data-tooltip-title="Sort by Refill Rate" data-tooltip-desc="Token refill rate per second after applying dynamic quadratic penalties." data-tooltip-action="Click to sort by refill rate">Refill Rate</th>
                  <th class="sortable" data-col="fwd" data-tooltip-title="Sort by Forwarded Packets" data-tooltip-desc="Cumulative HTTP 200 OK responses forwarded to origin backend." data-tooltip-action="Click to sort by forwarded count">Forwarded (200)</th>
                  <th class="sortable" data-col="thr" data-tooltip-title="Sort by Throttled Packets" data-tooltip-desc="Cumulative HTTP 429 Too Many Requests rate-limited packets." data-tooltip-action="Click to sort by throttled count">Throttled (429)</th>
                  <th class="sortable" data-col="blk" data-tooltip-title="Sort by Blocked Packets" data-tooltip-desc="Cumulative HTTP 403 Forbidden drops from malicious threat classification." data-tooltip-action="Click to sort by blocked count">Blocked (403)</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody id="clientsTableBody">
                <!-- Dynamically populated -->
              </tbody>
            </table>
          </div>
        </div>

        <!-- Event Terminal Log -->
        <div class="terminal-card reveal delay4" style="margin-bottom: 24px;">
          <div class="terminal-header">
            <div class="terminal-dots">
              <span class="t-dot red"></span>
              <span class="t-dot yellow"></span>
              <span class="t-dot green"></span>
            </div>
            <div class="terminal-title">INTELLISHIELD FASTPATH AUDIT STREAM</div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <button class="btn btn-ghost btn-sm terminal-action-btn" id="btnPauseLogs"
                      data-tooltip-title="Pause Stream"
                      data-tooltip-desc="Freezes terminal event display to inspect individual packet logs without autoscrolling."
                      data-tooltip-action="Click to toggle log autoscroll pause/resume"
                      data-tooltip-badge="LOG CONTROL">
                ${Icons.pause(12)} Pause
              </button>
              <button class="btn btn-ghost btn-sm terminal-action-btn" id="btnExportJson"
                      data-tooltip-title="Export JSON"
                      data-tooltip-desc="Saves all events in the 150-event ring buffer as a formatted JSON array."
                      data-tooltip-action="Click to download intellishield-events.json"
                      data-tooltip-badge="DATA EXPORT">
                JSON
              </button>
              <button class="btn btn-ghost btn-sm terminal-action-btn" id="btnExportCsv"
                      data-tooltip-title="Export CSV"
                      data-tooltip-desc="Exports packet audit rows (time, ip, method, path, status, latency) in spreadsheet CSV format."
                      data-tooltip-action="Click to download intellishield-events.csv"
                      data-tooltip-badge="DATA EXPORT">
                CSV
              </button>
            </div>
          </div>
          <div class="terminal-body" id="terminalLogsBody">
            <div class="log-row" style="color: #64748b;">Telemetry stream online. Listening on ingress fast-path...</div>
          </div>
        </div>
      </div>

      <!-- IP Detail Drawer -->
      <aside id="clientDetailDrawer" class="drawer" role="dialog" aria-modal="true" aria-label="Client Telemetry Detail">
        <div class="drawer-header">
          <div style="display: flex; align-items: center; gap: 8px;">
            ${Icons.network(20)}
            <h3 style="font-size: 1.1rem; margin: 0;" id="drawerClientIp">Client Detail</h3>
          </div>
          <button class="drawer-close" id="closeClientDrawerBtn"
                  data-tooltip-title="Close Drawer"
                  data-tooltip-desc="Dismisses client detail inspection drawer."
                  data-tooltip-action="Click to close drawer"
                  data-tooltip-badge="ACTION">${Icons.cross(18)}</button>
        </div>

        <div id="drawerClientBody" style="display: flex; flex-direction: column; gap: 16px;">
          <!-- Dynamically populated -->
        </div>
      </aside>
    `;
  }

  initCharts() {
    this.rpsChart = new RpsTimelineChart('rpsTimelineCanvas');
    this.donutChart = new TierDonutChart('tierDonutCanvas');
    this.latencyChart = new LatencyChart('latencyCanvas');
  }

  scrollToVelocityChart() {
    setTimeout(() => {
      const chartEl = this.container.querySelector('#requestVelocityCard') || this.container.querySelector('.console-charts-grid');
      if (chartEl) {
        chartEl.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }, 120);
  }

  attachEvents() {
    // 1. Full Review 3 Demo Runner
    this.container.querySelector('#btnRunFullDemo')?.addEventListener('click', () => {
      this.runFullReview3Demo();
      this.scrollToVelocityChart();
    });

    // 2. Stop All / Emergency Halt
    this.container.querySelector('#btnStopAll')?.addEventListener('click', () => {
      this.stopAll();
    });

    this.container.querySelector('#btnStopWalkthrough')?.addEventListener('click', () => {
      this.stopAll();
    });

    // 3. Reset Telemetry
    this.container.querySelector('#btnResetConsole')?.addEventListener('click', () => {
      dataManager.resetTelemetry();
      toastManager.show('All client telemetry reset', 'clean');
    });

    // 4. Scenario Trigger Buttons in Simulation Center (Auto-scroll to Velocity Chart)
    this.container.querySelectorAll('.sim-scenario-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const scenario = btn.dataset.scenario;
        if (scenario) {
          dataManager.triggerScenario(scenario);
          const tier = scenario === 'ddos' ? 'throttled' : (scenario === 'credential' ? 'blocked' : 'monitored');
          toastManager.show(`Triggered scenario: ${scenario.toUpperCase()}`, tier);
          this.scrollToVelocityChart();
        }
      });
    });

    // 5. Live Ingress Probe (Same-Origin Fetch)
    this.container.querySelector('#btnStartLiveAttack')?.addEventListener('click', () => {
      this.startLiveAttackProbe();
      this.scrollToVelocityChart();
    });

    this.container.querySelector('#btnStopLiveAttack')?.addEventListener('click', () => {
      this.stopLiveAttackProbe();
    });

    // 6. Alert banner dismiss
    this.container.querySelector('#dismissAlertBtn')?.addEventListener('click', () => {
      const banner = this.container.querySelector('#tierAlertBanner');
      if (banner) banner.style.display = 'none';
    });

    // 7. Pause log button
    this.container.querySelector('#btnPauseLogs')?.addEventListener('click', (e) => {
      this.isLogPaused = !this.isLogPaused;
      e.currentTarget.innerHTML = this.isLogPaused ? `${Icons.play(12)} Resume` : `${Icons.pause(12)} Pause`;
    });

    // 8. Export buttons
    this.container.querySelector('#btnExportJson')?.addEventListener('click', () => this.exportLogs('json'));
    this.container.querySelector('#btnExportCsv')?.addEventListener('click', () => this.exportLogs('csv'));

    // 9. IP Search filter
    this.container.querySelector('#ipSearchInput')?.addEventListener('input', (e) => {
      this.ipSearchTerm = e.target.value.toLowerCase().trim();
      if (this.lastState) this.updateTable(this.lastState.clients);
    });

    // 10. Table sorting headers
    this.container.querySelectorAll('.data-table th.sortable').forEach(th => {
      th.addEventListener('click', () => {
        const col = th.dataset.col;
        if (this.sortCol === col) {
          this.sortAsc = !this.sortAsc;
        } else {
          this.sortCol = col;
          this.sortAsc = false;
        }
        if (this.lastState) this.updateTable(this.lastState.clients);
      });
    });

    // 11. Drawer close
    this.container.querySelector('#closeClientDrawerBtn')?.addEventListener('click', () => {
      DrawerManager.close('clientDetailDrawer');
    });

    // 12. Donut segment click-to-filter listener
    this.tierFilterHandler = (e) => {
      const tier = e.detail?.tier;
      if (!tier) return;
      const searchInput = this.container.querySelector('#ipSearchInput');
      if (searchInput) {
        searchInput.value = tier;
        this.ipSearchTerm = tier.toLowerCase();
        if (this.lastState) this.updateTable(this.lastState.clients);
        toastManager.show(`Filtered table to ${tier} clients`, tier.toLowerCase());
      }
    };
    window.addEventListener('tier-filter-selected', this.tierFilterHandler);
  }

  runFullReview3Demo() {
    const panel = this.container.querySelector('#demoWalkthroughPanel');
    if (!panel) return;
    panel.style.display = 'block';
    this.isDemoRunning = true;
    this.demoStartTime = Date.now();

    if (this.demoElapsedInterval) clearInterval(this.demoElapsedInterval);
    this.demoElapsedInterval = setInterval(() => {
      const elapsedEl = this.container.querySelector('#demoPhaseElapsed');
      if (elapsedEl && this.demoStartTime) {
        const sec = Math.floor((Date.now() - this.demoStartTime) / 1000);
        const m = String(Math.floor(sec / 60)).padStart(2, '0');
        const s = String(sec % 60).padStart(2, '0');
        elapsedEl.textContent = `${m}:${s}`;
      }
    }, 1000);

    const phases = [
      {
        num: 1,
        title: "Phase 1: Normal Benign Traffic Baseline",
        desc: "Simulating legitimate user browsing: standard GET requests to /api/v1/users at 5 req/s. Fast-path routing delivers 0.82 ms forwarding latency with anomaly score < 0.20.",
        scenario: "benign",
        detectTime: "N/A (Benign)",
        threatScore: "0.12 (Clean Tier)",
        action: "HTTP 200 OK (Full Speed)",
        durationMs: 4500
      },
      {
        num: 2,
        title: "Phase 2: Layer-7 Volumetric HTTP Flood",
        desc: "Automated bot fires aggressive flood burst (80 req/s). Within 85 ms, sliding-window velocity flags attack, transitioning client into Throttled tier with HTTP 429 Too Many Requests.",
        scenario: "ddos",
        detectTime: "85 ms",
        threatScore: "0.78 (Throttled)",
        action: "HTTP 429 (Dynamic Penalty)",
        durationMs: 5000
      },
      {
        num: 3,
        title: "Phase 3: Automated Credential Stuffing Campaign",
        desc: "Attacker targets /api/v1/auth/login with randomized credentials. Error storm ratio (f4) spikes, activating deterministic Booster 4 to drive threat score to 0.94 (Immediate 403 Forbidden).",
        scenario: "credential",
        detectTime: "92 ms",
        threatScore: "0.94 (Blocked Tier)",
        action: "HTTP 403 Forbidden (Dropped)",
        durationMs: 5000
      },
      {
        num: 4,
        title: "Phase 4: Automatic Cooldown & Token Restoration",
        desc: "Attacker halts traffic injection. Rolling 5.0-second buffer drains stale events. Anomaly score decays below 0.40, restoring full token bucket capacity automatically.",
        scenario: "cooldown",
        detectTime: "Automated",
        threatScore: "0.15 (Clean Tier)",
        action: "Restored 30 Tokens / 8 Refill",
        durationMs: 4000
      }
    ];

    let currentIdx = 0;

    const executePhase = () => {
      if (!this.isDemoRunning || currentIdx >= phases.length) {
        if (currentIdx >= phases.length) {
          toastManager.show('Review 3 Live Demo Walkthrough Completed!', 'clean');
        }
        return;
      }

      const p = phases[currentIdx];
      dataManager.triggerScenario(p.scenario);

      const pill = this.container.querySelector('#demoPhasePill');
      const title = this.container.querySelector('#demoPhaseTitle');
      const desc = this.container.querySelector('#demoPhaseDesc');
      const detect = this.container.querySelector('#demoDetectLatency');
      const score = this.container.querySelector('#demoThreatScore');
      const action = this.container.querySelector('#demoAction');

      if (pill) pill.textContent = `PHASE ${p.num} OF 4`;
      if (title) title.textContent = p.title;
      if (desc) desc.textContent = p.desc;
      if (detect) detect.textContent = p.detectTime;
      if (score) score.textContent = p.threatScore;
      if (action) action.textContent = p.action;

      toastManager.show(`Executing: ${p.title}`, 'monitored');

      currentIdx++;
      this.demoTimer = setTimeout(executePhase, p.durationMs);
    };

    executePhase();
  }

  stopAll() {
    if (this.demoTimer) {
      clearTimeout(this.demoTimer);
      this.demoTimer = null;
    }
    if (this.demoElapsedInterval) {
      clearInterval(this.demoElapsedInterval);
      this.demoElapsedInterval = null;
    }
    if (this.liveAttackAbortController) {
      this.liveAttackAbortController.abort();
      this.liveAttackAbortController = null;
    }
    this.isDemoRunning = false;
    this.isLiveAttackActive = false;
    dataManager.triggerScenario('cooldown');

    const panel = this.container.querySelector('#demoWalkthroughPanel');
    if (panel) panel.style.display = 'none';

    const startBtn = this.container.querySelector('#btnStartLiveAttack');
    const stopBtn = this.container.querySelector('#btnStopLiveAttack');
    const statusText = this.container.querySelector('#liveAttackStatusText');
    if (startBtn) startBtn.style.display = 'inline-flex';
    if (stopBtn) stopBtn.style.display = 'none';
    if (statusText) {
      statusText.textContent = "Idle (Ready for live probe)";
      statusText.style.color = "var(--text-muted)";
    }

    toastManager.show('All attack simulations and probes halted', 'clean');
  }

  async startLiveAttackProbe() {
    this.isLiveAttackActive = true;
    this.liveAttackAbortController = new AbortController();

    const startBtn = this.container.querySelector('#btnStartLiveAttack');
    const stopBtn = this.container.querySelector('#btnStopLiveAttack');
    const statusText = this.container.querySelector('#liveAttackStatusText');

    if (startBtn) startBtn.style.display = 'none';
    if (stopBtn) stopBtn.style.display = 'inline-flex';
    if (statusText) {
      statusText.textContent = "Firing 15 req/s against same-origin /api/v1/users...";
      statusText.style.color = "var(--tier-throttled)";
    }

    toastManager.show('Live same-origin probe initiated', 'throttled');

    // Hard-capped rate: 1 request every 70 ms (~14 req/s)
    while (this.isLiveAttackActive) {
      try {
        const res = await fetch('/api/v1/users', {
          signal: this.liveAttackAbortController.signal,
          cache: 'no-store'
        });
        if (res.status === 429) {
          if (statusText) statusText.textContent = "Rate limited by proxy: HTTP 429 received!";
        } else if (res.status === 403) {
          if (statusText) statusText.textContent = "Blocked by proxy: HTTP 403 Forbidden!";
        }
      } catch (err) {
        if (err.name === 'AbortError') break;
      }
      await new Promise(r => setTimeout(r, 70));
    }
  }

  stopLiveAttackProbe() {
    this.isLiveAttackActive = false;
    if (this.liveAttackAbortController) {
      this.liveAttackAbortController.abort();
      this.liveAttackAbortController = null;
    }

    const startBtn = this.container.querySelector('#btnStartLiveAttack');
    const stopBtn = this.container.querySelector('#btnStopLiveAttack');
    const statusText = this.container.querySelector('#liveAttackStatusText');

    if (startBtn) startBtn.style.display = 'inline-flex';
    if (stopBtn) stopBtn.style.display = 'none';
    if (statusText) {
      statusText.textContent = "Probe stopped.";
      statusText.style.color = "var(--text-muted)";
    }
    toastManager.show('Live attack probe stopped', 'clean');
  }

  update(state) {
    this.lastState = state;

    // 1. Update KPIs
    const elRps = this.container.querySelector('#kpiGlobalRps');
    const elBadge = this.container.querySelector('#chartRpsBadge');
    if (elRps) elRps.textContent = state.metrics.globalRps.toFixed(1);
    if (elBadge) elBadge.textContent = `${state.metrics.globalRps.toFixed(1)} req/s`;

    const elP50 = this.container.querySelector('#kpiP50');
    const elP99 = this.container.querySelector('#kpiP99');
    if (elP50) elP50.textContent = state.metrics.p50LatencyMs.toFixed(2);
    if (elP99) elP99.textContent = state.metrics.p99LatencyMs.toFixed(2);

    const elActive = this.container.querySelector('#kpiActiveIps');
    if (elActive) elActive.textContent = state.metrics.activeIpsCount;

    const elMit = this.container.querySelector('#kpiMitigated');
    const elThr = this.container.querySelector('#kpiThrottled');
    const elBlk = this.container.querySelector('#kpiBlocked');
    if (elMit) elMit.textContent = state.metrics.throttledTotal + state.metrics.blockedTotal;
    if (elThr) elThr.textContent = state.metrics.throttledTotal;
    if (elBlk) elBlk.textContent = state.metrics.blockedTotal;

    // 2. Update Microservice Health Badges
    if (state.services) {
      const pHealth = this.container.querySelector('#proxyHealthStatus');
      const bHealth = this.container.querySelector('#backendHealthStatus');
      const mHealth = this.container.querySelector('#mlHealthStatus');

      if (pHealth && state.services.proxy) {
        const s = state.services.proxy.status;
        pHealth.className = `chip chip-${s === 'healthy' ? 'clean' : (s === 'degraded' ? 'throttled' : 'blocked')}`;
        pHealth.textContent = s.toUpperCase();
      }
      if (bHealth && state.services.backend) {
        const s = state.services.backend.status;
        bHealth.className = `chip chip-${s === 'healthy' ? 'clean' : (s === 'degraded' ? 'throttled' : 'blocked')}`;
        bHealth.textContent = s.toUpperCase();
      }
      if (mHealth && state.services.mlWorker) {
        const s = state.services.mlWorker.status;
        mHealth.className = `chip chip-${s === 'healthy' ? 'clean' : (s === 'degraded' ? 'throttled' : 'blocked')}`;
        mHealth.textContent = s === 'healthy' ? 'ONLINE (1000ms)' : (s === 'degraded' ? 'DEGRADED' : 'OFFLINE');
      }
    }

    // 3. Feed Background & Cursor with real telemetry state
    backgroundEngine.setTrafficState(state.metrics.globalRps, state.metrics.worstTier);
    cursorEngine.setTierColor(state.metrics.worstTier);

    // 4. Trigger tier transition alerts & haptics
    if (state.metrics.worstTier !== this.lastWorstTier) {
      if (state.metrics.worstTier === 'Blocked') {
        toastManager.show('CRITICAL: Malicious client isolated and dropped (HTTP 403)', 'blocked');
        cursorEngine.triggerHaptic([40, 60, 40]);
        this.showAlertBanner('CRITICAL: Active Layer-7 attack blocked at ingress gateway');
      } else if (state.metrics.worstTier === 'Throttled') {
        toastManager.show('WARNING: Traffic burst exceeded token threshold (HTTP 429)', 'throttled');
        cursorEngine.triggerHaptic(25);
        this.showAlertBanner('WARNING: Dynamic quadratic token throttling active');
      }
      this.lastWorstTier = state.metrics.worstTier;
    }

    // 5. Update Charts
    if (this.rpsChart) {
      this.rpsChart.addDataPoint(state.metrics.globalRps, state.metrics.worstTier);
    }
    if (this.latencyChart) {
      this.latencyChart.addDataPoint(state.metrics.p50LatencyMs, state.metrics.p99LatencyMs);
    }
    if (this.donutChart) {
      const counts = { Clean: 0, Monitored: 0, Throttled: 0, Blocked: 0 };
      for (const c of state.clients) {
        counts[c.tier] = (counts[c.tier] || 0) + 1;
      }
      this.donutChart.render(counts);
    }

    // 6. Update Table & Logs
    this.updateTable(state.clients);
    if (!this.isLogPaused) {
      this.updateLogs(state.events);
    }
  }

  showAlertBanner(msg) {
    const banner = this.container.querySelector('#tierAlertBanner');
    const text = this.container.querySelector('#tierAlertText');
    if (banner && text) {
      text.textContent = msg;
      banner.style.display = 'flex';
    }
  }

  updateTable(clients = []) {
    const tbody = this.container.querySelector('#clientsTableBody');
    if (!tbody) return;

    let filtered = clients.filter(c => c.ip.toLowerCase().includes(this.ipSearchTerm));

    // Sort
    filtered.sort((a, b) => {
      let va = a.anomalyScore;
      let vb = b.anomalyScore;
      if (this.sortCol === 'ip') { va = a.ip; vb = b.ip; }
      else if (this.sortCol === 'tier') { va = a.tier; vb = b.tier; }
      else if (this.sortCol === 'tokens') { va = a.currentTokens; vb = b.currentTokens; }
      else if (this.sortCol === 'refill') { va = a.refillRate; vb = b.refillRate; }
      else if (this.sortCol === 'fwd') { va = a.forwarded; vb = b.forwarded; }
      else if (this.sortCol === 'thr') { va = a.throttled; vb = b.throttled; }
      else if (this.sortCol === 'blk') { va = a.blocked; vb = b.blocked; }

      if (va < vb) return this.sortAsc ? -1 : 1;
      if (va > vb) return this.sortAsc ? 1 : -1;
      return 0;
    });

    if (filtered.length === 0) {
      tbody.innerHTML = `<tr><td colspan="9" style="text-align: center; color: var(--text-muted); padding: 24px;">No clients matching search filter.</td></tr>`;
      return;
    }

    tbody.innerHTML = filtered.map(c => {
      let tierChipClass = 'chip-clean';
      if (c.tier === 'Blocked') tierChipClass = 'chip-blocked';
      else if (c.tier === 'Throttled') tierChipClass = 'chip-throttled';
      else if (c.tier === 'Monitored') tierChipClass = 'chip-monitored';

      const tokenPct = c.capacity > 0 ? Math.min(100, Math.round((c.currentTokens / c.capacity) * 100)) : 0;

      return `
        <tr data-ip="${c.ip}" class="clickable" style="cursor: pointer;"
            data-tooltip-title="Client IP: ${this.escape(c.ip)}"
            data-tooltip-desc="Reputation: ${c.tier} | Threat Score: ${c.anomalyScore.toFixed(3)} | Available Tokens: ${c.currentTokens.toFixed(1)} / ${c.capacity.toFixed(0)} | Refill: ${c.refillRate.toFixed(1)}/s"
            data-tooltip-action="Click row to open 8D behavioral radar chart and token ledger"
            data-tooltip-badge="CLIENT SESSION"
            data-tooltip-tier="${c.tier.toLowerCase()}"
            data-cursor="Inspect IP">
          <td style="font-family: var(--font-mono); font-weight: 600; color: var(--primary-cyan);">${this.escape(c.ip)}</td>
          <td><span class="chip ${tierChipClass}">${c.tier}</span></td>
          <td>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span style="font-family: var(--font-mono); font-weight: 700;">${c.anomalyScore.toFixed(3)}</span>
            </div>
          </td>
          <td>
            <div style="display: flex; flex-direction: column; gap: 4px;">
              <span style="font-family: var(--font-mono); font-size: 0.8rem;">${c.currentTokens.toFixed(1)} / ${c.capacity.toFixed(0)}</span>
              <div style="width: 70px; height: 4px; background: var(--bg-surface-elevated); border-radius: 2px; overflow: hidden;">
                <div style="width: ${tokenPct}%; height: 100%; background: var(--primary-cyan);"></div>
              </div>
            </div>
          </td>
          <td style="font-family: var(--font-mono);">${c.refillRate.toFixed(1)}/s</td>
          <td style="color: var(--tier-clean); font-weight: 600;">${c.forwarded}</td>
          <td style="color: var(--tier-throttled); font-weight: 600;">${c.throttled}</td>
          <td style="color: var(--tier-blocked); font-weight: 600;">${c.blocked}</td>
          <td>
            <button class="btn btn-secondary btn-sm inspect-btn" data-ip="${c.ip}"
                    data-tooltip-title="Inspect Client Telemetry"
                    data-tooltip-desc="Opens slide-over detail drawer displaying 8D feature radar and token bucket ledger for ${this.escape(c.ip)}."
                    data-tooltip-action="Click to inspect client ${this.escape(c.ip)}"
                    data-tooltip-badge="ACTION"
                    data-tooltip-tier="${c.tier.toLowerCase()}"
                    data-cursor="Inspect">
              Inspect
            </button>
          </td>
        </tr>
      `;
    }).join('');

    // Attach row inspection handlers
    tbody.querySelectorAll('tr, .inspect-btn').forEach(el => {
      el.addEventListener('click', () => {
        const ip = el.dataset.ip || el.closest('tr')?.dataset.ip;
        if (ip) {
          const client = clients.find(c => c.ip === ip);
          if (client) this.openClientDrawer(client);
        }
      });
    });
  }

  updateLogs(events = []) {
    const body = this.container.querySelector('#terminalLogsBody');
    if (!body || events.length === 0) return;

    body.innerHTML = events.slice(0, 40).map(e => {
      let statusClass = 'log-status-200';
      if (e.status === 429) statusClass = 'log-status-429';
      else if (e.status === 403) statusClass = 'log-status-403';

      return `
        <div class="log-row">
          <span class="log-time">[${this.escape(e.time)}]</span>
          <span class="log-ip">${this.escape(e.ip)}</span>
          <span class="log-method">${this.escape(e.method)}</span>
          <span class="log-path">${this.escape(e.path)}</span>
          <span class="${statusClass}">${e.status}</span>
          <span class="log-latency">(${e.latency.toFixed(2)} ms)</span>
        </div>
      `;
    }).join('');
  }

  openClientDrawer(client) {
    this.selectedClient = client;
    const drawerTitle = this.container.querySelector('#drawerClientIp');
    const drawerBody = this.container.querySelector('#drawerClientBody');

    if (drawerTitle) drawerTitle.textContent = `Client: ${client.ip}`;

    if (drawerBody) {
      drawerBody.innerHTML = `
        <div class="glass-panel" style="padding: 16px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <span style="font-weight: 700;">Reputation Status</span>
            <span class="chip chip-${client.tier.toLowerCase()}">${client.tier}</span>
          </div>
          <div style="display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 0.82rem;">
            <div>Threat Score: <strong style="font-family: var(--font-mono); color: var(--primary-cyan);">${client.anomalyScore.toFixed(4)}</strong></div>
            <div>Velocity: <strong>${client.velocity.toFixed(1)} req/s</strong></div>
            <div>Token Bucket: <strong>${client.currentTokens.toFixed(1)} / ${client.capacity}</strong></div>
            <div>Refill Rate: <strong>${client.refillRate.toFixed(1)} /s</strong></div>
          </div>
        </div>

        <div class="glass-panel" style="padding: 16px;">
          <h4 style="font-size: 0.9rem; margin-bottom: 8px;">8D Behavioral Feature Radar</h4>
          <p style="font-size: 0.75rem; color: var(--text-muted); margin-bottom: 12px;">
            Sliding-window normalized feature vector ($f_0$ to $f_7$)
          </p>
          <div style="width: 100%; height: 240px; display: flex; align-items: center; justify-content: center;">
            <canvas id="drawerRadarCanvas"></canvas>
          </div>
        </div>

        <div class="glass-panel" style="padding: 16px;">
          <h4 style="font-size: 0.9rem; margin-bottom: 8px;">Cumulative Request Ledger</h4>
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem;">
            <span>Forwarded (200 OK):</span>
            <strong style="color: var(--tier-clean); font-family: var(--font-mono);">${client.forwarded}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-top: 6px;">
            <span>Throttled (429):</span>
            <strong style="color: var(--tier-throttled); font-family: var(--font-mono);">${client.throttled}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; font-size: 0.85rem; margin-top: 6px;">
            <span>Blocked (403):</span>
            <strong style="color: var(--tier-blocked); font-family: var(--font-mono);">${client.blocked}</strong>
          </div>
        </div>
      `;

      // Render radar chart
      setTimeout(() => {
        const radar = new RadarChart('drawerRadarCanvas');
        radar.render(client.features || [1.0, 0.5, 0.4, 2.0, 0.0, 0.2, 80.0, 0.9]);
      }, 50);
    }

    DrawerManager.open('clientDetailDrawer');
  }

  exportLogs(format = 'json') {
    if (!this.lastState || !this.lastState.events) return;
    const events = this.lastState.events;

    let content = '';
    let filename = `intellishield-events-${Date.now()}`;
    let mime = 'application/json';

    if (format === 'json') {
      content = JSON.stringify(events, null, 2);
      filename += '.json';
    } else {
      mime = 'text/csv';
      filename += '.csv';
      const headers = ['time', 'ip', 'method', 'path', 'status', 'action', 'latency_ms'];
      const rows = events.map(e => [e.time, e.ip, e.method, e.path, e.status, e.action, e.latency].join(','));
      content = [headers.join(','), ...rows].join('\n');
    }

    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    toastManager.show(`Exported ${events.length} telemetry records to ${format.toUpperCase()}`, 'clean');
  }

  escape(str) {
    if (str == null) return '';
    const div = document.createElement('div');
    div.textContent = String(str);
    return div.innerHTML;
  }
}
