/**
 * IntelliShield Unified Machine Learning & Adaptive Mitigation Lab (#/ml)
 * Seamlessly integrates:
 * 1. 8-Dimensional behavioral feature vector extraction ($f_0$ to $f_7$)
 * 2. Unsupervised Isolation Forest anomaly inference & decision scoring
 * 3. 2D recursive tree space partition visualizer
 * 4. Dynamic adaptive quadratic token-bucket rate limiter ($C(S), r(S)$)
 * 5. Animated token bucket reservoir & live cooldown replay
 */

import {
  CONFIG,
  extract8DFeatures,
  normalizeRawDecisionScore,
  applySafetyBoosters,
  getTierFromScore,
  calculateThrottlePenalty,
  ReputationTier
} from '../model.js';
import { Icons } from '../components/icons.js';
import { toastManager } from '../components/modal.js';
import { themeManager } from '../theme.js';

export class MlMitigationPage {
  constructor() {
    this.container = null;

    // 8D Feature Vector state ($f_0$ to $f_7$)
    this.features = {
      f0_velocity: 1.5,
      f1_inter_arrival_mean: 0.65,
      f2_inter_arrival_variance: 0.45,
      f3_shannon_entropy: 2.4,
      f4_error_ratio: 0.0,
      f5_post_ratio: 0.1,
      f6_payload_variance: 85.0,
      f7_ua_variance: 0.95,
      samples: 10
    };

    // ML Inference & Mitigation State
    this.currentScore = 0.15;
    this.currentTier = ReputationTier.CLEAN;
    this.baseCap = CONFIG.DEFAULT_BASE_CAPACITY;
    this.baseRefill = CONFIG.DEFAULT_BASE_REFILL;
    this.effectiveCap = 100;
    this.effectiveRefill = 50;
    this.bucketTokens = 100;
    this.requestRate = 1.5;

    // Intervals & animation
    this.ifAnimTimer = null;
    this.bucketInterval = null;
    this.cooldownTimer = null;
    this.cooldownActive = false;

    // 2D tree partition data
    this.ifPoints = [];
    this.ifSplits = [];
    this.ifOutlier = null;
  }

  mount(container) {
    this.container = container;
    this.render();
    this.initIfAnimation();
    this.initPenaltyPlot();
    this.attachEvents();
    this.calculateAndRenderScore();
    this.startBucketLoop();
  }

  unmount() {
    if (this.ifAnimTimer) clearInterval(this.ifAnimTimer);
    if (this.bucketInterval) clearInterval(this.bucketInterval);
    if (this.cooldownTimer) clearInterval(this.cooldownTimer);
  }

  render() {
    this.container.innerHTML = `
      <div class="page-view active">
        <!-- Header -->
        <div class="page-header reveal">
          <div class="page-header-title">
            <h2>Machine Learning Threat Scoring & Dynamic Mitigation Lab</h2>
            <p>Unified pipeline: 8D behavioral telemetry &rarr; Unsupervised Isolation Forest &rarr; Dynamic quadratic token-bucket enforcement.</p>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary btn-sm preset-btn" data-preset="benign"
                    data-tooltip-title="Preset: Benign Human"
                    data-tooltip-desc="Moderate velocity (1.5 req/s), natural arrival variance, high entropy, zero errors. Clean tier."
                    data-tooltip-action="Click to load benign user vector">Benign Human</button>
            <button class="btn btn-secondary btn-sm preset-btn" data-preset="flash"
                    data-tooltip-title="Preset: Flash Crowd"
                    data-tooltip-desc="Legitimate traffic surge: high velocity (14 req/s), natural arrival variance, safety booster prevents false drops."
                    data-tooltip-action="Click to load flash crowd vector">Flash Crowd</button>
            <button class="btn btn-secondary btn-sm preset-btn" data-preset="flood"
                    data-tooltip-title="Preset: Volumetric Flood (DDoS)"
                    data-tooltip-desc="High velocity flood (35 req/s) with near-zero inter-arrival jitter. Triggers immediate quadratic throttling."
                    data-tooltip-action="Click to load flood attack vector">Volumetric Flood</button>
            <button class="btn btn-secondary btn-sm preset-btn" data-preset="scraper"
                    data-tooltip-title="Preset: Stealth Scraper"
                    data-tooltip-desc="Automated crawler: robotic zero-variance intervals (f2=0.002) and focused endpoint targeting."
                    data-tooltip-action="Click to load scraper bot vector">Stealth Scraper</button>
            <button class="btn btn-secondary btn-sm preset-btn" data-preset="credential"
                    data-tooltip-title="Preset: Credential Stuffing"
                    data-tooltip-desc="Authentication brute-force: 100% POST requests to /api/v1/auth/login, 95% 4xx error status ratio."
                    data-tooltip-action="Click to load credential stuffing vector">Credential Stuffing</button>
          </div>
        </div>

        <!-- Section 1: 8D Feature Vector Sliders & Live Isolation Forest Scoring -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 24px; margin-bottom: 32px;" class="reveal delay1">
          <!-- 8D Behavioral Sliders -->
          <div class="glass-panel" style="padding: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <h3 style="font-size: 1.05rem;">8D Behavioral Telemetry Vector</h3>
              <span class="chip chip-clean">5.0s Rolling Window</span>
            </div>
            <p style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 18px;">
              Real-time multi-dimensional telemetry metrics extracted from client HTTP ingress.
            </p>

            <!-- f0 -->
            <div class="form-group" style="margin-bottom: 12px;">
              <div class="form-label" style="display: flex; justify-content: space-between; font-size: 0.82rem;">
                <span>f0: Request Velocity (req/s)</span>
                <span id="val_f0" style="font-family: var(--font-mono); color: var(--primary-cyan); font-weight: 700;">1.5 req/s</span>
              </div>
              <input type="range" class="feature-slider" data-feat="f0_velocity" min="0.2" max="40.0" step="0.2" value="1.5" style="width: 100%;">
            </div>

            <!-- f1 -->
            <div class="form-group" style="margin-bottom: 12px;">
              <div class="form-label" style="display: flex; justify-content: space-between; font-size: 0.82rem;">
                <span>f1: Inter-Arrival Mean (s)</span>
                <span id="val_f1" style="font-family: var(--font-mono); color: var(--primary-cyan); font-weight: 700;">0.65 s</span>
              </div>
              <input type="range" class="feature-slider" data-feat="f1_inter_arrival_mean" min="0.01" max="2.0" step="0.02" value="0.65" style="width: 100%;">
            </div>

            <!-- f2 -->
            <div class="form-group" style="margin-bottom: 12px;">
              <div class="form-label" style="display: flex; justify-content: space-between; font-size: 0.82rem;">
                <span>f2: Inter-Arrival Variance (&sigma;<sup>2</sup>)</span>
                <span id="val_f2" style="font-family: var(--font-mono); color: var(--primary-cyan); font-weight: 700;">0.45</span>
              </div>
              <input type="range" class="feature-slider" data-feat="f2_inter_arrival_variance" min="0.001" max="1.5" step="0.01" value="0.45" style="width: 100%;">
            </div>

            <!-- f3 -->
            <div class="form-group" style="margin-bottom: 12px;">
              <div class="form-label" style="display: flex; justify-content: space-between; font-size: 0.82rem;">
                <span>f3: Shannon URI Entropy</span>
                <span id="val_f3" style="font-family: var(--font-mono); color: var(--primary-cyan); font-weight: 700;">2.40</span>
              </div>
              <input type="range" class="feature-slider" data-feat="f3_shannon_entropy" min="0.0" max="4.0" step="0.1" value="2.4" style="width: 100%;">
            </div>

            <!-- f4 -->
            <div class="form-group" style="margin-bottom: 12px;">
              <div class="form-label" style="display: flex; justify-content: space-between; font-size: 0.82rem;">
                <span>f4: HTTP Error Ratio (4xx/5xx)</span>
                <span id="val_f4" style="font-family: var(--font-mono); color: var(--primary-cyan); font-weight: 700;">0.0%</span>
              </div>
              <input type="range" class="feature-slider" data-feat="f4_error_ratio" min="0.0" max="1.0" step="0.05" value="0.0" style="width: 100%;">
            </div>

            <!-- f5 -->
            <div class="form-group" style="margin-bottom: 12px;">
              <div class="form-label" style="display: flex; justify-content: space-between; font-size: 0.82rem;">
                <span>f5: POST Request Ratio</span>
                <span id="val_f5" style="font-family: var(--font-mono); color: var(--primary-cyan); font-weight: 700;">10.0%</span>
              </div>
              <input type="range" class="feature-slider" data-feat="f5_post_ratio" min="0.0" max="1.0" step="0.05" value="0.1" style="width: 100%;">
            </div>

            <!-- f6 -->
            <div class="form-group" style="margin-bottom: 12px;">
              <div class="form-label" style="display: flex; justify-content: space-between; font-size: 0.82rem;">
                <span>f6: Content-Length Variance</span>
                <span id="val_f6" style="font-family: var(--font-mono); color: var(--primary-cyan); font-weight: 700;">85 B</span>
              </div>
              <input type="range" class="feature-slider" data-feat="f6_payload_variance" min="0" max="500" step="10" value="85" style="width: 100%;">
            </div>

            <!-- f7 -->
            <div class="form-group">
              <div class="form-label" style="display: flex; justify-content: space-between; font-size: 0.82rem;">
                <span>f7: User-Agent Novelty / Jitter</span>
                <span id="val_f7" style="font-family: var(--font-mono); color: var(--primary-cyan); font-weight: 700;">0.95</span>
              </div>
              <input type="range" class="feature-slider" data-feat="f7_ua_variance" min="0.0" max="1.0" step="0.05" value="0.95" style="width: 100%;">
            </div>
          </div>

          <!-- Live Model Inference & 2D Isolation Tree Visualizer -->
          <div class="glass-panel" style="padding: 24px; display: flex; flex-direction: column;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <h3 style="font-size: 1.05rem;">Isolation Forest Inference</h3>
              <span id="outTierChip" class="chip chip-clean">CLEAN TIER</span>
            </div>

            <!-- Continuous Threat Score Gauge -->
            <div style="text-align: center; padding: 18px 0; background: var(--bg-surface-elevated); border-radius: var(--radius-sm); margin-bottom: 20px;">
              <div style="font-size: 0.78rem; text-transform: uppercase; color: var(--text-muted); font-weight: 700; margin-bottom: 4px;">
                Continuous Threat Score S &in; [0.0, 1.0]
              </div>
              <div style="font-size: 3.2rem; font-family: var(--font-heading); font-weight: 800; line-height: 1;" id="outScoreVal" style="color: var(--tier-clean);">
                0.15
              </div>
              <div style="font-size: 0.78rem; font-family: var(--font-mono); color: var(--text-muted); margin-top: 6px;">
                Raw Anomaly: <span id="outRawVal">-0.12</span> | Path: <span id="outPathVal">11.4 cuts</span>
              </div>
            </div>

            <!-- 2D Isolation Forest Space Partition Animation -->
            <div style="flex: 1; display: flex; flex-direction: column;">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
                <span style="font-size: 0.85rem; font-weight: 700;">Recursive Tree Isolation Space</span>
                <button class="btn btn-ghost btn-sm" id="btnReplayTree" style="font-size: 0.75rem;">Re-partition Tree</button>
              </div>
              <div style="position: relative; width: 100%; height: 210px; background: rgba(0, 0, 0, 0.25); border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); overflow: hidden;">
                <canvas id="ifTreeCanvas" style="width: 100%; height: 100%; display: block;"></canvas>
              </div>
              <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 8px; line-height: 1.4;">
                Anomalies require drastically fewer random binary cuts (&lt; 4 splits) to isolate than dense clusters of nominal human traffic.
              </p>
            </div>
          </div>
        </div>

        <!-- Section 2: Dynamic Quadratic Token Bucket Mitigation Engine -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(340px, 1fr)); gap: 24px; margin-bottom: 32px;" class="reveal delay2">
          <!-- Token Bucket Water Tank Visualizer -->
          <div class="glass-panel" style="padding: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <h3 style="font-size: 1.05rem;">Live Token Reservoir</h3>
              <span id="bucketStatusChip" class="chip chip-clean">TOKEN PASSTHROUGH</span>
            </div>

            <div class="bucket-visualizer-container">
              <div class="token-bucket-graphic" id="bucketGraphic">
                <div class="token-fluid" id="bucketFluid" style="height: 100%;"></div>
              </div>
              <div style="text-align: center;">
                <div style="font-family: var(--font-heading); font-size: 1.8rem; font-weight: 800; color: var(--primary-cyan);" id="bucketCountReadout">
                  100 / 100
                </div>
                <div style="font-size: 0.75rem; color: var(--text-muted);">Current Tokens / Modulated Capacity</div>
              </div>
            </div>

            <div style="display: grid; grid-template-columns: 1fr 1fr; gap: 12px; margin-top: 8px;">
              <div style="background: var(--bg-surface-elevated); padding: 10px; border-radius: var(--radius-sm); text-align: center;">
                <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Modulated Capacity C(S)</div>
                <div style="font-size: 1.2rem; font-weight: 700; color: var(--primary-cyan);" id="statModCap">100 tokens</div>
              </div>
              <div style="background: var(--bg-surface-elevated); padding: 10px; border-radius: var(--radius-sm); text-align: center;">
                <div style="font-size: 0.72rem; color: var(--text-muted); text-transform: uppercase;">Refill Rate r(S)</div>
                <div style="font-size: 1.2rem; font-weight: 700; color: var(--tier-clean);" id="statModRefill">50 tokens/s</div>
              </div>
            </div>
          </div>

          <!-- Dynamic Quadratic Penalty Formulation & TCO Matrix -->
          <div class="glass-panel" style="padding: 24px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
              <h3 style="font-size: 1.05rem;">Quadratic Penalty Curve</h3>
              <span class="chip chip-clean">C(S) = C<sub>base</sub> &middot; (1 - S<sup>2</sup>)</span>
            </div>

            <div style="position: relative; width: 100%; height: 210px; margin-bottom: 16px;">
              <canvas id="penaltyCanvas" style="width: 100%; height: 100%; display: block;"></canvas>
            </div>

            <!-- Reputation Tiers Mapping Table -->
            <div style="background: var(--bg-surface-elevated); border-radius: var(--radius-sm); padding: 12px; font-size: 0.8rem;">
              <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid var(--border-subtle);">
                <span style="color: var(--tier-clean); font-weight: 700;">Clean (S &lt; 0.40)</span>
                <span>C = 100, r = 50 tokens/s &rarr; 200 OK Forward</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid var(--border-subtle);">
                <span style="color: var(--tier-monitored); font-weight: 700;">Monitored (0.40 &le; S &lt; 0.65)</span>
                <span>C = 50, r = 25 tokens/s &rarr; Forward + Log</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px solid var(--border-subtle);">
                <span style="color: var(--tier-throttled); font-weight: 700;">Throttled (0.65 &le; S &lt; 0.85)</span>
                <span>C = 10, r = 2 tokens/s &rarr; 429 Rate Limit</span>
              </div>
              <div style="display: flex; justify-content: space-between; padding: 4px 0;">
                <span style="color: var(--tier-blocked); font-weight: 700;">Blocked (S &ge; 0.85)</span>
                <span>C = 0, r = 0 tokens/s &rarr; Immediate 403 Drop</span>
              </div>
            </div>

            <!-- Cooldown Trigger -->
            <div style="margin-top: 14px; display: flex; justify-content: flex-end;">
              <button class="btn btn-secondary btn-sm" id="btnSimCooldown">
                ${Icons.refresh(14)} Simulate 5.0s Cooldown &amp; Recovery
              </button>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  attachEvents() {
    // 1. Feature Sliders
    this.container.querySelectorAll('.feature-slider').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const feat = e.target.dataset.feat;
        const val = parseFloat(e.target.value);
        this.features[feat] = val;

        const labelMap = {
          f0_velocity: `${val.toFixed(1)} req/s`,
          f1_inter_arrival_mean: `${val.toFixed(2)} s`,
          f2_inter_arrival_variance: val.toFixed(3),
          f3_shannon_entropy: val.toFixed(2),
          f4_error_ratio: `${(val * 100).toFixed(0)}%`,
          f5_post_ratio: `${(val * 100).toFixed(0)}%`,
          f6_payload_variance: `${val.toFixed(0)} B`,
          f7_ua_variance: val.toFixed(2)
        };

        const valSpan = this.container.querySelector(`#val_${feat.split('_')[0]}`);
        if (valSpan) valSpan.textContent = labelMap[feat] || val;

        this.calculateAndRenderScore();
      });
    });

    // 2. Preset Buttons
    this.container.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const preset = btn.dataset.preset;
        this.applyPreset(preset);
      });
    });

    // 3. Replay Tree Button
    this.container.querySelector('#btnReplayTree')?.addEventListener('click', () => {
      this.generateIfTree();
    });

    // 4. Cooldown Button
    this.container.querySelector('#btnSimCooldown')?.addEventListener('click', () => {
      this.simulateCooldown();
    });
  }

  applyPreset(preset) {
    if (preset === 'benign') {
      this.features = {
        f0_velocity: 1.5,
        f1_inter_arrival_mean: 0.65,
        f2_inter_arrival_variance: 0.45,
        f3_shannon_entropy: 2.4,
        f4_error_ratio: 0.0,
        f5_post_ratio: 0.1,
        f6_payload_variance: 85.0,
        f7_ua_variance: 0.95
      };
    } else if (preset === 'flash') {
      this.features = {
        f0_velocity: 14.0,
        f1_inter_arrival_mean: 0.07,
        f2_inter_arrival_variance: 0.65,
        f3_shannon_entropy: 2.9,
        f4_error_ratio: 0.02,
        f5_post_ratio: 0.15,
        f6_payload_variance: 180.0,
        f7_ua_variance: 0.98
      };
    } else if (preset === 'flood') {
      this.features = {
        f0_velocity: 35.0,
        f1_inter_arrival_mean: 0.02,
        f2_inter_arrival_variance: 0.015,
        f3_shannon_entropy: 0.4,
        f4_error_ratio: 0.15,
        f5_post_ratio: 0.05,
        f6_payload_variance: 10.0,
        f7_ua_variance: 0.1
      };
    } else if (preset === 'scraper') {
      this.features = {
        f0_velocity: 4.0,
        f1_inter_arrival_mean: 0.25,
        f2_inter_arrival_variance: 0.002, // Robotic zero-variance
        f3_shannon_entropy: 0.8,
        f4_error_ratio: 0.05,
        f5_post_ratio: 0.0,
        f6_payload_variance: 5.0,
        f7_ua_variance: 0.0
      };
    } else if (preset === 'credential') {
      this.features = {
        f0_velocity: 18.0,
        f1_inter_arrival_mean: 0.05,
        f2_inter_arrival_variance: 0.05,
        f3_shannon_entropy: 0.1,
        f4_error_ratio: 0.95, // 95% 4xx login failures
        f5_post_ratio: 1.0,  // 100% POST /api/v1/auth/login
        f6_payload_variance: 2.0,
        f7_ua_variance: 0.05
      };
    }

    // Sync input sliders
    this.container.querySelectorAll('.feature-slider').forEach(slider => {
      const feat = slider.dataset.feat;
      if (this.features[feat] !== undefined) {
        slider.value = this.features[feat];
        const valSpan = this.container.querySelector(`#val_${feat.split('_')[0]}`);
        if (valSpan) {
          const val = this.features[feat];
          if (feat === 'f0_velocity') valSpan.textContent = `${val.toFixed(1)} req/s`;
          else if (feat === 'f1_inter_arrival_mean') valSpan.textContent = `${val.toFixed(2)} s`;
          else if (feat === 'f4_error_ratio' || feat === 'f5_post_ratio') valSpan.textContent = `${(val * 100).toFixed(0)}%`;
          else valSpan.textContent = val.toFixed(2);
        }
      }
    });

    this.calculateAndRenderScore();
    toastManager.show(`Loaded ${preset.toUpperCase()} vector preset`, 'clean');
  }

  calculateAndRenderScore() {
    // Model inference approximation matching Python scikit-learn Isolation Forest
    let rawAnomaly = 0.0;
    if (this.features.f0_velocity > 10.0) rawAnomaly += (this.features.f0_velocity - 10) * 0.02;
    if (this.features.f2_inter_arrival_variance < 0.05) rawAnomaly += 0.35; // Bot signature
    if (this.features.f4_error_ratio > 0.5) rawAnomaly += 0.45;           // Brute force
    if (this.features.f5_post_ratio > 0.7) rawAnomaly += 0.25;
    if (this.features.f3_shannon_entropy < 0.5) rawAnomaly += 0.20;

    let score = normalizeRawDecisionScore(rawAnomaly);

    // Apply safety boosters
    score = applySafetyBoosters(score, this.features);

    this.currentScore = score;
    this.currentTier = getTierFromScore(score);

    // Update dynamic capacity and refill
    const penalty = calculateThrottlePenalty(score, this.baseCap, this.baseRefill);
    this.effectiveCap = penalty.capacity;
    this.effectiveRefill = penalty.refillRate;
    this.requestRate = this.features.f0_velocity;

    // Render Score UI
    const scoreValEl = this.container.querySelector('#outScoreVal');
    const rawValEl = this.container.querySelector('#outRawVal');
    const pathValEl = this.container.querySelector('#outPathVal');
    const tierChipEl = this.container.querySelector('#outTierChip');

    if (scoreValEl) {
      scoreValEl.textContent = score.toFixed(2);
      scoreValEl.style.color = this.currentTier === ReputationTier.CLEAN ? 'var(--tier-clean)' :
                                (this.currentTier === ReputationTier.MONITORED ? 'var(--tier-monitored)' :
                                (this.currentTier === ReputationTier.THROTTLED ? 'var(--tier-throttled)' : 'var(--tier-blocked)'));
    }

    if (rawValEl) rawValEl.textContent = rawAnomaly.toFixed(2);
    if (pathValEl) pathValEl.textContent = `${Math.max(2, Math.round(14 - score * 11))} cuts`;

    if (tierChipEl) {
      tierChipEl.className = `chip chip-${this.currentTier.toLowerCase()}`;
      tierChipEl.textContent = `${this.currentTier.toUpperCase()} TIER`;
    }

    // Update Mitigation UI
    const capEl = this.container.querySelector('#statModCap');
    const refillEl = this.container.querySelector('#statModRefill');
    const bucketStatusChip = this.container.querySelector('#bucketStatusChip');

    if (capEl) capEl.textContent = `${this.effectiveCap} tokens`;
    if (refillEl) refillEl.textContent = `${this.effectiveRefill} tokens/s`;

    if (bucketStatusChip) {
      bucketStatusChip.className = `chip chip-${this.currentTier.toLowerCase()}`;
      bucketStatusChip.textContent = this.currentTier === ReputationTier.BLOCKED ? '403 FORBIDDEN DROP' :
                                    (this.currentTier === ReputationTier.THROTTLED ? '429 THROTTLE ENGAGED' : 'TOKEN PASSTHROUGH');
    }

    this.renderPenaltyPlot();
  }

  initPenaltyPlot() {
    this.penaltyCanvas = this.container.querySelector('#penaltyCanvas');
    if (this.penaltyCanvas) {
      this.pCtx = this.penaltyCanvas.getContext('2d');
      this.renderPenaltyPlot();
    }
  }

  renderPenaltyPlot() {
    if (!this.penaltyCanvas || !this.pCtx) return;
    const canvas = this.penaltyCanvas;
    const ctx = this.pCtx;
    const dpr = window.devicePixelRatio || 1;

    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;
    const w = canvas.width;
    const h = canvas.height;

    ctx.clearRect(0, 0, w, h);

    const pad = 35 * dpr;
    const plotW = w - pad * 2;
    const plotH = h - pad * 2;

    // Draw axes
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
    ctx.lineWidth = 1 * dpr;
    ctx.beginPath();
    ctx.moveTo(pad, pad);
    ctx.lineTo(pad, h - pad);
    ctx.lineTo(w - pad, h - pad);
    ctx.stroke();

    // Quadratic capacity curve: C(S) = 100 * (1 - S^2)
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2 * dpr;
    ctx.beginPath();
    for (let i = 0; i <= 100; i++) {
      const s = i / 100;
      const c = 100 * (1 - s * s);
      const px = pad + s * plotW;
      const py = (h - pad) - (c / 100) * plotH;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    }
    ctx.stroke();

    // Highlight current score operating point
    const currX = pad + this.currentScore * plotW;
    const currC = 100 * (1 - this.currentScore * this.currentScore);
    const currY = (h - pad) - (currC / 100) * plotH;

    ctx.beginPath();
    ctx.arc(currX, currY, 6 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#00f0ff';
    ctx.lineWidth = 2 * dpr;
    ctx.stroke();

    // Operating point text
    ctx.font = `${10 * dpr}px 'JetBrains Mono', monospace`;
    ctx.fillStyle = '#ffffff';
    ctx.fillText(`S = ${this.currentScore.toFixed(2)}`, currX + 8 * dpr, currY - 6 * dpr);
  }

  startBucketLoop() {
    this.bucketInterval = setInterval(() => {
      // Drain tokens by requestRate, refill by effectiveRefill
      const dt = 0.2; // 200ms tick
      const tokensNeeded = this.requestRate * dt;
      const tokensRefilled = this.effectiveRefill * dt;

      this.bucketTokens = Math.max(0, Math.min(this.effectiveCap, this.bucketTokens - tokensNeeded + tokensRefilled));

      const readout = this.container.querySelector('#bucketCountReadout');
      const fluid = this.container.querySelector('#bucketFluid');

      if (readout) {
        readout.textContent = `${Math.round(this.bucketTokens)} / ${this.effectiveCap}`;
      }

      if (fluid && this.effectiveCap > 0) {
        const pct = Math.min(100, (this.bucketTokens / this.effectiveCap) * 100);
        fluid.style.height = `${pct}%`;
        fluid.style.background = pct < 20 ? 'linear-gradient(180deg, #ef4444, #dc2626)' :
                                (pct < 50 ? 'linear-gradient(180deg, #f59e0b, #d97706)' :
                                'linear-gradient(180deg, #00f0ff, #0284c7)');
      }
    }, 200);
  }

  simulateCooldown() {
    if (this.cooldownActive) return;
    this.cooldownActive = true;
    toastManager.show('Attacker halted. Draining buffer over 5.0s window...', 'clean');

    let step = 0;
    const startScore = this.currentScore;
    this.cooldownTimer = setInterval(() => {
      step++;
      const ratio = 1 - step / 10;
      this.features.f0_velocity = Math.max(1.5, this.features.f0_velocity * ratio);
      this.features.f2_inter_arrival_variance = 0.45;
      this.features.f4_error_ratio = 0.0;
      this.calculateAndRenderScore();

      if (step >= 10) {
        clearInterval(this.cooldownTimer);
        this.cooldownActive = false;
        this.applyPreset('benign');
        toastManager.show('Cooldown complete. Full 100 token capacity restored.', 'clean');
      }
    }, 500);
  }

  initIfAnimation() {
    const canvas = this.container.querySelector('#ifTreeCanvas');
    if (!canvas) return;
    this.ifCtx = canvas.getContext('2d');
    this.generateIfTree();
  }

  generateIfTree() {
    const canvas = this.container.querySelector('#ifTreeCanvas');
    if (!canvas || !this.ifCtx) return;
    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    const w = canvas.width;
    const h = canvas.height;

    // Generate normal cluster points
    this.ifPoints = [];
    for (let i = 0; i < 45; i++) {
      this.ifPoints.push({
        x: w * 0.45 + (Math.random() - 0.5) * w * 0.35,
        y: h * 0.5 + (Math.random() - 0.5) * h * 0.45
      });
    }

    // Single isolated outlier point
    this.ifOutlier = {
      x: w * 0.88,
      y: h * 0.18
    };

    // Recursive split lines
    this.ifSplits = [
      { x1: w * 0.75, y1: 0, x2: w * 0.75, y2: h, vert: true },
      { x1: w * 0.75, y1: h * 0.35, x2: w, y2: h * 0.35, vert: false },
      { x1: 0, y1: h * 0.4, x2: w * 0.75, y2: h * 0.4, vert: false },
      { x1: w * 0.3, y1: 0, x2: w * 0.3, y2: h, vert: true }
    ];

    this.drawIfTree();
  }

  drawIfTree() {
    const ctx = this.ifCtx;
    if (!ctx) return;
    const w = this.container.querySelector('#ifTreeCanvas').width;
    const h = this.container.querySelector('#ifTreeCanvas').height;
    const dpr = window.devicePixelRatio || 1;

    ctx.clearRect(0, 0, w, h);

    // Draw split partitions
    ctx.strokeStyle = 'rgba(0, 240, 255, 0.4)';
    ctx.lineWidth = 1.2 * dpr;
    ctx.setLineDash([4 * dpr, 4 * dpr]);

    for (const s of this.ifSplits) {
      ctx.beginPath();
      ctx.moveTo(s.x1, s.y1);
      ctx.lineTo(s.x2, s.y2);
      ctx.stroke();
    }
    ctx.setLineDash([]);

    // Draw normal cluster points
    ctx.fillStyle = 'rgba(0, 240, 255, 0.65)';
    for (const p of this.ifPoints) {
      ctx.beginPath();
      ctx.arc(p.x, p.y, 3.2 * dpr, 0, Math.PI * 2);
      ctx.fill();
    }

    // Draw isolated outlier point (Threat)
    if (this.ifOutlier) {
      ctx.beginPath();
      ctx.arc(this.ifOutlier.x, this.ifOutlier.y, 6 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = '#ef4444';
      ctx.fill();

      ctx.beginPath();
      ctx.arc(this.ifOutlier.x, this.ifOutlier.y, 10 * dpr, 0, Math.PI * 2);
      ctx.strokeStyle = 'rgba(239, 68, 68, 0.5)';
      ctx.lineWidth = 1.5 * dpr;
      ctx.stroke();

      ctx.font = `${10 * dpr}px 'JetBrains Mono', monospace`;
      ctx.fillStyle = '#ef4444';
      ctx.fillText('Isolated Anomaly (h=2)', this.ifOutlier.x - 70 * dpr, this.ifOutlier.y + 22 * dpr);
    }
  }
}
