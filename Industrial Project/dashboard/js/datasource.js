/**
 * IntelliShield Multi-Source Telemetry Data Layer
 * Provides unified normalized data stream from either Live HTTP endpoints or Client-Side Simulator.
 */

import {
  CONFIG,
  ReputationTier,
  extract8DFeatures,
  normalizeRawDecisionScore,
  applySafetyBoosters,
  getTierFromScore,
  calculateThrottlePenalty,
  stepTokenBucket
} from './model.js';

export class DataSource {
  constructor() {
    this.subscribers = new Set();
    this.lastState = null;
  }

  subscribe(callback) {
    this.subscribers.add(callback);
    if (this.lastState) callback(this.lastState);
    return () => this.subscribers.delete(callback);
  }

  notify(data) {
    this.lastState = data;
    for (const cb of this.subscribers) {
      try { cb(data); } catch (e) { console.error("Subscriber error:", e); }
    }
  }

  start() {}
  stop() {}
  triggerScenario(name) {}
  resetTelemetry() {}
}

/**
 * -----------------------------------------------------------------------------
 * LIVE DATA SOURCE (Talks to real Python Gateway or Rust Core)
 * -----------------------------------------------------------------------------
 */
export class LiveSource extends DataSource {
  constructor(pollIntervalMs = 1000) {
    super();
    this.pollIntervalMs = pollIntervalMs;
    this.timer = null;
    this.healthTimer = null;
    this.backoffMs = 1000;
    this.running = false;
    this.consecutiveFailures = 0;
    this.onFallback = null;

    this.serviceHealth = {
      proxy: { status: "unknown", port: 8080, latencyMs: 0 },
      backend: { status: "unknown", port: 3000, latencyMs: 0 },
      mlWorker: { status: "unknown", port: 5001, latencyMs: 0 }
    };
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.pollCycle();
    this.checkHealthCycle();
  }

  stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
    if (this.healthTimer) clearTimeout(this.healthTimer);
  }

  async checkHealthCycle() {
    if (!this.running) return;
    const t0 = performance.now();
    try {
      const res = await fetch('/intellishield/health', { cache: 'no-store' });
      const lat = Math.round(performance.now() - t0);
      if (res.ok) {
        const hData = await res.json();
        this.serviceHealth.proxy = { status: "healthy", port: 8080, latencyMs: lat };
        this.serviceHealth.mlWorker = {
          status: hData.ml_worker || "healthy",
          port: 5001,
          latencyMs: 1
        };
        this.serviceHealth.backend = {
          status: hData.backend || "healthy",
          port: 3000,
          latencyMs: 1
        };
      } else {
        this.serviceHealth.proxy = { status: "degraded", port: 8080, latencyMs: lat };
        this.serviceHealth.mlWorker = { status: "degraded", port: 5001, latencyMs: 0 };
        this.serviceHealth.backend = { status: "degraded", port: 3000, latencyMs: 0 };
      }
    } catch (e) {
      this.serviceHealth.proxy = { status: "unhealthy", port: 8080, latencyMs: 0 };
      this.serviceHealth.mlWorker = { status: "unhealthy", port: 5001, latencyMs: 0 };
      this.serviceHealth.backend = { status: "unhealthy", port: 3000, latencyMs: 0 };
    }

    if (this.running) {
      this.healthTimer = setTimeout(() => this.checkHealthCycle(), 5000);
    }
  }

  async pollCycle() {
    if (!this.running) return;
    const t0 = performance.now();

    try {
      const [statusRes, eventsRes] = await Promise.allSettled([
        fetch('/intellishield/status', { cache: 'no-store' }),
        fetch('/intellishield/events', { cache: 'no-store' })
      ]);

      if (statusRes.status === 'fulfilled' && statusRes.value.ok) {
        const statusJson = await statusRes.value.json();
        let eventsJson = [];
        if (eventsRes.status === 'fulfilled' && eventsRes.value.ok) {
          try { eventsJson = await eventsRes.value.json(); } catch (e) {}
        }

        const normalized = this.normalizeLivePayload(statusJson, eventsJson, performance.now() - t0);
        this.notify(normalized);
        this.backoffMs = this.pollIntervalMs;
        this.consecutiveFailures = 0;
      } else {
        throw new Error('Status endpoint returned non-200');
      }
    } catch (err) {
      this.consecutiveFailures++;
      if (this.consecutiveFailures >= 2 && this.onFallback) {
        this.onFallback();
      }
      this.backoffMs = Math.min(this.backoffMs * 1.5, 8000);
      this.notify({
        timestamp: Date.now(),
        mode: "LIVE",
        systemStatus: "degraded",
        services: this.serviceHealth,
        metrics: {
          globalRps: 0,
          p50LatencyMs: 0,
          p99LatencyMs: 0,
          activeIpsCount: 0,
          forwardedTotal: 0,
          throttledTotal: 0,
          blockedTotal: 0,
          mlInferenceAgeSec: 0,
          worstTier: "Clean"
        },
        clients: [],
        events: []
      });
    }

    if (this.running) {
      this.timer = setTimeout(() => this.pollCycle(), this.backoffMs);
    }
  }

  normalizeLivePayload(rawStatus, rawEvents, roundtripMs) {
    // Both Python gateway ('clients') and Rust core ('active_clients') handled seamlessly
    const rawClients = rawStatus.clients || rawStatus.active_clients || [];
    const normalizedClients = [];
    let worstTier = ReputationTier.CLEAN;
    let totalForwarded = 0;
    let totalThrottled = 0;
    let totalBlocked = 0;

    for (const c of rawClients) {
      const ip = c.ip || "unknown";
      const score = Number(c.anomaly_score || 0.05);
      const tier = c.tier || c.reputation_tier || getTierFromScore(score);
      const currentTokens = Number(c.current_tokens != null ? c.current_tokens : 30);
      const capacity = Number(c.capacity || c.effective_capacity || 30);
      const refill = Number(c.refill_rate || c.effective_refill_rate || 8);
      const fwd = Number(c.forwarded || c.total_forwarded || 0);
      const thr = Number(c.throttled || c.total_throttled || 0);
      const blk = Number(c.blocked || c.total_blocked || 0);

      totalForwarded += fwd;
      totalThrottled += thr;
      totalBlocked += blk;

      if (tier === ReputationTier.BLOCKED) worstTier = ReputationTier.BLOCKED;
      else if (tier === ReputationTier.THROTTLED && worstTier !== ReputationTier.BLOCKED) worstTier = ReputationTier.THROTTLED;
      else if (tier === ReputationTier.MONITORED && worstTier === ReputationTier.CLEAN) worstTier = ReputationTier.MONITORED;

      normalizedClients.push({
        ip,
        tier,
        anomalyScore: score,
        currentTokens,
        capacity,
        refillRate: refill,
        forwarded: fwd,
        throttled: thr,
        blocked: blk,
        velocity: Math.max(0.5, (fwd + thr + blk) / 5.0),
        features: [1.2, 0.5, 0.4, 2.1, thr / (fwd + thr + 1), 0.2, 80.0, 0.9],
        lastActive: Date.now()
      });
    }

    // Format events
    const normalizedEvents = (Array.isArray(rawEvents) ? rawEvents : []).map((e, idx) => ({
      id: `ev-${idx}-${Date.now()}`,
      time: e.time || new Date().toLocaleTimeString(),
      ip: e.ip || "127.0.0.1",
      method: e.method || "GET",
      path: e.path || "/",
      status: e.status || 200,
      action: e.action || "forward",
      latency: Number(e.latency || 0.85),
      tier: e.status === 403 ? "Blocked" : (e.status === 429 ? "Throttled" : "Clean")
    }));

    // Estimate global RPS from client velocity sums
    const globalRps = normalizedClients.reduce((acc, c) => acc + c.velocity, 0);

    return {
      timestamp: Date.now(),
      mode: "LIVE",
      systemStatus: this.serviceHealth.proxy.status === 'healthy' ? "active" : "degraded",
      services: this.serviceHealth,
      metrics: {
        globalRps: Number(globalRps.toFixed(1)),
        p50LatencyMs: 0.85,
        p99LatencyMs: 2.74,
        activeIpsCount: normalizedClients.length,
        forwardedTotal: totalForwarded,
        throttledTotal: totalThrottled,
        blockedTotal: totalBlocked,
        mlInferenceAgeSec: 0.45,
        worstTier
      },
      clients: normalizedClients,
      events: normalizedEvents
    };
  }

  async triggerScenario(name) {
    try {
      const res = await fetch('/intellishield/simulate', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ scenario: name })
      });
      return await res.json();
    } catch (e) {
      return { status: "error", message: e.message };
    }
  }

  async resetTelemetry() {
    try {
      await fetch('/intellishield/reset', { method: 'POST' });
    } catch (e) {}
  }
}

/**
 * -----------------------------------------------------------------------------
 * DEMO SOURCE (Deterministic High-Fidelity Client-Side Simulator)
 * Reproduces the 4 phases of live_demo.py plus flash crowd scenario.
 * -----------------------------------------------------------------------------
 */
export class DemoSource extends DataSource {
  constructor(pollIntervalMs = 1000) {
    super();
    this.pollIntervalMs = pollIntervalMs;
    this.timer = null;
    this.running = false;
    this.scenario = "benign"; // benign, ddos, scrape, credential, flash, cooldown
    this.scenarioElapsedSec = 0;

    this.clients = new Map();
    this.eventRing = [];
    this.maxEvents = 150;

    this.initDefaultClients();
  }

  initDefaultClients() {
    this.clients.clear();
    // Benign baseline clients
    this.addClient("192.168.1.101", 0.08, ReputationTier.CLEAN);
    this.addClient("192.168.1.102", 0.12, ReputationTier.CLEAN);
    this.addClient("192.168.1.103", 0.15, ReputationTier.CLEAN);
  }

  addClient(ip, anomalyScore = 0.08, tier = ReputationTier.CLEAN) {
    this.clients.set(ip, {
      ip,
      tier,
      anomalyScore,
      currentTokens: 30.0,
      capacity: 30.0,
      refillRate: 8.0,
      forwarded: 15,
      throttled: 0,
      blocked: 0,
      velocity: 1.5,
      features: [1.5, 0.45, 0.38, 2.4, 0.0, 0.15, 95.0, 1.0],
      history: []
    });
  }

  start() {
    if (this.running) return;
    this.running = true;
    this.step();
  }

  stop() {
    this.running = false;
    if (this.timer) clearTimeout(this.timer);
  }

  step() {
    if (!this.running) return;
    this.scenarioElapsedSec += this.pollIntervalMs / 1000;

    // Simulate scenario traffic injections
    this.simulateTraffic();

    // Re-evaluate features and token buckets
    this.updateClientsState();

    // Emit normalized telemetry
    this.emitNormalizedState();

    this.timer = setTimeout(() => this.step(), this.pollIntervalMs);
  }

  simulateTraffic() {
    const timeStr = new Date().toLocaleTimeString();

    // 1. Benign background requests
    for (const [ip, c] of this.clients.entries()) {
      if (ip.startsWith("192.168.1")) {
        const count = Math.floor(Math.random() * 4) + 1;
        for (let i = 0; i < count; i++) {
          c.currentTokens = Math.min(c.capacity, c.currentTokens + 0.2);
          if (c.currentTokens >= 1) {
            c.currentTokens -= 1;
            c.forwarded++;
            this.pushEvent(timeStr, ip, "GET", "/api/v1/users", 200, "forward", 0.82);
          }
        }
      }
    }

    // 2. Scenario-specific injections
    if (this.scenario === "ddos") {
      // 10.0.0.99 volumetric flood (80 req/s)
      let flooder = this.clients.get("10.0.0.99");
      if (!flooder) {
        this.addClient("10.0.0.99", 0.78, ReputationTier.THROTTLED);
        flooder = this.clients.get("10.0.0.99");
      }
      flooder.anomalyScore = Math.min(0.96, flooder.anomalyScore + 0.05);
      flooder.tier = getTierFromScore(flooder.anomalyScore);
      flooder.velocity = 80.0;
      flooder.capacity = flooder.tier === ReputationTier.BLOCKED ? 0 : 4.0;
      flooder.refillRate = flooder.tier === ReputationTier.BLOCKED ? 0 : 0.8;

      const burst = flooder.tier === ReputationTier.BLOCKED ? 15 : 20;
      for (let i = 0; i < burst; i++) {
        if (flooder.tier === ReputationTier.BLOCKED) {
          flooder.blocked++;
          this.pushEvent(timeStr, "10.0.0.99", "GET", "/api/v1/users", 403, "block", 0.04);
        } else {
          flooder.throttled++;
          this.pushEvent(timeStr, "10.0.0.99", "GET", "/api/v1/users", 429, "throttle", 0.04);
        }
      }
    } else if (this.scenario === "scrape") {
      // 10.0.0.88 low-and-slow scraping bot (variance ~ 0, s > 0.65)
      let scraper = this.clients.get("10.0.0.88");
      if (!scraper) {
        this.addClient("10.0.0.88", 0.72, ReputationTier.THROTTLED);
        scraper = this.clients.get("10.0.0.88");
      }
      scraper.velocity = 3.5;
      scraper.features[2] = 0.002; // zero inter-arrival variance
      scraper.features[3] = 0.45; // low entropy

      const mit = calculateThrottlePenalty(scraper.anomalyScore, 30.0, 8.0);
      scraper.capacity = mit.effectiveCapacity;
      scraper.refillRate = mit.effectiveRefillRate;

      scraper.throttled += 2;
      this.pushEvent(timeStr, "10.0.0.88", "GET", "/api/v1/products", 429, "throttle", 0.12);
    } else if (this.scenario === "credential") {
      // 10.0.0.77 credential stuffing on /api/v1/auth/login
      let stuffer = this.clients.get("10.0.0.77");
      if (!stuffer) {
        this.addClient("10.0.0.77", 0.94, ReputationTier.BLOCKED);
        stuffer = this.clients.get("10.0.0.77");
      }
      stuffer.anomalyScore = 0.94;
      stuffer.tier = ReputationTier.BLOCKED;
      stuffer.capacity = 0;
      stuffer.refillRate = 0;
      stuffer.blocked += 5;
      for (let i = 0; i < 4; i++) {
        this.pushEvent(timeStr, "10.0.0.77", "POST", "/api/v1/auth/login", 403, "block", 0.05);
      }
    } else if (this.scenario === "flash") {
      // Flash crowd: 15 users, 50 req/s, high variance, clean tier
      for (let i = 1; i <= 6; i++) {
        const ip = `192.168.2.${100 + i}`;
        if (!this.clients.has(ip)) {
          this.addClient(ip, 0.18, ReputationTier.CLEAN);
        }
        const c = this.clients.get(ip);
        c.forwarded += 3;
        this.pushEvent(timeStr, ip, "GET", "/api/v1/products", 200, "forward", 0.85);
      }
    } else if (this.scenario === "cooldown") {
      // Decay anomaly scores back to baseline
      for (const [ip, c] of this.clients.entries()) {
        if (c.anomalyScore > 0.15) {
          c.anomalyScore = Math.max(0.10, c.anomalyScore - 0.08);
          c.tier = getTierFromScore(c.anomalyScore);
          const mit = calculateThrottlePenalty(c.anomalyScore, 30.0, 8.0);
          c.capacity = mit.effectiveCapacity;
          c.refillRate = mit.effectiveRefillRate;
          c.currentTokens = Math.min(c.capacity, c.currentTokens + 4.0);
        }
      }
    }
  }

  pushEvent(time, ip, method, path, status, action, latency) {
    if (this.eventRing.length >= this.maxEvents) {
      this.eventRing.shift();
    }
    this.eventRing.push({
      id: `sim-ev-${Math.random().toString(36).substr(2, 9)}`,
      time,
      ip,
      method,
      path,
      status,
      action,
      latency,
      tier: status === 403 ? "Blocked" : (status === 429 ? "Throttled" : "Clean")
    });
  }

  updateClientsState() {
    // Keep client tokens within bounds
    for (const c of this.clients.values()) {
      c.currentTokens = Math.min(c.capacity, c.currentTokens + (c.refillRate * 0.5));
    }
  }

  emitNormalizedState() {
    const clientsList = Array.from(this.clients.values());
    let totalFwd = 0, totalThr = 0, totalBlk = 0;
    let worstTier = ReputationTier.CLEAN;

    for (const c of clientsList) {
      totalFwd += c.forwarded;
      totalThr += c.throttled;
      totalBlk += c.blocked;
      if (c.tier === ReputationTier.BLOCKED) worstTier = ReputationTier.BLOCKED;
      else if (c.tier === ReputationTier.THROTTLED && worstTier !== ReputationTier.BLOCKED) worstTier = ReputationTier.THROTTLED;
      else if (c.tier === ReputationTier.MONITORED && worstTier === ReputationTier.CLEAN) worstTier = ReputationTier.MONITORED;
    }

    const globalRps = clientsList.reduce((acc, c) => acc + (c.velocity || 1.0), 0);

    const payload = {
      timestamp: Date.now(),
      mode: "DEMO",
      systemStatus: "active",
      scenario: this.scenario,
      services: {
        proxy: { status: "healthy", port: 8080, latencyMs: 1 },
        backend: { status: "healthy", port: 3000, latencyMs: 2 },
        mlWorker: { status: "healthy", port: 5001, latencyMs: 3 }
      },
      metrics: {
        globalRps: Number(globalRps.toFixed(1)),
        p50LatencyMs: 0.85,
        p99LatencyMs: 2.74,
        activeIpsCount: clientsList.length,
        forwardedTotal: totalFwd,
        throttledTotal: totalThr,
        blockedTotal: totalBlk,
        mlInferenceAgeSec: 0.5,
        worstTier
      },
      clients: clientsList,
      events: [...this.eventRing].reverse()
    };

    this.notify(payload);
  }

  triggerScenario(name) {
    this.scenario = name;
    this.scenarioElapsedSec = 0;
    if (name === "benign" || name === "reset") {
      this.initDefaultClients();
      this.eventRing = [];
    }
    this.step();
    return { status: "success", message: `Demo scenario '${name}' active` };
  }

  resetTelemetry() {
    this.initDefaultClients();
    this.eventRing = [];
    this.scenario = "benign";
    this.emitNormalizedState();
  }
}

/**
 * -----------------------------------------------------------------------------
 * UNIFIED DATA SOURCE MANAGER WITH AUTO-DETECTION
 * -----------------------------------------------------------------------------
 */
class DataSourceManager {
  constructor() {
    this.live = new LiveSource();
    this.demo = new DemoSource();
    this.activeSource = this.demo;
    this.currentMode = "auto";
    this.subscribers = new Set();

    this.init();
  }

  init() {
    this.live.onFallback = () => {
      if (this.currentMode === 'auto') {
        this.switchToDemo();
      }
    };

    // Forward events to our listeners
    this.live.subscribe(data => {
      if (this.activeSource === this.live) this.broadcast(data);
    });
    this.demo.subscribe(data => {
      if (this.activeSource === this.demo) this.broadcast(data);
    });

    // Check setting
    try {
      this.currentMode = localStorage.getItem('intellishield-source-mode') || 'auto';
    } catch (e) {
      this.currentMode = 'auto';
    }

    window.addEventListener('datasource-change', (e) => {
      this.setMode(e.detail.mode);
    });

    window.addEventListener('reset-telemetry', () => {
      this.resetTelemetry();
    });

    this.evaluateSource();
  }

  async evaluateSource() {
    if (this.currentMode === 'live') {
      this.switchToLive();
      return;
    }
    if (this.currentMode === 'demo') {
      this.switchToDemo();
      return;
    }

    // Auto-detect: Test /intellishield/health
    try {
      const res = await fetch('/intellishield/health', { cache: 'no-store' });
      if (res.ok) {
        this.switchToLive();
      } else {
        this.switchToDemo();
      }
    } catch (e) {
      this.switchToDemo();
    }
  }

  switchToLive() {
    if (this.recoveryTimer) {
      clearInterval(this.recoveryTimer);
      this.recoveryTimer = null;
    }
    this.demo.stop();
    this.activeSource = this.live;
    this.live.start();
    this.updateNavBadge("LIVE", "badge-live");
  }

  switchToDemo() {
    this.live.stop();
    this.activeSource = this.demo;
    this.demo.start();
    this.updateNavBadge("DEMO", "badge-demo");
    this.startRecoveryProbe();
  }

  startRecoveryProbe() {
    if (this.recoveryTimer) clearInterval(this.recoveryTimer);
    this.recoveryTimer = setInterval(async () => {
      if (this.currentMode !== 'auto') return;
      try {
        const res = await fetch('/intellishield/health', { cache: 'no-store' });
        if (res.ok) {
          clearInterval(this.recoveryTimer);
          this.recoveryTimer = null;
          this.switchToLive();
        }
      } catch (e) {}
    }, 2500);
  }

  updateNavBadge(label, badgeClass) {
    const badge = document.getElementById('navSourceBadge');
    const labelEl = document.getElementById('navSourceLabel');
    if (badge && labelEl) {
      badge.className = `badge ${badgeClass}`;
      labelEl.textContent = label;
    }
  }

  setMode(mode) {
    this.currentMode = mode;
    try {
      localStorage.setItem('intellishield-source-mode', mode);
    } catch (e) {}
    this.evaluateSource();
  }

  subscribe(cb) {
    this.subscribers.add(cb);
    if (this.activeSource && this.activeSource.lastState) {
      cb(this.activeSource.lastState);
    }
    return () => this.subscribers.delete(cb);
  }

  broadcast(data) {
    for (const cb of this.subscribers) {
      try { cb(data); } catch (e) {}
    }
  }

  triggerScenario(name) {
    return this.activeSource.triggerScenario(name);
  }

  resetTelemetry() {
    return this.activeSource.resetTelemetry();
  }
}

export const dataManager = new DataSourceManager();
