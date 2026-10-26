/**
 * IntelliShield 3D Dot-Sphere Global Attack Map
 * Ported and reskinned from MBJ reference: rotating sphere of dots,
 * simulated geographic attack arcs flowing into edge gateway, and drag-to-rotate interaction.
 */

import { themeManager } from '../theme.js';

export class GlobeCanvas {
  constructor(canvasId) {
    this.canvas = typeof canvasId === 'string' ? document.getElementById(canvasId) : canvasId;
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');

    this.dpr = 1;
    this.width = 0;
    this.height = 0;
    this.R = 150;
    this.cx = 0;
    this.cy = 0;

    this.ang = 0;
    this.tilt = -0.35;
    this.isDragging = false;
    this.lastPointerX = 0;

    this.dots = [];
    this.markers = [];
    this.running = false;
    this.rAF = null;

    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.init();
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize(), { passive: true });

    this.buildSphereDots();
    this.buildMarkers();
    this.setupInteractions();
    this.start();
  }

  resize() {
    if (!this.canvas) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const size = Math.min(rect.width || 600, rect.height || 600);
    this.width = this.canvas.width = size * this.dpr;
    this.height = this.canvas.height = size * this.dpr;
    this.R = size * 0.43 * this.dpr; // Larger prominent globe radius
    this.cx = this.width / 2;
    this.cy = this.height / 2;
  }

  buildSphereDots() {
    this.dots = [];
    const NLAT = 26;
    for (let i = 1; i < NLAT; i++) {
      const lat = (Math.PI * i) / NLAT - Math.PI / 2;
      const c = Math.cos(lat);
      const circ = Math.max(6, Math.round(c * 40));
      for (let j = 0; j < circ; j++) {
        const lon = (2 * Math.PI * j) / circ;
        this.dots.push([Math.cos(lat) * Math.cos(lon), Math.sin(lat), Math.cos(lat) * Math.sin(lon)]);
      }
    }
  }

  buildMarkers() {
    // Primary Gateway Node: Mumbai / VIT Edge
    // Simulated Remote Attack Sources: Frankfurt, Silicon Valley, Tokyo, Singapore, London
    const raw = [
      { name: 'Gateway Edge (Vellore/Mumbai)', lat: 19.07, lon: 72.87, isGateway: true, tier: 'Clean' },
      { name: 'Frankfurt (Botnet Probe)', lat: 50.11, lon: 8.68, isGateway: false, tier: 'Throttled' },
      { name: 'Silicon Valley (Scraper)', lat: 37.38, lon: -122.08, isGateway: false, tier: 'Monitored' },
      { name: 'Tokyo (API Brute Force)', lat: 35.67, lon: 139.65, isGateway: false, tier: 'Blocked' },
      { name: 'London (Legitimate User)', lat: 51.50, lon: -0.12, isGateway: false, tier: 'Clean' },
      { name: 'Singapore (Auth Probe)', lat: 1.35, lon: 103.82, isGateway: false, tier: 'Blocked' }
    ];

    this.markers = raw.map(m => {
      const la = (m.lat * Math.PI) / 180;
      const lo = (m.lon * Math.PI) / 180;
      return {
        ...m,
        v: [Math.cos(la) * Math.cos(lo), Math.sin(la), Math.cos(la) * Math.sin(lo)]
      };
    });
  }

  setupInteractions() {
    this.canvas.addEventListener('pointerdown', (e) => {
      this.isDragging = true;
      this.lastPointerX = e.clientX;
    });

    window.addEventListener('pointermove', (e) => {
      if (this.isDragging) {
        const delta = e.clientX - this.lastPointerX;
        this.ang += delta * 0.008;
        this.lastPointerX = e.clientX;
      }
    }, { passive: true });

    window.addEventListener('pointerup', () => {
      this.isDragging = false;
    });
  }

  rotY(p, a) {
    const s = Math.sin(a), c = Math.cos(a);
    return [p[0] * c + p[2] * s, p[1], -p[0] * s + p[2] * c];
  }

  rotX(p, a) {
    const s = Math.sin(a), c = Math.cos(a);
    return [p[0], p[1] * c - p[2] * s, p[1] * s + p[2] * c];
  }

  start() {
    if (this.running) return;
    this.running = true;

    const render = () => {
      if (!this.running) return;
      this.render();
      this.rAF = requestAnimationFrame(render);
    };
    this.rAF = requestAnimationFrame(render);
  }

  stop() {
    this.running = false;
    if (this.rAF) cancelAnimationFrame(this.rAF);
  }

  render() {
    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const dpr = this.dpr;
    const colors = themeManager.getCanvasColors();

    ctx.clearRect(0, 0, w, h);

    if (!this.isDragging && !this.reduceMotion) {
      this.ang += 0.0035;
    }

    // Glowing globe aura
    const gg = ctx.createRadialGradient(this.cx, this.cy, 0, this.cx, this.cy, this.R * 1.15);
    gg.addColorStop(0, colors.isLight ? 'rgba(186, 230, 253, 0.45)' : 'rgba(2, 132, 199, 0.35)');
    gg.addColorStop(0.7, colors.isLight ? 'rgba(186, 230, 253, 0.15)' : 'rgba(2, 132, 199, 0.12)');
    gg.addColorStop(1, 'rgba(0, 240, 255, 0)');
    ctx.fillStyle = gg;
    ctx.beginPath();
    ctx.arc(this.cx, this.cy, this.R * 1.15, 0, Math.PI * 2);
    ctx.fill();

    // Render sphere dots
    for (const d of this.dots) {
      let p = this.rotY(d, this.ang);
      p = this.rotX(p, this.tilt);
      const zz = p[2];
      const sx = this.cx + p[0] * this.R;
      const sy = this.cy - p[1] * this.R;

      const front = zz > 0;
      const alpha = front ? (0.25 + zz * 0.65) : (0.05 + (zz + 1) * 0.08);
      const rad = (front ? 1.6 : 1.0) * dpr * (0.6 + ((zz + 1) / 2) * 0.7);

      ctx.beginPath();
      ctx.fillStyle = colors.isLight ? `rgba(2, 132, 199, ${alpha})` : `rgba(56, 189, 248, ${alpha})`;
      ctx.arc(sx, sy, rad, 0, Math.PI * 2);
      ctx.fill();
    }

    // Project markers
    const proj = this.markers.map(m => {
      let p = this.rotY(m.v, this.ang);
      p = this.rotX(p, this.tilt);
      return {
        ...m,
        x: this.cx + p[0] * this.R,
        y: this.cy - p[1] * this.R,
        z: p[2]
      };
    });

    const gateway = proj.find(m => m.isGateway);

    // Render quadratic attack arcs flowing into gateway
    if (gateway && gateway.z > -0.3) {
      for (const m of proj) {
        if (m.isGateway || m.z < -0.2) continue;

        const mx = (m.x + gateway.x) / 2;
        const my = (m.y + gateway.y) / 2;
        const lift = 0.28 * Math.hypot(m.x - gateway.x, m.y - gateway.y);

        ctx.beginPath();
        ctx.moveTo(m.x, m.y);
        ctx.quadraticCurveTo(mx, my - lift, gateway.x, gateway.y);

        let arcColor = colors.clean;
        if (m.tier === 'Blocked') arcColor = colors.blocked;
        else if (m.tier === 'Throttled') arcColor = colors.throttled;
        else if (m.tier === 'Monitored') arcColor = colors.monitored;

        ctx.strokeStyle = arcColor;
        ctx.lineWidth = 1.4 * dpr;
        ctx.stroke();
      }
    }

    // Render Marker Pins
    const now = performance.now();
    for (const m of proj) {
      if (m.z < -0.25) continue;

      const pulse = 0.5 + 0.5 * Math.sin(now / 400 + m.x);
      const pinR = (m.isGateway ? 6.0 : 4.0) * dpr;

      ctx.beginPath();
      ctx.arc(m.x, m.y, pinR + pulse * 2.5 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = m.isGateway ? 'var(--primary-cyan)' : (m.tier === 'Blocked' ? 'var(--tier-blocked)' : 'var(--tier-monitored)');
      ctx.fill();

      ctx.beginPath();
      ctx.arc(m.x, m.y, pinR * 0.6, 0, Math.PI * 2);
      ctx.fillStyle = '#ffffff';
      ctx.fill();

      // High-Contrast Legible Badge Label
      if (m.z > 0.05) {
        ctx.font = `600 ${10.5 * dpr}px 'JetBrains Mono', monospace`;
        const textMetrics = ctx.measureText(m.name);
        const textW = textMetrics.width;
        const textH = 14 * dpr;
        const padX = 8 * dpr;
        const padY = 4 * dpr;
        const boxX = m.x - (textW / 2) - padX;
        const boxY = m.y - 18 * dpr - textH;

        // Frosted Pill Background
        ctx.save();
        ctx.fillStyle = colors.isLight ? 'rgba(255, 255, 255, 0.92)' : 'rgba(5, 8, 17, 0.88)';
        ctx.strokeStyle = m.isGateway ? 'rgba(0, 240, 255, 0.6)' :
                          (m.tier === 'Blocked' ? 'rgba(239, 68, 68, 0.6)' :
                          (m.tier === 'Throttled' ? 'rgba(245, 158, 11, 0.6)' : 'rgba(0, 240, 255, 0.35)'));
        ctx.lineWidth = 1 * dpr;

        if (ctx.roundRect) {
          ctx.beginPath();
          ctx.roundRect(boxX, boxY, textW + padX * 2, textH + padY * 2, 4 * dpr);
          ctx.fill();
          ctx.stroke();
        } else {
          ctx.fillRect(boxX, boxY, textW + padX * 2, textH + padY * 2);
          ctx.strokeRect(boxX, boxY, textW + padX * 2, textH + padY * 2);
        }

        ctx.fillStyle = colors.isLight ? '#0f172a' : '#f8fafc';
        ctx.textAlign = 'center';
        ctx.fillText(m.name, m.x, boxY + textH);
        ctx.restore();
      }
    }
  }
}
