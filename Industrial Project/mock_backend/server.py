import json
import time
from http.server import HTTPServer, BaseHTTPRequestHandler
from socketserver import ThreadingMixIn
import sys

class ThreadedHTTPServer(ThreadingMixIn, HTTPServer):
    daemon_threads = True

class BackendAPIHandler(BaseHTTPRequestHandler):
    def do_GET(self):
        if self.path.startswith("/api/v1/products"):
            products = [
                {"id": 101, "name": "Secure Gateway X1", "price": 499.0, "category": "Hardware"},
                {"id": 102, "name": "API Shield Pro License", "price": 120.0, "category": "Software"},
                {"id": 103, "name": "Cloud Telemetry Sensor", "price": 250.0, "category": "IoT"},
                {"id": 104, "name": "Threat Feed Subscription", "price": 75.0, "category": "Data"}
            ]
            self._send_json(200, {"status": "success", "products": products, "timestamp": time.time()})
        elif self.path.startswith("/api/v1/user/profile"):
            user = {
                "user_id": "usr_99812",
                "email": "krrish.ranjan@example.com",
                "role": "enterprise_admin",
                "organization": "Industrial Systems Corp"
            }
            self._send_json(200, {"status": "success", "user": user})
        elif self.path == "/health":
            self._send_json(200, {"status": "healthy", "service": "upstream-mock-backend"})
        else:
            self._send_json(404, {"error": "Not Found", "path": self.path})

    def do_POST(self):
        content_length = int(self.headers.get('Content-Length', 0))
        body = self.rfile.read(content_length)
        
        if self.path == "/api/v1/auth/login":
            try:
                data = json.loads(body.decode('utf-8'))
                username = data.get("username", "")
                password = data.get("password", "")
                
                # Simulate credential check
                if username == "admin" and password == "secret123":
                    self._send_json(200, {"status": "authenticated", "token": "jwt_token_valid_887192"})
                else:
                    self._send_json(401, {"error": "Unauthorized", "message": "Invalid username or password"})
            except Exception:
                self._send_json(400, {"error": "Bad Request", "message": "Invalid JSON body"})
        elif self.path == "/api/v1/checkout":
            self._send_json(200, {"status": "order_confirmed", "order_id": "ord_771829", "total": 619.0})
        else:
            self._send_json(404, {"error": "Not Found", "path": self.path})

    def _send_json(self, status_code: int, data: dict):
        resp_bytes = json.dumps(data).encode('utf-8')
        self.send_response(status_code)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(resp_bytes)))
        self.send_header("X-Upstream-Backend", "Microservice-V1")
        self.end_headers()
        self.wfile.write(resp_bytes)

    def log_message(self, format, *args):
        pass

def run_backend(port=3000):
    server = ThreadedHTTPServer(("0.0.0.0", port), BackendAPIHandler)
    print(f"[Mock Upstream Backend] Protected service listening on http://0.0.0.0:{port}")
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        print("\n[Mock Upstream Backend] Shutting down...")
        server.server_close()

if __name__ == "__main__":
    port = int(sys.argv[1]) if len(sys.argv) > 1 else 3000
    run_backend(port)
