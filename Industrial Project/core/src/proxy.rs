use crate::mitigation::{Action, MitigationEngine};
use crate::telemetry::{RequestEvent, TelemetryEngine};
use axum::{
    body::Body,
    extract::{ConnectInfo, Request, State},
    http::{Response, StatusCode},
    response::IntoResponse,
};
use bytes::Bytes;
use chrono::Utc;
use http_body_util::BodyExt;
use std::net::{IpAddr, SocketAddr};
use std::sync::Arc;

#[derive(Clone)]
pub struct ProxyState {
    pub upstream_url: String,
    pub mitigation: MitigationEngine,
    pub telemetry: TelemetryEngine,
    pub client: reqwest::Client,
}

/// Main proxy routing handler
pub async fn proxy_handler(
    State(state): State<Arc<ProxyState>>,
    ConnectInfo(addr): ConnectInfo<SocketAddr>,
    req: Request,
) -> Response<Body> {
    let uri_path = req.uri().path().to_string();

    // Check if request is for the interactive web dashboard or static assets
    if uri_path == "/dashboard"
        || uri_path.starts_with("/dashboard/")
        || uri_path.starts_with("/css/")
        || uri_path.starts_with("/js/")
        || uri_path == "/manifest.json"
        || uri_path == "/sw.js"
        || uri_path == "/favicon.ico"
        || uri_path == "/favicon.svg"
    {
        if let Some(resp) = serve_dashboard_file(&uri_path) {
            return resp;
        }
    }

    // 1. Resolve Client IP
    let client_ip = extract_client_ip(&req, addr.ip());
    let method = req.method().to_string();
    let user_agent = req
        .headers()
        .get("user-agent")
        .and_then(|v| v.to_str().ok())
        .unwrap_or("unknown")
        .to_string();

    // 2. Pre-flight Fast Path Check (< 0.05 ms)
    match state.mitigation.check_and_consume(client_ip) {
        Action::Block { reason } => {
            state.telemetry.emit(RequestEvent {
                client_ip,
                timestamp: Utc::now(),
                method,
                uri_path,
                payload_size: 0,
                status_code: 403,
                user_agent,
            });

            let body_json = serde_json::json!({
                "status": "blocked",
                "code": 403,
                "error": "IntelliShield Security Violation",
                "message": reason,
                "client_ip": client_ip.to_string()
            });

            return Response::builder()
                .status(StatusCode::FORBIDDEN)
                .header("content-type", "application/json")
                .header("x-intellishield-mitigation", "blocked")
                .body(Body::from(serde_json::to_vec(&body_json).unwrap()))
                .unwrap();
        }
        Action::Throttle { retry_after_secs } => {
            state.telemetry.emit(RequestEvent {
                client_ip,
                timestamp: Utc::now(),
                method,
                uri_path,
                payload_size: 0,
                status_code: 429,
                user_agent,
            });

            let body_json = serde_json::json!({
                "status": "rate_limited",
                "code": 429,
                "error": "Too Many Requests",
                "message": "Rate limit exceeded. Anomaly scoring has triggered dynamic throttling.",
                "retry_after_seconds": retry_after_secs,
                "client_ip": client_ip.to_string()
            });

            return Response::builder()
                .status(StatusCode::TOO_MANY_REQUESTS)
                .header("content-type", "application/json")
                .header("retry-after", retry_after_secs.to_string())
                .header("x-intellishield-mitigation", "throttled")
                .body(Body::from(serde_json::to_vec(&body_json).unwrap()))
                .unwrap();
        }
        Action::Forward => {}
    }

    // 3. Fast Path Forwarding to Upstream Microservice
    let upstream_target = format!(
        "{}{}",
        state.upstream_url,
        req.uri().path_and_query().map(|pq| pq.as_str()).unwrap_or("")
    );

    let (parts, body) = req.into_parts();
    let body_bytes = match body.collect().await {
        Ok(collected) => collected.to_bytes(),
        Err(_) => Bytes::new(),
    };
    let payload_size = body_bytes.len();

    let mut forward_req = state
        .client
        .request(parts.method.clone(), &upstream_target);

    for (k, v) in &parts.headers {
        if k != "host" {
            forward_req = forward_req.header(k.as_str(), v.as_bytes());
        }
    }
    forward_req = forward_req.header("X-Forwarded-For", client_ip.to_string());
    forward_req = forward_req.body(body_bytes);

    let (status_code, resp_bytes, resp_headers) = match forward_req.send().await {
        Ok(res) => {
            let status = res.status();
            let headers = res.headers().clone();
            let b = res.bytes().await.unwrap_or_default();
            (status.as_u16(), b, headers)
        }
        Err(err) => {
            let error_json = serde_json::json!({
                "error": "Bad Gateway",
                "message": format!("Upstream microservice unreachable: {}", err),
                "upstream": upstream_target
            });
            (
                StatusCode::BAD_GATEWAY.as_u16(),
                Bytes::from(serde_json::to_vec(&error_json).unwrap()),
                reqwest::header::HeaderMap::new(),
            )
        }
    };

    // 4. Asynchronous Non-Blocking Telemetry Submission
    state.telemetry.emit(RequestEvent {
        client_ip,
        timestamp: Utc::now(),
        method,
        uri_path,
        payload_size,
        status_code,
        user_agent,
    });

    // 5. Build Final Client Response
    let mut response_builder = Response::builder().status(status_code);
    for (name, value) in &resp_headers {
        response_builder = response_builder.header(name.as_str(), value.as_bytes());
    }
    response_builder = response_builder
        .header("x-intellishield-protected", "true")
        .header("x-intellishield-latency", "sub-millisecond-fastpath");

    response_builder.body(Body::from(resp_bytes)).unwrap()
}

/// Metrics and Status Endpoint
pub async fn status_handler(State(state): State<Arc<ProxyState>>) -> impl IntoResponse {
    let clients = state.mitigation.get_all_states();
    let total_forwarded: u64 = clients.iter().map(|c| c.total_forwarded).sum();
    let total_throttled: u64 = clients.iter().map(|c| c.total_throttled).sum();
    let total_blocked: u64 = clients.iter().map(|c| c.total_blocked).sum();

    let json = serde_json::json!({
        "system": "IntelliShield Intelligent Monitoring Reverse Proxy",
        "version": "0.1.0",
        "status": "operational",
        "uptime": "active",
        "summary": {
            "active_monitored_ips": clients.len(),
            "total_requests_forwarded": total_forwarded,
            "total_requests_throttled": total_throttled,
            "total_requests_blocked": total_blocked
        },
        "active_clients": clients
    });

    (StatusCode::OK, [("content-type", "application/json")], serde_json::to_string_pretty(&json).unwrap())
}

/// Live Health Check Endpoint
pub async fn health_handler() -> impl IntoResponse {
    (StatusCode::OK, [("content-type", "application/json")], r#"{"status":"healthy","service":"intellishield-proxy"}"#)
}

fn extract_client_ip(req: &Request, socket_ip: IpAddr) -> IpAddr {
    if let Some(forwarded) = req.headers().get("x-forwarded-for") {
        if let Ok(s) = forwarded.to_str() {
            if let Some(first_ip) = s.split(',').next() {
                if let Ok(ip) = first_ip.trim().parse::<IpAddr>() {
                    return ip;
                }
            }
        }
    }
    if let Some(real_ip) = req.headers().get("x-real-ip") {
        if let Ok(s) = real_ip.to_str() {
            if let Ok(ip) = s.trim().parse::<IpAddr>() {
                return ip;
            }
        }
    }
    socket_ip
}

fn serve_dashboard_file(path_str: &str) -> Option<Response<Body>> {
    let clean = path_str.split('?').next().unwrap_or(path_str);
    let rel = clean.trim_start_matches('/');
    let target = if rel.is_empty() || rel == "dashboard" || rel == "dashboard/" {
        "index.html"
    } else if let Some(stripped) = rel.strip_prefix("dashboard/") {
        stripped
    } else {
        rel
    };

    let candidates = [
        format!("dashboard/{}", target),
        format!("../dashboard/{}", target),
        format!("Industrial Project/dashboard/{}", target),
        format!("assets/{}", target),
        format!("../assets/{}", target),
        format!("Industrial Project/assets/{}", target),
    ];

    for c in &candidates {
        if let Ok(bytes) = std::fs::read(c) {
            let mime = if target.ends_with(".html") {
                "text/html; charset=utf-8"
            } else if target.ends_with(".css") {
                "text/css; charset=utf-8"
            } else if target.ends_with(".js") || target.ends_with(".mjs") {
                "application/javascript; charset=utf-8"
            } else if target.ends_with(".json") {
                "application/json; charset=utf-8"
            } else if target.ends_with(".svg") {
                "image/svg+xml"
            } else if target.ends_with(".ico") {
                "image/x-icon"
            } else if target.ends_with(".png") {
                "image/png"
            } else {
                "application/octet-stream"
            };

            return Response::builder()
                .status(StatusCode::OK)
                .header("content-type", mime)
                .body(Body::from(bytes))
                .ok();
        }
    }

    None
}
