/**
 * IntelliShield Optimized Cyber Constellation & Electric Conduit Engine
 * Ultra-efficient, battery-friendly background canvas optimized for integrated GPUs (Intel Iris Xe / AMD Radeon):
 * - Lightweight particle constellation (38 desktop / 18 mobile)
 * - Clean geometric conduits with zero expensive canvas shadowBlur passes
 * - Smooth dual-layer alpha compositing for ambient electric glow without GPU buffer penalties
 * - Interactive magnetic cursor tether (limited to closest node)
 * - 60 FPS frame throttle and visibility auto-pause
 * - Dynamic theme and threat-tier reactivity
 */

import { themeManager } from './theme.js';

export class BackgroundEngine {
  constructor(canvasId = 'packetfield') {
    this.canvas = document.getElementById(canvasId);
    if (!this.canvas) return;

    this.ctx = this.canvas.getContext('2d');
    this.particles = [];
    this.electronPulses = [];

    this.width = 0;
    this.height = 0;
    this.dpr = 1;
    this.mouse = { x: -2000, y: -2000, active: false };
    this.scrollY = 0;
    this.running = false;
    this.rAF = null;

    // Traffic reactive state
    this.trafficRps = 10;
    this.worstTier = 'Clean';

    // Highly optimized density limits
    const isMobile = typeof window !== 'undefined' && window.matchMedia('(max-width: 768px)').matches;
    this.maxParticles = isMobile ? 18 : 38;
    this.connectionDistance = isMobile ? 65 : 95;
    this.maxElectronPulses = isMobile ? 1 : 2;

    this.reduceMotion = typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

    this.lastFrameTime = 0;
    this.fpsInterval = 1000 / 60; // 60 FPS cap

    this.init();
  }

  init() {
    this.resize();
    window.addEventListener('resize', () => this.resize(), { passive: true });
    window.addEventListener('scroll', () => {
      this.scrollY = window.scrollY || 0;
    }, { passive: true });

    window.addEventListener('pointermove', (e) => {
      this.mouse.x = e.clientX * this.dpr;
      this.mouse.y = e.clientY * this.dpr;
      this.mouse.active = true;
    }, { passive: true });

    window.addEventListener('pointerleave', () => {
      this.mouse.active = false;
    }, { passive: true });

    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        this.stop();
      } else {
        this.start();
      }
    });

    this.createParticles();
    this.start();
  }

  resize() {
    if (!this.canvas) return;
    this.dpr = Math.min(window.devicePixelRatio || 1, 1.5); // Cap DPR at 1.5 for ultra-low GPU overhead
    this.width = this.canvas.width = window.innerWidth * this.dpr;
    this.height = this.canvas.height = window.innerHeight * this.dpr;
    this.canvas.style.width = `${window.innerWidth}px`;
    this.canvas.style.height = `${window.innerHeight}px`;
  }

  createParticles() {
    this.particles = [];
    for (let i = 0; i < this.maxParticles; i++) {
      this.particles.push(this.spawnParticle());
    }
  }

  spawnParticle() {
    const depth = Math.random() * 0.7 + 0.3; // 0.3 to 1.0 depth
    return {
      x: Math.random() * (this.width || 800),
      y: Math.random() * (this.height || 600),
      vx: (Math.random() - 0.5) * 0.35 * depth,
      vy: (Math.random() * 0.25 + 0.1) * depth,
      z: depth,
      baseRadius: (Math.random() * 1.5 + 1.2) * depth,
      twinkle: Math.random() * Math.PI * 2,
      twinkleSpeed: Math.random() * 0.03 + 0.015,
      type: Math.random() > 0.85 ? 'packet' : 'node'
    };
  }

  spawnElectronPulse(p1, p2) {
    if (this.electronPulses.length >= this.maxElectronPulses) return;
    this.electronPulses.push({
      x1: p1.x,
      y1: p1.y,
      x2: p2.x,
      y2: p2.y,
      z: Math.min(p1.z, p2.z),
      progress: 0,
      speed: Math.random() * 0.02 + 0.015,
      size: (Math.random() * 1.0 + 1.8) * this.dpr
    });
  }

  setTrafficState(rps, worstTier) {
    this.trafficRps = rps || 5;
    this.worstTier = worstTier || 'Clean';
  }

  start() {
    if (this.running || this.reduceMotion) return;
    this.running = true;
    this.lastFrameTime = performance.now();

    const loop = (currentTime) => {
      if (!this.running) return;
      this.rAF = requestAnimationFrame(loop);

      const elapsed = currentTime - this.lastFrameTime;
      if (elapsed < this.fpsInterval) return;

      const dt = Math.min(elapsed / 16.7, 2.0);
      this.lastFrameTime = currentTime - (elapsed % this.fpsInterval);

      this.render(dt);
    };

    this.rAF = requestAnimationFrame(loop);
  }

  stop() {
    this.running = false;
    if (this.rAF) {
      cancelAnimationFrame(this.rAF);
      this.rAF = null;
    }
  }

  render(dt) {
    const ctx = this.ctx;
    if (!ctx) return;

    ctx.clearRect(0, 0, this.width, this.height);

    const colors = themeManager.getCanvasColors();
    const isLight = colors.isLight;
    const dpr = this.dpr;

    const scrollShift = this.scrollY * 0.08 * dpr;
    const speedMult = Math.min(1.8, Math.max(0.8, this.trafficRps / 20));
    const maxConnDist = this.connectionDistance * dpr;
    const mouseRange = 120 * dpr;

    // Palette tokens
    let lineRgb = isLight ? '2, 132, 199' : '0, 240, 255';
    let coreRgb = isLight ? '14, 165, 233' : '224, 250, 255';

    if (this.worstTier === 'Blocked') {
      lineRgb = '239, 68, 68';
      coreRgb = '254, 202, 202';
    } else if (this.worstTier === 'Throttled') {
      lineRgb = '245, 158, 11';
      coreRgb = '254, 243, 199';
    } else if (this.worstTier === 'Monitored') {
      lineRgb = isLight ? '8, 145, 178' : '6, 182, 212';
    }

    // 1. Update Particles
    for (const p of this.particles) {
      p.twinkle += p.twinkleSpeed * dt;
      p.x += p.vx * speedMult * dt;
      p.y += p.vy * speedMult * dt;

      // Gentle mouse tether
      if (this.mouse.active) {
        const mdx = this.mouse.x - p.x;
        const mdy = this.mouse.y - (p.y - scrollShift * p.z);
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mdist < mouseRange && mdist > 0) {
          const pull = (1 - mdist / mouseRange) * 0.4 * p.z;
          p.x += (mdx / mdist) * pull * dt;
          p.y += (mdy / mdist) * pull * dt;
        }
      }

      // Wrap around bounds
      if (p.x < -20 * dpr) p.x = this.width + 20 * dpr;
      if (p.x > this.width + 20 * dpr) p.x = -20 * dpr;
      if (p.y > this.height + 30 * dpr) p.y = -20 * dpr;
      if (p.y < -30 * dpr) p.y = this.height + 20 * dpr;
    }

    // 2. Draw Sparse Electric Conduit Lines (Max 1 connection per node to eliminate clutter and GPU cost)
    const len = this.particles.length;
    let closestMouseDist = Infinity;
    let closestMouseParticle = null;

    for (let i = 0; i < len; i++) {
      const p1 = this.particles[i];
      const p1y = p1.y - scrollShift * p1.z;

      // Track closest particle to cursor
      if (this.mouse.active) {
        const mdx = this.mouse.x - p1.x;
        const mdy = this.mouse.y - p1y;
        const mdist = Math.sqrt(mdx * mdx + mdy * mdy);
        if (mdist < mouseRange && mdist < closestMouseDist) {
          closestMouseDist = mdist;
          closestMouseParticle = { p: p1, y: p1y, dist: mdist };
        }
      }

      let connected = false;
      for (let j = i + 1; j < len; j++) {
        if (connected) break;
        const p2 = this.particles[j];
        const p2y = p2.y - scrollShift * p2.z;

        const dx = p1.x - p2.x;
        const dy = p1y - p2y;
        const dist = Math.sqrt(dx * dx + dy * dy);

        if (dist < maxConnDist) {
          connected = true;
          const proximityAlpha = 1 - dist / maxConnDist;
          const lineAlpha = proximityAlpha * (isLight ? 0.25 : 0.4) * (p1.z * 0.4 + 0.6);

          // Draw single crisp conduit line (no shadowBlur)
          ctx.beginPath();
          ctx.moveTo(p1.x, p1y);
          ctx.lineTo(p2.x, p2y);
          ctx.strokeStyle = `rgba(${lineRgb}, ${lineAlpha})`;
          ctx.lineWidth = 1.0 * dpr;
          ctx.stroke();

          // Occasional electron pulse
          if (Math.random() < 0.003 * speedMult) {
            this.spawnElectronPulse(p1, p2);
          }
        }
      }
    }

    // 3. Single Interactive Cursor Tether (Clean and subtle, max 1 line)
    if (closestMouseParticle) {
      const { p, y: py, dist } = closestMouseParticle;
      const mAlpha = (1 - dist / mouseRange) * (isLight ? 0.35 : 0.55);

      ctx.beginPath();
      ctx.moveTo(p.x, py);
      ctx.lineTo(this.mouse.x, this.mouse.y);
      ctx.strokeStyle = `rgba(${lineRgb}, ${mAlpha})`;
      ctx.lineWidth = 1.2 * dpr;
      ctx.stroke();
    }

    // 4. Render Traveling Electron Pulses (Clean stroke + dot, no shadowBlur)
    for (let k = this.electronPulses.length - 1; k >= 0; k--) {
      const pulse = this.electronPulses[k];
      pulse.progress += pulse.speed * dt;

      if (pulse.progress >= 1) {
        this.electronPulses.splice(k, 1);
        continue;
      }

      const curX = pulse.x1 + (pulse.x2 - pulse.x1) * pulse.progress;
      const curY = (pulse.y1 + (pulse.y2 - pulse.y1) * pulse.progress) - scrollShift * pulse.z;

      ctx.beginPath();
      ctx.arc(curX, curY, pulse.size * 0.7, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${coreRgb}, 0.8)`;
      ctx.fill();
    }

    // 5. Render Cyber Nodes (Crisp dots + subtle outer halos, zero shadowBlur)
    for (const p of this.particles) {
      const depth = p.z;
      const size = p.baseRadius * dpr;
      const py = p.y - scrollShift * depth;
      const px = p.x;

      const alpha = (0.35 + depth * 0.45) * (0.8 + 0.2 * Math.sin(p.twinkle));

      // Outer soft aura
      ctx.beginPath();
      ctx.arc(px, py, size * 2.2, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${lineRgb}, ${alpha * 0.18})`;
      ctx.fill();

      // Core particle dot
      ctx.beginPath();
      ctx.arc(px, py, size, 0, Math.PI * 2);
      ctx.fillStyle = `rgba(${coreRgb}, ${alpha * 0.85})`;
      ctx.fill();
    }
  }
}

export const backgroundEngine = new BackgroundEngine('packetfield');

