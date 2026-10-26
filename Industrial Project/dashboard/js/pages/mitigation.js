/**
 * IntelliShield Mitigation Engine Page Component (#/mitigation)
 * Adaptive token bucket visualization, interactive quadratic penalty curve,
 * and automatic traffic recovery cooldown replay.
 */

import {
  CONFIG,
  calculateThrottlePenalty,
  getTierFromScore,
  ReputationTier
} from '../model.js';
import { Icons } from '../components/icons.js';
import { themeManager } from '../theme.js';

export class MitigationPage {
  constructor() {
    this.container = null;
    this.currentScore = 0.72;
    this.requestRate = 12.0; // req/s
    this.baseCap = CONFIG.DEFAULT_BASE_CAPACITY;
    this.baseRefill = CONFIG.DEFAULT_BASE_REFILL;

    this.bucketTokens = 20.0;
    this.bucketInterval = null;
    this.cooldownTimer = null;
    this.cooldownActive = false;
  }

  mount(container) {
    this.container = container;
    this.render();
    this.initPenaltyPlot();
    this.attachEvents();
    this.startBucketLoop();
  }

  unmount() {
    if (this.bucketInterval) clearInterval(this.bucketInterval);
    if (this.cooldownTimer) clearInterval(this.cooldownTimer);
  }

  render() {
    this.container.innerHTML = `
      <div class="page-view active">
        <!-- Header -->
        <div class="page-header reveal">
          <div class="page-header-title">
            <h2>Adaptive Token-Bucket Mitigation Engine</h2>
            <p>Dynamic rate limiting modulated by quadratic penalty formulation across four reputation tiers.</p>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary btn-sm" id="btnToggleBaseConfig">
              Config: Base 30/8 (Active)
            </button>
            <button class="btn btn-primary btn-sm" id="btnTriggerCooldown">
              ${Icons.refresh(14)} Replay Cooldown
            </button>
          </div>
        </div>

        <!-- 4-Tier Reference Matrix -->
        <div class="glass-panel reveal delay1" style="padding: 24px; margin-bottom: 32px;">
          <h3 style="font-size: 1.1rem; margin-bottom: 6px;">Dynamic Reputation Tiers & Enforcement Matrix</h3>
          <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 16px;">
            Standard values derived directly from proxy_gateway.py and PROJECT_INFO.md section 7.1
          </p>

          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Tier Name</th>
                  <th>Anomaly Score ($s$)</th>
                  <th>Bucket Capacity ($B$)</th>
                  <th>Refill Rate ($r$)</th>
                  <th>Proxy Enforcement Action</th>
                </tr>
              </thead>
              <tbody>
                <tr data-tooltip-title="Clean Reputation Tier" data-tooltip-desc="Threat score &lt; 0.40. Full 30-token capacity, 8 tokens/sec refill rate. Requests forwarded with zero penalty." data-tooltip-badge="REPUTATION TIER" data-tooltip-tier="clean">
                  <td><span class="chip chip-clean">Clean</span></td>
                  <td style="font-family: var(--font-mono); font-weight: 700;">[0.00, 0.40)</td>
                  <td style="font-family: var(--font-mono);" id="tierCleanCap">30 tokens</td>
                  <td style="font-family: var(--font-mono);" id="tierCleanRefill">8 tokens/sec</td>
                  <td>Fast-forward line-rate; returns HTTP 200 OK (&lt; 0.05 ms token check)</td>
                </tr>
                <tr data-tooltip-title="Monitored Reputation Tier" data-tooltip-desc="Threat score 0.40 - 0.65. Full capacity maintained under continuous sliding-window observation." data-tooltip-badge="REPUTATION TIER" data-tooltip-tier="monitored">
                  <td><span class="chip chip-monitored">Monitored</span></td>
                  <td style="font-family: var(--font-mono); font-weight: 700;">[0.40, 0.65)</td>
                  <td style="font-family: var(--font-mono);" id="tierMonitoredCap">30 tokens</td>
                  <td style="font-family: var(--font-mono);" id="tierMonitoredRefill">8 tokens/sec</td>
                  <td>Forward full speed with active telemetry sliding-window observation</td>
                </tr>
                <tr data-tooltip-title="Throttled Reputation Tier" data-tooltip-desc="Threat score 0.65 - 0.85. Quadratic penalty restricts capacity and refill. Excess requests receive HTTP 429." data-tooltip-badge="REPUTATION TIER" data-tooltip-tier="throttled">
                  <td><span class="chip chip-throttled">Throttled</span></td>
                  <td style="font-family: var(--font-mono); font-weight: 700;">[0.65, 0.85)</td>
                  <td style="font-family: var(--font-mono); color: var(--tier-throttled);">$B_{\text{base}} \times M$ (Restricted)</td>
                  <td style="font-family: var(--font-mono); color: var(--tier-throttled);">$r_{\text{base}} \times M$ (Restricted)</td>
                  <td>Dynamic quadratic throttle; excess calls receive HTTP 429 Too Many Requests</td>
                </tr>
                <tr data-tooltip-title="Blocked Reputation Tier" data-tooltip-desc="Threat score &gt;= 0.85. 0 tokens, 0 refill. Requests dropped at network edge with HTTP 403." data-tooltip-badge="REPUTATION TIER" data-tooltip-tier="blocked">
                  <td><span class="chip chip-blocked">Blocked</span></td>
                  <td style="font-family: var(--font-mono); font-weight: 700;">[0.85, 1.00]</td>
                  <td style="font-family: var(--font-mono); color: var(--tier-blocked);">0 tokens</td>
                  <td style="font-family: var(--font-mono); color: var(--tier-blocked);">0 tokens/sec</td>
                  <td>Immediate connection termination; returns HTTP 403 Forbidden</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Token Bucket Graphic Visualizer + Quadratic Curve Grid -->
        <div style="display: grid; grid-template-columns: 1fr; gap: 24px; margin-bottom: 32px;" class="reveal delay2">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px;">
            <!-- Interactive Draining Bucket -->
            <div class="glass-panel bucket-visualizer-container">
              <div style="width: 100%; display: flex; justify-content: space-between; align-items: center;">
                <h4 style="font-size: 0.95rem;">Token Bucket Visualizer</h4>
                <div id="simBucketTierChip" class="chip chip-throttled">THROTTLED</div>
              </div>

              <!-- Graphic Token Bucket -->
              <div class="token-bucket-graphic">
                <div class="token-fluid" id="tokenFluid"></div>
              </div>

              <!-- Readout Stats -->
              <div style="width: 100%; display: grid; grid-template-columns: repeat(2, 1fr); gap: 10px; font-size: 0.82rem; margin-top: 10px;">
                <div>Tokens: <strong id="bucketTokenReadout" style="font-family: var(--font-mono); color: var(--primary-cyan);">20.0</strong></div>
                <div>Capacity: <strong id="bucketCapReadout" style="font-family: var(--font-mono);">30.0</strong></div>
                <div>Refill Speed: <strong id="bucketRefillReadout" style="font-family: var(--font-mono);">8.0 /s</strong></div>
                <div>Action: <strong id="bucketActionReadout" style="color: var(--tier-clean);">HTTP 200</strong></div>
              </div>

              <!-- Sliders -->
              <div style="width: 100%; margin-top: 14px; display: flex; flex-direction: column; gap: 14px;">
                <div class="form-group" style="margin: 0;"
                     data-tooltip-title="Threat Score (s)"
                     data-tooltip-desc="Continuous Isolation Forest anomaly output from 0.05 to 0.98. Observe how quadratic penalty P(s) cuts bucket capacity."
                     data-tooltip-action="Drag slider to test adaptive rate throttling"
                     data-tooltip-badge="SLIDER">
                  <div class="form-label">
                    <span>Threat Score ($s$)</span>
                    <span id="labelMitScore" style="font-family: var(--font-mono); color: var(--primary-cyan);">0.72</span>
                  </div>
                  <input type="range" id="sliderMitScore" min="0.05" max="0.98" step="0.01" value="0.72">
                </div>

                <div class="form-group" style="margin: 0;"
                     data-tooltip-title="Injected Velocity (R)"
                     data-tooltip-desc="Rate of simulated incoming requests per second draining tokens from the bucket."
                     data-tooltip-action="Drag slider to test token depletion and 429 throttling"
                     data-tooltip-badge="SLIDER">
                  <div class="form-label">
                    <span>Injected Velocity ($R$)</span>
                    <span id="labelMitRate" style="font-family: var(--font-mono); color: var(--primary-cyan);">12.0 req/s</span>
                  </div>
                  <input type="range" id="sliderMitRate" min="1.0" max="30.0" step="1.0" value="12.0">
                </div>
              </div>
            </div>

            <!-- Quadratic Penalty Curve Plot -->
            <div class="glass-panel" style="padding: 24px; display: flex; flex-direction: column;">
              <h4 style="font-size: 0.95rem; margin-bottom: 4px;">Quadratic Penalty Curve $P(s)$ & Multiplier $M(s)$</h4>
              <p style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 16px;">
                $P = \\left(\\frac{s - 0.65}{0.35}\\right)^2, \\quad M = \\max(0.01, 1 - P)$
              </p>

              <div style="width: 100%; height: 220px; position: relative;">
                <canvas id="penaltyCanvas" style="width: 100%; height: 100%; display: block;"></canvas>
              </div>

              <!-- Live Formula Evaluation Box -->
              <div style="background: var(--bg-surface-elevated); border-radius: var(--radius-sm); padding: 14px; margin-top: 16px; font-family: var(--font-mono); font-size: 0.8rem; display: flex; flex-direction: column; gap: 6px;">
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: var(--text-muted);">Penalty Factor ($P$):</span>
                  <strong id="liveFormulaP" style="color: var(--tier-throttled);">0.0400</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: var(--text-muted);">Multiplier ($M$):</span>
                  <strong id="liveFormulaM" style="color: var(--primary-cyan);">0.9600</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: var(--text-muted);">Effective Capacity ($B_{eff}$):</span>
                  <strong id="liveFormulaBeff">28.8 tokens</strong>
                </div>
                <div style="display: flex; justify-content: space-between;">
                  <span style="color: var(--text-muted);">Effective Refill ($r_{eff}$):</span>
                  <strong id="liveFormulaReff">7.68 tokens/s</strong>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Automatic Traffic Recovery Cooldown Section -->
        <div class="glass-panel reveal delay3" style="padding: 24px; margin-bottom: 32px;">
          <h3 style="font-size: 1.1rem; margin-bottom: 6px;">Automatic Traffic Recovery (Sliding Window Cooldown)</h3>
          <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 16px;">
            When an abusive client halts or corrects their request pattern, the rolling 5.0-second sliding window clears malicious vectors. The threat score decays below $\\theta = 0.65$, automatically restoring baseline capacity without manual administrative intervention.
          </p>

          <div style="display: flex; align-items: center; gap: 14px; margin-top: 10px;">
            <div style="flex: 1; height: 8px; background: var(--bg-surface-elevated); border-radius: 4px; overflow: hidden;">
              <div id="cooldownProgressBar" style="width: 100%; height: 100%; background: linear-gradient(90deg, var(--tier-blocked), var(--tier-throttled), var(--tier-clean)); transition: width 0.3s ease;"></div>
            </div>
            <span id="cooldownReadout" style="font-family: var(--font-mono); font-size: 0.85rem; font-weight: 700; color: var(--primary-cyan);">
              Score: 0.72
            </span>
          </div>
        </div>
      </div>
    `;
  }

  initPenaltyPlot() {
    const canvas = document.getElementById('penaltyCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const rect = canvas.getBoundingClientRect();
    const w = canvas.width = (rect.width || 400) * dpr;
    const h = canvas.height = (rect.height || 220) * dpr;

    const padL = 36 * dpr;
    const padR = 16 * dpr;
    const padT = 16 * dpr;
    const padB = 24 * dpr;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    const colors = themeManager.getCanvasColors();

    const renderPlot = () => {
      ctx.clearRect(0, 0, w, h);

      // Grid
      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 1 * dpr;
      ctx.font = `${8.5 * dpr}px sans-serif`;
      ctx.fillStyle = colors.isLight ? '#64748b' : '#94a3b8';
      ctx.textAlign = 'right';

      for (let i = 0; i <= 4; i++) {
        const y = padT + (plotH / 4) * i;
        const val = (1.0 - (1.0 / 4) * i).toFixed(2);
        ctx.beginPath();
        ctx.moveTo(padL, y);
        ctx.lineTo(w - padR, y);
        ctx.stroke();
        ctx.fillText(val, padL - 4 * dpr, y + 3 * dpr);
      }

      // X-Axis labels (s = 0.65 to 1.0)
      ctx.textAlign = 'center';
      for (let s = 0.65; s <= 1.00; s += 0.05) {
        const x = padL + ((s - 0.65) / 0.35) * plotW;
        ctx.fillText(s.toFixed(2), x, h - 8 * dpr);
      }

      // Plot Penalty Curve P(s) (Amber)
      ctx.beginPath();
      for (let s = 0.65; s <= 1.00; s += 0.01) {
        const p = Math.pow((s - 0.65) / 0.35, 2);
        const x = padL + ((s - 0.65) / 0.35) * plotW;
        const y = padT + plotH - (p * plotH);
        if (s === 0.65) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#f59e0b';
      ctx.lineWidth = 2 * dpr;
      ctx.stroke();

      // Plot Multiplier Curve M(s) (Cyan)
      ctx.beginPath();
      for (let s = 0.65; s <= 1.00; s += 0.01) {
        const p = Math.pow((s - 0.65) / 0.35, 2);
        const m = Math.max(0.01, 1 - Math.min(1, p));
        const x = padL + ((s - 0.65) / 0.35) * plotW;
        const y = padT + plotH - (m * plotH);
        if (s === 0.65) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.strokeStyle = '#00f0ff';
      ctx.lineWidth = 2 * dpr;
      ctx.stroke();

      // Draw current score scrubber line
      if (this.currentScore >= 0.65) {
        const scrubX = padL + ((this.currentScore - 0.65) / 0.35) * plotW;
        ctx.beginPath();
        ctx.moveTo(scrubX, padT);
        ctx.lineTo(scrubX, padT + plotH);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.7)';
        ctx.lineWidth = 1.5 * dpr;
        ctx.setLineDash([4 * dpr, 4 * dpr]);
        ctx.stroke();
        ctx.setLineDash([]);
      }
    };

    renderPlot();
    this.renderPenaltyPlot = renderPlot;
  }

  attachEvents() {
    // Score slider
    this.container.querySelector('#sliderMitScore')?.addEventListener('input', (e) => {
      this.currentScore = parseFloat(e.target.value);
      this.container.querySelector('#labelMitScore').textContent = this.currentScore.toFixed(2);
      this.updateFormulaEvaluations();
      if (this.renderPenaltyPlot) this.renderPenaltyPlot();
    });

    // Rate slider
    this.container.querySelector('#sliderMitRate')?.addEventListener('input', (e) => {
      this.requestRate = parseFloat(e.target.value);
      this.container.querySelector('#labelMitRate').textContent = `${this.requestRate.toFixed(1)} req/s`;
    });

    // Toggle 30/8 vs 100/50 configuration
    this.container.querySelector('#btnToggleBaseConfig')?.addEventListener('click', (e) => {
      if (this.baseCap === 30) {
        this.baseCap = 100;
        this.baseRefill = 50;
        e.currentTarget.textContent = "Config: Base 100/50 (Alternate)";
      } else {
        this.baseCap = 30;
        this.baseRefill = 8;
        e.currentTarget.textContent = "Config: Base 30/8 (Active)";
      }
      this.updateFormulaEvaluations();
    });

    // Cooldown replay
    this.container.querySelector('#btnTriggerCooldown')?.addEventListener('click', () => {
      this.triggerCooldownReplay();
    });
  }

  startBucketLoop() {
    this.updateFormulaEvaluations();

    // Simulation loop stepping token bucket every 150 ms
    const dt = 0.15;
    this.bucketInterval = setInterval(() => {
      const mit = calculateThrottlePenalty(this.currentScore, this.baseCap, this.baseRefill);
      const isBlocked = this.currentScore >= 0.85;

      // Refill
      if (!isBlocked) {
        this.bucketTokens = Math.min(mit.effectiveCapacity, this.bucketTokens + (dt * mit.effectiveRefillRate));
      } else {
        this.bucketTokens = 0;
      }

      // Consume according to requestRate
      const reqsInStep = (this.requestRate * dt);
      let action = "HTTP 200";
      let actionColor = "var(--tier-clean)";

      if (isBlocked) {
        action = "HTTP 403 (Drop)";
        actionColor = "var(--tier-blocked)";
      } else if (this.bucketTokens >= reqsInStep) {
        this.bucketTokens -= reqsInStep;
        action = "HTTP 200 (OK)";
        actionColor = "var(--tier-clean)";
      } else {
        action = "HTTP 429 (Throttled)";
        actionColor = "var(--tier-throttled)";
      }

      // Update UI elements
      const fluid = this.container.querySelector('#tokenFluid');
      const tokenReadout = this.container.querySelector('#bucketTokenReadout');
      const actionReadout = this.container.querySelector('#bucketActionReadout');

      if (fluid) {
        const pct = mit.effectiveCapacity > 0 ? (this.bucketTokens / mit.effectiveCapacity) * 100 : 0;
        fluid.style.height = `${Math.max(0, Math.min(100, pct))}%`;
      }
      if (tokenReadout) tokenReadout.textContent = this.bucketTokens.toFixed(1);
      if (actionReadout) {
        actionReadout.textContent = action;
        actionReadout.style.color = actionColor;
      }
    }, 150);
  }

  updateFormulaEvaluations() {
    const mit = calculateThrottlePenalty(this.currentScore, this.baseCap, this.baseRefill);
    const tier = getTierFromScore(this.currentScore);

    const elP = this.container.querySelector('#liveFormulaP');
    const elM = this.container.querySelector('#liveFormulaM');
    const elBeff = this.container.querySelector('#liveFormulaBeff');
    const elReff = this.container.querySelector('#liveFormulaReff');
    const elCap = this.container.querySelector('#bucketCapReadout');
    const elRefill = this.container.querySelector('#bucketRefillReadout');
    const elChip = this.container.querySelector('#simBucketTierChip');

    if (elP) elP.textContent = mit.penalty.toFixed(4);
    if (elM) elM.textContent = mit.multiplier.toFixed(4);
    if (elBeff) elBeff.textContent = `${mit.effectiveCapacity} tokens`;
    if (elReff) elReff.textContent = `${mit.effectiveRefillRate} tokens/s`;
    if (elCap) elCap.textContent = mit.effectiveCapacity;
    if (elRefill) elRefill.textContent = `${mit.effectiveRefillRate} /s`;

    if (elChip) {
      elChip.textContent = tier.toUpperCase();
      elChip.className = `chip chip-${tier.toLowerCase()}`;
    }
  }

  triggerCooldownReplay() {
    if (this.cooldownActive) return;
    this.cooldownActive = true;
    this.currentScore = 0.94; // Start at attack spike

    const slider = this.container.querySelector('#sliderMitScore');
    const label = this.container.querySelector('#labelMitScore');
    const readout = this.container.querySelector('#cooldownReadout');

    if (this.cooldownTimer) clearInterval(this.cooldownTimer);

    this.cooldownTimer = setInterval(() => {
      this.currentScore = Math.max(0.10, this.currentScore - 0.05);

      if (slider) slider.value = this.currentScore;
      if (label) label.textContent = this.currentScore.toFixed(2);
      if (readout) readout.textContent = `Score: ${this.currentScore.toFixed(2)}`;

      this.updateFormulaEvaluations();
      if (this.renderPenaltyPlot) this.renderPenaltyPlot();

      if (this.currentScore <= 0.12) {
        clearInterval(this.cooldownTimer);
        this.cooldownActive = false;
        if (readout) readout.textContent = `Score: 0.10 (Restored Clean Tier)`;
      }
    }, 400);
  }
}
