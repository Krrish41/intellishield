/**
 * IntelliShield Documentation, Deployment & API Explorer (#/docs)
 * One-click copy commands for local, Rust, Docker, and Cloudflare deployments,
 * plus interactive API endpoint testing harness.
 */

import { Icons } from '../components/icons.js';
import { toastManager } from '../components/modal.js';

export class DocsPage {
  constructor() {
    this.container = null;
  }

  mount(container) {
    this.container = container;
    this.render();
    this.attachEvents();
  }

  unmount() {}

  render() {
    this.container.innerHTML = `
      <div class="page-view active">
        <!-- Header -->
        <div class="page-header reveal">
          <div class="page-header-title">
            <h2>Deployment Guide & Interactive API Explorer</h2>
            <p>Production runbooks, container orchestration manifests, and live HTTP endpoint verification.</p>
          </div>
        </div>

        <!-- Deployment Runbooks Grid -->
        <div style="display: grid; grid-template-columns: minmax(0, 1fr); gap: 24px; margin-bottom: 32px; width: 100%; max-width: 100%;" class="reveal delay1">
          <!-- Local Execution -->
          <div class="glass-panel" style="padding: 24px;">
            <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px;">
              <h3 style="font-size: 1.05rem;">1. Native Python Deployment</h3>
              <button class="btn btn-secondary btn-sm copy-btn" data-copy='python "Industrial Project/run_intellishield.py" --start'>
                ${Icons.copy(14)} Copy Command
              </button>
            </div>
            <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 12px;">
              Initializes the mock backend on port 3000, Isolation Forest worker on port 5001, and proxy gateway on port 8080.
            </p>
            <pre style="background: #030712; padding: 12px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); color: var(--primary-cyan); overflow-x: auto;"><code>python "Industrial Project/run_intellishield.py" --start</code></pre>
          </div>

          <!-- Rust Production Core -->
          <div class="glass-panel" style="padding: 24px;">
            <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px;">
              <h3 style="font-size: 1.05rem;">2. High-Performance Rust Axum / Tokio Core</h3>
              <button class="btn btn-secondary btn-sm copy-btn" data-copy="cd 'Industrial Project/core' && cargo run --release -- --bind 0.0.0.0:8080 --upstream http://127.0.0.1:3000 --ml-worker http://127.0.0.1:5001">
                ${Icons.copy(14)} Copy Command
              </button>
            </div>
            <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 12px;">
              Compiles and executes the memory-safe production reverse proxy delivering 88,740 req/s peak throughput.
            </p>
            <pre style="background: #030712; padding: 12px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); color: var(--primary-cyan); overflow-x: auto;"><code>cd "Industrial Project/core"
cargo run --release -- --bind 0.0.0.0:8080 --upstream http://127.0.0.1:3000 --ml-worker http://127.0.0.1:5001</code></pre>
          </div>

          <!-- Docker Compose -->
          <div class="glass-panel" style="padding: 24px;">
            <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px;">
              <h3 style="font-size: 1.05rem;">3. Containerized Multi-Tier Stack (Docker Compose)</h3>
              <button class="btn btn-secondary btn-sm copy-btn" data-copy="docker compose up -d --build">
                ${Icons.copy(14)} Copy Command
              </button>
            </div>
            <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 12px;">
              Orchestrates isolated microservice containers with health checks and bridge networking.
            </p>
            <pre style="background: #030712; padding: 12px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); color: var(--primary-cyan); overflow-x: auto;"><code>docker compose up -d --build</code></pre>
          </div>

          <!-- Cloudflare Tunnel -->
          <div class="glass-panel" style="padding: 24px;">
            <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 8px; margin-bottom: 8px;">
              <h3 style="font-size: 1.05rem;">4. Instant Public Secure Exposure (Cloudflare Tunnel)</h3>
              <button class="btn btn-secondary btn-sm copy-btn" data-copy="cloudflared tunnel --url http://localhost:8080">
                ${Icons.copy(14)} Copy Command
              </button>
            </div>
            <p style="font-size: 0.82rem; color: var(--text-muted); margin-bottom: 12px;">
              Exposes the local proxy and dashboard to an external HTTPS URL for mobile testing or faculty reviews without port forwarding.
            </p>
            <pre style="background: #030712; padding: 12px 16px; border-radius: var(--radius-sm); border: 1px solid var(--border-subtle); color: var(--primary-cyan); overflow-x: auto;"><code>cloudflared tunnel --url http://localhost:8080</code></pre>
          </div>
        </div>

        <!-- Interactive API Endpoints Tester -->
        <div class="glass-panel reveal delay2" style="padding: 24px; margin-bottom: 32px;">
          <h3 style="font-size: 1.15rem; margin-bottom: 6px;">Operational HTTP Endpoints Explorer</h3>
          <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 16px;">
            Click "Try Request" to execute a live query against the proxy and inspect the JSON response.
          </p>

          <div style="display: flex; flex-direction: column; gap: 12px;">
            <!-- Health Endpoint -->
            <div class="glass-panel" style="padding: 14px 18px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px;">
              <div>
                <span class="chip chip-clean" style="font-size: 0.72rem;">GET</span>
                <strong style="margin-left: 8px; font-family: var(--font-mono);">/intellishield/health</strong>
                <span style="font-size: 0.78rem; color: var(--text-muted); margin-left: 10px;">Gateway health status check</span>
              </div>
              <button class="btn btn-secondary btn-sm api-try-btn" data-endpoint="/intellishield/health">Try Request</button>
            </div>

            <!-- Status Endpoint -->
            <div class="glass-panel" style="padding: 14px 18px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px;">
              <div>
                <span class="chip chip-clean" style="font-size: 0.72rem;">GET</span>
                <strong style="margin-left: 8px; font-family: var(--font-mono);">/intellishield/status</strong>
                <span style="font-size: 0.78rem; color: var(--text-muted); margin-left: 10px;">Full telemetry state & active IP metrics</span>
              </div>
              <button class="btn btn-secondary btn-sm api-try-btn" data-endpoint="/intellishield/status">Try Request</button>
            </div>

            <!-- Events Endpoint -->
            <div class="glass-panel" style="padding: 14px 18px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px;">
              <div>
                <span class="chip chip-clean" style="font-size: 0.72rem;">GET</span>
                <strong style="margin-left: 8px; font-family: var(--font-mono);">/intellishield/events</strong>
                <span style="font-size: 0.78rem; color: var(--text-muted); margin-left: 10px;">Rolling audit log ring buffer (150 items)</span>
              </div>
              <button class="btn btn-secondary btn-sm api-try-btn" data-endpoint="/intellishield/events">Try Request</button>
            </div>

            <!-- Backend Products Endpoint -->
            <div class="glass-panel" style="padding: 14px 18px; display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 10px;">
              <div>
                <span class="chip chip-clean" style="font-size: 0.72rem;">GET</span>
                <strong style="margin-left: 8px; font-family: var(--font-mono);">/api/v1/products</strong>
                <span style="font-size: 0.78rem; color: var(--text-muted); margin-left: 10px;">Proxied upstream microservice response</span>
              </div>
              <button class="btn btn-secondary btn-sm api-try-btn" data-endpoint="/api/v1/products">Try Request</button>
            </div>
          </div>

          <!-- API Response Output Modal / Drawer -->
          <div id="apiResponseBox" style="display: none; margin-top: 16px; background: #030712; border: 1px solid var(--border-medium); border-radius: var(--radius-sm); padding: 16px;">
            <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
              <span style="font-size: 0.75rem; font-weight: 700; color: var(--text-muted);">RESPONSE BODY</span>
              <span id="apiStatusBadge" class="chip chip-clean">200 OK</span>
            </div>
            <pre style="max-height: 240px; max-width: 100%; overflow-y: auto; overflow-x: auto; white-space: pre-wrap; word-break: break-all; color: var(--primary-cyan); font-size: 0.8rem; font-family: var(--font-mono);"><code id="apiResponseCode">{}</code></pre>
          </div>
        </div>
      </div>
    `;
  }

  attachEvents() {
    // Copy buttons
    this.container.querySelectorAll('.copy-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const cmd = btn.dataset.copy;
        navigator.clipboard.writeText(cmd).then(() => {
          toastManager.show('Command copied to clipboard!', 'clean');
        });
      });
    });

    // Try API buttons
    this.container.querySelectorAll('.api-try-btn').forEach(btn => {
      btn.addEventListener('click', async () => {
        const ep = btn.dataset.endpoint;
        const box = this.container.querySelector('#apiResponseBox');
        const code = this.container.querySelector('#apiResponseCode');
        const badge = this.container.querySelector('#apiStatusBadge');

        try {
          const res = await fetch(ep, { cache: 'no-store' });
          const text = await res.text();
          let parsed;
          try { parsed = JSON.stringify(JSON.parse(text), null, 2); } catch (e) { parsed = text; }

          if (box && code && badge) {
            box.style.display = 'block';
            code.textContent = parsed;
            badge.textContent = `${res.status} ${res.statusText}`;
            badge.className = res.ok ? 'chip chip-clean' : 'chip chip-throttled';
          }
        } catch (err) {
          if (box && code && badge) {
            box.style.display = 'block';
            code.textContent = JSON.stringify({ error: "Network error or gateway offline", message: err.message }, null, 2);
            badge.textContent = 'ERR';
            badge.className = 'chip chip-blocked';
          }
        }
      });
    });
  }
}
