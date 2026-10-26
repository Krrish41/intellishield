/**
 * IntelliShield Mathematical Anomaly Scoring & Mitigation Model
 * Pure functional implementation of specifications from PROJECT_INFO.md and proxy_gateway.py.
 */

export const CONFIG = {
  DEFAULT_BASE_CAPACITY: 30.0,
  DEFAULT_BASE_REFILL: 8.0,
  ALTERNATE_BASE_CAPACITY: 100.0,
  ALTERNATE_BASE_REFILL: 50.0,
  ANOMALY_THRESHOLD: 0.65,
  BLOCK_THRESHOLD: 0.85,
  SLIDING_WINDOW_SEC: 5.0
};

export const ReputationTier = {
  CLEAN: "Clean",
  MONITORED: "Monitored",
  THROTTLED: "Throttled",
  BLOCKED: "Blocked"
};

/**
 * 1. Extract 8-dimensional feature vector from an array of request events in sliding window.
 * Event shape: { timestamp: ms, method: str, path: str, payloadSize: num, status: num, ua: str }
 */
export function extract8DFeatures(events = [], windowDurationSec = CONFIG.SLIDING_WINDOW_SEC) {
  const n = events.length;
  if (n < 2) {
    return {
      f0_velocity: n / windowDurationSec,
      f1_inter_arrival_mean: 0.5,
      f2_inter_arrival_variance: 0.5,
      f3_shannon_entropy: 2.0,
      f4_error_ratio: 0.0,
      f5_post_ratio: 0.0,
      f6_payload_variance: 100.0,
      f7_ua_variance: 1.0,
      samples: n
    };
  }

  // f0: Request Velocity
  const velocity = n / windowDurationSec;

  // f1 & f2: Inter-arrival Mean & Variance
  const sorted = [...events].sort((a, b) => a.timestamp - b.timestamp);
  const deltas = [];
  for (let i = 1; i < n; i++) {
    deltas.push((sorted[i].timestamp - sorted[i - 1].timestamp) / 1000.0);
  }

  const meanDelta = deltas.reduce((acc, d) => acc + d, 0) / deltas.length;
  const varDelta = deltas.reduce((acc, d) => acc + Math.pow(d - meanDelta, 2), 0) / deltas.length;

  // f3: URI Shannon Entropy
  const pathCounts = {};
  for (const ev of events) {
    pathCounts[ev.path] = (pathCounts[ev.path] || 0) + 1;
  }
  let entropy = 0;
  for (const count of Object.values(pathCounts)) {
    const p = count / n;
    entropy -= p * Math.log2(p);
  }

  // f4: HTTP Error Ratio (4xx and 5xx)
  const errorCount = events.filter(e => e.status >= 400).length;
  const errorRatio = errorCount / n;

  // f5: POST + PUT Method Ratio
  const writeCount = events.filter(e => e.method === 'POST' || e.method === 'PUT').length;
  const postRatio = writeCount / n;

  // f6: Mean Payload Size Variance
  const payloads = events.map(e => e.payloadSize || 0);
  const meanPayload = payloads.reduce((acc, p) => acc + p, 0) / n;
  const varPayload = payloads.reduce((acc, p) => acc + Math.pow(p - meanPayload, 2), 0) / n;

  // f7: User-Agent Fingerprint Variance
  const uas = new Set(events.map(e => e.ua || 'unknown'));
  const uaVariance = uas.size / n;

  return {
    f0_velocity: velocity,
    f1_inter_arrival_mean: meanDelta,
    f2_inter_arrival_variance: varDelta,
    f3_shannon_entropy: entropy,
    f4_error_ratio: errorRatio,
    f5_post_ratio: postRatio,
    f6_payload_variance: varPayload,
    f7_ua_variance: uaVariance,
    samples: n
  };
}

/**
 * 2. Score Normalization Formula
 * When raw >= 0: s = max(0.08, 0.28 - raw * 0.8)
 * When raw < 0:  s = min(0.92, 0.58 + |raw| * 2.5)
 */
export function normalizeRawDecisionScore(rawScore) {
  if (rawScore >= 0.0) {
    return Math.max(0.08, 0.28 - (rawScore * 0.8));
  } else {
    return Math.min(0.92, 0.58 + (Math.abs(rawScore) * 2.5));
  }
}

/**
 * 3. Deterministic Safety Boosters
 */
export function applySafetyBoosters(baseScore, features) {
  let score = baseScore;
  const activeBoosters = [];

  const R = features.f0_velocity || 0;
  const varDelta = features.f2_inter_arrival_variance != null ? features.f2_inter_arrival_variance : 1.0;
  const samples = features.samples || 0;
  const entropy = features.f3_shannon_entropy != null ? features.f3_shannon_entropy : 2.0;
  const errorRatio = features.f4_error_ratio || 0;

  // Booster 1: High Volumetric Flood (R > 20 req/s)
  if (R > 20.0) {
    score = Math.max(score, 0.92);
    activeBoosters.push("B1_VOLUMETRIC_FLOOD");
  }

  // Booster 2: High Velocity with Machine Timing Invariance (R > 8 req/s & variance < 0.01)
  if (R > 8.0 && varDelta < 0.01) {
    score = Math.max(score, 0.84);
    activeBoosters.push("B2_MACHINE_TIMING_SURGE");
  }

  // Booster 3: Stealth Low-and-Slow Scraper (variance < 0.02, R > 2 req/s, samples >= 8, entropy < 0.8)
  if (varDelta < 0.02 && R > 2.0 && samples >= 8 && entropy < 0.8) {
    score = Math.max(score, 0.78);
    activeBoosters.push("B3_STEALTH_SCRAPER");
  }

  // Booster 4: Distributed Credential Stuffing / Error Storm (errorRatio > 0.35 & samples >= 6)
  if (errorRatio > 0.35 && samples >= 6) {
    score = Math.max(score, 0.86);
    activeBoosters.push("B4_CREDENTIAL_STUFFING_ERRORS");
  }

  // Clamp within bounds [0.05, 0.99]
  const finalScore = Math.min(0.99, Math.max(0.05, score));
  return {
    score: Number(finalScore.toFixed(4)),
    activeBoosters
  };
}

/**
 * 4. Reputation Tier Mapping
 * Clean: [0.00, 0.40)
 * Monitored: [0.40, 0.65)
 * Throttled: [0.65, 0.85)
 * Blocked: [0.85, 1.00]
 */
export function getTierFromScore(score) {
  if (score >= CONFIG.BLOCK_THRESHOLD) return ReputationTier.BLOCKED;
  if (score >= CONFIG.ANOMALY_THRESHOLD) return ReputationTier.THROTTLED;
  if (score >= 0.40) return ReputationTier.MONITORED;
  return ReputationTier.CLEAN;
}

/**
 * 5. Dynamic Quadratic Penalty Formulation
 * When score >= 0.65:
 *   P = ((score - 0.65) / 0.35)^2
 *   M = max(0.01, 1 - min(1, P))
 *   B_eff = B_base * M
 *   r_eff = r_base * M
 */
export function calculateThrottlePenalty(score, baseCapacity = CONFIG.DEFAULT_BASE_CAPACITY, baseRefill = CONFIG.DEFAULT_BASE_REFILL) {
  if (score >= CONFIG.BLOCK_THRESHOLD) {
    return {
      penalty: 1.0,
      multiplier: 0.0,
      effectiveCapacity: 0.0,
      effectiveRefillRate: 0.0,
      tier: ReputationTier.BLOCKED
    };
  }

  if (score >= CONFIG.ANOMALY_THRESHOLD) {
    const P = Math.pow((score - CONFIG.ANOMALY_THRESHOLD) / (1.0 - CONFIG.ANOMALY_THRESHOLD), 2);
    const M = Math.max(0.01, 1.0 - Math.min(1.0, P));
    return {
      penalty: Number(P.toFixed(4)),
      multiplier: Number(M.toFixed(4)),
      effectiveCapacity: Number((baseCapacity * M).toFixed(2)),
      effectiveRefillRate: Number((baseRefill * M).toFixed(2)),
      tier: ReputationTier.THROTTLED
    };
  }

  // Below anomaly threshold: Full capacity & refill
  const tier = score >= 0.40 ? ReputationTier.MONITORED : ReputationTier.CLEAN;
  return {
    penalty: 0.0,
    multiplier: 1.0,
    effectiveCapacity: baseCapacity,
    effectiveRefillRate: baseRefill,
    tier
  };
}

/**
 * 6. Token Bucket Step Calculation
 * Given previous tokens, elapsed seconds, and effective rates, updates bucket and determines action.
 */
export function stepTokenBucket(currentTokens, elapsedSec, effectiveCapacity, effectiveRefillRate, isBlocked = false) {
  if (isBlocked) {
    return {
      tokens: 0.0,
      action: "block",
      status: 403,
      reason: "IP classified in Blocked tier (anomaly score >= 0.85)"
    };
  }

  // Refill tokens
  const refilled = Math.min(effectiveCapacity, currentTokens + (elapsedSec * effectiveRefillRate));

  // Check consumption (1 token per request)
  if (refilled >= 1.0) {
    return {
      tokens: Number((refilled - 1.0).toFixed(2)),
      action: "forward",
      status: 200,
      reason: ""
    };
  } else {
    const waitSec = Math.max(1, Math.ceil((1.0 - refilled) / Math.max(0.1, effectiveRefillRate)));
    return {
      tokens: Number(refilled.toFixed(2)),
      action: "throttle",
      status: 429,
      retryAfter: waitSec,
      reason: `Rate limit exceeded (Capacity: ${effectiveCapacity}, Refill: ${effectiveRefillRate}/s)`
    };
  }
}
