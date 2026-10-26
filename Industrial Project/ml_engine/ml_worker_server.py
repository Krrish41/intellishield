import json
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
import sys
import os

# Add parent directory to path
sys.path.insert(0, os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
from ml_engine.isolation_forest_engine import IntelliShieldMLEngine

engine = IntelliShieldMLEngine()

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True

class MLRequestHandler(BaseHTTPRequestHandler):
    def do_POST(self):
        if self.path == "/score_batch":
            content_length = int(self.headers.get('Content-Length', 0))
            body = self.rfile.read(content_length)
            
            try:
                data = json.loads(body.decode('utf-8'))
                features = data.get("features", [])
                
                start_t = time.perf_counter()
                scores = engine.score_batch(features)
                elapsed_ms = (time.perf_counter() - start_t) * 1000.0
                
                response_data = {
                    "status": "success",
                    "scores": scores,
                    "inference_time_ms": round(elapsed_ms, 3),
                    "evaluated_count": len(features)
                }
                
                resp_bytes = json.dumps(response_data).encode('utf-8')
                self.send_response(200)
                self.send_header("Content-Type", "application/json")
                self.send_header("Content-Length", str(len(resp_bytes)))
                self.end_headers()
                self.wfile.write(resp_bytes)
            except Exception as e:
                self.send_response(500)
                self.send_header("Content-Type", "application/json")
                self.end_headers()
                self.wfile.write(json.dumps({"error": str(e)}).encode('utf-8'))
        else:
            self.send_response(404)
            self.end_headers()

    def do_GET(self):
        if self.path == "/health":
            resp = json.dumps({"status": "healthy", "service": "intellishield-ml-worker"}).encode('utf-8')
            self.send_response(200)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(resp)))
            self.end_headers()
            self.wfile.write(resp)
        else:
            self.send_response(404)
            self.end_headers()

    def log_message(self, format, *args):
        # Suppress verbose per-request access logs
        pass

def run_server(port=5001):
    server = ThreadedHTTPServer(("0.0.0.0", port), MLRequestHandler)
    print(f"[IntelliShield ML Worker] Inference service listening on http://0.0.0.0:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[IntelliShield ML Worker] Shutting down...")
        server.server_close()

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 5001
    run_server(port)
