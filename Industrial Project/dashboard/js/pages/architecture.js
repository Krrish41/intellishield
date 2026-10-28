/**
 * IntelliShield Architecture & Topology Page Component (#/architecture)
 * Interactive topology, 6-step request lifecycle stepper, 33x sync vs async comparison,
 * and repository codebase tree explorer.
 */

import { TopologyCanvas } from '../components/topology.js';
import { Icons } from '../components/icons.js';
import { DrawerManager } from '../components/modal.js';

export class ArchitecturePage {
  constructor() {
    this.container = null;
    this.topology = null;
    this.currentStep = 1;
    this.stepperInterval = null;
    this.isStepperPlaying = false;
    this.compareMode = 'intellishield'; // 'sync' or 'intellishield'
  }

  mount(container) {
    this.container = container;
    this.render();
    this.initTopology();
    this.attachEvents();
  }

  unmount() {
    if (this.topology) {
      this.topology.stop();
      this.topology = null;
    }
    if (this._nodeSelectHandler) {
      window.removeEventListener('topology-node-selected', this._nodeSelectHandler);
      this._nodeSelectHandler = null;
    }
    if (this.stepperInterval) {
      clearInterval(this.stepperInterval);
    }
    if (this.blueprintEscHandler) {
      window.removeEventListener('keydown', this.blueprintEscHandler);
      this.blueprintEscHandler = null;
    }
  }

  render() {
    this.container.innerHTML = `
      <div class="page-view active">
        <!-- Header -->
        <div class="page-header reveal">
          <div class="page-header-title">
            <h2>Microservice Topology & Decoupled Architecture</h2>
            <p>Decoupling wire-speed network forwarding (Rust Axum) from asynchronous machine learning threat scoring.</p>
          </div>
          <div class="page-actions">
            <button class="topo-layer-toggle active" id="btnToggleDataLayer"
                    data-tooltip-title="Toggle Fast Forwarding Data Path"
                    data-tooltip-desc="Highlights zero-copy packet flow from Client through Ingress Gateway to Upstream Origin."
                    data-tooltip-action="Click to toggle data path highlight">
              <span class="topo-layer-dot dot-data"></span>
              ${Icons.activity(14)}
              <span>Data Path</span>
            </button>
            <button class="topo-layer-toggle active" id="btnToggleTelemetryLayer"
                    data-tooltip-title="Toggle Asynchronous Telemetry Queue"
                    data-tooltip-desc="Highlights sliding-window event ring buffer extracting 8D behavioral telemetry vectors."
                    data-tooltip-action="Click to toggle telemetry queue highlight">
              <span class="topo-layer-dot dot-telemetry"></span>
              ${Icons.terminal(14)}
              <span>Telemetry Queue</span>
            </button>
            <button class="topo-layer-toggle active" id="btnToggleControlLayer"
                    data-tooltip-title="Toggle Dynamic Score Feedback Loop"
                    data-tooltip-desc="Highlights background threat score feedback adjusting client token bucket capacity and refill rate."
                    data-tooltip-action="Click to toggle control loop highlight">
              <span class="topo-layer-dot dot-control"></span>
              ${Icons.zap(14)}
              <span>Score Feedback</span>
            </button>
          </div>
        </div>

        <!-- Interactive Topology Diagram Stage -->
        <div class="topology-wrapper reveal delay1">
          <!-- Live Interactive Control Bar -->
          <div class="topology-controls-bar">
            <!-- Simulated Request Packet Launchers -->
            <div class="topo-sim-section">
              <span class="topo-sim-label">
                <span class="topo-sim-pulse"></span>
                <span>Send Request:</span>
              </span>
              <div class="topo-sim-btns">
                <button class="topo-sim-btn topo-sim-btn-clean" id="btnSendClean"
                        data-tooltip-title="Send Clean Packet (200 OK)"
                        data-tooltip-desc="Simulates legitimate user request. Forwarded directly via sub-millisecond fast-path (0.82ms latency)."
                        data-tooltip-action="Click to simulate clean packet traversal"
                        data-tooltip-badge="PACKET PROBE"
                        data-tooltip-tier="clean">
                  <span class="topo-btn-icon">${Icons.play(13)}</span>
                  <span class="topo-btn-name">Clean</span>
                  <span class="topo-btn-badge">200 OK</span>
                </button>
                <button class="topo-sim-btn topo-sim-btn-monitored" id="btnSendMonitored"
                        data-tooltip-title="Send Monitored Packet (200 OK)"
                        data-tooltip-desc="Simulates client with borderline anomaly score (0.55). Forwarded with zero latency penalty while background inference runs."
                        data-tooltip-action="Click to simulate monitored packet traversal"
                        data-tooltip-badge="PACKET PROBE"
                        data-tooltip-tier="monitored">
                  <span class="topo-btn-icon">${Icons.play(13)}</span>
                  <span class="topo-btn-name">Monitored</span>
                  <span class="topo-btn-badge">200 MON</span>
                </button>
                <button class="topo-sim-btn topo-sim-btn-throttled" id="btnSendThrottled"
                        data-tooltip-title="Send Throttled Packet (429 Too Many Requests)"
                        data-tooltip-desc="Simulates burst client with exhausted token bucket. Intercepted in fast-path (0.04ms) without hitting origin backend."
                        data-tooltip-action="Click to simulate token bucket throttle rejection"
                        data-tooltip-badge="PACKET PROBE"
                        data-tooltip-tier="throttled">
                  <span class="topo-btn-icon">${Icons.play(13)}</span>
                  <span class="topo-btn-name">Throttled</span>
                  <span class="topo-btn-badge">429 RATE</span>
                </button>
                <button class="topo-sim-btn topo-sim-btn-blocked" id="btnSendBlocked"
                        data-tooltip-title="Send Malicious Blocked Packet (403 Forbidden)"
                        data-tooltip-desc="Simulates isolated attacker IP (score > 0.85). Immediate edge rejection in 0.04ms with zero memory allocation."
                        data-tooltip-action="Click to simulate edge threat drop"
                        data-tooltip-badge="PACKET PROBE"
                        data-tooltip-tier="blocked">
                  <span class="topo-btn-icon">${Icons.play(13)}</span>
                  <span class="topo-btn-name">Blocked</span>
                  <span class="topo-btn-badge">403 DROP</span>
                </button>
              </div>
            </div>

            <!-- Simulation Speed Selector & Latency Readout -->
            <div class="topo-meta-section">
              <div class="topo-speed-control">
                <span class="topo-speed-label">Speed:</span>
                <div class="topo-speed-pills" id="topoSpeedPills">
                  <button class="topo-speed-pill" data-speed="1.0" title="Normal Wire Speed">1.0x</button>
                  <button class="topo-speed-pill active" data-speed="0.5" title="Slow for Inspection">0.5x Slow</button>
                  <button class="topo-speed-pill" data-speed="0.25" title="Cinematic Slow Motion">0.25x Slow-Mo</button>
                </div>
              </div>

              <!-- Latency Counter Readout -->
              <div class="topo-latency-box">
                <span class="topo-latency-label">Latency:</span>
                <strong id="simLatencyReadout" class="topo-latency-val">0.85 ms</strong>
              </div>
            </div>
          </div>

          <!-- Canvas Stage -->
          <div class="topology-canvas-stage">
            <canvas id="topologyCanvas"></canvas>
          </div>

          <!-- Lifecycle Stepper Component -->
          <div class="stepper-panel">
            <div class="stepper-header">
              <div style="display: flex; align-items: center; gap: 8px;">
                <span class="chip chip-clean" id="stepperStepNumber">STEP 1 OF 6</span>
                <strong id="stepperStepTitle" style="font-size: 0.95rem;">Ingress Arrival</strong>
              </div>
              <div style="display: flex; gap: 6px;">
                <button class="btn btn-ghost btn-sm" id="btnStepperPrev">Prev</button>
                <button class="btn btn-secondary btn-sm" id="btnStepperPlay">Play</button>
                <button class="btn btn-ghost btn-sm" id="btnStepperNext">Next</button>
              </div>
            </div>
            <p class="stepper-text" id="stepperStepNarrative">
              A client sends an HTTP request to the edge reverse proxy on port 8080.
            </p>
          </div>
        </div>

        <!-- Architectural Blueprints & Engineering Diagrams (Prominently Sized with Hover Zoom) -->
        <div class="glass-panel reveal delay1" style="padding: 24px; margin-bottom: 32px;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 16px; flex-wrap: wrap; gap: 10px;">
            <div>
              <h3 style="font-size: 1.15rem;">Engineering Blueprints & Data Flow Architecture</h3>
              <p style="font-size: 0.8rem; color: var(--text-muted);">
                High-resolution microservice topology and lock-free telemetry pipeline specifications.
              </p>
            </div>
            <span class="chip chip-clean">Full Resolution Vector-Grade</span>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(360px, 1fr)); gap: 24px;">
            <!-- System Architecture Diagram Card -->
            <div class="glass-panel arch-img-card blueprint-card-trigger" 
                 data-src="./assets/system_architecture.png" 
                 data-title="Fig. 1: End-to-End System Architecture (Wire-Speed Fast-Path)">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <strong style="font-size: 0.9rem; color: var(--primary-cyan);">Fig. 1: End-to-End System Architecture</strong>
                <span class="badge badge-clean">Click to Enlarge &amp; Zoom</span>
              </div>
              <div class="arch-img-wrapper">
                <img src="./assets/system_architecture.png" alt="IntelliShield End-to-End System Architecture" 
                     class="img-zoomable" style="width: 100%; height: auto; display: block; object-fit: contain;">
                <div class="arch-enlarge-badge">
                  ${Icons.search(12)} Click to Enlarge
                </div>
              </div>
              <p class="arch-card-desc">
                Decoupled ingress proxy (Rust Tokio, Axum) forwarding zero-copy byte buffers to backend on port 3000, emitting lock-free telemetry to port 5001.
              </p>
            </div>

            <!-- Data Flow Diagram Card -->
            <div class="glass-panel arch-img-card blueprint-card-trigger" 
                 data-src="./assets/data_flow_diagram.png" 
                 data-title="Fig. 2: Telemetry &amp; Mitigation Data Flow (Sliding-Window 5.0s Pipeline)">
              <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
                <strong style="font-size: 0.9rem; color: var(--tier-monitored);">Fig. 2: Telemetry &amp; Mitigation Data Flow</strong>
                <span class="badge badge-monitored">Click to Enlarge &amp; Zoom</span>
              </div>
              <div class="arch-img-wrapper">
                <img src="./assets/data_flow_diagram.png" alt="IntelliShield Data Flow and Threat Scoring Diagram" 
                     class="img-zoomable" style="width: 100%; height: auto; display: block; object-fit: contain;">
                <div class="arch-enlarge-badge arch-enlarge-badge-monitored">
                  ${Icons.search(12)} Click to Enlarge
                </div>
              </div>
              <p class="arch-card-desc">
                Asynchronous feature extraction pipeline converting raw TCP telemetry into 8D behavioral matrices evaluated against tree estimators.
              </p>
            </div>
          </div>
        </div>

        <!-- 33x Latency Comparison Section -->
        <div class="glass-panel reveal delay2" style="padding: 24px; margin-bottom: 32px;">
          <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 16px; margin-bottom: 20px;">
            <div>
              <h3 style="font-size: 1.15rem;">Architecture Latency Benchmark: Synchronous vs IntelliShield</h3>
              <p style="font-size: 0.82rem; color: var(--text-muted);">
                Demonstrating why synchronous ML evaluation degrades user experience by 33x.
              </p>
            </div>
            <div style="display: flex; gap: 8px;">
              <button class="btn btn-secondary btn-sm" id="btnCompareSync">Synchronous ML Proxy (28.6 ms)</button>
              <button class="btn btn-primary btn-sm" id="btnCompareAsync">IntelliShield (0.85 ms)</button>
            </div>
          </div>

          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px;">
            <!-- Synchronous Architecture Card -->
            <div id="cardSyncArch" class="glass-panel" style="padding: 20px; border-left: 4px solid var(--tier-throttled); opacity: 0.7;">
              <div style="font-size: 0.8rem; font-weight: 700; color: var(--tier-throttled); margin-bottom: 6px;">
                LEGACY SYNCHRONOUS ML PROXY
              </div>
              <div style="font-size: 2.2rem; font-family: var(--font-heading); font-weight: 800; color: var(--tier-throttled); margin-bottom: 8px;">
                28.60 ms <span style="font-size: 0.9rem; font-weight: 500; color: var(--text-muted);">P50 Latency</span>
              </div>
              <p style="font-size: 0.82rem; line-height: 1.5; color: var(--text-secondary);">
                Every incoming HTTP request blocks until feature extraction and Isolation Forest inference complete. Peak throughput saturates at <strong>3,450 req/s</strong> with 98% CPU load.
              </p>
            </div>

            <!-- IntelliShield Decoupled Architecture Card -->
            <div id="cardAsyncArch" class="glass-panel" style="padding: 20px; border-left: 4px solid var(--primary-cyan); box-shadow: var(--shadow-glow);">
              <div style="font-size: 0.8rem; font-weight: 700; color: var(--primary-cyan); margin-bottom: 6px;">
                INTELLISHIELD ASYNCHRONOUS CORE
              </div>
              <div style="font-size: 2.2rem; font-family: var(--font-heading); font-weight: 800; color: var(--primary-cyan); margin-bottom: 8px;">
                0.85 ms <span style="font-size: 0.9rem; font-weight: 500; color: var(--text-muted);">P50 Latency (33x Faster)</span>
              </div>
              <p style="font-size: 0.82rem; line-height: 1.5; color: var(--text-secondary);">
                Atomic in-memory token check (<0.05 ms) fast-forwards valid requests to port 3000. Telemetry emits non-blocking events to background worker. Peak throughput reaches <strong>88,740 req/s</strong>.
              </p>
            </div>
          </div>
        </div>

        <!-- Project Repository Explorer & Tech Stack -->
        <div style="display: grid; grid-template-columns: 1fr; gap: 24px; margin-bottom: 32px;" class="reveal delay3">
          <!-- Codebase File Tree -->
          <div class="glass-panel" style="padding: 24px;">
            <div style="display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px;">
              <div>
                <h3 style="font-size: 1.1rem;">Codebase & Project Architecture Explorer</h3>
                <p style="font-size: 0.78rem; color: var(--text-muted);">Standard repo layout per section 9 of PROJECT_INFO.md</p>
              </div>
            </div>

            <div style="font-family: var(--font-mono); font-size: 0.82rem; display: flex; flex-direction: column; gap: 8px;">
              <div style="color: var(--primary-cyan); font-weight: 700;">Industrial Project/</div>
              
              <div style="padding-left: 16px; border-left: 1px solid var(--border-medium); margin-left: 6px; display: flex; flex-direction: column; gap: 8px;">
                <div>
                  <strong class="code-tree-file">run_intellishield.py</strong>
                  <span class="code-tree-desc"> &mdash; Unified launcher (--start for daemon, --demo for live simulation)</span>
                </div>

                <div>
                  <strong style="color: var(--tier-monitored);">core/</strong> (Rust Axum & Tokio Core)
                  <div style="padding-left: 16px; margin-top: 4px; display: flex; flex-direction: column; gap: 4px; color: var(--text-secondary);">
                    <div>&bull; <strong>main.rs</strong> &mdash; Ingress bind :8080, Tokio background tasks, Axum router</div>
                    <div>&bull; <strong>proxy.rs</strong> &mdash; Fast-path zero-copy forwarding & lock-free telemetry queue</div>
                    <div>&bull; <strong>telemetry.rs</strong> &mdash; 5.0-second rolling sliding window and 8D feature extraction</div>
                    <div>&bull; <strong>mitigation.rs</strong> &mdash; Atomic dynamic token bucket and quadratic rate limiter</div>
                    <div>&bull; <strong>ml_client.rs</strong> &mdash; Non-blocking HTTP client posting telemetry batches to port 5001</div>
                  </div>
                </div>

                <div>
                  <strong style="color: var(--tier-clean);">proxy_engine/</strong> (Python Reverse Proxy & Console)
                  <div style="padding-left: 16px; margin-top: 4px; display: flex; flex-direction: column; gap: 4px; color: var(--text-secondary);">
                    <div>&bull; <strong>proxy_gateway.py</strong> &mdash; Reverse proxy, token bucket, and telemetry collector</div>
                    <div>&bull; <strong>dashboard_html.py</strong> &mdash; Web console server & asset bridge</div>
                  </div>
                </div>

                <div>
                  <strong style="color: var(--primary-indigo);">ml_engine/</strong> (Machine Learning Microservice)
                  <div style="padding-left: 16px; margin-top: 4px; display: flex; flex-direction: column; gap: 4px; color: var(--text-secondary);">
                    <div>&bull; <strong>ml_worker_server.py</strong> &mdash; REST worker on port 5001 (/score_batch)</div>
                    <div>&bull; <strong>isolation_forest_engine.py</strong> &mdash; Scikit-learn model inference and safety boosters</div>
                  </div>
                </div>

                <div>
                  <strong class="code-tree-dir-backend">mock_backend/</strong> (Protected Upstream)
                  <div style="padding-left: 16px; margin-top: 4px; display: flex; flex-direction: column; gap: 4px; color: var(--text-secondary);">
                    <div>&bull; <strong>server.py</strong> &mdash; Protected REST API on port 3000 (/users, /products, /auth/login)</div>
                  </div>
                </div>

                <div>
                  <strong class="code-tree-dir-simulator">simulator/</strong> (Attack Simulation Suite)
                  <div style="padding-left: 16px; margin-top: 4px; display: flex; flex-direction: column; gap: 4px; color: var(--text-secondary);">
                    <div>&bull; <strong>live_demo.py</strong> &mdash; Automated 4-phase attack validation demo</div>
                    <div>&bull; <strong>traffic_generator.py</strong> &mdash; Benign, flood, scraping, credential stuffing generators</div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>

        <!-- Node Detail Side Drawer -->
        <aside id="nodeDetailDrawer" class="drawer" role="dialog" aria-modal="true" aria-label="Component Topology Detail">
          <div class="drawer-header">
            <div style="display: flex; align-items: center; gap: 8px;">
              ${Icons.cpu(20)}
              <h3 style="font-size: 1.1rem; margin: 0;" id="drawerNodeTitle">Component Detail</h3>
            </div>
            <button class="drawer-close" id="closeNodeDrawerBtn">${Icons.cross(18)}</button>
          </div>
          <div id="drawerNodeBody" style="display: flex; flex-direction: column; gap: 16px;"></div>
        </aside>

        <!-- Engineering Blueprint Enlargement & Interactive Zoom/Pan Modal -->
        <div id="blueprintModal" class="blueprint-modal-backdrop" role="dialog" aria-modal="true" aria-label="High-Resolution Blueprint Viewer">
          <div class="blueprint-modal-card">
            <div class="blueprint-modal-header">
              <div class="blueprint-header-left">
                <span class="badge badge-clean">HIGH-RESOLUTION BLUEPRINT</span>
                <h4 id="blueprintModalHeading" class="blueprint-modal-title"></h4>
              </div>
              <div class="blueprint-header-controls">
                <span id="blueprintZoomHint" class="blueprint-zoom-hint">
                  Click point to zoom &bull; Drag to pan &bull; Scroll wheel
                </span>
                <div class="blueprint-zoom-toolbar">
                  <button type="button" id="blueprintZoomIn" class="btn-zoom-tool" title="Zoom In (+)" aria-label="Zoom In">
                    ${Icons.plus(14)}
                  </button>
                  <button type="button" id="blueprintZoomOut" class="btn-zoom-tool" title="Zoom Out (-)" aria-label="Zoom Out">
                    ${Icons.minus(14)}
                  </button>
                  <button type="button" id="blueprintZoomReset" class="btn-zoom-tool btn-zoom-reset" title="Reset Zoom (100%)">
                    100%
                  </button>
                </div>
                <div class="blueprint-header-divider"></div>
                <button type="button" id="blueprintModalClose" class="blueprint-modal-close-btn" aria-label="Close modal" title="Close Blueprint (Esc)">
                  ${Icons.cross(16)}
                </button>
              </div>
            </div>
            <div class="blueprint-modal-body">
              <div class="blueprint-viewport" id="blueprintViewport">
                <img id="blueprintModalImg" src="" alt="Enlarged Engineering Blueprint" class="blueprint-zoomable-img" draggable="false">
              </div>
            </div>
          </div>
        </div>
      </div>
    `;
  }

  initTopology() {
    const canvas = this.container.querySelector('#topologyCanvas');
    if (!canvas) return;
    this.topology = new TopologyCanvas(canvas);
    this._nodeSelectHandler = (e) => {
      this.openNodeDrawer(e.detail.node);
    };
    window.addEventListener('topology-node-selected', this._nodeSelectHandler);
  }

  attachEvents() {
    // Helper to give instant visual tactile feedback
    const triggerBtnFeedback = (btn) => {
      if (!btn) return;
      btn.classList.add('btn-pressed');
      setTimeout(() => {
        btn.classList.remove('btn-pressed');
      }, 220);
    };

    // Speed control selector (1.0x, 0.5x, 0.25x)
    const speedPills = this.container.querySelectorAll('.topo-speed-pill');
    speedPills.forEach(pill => {
      pill.addEventListener('click', (e) => {
        speedPills.forEach(p => p.classList.remove('active'));
        e.currentTarget.classList.add('active');
        const speed = parseFloat(e.currentTarget.getAttribute('data-speed')) || 0.5;
        this.topology?.setSpeedMultiplier(speed);
      });
    });

    const updateSimulationNarrative = (stepNum, title, text, chipClass = 'chip-clean') => {
      const stepNumEl = this.container.querySelector('#stepperStepNumber');
      const stepTitleEl = this.container.querySelector('#stepperStepTitle');
      const stepNarrativeEl = this.container.querySelector('#stepperStepNarrative');
      if (stepNumEl) {
        stepNumEl.textContent = stepNum;
        stepNumEl.className = `chip ${chipClass}`;
      }
      if (stepTitleEl) stepTitleEl.textContent = title;
      if (stepNarrativeEl) stepNarrativeEl.textContent = text;
    };

    const handleSend = (btn, tier, latency, stepNum, title, text, chipClass = 'chip-clean') => {
      triggerBtnFeedback(btn);
      if (!this.topology) {
        const canvas = this.container.querySelector('#topologyCanvas');
        if (canvas) this.topology = new TopologyCanvas(canvas);
      }
      this.topology?.sendSimulatedPacket(tier);
      this.setLatencyReadout(latency);
      updateSimulationNarrative(stepNum, title, text, chipClass);
    };

    // Simulated request buttons with prominent packet dispatch
    this.container.querySelector('#btnSendClean')?.addEventListener('click', (e) => {
      handleSend(
        e.currentTarget,
        'Clean',
        0.82,
        'FAST-PATH 200 OK',
        'Clean Request Wire-Speed Forwarding',
        'Legitimate HTTP request evaluated by token bucket in 0.04 ms. Forwarded zero-copy to origin backend on port 3000 with sub-millisecond roundtrip (0.82 ms).'
      );
    });
    this.container.querySelector('#btnSendMonitored')?.addEventListener('click', (e) => {
      handleSend(
        e.currentTarget,
        'Monitored',
        0.85,
        'MONITORED 200 OK',
        'Zero-Latency Forward + Async 8D Telemetry Vector',
        'Borderline session (anomaly score 0.55). The fast-path forwards immediately to upstream while the lock-free queue emits 8D behavioral telemetry to ML Worker port 5001.'
      );
    });
    this.container.querySelector('#btnSendThrottled')?.addEventListener('click', (e) => {
      handleSend(
        e.currentTarget,
        'Throttled',
        0.04,
        'THROTTLED 429',
        'Token Bucket Depletion & Rate Throttling',
        'Burst request velocity exceeds burst allowance. The edge proxy dynamic token bucket rejects the packet in 0.04 ms with HTTP 429 Too Many Requests, isolating backend origin.',
        'chip-throttled'
      );
    });
    this.container.querySelector('#btnSendBlocked')?.addEventListener('click', (e) => {
      handleSend(
        e.currentTarget,
        'Blocked',
        0.04,
        'BLOCKED 403',
        'Edge Threat Interception & IP Isolation',
        'ML Anomaly Worker identified threat score > 0.85 (Credential Stuffing). Incoming packet dropped at the reverse proxy gateway in 0.04 ms with HTTP 403 Forbidden with zero backend overhead.',
        'chip-blocked'
      );
    });

    // Blueprint Enlargement Modal handlers with Cursor-Point Zoom & Pan
    const blueprintModal = this.container.querySelector('#blueprintModal');
    const blueprintViewport = this.container.querySelector('#blueprintViewport');
    const blueprintImg = this.container.querySelector('#blueprintModalImg');
    const blueprintHeading = this.container.querySelector('#blueprintModalHeading');
    const blueprintHint = this.container.querySelector('#blueprintZoomHint');
    const blueprintCloseBtn = this.container.querySelector('#blueprintModalClose');
    const zoomInBtn = this.container.querySelector('#blueprintZoomIn');
    const zoomOutBtn = this.container.querySelector('#blueprintZoomOut');
    const zoomResetBtn = this.container.querySelector('#blueprintZoomReset');

    let currentScale = 1.0;
    let panX = 0;
    let panY = 0;
    let originX = 50; // percentage
    let originY = 50; // percentage
    let isDragging = false;
    let dragStartX = 0;
    let dragStartY = 0;
    let startPanX = 0;
    let startPanY = 0;
    let movedDistance = 0;

    const clampPan = (px, py, scale) => {
      if (scale <= 1.02) return { x: 0, y: 0 };
      const vp = blueprintViewport ? blueprintViewport.getBoundingClientRect() : { width: 800, height: 600 };
      // Allow panning strictly within the scaled overflow range so image can never escape viewport
      const maxRangeX = Math.max(30, (vp.width * (scale - 1)) / 2 + 40);
      const maxRangeY = Math.max(30, (vp.height * (scale - 1)) / 2 + 40);

      return {
        x: Math.max(-maxRangeX, Math.min(maxRangeX, px)),
        y: Math.max(-maxRangeY, Math.min(maxRangeY, py))
      };
    };

    const applyTransform = (smooth = true) => {
      if (!blueprintImg) return;
      if (smooth) {
        blueprintImg.style.transition = 'transform 0.22s cubic-bezier(0.16, 1, 0.3, 1)';
      } else {
        blueprintImg.style.transition = 'none';
      }
      blueprintImg.style.transformOrigin = `${originX}% ${originY}%`;
      blueprintImg.style.transform = `translate3d(${panX}px, ${panY}px, 0) scale(${currentScale})`;

      if (currentScale > 1.02) {
        blueprintImg.classList.add('is-zoomed');
        blueprintViewport?.classList.add('can-pan');
        if (blueprintHint) {
          blueprintHint.textContent = `Zoom: ${Math.round(currentScale * 100)}% \u2022 Drag to Pan \u2022 Click to Reset`;
        }
      } else {
        blueprintImg.classList.remove('is-zoomed');
        blueprintViewport?.classList.remove('can-pan');
        if (blueprintHint) {
          blueprintHint.textContent = 'Click point to zoom \u2022 Drag to pan \u2022 Scroll wheel';
        }
      }
    };

    const resetZoomAndPan = () => {
      currentScale = 1.0;
      panX = 0;
      panY = 0;
      originX = 50;
      originY = 50;
      applyTransform(true);
    };

    const openBlueprintModal = (src, title) => {
      if (!blueprintModal || !blueprintImg) return;
      blueprintImg.src = src;
      resetZoomAndPan();
      if (blueprintHeading) blueprintHeading.textContent = title;
      blueprintModal.classList.add('open');
    };

    const closeBlueprintModal = () => {
      if (!blueprintModal || !blueprintImg) return;
      blueprintModal.classList.remove('open');
      resetZoomAndPan();
    };

    // Zoom buttons
    zoomInBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      currentScale = Math.min(currentScale + 0.5, 4.0);
      const clamped = clampPan(panX, panY, currentScale);
      panX = clamped.x;
      panY = clamped.y;
      applyTransform(true);
    });

    zoomOutBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      currentScale = Math.max(currentScale - 0.5, 1.0);
      if (currentScale <= 1.02) {
        panX = 0;
        panY = 0;
      } else {
        const clamped = clampPan(panX, panY, currentScale);
        panX = clamped.x;
        panY = clamped.y;
      }
      applyTransform(true);
    });

    zoomResetBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      resetZoomAndPan();
    });

    // Pointer-based Pan and Click-to-Point-Zoom
    if (blueprintViewport && blueprintImg) {
      blueprintViewport.addEventListener('pointerdown', (e) => {
        // Only primary mouse button or touch
        if (e.button !== 0 && e.pointerType === 'mouse') return;
        isDragging = true;
        dragStartX = e.clientX;
        dragStartY = e.clientY;
        startPanX = panX;
        startPanY = panY;
        movedDistance = 0;
        blueprintViewport.classList.add('is-dragging');
        blueprintImg.classList.add('is-dragging');
        try {
          blueprintViewport.setPointerCapture(e.pointerId);
        } catch (_) {}
      });

      blueprintViewport.addEventListener('pointermove', (e) => {
        if (!isDragging) return;
        const dx = e.clientX - dragStartX;
        const dy = e.clientY - dragStartY;
        movedDistance = Math.hypot(dx, dy);

        if (currentScale > 1.02) {
          // Pan actively with strict boundary clamping
          const clamped = clampPan(startPanX + dx, startPanY + dy, currentScale);
          panX = clamped.x;
          panY = clamped.y;
          applyTransform(false); // Instant response, zero lag
        }
      });

      const endDrag = (e) => {
        if (!isDragging) return;
        isDragging = false;
        blueprintViewport.classList.remove('is-dragging');
        blueprintImg.classList.remove('is-dragging');
        try {
          blueprintViewport.releasePointerCapture(e.pointerId);
        } catch (_) {}

        // If pointer barely moved (< 6px), treat as a click!
        if (movedDistance < 6) {
          if (currentScale <= 1.05) {
            // Zoom into the EXACT clicked point!
            const rect = blueprintImg.getBoundingClientRect();
            const clickX = e.clientX - rect.left;
            const clickY = e.clientY - rect.top;
            originX = Math.max(0, Math.min(100, (clickX / (rect.width || 1)) * 100));
            originY = Math.max(0, Math.min(100, (clickY / (rect.height || 1)) * 100));
            currentScale = 2.4;
            panX = 0;
            panY = 0;
            applyTransform(true);
          } else {
            // Already zoomed: toggle back to 1x
            resetZoomAndPan();
          }
        } else {
          // Finished dragging, re-enable smooth transitions and clamp
          const clamped = clampPan(panX, panY, currentScale);
          panX = clamped.x;
          panY = clamped.y;
          applyTransform(true);
        }
      };

      blueprintViewport.addEventListener('pointerup', endDrag);
      blueprintViewport.addEventListener('pointercancel', endDrag);

      // Mouse wheel zoom
      blueprintViewport.addEventListener('wheel', (e) => {
        e.preventDefault();
        const delta = e.deltaY < 0 ? 0.35 : -0.35;
        const prevScale = currentScale;
        currentScale = Math.max(1.0, Math.min(4.5, currentScale + delta));

        if (prevScale === 1.0 && currentScale > 1.0) {
          // Center origin on cursor if zooming from 1x
          const rect = blueprintImg.getBoundingClientRect();
          const clickX = e.clientX - rect.left;
          const clickY = e.clientY - rect.top;
          originX = Math.max(0, Math.min(100, (clickX / (rect.width || 1)) * 100));
          originY = Math.max(0, Math.min(100, (clickY / (rect.height || 1)) * 100));
        }

        if (currentScale <= 1.02) {
          panX = 0;
          panY = 0;
        } else {
          const clamped = clampPan(panX, panY, currentScale);
          panX = clamped.x;
          panY = clamped.y;
        }
        applyTransform(true);
      }, { passive: false });
    }

    // Open when clicking any blueprint card
    this.container.querySelectorAll('.blueprint-card-trigger').forEach(card => {
      card.addEventListener('click', () => {
        const src = card.getAttribute('data-src') || card.querySelector('img')?.getAttribute('src');
        const title = card.getAttribute('data-title') || 'Engineering Blueprint';
        openBlueprintModal(src, title);
      });
    });

    // Close button click
    blueprintCloseBtn?.addEventListener('click', (e) => {
      e.stopPropagation();
      closeBlueprintModal();
    });

    // Close when clicking backdrop outside card
    blueprintModal?.addEventListener('click', (e) => {
      if (e.target === blueprintModal) {
        closeBlueprintModal();
      }
    });

    // Escape key closes modal
    this.blueprintEscHandler = (e) => {
      if (e.key === 'Escape' && blueprintModal?.classList.contains('open')) {
        closeBlueprintModal();
      }
    };
    window.addEventListener('keydown', this.blueprintEscHandler);

    // Layer visibility toggles
    this.container.querySelector('#btnToggleDataLayer')?.addEventListener('click', (e) => {
      if (!this.topology) return;
      this.topology.showDataPath = !this.topology.showDataPath;
      e.currentTarget.classList.toggle('active', this.topology.showDataPath);
      this.topology.updateStatusBanner?.(
        `DATA PATH LAYER: ${this.topology.showDataPath ? 'ENABLED (Fast-Path Active)' : 'MUTED'}`,
        'clean'
      );
    });
    this.container.querySelector('#btnToggleTelemetryLayer')?.addEventListener('click', (e) => {
      if (!this.topology) return;
      this.topology.showTelemetryPath = !this.topology.showTelemetryPath;
      e.currentTarget.classList.toggle('active', this.topology.showTelemetryPath);
      this.topology.updateStatusBanner?.(
        `TELEMETRY QUEUE: ${this.topology.showTelemetryPath ? 'ENABLED (8D Buffer Active)' : 'MUTED'}`,
        'clean'
      );
    });
    this.container.querySelector('#btnToggleControlLayer')?.addEventListener('click', (e) => {
      if (!this.topology) return;
      this.topology.showControlPath = !this.topology.showControlPath;
      e.currentTarget.classList.toggle('active', this.topology.showControlPath);
      this.topology.updateStatusBanner?.(
        `SCORE FEEDBACK LOOP: ${this.topology.showControlPath ? 'ENABLED (Dynamic Rate Limiting Active)' : 'MUTED'}`,
        'clean'
      );
    });

    // Lifecycle Stepper controls
    this.container.querySelector('#btnStepperNext')?.addEventListener('click', () => {
      this.stepForward();
    });
    this.container.querySelector('#btnStepperPrev')?.addEventListener('click', () => {
      this.stepBackward();
    });
    this.container.querySelector('#btnStepperPlay')?.addEventListener('click', (e) => {
      this.toggleStepperPlay(e.currentTarget);
    });

    // Compare toggles
    this.container.querySelector('#btnCompareSync')?.addEventListener('click', () => {
      this.setCompareMode('sync');
    });
    this.container.querySelector('#btnCompareAsync')?.addEventListener('click', () => {
      this.setCompareMode('intellishield');
    });

    // Drawer close
    this.container.querySelector('#closeNodeDrawerBtn')?.addEventListener('click', () => {
      DrawerManager.close('nodeDetailDrawer');
    });
  }

  setLatencyReadout(lat) {
    const el = this.container.querySelector('#simLatencyReadout');
    if (el) el.textContent = `${lat.toFixed(2)} ms`;
  }

  setCompareMode(mode) {
    this.compareMode = mode;
    const syncCard = this.container.querySelector('#cardSyncArch');
    const asyncCard = this.container.querySelector('#cardAsyncArch');
    const syncBtn = this.container.querySelector('#btnCompareSync');
    const asyncBtn = this.container.querySelector('#btnCompareAsync');

    if (mode === 'sync') {
      if (syncCard) { syncCard.style.opacity = '1'; syncCard.style.boxShadow = 'var(--shadow-glow)'; }
      if (asyncCard) { asyncCard.style.opacity = '0.5'; asyncCard.style.boxShadow = 'none'; }
      if (syncBtn) { syncBtn.className = 'btn btn-primary btn-sm'; }
      if (asyncBtn) { asyncBtn.className = 'btn btn-secondary btn-sm'; }
    } else {
      if (syncCard) { syncCard.style.opacity = '0.5'; syncCard.style.boxShadow = 'none'; }
      if (asyncCard) { asyncCard.style.opacity = '1'; asyncCard.style.boxShadow = 'var(--shadow-glow)'; }
      if (syncBtn) { syncBtn.className = 'btn btn-secondary btn-sm'; }
      if (asyncBtn) { asyncBtn.className = 'btn btn-primary btn-sm'; }
    }
  }

  stepForward() {
    this.currentStep = this.currentStep >= 6 ? 1 : this.currentStep + 1;
    this.updateStepperNarrative();
  }

  stepBackward() {
    this.currentStep = this.currentStep <= 1 ? 6 : this.currentStep - 1;
    this.updateStepperNarrative();
  }

  toggleStepperPlay(btn) {
    this.isStepperPlaying = !this.isStepperPlaying;
    if (this.isStepperPlaying) {
      btn.innerHTML = 'Pause';
      this.stepperInterval = setInterval(() => this.stepForward(), 2500);
    } else {
      btn.innerHTML = 'Play';
      if (this.stepperInterval) clearInterval(this.stepperInterval);
    }
  }

  updateStepperNarrative() {
    const narratives = {
      1: { title: "Ingress Arrival", text: "A client initiates an HTTP request to http://localhost:8080/api/.... Port 8080 accepts the connection." },
      2: { title: "Atomic Token Check", text: "Proxy inspects local token bucket in sub-microsecond time (<0.05 ms). If tokens >= 1, decrements and proceeds." },
      3: { title: "Fast Forward or Terminate", text: "If tokens available, proxy forwards to upstream port 3000 (0.85 ms P50). If empty, returns 429. If Blocked, drops with 403." },
      4: { title: "Non-Blocking Telemetry Capture", text: "Request metadata (timestamp, IP, method, URI, status, UA) is cloned and pushed into lock-free channel. Fast-path never waits." },
      5: { title: "Batch Anomaly Inference", text: "Every 1000 ms, the sliding-window engine calculates the 8D behavioral vector per active IP and POSTs the batch to ML worker port 5001." },
      6: { title: "Dynamic Reputation Update", text: "ML worker outputs anomaly score [0.0, 1.0]. Proxy updates token bucket capacity and refill rate via quadratic penalty function." }
    };

    const stepInfo = narratives[this.currentStep];
    const elNum = this.container.querySelector('#stepperStepNumber');
    const elTitle = this.container.querySelector('#stepperStepTitle');
    const elNarrative = this.container.querySelector('#stepperStepNarrative');

    if (elNum) elNum.textContent = `STEP ${this.currentStep} OF 6`;
    if (elTitle) elTitle.textContent = stepInfo.title;
    if (elNarrative) elNarrative.textContent = stepInfo.text;

    if (this.topology) {
      this.topology.setLifecycleStep(this.currentStep);
    }
  }

  openNodeDrawer(node) {
    const titleEl = this.container.querySelector('#drawerNodeTitle');
    const bodyEl = this.container.querySelector('#drawerNodeBody');

    if (titleEl) titleEl.textContent = node.label;
    if (bodyEl) {
      bodyEl.innerHTML = `
        <div class="glass-panel" style="padding: 16px;">
          <div style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700; text-transform: uppercase;">
            COMPONENT OVERVIEW
          </div>
          <div style="font-size: 1rem; font-weight: 700; margin-top: 4px;">${node.label}</div>
          <div style="font-size: 0.85rem; color: var(--primary-cyan); font-family: var(--font-mono);">${node.sub}</div>
          <p style="font-size: 0.85rem; margin-top: 10px; line-height: 1.5; color: var(--text-secondary);">
            ${node.desc}
          </p>
        </div>

        <div class="glass-panel" style="padding: 16px; font-size: 0.85rem;">
          <div style="font-weight: 700; margin-bottom: 8px;">Technical Specification</div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span style="color: var(--text-muted);">Network Port:</span>
            <strong style="font-family: var(--font-mono);">${node.port}</strong>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 6px;">
            <span style="color: var(--text-muted);">Source Files:</span>
            <strong style="font-family: var(--font-mono); color: var(--primary-cyan); font-size: 0.78rem;">${node.file}</strong>
          </div>
          <div style="display: flex; justify-content: space-between;">
            <span style="color: var(--text-muted);">Latency Overhead:</span>
            <strong>${node.id === 'proxy' ? '< 0.05 ms' : (node.id === 'backend' ? '0.80 ms' : 'Async (Non-blocking)')}</strong>
          </div>
        </div>
      `;
    }
    DrawerManager.open('nodeDetailDrawer');
  }
}
