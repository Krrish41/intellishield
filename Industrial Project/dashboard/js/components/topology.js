/**
 * IntelliShield Interactive Architecture Topology Canvas
 * Dual-path animated packet flow: Fast path vs Async telemetry/ML path.
 * Interactive request simulation, step narration, and layer filtering.
 */

import { themeManager } from '../theme.js';

export class TopologyCanvas {
  constructor(canvasId) {
    this.canvas = typeof canvasId === 'string' ? document.getElementById(canvasId) : canvasId;
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    this.dpr = 1;
    this.width = 0;
    this.height = 0;

    // Layer visibility toggles
    this.showDataPath = true;
    this.showTelemetryPath = true;
    this.showControlPath = true;

    // Topology Nodes, Edges, Packets, Shockwaves
    this.nodes = [];
    this.edges = [];
    this.packets = []; 
    this.shockwaves = [];

    // Selected node for detail drawer
    this.selectedNode = null;
    this.hoveredNode = null;

    // Lifecycle Stepper state (Steps 1 to 6)
    this.activeStep = 1;
    this.highlightedNodeId = null;

    // Live Status Banner on Canvas
    this.statusBanner = {
      text: 'SYSTEM READY: Select a packet type above to simulate wire-speed request routing',
      tier: 'clean',
      expiry: Date.now() + 60000
    };

    // Simulation Speed Multiplier (defaults to 0.5x for clear, readable inspection)
    this.speedMultiplier = 0.5;

    // Animated dash offset for traveling telemetry flow
    this.animOffset = 0;

    this.running = false;
    this.rAF = null;

    this.init();
  }

  setSpeedMultiplier(speed) {
    this.speedMultiplier = Math.max(0.1, Math.min(2.0, parseFloat(speed) || 0.5));
    const label = this.speedMultiplier === 1.0 
      ? '1.0x (Wire Speed)' 
      : (this.speedMultiplier === 0.25 ? '0.25x (Cinematic Slow-Mo)' : '0.5x (Inspection Pace)');
    this.updateStatusBanner(`SIMULATION SPEED: ${label}`, 'clean', 3500);
  }

  updateStatusBanner(text, tier = 'clean', durationMs = 5000) {
    this.statusBanner = {
      text,
      tier: tier.toLowerCase(),
      expiry: Date.now() + durationMs
    };
  }

  init() {
    this.resize();
    this._resizeHandler = () => {
      this.resize();
      this.buildTopology();
    };
    window.addEventListener('resize', this._resizeHandler);

    if (typeof ResizeObserver !== 'undefined' && this.canvas && this.canvas.parentElement) {
      this.resizeObserver = new ResizeObserver(() => {
        this.resize();
        this.buildTopology();
      });
      this.resizeObserver.observe(this.canvas.parentElement);
    }

    this.buildTopology();
    this.setupInteractions();
    this.start();
  }

  resize() {
    if (!this.canvas) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.width = this.canvas.width = (rect.width || 800) * this.dpr;
    this.height = this.canvas.height = (rect.height || 480) * this.dpr;
  }

  buildTopology() {
    const w = this.width;
    const h = this.height;
    const isNarrow = w < 680 * this.dpr;

    if (isNarrow) {
      // Mobile vertical stacked layout
      const cx = w / 2;
      this.nodes = [
        { id: 'client', label: 'Client (Consumer)', sub: 'HTTP / API Consumer', badge: 'INGRESS', x: cx, y: h * 0.10, w: 220, h: 62, type: 'endpoint', color: '#00f0ff', lightColor: '#0284c7', port: 'Ephemeral', file: 'simulator/live_demo.py', desc: 'Sends incoming HTTP traffic (benign browsing or attack bursts).' },
        { id: 'proxy', label: 'IntelliShield Proxy', sub: 'Axum / Tokio Core (:8080)', badge: ':8080 GATEWAY', x: cx, y: h * 0.32, w: 240, h: 68, type: 'core', color: '#00f0ff', lightColor: '#0284c7', port: '8080', file: 'core/src/main.rs, proxy.rs', desc: 'Atomic token check, sub-millisecond fast-forwarding, non-blocking telemetry emitter.' },
        { id: 'backend', label: 'Protected Backend', sub: 'Mock REST Service (:3000)', badge: ':3000 ORIGIN', x: cx, y: h * 0.54, w: 230, h: 64, type: 'backend', color: '#10b981', lightColor: '#059669', port: '3000', file: 'mock_backend/server.py', desc: 'Protected microservice REST API (/users, /products, /auth/login).' },
        { id: 'telemetry', label: 'Sliding-Window Engine', sub: 'Rolling 5.0s Buffer', badge: '8D BUFFER', x: cx, y: h * 0.74, w: 230, h: 64, type: 'telemetry', color: '#818cf8', lightColor: '#4f46e5', port: 'In-Memory', file: 'core/src/telemetry.rs', desc: 'Calculates 8-dimensional behavioral vector per active IP every 1000 ms.' },
        { id: 'ml', label: 'ML Anomaly Worker', sub: 'Isolation Forest (:5001)', badge: ':5001 THREAT-ML', x: cx, y: h * 0.92, w: 230, h: 64, type: 'ml', color: '#06b6d4', lightColor: '#0891b2', port: '5001', file: 'ml_engine/ml_worker_server.py', desc: 'Unsupervised Isolation Forest anomaly scoring batch endpoint (/score_batch).' }
      ];
    } else {
      // Desktop horizontal dual-path layout with generous card boxes
      const leftX = w * 0.15;
      const proxyX = w * 0.50;
      const backendX = w * 0.85;
      const upperY = h * 0.30;
      const lowerY = h * 0.76;

      this.nodes = [
        { 
          id: 'client', 
          label: 'Client (Consumer)', 
          sub: 'HTTP / API Request Source', 
          badge: 'INGRESS',
          x: leftX, 
          y: upperY, 
          w: 200, 
          h: 72, 
          type: 'endpoint', 
          color: '#00f0ff', 
          lightColor: '#0284c7',
          port: 'Ephemeral', 
          file: 'simulator/live_demo.py', 
          desc: 'Originates HTTP API requests across Clean, Monitored, Throttled, or Blocked tiers.' 
        },
        { 
          id: 'proxy', 
          label: 'IntelliShield Proxy', 
          sub: 'Rust Axum / Tokio Core (:8080)', 
          badge: ':8080 GATEWAY',
          x: proxyX, 
          y: upperY, 
          w: 245, 
          h: 82, 
          type: 'core', 
          color: '#00f0ff', 
          lightColor: '#0284c7',
          port: '8080', 
          file: 'core/src/main.rs, proxy.rs, mitigation.rs', 
          desc: 'Atomic in-memory token check (<0.05 ms), fast-path zero-copy forwarding, non-blocking telemetry queuing.' 
        },
        { 
          id: 'backend', 
          label: 'Protected Backend', 
          sub: 'Mock E-Commerce REST API', 
          badge: ':3000 ORIGIN',
          x: backendX, 
          y: upperY, 
          w: 220, 
          h: 72, 
          type: 'backend', 
          color: '#10b981', 
          lightColor: '#059669',
          port: '3000', 
          file: 'mock_backend/server.py', 
          desc: 'Protected upstream web service serving /api/v1/users, /products, and /auth/login.' 
        },
        { 
          id: 'telemetry', 
          label: 'Sliding-Window Engine', 
          sub: 'Rolling 5.0s Buffer (Lock-Free)', 
          badge: '8D BUFFER',
          x: proxyX, 
          y: lowerY, 
          w: 240, 
          h: 74, 
          type: 'telemetry', 
          color: '#818cf8', 
          lightColor: '#4f46e5',
          port: 'In-Memory', 
          file: 'core/src/telemetry.rs', 
          desc: 'Aggregates metadata into sliding window, extracts 8-dimensional feature vector every 1000 ms.' 
        },
        { 
          id: 'ml', 
          label: 'ML Anomaly Worker', 
          sub: 'Isolation Forest Inference', 
          badge: ':5001 THREAT-ML',
          x: backendX, 
          y: lowerY, 
          w: 230, 
          h: 74, 
          type: 'ml', 
          color: '#06b6d4', 
          lightColor: '#0891b2',
          port: '5001', 
          file: 'ml_engine/ml_worker_server.py', 
          desc: 'Evaluates 8D feature vectors asynchronously via Unsupervised Isolation Forest, returns scores [0.0, 1.0].' 
        }
      ];
    }

    // Connect Edges with distinct layer semantics
    this.edges = [
      // Fast Data Path (Client <-> Proxy <-> Backend)
      { id: 'edge-client-proxy', from: 'client', to: 'proxy', layer: 'data', label: 'HTTP Ingress Req', color: 'rgba(56, 189, 248, 0.7)' },
      { id: 'edge-proxy-backend', from: 'proxy', to: 'backend', layer: 'data', label: 'Zero-Copy Forward', color: 'rgba(16, 185, 129, 0.7)' },
      { id: 'edge-backend-proxy', from: 'backend', to: 'proxy', layer: 'data', label: 'Upstream Stream', color: 'rgba(16, 185, 129, 0.7)' },
      { id: 'edge-proxy-client', from: 'proxy', to: 'client', layer: 'data', label: 'Fast Response', color: 'rgba(56, 189, 248, 0.7)' },

      // Async Telemetry Path (Proxy -> Telemetry -> ML)
      { id: 'edge-proxy-telemetry', from: 'proxy', to: 'telemetry', layer: 'telemetry', label: 'Async Queue', color: 'rgba(99, 102, 241, 0.7)' },
      { id: 'edge-telemetry-ml', from: 'telemetry', to: 'ml', layer: 'telemetry', label: '8D Vector Batch', color: 'rgba(99, 102, 241, 0.7)' },

      // Control / Score Feedback Path (ML -> Proxy)
      { id: 'edge-ml-proxy', from: 'ml', to: 'proxy', layer: 'control', label: 'Threat Scores [0.0 .. 1.0]', color: 'rgba(245, 158, 11, 0.75)' }
    ];
  }

  setupInteractions() {
    this.canvas.addEventListener('pointermove', (e) => {
      const rect = this.canvas.getBoundingClientRect();
      const mx = (e.clientX - rect.left) * this.dpr;
      const my = (e.clientY - rect.top) * this.dpr;

      this.hoveredNode = this.nodes.find(n => {
        const halfW = (n.w * this.dpr) / 2;
        const halfH = (n.h * this.dpr) / 2;
        return mx >= n.x - halfW && mx <= n.x + halfW && my >= n.y - halfH && my <= n.y + halfH;
      });

      this.canvas.style.cursor = this.hoveredNode ? 'pointer' : 'default';
    });

    this.canvas.addEventListener('click', () => {
      if (this.hoveredNode) {
        this.selectedNode = this.hoveredNode;
        this.shockwaves.push({
          x: this.hoveredNode.x,
          y: this.hoveredNode.y,
          radius: 15 * this.dpr,
          maxRadius: 60 * this.dpr,
          color: '#00f0ff',
          alpha: 1.0
        });
        window.dispatchEvent(new CustomEvent('topology-node-selected', { detail: { node: this.hoveredNode } }));
      }
    });
  }

  /**
   * Prominently emits a stream of 3 packets with visible tags, glowing shockwaves,
   * and distinct fast-path or drop feedback.
   */
  sendSimulatedPacket(tier = 'Clean') {
    if (!this.nodes || this.nodes.length === 0) {
      this.buildTopology();
    }

    const clientNode = this.nodes.find(n => n.id === 'client');
    const proxyNode = this.nodes.find(n => n.id === 'proxy');
    const backendNode = this.nodes.find(n => n.id === 'backend');
    const telemetryNode = this.nodes.find(n => n.id === 'telemetry');
    const mlNode = this.nodes.find(n => n.id === 'ml');

    if (!clientNode || !proxyNode || !backendNode) return;

    let packetColor = '#10b981'; // green
    let tag = '200 OK';
    let bannerMsg = 'SIMULATED PACKET: Clean (200 OK) -> Fast-Path Forwarded directly to Origin (0.82 ms)';

    if (tier === 'Blocked') {
      packetColor = '#ef4444'; // red
      tag = '403 DROP';
      bannerMsg = 'SIMULATED ATTACK: Credential Stuffing -> Intercepted at Proxy Gateway in 0.04 ms (Origin Protected)';
    } else if (tier === 'Throttled') {
      packetColor = '#f59e0b'; // amber
      tag = '429 THROTTLE';
      bannerMsg = 'SIMULATED ATTACK: Volumetric Surge -> Token Bucket Depleted, Throttled in 0.04 ms (Origin Protected)';
    } else if (tier === 'Monitored') {
      packetColor = '#38bdf8'; // cyan
      tag = 'MONITOR';
      bannerMsg = 'SIMULATED TRAFFIC: Borderline Session -> Zero Latency Forward + Async Telemetry Evaluation';
    }

    this.statusBanner = {
      text: bannerMsg,
      tier: tier.toLowerCase(),
      expiry: Date.now() + 6500
    };

    // Client shockwave burst
    this.shockwaves.push({
      x: clientNode.x,
      y: clientNode.y,
      radius: 12 * this.dpr,
      maxRadius: 55 * this.dpr,
      color: packetColor,
      alpha: 1.0
    });

    // Stagger 3 prominent packets for a visible stream effect scaled by speed
    for (let wave = 0; wave < 3; wave++) {
      const delayMs = (wave * 150) / Math.max(0.1, this.speedMultiplier);
      setTimeout(() => {
        if (!this.running) return;

        // Step 1: Client to Proxy
        this.packets.push({
          startX: clientNode.x,
          startY: clientNode.y,
          endX: proxyNode.x,
          endY: proxyNode.y,
          progress: 0,
          speed: 0.038,
          color: packetColor,
          tag,
          trail: [],
          tier,
          stage: 'to_proxy',
          onComplete: () => {
            // Proxy arrival effect
            this.shockwaves.push({
              x: proxyNode.x,
              y: proxyNode.y,
              radius: 16 * this.dpr,
              maxRadius: 65 * this.dpr,
              color: packetColor,
              alpha: 1.0
            });
            this.highlightedNodeId = 'proxy';
            setTimeout(() => { if (this.highlightedNodeId === 'proxy') this.highlightedNodeId = null; }, 600);

            if (tier === 'Blocked') {
              // Immediate 403 Rejection -> bounces back to Client
              this.packets.push({
                startX: proxyNode.x,
                startY: proxyNode.y,
                endX: clientNode.x,
                endY: clientNode.y,
                progress: 0,
                speed: 0.045,
                color: '#ef4444',
                tag: '403 REJECT',
                trail: [],
                tier,
                stage: 'reject_to_client'
              });
              return;
            }

            if (tier === 'Throttled') {
              // Immediate 429 Throttle -> bounces back to Client
              this.packets.push({
                startX: proxyNode.x,
                startY: proxyNode.y,
                endX: clientNode.x,
                endY: clientNode.y,
                progress: 0,
                speed: 0.045,
                color: '#f59e0b',
                tag: '429 BACKOFF',
                trail: [],
                tier,
                stage: 'throttle_to_client'
              });
              return;
            }

            // Allowed (Clean / Monitored): Forward to Backend Origin
            this.packets.push({
              startX: proxyNode.x,
              startY: proxyNode.y,
              endX: backendNode.x,
              endY: backendNode.y,
              progress: 0,
              speed: 0.042,
              color: packetColor,
              tag: '200 FORWARD',
              trail: [],
              tier,
              stage: 'to_backend',
              onComplete: () => {
                // Backend origin shockwave
                this.shockwaves.push({
                  x: backendNode.x,
                  y: backendNode.y,
                  radius: 14 * this.dpr,
                  maxRadius: 50 * this.dpr,
                  color: '#10b981',
                  alpha: 1.0
                });

                // Backend responds back to Proxy
                this.packets.push({
                  startX: backendNode.x,
                  startY: backendNode.y,
                  endX: proxyNode.x,
                  endY: proxyNode.y,
                  progress: 0,
                  speed: 0.045,
                  color: '#10b981',
                  tag: '200 OK RES',
                  trail: [],
                  tier,
                  stage: 'backend_to_proxy',
                  onComplete: () => {
                    // Proxy streams response back to Client
                    this.packets.push({
                      startX: proxyNode.x,
                      startY: proxyNode.y,
                      endX: clientNode.x,
                      endY: clientNode.y,
                      progress: 0,
                      speed: 0.045,
                      color: '#10b981',
                      tag: 'STREAM DONE',
                      trail: [],
                      tier,
                      stage: 'proxy_to_client'
                    });
                  }
                });
              }
            });

            // Concurrently send Asynchronous Telemetry down to Sliding-Window Engine
            if (telemetryNode && mlNode && wave === 0) {
              this.packets.push({
                startX: proxyNode.x,
                startY: proxyNode.y,
                endX: telemetryNode.x,
                endY: telemetryNode.y,
                progress: 0,
                speed: 0.035,
                color: '#818cf8',
                tag: 'ASYNC TELEMETRY',
                trail: [],
                tier,
                stage: 'to_telemetry',
                onComplete: () => {
                  this.packets.push({
                    startX: telemetryNode.x,
                    startY: telemetryNode.y,
                    endX: mlNode.x,
                    endY: mlNode.y,
                    progress: 0,
                    speed: 0.035,
                    color: '#818cf8',
                    tag: '8D BATCH',
                    trail: [],
                    tier,
                    stage: 'to_ml',
                    onComplete: () => {
                      // ML loopback threat score to Proxy
                      this.packets.push({
                        startX: mlNode.x,
                        startY: mlNode.y,
                        endX: proxyNode.x,
                        endY: proxyNode.y,
                        progress: 0,
                        speed: 0.032,
                        color: '#f59e0b',
                        tag: 'SCORE [0.08]',
                        trail: [],
                        tier,
                        stage: 'score_to_proxy',
                        isCurved: true
                      });
                    }
                  });
                }
              });
            }
          }
        });
      }, delayMs);
    }
  }

  setLifecycleStep(stepNumber) {
    this.activeStep = stepNumber;
    const mapping = {
      1: 'client',
      2: 'proxy',
      3: 'backend',
      4: 'telemetry',
      5: 'ml',
      6: 'proxy'
    };
    this.highlightedNodeId = mapping[stepNumber] || null;
  }

  start() {
    if (this.running) return;
    this.running = true;
    let last = performance.now();

    const loop = (t) => {
      if (!this.running) return;
      const dt = Math.min((t - last) / 16.7, 3);
      last = t;
      try {
        this.render(dt);
      } catch (err) {
        console.error('Topology render loop error:', err);
      }
      this.rAF = requestAnimationFrame(loop);
    };
    this.rAF = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    if (this.rAF) cancelAnimationFrame(this.rAF);
    if (this._resizeHandler) {
      window.removeEventListener('resize', this._resizeHandler);
      this._resizeHandler = null;
    }
    if (this.resizeObserver) {
      this.resizeObserver.disconnect();
      this.resizeObserver = null;
    }
  }

  render(dt) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const dpr = this.dpr;
    const colors = themeManager.getCanvasColors();

    ctx.clearRect(0, 0, w, h);
    this.animOffset = (this.animOffset + 0.4 * dt) % 24;

    // 1. Draw Connecting Bus Lines (Highlighted and clear)
    for (const edge of this.edges) {
      if (edge.layer === 'data' && !this.showDataPath) continue;
      if (edge.layer === 'telemetry' && !this.showTelemetryPath) continue;
      if (edge.layer === 'control' && !this.showControlPath) continue;

      const fromNode = this.nodes.find(n => n.id === edge.from);
      const toNode = this.nodes.find(n => n.id === edge.to);
      if (!fromNode || !toNode) continue;

      // Check if packets are currently traveling on this edge
      const hasActivePacket = this.packets.some(p => {
        const d1 = Math.hypot(p.startX - fromNode.x, p.startY - fromNode.y);
        const d2 = Math.hypot(p.endX - toNode.x, p.endY - toNode.y);
        return d1 < 20 * dpr && d2 < 20 * dpr;
      });

      ctx.beginPath();
      ctx.moveTo(fromNode.x, fromNode.y);

      if (edge.layer === 'control') {
        const midX = (fromNode.x + toNode.x) / 2 + 35 * dpr;
        const midY = (fromNode.y + toNode.y) / 2;
        ctx.quadraticCurveTo(midX, midY, toNode.x, toNode.y);
      } else {
        ctx.lineTo(toNode.x, toNode.y);
      }

      // Outer glow track
      ctx.strokeStyle = hasActivePacket 
        ? (edge.layer === 'data' ? 'rgba(0, 240, 255, 0.4)' : 'rgba(245, 158, 11, 0.4)')
        : (colors.isLight ? 'rgba(203, 213, 225, 0.6)' : 'rgba(255, 255, 255, 0.08)');
      ctx.lineWidth = (hasActivePacket ? 5 : 3.5) * dpr;
      ctx.stroke();

      // Inner crisp path
      ctx.beginPath();
      ctx.moveTo(fromNode.x, fromNode.y);
      if (edge.layer === 'control') {
        const midX = (fromNode.x + toNode.x) / 2 + 35 * dpr;
        const midY = (fromNode.y + toNode.y) / 2;
        ctx.quadraticCurveTo(midX, midY, toNode.x, toNode.y);
      } else {
        ctx.lineTo(toNode.x, toNode.y);
      }

      if (edge.layer === 'telemetry') {
        ctx.strokeStyle = hasActivePacket ? '#818cf8' : 'rgba(99, 102, 241, 0.65)';
        ctx.lineWidth = 2.2 * dpr;
        ctx.setLineDash([6 * dpr, 6 * dpr]);
        ctx.lineDashOffset = -this.animOffset * dpr;
      } else if (edge.layer === 'control') {
        ctx.strokeStyle = hasActivePacket ? '#f59e0b' : 'rgba(245, 158, 11, 0.65)';
        ctx.lineWidth = 2.2 * dpr;
        ctx.setLineDash([4 * dpr, 4 * dpr]);
        ctx.lineDashOffset = -this.animOffset * dpr;
      } else {
        ctx.strokeStyle = hasActivePacket ? '#00f0ff' : (colors.isLight ? '#0284c7' : 'rgba(56, 189, 248, 0.65)');
        ctx.lineWidth = (hasActivePacket ? 3 : 2) * dpr;
        ctx.setLineDash([]);
      }

      ctx.stroke();
      ctx.setLineDash([]);
    }

    // 2. Update and Draw Expanding Shockwaves
    for (let i = this.shockwaves.length - 1; i >= 0; i--) {
      const sw = this.shockwaves[i];
      sw.radius += 2.2 * dpr * dt * this.speedMultiplier;
      sw.alpha -= 0.035 * dt * this.speedMultiplier;

      if (sw.alpha <= 0 || sw.radius >= sw.maxRadius) {
        this.shockwaves.splice(i, 1);
        continue;
      }

      ctx.save();
      ctx.beginPath();
      ctx.arc(sw.x, sw.y, sw.radius, 0, Math.PI * 2);
      ctx.strokeStyle = sw.color;
      ctx.globalAlpha = sw.alpha;
      ctx.lineWidth = 2.5 * dpr;
      ctx.stroke();
      ctx.restore();
    }

    // 3. Update and Draw Traveling Packets with Tails & Badges
    for (let i = this.packets.length - 1; i >= 0; i--) {
      const p = this.packets[i];
      p.progress += p.speed * this.speedMultiplier * dt;

      let curX, curY;
      if (p.isCurved) {
        // Quadratic bezier trajectory
        const midX = (p.startX + p.endX) / 2 + 35 * dpr;
        const midY = (p.startY + p.endY) / 2;
        const t = Math.min(p.progress, 1.0);
        curX = (1 - t) * (1 - t) * p.startX + 2 * (1 - t) * t * midX + t * t * p.endX;
        curY = (1 - t) * (1 - t) * p.startY + 2 * (1 - t) * t * midY + t * t * p.endY;
      } else {
        curX = p.startX + (p.endX - p.startX) * p.progress;
        curY = p.startY + (p.endY - p.startY) * p.progress;
      }

      // Add to trailing history
      p.trail.unshift({ x: curX, y: curY });
      if (p.trail.length > 5) p.trail.pop();

      // Draw particle trail
      for (let tIdx = 0; tIdx < p.trail.length; tIdx++) {
        const pt = p.trail[tIdx];
        const trailAlpha = (1 - tIdx / p.trail.length) * 0.45;
        const trailRad = (6 - tIdx) * dpr;
        ctx.beginPath();
        ctx.arc(pt.x, pt.y, Math.max(2, trailRad), 0, Math.PI * 2);
        ctx.fillStyle = p.color;
        ctx.globalAlpha = trailAlpha;
        ctx.fill();
        ctx.globalAlpha = 1.0;
      }

      // Main Packet Sphere
      ctx.beginPath();
      ctx.arc(curX, curY, 7 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.fill();

      // Bright inner spark
      ctx.beginPath();
      ctx.arc(curX, curY, 3 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // Floating Mini Tag Badge
      if (p.tag) {
        ctx.font = `bold ${8.5 * dpr}px monospace`;
        const tagMetrics = ctx.measureText(p.tag);
        const tagW = tagMetrics.width + 10 * dpr;
        const tagH = 14 * dpr;
        const tagY = curY - 16 * dpr;

        ctx.beginPath();
        ctx.roundRect(curX - tagW / 2, tagY - tagH / 2, tagW, tagH, 3 * dpr);
        ctx.fillStyle = colors.isLight ? 'rgba(15, 23, 42, 0.85)' : 'rgba(5, 8, 17, 0.9)';
        ctx.fill();
        ctx.strokeStyle = p.color;
        ctx.lineWidth = 1 * dpr;
        ctx.stroke();

        ctx.fillStyle = p.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(p.tag, curX, tagY);
      }

      if (p.progress >= 1) {
        if (p.onComplete) p.onComplete();
        this.packets.splice(i, 1);
      }
    }

    // 4. Draw Enlarged & Stylized Topology Nodes
    for (const node of this.nodes) {
      const halfW = (node.w * dpr) / 2;
      const halfH = (node.h * dpr) / 2;
      const isSelected = this.selectedNode && this.selectedNode.id === node.id;
      const isHighlighted = this.highlightedNodeId === node.id;
      const isHovered = this.hoveredNode && this.hoveredNode.id === node.id;

      // Glow halo on highlight / hover / selection
      if (isHighlighted || isSelected || isHovered) {
        ctx.beginPath();
        ctx.roundRect(
          node.x - halfW - 6 * dpr, 
          node.y - halfH - 6 * dpr, 
          (node.w + 12) * dpr, 
          (node.h + 12) * dpr, 
          14 * dpr
        );
        ctx.fillStyle = isHighlighted 
          ? 'rgba(0, 240, 255, 0.24)' 
          : (isHovered ? 'rgba(56, 189, 248, 0.16)' : 'rgba(99, 102, 241, 0.20)');
        ctx.fill();
      }

      // Card Base
      ctx.beginPath();
      ctx.roundRect(node.x - halfW, node.y - halfH, node.w * dpr, node.h * dpr, 10 * dpr);
      ctx.fillStyle = colors.isLight ? '#ffffff' : '#080e1b';
      ctx.fill();

      ctx.strokeStyle = isHighlighted 
        ? (colors.isLight ? '#0284c7' : '#00f0ff') 
        : (isHovered ? (colors.isLight ? '#38bdf8' : 'rgba(56, 189, 248, 0.4)') : (colors.isLight ? '#cbd5e1' : 'rgba(255, 255, 255, 0.12)'));
      ctx.lineWidth = (isHighlighted ? 2.5 : (isHovered ? 2 : 1.2)) * dpr;
      ctx.stroke();

      // Top Accent Line
      ctx.beginPath();
      ctx.roundRect(node.x - halfW, node.y - halfH, node.w * dpr, 4 * dpr, [10 * dpr, 10 * dpr, 0, 0]);
      ctx.fillStyle = node.color;
      ctx.fill();

      // Badge Chip (Top Right inside box)
      if (node.badge) {
        ctx.font = `bold ${7.5 * dpr}px monospace`;
        const bMetrics = ctx.measureText(node.badge);
        const bW = bMetrics.width + 8 * dpr;
        const bH = 12 * dpr;
        const bX = node.x + halfW - bW / 2 - 8 * dpr;
        const bY = node.y - halfH + bH / 2 + 8 * dpr;

        ctx.beginPath();
        ctx.roundRect(bX - bW / 2, bY - bH / 2, bW, bH, 3 * dpr);
        ctx.fillStyle = colors.isLight ? 'rgba(241, 245, 249, 0.95)' : 'rgba(15, 23, 42, 0.85)';
        ctx.fill();
        ctx.strokeStyle = node.color;
        ctx.lineWidth = 1 * dpr;
        ctx.stroke();

        ctx.fillStyle = node.color;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(node.badge, bX, bY);
      }

      // Node Primary Label (Big & High-Contrast)
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${12.5 * dpr}px sans-serif`;
      ctx.fillStyle = colors.isLight ? '#0f172a' : '#f8fafc';
      ctx.fillText(node.label, node.x - halfW + 14 * dpr, node.y - 6 * dpr);

      // Node Subtitle (Clear Monospace)
      ctx.font = `${9.5 * dpr}px monospace`;
      ctx.fillStyle = colors.isLight ? '#475569' : '#94a3b8';
      ctx.fillText(node.sub, node.x - halfW + 14 * dpr, node.y + 14 * dpr);
    }

    // 5. Live Interactive Status Banner Overlay at the Top
    if (this.statusBanner && this.statusBanner.text && Date.now() < this.statusBanner.expiry) {
      const bText = this.statusBanner.text;
      ctx.font = `600 ${9.5 * dpr}px sans-serif`;
      const tMetrics = ctx.measureText(bText);
      const bannerW = Math.min(tMetrics.width + 36 * dpr, w - 40 * dpr);
      const bannerH = 26 * dpr;
      const bannerX = w / 2;
      const bannerY = 22 * dpr;

      ctx.beginPath();
      ctx.roundRect(bannerX - bannerW / 2, bannerY - bannerH / 2, bannerW, bannerH, 13 * dpr);
      ctx.fillStyle = colors.isLight ? 'rgba(255, 255, 255, 0.95)' : 'rgba(6, 10, 22, 0.92)';
      ctx.fill();

      let borderCol = 'rgba(0, 240, 255, 0.5)';
      if (this.statusBanner.tier === 'blocked') borderCol = 'rgba(239, 68, 68, 0.7)';
      else if (this.statusBanner.tier === 'throttled') borderCol = 'rgba(245, 158, 11, 0.7)';
      else if (this.statusBanner.tier === 'monitored') borderCol = 'rgba(56, 189, 248, 0.7)';

      ctx.strokeStyle = borderCol;
      ctx.lineWidth = 1.5 * dpr;
      ctx.stroke();

      // Pulsing leading dot
      ctx.beginPath();
      ctx.arc(bannerX - bannerW / 2 + 14 * dpr, bannerY, 3.5 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = borderCol;
      ctx.fill();

      // Status text
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillStyle = colors.isLight ? '#0f172a' : '#e2e8f0';
      ctx.fillText(bText, bannerX - bannerW / 2 + 24 * dpr, bannerY);
    }
  }
}
