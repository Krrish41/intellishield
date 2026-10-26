use crate::telemetry::FeatureVector;
use serde::{Deserialize, Serialize};
use std::collections::HashMap;
use std::net::IpAddr;
use std::time::Duration;

#[derive(Debug, Serialize, Deserialize)]
pub struct AnomalyScoreResponse {
    pub scores: HashMap<String, f64>,
}

#[derive(Clone)]
pub struct MlClient {
    client: reqwest::Client,
    ml_worker_url: String,
}

impl MlClient {
    pub fn new(ml_worker_url: String) -> Self {
        let client = reqwest::Client::builder()
            .timeout(Duration::from_millis(500))
            .build()
            .unwrap();

        Self {
            client,
            ml_worker_url,
        }
    }

    /// Query ML server for batch inference; fallback to embedded statistical scorer if offline
    pub async fn score_batch(&self, features: &[FeatureVector]) -> HashMap<IpAddr, f64> {
        let mut results = HashMap::new();
        if features.is_empty() {
            return results;
        }

        let payload = serde_json::json!({ "features": features });
        let url = format!("{}/score_batch", self.ml_worker_url);

        match self.client.post(&url).json(&payload).send().await {
            Ok(res) if res.status().is_success() => {
                if let Ok(data) = res.json::<AnomalyScoreResponse>().await {
                    for (ip_str, score) in data.scores {
                        if let Ok(ip) = ip_str.parse::<IpAddr>() {
                            results.insert(ip, score);
                        }
                    }
                    return results;
                }
            }
            _ => {
                // Fallback: Built-in mathematical Isolation Forest heuristic
                for fv in features {
                    if let Ok(ip) = fv.client_ip.parse::<IpAddr>() {
                        let fallback_score = Self::compute_embedded_anomaly_score(fv);
                        results.insert(ip, fallback_score);
                    }
                }
            }
        }

        results
    }

    /// Embedded mathematical anomaly heuristic when Python ML service is starting or offline
    fn compute_embedded_anomaly_score(fv: &FeatureVector) -> f64 {
        let mut anomaly_indicators: f64 = 0.0;

        // 1. High request frequency anomaly
        if fv.request_rate > 80.0 {
            anomaly_indicators += 0.35;
        } else if fv.request_rate > 35.0 {
            anomaly_indicators += 0.20;
        }

        // 2. Near-zero inter-arrival time variance (characteristic of programmatic bots)
        if fv.inter_arrival_variance < 0.005 && fv.request_rate > 5.0 {
            anomaly_indicators += 0.30;
        }

        // 3. Low URI Shannon Entropy (tight single-endpoint attack / scraping)
        if fv.uri_shannon_entropy < 0.20 && fv.window_sample_count > 10 {
            anomaly_indicators += 0.25;
        }

        // 4. High 4xx error ratio (credential stuffing / probing)
        if fv.error_status_ratio > 0.40 {
            anomaly_indicators += 0.30;
        }

        // 5. Zero header fingerprint diversity
        if fv.header_fingerprint_variance < 0.15 && fv.window_sample_count > 15 {
            anomaly_indicators += 0.15;
        }

        anomaly_indicators.min(0.99).max(0.05)
    }
}
