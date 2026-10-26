mod mitigation;
mod ml_client;
mod proxy;
mod telemetry;

use clap::Parser;
use mitigation::{MitigationConfig, MitigationEngine};
use ml_client::MlClient;
use proxy::{health_handler, proxy_handler, status_handler, ProxyState};
use std::net::SocketAddr;
use std::sync::Arc;
use std::time::Duration;
use telemetry::TelemetryEngine;
use tokio::net::TcpListener;
use tracing::{info, warn};

#[derive(Parser, Debug)]
#[command(name = "intellishield-proxy", author = "Krrish Ranjan & Aashman Gupta", version = "0.1.0")]
struct Args {
    #[arg(short, long, default_value = "0.0.0.0:8080")]
    bind: String,

    #[arg(short, long, default_value = "http://127.0.0.1:3000")]
    upstream: String,

    #[arg(short, long, default_value = "http://127.0.0.1:5001")]
    ml_worker: String,

    #[arg(long, default_value_t = 5)]
    window_secs: u64,
}

#[tokio::main]
async fn main() -> Result<(), Box<dyn std::error::Error>> {
    tracing_subscriber::fmt()
        .with_env_filter(
            tracing_subscriber::EnvFilter::try_from_default_env()
                .unwrap_or_else(|_| "info,intellishield_proxy=debug".into()),
        )
        .init();

    let args = Args::parse();

    println!(r#"
  ___       _       _ _ _ ____  _     _      _     _ 
 |_ _|_ __ | |_ ___| | (_) ___|| |__ (_) ___| | __| |
  | || '_ \| __/ _ \ | | \___ \| '_ \| |/ _ \ |/ _` |
  | || | | | ||  __/ | | |___) | | | | |  __/ | (_| |
 |___|_| |_|\__\___|_|_|_|____/|_| |_|_|\___|_|\__,_|
   Intelligent Monitoring & ML Anomaly Mitigation Reverse Proxy
   Course: BCSE497J | Fall 2026 | Team: 23BKT0015 & 23BKT0044
"#);

    info!("Initializing IntelliShield Reverse Proxy Core...");
    info!("Ingress Bind Address: {}", args.bind);
    info!("Upstream Microservice: {}", args.upstream);
    info!("ML Anomaly Inference Worker: {}", args.ml_worker);

    let (telemetry, mut rx) = TelemetryEngine::new(100_000, Duration::from_secs(args.window_secs));
    let mitigation = MitigationEngine::new(MitigationConfig::default());
    let ml_client = MlClient::new(args.ml_worker.clone());

    let reqwest_client = reqwest::Client::builder()
        .pool_max_idle_per_host(200)
        .connect_timeout(Duration::from_millis(500))
        .timeout(Duration::from_secs(10))
        .build()?;

    let state = Arc::new(ProxyState {
        upstream_url: args.upstream.trim_end_matches('/').to_string(),
        mitigation: mitigation.clone(),
        telemetry: telemetry.clone(),
        client: reqwest_client,
    });

    // ----------------------------------------------------
    // BACKGROUND TASK 1: Telemetry Event Consumer
    // ----------------------------------------------------
    let telemetry_clone = telemetry.clone();
    tokio::spawn(async move {
        info!("Telemetry consumer worker loop started.");
        while let Some(event) = rx.recv().await {
            telemetry_clone.ingest(event).await;
        }
    });

    // ----------------------------------------------------
    // BACKGROUND TASK 2: ML Inference & Threat Scoring Loop
    // ----------------------------------------------------
    let telemetry_for_ml = telemetry.clone();
    let mitigation_for_ml = mitigation.clone();
    tokio::spawn(async move {
        info!("Asynchronous ML Threat Intelligence loop active (Evaluation interval: 1000 ms).");
        let mut interval = tokio::time::interval(Duration::from_millis(1000));
        loop {
            interval.tick().await;
            let active_features = telemetry_for_ml.extract_active_features().await;
            if !active_features.is_empty() {
                let scores = ml_client.score_batch(&active_features).await;
                for (ip, score) in scores {
                    if score >= 0.65 {
                        warn!(
                            "Threat anomaly detected for IP {}: Score = {:.3} -> Applying dynamic mitigation",
                            ip, score
                        );
                    }
                    mitigation_for_ml.update_threat_score(ip, score);
                }
            }
        }
    });

    // ----------------------------------------------------
    // BACKGROUND TASK 3: Periodic Cache Pruning
    // ----------------------------------------------------
    let telemetry_pruner = telemetry.clone();
    tokio::spawn(async move {
        let mut interval = tokio::time::interval(Duration::from_secs(30));
        loop {
            interval.tick().await;
            telemetry_pruner.prune_stale_entries(Duration::from_secs(60)).await;
        }
    });

    // ----------------------------------------------------
    // AXUM ROUTER & HTTP SERVER
    // ----------------------------------------------------
    let app = axum::Router::new()
        .route("/intellishield/status", axum::routing::get(status_handler))
        .route("/intellishield/health", axum::routing::get(health_handler))
        .fallback(proxy_handler)
        .with_state(state);

    let listener = TcpListener::bind(&args.bind).await?;
    info!("IntelliShield Proxy successfully listening on http://{}", args.bind);

    axum::serve(
        listener,
        app.into_make_service_with_connect_info::<SocketAddr>(),
    )
    .await?;

    Ok(())
}
