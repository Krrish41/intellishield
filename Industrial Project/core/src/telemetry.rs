use chrono::{DateTime, Utc};
use serde::{Deserialize, Serialize};
use std::collections::{HashMap, VecDeque};
use std::net::IpAddr;
use std::sync::Arc;
use std::time::Duration;
use tokio::sync::mpsc;
use tokio::sync::RwLock;

/// Single request metadata emitted from the fast path
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RequestEvent {
    pub client_ip: IpAddr,
    pub timestamp: DateTime<Utc>,
    pub method: String,
    pub uri_path: String,
    pub payload_size: usize,
    pub status_code: u16,
    pub user_agent: String,
}

/// 8-Dimensional feature vector computed over a sliding window
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FeatureVector {
    pub client_ip: String,
    pub request_rate: f64,               // f1: requests per second
    pub inter_arrival_variance: f64,     // f2: delta t variance
    pub uri_shannon_entropy: f64,        // f3: Shannon entropy of URI paths
    pub payload_size_variance: f64,      // f4: variance in request body byte lengths
    pub get_method_ratio: f64,           // f5: GET ratio
    pub post_method_ratio: f64,          // f5: POST ratio
    pub error_status_ratio: f64,         // f7: 4xx/5xx status ratio
    pub header_fingerprint_variance: f64,// f6: User-Agent / header diversity
    pub window_sample_count: usize,
}

/// Rolling ring buffer per active client IP
#[derive(Debug)]
struct IpWindow {
    events: VecDeque<RequestEvent>,
}

impl IpWindow {
    fn new() -> Self {
        Self {
            events: VecDeque::with_capacity(500),
        }
    }

    fn add_event(&mut self, event: RequestEvent, max_window: Duration) {
        let cutoff = event.timestamp - chrono::Duration::from_std(max_window).unwrap();
        self.events.push_back(event);
        while let Some(front) = self.events.front() {
            if front.timestamp < cutoff {
                self.events.pop_front();
            } else {
                break;
            }
        }
    }

    fn compute_features(&self, ip: IpAddr, window_duration_secs: f64) -> Option<FeatureVector> {
        let n = self.events.len();
        if n < 3 {
            return None; // Require minimum samples for statistical validity
        }

        // f1: Request rate
        let request_rate = n as f64 / window_duration_secs;

        // f2: Inter-arrival time variance
        let mut deltas = Vec::with_capacity(n - 1);
        let mut prev_ts = self.events[0].timestamp;
        for ev in self.events.iter().skip(1) {
            let delta = (ev.timestamp - prev_ts).num_milliseconds() as f64 / 1000.0;
            deltas.push(delta);
            prev_ts = ev.timestamp;
        }

        let mean_delta = if !deltas.is_empty() {
            deltas.iter().sum::<f64>() / deltas.len() as f64
        } else {
            0.0
        };

        let inter_arrival_variance = if deltas.len() > 1 {
            deltas.iter().map(|d| (d - mean_delta).powi(2)).sum::<f64>() / deltas.len() as f64
        } else {
            0.0
        };

        // f3: URI Shannon Entropy
        let mut path_counts: HashMap<&str, usize> = HashMap::new();
        for ev in &self.events {
            *path_counts.entry(&ev.uri_path).or_insert(0) += 1;
        }

        let uri_shannon_entropy = path_counts.values().fold(0.0, |acc, &count| {
            let p = count as f64 / n as f64;
            acc - (p * p.log2())
        });

        // f4: Payload size variance
        let mean_payload = self.events.iter().map(|e| e.payload_size as f64).sum::<f64>() / n as f64;
        let payload_size_variance = self.events.iter().map(|e| (e.payload_size as f64 - mean_payload).powi(2)).sum::<f64>() / n as f64;

        // f5: Method ratios
        let get_count = self.events.iter().filter(|e| e.method == "GET").count();
        let post_count = self.events.iter().filter(|e| e.method == "POST").count();
        let get_method_ratio = get_count as f64 / n as f64;
        let post_method_ratio = post_count as f64 / n as f64;

        // f7: Error status code ratio
        let error_count = self.events.iter().filter(|e| e.status_code >= 400).count();
        let error_status_ratio = error_count as f64 / n as f64;

        // f6: User-Agent diversity
        let mut ua_counts: HashMap<&str, usize> = HashMap::new();
        for ev in &self.events {
            *ua_counts.entry(&ev.user_agent).or_insert(0) += 1;
        }
        let header_fingerprint_variance = (ua_counts.len() as f64) / (n as f64);

        Some(FeatureVector {
            client_ip: ip.to_string(),
            request_rate,
            inter_arrival_variance,
            uri_shannon_entropy,
            payload_size_variance,
            get_method_ratio,
            post_method_ratio,
            error_status_ratio,
            header_fingerprint_variance,
            window_sample_count: n,
        })
    }
}

/// Asynchronous Telemetry Engine
#[derive(Clone)]
pub struct TelemetryEngine {
    tx: mpsc::Sender<RequestEvent>,
    windows: Arc<RwLock<HashMap<IpAddr, IpWindow>>>,
    window_duration: Duration,
}

impl TelemetryEngine {
    pub fn new(channel_capacity: usize, window_duration: Duration) -> (Self, mpsc::Receiver<RequestEvent>) {
        let (tx, rx) = mpsc::channel(channel_capacity);
        let engine = Self {
            tx,
            windows: Arc::new(RwLock::new(HashMap::new())),
            window_duration,
        };
        (engine, rx)
    }

    /// Non-blocking telemetry event submission
    pub fn emit(&self, event: RequestEvent) {
        let tx = self.tx.clone();
        tokio::spawn(async move {
            let _ = tx.try_send(event); // Non-blocking drop on channel saturation
        });
    }

    /// Ingest an event into the rolling window
    pub async fn ingest(&self, event: RequestEvent) {
        let mut map = self.windows.write().await;
        let window = map.entry(event.client_ip).or_insert_with(IpWindow::new);
        window.add_event(event, self.window_duration);
    }

    /// Extract feature vectors across all active client windows
    pub async fn extract_active_features(&self) -> Vec<FeatureVector> {
        let map = self.windows.read().await;
        let secs = self.window_duration.as_secs_f64();
        let mut features = Vec::new();
        for (&ip, window) in map.iter() {
            if let Some(fv) = window.compute_features(ip, secs) {
                features.push(fv);
            }
        }
        features
    }

    /// Evict stale IP windows
    pub async fn prune_stale_entries(&self, max_idle: Duration) {
        let now = Utc::now();
        let cutoff = now - chrono::Duration::from_std(max_idle).unwrap();
        let mut map = self.windows.write().await;
        map.retain(|_, window| {
            window.events.back().map_or(false, |last| last.timestamp >= cutoff)
        });
    }
}
