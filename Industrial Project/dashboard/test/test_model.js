/**
 * IntelliShield Model Engine Unit & Mathematical Boundary Tests
 * No external test framework required. Run via: node test/test_model.js
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
} from '../js/model.js';

let passed = 0;
let failed = 0;

function assert(condition, message) {
  if (condition) {
    passed++;
    console.log(`  [PASS] ${message}`);
  } else {
    failed++;
    console.error(`  [FAIL] ${message}`);
  }
}

function assertApprox(actual, expected, tolerance = 0.001, message = "") {
  const diff = Math.abs(actual - expected);
  assert(diff <= tolerance, `${message} (Expected ~${expected}, Got ${actual}, Diff: ${diff.toFixed(6)})`);
}

console.log("===============================================================================");
console.log("  RUNNING INTELLISHIELD MODEL & MATHEMATICAL BOUNDARY VERIFICATION SUITE");
console.log("===============================================================================\n");

// -----------------------------------------------------------------------------
// TEST SUITE 1: 8D Feature Vector Extraction
// -----------------------------------------------------------------------------
console.log("--- 1. Testing 8D Feature Vector Extraction ---");
const now = Date.now();
const testEvents = [
  { timestamp: now - 4000, method: 'GET', path: '/api/v1/users', payloadSize: 200, status: 200, ua: 'agent-1' },
  { timestamp: now - 3000, method: 'POST', path: '/api/v1/auth/login', payloadSize: 300, status: 401, ua: 'agent-1' },
  { timestamp: now - 2000, method: 'GET', path: '/api/v1/users', payloadSize: 200, status: 200, ua: 'agent-2' },
  { timestamp: now - 1000, method: 'POST', path: '/api/v1/auth/login', payloadSize: 300, status: 401, ua: 'agent-2' }
];

const features = extract8DFeatures(testEvents, 5.0);
assertApprox(features.f0_velocity, 4 / 5.0, 0.001, "f0: Request Velocity (4 events / 5.0s = 0.8 req/s)");
assert(features.f1_inter_arrival_mean > 0, "f1: Inter-arrival mean calculated");
assert(features.f2_inter_arrival_variance >= 0, "f2: Inter-arrival variance non-negative");
assertApprox(features.f4_error_ratio, 2 / 4.0, 0.001, "f4: HTTP Error Ratio (2 errors out of 4 = 0.50)");
assertApprox(features.f5_post_ratio, 2 / 4.0, 0.001, "f5: POST Ratio (2 POSTs out of 4 = 0.50)");
assertApprox(features.f7_ua_variance, 2 / 4.0, 0.001, "f7: UA Fingerprint Variance (2 unique UAs out of 4 = 0.50)");

// -----------------------------------------------------------------------------
// TEST SUITE 2: Score Normalization
// -----------------------------------------------------------------------------
console.log("\n--- 2. Testing Isolation Forest Decision Function Normalization ---");
// For raw >= 0: s = max(0.08, 0.28 - raw * 0.8)
const benignRaw = 0.15;
const expectedBenign = Math.max(0.08, 0.28 - (benignRaw * 0.8));
assertApprox(normalizeRawDecisionScore(benignRaw), expectedBenign, 0.0001, "Benign raw score normalizes cleanly");

const highBenignRaw = 0.5;
assertApprox(normalizeRawDecisionScore(highBenignRaw), 0.08, 0.0001, "High benign raw clamps to lower floor (0.08)");

// For raw < 0: s = min(0.92, 0.58 + |raw| * 2.5)
const anomalyRaw = -0.08;
const expectedAnomaly = Math.min(0.92, 0.58 + (Math.abs(anomalyRaw) * 2.5));
assertApprox(normalizeRawDecisionScore(anomalyRaw), expectedAnomaly, 0.0001, "Anomalous raw score scales appropriately");

const extremeAnomalyRaw = -0.3;
assertApprox(normalizeRawDecisionScore(extremeAnomalyRaw), 0.92, 0.0001, "Extreme anomalous raw clamps to ceiling (0.92)");

// -----------------------------------------------------------------------------
// TEST SUITE 3: Deterministic Safety Boosters
// -----------------------------------------------------------------------------
console.log("\n--- 3. Testing Deterministic Safety Boosters ---");
// Booster 1: High Volumetric Flood (R > 20 req/s)
const b1Result = applySafetyBoosters(0.30, { f0_velocity: 25.0 });
assert(b1Result.score >= 0.92, "Booster 1 escalates score to >= 0.92 under volumetric flood");
assert(b1Result.activeBoosters.includes("B1_VOLUMETRIC_FLOOD"), "Booster 1 flag triggered");

// Booster 2: High Velocity with Machine Timing Invariance (R > 8 req/s & variance < 0.01)
const b2Result = applySafetyBoosters(0.40, { f0_velocity: 12.0, f2_inter_arrival_variance: 0.005 });
assert(b2Result.score >= 0.84, "Booster 2 escalates score to >= 0.84 under timing invariance");
assert(b2Result.activeBoosters.includes("B2_MACHINE_TIMING_SURGE"), "Booster 2 flag triggered");

// Booster 3: Stealth Low-and-Slow Scraper (variance < 0.02, R > 2 req/s, samples >= 8, entropy < 0.8)
const b3Result = applySafetyBoosters(0.25, {
  f0_velocity: 3.0,
  f2_inter_arrival_variance: 0.008,
  samples: 10,
  f3_shannon_entropy: 0.5
});
assert(b3Result.score >= 0.78, "Booster 3 isolates low-and-slow scraper (score >= 0.78)");
assert(b3Result.activeBoosters.includes("B3_STEALTH_SCRAPER"), "Booster 3 flag triggered");

// Booster 4: Distributed Credential Stuffing (errorRatio > 0.35 & samples >= 6)
const b4Result = applySafetyBoosters(0.30, { f4_error_ratio: 0.80, samples: 10 });
assert(b4Result.score >= 0.86, "Booster 4 flags credential stuffing error storm (score >= 0.86)");
assert(b4Result.activeBoosters.includes("B4_CREDENTIAL_STUFFING_ERRORS"), "Booster 4 flag triggered");

// -----------------------------------------------------------------------------
// TEST SUITE 4: Reputation Tier Threshold Boundaries
// -----------------------------------------------------------------------------
console.log("\n--- 4. Testing Reputation Tier Threshold Boundaries ---");
assert(getTierFromScore(0.00) === ReputationTier.CLEAN, "0.00 -> Clean");
assert(getTierFromScore(0.39) === ReputationTier.CLEAN, "0.39 -> Clean");
assert(getTierFromScore(0.40) === ReputationTier.MONITORED, "0.40 -> Monitored (lower boundary)");
assert(getTierFromScore(0.64) === ReputationTier.MONITORED, "0.64 -> Monitored");
assert(getTierFromScore(0.65) === ReputationTier.THROTTLED, "0.65 -> Throttled (anomaly threshold)");
assert(getTierFromScore(0.84) === ReputationTier.THROTTLED, "0.84 -> Throttled");
assert(getTierFromScore(0.85) === ReputationTier.BLOCKED, "0.85 -> Blocked (block threshold)");
assert(getTierFromScore(0.99) === ReputationTier.BLOCKED, "0.99 -> Blocked");

// -----------------------------------------------------------------------------
// TEST SUITE 5: Dynamic Quadratic Penalty Formulation
// -----------------------------------------------------------------------------
console.log("\n--- 5. Testing Quadratic Rate-Limiting Penalty & Multiplier ---");
const baseCap = 30.0;
const baseRefill = 8.0;

// Below anomaly threshold (s = 0.50): Multiplier = 1.0, full capacity
const cleanMit = calculateThrottlePenalty(0.50, baseCap, baseRefill);
assertApprox(cleanMit.multiplier, 1.0, 0.001, "Clean/Monitored penalty multiplier is 1.0");
assertApprox(cleanMit.effectiveCapacity, 30.0, 0.001, "Clean effective capacity equals base (30.0)");
assertApprox(cleanMit.effectiveRefillRate, 8.0, 0.001, "Clean effective refill rate equals base (8.0)");

// Inside throttled tier (s = 0.75):
// P = ((0.75 - 0.65) / 0.35)^2 = (0.10 / 0.35)^2 = (0.2857)^2 ≈ 0.0816
// M = 1 - P ≈ 0.9184
const s_test1 = 0.75;
const expectedP1 = Math.pow((s_test1 - 0.65) / 0.35, 2);
const expectedM1 = 1.0 - expectedP1;
const throttledMit1 = calculateThrottlePenalty(s_test1, baseCap, baseRefill);
assertApprox(throttledMit1.penalty, expectedP1, 0.001, `Throttled penalty at s=${s_test1} matches quadratic formula`);
assertApprox(throttledMit1.multiplier, expectedM1, 0.001, `Throttled multiplier at s=${s_test1} matches formula`);
assertApprox(throttledMit1.effectiveCapacity, baseCap * expectedM1, 0.01, "Effective capacity scales quadratically");
assertApprox(throttledMit1.effectiveRefillRate, baseRefill * expectedM1, 0.01, "Effective refill rate scales quadratically");

// Higher anomaly score (s = 0.82):
// P = ((0.82 - 0.65) / 0.35)^2 = (0.17 / 0.35)^2 = (0.4857)^2 ≈ 0.2359
// M = 1 - P ≈ 0.7641
const s_test2 = 0.82;
const expectedP2 = Math.pow((s_test2 - 0.65) / 0.35, 2);
const expectedM2 = 1.0 - expectedP2;
const throttledMit2 = calculateThrottlePenalty(s_test2, baseCap, baseRefill);
assertApprox(throttledMit2.multiplier, expectedM2, 0.001, `Throttled multiplier at s=${s_test2} matches formula`);

// Blocked tier (s >= 0.85): Zero capacity and refill
const blockedMit = calculateThrottlePenalty(0.90, baseCap, baseRefill);
assertApprox(blockedMit.effectiveCapacity, 0.0, 0.0001, "Blocked capacity drops to exactly 0.0");
assertApprox(blockedMit.effectiveRefillRate, 0.0, 0.0001, "Blocked refill drops to exactly 0.0");

// -----------------------------------------------------------------------------
// TEST SUITE 6: Token Bucket Mechanics (Refill & Consumption)
// -----------------------------------------------------------------------------
console.log("\n--- 6. Testing Token Bucket Consumption & 429 / 403 Response Codes ---");
// 1. Forward when tokens available
const step1 = stepTokenBucket(15.0, 0.1, 30.0, 8.0, false);
assert(step1.action === "forward", "Request allowed when tokens available");
assert(step1.status === 200, "Returns HTTP 200 OK");
assertApprox(step1.tokens, 15.0 + (0.1 * 8.0) - 1.0, 0.01, "Token decremented by 1 after refill");

// 2. Throttle when bucket exhausted
const step2 = stepTokenBucket(0.2, 0.05, 10.0, 2.0, false);
assert(step2.action === "throttle", "Action throttle when tokens < 1.0");
assert(step2.status === 429, "Returns HTTP 429 Too Many Requests");
assert(step2.retryAfter >= 1, "Provides positive Retry-After seconds");

// 3. Immediate block when IP is in Blocked tier
const step3 = stepTokenBucket(20.0, 0.5, 30.0, 8.0, true);
assert(step3.action === "block", "Action block when isBlocked is true");
assert(step3.status === 403, "Returns HTTP 403 Forbidden");

// -----------------------------------------------------------------------------
// SUMMARY
// -----------------------------------------------------------------------------
console.log("\n===============================================================================");
console.log(`  VERIFICATION RESULTS: ${passed} PASSED, ${failed} FAILED`);
console.log("===============================================================================");

if (failed > 0) {
  process.exit(1);
} else {
  console.log("All mathematical and boundary model assertions verified successfully!\n");
}
