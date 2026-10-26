use chrono::{DateTime, Utc};
use dashmap::DashMap;
use serde::{Deserialize, Serialize};
use std::net::IpAddr;
use std::sync::Arc;

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum ReputationTier {
    Clean,      // Normal legitimate traffic
    Monitored,  // Moderate anomaly score, elevated observation
    Throttled,  // High anomaly score, restricted token refill
    Blocked,    // Definite attack payload, immediate drop
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ClientState {
    pub ip: IpAddr,
    pub reputation_tier: ReputationTier,
    pub anomaly_score: f64,
    pub current_tokens: f64,
    pub effective_capacity: f64,
    pub effective_refill_rate: f64,
    pub last_refill: DateTime<Utc>,
    pub total_forwarded: u64,
    pub total_throttled: u64,
    pub total_blocked: u64,
}

#[derive(Debug, Clone)]
pub struct MitigationConfig {
    pub base_capacity: f64,        // e.g. 100.0 tokens
    pub base_refill_rate: f64,     // e.g. 20.0 tokens/sec
    pub anomaly_threshold: f64,    // e.g. 0.65
    pub block_threshold: f64,      // e.g. 0.85
}

impl Default for MitigationConfig {
    fn default() -> Self {
        Self {
            base_capacity: 100.0,
            base_refill_rate: 25.0,
            anomaly_threshold: 0.65,
            block_threshold: 0.85,
        }
    }
}

pub enum Action {
    Forward,
    Throttle { retry_after_secs: u64 },
    Block { reason: String },
}

#[derive(Clone)]
pub struct MitigationEngine {
    states: Arc<DashMap<IpAddr, ClientState>>,
    config: MitigationConfig,
}

impl MitigationEngine {
    pub fn new(config: MitigationConfig) -> Self {
        Self {
            states: Arc::new(DashMap::new()),
            config,
        }
    }

    /// Pre-flight fast check executed in the ingress path (<0.05 ms)
    pub fn check_and_consume(&self, ip: IpAddr) -> Action {
        let now = Utc::now();
        let mut entry = self.states.entry(ip).or_insert_with(|| ClientState {
            ip,
            reputation_tier: ReputationTier::Clean,
            anomaly_score: 0.1,
            current_tokens: self.config.base_capacity,
            effective_capacity: self.config.base_capacity,
            effective_refill_rate: self.config.base_refill_rate,
            last_refill: now,
            total_forwarded: 0,
            total_throttled: 0,
            total_blocked: 0,
        });

        // 1. If blocked, drop immediately
        if entry.reputation_tier == ReputationTier::Blocked {
            entry.total_blocked += 1;
            return Action::Block {
                reason: format!("IP {} flagged as active malicious source (score: {:.3})", ip, entry.anomaly_score),
            };
        }

        // 2. Refill token bucket based on elapsed time
        let elapsed = (now - entry.last_refill).num_milliseconds().max(0) as f64 / 1000.0;
        entry.current_tokens = (entry.current_tokens + (elapsed * entry.effective_refill_rate))
            .min(entry.effective_capacity);
        entry.last_refill = now;

        // 3. Check token availability
        if entry.current_tokens >= 1.0 {
            entry.current_tokens -= 1.0;
            entry.total_forwarded += 1;
            Action::Forward
        } else {
            entry.total_throttled += 1;
            let wait_secs = if entry.effective_refill_rate > 0.0 {
                ((1.0 - entry.current_tokens) / entry.effective_refill_rate).ceil() as u64
            } else {
                30
            };
            Action::Throttle {
                retry_after_secs: wait_secs.max(1),
            }
        }
    }

    /// Update client state dynamically based on ML Threat Engine inference score
    pub fn update_threat_score(&self, ip: IpAddr, anomaly_score: f64) {
        let now = Utc::now();
        let mut entry = self.states.entry(ip).or_insert_with(|| ClientState {
            ip,
            reputation_tier: ReputationTier::Clean,
            anomaly_score,
            current_tokens: self.config.base_capacity,
            effective_capacity: self.config.base_capacity,
            effective_refill_rate: self.config.base_refill_rate,
            last_refill: now,
            total_forwarded: 0,
            total_throttled: 0,
            total_blocked: 0,
        });

        entry.anomaly_score = anomaly_score;

        // Determine Reputation Tier
        if anomaly_score >= self.config.block_threshold {
            entry.reputation_tier = ReputationTier::Blocked;
            entry.effective_capacity = 0.0;
            entry.effective_refill_rate = 0.0;
            entry.current_tokens = 0.0;
        } else if anomaly_score >= self.config.anomaly_threshold {
            entry.reputation_tier = ReputationTier::Throttled;
            // Mathematical Quadratic Throttling Formula:
            // C_eff = C_base * max(0, 1 - ((s - s_thresh)/(1 - s_thresh))^2)
            let s_thresh = self.config.anomaly_threshold;
            let penalty_factor = ((anomaly_score - s_thresh) / (1.0 - s_thresh)).powi(2).min(1.0);
            let multiplier = (1.0 - penalty_factor).max(0.01);

            entry.effective_capacity = self.config.base_capacity * multiplier;
            entry.effective_refill_rate = self.config.base_refill_rate * multiplier;
            entry.current_tokens = entry.current_tokens.min(entry.effective_capacity);
        } else if anomaly_score >= 0.50 {
            entry.reputation_tier = ReputationTier::Monitored;
            entry.effective_capacity = self.config.base_capacity;
            entry.effective_refill_rate = self.config.base_refill_rate;
        } else {
            entry.reputation_tier = ReputationTier::Clean;
            entry.effective_capacity = self.config.base_capacity;
            entry.effective_refill_rate = self.config.base_refill_rate;
        }
    }

    /// Dump all active client states for Prometheus/Dashboard export
    pub fn get_all_states(&self) -> Vec<ClientState> {
        self.states.iter().map(|kv| kv.value().clone()).collect()
    }
}
