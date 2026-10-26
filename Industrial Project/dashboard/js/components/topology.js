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

    // Topology Nodes
    this.nodes = [];
    this.edges = [];
    this.packets = []; // Active traveling packets

    // Selected node for detail drawer
    this.selectedNode = null;
    this.hoveredNode = null;

    // Lifecycle Stepper state (Steps 1 to 6)
    this.activeStep = 1;
    this.highlightedNodeId = null;

    this.running = false;
    this.rAF = null;

    this.init();
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => {
      this.resize();
      this.buildTopology();
    });

    this.buildTopology();
    this.setupInteractions();
    this.start();
  }

  resize() {
    if (!this.canvas) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.width = this.canvas.width = (rect.width || 800) * this.dpr;
    this.height = this.canvas.height = (rect.height || 460) * this.dpr;
  }

  buildTopology() {
    const w = this.width;
    const h = this.height;
    const isNarrow = w < 600 * this.dpr;

    if (isNarrow) {
      // Mobile vertical layout
      const cx = w / 2;
      this.nodes = [
        { id: 'client', label: 'Client', sub: 'HTTP / API Consumer', x: cx, y: h * 0.10, w: 140, h: 44, type: 'endpoint', color: 'var(--primary-cyan)', port: 'Ephemeral', file: 'simulator/live_demo.py', desc: 'Sends incoming HTTP traffic (benign browsing or attack bursts).' },
        { id: 'proxy', label: 'Rust Ingress Proxy', sub: 'Axum / Tokio Core (:8080)', x: cx, y: h * 0.32, w: 180, h: 54, type: 'core', color: 'var(--primary-cyan)', port: '8080', file: 'core/src/main.rs, proxy.rs', desc: 'Atomic token check, sub-millisecond fast-forwarding, non-blocking telemetry emitter.' },
        { id: 'backend', label: 'Upstream Backend', sub: 'Mock REST Service (:3000)', x: cx, y: h * 0.54, w: 170, h: 48, type: 'backend', color: 'var(--tier-clean)', port: '3000', file: 'mock_backend/server.py', desc: 'Protected microservice REST API (/users, /products, /auth/login).' },
        { id: 'telemetry', label: 'Sliding-Window Engine', sub: 'Rolling 5.0s Buffer', x: cx, y: h * 0.74, w: 170, h: 46, type: 'telemetry', color: 'var(--primary-indigo)', port: 'In-Memory', file: 'core/src/telemetry.rs', desc: 'Calculates 8-dimensional behavioral vector per active IP every 1000 ms.' },
        { id: 'ml', label: 'ML Anomaly Worker', sub: 'Isolation Forest (:5001)', x: cx, y: h * 0.92, w: 170, h: 46, type: 'ml', color: 'var(--primary-indigo)', port: '5001', file: 'ml_engine/ml_worker_server.py', desc: 'Unsupervised Isolation Forest anomaly scoring batch endpoint (/score_batch).' }
      ];
    } else {
      // Desktop horizontal dual-path layout
      const leftX = w * 0.14;
      const proxyX = w * 0.42;
      const backendX = w * 0.82;
      const lowerY = h * 0.76;
      const upperY = h * 0.28;

      this.nodes = [
        { id: 'client', label: 'Client', sub: 'HTTP / API Consumer', x: leftX, y: upperY, w: 130, h: 48, type: 'endpoint', color: 'var(--primary-cyan)', port: 'Ephemeral', file: 'simulator/live_demo.py', desc: 'Originates HTTP API requests across Clean, Monitored, Throttled, or Blocked tiers.' },
        { id: 'proxy', label: 'IntelliShield Proxy', sub: 'Axum / Tokio Core (:8080)', x: proxyX, y: upperY, w: 180, h: 56, type: 'core', color: 'var(--primary-cyan)', port: '8080', file: 'core/src/main.rs, proxy.rs, mitigation.rs', desc: 'Atomic in-memory token check (<0.05 ms), fast-path zero-copy forwarding, non-blocking telemetry queuing.' },
        { id: 'backend', label: 'Protected Backend', sub: 'Microservice API (:3000)', x: backendX, y: upperY, w: 160, h: 48, type: 'backend', color: 'var(--tier-clean)', port: '3000', file: 'mock_backend/server.py', desc: 'Protected upstream web service serving /api/v1/users, /products, and /auth/login.' },
        { id: 'telemetry', label: 'Sliding-Window Engine', sub: 'Rolling 5.0s Buffer', x: proxyX, y: lowerY, w: 170, h: 48, type: 'telemetry', color: 'var(--primary-indigo)', port: 'In-Memory', file: 'core/src/telemetry.rs', desc: 'Aggregates metadata into sliding window, extracts 8-dimensional feature vector every 1000 ms.' },
        { id: 'ml', label: 'ML Anomaly Worker', sub: 'Isolation Forest (:5001)', x: backendX, y: lowerY, w: 160, h: 48, type: 'ml', color: 'var(--primary-indigo)', port: '5001', file: 'ml_engine/ml_worker_server.py', desc: 'Evaluates 8D feature vectors asynchronously via Unsupervised Isolation Forest, returns scores [0.0, 1.0].' }
      ];
    }

    // Connect Edges
    this.edges = [
      // Fast Data Path (Client <-> Proxy <-> Backend)
      { from: 'client', to: 'proxy', layer: 'data', label: 'Fast Path: HTTP Req', color: 'var(--primary-cyan)' },
      { from: 'proxy', to: 'backend', layer: 'data', label: 'Allowed (200 OK)', color: 'var(--tier-clean)' },
      { from: 'backend', to: 'proxy', layer: 'data', label: 'Upstream Response', color: 'var(--tier-clean)' },
      { from: 'proxy', to: 'client', layer: 'data', label: 'Streamed Response', color: 'var(--primary-cyan)' },

      // Async Telemetry Path (Proxy -> Telemetry -> ML)
      { from: 'proxy', to: 'telemetry', layer: 'telemetry', label: 'Non-blocking Queue', color: 'var(--primary-indigo)' },
      { from: 'telemetry', to: 'ml', layer: 'telemetry', label: '8D Vector Batch', color: 'var(--primary-indigo)' },

      // Control / Score Sync Path (ML -> Proxy)
      { from: 'ml', to: 'proxy', layer: 'control', label: 'Threat Scores [0..1]', color: 'var(--tier-throttled)' }
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
        window.dispatchEvent(new CustomEvent('topology-node-selected', { detail: { node: this.hoveredNode } }));
      }
    });
  }

  sendSimulatedPacket(tier = 'Clean') {
    const clientNode = this.nodes.find(n => n.id === 'client');
    const proxyNode = this.nodes.find(n => n.id === 'proxy');
    const backendNode = this.nodes.find(n => n.id === 'backend');

    if (!clientNode || !proxyNode || !backendNode) return;

    let packetColor = 'var(--tier-clean)';
    if (tier === 'Blocked') packetColor = 'var(--tier-blocked)';
    else if (tier === 'Throttled') packetColor = 'var(--tier-throttled)';
    else if (tier === 'Monitored') packetColor = 'var(--tier-monitored)';

    // Step A: Client to Proxy
    this.packets.push({
      startX: clientNode.x,
      startY: clientNode.y,
      endX: proxyNode.x,
      endY: proxyNode.y,
      progress: 0,
      speed: 0.04,
      color: packetColor,
      tier,
      stage: 'to_proxy',
      onComplete: () => {
        if (tier === 'Blocked') {
          // Dropped immediately at proxy (403)
          this.highlightedNodeId = 'proxy';
          setTimeout(() => { this.highlightedNodeId = null; }, 500);
          return;
        }
        if (tier === 'Throttled') {
          // Rejected at proxy (429)
          this.highlightedNodeId = 'proxy';
          setTimeout(() => { this.highlightedNodeId = null; }, 500);
          return;
        }
        // Allowed: Forward to Backend
        this.packets.push({
          startX: proxyNode.x,
          startY: proxyNode.y,
          endX: backendNode.x,
          endY: backendNode.y,
          progress: 0,
          speed: 0.05,
          color: packetColor,
          tier,
          stage: 'to_backend',
          onComplete: () => {
            // Backend returns response to proxy
            this.packets.push({
              startX: backendNode.x,
              startY: backendNode.y,
              endX: proxyNode.x,
              endY: proxyNode.y,
              progress: 0,
              speed: 0.05,
              color: packetColor,
              tier,
              stage: 'from_backend'
            });
          }
        });
      }
    });
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
      this.render(dt);
      this.rAF = requestAnimationFrame(loop);
    };
    this.rAF = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    if (this.rAF) cancelAnimationFrame(this.rAF);
  }

  render(dt) {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const dpr = this.dpr;
    const colors = themeManager.getCanvasColors();

    ctx.clearRect(0, 0, w, h);

    // Draw Edges
    for (const edge of this.edges) {
      if (edge.layer === 'data' && !this.showDataPath) continue;
      if (edge.layer === 'telemetry' && !this.showTelemetryPath) continue;
      if (edge.layer === 'control' && !this.showControlPath) continue;

      const fromNode = this.nodes.find(n => n.id === edge.from);
      const toNode = this.nodes.find(n => n.id === edge.to);
      if (!fromNode || !toNode) continue;

      ctx.beginPath();
      ctx.moveTo(fromNode.x, fromNode.y);

      // Curved or straight edge
      if (edge.layer === 'control') {
        // Curve loopback to proxy
        const midX = (fromNode.x + toNode.x) / 2 + 30 * dpr;
        const midY = (fromNode.y + toNode.y) / 2;
        ctx.quadraticCurveTo(midX, midY, toNode.x, toNode.y);
      } else {
        ctx.lineTo(toNode.x, toNode.y);
      }

      ctx.strokeStyle = edge.layer === 'telemetry' ? 'rgba(99, 102, 241, 0.4)' : (edge.layer === 'control' ? 'rgba(245, 158, 11, 0.4)' : 'rgba(56, 189, 248, 0.35)');
      ctx.lineWidth = (edge.layer === 'data' ? 2 : 1.5) * dpr;
      if (edge.layer === 'telemetry' || edge.layer === 'control') {
        ctx.setLineDash([4 * dpr, 4 * dpr]);
      } else {
        ctx.setLineDash([]);
      }
      ctx.stroke();
      ctx.setLineDash([]);
    }

    // Update and draw traveling packets
    for (let i = this.packets.length - 1; i >= 0; i--) {
      const p = this.packets[i];
      p.progress += p.speed * dt;

      const curX = p.startX + (p.endX - p.startX) * p.progress;
      const curY = p.startY + (p.endY - p.startY) * p.progress;

      ctx.beginPath();
      ctx.arc(curX, curY, 4.5 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = p.color;
      ctx.shadowColor = p.color;
      ctx.shadowBlur = 8 * dpr;
      ctx.fill();
      ctx.shadowBlur = 0;

      if (p.progress >= 1) {
        if (p.onComplete) p.onComplete();
        this.packets.splice(i, 1);
      }
    }

    // Draw Nodes
    for (const node of this.nodes) {
      const halfW = (node.w * dpr) / 2;
      const halfH = (node.h * dpr) / 2;
      const isSelected = this.selectedNode && this.selectedNode.id === node.id;
      const isHighlighted = this.highlightedNodeId === node.id;
      const isHovered = this.hoveredNode && this.hoveredNode.id === node.id;

      // Glow halo on highlight
      if (isHighlighted || isSelected) {
        ctx.beginPath();
        ctx.roundRect(node.x - halfW - 4 * dpr, node.y - halfH - 4 * dpr, (node.w + 8) * dpr, (node.h + 8) * dpr, 10 * dpr);
        ctx.fillStyle = 'rgba(0, 240, 255, 0.18)';
        ctx.fill();
      }

      // Card Body
      ctx.beginPath();
      ctx.roundRect(node.x - halfW, node.y - halfH, node.w * dpr, node.h * dpr, 8 * dpr);
      ctx.fillStyle = colors.isLight ? '#ffffff' : '#0c1424';
      ctx.fill();

      ctx.strokeStyle = isHighlighted ? 'var(--primary-cyan)' : (isHovered ? 'var(--border-strong)' : 'var(--border-medium)');
      ctx.lineWidth = (isHighlighted ? 2 : 1) * dpr;
      ctx.stroke();

      // Top colored accent bar
      ctx.beginPath();
      ctx.roundRect(node.x - halfW, node.y - halfH, node.w * dpr, 3 * dpr, [8 * dpr, 8 * dpr, 0, 0]);
      ctx.fillStyle = node.color;
      ctx.fill();

      // Node Labels
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.font = `bold ${10.5 * dpr}px sans-serif`;
      ctx.fillStyle = colors.isLight ? '#0f172a' : '#ffffff';
      ctx.fillText(node.label, node.x, node.y - 4 * dpr);

      ctx.font = `${8 * dpr}px monospace`;
      ctx.fillStyle = colors.isLight ? '#64748b' : '#94a3b8';
      ctx.fillText(node.sub, node.x, node.y + 10 * dpr);
    }
  }
}
