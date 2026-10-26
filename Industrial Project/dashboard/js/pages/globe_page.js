/**
 * IntelliShield Global View Page Component (#/globe)
 * Ported from MBJ: 3D dot-sphere canvas with animated attack arcs and simulated telemetry nodes.
 */

import { GlobeCanvas } from '../components/globe.js';
import { Icons } from '../components/icons.js';

export class GlobePage {
  constructor() {
    this.container = null;
    this.globe = null;
  }

  mount(container) {
    this.container = container;
    this.render();
    this.initGlobe();
  }

  unmount() {
    if (this.globe) {
      this.globe.stop();
      this.globe = null;
    }
  }

  render() {
    this.container.innerHTML = `
      <div class="page-view active">
        <!-- Header -->
        <div class="page-header reveal">
          <div class="page-header-title">
            <h2>Global Edge Ingress & Attack Vector Distribution</h2>
            <p>Geographic simulation of distributed attack origins flowing into the IntelliShield edge gateway.</p>
          </div>
          <div class="page-actions">
            <span class="chip chip-monitored" style="font-size: 0.75rem;">
              SIMULATED GEOGRAPHIC DATA
            </span>
          </div>
        </div>

        <!-- 3D Dot-Sphere Globe Stage -->
        <div class="glass-panel reveal delay1" style="padding: 24px; margin-bottom: 32px; display: flex; flex-direction: column; align-items: center; justify-content: center; position: relative;">
          <div style="width: 100%; display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px; font-size: 0.82rem; color: var(--text-muted);">
            <span>Drag sphere to rotate view &bull; Arcs represent active traffic flows into Edge Gateway</span>
            <span style="font-family: var(--font-mono); color: var(--primary-cyan);">CENTRAL NODE: SCOPE / VIT VELLORE</span>
          </div>

          <div class="globe-stage">
            <canvas id="globeCanvas"></canvas>
          </div>

          <!-- Color Key -->
          <div style="display: flex; flex-wrap: wrap; gap: 16px; margin-top: 16px; font-size: 0.78rem;">
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="width: 10px; height: 10px; border-radius: 50%; background: var(--tier-clean); display: inline-block;"></span>
              <span>Clean / Legitimate Traffic</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="width: 10px; height: 10px; border-radius: 50%; background: var(--tier-monitored); display: inline-block;"></span>
              <span>Monitored Observation</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="width: 10px; height: 10px; border-radius: 50%; background: var(--tier-throttled); display: inline-block;"></span>
              <span>Throttled Burst</span>
            </div>
            <div style="display: flex; align-items: center; gap: 6px;">
              <span style="width: 10px; height: 10px; border-radius: 50%; background: var(--tier-blocked); display: inline-block;"></span>
              <span>Blocked Attack Vector</span>
            </div>
          </div>
        </div>

        <!-- Simulated Geographic Telemetry Feeds -->
        <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px;" class="reveal delay2">
          <div class="glass-panel" style="padding: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <strong style="color: var(--primary-cyan);">Vellore / Mumbai Edge</strong>
              <span class="chip chip-clean">Gateway Node</span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">
              Primary Ingress Reverse Proxy daemon listening on 0.0.0.0:8080. Zero-copy fast-path forwarding.
            </div>
          </div>

          <div class="glass-panel" style="padding: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <strong>Tokyo, Japan</strong>
              <span class="chip chip-blocked">Blocked 403</span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">
              Automated API endpoint enumeration probe detected. Terminated immediately at edge.
            </div>
          </div>

          <div class="glass-panel" style="padding: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <strong>Frankfurt, Germany</strong>
              <span class="chip chip-throttled">Throttled 429</span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">
              Burst velocity of 32 req/s. Quadratic rate limiter applied; effective capacity reduced to 4 tokens.
            </div>
          </div>

          <div class="glass-panel" style="padding: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <strong>London, UK</strong>
              <span class="chip chip-clean">Forward 200</span>
            </div>
            <div style="font-size: 0.8rem; color: var(--text-secondary);">
              Human consumer browsing session. Natural variance $\\sigma^2 = 0.48$. Median latency: 0.82 ms.
            </div>
          </div>
        </div>
      </div>
    `;
  }

  initGlobe() {
    this.globe = new GlobeCanvas('globeCanvas');
  }
}
