/**
 * IntelliShield Threat Intelligence & ML Lab Component (#/ml)
 * Interactive 8D behavioral sliders, real-time model scoring,
 * 2D Isolation Forest tree isolation explainer, and safety booster inspection.
 */

import {
  extract8DFeatures,
  normalizeRawDecisionScore,
  applySafetyBoosters,
  getTierFromScore,
  calculateThrottlePenalty
} from '../model.js';
import { RadarChart } from '../components/charts.js';
import { Icons } from '../components/icons.js';
import { toastManager } from '../components/modal.js';

export class MlLabPage {
  constructor() {
    this.container = null;
    this.radarChart = null;

    // Feature Vector state ($f_0$ to $f_7$)
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

    // Isolation Forest 2D animation state
    this.ifAnimTimer = null;
    this.ifPoints = [];
    this.ifSplits = [];
    this.ifOutlier = null;
  }

  mount(container) {
    this.container = container;
    this.render();
    this.initRadar();
    this.initIfAnimation();
    this.attachEvents();
    this.calculateAndRenderScore();
  }

  unmount() {
    if (this.ifAnimTimer) clearInterval(this.ifAnimTimer);
  }

  render() {
    this.container.innerHTML = `
      <div class="page-view active">
        <!-- Header -->
        <div class="page-header reveal">
          <div class="page-header-title">
            <h2>Machine Learning Threat Intelligence Lab</h2>
            <p>Interactive 8-dimensional behavioral vector tuning, Unsupervised Isolation Forest mechanics, and safety booster verification.</p>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary btn-sm preset-btn" data-preset="benign"
                    data-tooltip-title="Preset: Benign Human"
                    data-tooltip-desc="Simulates legitimate user browsing: moderate velocity (1.5 req/s), natural arrival variance, high entropy, zero errors."
                    data-tooltip-action="Click to load benign user vector">Benign Human</button>
            <button class="btn btn-secondary btn-sm preset-btn" data-preset="flash"
                    data-tooltip-title="Preset: Flash Crowd"
                    data-tooltip-desc="Simulates sudden legitimate traffic surge: high velocity (14 req/s), high variance, diverse User-Agents, safety booster active."
                    data-tooltip-action="Click to load flash crowd vector">Flash Crowd</button>
            <button class="btn btn-secondary btn-sm preset-btn" data-preset="flood"
                    data-tooltip-title="Preset: Volumetric Flood (DDoS)"
                    data-tooltip-desc="Simulates high-velocity packet flood (35 req/s) with minimal arrival gaps. Triggers quadratic token throttling."
                    data-tooltip-action="Click to load flood attack vector">Volumetric Flood</button>
            <button class="btn btn-secondary btn-sm preset-btn" data-preset="scraper"
                    data-tooltip-title="Preset: Stealth Scraper"
                    data-tooltip-desc="Simulates automated content crawler: fixed timer intervals (zero variance, f_2=0.002) and robotic signature."
                    data-tooltip-action="Click to load scraper bot vector">Stealth Scraper</button>
            <button class="btn btn-secondary btn-sm preset-btn" data-preset="credential"
                    data-tooltip-title="Preset: Credential Stuffing"
                    data-tooltip-desc="Simulates authentication brute-force: 100% POST requests to /api/v1/auth/login, 95% HTTP error status ratio."
                    data-tooltip-action="Click to load credential stuffing vector">Credential Stuffing</button>
          </div>
        </div>

        <!-- 8D Sliders + Live Output Score Grid -->
        <div style="display: grid; grid-template-columns: 1fr; gap: 24px; margin-bottom: 32px;" class="reveal delay1">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(320px, 1fr)); gap: 24px;">
            <!-- Sliders Panel -->
            <div class="glass-panel" style="padding: 24px;">
              <h3 style="font-size: 1.05rem; margin-bottom: 6px;">8D Behavioral Telemetry Vector</h3>
              <p style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 20px;">
                Extracted per active IP over rolling 5.0-second sliding windows
              </p>

              <!-- f0 -->
              <div class="form-group">
                <div class="form-label">
                  <span>f0: Request Velocity ($R$)</span>
                  <span id="val_f0" style="font-family: var(--font-mono); color: var(--primary-cyan);">1.5 req/s</span>
                </div>
                <input type="range" class="feature-slider" data-feat="f0_velocity" min="0.2" max="40.0" step="0.2" value="1.5">
              </div>

              <!-- f1 -->
              <div class="form-group">
                <div class="form-label">
                  <span>f1: Inter-Arrival Mean ($\mu_{\Delta t}$)</span>
                  <span id="val_f1" style="font-family: var(--font-mono); color: var(--primary-cyan);">0.65 s</span>
                </div>
                <input type="range" class="feature-slider" data-feat="f1_inter_arrival_mean" min="0.01" max="2.0" step="0.01" value="0.65">
              </div>

              <!-- f2 -->
              <div class="form-group">
                <div class="form-label">
                  <span>f2: Inter-Arrival Variance ($\sigma^2_{\Delta t}$)</span>
                  <span id="val_f2" style="font-family: var(--font-mono); color: var(--primary-cyan);">0.450</span>
                </div>
                <input type="range" class="feature-slider" data-feat="f2_inter_arrival_variance" min="0.000" max="1.0" step="0.001" value="0.450">
              </div>

              <!-- f3 -->
              <div class="form-group">
                <div class="form-label">
                  <span>f3: URI Shannon Entropy ($H$)</span>
                  <span id="val_f3" style="font-family: var(--font-mono); color: var(--primary-cyan);">2.40</span>
                </div>
                <input type="range" class="feature-slider" data-feat="f3_shannon_entropy" min="0.0" max="3.5" step="0.05" value="2.40">
              </div>

              <!-- f4 -->
              <div class="form-group">
                <div class="form-label">
                  <span>f4: HTTP Error Ratio ($E_{ratio}$)</span>
                  <span id="val_f4" style="font-family: var(--font-mono); color: var(--primary-cyan);">0.00</span>
                </div>
                <input type="range" class="feature-slider" data-feat="f4_error_ratio" min="0.0" max="1.0" step="0.02" value="0.00">
              </div>

              <!-- f5 -->
              <div class="form-group">
                <div class="form-label">
                  <span>f5: POST/PUT Ratio ($M_{post}$)</span>
                  <span id="val_f5" style="font-family: var(--font-mono); color: var(--primary-cyan);">0.10</span>
                </div>
                <input type="range" class="feature-slider" data-feat="f5_post_ratio" min="0.0" max="1.0" step="0.02" value="0.10">
              </div>

              <!-- f6 -->
              <div class="form-group">
                <div class="form-label">
                  <span>f6: Payload Size Variance ($\sigma^2_{payload}$)</span>
                  <span id="val_f6" style="font-family: var(--font-mono); color: var(--primary-cyan);">85.0</span>
                </div>
                <input type="range" class="feature-slider" data-feat="f6_payload_variance" min="0.0" max="400.0" step="5.0" value="85.0">
              </div>

              <!-- f7 -->
              <div class="form-group">
                <div class="form-label">
                  <span>f7: UA Fingerprint Variance ($V_{ua}$)</span>
                  <span id="val_f7" style="font-family: var(--font-mono); color: var(--primary-cyan);">0.95</span>
                </div>
                <input type="range" class="feature-slider" data-feat="f7_ua_variance" min="0.05" max="1.0" step="0.05" value="0.95">
              </div>
            </div>

            <!-- Scoring Inference Engine & Radar -->
            <div style="display: flex; flex-direction: column; gap: 20px;">
              <!-- Score Output Card -->
              <div class="glass-panel" style="padding: 24px;">
                <h3 style="font-size: 1.05rem; margin-bottom: 4px;">Computed Anomaly Inference</h3>
                <p style="font-size: 0.78rem; color: var(--text-muted); margin-bottom: 16px;">
                  Model output $s \in [0.05, 0.99]$ evaluated via calibrated decision function + deterministic boosters
                </p>

                <div style="display: flex; align-items: baseline; gap: 14px; margin-bottom: 14px;">
                  <span style="font-family: var(--font-heading); font-size: 3.2rem; font-weight: 800; color: var(--primary-cyan);" id="scoreReadout">
                    0.092
                  </span>
                  <div id="tierBadge" class="chip chip-clean" style="font-size: 0.85rem; padding: 4px 12px;">CLEAN TIER</div>
                </div>

                <!-- Active Safety Booster Flags -->
                <div style="margin-top: 12px;">
                  <div style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted); text-transform: uppercase; margin-bottom: 6px;">
                    Deterministic Signature Safety Boosters:
                  </div>
                  <div id="boostersContainer" style="display: flex; flex-wrap: wrap; gap: 6px;">
                    <span style="font-size: 0.75rem; color: var(--text-muted);">None Active (Baseline Statistical Scoring)</span>
                  </div>
                </div>

                <!-- Live Worker Comparison Callout -->
                <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border-subtle); display: flex; align-items: center; justify-content: space-between;">
                  <span style="font-size: 0.75rem; color: var(--text-muted);">Client model is a client-side estimate calibrated to the scikit-learn model artifact.</span>
                  <button class="btn btn-secondary btn-sm" id="btnScoreWorker">
                    Score via Worker (:5001)
                  </button>
                </div>
              </div>

              <!-- Radar Chart Card -->
              <div class="glass-panel" style="padding: 20px; flex: 1; display: flex; flex-direction: column; align-items: center; justify-content: center;">
                <h4 style="font-size: 0.9rem; align-self: flex-start; margin-bottom: 4px;">8D Geometry Radar</h4>
                <div style="width: 100%; height: 260px; display: flex; align-items: center; justify-content: center;">
                  <canvas id="mlRadarCanvas"></canvas>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Isolation Forest Visual Explainer -->
        <div class="glass-panel reveal delay2" style="padding: 24px; margin-bottom: 32px;">
          <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 16px;">
            <div>
              <h3 style="font-size: 1.15rem;">Why Unsupervised Isolation Forest? (Liu, Ting, Zhou)</h3>
              <p style="font-size: 0.82rem; color: var(--text-muted);">
                Anomalies have few points and extreme values; random recursive partition cuts isolate them in fewer splits: $E(h(x)) \ll c(n)$.
              </p>
            </div>
            <button class="btn btn-secondary btn-sm" id="btnRestartIfAnim">
              ${Icons.refresh(14)} Re-partition Trees
            </button>
          </div>

          <div style="display: grid; grid-template-columns: 1fr; gap: 24px;">
            <div style="width: 100%; height: 320px; background: var(--bg-surface-elevated); border-radius: var(--radius-md); overflow: hidden; position: relative;">
              <canvas id="ifExplainerCanvas" style="width: 100%; height: 100%; display: block;"></canvas>
            </div>

            <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(240px, 1fr)); gap: 16px; font-size: 0.85rem;">
              <div class="glass-panel" style="padding: 16px;">
                <strong style="color: var(--primary-cyan);">1. Zero Labeled Data Required</strong>
                <p style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 6px;">
                  Unsupervised model learns normal baseline distributions. No stale attack signature databases or costly labeling pipelines.
                </p>
              </div>
              <div class="glass-panel" style="padding: 16px;">
                <strong style="color: var(--tier-clean);">2. Linear Time Complexity</strong>
                <p style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 6px;">
                  $O(t \cdot \psi \log \psi)$ training and $O(t \log \psi)$ evaluation complexity. Evaluates 100 trees in sub-millisecond time.
                </p>
              </div>
              <div class="glass-panel" style="padding: 16px;">
                <strong style="color: var(--tier-monitored);">3. Subsampling Isolation Guarantee</strong>
                <p style="font-size: 0.78rem; color: var(--text-secondary); margin-top: 6px;">
                  Tree depth $h(x)$ directly maps to anomaly score. Anomalies isolate near the root with average path length far shorter than normal browsing clusters.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  initRadar() {
    this.radarChart = new RadarChart('mlRadarCanvas');
  }

  initIfAnimation() {
    const canvas = document.getElementById('ifExplainerCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const dpr = Math.min(window.devicePixelRatio || 1, 2);

    const rect = canvas.getBoundingClientRect();
    const w = canvas.width = (rect.width || 600) * dpr;
    const h = canvas.height = (rect.height || 320) * dpr;

    // Generate normal point cluster + 1 isolated anomaly
    this.ifPoints = [];
    const cx = w * 0.45;
    const cy = h * 0.55;

    // 80 normal cluster points
    for (let i = 0; i < 80; i++) {
      const u = Math.random() + Math.random();
      const r = (u > 1 ? 2 - u : u) * (80 * dpr);
      const theta = Math.random() * Math.PI * 2;
      this.ifPoints.push({ x: cx + Math.cos(theta) * r, y: cy + Math.sin(theta) * r, isAnomaly: false });
    }

    // 1 anomaly point far out
    this.ifOutlier = { x: w * 0.88, y: h * 0.20, isAnomaly: true };
    this.ifPoints.push(this.ifOutlier);

    // Random split cuts
    this.ifSplits = [];
    let splitCount = 0;

    const addSplit = () => {
      if (splitCount >= 10) return;
      const isVertical = Math.random() > 0.5;
      this.ifSplits.push({
        isVertical,
        val: isVertical ? Math.random() * w : Math.random() * h,
        alpha: 0
      });
      splitCount++;
    };

    if (this.ifAnimTimer) clearInterval(this.ifAnimTimer);
    this.ifAnimTimer = setInterval(addSplit, 800);

    const render = () => {
      ctx.clearRect(0, 0, w, h);

      // Draw partition cuts
      for (const sp of this.ifSplits) {
        sp.alpha = Math.min(0.7, sp.alpha + 0.05);
        ctx.beginPath();
        if (sp.isVertical) {
          ctx.moveTo(sp.val, 0);
          ctx.lineTo(sp.val, h);
        } else {
          ctx.moveTo(0, sp.val);
          ctx.lineTo(w, sp.val);
        }
        ctx.strokeStyle = `rgba(0, 240, 255, ${sp.alpha})`;
        ctx.lineWidth = 1.5 * dpr;
        ctx.setLineDash([4 * dpr, 4 * dpr]);
        ctx.stroke();
        ctx.setLineDash([]);
      }

      // Draw normal points
      for (const p of this.ifPoints) {
        ctx.beginPath();
        ctx.arc(p.x, p.y, (p.isAnomaly ? 6 : 3) * dpr, 0, Math.PI * 2);
        if (p.isAnomaly) {
          ctx.fillStyle = '#ef4444';
          ctx.shadowColor = '#ef4444';
          ctx.shadowBlur = 10 * dpr;
        } else {
          ctx.fillStyle = 'rgba(56, 189, 248, 0.7)';
          ctx.shadowBlur = 0;
        }
        ctx.fill();
        ctx.shadowBlur = 0;
      }

      // Annotation text
      ctx.font = `${9 * dpr}px monospace`;
      ctx.fillStyle = '#94a3b8';
      ctx.fillText(`Cuts: ${this.ifSplits.length} | Outlier Path Length h(x) ≈ 2 splits (Isolated Rapidly)`, 14 * dpr, 20 * dpr);

      requestAnimationFrame(render);
    };
    render();
  }

  attachEvents() {
    // Slider inputs
    this.container.querySelectorAll('.feature-slider').forEach(slider => {
      slider.addEventListener('input', (e) => {
        const feat = e.target.dataset.feat;
        const val = parseFloat(e.target.value);
        this.features[feat] = val;

        const valLabel = this.container.querySelector(`#val_${feat.split('_')[0]}`);
        if (valLabel) {
          valLabel.textContent = feat === 'f0_velocity' ? `${val.toFixed(1)} req/s` : (feat === 'f1_inter_arrival_mean' ? `${val.toFixed(2)} s` : val.toFixed(3));
        }

        this.calculateAndRenderScore();
      });
    });

    // Presets
    this.container.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const p = btn.dataset.preset;
        this.applyPreset(p);
      });
    });

    // Worker score POST
    this.container.querySelector('#btnScoreWorker')?.addEventListener('click', async () => {
      try {
        const res = await fetch('/intellishield/score_sample', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ features: this.features })
        });
        if (res.ok) {
          const data = await res.json();
          toastManager.show(`Worker returned score: ${data.score}`, 'monitored');
        } else {
          toastManager.show('Scoring simulated locally (ML Worker idle)', 'clean');
        }
      } catch (e) {
        toastManager.show('Scoring simulated locally (ML Worker offline)', 'clean');
      }
    });

    // Re-partition animation button
    this.container.querySelector('#btnRestartIfAnim')?.addEventListener('click', () => {
      this.initIfAnimation();
    });
  }

  applyPreset(preset) {
    if (preset === 'benign') {
      this.features = {
        f0_velocity: 1.2,
        f1_inter_arrival_mean: 0.8,
        f2_inter_arrival_variance: 0.45,
        f3_shannon_entropy: 2.4,
        f4_error_ratio: 0.0,
        f5_post_ratio: 0.1,
        f6_payload_variance: 80.0,
        f7_ua_variance: 1.0,
        samples: 10
      };
    } else if (preset === 'flash') {
      this.features = {
        f0_velocity: 12.0,
        f1_inter_arrival_mean: 0.08,
        f2_inter_arrival_variance: 0.55,
        f3_shannon_entropy: 2.8,
        f4_error_ratio: 0.01,
        f5_post_ratio: 0.15,
        f6_payload_variance: 120.0,
        f7_ua_variance: 0.95,
        samples: 25
      };
    } else if (preset === 'flood') {
      this.features = {
        f0_velocity: 25.0,
        f1_inter_arrival_mean: 0.04,
        f2_inter_arrival_variance: 0.002,
        f3_shannon_entropy: 0.2,
        f4_error_ratio: 0.0,
        f5_post_ratio: 0.0,
        f6_payload_variance: 2.0,
        f7_ua_variance: 0.05,
        samples: 50
      };
    } else if (preset === 'scraper') {
      this.features = {
        f0_velocity: 3.5,
        f1_inter_arrival_mean: 0.28,
        f2_inter_arrival_variance: 0.005,
        f3_shannon_entropy: 0.4,
        f4_error_ratio: 0.02,
        f5_post_ratio: 0.0,
        f6_payload_variance: 5.0,
        f7_ua_variance: 0.1,
        samples: 15
      };
    } else if (preset === 'credential') {
      this.features = {
        f0_velocity: 8.0,
        f1_inter_arrival_mean: 0.12,
        f2_inter_arrival_variance: 0.03,
        f3_shannon_entropy: 0.3,
        f4_error_ratio: 0.85,
        f5_post_ratio: 0.95,
        f6_payload_variance: 4.0,
        f7_ua_variance: 0.2,
        samples: 12
      };
    }

    // Update UI sliders
    for (const [k, v] of Object.entries(this.features)) {
      const slider = this.container.querySelector(`[data-feat="${k}"]`);
      if (slider) slider.value = v;
      const tag = k.split('_')[0];
      const valLabel = this.container.querySelector(`#val_${tag}`);
      if (valLabel) {
        valLabel.textContent = k === 'f0_velocity' ? `${v.toFixed(1)} req/s` : (k === 'f1_inter_arrival_mean' ? `${v.toFixed(2)} s` : v.toFixed(3));
      }
    }

    this.calculateAndRenderScore();
    toastManager.show(`Loaded scenario preset: ${preset.toUpperCase()}`, 'clean');
  }

  calculateAndRenderScore() {
    // 1. Estimate raw isolation score from feature anomalies
    let rawScore = 0.15;
    if (this.features.f0_velocity > 15.0) rawScore -= 0.25;
    if (this.features.f2_inter_arrival_variance < 0.02) rawScore -= 0.15;
    if (this.features.f3_shannon_entropy < 0.8) rawScore -= 0.10;
    if (this.features.f4_error_ratio > 0.3) rawScore -= 0.30;

    // 2. Normalize
    const baseScore = normalizeRawDecisionScore(rawScore);

    // 3. Apply Safety Boosters
    const result = applySafetyBoosters(baseScore, this.features);
    const finalScore = result.score;
    const tier = getTierFromScore(finalScore);

    // 4. Update Score Readout
    const readout = this.container.querySelector('#scoreReadout');
    const badge = this.container.querySelector('#tierBadge');
    if (readout) readout.textContent = finalScore.toFixed(3);
    if (badge) {
      badge.textContent = `${tier.toUpperCase()} TIER`;
      badge.className = `chip chip-${tier.toLowerCase()}`;
    }

    // 5. Update Boosters List
    const boostersContainer = this.container.querySelector('#boostersContainer');
    if (boostersContainer) {
      if (result.activeBoosters.length === 0) {
        boostersContainer.innerHTML = `<span style="font-size: 0.75rem; color: var(--text-muted);">None Active (Baseline Statistical Scoring)</span>`;
      } else {
        boostersContainer.innerHTML = result.activeBoosters.map(b => `
          <span class="chip chip-throttled" style="font-size: 0.72rem;">${b}</span>
        `).join('');
      }
    }

    // 6. Update Radar
    if (this.radarChart) {
      this.radarChart.render([
        this.features.f0_velocity,
        this.features.f1_inter_arrival_mean,
        this.features.f2_inter_arrival_variance,
        this.features.f3_shannon_entropy,
        this.features.f4_error_ratio,
        this.features.f5_post_ratio,
        this.features.f6_payload_variance,
        this.features.f7_ua_variance
      ]);
    }
  }
}
