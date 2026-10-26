/**
 * IntelliShield High-Performance 2D Canvas Chart Suite
 * Self-contained: Zero external dependencies, responsive high-DPI rendering,
 * and theme-adaptive palette binding.
 */

import { themeManager } from '../theme.js';
import { tooltipManager } from './tooltip.js';

/**
 * 1. Real-Time Requests Per Second (RPS) Timeline Chart
 */
export class RpsTimelineChart {
  constructor(canvasId, maxPoints = 30) {
    this.canvas = typeof canvasId === 'string' ? document.getElementById(canvasId) : canvasId;
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.maxPoints = maxPoints;
    this.dataPoints = []; // { time: ms, rps: num, tier: str }
    this.hoveredIndex = null;
    this.resize();
    this.attachEvents();
  }

  attachEvents() {
    this.canvas.addEventListener('mousemove', (e) => this.handlePointerMove(e));
    this.canvas.addEventListener('mouseleave', () => this.handlePointerLeave());
  }

  handlePointerMove(e) {
    if (!this.canvas || this.dataPoints.length < 2) return;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const mx = ((e.clientX - rect.left) / rect.width) * this.width;

    const padL = 36 * this.dpr;
    const padR = 16 * this.dpr;
    const plotW = this.width - padL - padR;

    let closestIdx = -1;
    let closestDist = Infinity;

    this.dataPoints.forEach((d, i) => {
      const px = padL + (plotW / (this.maxPoints - 1)) * (this.maxPoints - this.dataPoints.length + i);
      const dist = Math.abs(mx - px);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    });

    if (closestIdx !== -1 && closestDist < 25 * this.dpr) {
      this.hoveredIndex = closestIdx;
      const pt = this.dataPoints[closestIdx];
      const ageSec = Math.max(0, Math.round((Date.now() - pt.time) / 1000));

      const tierDesc = {
        Clean: "Direct sub-millisecond forward path. Full token bucket capacity (30.0) with zero quadratic penalty.",
        Monitored: "Traffic under observation. Full token capacity maintained while features are scored asynchronously.",
        Throttled: "Burst velocity exceeds bucket refill rate. Quadratic penalty enforces rate limiting (HTTP 429).",
        Blocked: "Isolation Forest threat score exceeded 0.85 threshold. Ingress packets immediately dropped (HTTP 403)."
      };

      tooltipManager.show({
        x: e.clientX,
        y: e.clientY,
        badge: "INGRESS VELOCITY",
        title: `${pt.rps.toFixed(1)} Requests / Sec (${pt.tier})`,
        desc: `Sampled ${ageSec}s ago. ${tierDesc[pt.tier] || ''}`,
        action: "Observes sliding-window packet volume across all client sessions",
        tier: pt.tier.toLowerCase()
      });
    } else {
      if (this.hoveredIndex !== null) {
        this.hoveredIndex = null;
        tooltipManager.hide();
      }
    }
    this.render();
  }

  handlePointerLeave() {
    if (this.hoveredIndex !== null) {
      this.hoveredIndex = null;
      tooltipManager.hide();
      this.render();
    }
  }

  resize() {
    if (!this.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.width = this.canvas.width = (rect.width || 400) * dpr;
    this.height = this.canvas.height = (rect.height || 200) * dpr;
    this.dpr = dpr;
  }

  addDataPoint(rps, tier = 'Clean') {
    this.dataPoints.push({ time: Date.now(), rps: Math.max(0, rps), tier });
    if (this.dataPoints.length > this.maxPoints) {
      this.dataPoints.shift();
    }
    this.render();
  }

  render() {
    if (!this.ctx || this.dataPoints.length < 2) return;
    this.resize();

    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const dpr = this.dpr;
    const colors = themeManager.getCanvasColors();

    ctx.clearRect(0, 0, w, h);

    // Padding
    const padL = 36 * dpr;
    const padR = 16 * dpr;
    const padT = 16 * dpr;
    const padB = 24 * dpr;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    // Determine scale
    const maxVal = Math.max(30, ...this.dataPoints.map(d => d.rps)) * 1.2;

    // Draw horizontal grid lines
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1 * dpr;
    ctx.font = `${9 * dpr}px sans-serif`;
    ctx.fillStyle = colors.isLight ? '#64748b' : '#94a3b8';
    ctx.textAlign = 'right';

    const steps = 4;
    for (let i = 0; i <= steps; i++) {
      const y = padT + (plotH / steps) * i;
      const val = Math.round(maxVal - (maxVal / steps) * i);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
      ctx.fillText(val, padL - 6 * dpr, y + 3 * dpr);
    }

    // Build curve points
    const pts = this.dataPoints.map((d, i) => ({
      x: padL + (plotW / (this.maxPoints - 1)) * (this.maxPoints - this.dataPoints.length + i),
      y: padT + plotH - (d.rps / maxVal) * plotH,
      tier: d.tier
    }));

    // Area fill
    ctx.beginPath();
    ctx.moveTo(pts[0].x, padT + plotH);
    for (let i = 0; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.lineTo(pts[pts.length - 1].x, padT + plotH);
    ctx.closePath();

    const fillGrad = ctx.createLinearGradient(0, padT, 0, padT + plotH);
    fillGrad.addColorStop(0, colors.chartFill);
    fillGrad.addColorStop(1, 'rgba(0, 240, 255, 0)');
    ctx.fillStyle = fillGrad;
    ctx.fill();

    // Line stroke
    ctx.beginPath();
    ctx.moveTo(pts[0].x, pts[0].y);
    for (let i = 1; i < pts.length; i++) {
      ctx.lineTo(pts[i].x, pts[i].y);
    }
    ctx.strokeStyle = colors.chartLine;
    ctx.lineWidth = 2 * dpr;
    ctx.stroke();

    // End point highlight dot
    const lastPt = pts[pts.length - 1];
    ctx.beginPath();
    ctx.arc(lastPt.x, lastPt.y, 4 * dpr, 0, Math.PI * 2);
    ctx.fillStyle = lastPt.tier === 'Blocked' ? colors.blocked : (lastPt.tier === 'Throttled' ? colors.throttled : colors.clean);
    ctx.fill();
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 1.5 * dpr;
    ctx.stroke();

    // Interactive Scrubber & Hover Highlight
    if (this.hoveredIndex !== null && pts[this.hoveredIndex]) {
      const hPt = pts[this.hoveredIndex];
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(hPt.x, padT);
      ctx.lineTo(hPt.x, padT + plotH);
      ctx.strokeStyle = colors.chartLine;
      ctx.lineWidth = 1 * dpr;
      ctx.setLineDash([3 * dpr, 3 * dpr]);
      ctx.stroke();

      ctx.beginPath();
      ctx.arc(hPt.x, hPt.y, 5 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = hPt.tier === 'Blocked' ? colors.blocked : (hPt.tier === 'Throttled' ? colors.throttled : colors.clean);
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 2 * dpr;
      ctx.stroke();
      ctx.restore();
    }
  }
}

/**
 * 2. Forwarding Latency Timeline Chart (P50 vs P99)
 */
export class LatencyChart {
  constructor(canvasId, maxPoints = 25) {
    this.canvas = typeof canvasId === 'string' ? document.getElementById(canvasId) : canvasId;
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.maxPoints = maxPoints;
    this.history = []; // { p50: num, p99: num }
    this.hoveredIndex = null;
    this.resize();
    this.attachEvents();
  }

  attachEvents() {
    this.canvas.addEventListener('mousemove', (e) => this.handlePointerMove(e));
    this.canvas.addEventListener('mouseleave', () => this.handlePointerLeave());
  }

  handlePointerMove(e) {
    if (!this.canvas || this.history.length < 2) return;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const mx = ((e.clientX - rect.left) / rect.width) * this.width;

    const padL = 36 * this.dpr;
    const padR = 16 * this.dpr;
    const plotW = this.width - padL - padR;

    let closestIdx = -1;
    let closestDist = Infinity;

    this.history.forEach((d, i) => {
      const px = padL + (plotW / (this.maxPoints - 1)) * (this.maxPoints - this.history.length + i);
      const dist = Math.abs(mx - px);
      if (dist < closestDist) {
        closestDist = dist;
        closestIdx = i;
      }
    });

    if (closestIdx !== -1 && closestDist < 25 * this.dpr) {
      this.hoveredIndex = closestIdx;
      const pt = this.history[closestIdx];

      tooltipManager.show({
        x: e.clientX,
        y: e.clientY,
        badge: "LATENCY MONITOR",
        title: `P50 Median: ${pt.p50.toFixed(2)} ms | P99 Tail: ${pt.p99.toFixed(2)} ms`,
        desc: "P50 indicates median zero-copy Rust Axum packet forwarding overhead. P99 measures worst-case thread scheduling latency under high contention.",
        action: "Continuous sub-millisecond fast-path performance verification",
        tier: "clean"
      });
    } else {
      if (this.hoveredIndex !== null) {
        this.hoveredIndex = null;
        tooltipManager.hide();
      }
    }
    this.render();
  }

  handlePointerLeave() {
    if (this.hoveredIndex !== null) {
      this.hoveredIndex = null;
      tooltipManager.hide();
      this.render();
    }
  }

  resize() {
    if (!this.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    this.width = this.canvas.width = (rect.width || 400) * dpr;
    this.height = this.canvas.height = (rect.height || 180) * dpr;
    this.dpr = dpr;
  }

  addDataPoint(p50 = 0.85, p99 = 2.74) {
    this.history.push({ p50, p99 });
    if (this.history.length > this.maxPoints) this.history.shift();
    this.render();
  }

  render() {
    if (!this.ctx || this.history.length < 2) return;
    this.resize();

    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const dpr = this.dpr;
    const colors = themeManager.getCanvasColors();

    ctx.clearRect(0, 0, w, h);

    const padL = 36 * dpr;
    const padR = 16 * dpr;
    const padT = 16 * dpr;
    const padB = 24 * dpr;
    const plotW = w - padL - padR;
    const plotH = h - padT - padB;

    const maxVal = Math.max(5.0, ...this.history.map(d => d.p99)) * 1.25;

    // Grid lines
    ctx.strokeStyle = colors.grid;
    ctx.lineWidth = 1 * dpr;
    ctx.font = `${9 * dpr}px sans-serif`;
    ctx.fillStyle = colors.isLight ? '#64748b' : '#94a3b8';
    ctx.textAlign = 'right';

    for (let i = 0; i <= 3; i++) {
      const y = padT + (plotH / 3) * i;
      const val = (maxVal - (maxVal / 3) * i).toFixed(1);
      ctx.beginPath();
      ctx.moveTo(padL, y);
      ctx.lineTo(w - padR, y);
      ctx.stroke();
      ctx.fillText(`${val}ms`, padL - 4 * dpr, y + 3 * dpr);
    }

    const ptsP99 = this.history.map((d, i) => ({
      x: padL + (plotW / (this.maxPoints - 1)) * (this.maxPoints - this.history.length + i),
      y: padT + plotH - (d.p99 / maxVal) * plotH
    }));

    const ptsP50 = this.history.map((d, i) => ({
      x: padL + (plotW / (this.maxPoints - 1)) * (this.maxPoints - this.history.length + i),
      y: padT + plotH - (d.p50 / maxVal) * plotH
    }));

    // P99 line (amber)
    ctx.beginPath();
    ptsP99.forEach((pt, i) => {
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.strokeStyle = colors.chartP99;
    ctx.lineWidth = 1.8 * dpr;
    ctx.stroke();

    // P50 line (cyan)
    ctx.beginPath();
    ptsP50.forEach((pt, i) => {
      if (i === 0) ctx.moveTo(pt.x, pt.y);
      else ctx.lineTo(pt.x, pt.y);
    });
    ctx.strokeStyle = colors.chartLine;
    ctx.lineWidth = 2 * dpr;
    ctx.stroke();

    // Scrubber vertical line
    if (this.hoveredIndex !== null && ptsP50[this.hoveredIndex]) {
      const p50Pt = ptsP50[this.hoveredIndex];
      const p99Pt = ptsP99[this.hoveredIndex];
      ctx.save();
      ctx.beginPath();
      ctx.moveTo(p50Pt.x, padT);
      ctx.lineTo(p50Pt.x, padT + plotH);
      ctx.strokeStyle = colors.chartLine;
      ctx.lineWidth = 1 * dpr;
      ctx.setLineDash([3 * dpr, 3 * dpr]);
      ctx.stroke();

      // P99 circle
      ctx.beginPath();
      ctx.arc(p99Pt.x, p99Pt.y, 4 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = colors.chartP99;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5 * dpr;
      ctx.stroke();

      // P50 circle
      ctx.beginPath();
      ctx.arc(p50Pt.x, p50Pt.y, 4 * dpr, 0, Math.PI * 2);
      ctx.fillStyle = colors.chartLine;
      ctx.fill();
      ctx.strokeStyle = '#ffffff';
      ctx.lineWidth = 1.5 * dpr;
      ctx.stroke();
      ctx.restore();
    }
  }
}

/**
 * 3. Client Reputation Tier Donut Chart
 * Interactive segment highlighting, hovering micro-tooltips, dynamic center readout,
 * and click-to-filter event dispatching.
 */
export class TierDonutChart {
  constructor(canvasId) {
    this.canvas = typeof canvasId === 'string' ? document.getElementById(canvasId) : canvasId;
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.hoveredSegment = null;
    this.segmentsData = [];
    this.lastCounts = { Clean: 3, Monitored: 0, Throttled: 0, Blocked: 0 };
    this.totalClients = 3;
    this.resize();
    this.attachEvents();
  }

  attachEvents() {
    this.canvas.addEventListener('mousemove', (e) => this.handlePointerMove(e));
    this.canvas.addEventListener('mouseleave', () => this.handlePointerLeave());
    this.canvas.addEventListener('click', () => this.handleClick());
  }

  handlePointerMove(e) {
    if (!this.canvas || this.segmentsData.length === 0) return;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const mx = ((e.clientX - rect.left) / rect.width) * this.width;
    const my = ((e.clientY - rect.top) / rect.height) * this.height;

    const cx = this.width / 2;
    const cy = this.height / 2;
    const dx = mx - cx;
    const dy = my - cy;
    const dist = Math.sqrt(dx * dx + dy * dy);

    const outerR = (this.width / 2) - 10 * this.dpr;
    const innerR = outerR * 0.65;

    let hovered = null;

    if (dist >= innerR * 0.75 && dist <= outerR * 1.3) {
      let angle = Math.atan2(dy, dx);
      // Normalize angle matching startAngle = -Math.PI / 2
      let normAngle = (angle + Math.PI / 2 + Math.PI * 2) % (Math.PI * 2);

      for (const seg of this.segmentsData) {
        if (seg.count > 0 && normAngle >= seg.startNorm && normAngle < seg.endNorm) {
          hovered = seg;
          break;
        }
      }
    }

    if (hovered) {
      this.hoveredSegment = hovered.name;
      this.canvas.style.cursor = 'pointer';

      const descriptions = {
        Clean: "Zero-copy fast path forwarding. Full token bucket capacity (30.0 tokens), 8.0/s refill rate, 0% penalty.",
        Monitored: "Elevated threat score (0.50 - 0.65). Full token capacity maintained under continuous sliding-window observation.",
        Throttled: "Suspicious burst activity detected. Quadratic penalty reduces token capacity and refill rate (HTTP 429).",
        Blocked: "Malicious threat score (>0.85). Immediate connection severance and fast-path ingress packet drop (HTTP 403)."
      };

      const pct = ((hovered.count / this.totalClients) * 100).toFixed(1);

      tooltipManager.show({
        x: e.clientX,
        y: e.clientY,
        badge: `${hovered.name.toUpperCase()} REPUTATION TIER`,
        title: `${hovered.name} Clients: ${hovered.count} (${pct}%)`,
        desc: descriptions[hovered.name] || 'Active client reputation classification.',
        action: `Click to filter client telemetry table by ${hovered.name} tier`,
        tier: hovered.name.toLowerCase()
      });
    } else {
      if (this.hoveredSegment !== null) {
        this.hoveredSegment = null;
        this.canvas.style.cursor = 'default';
        tooltipManager.hide();
      }
    }

    this.drawDonut();
  }

  handlePointerLeave() {
    if (this.hoveredSegment !== null) {
      this.hoveredSegment = null;
      if (this.canvas) this.canvas.style.cursor = 'default';
      tooltipManager.hide();
      this.drawDonut();
    }
  }

  handleClick() {
    if (this.hoveredSegment) {
      window.dispatchEvent(new CustomEvent('tier-filter-selected', {
        detail: { tier: this.hoveredSegment }
      }));
    }
  }

  resize() {
    if (!this.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const size = Math.min(rect.width || 180, rect.height || 180);
    this.width = this.canvas.width = size * dpr;
    this.height = this.canvas.height = size * dpr;
    this.dpr = dpr;
  }

  render(tierCounts = { Clean: 3, Monitored: 0, Throttled: 0, Blocked: 0 }) {
    this.lastCounts = tierCounts;
    this.drawDonut();
  }

  drawDonut() {
    if (!this.ctx) return;
    this.resize();

    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const dpr = this.dpr;
    const colors = themeManager.getCanvasColors();

    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const baseOuterR = (w / 2) - 12 * dpr;
    const baseInnerR = baseOuterR * 0.68;

    const total = Object.values(this.lastCounts).reduce((a, b) => a + b, 0) || 1;
    this.totalClients = total;

    const rawSegments = [
      { name: 'Clean', count: this.lastCounts.Clean || 0, color: colors.clean },
      { name: 'Monitored', count: this.lastCounts.Monitored || 0, color: colors.monitored },
      { name: 'Throttled', count: this.lastCounts.Throttled || 0, color: colors.throttled },
      { name: 'Blocked', count: this.lastCounts.Blocked || 0, color: colors.blocked }
    ];

    this.segmentsData = [];
    let currentAngle = -Math.PI / 2;
    let normAccum = 0;

    rawSegments.forEach(seg => {
      const sliceAngle = (seg.count / total) * Math.PI * 2;
      const startNorm = normAccum;
      const endNorm = normAccum + sliceAngle;
      normAccum = endNorm;

      this.segmentsData.push({
        ...seg,
        startAngle: currentAngle,
        endAngle: currentAngle + sliceAngle,
        startNorm,
        endNorm
      });

      if (sliceAngle > 0) {
        const isHovered = seg.name === this.hoveredSegment;
        const outerR = isHovered ? baseOuterR + 5 * dpr : baseOuterR;
        const innerR = isHovered ? baseInnerR - 2 * dpr : baseInnerR;

        ctx.save();
        if (isHovered) {
          ctx.shadowColor = seg.color;
          ctx.shadowBlur = 14 * dpr;
        }

        ctx.beginPath();
        ctx.arc(cx, cy, outerR, currentAngle, currentAngle + sliceAngle);
        ctx.arc(cx, cy, innerR, currentAngle + sliceAngle, currentAngle, true);
        ctx.closePath();
        ctx.fillStyle = seg.color;
        ctx.fill();

        if (isHovered) {
          ctx.lineWidth = 2 * dpr;
          ctx.strokeStyle = '#ffffff';
          ctx.stroke();
        }
        ctx.restore();

        currentAngle += sliceAngle;
      }
    });

    // Center readout (reacts dynamically to hovered segment)
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    if (this.hoveredSegment) {
      const activeSeg = rawSegments.find(s => s.name === this.hoveredSegment);
      ctx.font = `bold ${16 * dpr}px sans-serif`;
      ctx.fillStyle = activeSeg ? activeSeg.color : (colors.isLight ? '#0f172a' : '#ffffff');
      ctx.fillText(activeSeg ? activeSeg.count : total, cx, cy - 4 * dpr);

      ctx.font = `bold ${8 * dpr}px sans-serif`;
      ctx.fillStyle = activeSeg ? activeSeg.color : (colors.isLight ? '#64748b' : '#94a3b8');
      ctx.fillText(this.hoveredSegment.toUpperCase(), cx, cy + 12 * dpr);
    } else {
      ctx.font = `bold ${16 * dpr}px sans-serif`;
      ctx.fillStyle = colors.isLight ? '#0f172a' : '#ffffff';
      ctx.fillText(total, cx, cy - 4 * dpr);

      ctx.font = `${8 * dpr}px sans-serif`;
      ctx.fillStyle = colors.isLight ? '#64748b' : '#94a3b8';
      ctx.fillText("CLIENTS", cx, cy + 12 * dpr);
    }
  }
}

/**
 * 4. 8-Dimensional Behavioral Feature Radar Chart
 * Interactive vertex inspection, sliding-window feature formulas, and cyber-attack detection cues.
 */
export class RadarChart {
  constructor(canvasId) {
    this.canvas = typeof canvasId === 'string' ? document.getElementById(canvasId) : canvasId;
    if (!this.canvas) return;
    this.ctx = this.canvas.getContext('2d');
    this.featureVector = [1.0, 0.5, 0.4, 2.0, 0.0, 0.2, 80.0, 0.9];
    this.hoveredAxis = null;
    this.resize();
    this.attachEvents();
  }

  attachEvents() {
    this.canvas.addEventListener('mousemove', (e) => this.handlePointerMove(e));
    this.canvas.addEventListener('mouseleave', () => this.handlePointerLeave());
  }

  handlePointerMove(e) {
    if (!this.canvas) return;
    const rect = this.canvas.getBoundingClientRect();
    if (!rect.width || !rect.height) return;
    const mx = ((e.clientX - rect.left) / rect.width) * this.width;
    const my = ((e.clientY - rect.top) / rect.height) * this.height;

    const cx = this.width / 2;
    const cy = this.height / 2;
    const radius = (this.width / 2) - 30 * this.dpr;
    const numAxes = 8;

    let closest = -1;
    let minDist = 26 * this.dpr;

    for (let i = 0; i < numAxes; i++) {
      const ang = (Math.PI * 2 / numAxes) * i - Math.PI / 2;
      const x = cx + Math.cos(ang) * radius;
      const y = cy + Math.sin(ang) * radius;
      const d = Math.sqrt((mx - x) ** 2 + (my - y) ** 2);
      if (d < minDist) {
        minDist = d;
        closest = i;
      }
    }

    if (closest !== -1) {
      this.hoveredAxis = closest;
      const descriptions = [
        "Ingress packet velocity (req/s). Elevated values flag volumetric DDoS floods.",
        "Mean inter-arrival time between packets. Abnormally low mean indicates fast bursts.",
        "Variance of inter-arrival gaps. Low variance (<0.05) exposes automated fixed-timer scrapers.",
        "Shannon entropy of requested URI paths. High entropy indicates random crawlers and fuzzers.",
        "Ratio of HTTP error responses (>=400). High error ratio signals brute-force login attempts.",
        "POST method ratio. Spikes highlight credential stuffing on /api/v1/auth/login endpoints.",
        "Variance in HTTP payload sizes. Low variance signals uniform scripted attack payloads.",
        "User-Agent diversity ratio. Zero variation exposes single-signature bot scrapers."
      ];
      const labels = [
        "f_0: Velocity (req/s)",
        "f_1: Mean Inter-arrival (s)",
        "f_2: Inter-arrival Variance",
        "f_3: URI Shannon Entropy",
        "f_4: Error Status Ratio",
        "f_5: POST Method Ratio",
        "f_6: Payload Variance",
        "f_7: User-Agent Variance"
      ];

      const rawVal = this.featureVector[closest] !== undefined ? Number(this.featureVector[closest]).toFixed(2) : '0.00';

      tooltipManager.show({
        x: e.clientX,
        y: e.clientY,
        badge: `FEATURE f_${closest}`,
        title: labels[closest],
        desc: `${descriptions[closest]} Raw observed value: ${rawVal}`,
        action: "Included in 8D sliding-window Isolation Forest anomaly inference vector",
        tier: "monitored"
      });
    } else {
      if (this.hoveredAxis !== null) {
        this.hoveredAxis = null;
        tooltipManager.hide();
      }
    }
    this.render(this.featureVector);
  }

  handlePointerLeave() {
    if (this.hoveredAxis !== null) {
      this.hoveredAxis = null;
      tooltipManager.hide();
      this.render(this.featureVector);
    }
  }

  resize() {
    if (!this.canvas) return;
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const rect = this.canvas.getBoundingClientRect();
    const size = Math.min(rect.width || 260, rect.height || 260);
    this.width = this.canvas.width = size * dpr;
    this.height = this.canvas.height = size * dpr;
    this.dpr = dpr;
  }

  render(featureVector = [1.0, 0.5, 0.4, 2.0, 0.0, 0.2, 80.0, 0.9]) {
    this.featureVector = featureVector;
    if (!this.ctx) return;
    this.resize();

    const ctx = this.ctx;
    const w = this.width;
    const h = this.height;
    const dpr = this.dpr;
    const colors = themeManager.getCanvasColors();

    ctx.clearRect(0, 0, w, h);

    const cx = w / 2;
    const cy = h / 2;
    const radius = (w / 2) - 30 * dpr;

    const labels = ["Velocity", "Interval Mean", "Interval Var", "URI Entropy", "Error Ratio", "POST Ratio", "Payload Var", "UA Variance"];
    const numAxes = labels.length;

    // Normalize input vector values to [0, 1] scale for visual radar polygon
    const normalized = [
      Math.min(1.0, (featureVector[0] || 0) / 30.0),
      Math.min(1.0, (featureVector[1] || 0) / 2.0),
      Math.min(1.0, (featureVector[2] || 0) / 1.0),
      Math.min(1.0, (featureVector[3] || 0) / 3.0),
      Math.min(1.0, (featureVector[4] || 0)),
      Math.min(1.0, (featureVector[5] || 0)),
      Math.min(1.0, (featureVector[6] || 0) / 400.0),
      Math.min(1.0, (featureVector[7] || 0))
    ];

    // Concentric grid polygons
    const rings = 3;
    for (let r = 1; r <= rings; r++) {
      const curR = (radius / rings) * r;
      ctx.beginPath();
      for (let i = 0; i < numAxes; i++) {
        const ang = (Math.PI * 2 / numAxes) * i - Math.PI / 2;
        const x = cx + Math.cos(ang) * curR;
        const y = cy + Math.sin(ang) * curR;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.closePath();
      ctx.strokeStyle = colors.grid;
      ctx.lineWidth = 1 * dpr;
      ctx.stroke();
    }

    // Radial axis lines and labels
    ctx.font = `${7.5 * dpr}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';

    for (let i = 0; i < numAxes; i++) {
      const isHovered = this.hoveredAxis === i;
      const ang = (Math.PI * 2 / numAxes) * i - Math.PI / 2;
      const x = cx + Math.cos(ang) * radius;
      const y = cy + Math.sin(ang) * radius;

      ctx.beginPath();
      ctx.moveTo(cx, cy);
      ctx.lineTo(x, y);
      ctx.strokeStyle = isHovered ? colors.chartLine : colors.grid;
      ctx.lineWidth = isHovered ? 2 * dpr : 1 * dpr;
      ctx.stroke();

      const labelX = cx + Math.cos(ang) * (radius + 16 * dpr);
      const labelY = cy + Math.sin(ang) * (radius + 16 * dpr);
      ctx.fillStyle = isHovered ? (colors.isLight ? '#0284c7' : '#00f0ff') : (colors.isLight ? '#475569' : '#94a3b8');
      ctx.font = isHovered ? `bold ${8.5 * dpr}px sans-serif` : `${7.5 * dpr}px sans-serif`;
      ctx.fillText(labels[i], labelX, labelY);
    }

    // Data polygon
    ctx.beginPath();
    for (let i = 0; i < numAxes; i++) {
      const val = Math.max(0.1, normalized[i]);
      const curR = radius * val;
      const ang = (Math.PI * 2 / numAxes) * i - Math.PI / 2;
      const x = cx + Math.cos(ang) * curR;
      const y = cy + Math.sin(ang) * curR;
      if (i === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.closePath();
    ctx.fillStyle = colors.chartFill;
    ctx.fill();
    ctx.strokeStyle = colors.chartLine;
    ctx.lineWidth = 2 * dpr;
    ctx.stroke();

    // Data points
    for (let i = 0; i < numAxes; i++) {
      const isHovered = this.hoveredAxis === i;
      const val = Math.max(0.1, normalized[i]);
      const curR = radius * val;
      const ang = (Math.PI * 2 / numAxes) * i - Math.PI / 2;
      const x = cx + Math.cos(ang) * curR;
      const y = cy + Math.sin(ang) * curR;

      ctx.beginPath();
      ctx.arc(x, y, (isHovered ? 5 : 3) * dpr, 0, Math.PI * 2);
      ctx.fillStyle = isHovered ? '#ffffff' : colors.chartLine;
      ctx.fill();
      if (isHovered) {
        ctx.strokeStyle = colors.chartLine;
        ctx.lineWidth = 2 * dpr;
        ctx.stroke();
      }
    }
  }
}
