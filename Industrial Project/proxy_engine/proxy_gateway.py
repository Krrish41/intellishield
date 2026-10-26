import asyncio
import time
import math
import json
import urllib.request
import urllib.error
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
from collections import deque, defaultdict
import sys
import os

ROOT_DIR = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if ROOT_DIR not in sys.path:
    sys.path.insert(0, ROOT_DIR)
from proxy_engine.dashboard_html import DASHBOARD_HTML

event_ring_buffer = deque(maxlen=150)

class ReputationTier:
    CLEAN = "Clean"
    MONITORED = "Monitored"
    THROTTLED = "Throttled"
    BLOCKED = "Blocked"

class ClientState:
    def __init__(self, ip: str, base_capacity: float = 30.0, base_refill: float = 8.0):
        self.ip = ip
        self.reputation_tier = ReputationTier.CLEAN
        self.anomaly_score = 0.05
        self.current_tokens = base_capacity
        self.effective_capacity = base_capacity
        self.effective_refill_rate = base_refill
        self.last_refill = time.time()
        self.total_forwarded = 0
        self.total_throttled = 0
        self.total_blocked = 0

class SlidingWindowTelemetry:
    def __init__(self, window_duration_sec: float = 5.0):
        self.window_duration = window_duration_sec
        self.windows = defaultdict(deque)

    def record_event(self, ip: str, method: str, path: str, payload_len: int, status: int, ua: str):
        now = time.time()
        self.windows[ip].append((now, method, path, payload_len, status, ua))
        cutoff = now - self.window_duration
        q = self.windows[ip]
        while q and q[0][0] < cutoff:
            q.popleft()

    def extract_features(self) -> list:
        now = time.time()
        cutoff = now - self.window_duration
        features_list = []
        
        for ip, q in list(self.windows.items()):
            while q and q[0][0] < cutoff:
                q.popleft()
                
            n = len(q)
            if n < 2:
                continue
                
            req_rate = n / self.window_duration
            
            timestamps = [t[0] for t in q]
            deltas = [timestamps[i] - timestamps[i-1] for i in range(1, len(timestamps))]
            if deltas:
                mean_delta = sum(deltas) / len(deltas)
                var_delta = sum((d - mean_delta) ** 2 for d in deltas) / len(deltas)
            else:
                var_delta = 0.5
                
            path_counts = defaultdict(int)
            for item in q:
                path_counts[item[2]] += 1
            entropy = -sum((c / n) * math.log2(c / n) for c in path_counts.values()) if path_counts else 2.0
            
            payload_sizes = [item[3] for item in q]
            mean_payload = sum(payload_sizes) / n
            var_payload = sum((p - mean_payload) ** 2 for p in payload_sizes) / n
            
            get_count = sum(1 for item in q if item[1] == "GET")
            post_count = sum(1 for item in q if item[1] == "POST")
            err_count = sum(1 for item in q if item[4] >= 400)
            ua_count = len(set(item[5] for item in q))
            
            features_list.append({
                "client_ip": ip,
                "request_rate": req_rate,
                "inter_arrival_variance": var_delta,
                "uri_shannon_entropy": entropy,
                "payload_size_variance": var_payload,
                "get_method_ratio": get_count / n,
                "post_method_ratio": post_count / n,
                "error_status_ratio": err_count / n,
                "header_fingerprint_variance": ua_count / n,
                "window_sample_count": n
            })
            
        return features_list

class MitigationEngine:
    def __init__(self, base_capacity=30.0, base_refill=8.0, anomaly_threshold=0.65, block_threshold=0.85):
        self.base_capacity = base_capacity
        self.base_refill = base_refill
        self.anomaly_threshold = anomaly_threshold
        self.block_threshold = block_threshold
        self.clients = {}

    def get_state(self, ip: str) -> ClientState:
        if ip not in self.clients:
            self.clients[ip] = ClientState(ip, self.base_capacity, self.base_refill)
        return self.clients[ip]

    def check_and_consume(self, ip: str) -> tuple:
        state = self.get_state(ip)
        now = time.time()
        
        # Block check
        if state.reputation_tier == ReputationTier.BLOCKED:
            state.total_blocked += 1
            return "block", f"IP {ip} blocked by IntelliShield (Anomaly Threat Score: {state.anomaly_score:.3f})"
            
        # Refill token bucket
        elapsed = max(0.0, now - state.last_refill)
        state.current_tokens = min(state.effective_capacity, state.current_tokens + (elapsed * state.effective_refill_rate))
        state.last_refill = now
        
        # Token check
        if state.current_tokens >= 1.0:
            state.current_tokens -= 1.0
            state.total_forwarded += 1
            return "forward", ""
        else:
            state.total_throttled += 1
            wait_secs = max(1, int(math.ceil((1.0 - state.current_tokens) / max(0.1, state.effective_refill_rate))))
            return "throttle", f"Rate limit exceeded (Capacity: {state.effective_capacity:.1f}, Refill: {state.effective_refill_rate:.1f}/s)"

    def update_threat_score(self, ip: str, score: float):
        state = self.get_state(ip)
        state.anomaly_score = score
        
        if score >= self.block_threshold:
            state.reputation_tier = ReputationTier.BLOCKED
            state.effective_capacity = 0.0
            state.effective_refill_rate = 0.0
            state.current_tokens = 0.0
        elif score >= self.anomaly_threshold:
            state.reputation_tier = ReputationTier.THROTTLED
            penalty = ((score - self.anomaly_threshold) / (1.0 - self.anomaly_threshold)) ** 2
            mult = max(0.01, 1.0 - min(1.0, penalty))
            state.effective_capacity = self.base_capacity * mult
            state.effective_refill_rate = self.base_refill * mult
            state.current_tokens = min(state.current_tokens, state.effective_capacity)
        elif score >= 0.50:
            state.reputation_tier = ReputationTier.MONITORED
            state.effective_capacity = self.base_capacity
            state.effective_refill_rate = self.base_refill
        else:
            state.reputation_tier = ReputationTier.CLEAN
            state.effective_capacity = self.base_capacity
            state.effective_refill_rate = self.base_refill

telemetry = SlidingWindowTelemetry(window_duration_sec=5.0)
mitigation = MitigationEngine()
UPSTREAM_URL = "http://127.0.0.1:3000"
ML_WORKER_URL = "http://127.0.0.1:5001"
ml_worker_status = "healthy"
backend_status = "healthy"

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True

class ProxyHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        self._handle_request("GET")

    def do_POST(self):
        self._handle_request("POST")

    def do_PUT(self):
        self._handle_request("PUT")

    def do_DELETE(self):
        self._handle_request("DELETE")

    def _handle_request(self, method: str):
        global backend_status
        start_t = time.perf_counter()

        # 1. Favicon Handlers
        if self.path == "/favicon.ico":
            ico_path = os.path.join(ROOT_DIR, "assets", "favicon.ico")
            if os.path.exists(ico_path):
                with open(ico_path, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "image/x-icon")
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return
        elif self.path == "/favicon.svg":
            svg_path = os.path.join(ROOT_DIR, "assets", "favicon.svg")
            if os.path.exists(svg_path):
                with open(svg_path, "rb") as f:
                    content = f.read()
                self.send_response(200)
                self.send_header("Content-Type", "image/svg+xml")
                self.send_header("Content-Length", str(len(content)))
                self.end_headers()
                self.wfile.write(content)
                return

        # 2. Interactive Web Dashboard UI & Static Assets
        dashboard_dir = os.path.join(ROOT_DIR, "dashboard")
        clean_path = self.path.split('?')[0]

        if clean_path in ["/", "/dashboard", "/dashboard/", "/intellishield/dashboard"]:
            index_file = os.path.join(dashboard_dir, "index.html")
            if os.path.exists(index_file):
                with open(index_file, "rb") as f:
                    content = f.read()
            else:
                content = DASHBOARD_HTML.encode('utf-8')
            self.send_response(200)
            self.send_header("Content-Type", "text/html; charset=utf-8")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
            return

        rel_path = clean_path.lstrip('/')
        if rel_path.startswith('dashboard/'):
            rel_path = rel_path[len('dashboard/'):]

        candidate_file = os.path.join(dashboard_dir, rel_path.replace('/', os.sep))
        if os.path.isfile(candidate_file) and not os.path.isabs(rel_path) and ".." not in rel_path:
            ext = os.path.splitext(candidate_file)[1].lower()
            mime_map = {
                ".html": "text/html; charset=utf-8",
                ".css": "text/css; charset=utf-8",
                ".js": "application/javascript; charset=utf-8",
                ".mjs": "application/javascript; charset=utf-8",
                ".json": "application/json; charset=utf-8",
                ".svg": "image/svg+xml",
                ".ico": "image/x-icon",
                ".png": "image/png",
                ".jpg": "image/jpeg",
                ".jpeg": "image/jpeg",
                ".woff2": "font/woff2"
            }
            mime = mime_map.get(ext, "application/octet-stream")
            with open(candidate_file, "rb") as f:
                content = f.read()
            self.send_response(200)
            self.send_header("Content-Type", mime)
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
            return

        # 3. Live Events Stream API
        if self.path == "/intellishield/events":
            content = json.dumps(list(event_ring_buffer)).encode('utf-8')
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(content)))
            self.end_headers()
            self.wfile.write(content)
            return

        # 4. Interactive Simulation Trigger API
        if self.path == "/intellishield/simulate" and method == "POST":
            content_len = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_len).decode('utf-8') if content_len > 0 else "{}"
            try:
                data = json.loads(body)
                scenario = data.get("scenario", "all")
                from simulator.traffic_generator import (
                    simulate_legitimate_users, simulate_volumetric_ddos,
                    simulate_low_and_slow_bot, simulate_credential_stuffing,
                    simulate_flash_crowd
                )
                import threading
                def run_sim():
                    if scenario == "benign":
                        simulate_legitimate_users(num_users=3, duration_sec=3)
                    elif scenario == "ddos":
                        simulate_volumetric_ddos(requests_count=80)
                    elif scenario == "scrape":
                        simulate_low_and_slow_bot(count=20)
                    elif scenario == "credential":
                        simulate_credential_stuffing(count=15)
                    elif scenario == "flash":
                        simulate_flash_crowd(num_users=12, duration_sec=3)
                    elif scenario == "all":
                        simulate_legitimate_users(num_users=2, duration_sec=2)
                        time.sleep(0.4)
                        simulate_volumetric_ddos(requests_count=60)
                        time.sleep(0.4)
                        simulate_low_and_slow_bot(count=15)
                        time.sleep(0.4)
                        simulate_credential_stuffing(count=15)
                        time.sleep(0.4)
                        simulate_flash_crowd(num_users=10, duration_sec=3)
                threading.Thread(target=run_sim, daemon=True).start()
                resp = json.dumps({"status": "success", "message": f"Simulation scenario '{scenario}' initiated"}).encode('utf-8')
            except Exception as e:
                resp = json.dumps({"status": "error", "message": str(e)}).encode('utf-8')
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(resp)))
            self.end_headers()
            self.wfile.write(resp)
            return

        # 5. Reset Telemetry API
        if self.path == "/intellishield/reset" and method == "POST":
            mitigation.clients.clear()
            telemetry.windows.clear()
            event_ring_buffer.clear()
            resp = json.dumps({"status": "reset", "message": "All client telemetry reset"}).encode('utf-8')
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(resp)))
            self.end_headers()
            self.wfile.write(resp)
            return

        if self.path == "/intellishield/status":
            states = [
                {
                    "ip": s.ip,
                    "tier": s.reputation_tier,
                    "anomaly_score": round(s.anomaly_score, 4),
                    "current_tokens": round(s.current_tokens, 2),
                    "capacity": round(s.effective_capacity, 2),
                    "refill_rate": round(s.effective_refill_rate, 2),
                    "forwarded": s.total_forwarded,
                    "throttled": s.total_throttled,
                    "blocked": s.total_blocked
                }
                for s in mitigation.clients.values()
            ]
            resp = json.dumps({
                "system": "IntelliShield Intelligent Monitoring Reverse Proxy",
                "version": "0.1.0",
                "status": "active",
                "active_clients": len(states),
                "clients": states
            }, indent=2).encode('utf-8')
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(resp)))
            self.end_headers()
            self.wfile.write(resp)
            return

        if self.path == "/intellishield/health":
            resp = json.dumps({
                "status": "healthy",
                "service": "intellishield-proxy",
                "ml_worker": ml_worker_status,
                "backend": backend_status
            }).encode('utf-8')
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(resp)))
            self.end_headers()
            self.wfile.write(resp)
            return

        client_ip = self.headers.get("X-Forwarded-For", self.client_address[0]).split(",")[0].strip()
        ua = self.headers.get("User-Agent", "unknown")
        
        # Pre-flight Fast Check
        action, msg = mitigation.check_and_consume(client_ip)
        content_len = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_len) if content_len > 0 else b""
        
        if action == "block":
            elapsed_ms = (time.perf_counter() - start_t) * 1000.0
            telemetry.record_event(client_ip, method, self.path, len(body), 403, ua)
            event_ring_buffer.append({
                "time": time.strftime("%H:%M:%S"),
                "ip": client_ip,
                "method": method,
                "path": self.path,
                "status": 403,
                "action": "block",
                "latency": elapsed_ms
            })
            resp = json.dumps({
                "error": "Forbidden",
                "status": "blocked",
                "code": 403,
                "message": msg,
                "client_ip": client_ip
            }).encode('utf-8')
            self.send_response(403)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(resp)))
            self.send_header("X-IntelliShield-Mitigation", "blocked")
            self.end_headers()
            self.wfile.write(resp)
            return

        if action == "throttle":
            elapsed_ms = (time.perf_counter() - start_t) * 1000.0
            telemetry.record_event(client_ip, method, self.path, len(body), 429, ua)
            event_ring_buffer.append({
                "time": time.strftime("%H:%M:%S"),
                "ip": client_ip,
                "method": method,
                "path": self.path,
                "status": 429,
                "action": "throttle",
                "latency": elapsed_ms
            })
            resp = json.dumps({
                "error": "Too Many Requests",
                "status": "rate_limited",
                "code": 429,
                "message": msg,
                "client_ip": client_ip
            }).encode('utf-8')
            self.send_response(429)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(resp)))
            self.send_header("Retry-After", "5")
            self.send_header("X-IntelliShield-Mitigation", "throttled")
            self.end_headers()
            self.wfile.write(resp)
            return

        upstream_url = f"{UPSTREAM_URL}{self.path}"
        req = urllib.request.Request(upstream_url, data=body if method in ["POST", "PUT"] else None, method=method)
        for k, v in self.headers.items():
            if k.lower() not in ["host", "content-length"]:
                req.add_header(k, v)
        req.add_header("X-Forwarded-For", client_ip)

        try:
            with urllib.request.urlopen(req, timeout=5) as response:
                backend_status = "healthy"
                status_code = response.status
                resp_body = response.read()
                resp_headers = response.getheaders()
        except urllib.error.HTTPError as e:
            backend_status = "healthy"
            status_code = e.code
            resp_body = e.read()
            resp_headers = e.headers.items()
        except Exception as e:
            backend_status = "unhealthy"
            status_code = 502
            resp_body = json.dumps({"error": "Bad Gateway", "message": str(e)}).encode('utf-8')
            resp_headers = [("Content-Type", "application/json")]

        elapsed_ms = (time.perf_counter() - start_t) * 1000.0
        telemetry.record_event(client_ip, method, self.path, len(body), status_code, ua)
        event_ring_buffer.append({
            "time": time.strftime("%H:%M:%S"),
            "ip": client_ip,
            "method": method,
            "path": self.path,
            "status": status_code,
            "action": "forward",
            "latency": elapsed_ms
        })

        self.send_response(status_code)
        for k, v in resp_headers:
            if k.lower() not in ["content-length", "transfer-encoding"]:
                self.send_header(k, v)
        self.send_header("Content-Length", str(len(resp_body)))
        self.send_header("X-IntelliShield-Protected", "true")
        self.send_header("X-IntelliShield-Latency", "sub-millisecond-fastpath")
        self.end_headers()
        self.wfile.write(resp_body)

    def log_message(self, format, *args):
        pass

def ml_threat_loop():
    global ml_worker_status
    while True:
        try:
            features = telemetry.extract_features()
            payload = json.dumps({"features": features if features else []}).encode('utf-8')
            req = urllib.request.Request(f"{ML_WORKER_URL}/score_batch", data=payload, method="POST")
            req.add_header("Content-Type", "application/json")
            with urllib.request.urlopen(req, timeout=1.0) as resp:
                data = json.loads(resp.read().decode('utf-8'))
                ml_worker_status = "healthy"
                if features:
                    scores = data.get("scores", {})
                    for ip, score in scores.items():
                        mitigation.update_threat_score(ip, float(score))
        except Exception:
            ml_worker_status = "unhealthy"
        time.sleep(0.5)

def run_proxy(port=8080, upstream="http://127.0.0.1:3000", ml_url="http://127.0.0.1:5001"):
    global UPSTREAM_URL, ML_WORKER_URL
    UPSTREAM_URL = upstream
    ML_WORKER_URL = ml_url

    import threading
    t = threading.Thread(target=ml_threat_loop, daemon=True)
    t.start()

    server = ThreadedHTTPServer(("0.0.0.0", port), ProxyHandler)
    print(f"[IntelliShield Ingress Proxy] Listening on http://0.0.0.0:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[IntelliShield Ingress Proxy] Shutting down...")
        server.server_close()

if __name__ == "__main__":
    port = int(os.environ.get("PORT", sys.argv[1] if len(sys.argv) > 1 else 8080))
    upstream = os.environ.get("UPSTREAM_URL", sys.argv[2] if len(sys.argv) > 2 else "http://127.0.0.1:3000")
    ml_url = os.environ.get("ML_WORKER_URL", sys.argv[3] if len(sys.argv) > 3 else "http://127.0.0.1:5001")
    run_proxy(port, upstream, ml_url)
