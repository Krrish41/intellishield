/**
 * IntelliShield Overview Page Component (#/)
 * Cinematic hero, count-up KPIs, 3D tilt comparison cards, and attack marquee.
 */

import { Icons } from '../components/icons.js';

export class OverviewPage {
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
        <!-- Hero Section -->
        <section class="hero-section reveal">
          <div class="hero-content">
            <div class="hero-tag">
              ${Icons.shield(16)} Memory-Safe Reverse Proxy
            </div>
            <h1 class="hero-title">
              High-Throughput Ingress with <span class="gradient-text">Async Machine Learning Threat Defense</span>
            </h1>
            <p class="hero-desc">
              IntelliShield resolves the fundamental conflict between wire-speed proxy performance and deep Layer-7 behavioral security by decoupling fast-path zero-copy forwarding in memory-safe Rust from asynchronous Isolation Forest anomaly scoring.
            </p>
            <div class="hero-cta-group">
              <a href="#/console" class="btn btn-primary" data-cursor="Launch"
                 data-tooltip-title="Launch Live Telemetry Console"
                 data-tooltip-desc="Opens live telemetry streaming, real-time charts, per-IP token ledger, and fast-path audit terminal stream."
                 data-tooltip-action="Click to jump to Live Console view"
                 data-tooltip-badge="NAVIGATION">
                ${Icons.activity(16)} Launch Live Console
              </a>
              <a href="#/architecture" class="btn btn-secondary" data-cursor="Inspect"
                 data-tooltip-title="Inspect System Topology"
                 data-tooltip-desc="Interactive dual-path forwarding diagram, interactive packet probes, and 6-step lifecycle stepper."
                 data-tooltip-action="Click to inspect Architecture view"
                 data-tooltip-badge="NAVIGATION">
                ${Icons.network(16)} Inspect System Topology
              </a>
            </div>
          </div>

          <!-- Hero Emblem Stage with Mouse Parallax -->
          <div class="hero-visual">
            <div class="emblem-stage" id="heroEmblemStage">
              <div class="emblem-halo pulse-halo-anim"></div>
              <div class="emblem-ring-outer spin-reverse-slow"></div>
              <div class="emblem-ring-dashed spin-slow">
                <div class="emblem-orbit-dot"></div>
              </div>
              <div class="emblem-core-svg float-anim" id="heroEmblemCore">
                <svg viewBox="0 0 48 48" fill="none" style="width: 100%; height: 100%;">
                  <defs>
                    <linearGradient id="heroGrad" x1="4" y1="4" x2="44" y2="44" gradientUnits="userSpaceOnUse">
                      <stop offset="0%" stop-color="var(--primary-cyan)"/>
                      <stop offset="100%" stop-color="var(--primary-blue)"/>
                    </linearGradient>
                  </defs>
                  <path d="M24 4L7 11V22C7 33.2 14.3 43.6 24 46C33.7 43.6 41 33.2 41 22V11L24 4Z" stroke="url(#heroGrad)" stroke-width="2.5" fill="rgba(0, 240, 255, 0.08)"/>
                  <path d="M24 12V24M24 24L32 30M24 24L16 30" stroke="var(--primary-cyan)" stroke-width="2.5" stroke-linecap="round"/>
                  <circle cx="24" cy="24" r="4" fill="var(--primary-cyan)"/>
                  <circle cx="32" cy="30" r="3" fill="var(--primary-cyan)"/>
                  <circle cx="16" cy="30" r="3" fill="var(--primary-cyan)"/>
                  <path d="M14 15L20 18M34 15L28 18" stroke="var(--primary-cyan)" stroke-width="2" stroke-linecap="round"/>
                </svg>
              </div>
            </div>
          </div>
        </section>

        <!-- Count-Up Empirical Benchmark Strip -->
        <section class="kpi-grid reveal delay1" style="margin-bottom: 48px;">
          <div class="glass-panel kpi-card tilt glow-track" data-tilt="6">
            <div class="kpi-label">
              <span>Peak Ingress Throughput</span>
              ${Icons.activity(16)}
            </div>
            <div class="kpi-val" data-count="88740" data-suffix=" req/s">88,740 req/s</div>
            <div class="kpi-sub">Within 5.8% of bare-metal NGINX</div>
          </div>

          <div class="glass-panel kpi-card tilt glow-track" data-tilt="6">
            <div class="kpi-label">
              <span>Median Forwarding Latency</span>
              ${Icons.zap(16)}
            </div>
            <div class="kpi-val" data-count="0.85" data-decimals="2" data-suffix=" ms">0.85 ms</div>
            <div class="kpi-sub">33x faster than synchronous ML</div>
          </div>

          <div class="glass-panel kpi-card tilt glow-track" data-tilt="6">
            <div class="kpi-label">
              <span>ML Threat Score ROC-AUC</span>
              ${Icons.cpu(16)}
            </div>
            <div class="kpi-val" data-count="0.968" data-decimals="3">0.968</div>
            <div class="kpi-sub">Unsupervised Isolation Forest</div>
          </div>

          <div class="glass-panel kpi-card tilt glow-track" data-tilt="6">
            <div class="kpi-label">
              <span>False Positive Ratio</span>
              ${Icons.shield(16)}
            </div>
            <div class="kpi-val" data-count="1.2" data-decimals="1" data-prefix="< " data-suffix="%">&lt; 1.2%</div>
            <div class="kpi-sub">Zero false drops during flash crowds</div>
          </div>

          <div class="glass-panel kpi-card tilt glow-track" data-tilt="6">
            <div class="kpi-label">
              <span>Annual TCO Reduction</span>
              ${Icons.check(16)}
            </div>
            <div class="kpi-val" data-count="77.5" data-decimals="1" data-suffix="%">77.5%</div>
            <div class="kpi-sub">$7,800 vs $34,800 AWS WAF</div>
          </div>
        </section>

        <!-- Infinite Attack Types Marquee -->
        <section class="reveal delay2" style="margin-bottom: 56px;">
          <div class="marquee-container glass-panel" style="padding: 14px 0;">
            <div class="marquee-track">
              <span class="chip chip-throttled" style="font-size: 0.82rem;">VOLUMETRIC HTTP FLOOD (80 req/s burst mitigated in 85 ms)</span>
              <span class="chip chip-monitored" style="font-size: 0.82rem;">LOW-AND-SLOW WEBSCRAPERS (Zero-variance interval isolated)</span>
              <span class="chip chip-blocked" style="font-size: 0.82rem;">DISTRIBUTED CREDENTIAL STUFFING (401 error storms dropped via 403)</span>
              <span class="chip chip-clean" style="font-size: 0.82rem;">LEGITIMATE FLASH CROWD RESILIENCE (50 req/s surge with 0 false drops)</span>
              <!-- Repeat for infinite marquee effect -->
              <span class="chip chip-throttled" style="font-size: 0.82rem;">VOLUMETRIC HTTP FLOOD (80 req/s burst mitigated in 85 ms)</span>
              <span class="chip chip-monitored" style="font-size: 0.82rem;">LOW-AND-SLOW WEBSCRAPERS (Zero-variance interval isolated)</span>
              <span class="chip chip-blocked" style="font-size: 0.82rem;">DISTRIBUTED CREDENTIAL STUFFING (401 error storms dropped via 403)</span>
              <span class="chip chip-clean" style="font-size: 0.82rem;">LEGITIMATE FLASH CROWD RESILIENCE (50 req/s surge with 0 false drops)</span>
            </div>
          </div>
        </section>

        <!-- Problem vs Solution Matrix -->
        <section class="reveal delay3" style="margin-bottom: 60px;">
          <div style="text-align: center; max-width: 720px; margin: 0 auto 36px auto;">
            <h2 style="font-size: 1.8rem; margin-bottom: 10px;">Why Existing Ingress Defenses Fail</h2>
            <p style="font-size: 0.95rem; color: var(--text-muted);">
              A comparative breakdown between legacy deterministic firewalls, synchronous ML proxies, and IntelliShield.
            </p>
          </div>

          <div class="matrix-grid">
            <!-- Legacy Static WAF -->
            <div class="glass-panel matrix-card tilt glow-track" data-tilt="6">
              <div style="font-size: 0.75rem; font-weight: 700; color: var(--tier-throttled); text-transform: uppercase;">
                TRADITIONAL STATIC WAF
              </div>
              <h3 style="font-size: 1.25rem;">Deterministic RegEx (ModSecurity)</h3>
              <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.6;">
                Relies on static regular expression signatures. Incapable of detecting behavioral zero-day scrapers and causes high false-positive rates by enforcing rigid binary blocking during traffic spikes.
              </p>
              <div style="margin-top: auto; padding-top: 16px; border-top: 1px solid var(--border-subtle); font-size: 0.8rem; color: var(--text-muted);">
                Latency: <strong>12.4 ms</strong> &bull; Throughput: <strong>14,800 req/s</strong> &bull; Memory: Unsafe (C++)
              </div>
            </div>

            <!-- Synchronous ML Proxy -->
            <div class="glass-panel matrix-card tilt glow-track" data-tilt="6">
              <div style="font-size: 0.75rem; font-weight: 700; color: var(--tier-blocked); text-transform: uppercase;">
                SYNCHRONOUS ML PROXY
              </div>
              <h3 style="font-size: 1.25rem;">In-Line ML Intrusion Detection</h3>
              <p style="font-size: 0.85rem; color: var(--text-secondary); line-height: 1.6;">
                Evaluates complex neural network or tree vectors inline before returning an HTTP response. Adds 10 to 50 ms of artificial latency to every legitimate request, crippling high-concurrency microservices.
              </p>
              <div style="margin-top: auto; padding-top: 16px; border-top: 1px solid var(--border-subtle); font-size: 0.8rem; color: var(--text-muted);">
                Latency: <strong>28.6 ms</strong> &bull; Throughput: <strong>3,450 req/s</strong> &bull; Memory: GC Pauses
              </div>
            </div>

            <!-- IntelliShield -->
            <div class="glass-panel matrix-card featured tilt glow-track" data-tilt="8">
              <div style="font-size: 0.75rem; font-weight: 700; color: var(--primary-cyan); text-transform: uppercase;">
                INTELLISHIELD (PROPOSED)
              </div>
              <h3 style="font-size: 1.25rem; color: var(--text-primary);">Decoupled Asynchronous Defense</h3>
              <p style="font-size: 0.85rem; color: var(--text-primary); line-height: 1.6;">
                Fast-path network forwarding in memory-safe Rust (<0.05 ms token check) completely decoupled from background Unsupervised Isolation Forest threat scoring and dynamic quadratic rate-limiting.
              </p>
              <div style="margin-top: auto; padding-top: 16px; border-top: 1px solid var(--border-strong); font-size: 0.8rem; color: var(--primary-cyan); font-weight: 600;">
                Latency: <strong>0.85 ms</strong> &bull; Throughput: <strong>88,740 req/s</strong> &bull; Memory: Safe (Rust)
              </div>
            </div>
          </div>
        </section>
      </div>
    `;
  }

  attachEvents() {
    // Mouse parallax on hero emblem
    const stage = this.container.querySelector('#heroEmblemStage');
    const core = this.container.querySelector('#heroEmblemCore');

    if (stage && core && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      window.addEventListener('mousemove', (e) => {
        if (window.scrollY > window.innerHeight) return;
        const cx = (e.clientX / window.innerWidth - 0.5) * 16;
        const cy = (e.clientY / window.innerHeight - 0.5) * 14;
        core.style.transform = `rotateY(${cx}deg) rotateX(${-cy}deg) translateZ(24px)`;
      }, { passive: true });
    }
  }
}
