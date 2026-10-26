/**
 * IntelliShield Attack Simulator Component (#/simulator)
 * Safe client-side attack simulation + rate-capped same-origin live attack injector.
 * Features automated 4-phase Review 3 demo runner with technical narrative captions.
 */

import { dataManager } from '../datasource.js';
import { Icons } from '../components/icons.js';
import { toastManager } from '../components/modal.js';

export class SimulatorPage {
  constructor() {
    this.container = null;
    this.demoPhase = 0;
    this.demoTimer = null;
    this.isDemoRunning = false;
    this.isLiveAttackActive = false;
    this.liveAttackAbortController = null;
  }

  mount(container) {
    this.container = container;
    this.render();
    this.attachEvents();
  }

  unmount() {
    if (this.demoTimer) clearTimeout(this.demoTimer);
    if (this.liveAttackAbortController) {
      this.liveAttackAbortController.abort();
      this.liveAttackAbortController = null;
    }
  }

  render() {
    this.container.innerHTML = `
      <div class="page-view active">
        <!-- Header -->
        <div class="page-header reveal">
          <div class="page-header-title">
            <h2>Multi-Vector Layer-7 Attack Simulator</h2>
            <p>Empirical security validation suite for volumetric DDoS, low-and-slow scrapers, credential stuffing, and flash crowd resilience.</p>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary btn-sm" id="btnRunFullDemo"
                    data-tooltip-title="Run Full Review 3 Demo Sequence"
                    data-tooltip-desc="Executes automated 4-phase sequence: Normal Traffic (Phase 1) -> Low-and-Slow Bot (Phase 2) -> Volumetric Flood (Phase 3) -> Flash Crowd Recovery (Phase 4)."
                    data-tooltip-action="Click to auto-play viva presentation sequence"
                    data-tooltip-badge="AUTOMATED DEMO">
              ${Icons.play(14)} Run Full Review 3 Demo
            </button>
            <button class="btn btn-secondary btn-sm" id="btnStopSim"
                    data-tooltip-title="Emergency Stop / Cut-Off"
                    data-tooltip-desc="Immediately terminates running scenario, cancels live ingress probes within 100ms, and resets telemetry timers."
                    data-tooltip-action="Click to abort running scenario immediately"
                    data-tooltip-badge="EMERGENCY STOP"
                    data-tooltip-tier="blocked">
              ${Icons.pause(14)} Stop All
            </button>
          </div>
        </div>

        <!-- Full Review 3 Automated Walkthrough Panel -->
        <div id="demoWalkthroughPanel" class="glass-panel reveal delay1" style="display: none; padding: 24px; margin-bottom: 32px; border-left: 4px solid var(--primary-cyan); box-shadow: var(--shadow-glow);">
          <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 12px;">
            <div style="display: flex; align-items: center; gap: 10px;">
              <span class="chip chip-clean" id="demoPhasePill">PHASE 1 OF 4</span>
              <h3 style="font-size: 1.15rem; margin: 0;" id="demoPhaseTitle">Normal Benign Traffic</h3>
            </div>
            <div style="font-family: var(--font-mono); font-size: 0.85rem; color: var(--primary-cyan);" id="demoPhaseElapsed">00:00</div>
          </div>
          <p id="demoPhaseDesc" style="font-size: 0.9rem; color: var(--text-primary); line-height: 1.6; margin-bottom: 16px;">
            Simulating legitimate browsing traffic: clients send standard GET requests to /api/v1/users.
          </p>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; font-family: var(--font-mono); font-size: 0.82rem; background: var(--bg-surface-elevated); padding: 12px; border-radius: var(--radius-sm);">
            <div>Detection Latency: <strong id="demoDetectLatency" style="color: var(--primary-cyan);">85 ms</strong></div>
            <div>Threat Score: <strong id="demoThreatScore">0.12 (Clean)</strong></div>
            <div>Enforcement: <strong id="demoAction" style="color: var(--tier-clean);">HTTP 200 OK</strong></div>
            <div>Backend Saturation: <strong style="color: var(--tier-clean);">0.0% (Protected)</strong></div>
          </div>
        </div>

        <!-- Scenario Cards Grid -->
        <div class="sim-scenarios-grid reveal delay2">
          <!-- Scenario 1: Benign Baseline -->
          <div class="glass-panel sim-card">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span class="chip chip-clean">Baseline</span>
                <span style="font-size: 0.72rem; color: var(--text-muted); font-family: var(--font-mono);">5 req/s</span>
              </div>
              <h4 style="font-size: 1.05rem; margin-bottom: 6px;">Legitimate User Browsing</h4>
              <p style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.5;">
                Normal user session with natural inter-arrival jitter, balanced GET payloads, and multi-endpoint navigation.
              </p>
            </div>
            <div style="font-size: 0.78rem; font-family: var(--font-mono); color: var(--text-muted);">
              Expected: Clean Tier, Score < 0.20, Sub-ms Forwarding
            </div>
            <button class="btn btn-secondary sim-trigger-btn" data-scenario="benign">
              Launch Benign Traffic
            </button>
          </div>

          <!-- Scenario 2: Volumetric Flood -->
          <div class="glass-panel sim-card">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span class="chip chip-throttled">Layer-7 Flood</span>
                <span style="font-size: 0.72rem; color: var(--text-muted); font-family: var(--font-mono);">80 req/s</span>
              </div>
              <h4 style="font-size: 1.05rem; margin-bottom: 6px;">Volumetric HTTP Flood</h4>
              <p style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.5;">
                Automated flood script blasting /api/v1/users to exhaust socket threads and saturate backend application pools.
              </p>
            </div>
            <div style="font-size: 0.78rem; font-family: var(--font-mono); color: var(--text-muted);">
              Expected: Throttled in 85 ms -> 429 -> Blocked 403
            </div>
            <button class="btn btn-secondary sim-trigger-btn" data-scenario="ddos">
              Launch Volumetric Flood
            </button>
          </div>

          <!-- Scenario 3: Low-and-Slow Scraper -->
          <div class="glass-panel sim-card">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span class="chip chip-monitored">Stealth Bot</span>
                <span style="font-size: 0.72rem; color: var(--text-muted); font-family: var(--font-mono);">4 req/s</span>
              </div>
              <h4 style="font-size: 1.05rem; margin-bottom: 6px;">Low-and-Slow Scraper</h4>
              <p style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.5;">
                Programmatic scraper maintaining low velocity below fixed RPM limits but exhibiting rigid timer variance ($\sigma^2 \approx 0$).
              </p>
            </div>
            <div style="font-size: 0.78rem; font-family: var(--font-mono); color: var(--text-muted);">
              Expected: Isolated via timing variance -> Throttled
            </div>
            <button class="btn btn-secondary sim-trigger-btn" data-scenario="scrape">
              Launch Low-and-Slow Bot
            </button>
          </div>

          <!-- Scenario 4: Credential Stuffing -->
          <div class="glass-panel sim-card">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span class="chip chip-blocked">Auth Burst</span>
                <span style="font-size: 0.72rem; color: var(--text-muted); font-family: var(--font-mono);">POST Bursts</span>
              </div>
              <h4 style="font-size: 1.05rem; margin-bottom: 6px;">Credential Stuffing Campaign</h4>
              <p style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.5;">
                Distributed bot probe injecting credential lists at /api/v1/auth/login, producing high HTTP 401 error ratios.
              </p>
            </div>
            <div style="font-size: 0.78rem; font-family: var(--font-mono); color: var(--text-muted);">
              Expected: Booster 4 triggers -> Immediate 403 Drop
            </div>
            <button class="btn btn-secondary sim-trigger-btn" data-scenario="credential">
              Launch Credential Stuffing
            </button>
          </div>

          <!-- Scenario 5: Flash Crowd -->
          <div class="glass-panel sim-card">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span class="chip chip-clean">Flash Crowd</span>
                <span style="font-size: 0.72rem; color: var(--text-muted); font-family: var(--font-mono);">50 req/s Surge</span>
              </div>
              <h4 style="font-size: 1.05rem; margin-bottom: 6px;">Benign Flash Crowd (False-Positive Defense)</h4>
              <p style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.5;">
                Surge of 15 human users browsing simultaneously during a product drop. High velocity but high entropy and natural timing jitter.
              </p>
            </div>
            <div style="font-size: 0.78rem; font-family: var(--font-mono); color: var(--text-muted);">
              Expected: Zero false drops (100% Passed, 200 OK)
            </div>
            <button class="btn btn-secondary sim-trigger-btn" data-scenario="flash">
              Launch Flash Crowd
            </button>
          </div>

          <!-- Scenario 6: Cooldown & Recovery -->
          <div class="glass-panel sim-card">
            <div>
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span class="chip chip-clean">Auto Reset</span>
                <span style="font-size: 0.72rem; color: var(--text-muted); font-family: var(--font-mono);">Window Drain</span>
              </div>
              <h4 style="font-size: 1.05rem; margin-bottom: 6px;">Traffic Cooldown & Reset</h4>
              <p style="font-size: 0.82rem; color: var(--text-secondary); line-height: 1.5;">
                Attack traffic terminates. Rolling 5.0-second sliding-window ring buffer flushes stale events, resetting token bucket to Clean parameters.
              </p>
            </div>
            <div style="font-size: 0.78rem; font-family: var(--font-mono); color: var(--text-muted);">
              Expected: Score decays below 0.40 -> Capacity restored
            </div>
            <button class="btn btn-secondary sim-trigger-btn" data-scenario="cooldown">
              Trigger Cooldown
            </button>
          </div>
        </div>

        <!-- Live Ingress Attack Generator (Same-Origin Only) -->
        <div class="glass-panel reveal delay3" style="padding: 24px; margin-bottom: 32px; border: 1px dashed var(--tier-blocked-border);">
          <div style="display: flex; align-items: center; gap: 10px; margin-bottom: 12px;">
            <span style="color: var(--tier-blocked);">${Icons.zap(20)}</span>
            <h3 style="font-size: 1.05rem; margin: 0;">Live Ingress Attack Mode (Same-Origin Rate Capped)</h3>
          </div>
          <p style="font-size: 0.82rem; color: var(--text-muted); line-height: 1.5; margin-bottom: 16px;">
            Warning: Executes real HTTP fetch() calls directly against this origin's reverse proxy entrypoint (/api/v1/users). Target is strictly hard-coded to same origin with a safety ceiling of 20 requests/second.
          </p>
          <div style="display: flex; gap: 12px; align-items: center;">
            <button class="btn btn-danger" id="btnStartLiveAttack"
                    data-tooltip-title="Execute Live Ingress Probe"
                    data-tooltip-desc="Sends real HTTP fetch() calls directly to /api/v1/users on localhost:8080 to test proxy mitigation live."
                    data-tooltip-action="Click to start live HTTP traffic stream"
                    data-tooltip-badge="LIVE PROBE">
              Execute Live Ingress Probe
            </button>
            <button class="btn btn-secondary" id="btnStopLiveAttack" style="display: none;"
                    data-tooltip-title="Stop Live Probe"
                    data-tooltip-desc="Aborts ongoing live HTTP fetch() requests immediately via AbortController."
                    data-tooltip-action="Click to abort live probe stream"
                    data-tooltip-badge="LIVE PROBE">
              STOP PROBE
            </button>
            <span id="liveAttackStatusText" style="font-size: 0.82rem; font-family: var(--font-mono); color: var(--text-muted);">
              Idle (Ready for live probe)
            </span>
          </div>
        </div>
      </div>
    `;
  }

  attachEvents() {
    // Individual scenario triggers
    this.container.querySelectorAll('.sim-trigger-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const scenario = btn.dataset.scenario;
        dataManager.triggerScenario(scenario);
        toastManager.show(`Triggered simulator scenario: ${scenario.toUpperCase()}`, 'monitored');
      });
    });

    // Run Full Review 3 Demo
    this.container.querySelector('#btnRunFullDemo')?.addEventListener('click', () => {
      this.runFullReview3Demo();
    });

    // Stop button
    this.container.querySelector('#btnStopSim')?.addEventListener('click', () => {
      if (this.demoTimer) clearTimeout(this.demoTimer);
      if (this.liveAttackAbortController) {
        this.liveAttackAbortController.abort();
        this.liveAttackAbortController = null;
      }
      this.isDemoRunning = false;
      this.isLiveAttackActive = false;
      dataManager.triggerScenario('cooldown');
      const panel = this.container.querySelector('#demoWalkthroughPanel');
      if (panel) panel.style.display = 'none';
      toastManager.show('All attack simulations stopped', 'clean');
    });

    // Live Ingress Probe
    this.container.querySelector('#btnStartLiveAttack')?.addEventListener('click', () => {
      this.startLiveAttackProbe();
    });

    this.container.querySelector('#btnStopLiveAttack')?.addEventListener('click', () => {
      this.stopLiveAttackProbe();
    });
  }

  runFullReview3Demo() {
    const panel = this.container.querySelector('#demoWalkthroughPanel');
    if (!panel) return;
    panel.style.display = 'block';
    this.isDemoRunning = true;

    const phases = [
      {
        num: 1,
        title: "Phase 1: Normal Benign Traffic Baseline",
        desc: "Simulating legitimate user browsing: standard GET requests to /api/v1/users at 5 req/s. Fast-path routing delivers 0.82 ms forwarding latency with anomaly score < 0.20.",
        scenario: "benign",
        detectTime: "N/A (Benign)",
        threatScore: "0.12 (Clean Tier)",
        action: "HTTP 200 OK (Full Speed)",
        durationMs: 4000
      },
      {
        num: 2,
        title: "Phase 2: Layer-7 Volumetric HTTP Flood",
        desc: "Automated bot fires aggressive flood burst (80 req/s). Within 85 ms, sliding-window velocity flags attack, transitioning client into Throttled tier with HTTP 429 Too Many Requests.",
        scenario: "ddos",
        detectTime: "85 ms",
        threatScore: "0.78 (Throttled)",
        action: "HTTP 429 (Dynamic Penalty)",
        durationMs: 4500
      },
      {
        num: 3,
        title: "Phase 3: Automated Credential Stuffing Campaign",
        desc: "Attacker targets /api/v1/auth/login with randomized credentials. Error storm ratio (f4) spikes, activating deterministic Booster 4 to drive threat score to 0.94 (Immediate 403 Forbidden).",
        scenario: "credential",
        detectTime: "92 ms",
        threatScore: "0.94 (Blocked Tier)",
        action: "HTTP 403 Forbidden (Dropped)",
        durationMs: 4500
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
}
