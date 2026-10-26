import subprocess
import time
import sys
import os
import signal
import urllib.request
import urllib.error

ROOT_DIR = os.path.dirname(os.path.abspath(__file__))
BACKEND_SCRIPT = os.path.join(ROOT_DIR, "mock_backend", "server.py")
ML_WORKER_SCRIPT = os.path.join(ROOT_DIR, "ml_engine", "ml_worker_server.py")
PROXY_SCRIPT = os.path.join(ROOT_DIR, "proxy_engine", "proxy_gateway.py")
DEMO_SCRIPT = os.path.join(ROOT_DIR, "simulator", "live_demo.py")

processes = []

def start_services():
    global processes
    print("=" * 80)
    print("  LAUNCHING INTELLISHIELD MULTI-TIER SYSTEM ARCHITECTURE")
    print("=" * 80)
    
    # 1. Start Mock Upstream Microservice on Port 3000
    print("[1/3] Starting Mock Upstream Microservice on http://127.0.0.1:3000...")
    p_backend = subprocess.Popen([sys.executable, BACKEND_SCRIPT, "3000"])
    processes.append(p_backend)
    time.sleep(0.8)

    # 2. Start ML Threat Intelligence Inference Worker on Port 5001
    print("[2/3] Starting Isolation Forest ML Worker Server on http://127.0.0.1:5001...")
    p_ml = subprocess.Popen([sys.executable, ML_WORKER_SCRIPT, "5001"])
    processes.append(p_ml)
    time.sleep(1.2)

    # 3. Start IntelliShield Reverse Proxy Gateway on Port 8080 (or $PORT)
    proxy_port = os.environ.get("PORT", "8080")
    print(f"[3/3] Starting Ingress Reverse Proxy Gateway on http://127.0.0.1:{proxy_port}...")
    p_proxy = subprocess.Popen([sys.executable, PROXY_SCRIPT, str(proxy_port), "http://127.0.0.1:3000", "http://127.0.0.1:5001"])
    processes.append(p_proxy)
    time.sleep(1.5)

    print("\n[+] All IntelliShield services successfully initialized and running!")
    print(f" -> Web Dashboard:   http://127.0.0.1:{proxy_port}/dashboard (Interactive UI)")
    print(f" -> Ingress Proxy:   http://127.0.0.1:{proxy_port}")
    print(" -> Upstream API:    http://127.0.0.1:3000")
    print(" -> ML Model Worker: http://127.0.0.1:5001")
    print(f" -> System Health:   http://127.0.0.1:{proxy_port}/intellishield/health")
    print(f" -> Live State:      http://127.0.0.1:{proxy_port}/intellishield/status\n")

def stop_services():
    global processes
    print("\n[!] Stopping all IntelliShield background services...")
    for p in processes:
        try:
            p.terminate()
            p.wait(timeout=2)
        except Exception:
            try:
                p.kill()
            except Exception:
                pass
    processes = []
    print("[+] All services terminated cleanly.")

def run_live_demo():
    start_services()
    try:
        # Run demonstration script
        print("=" * 80)
        print("  EXECUTING INTERACTIVE LIVE ATTACK SIMULATION & TELEMETRY EVALUATION")
        print("=" * 80)
        subprocess.run([sys.executable, DEMO_SCRIPT])
    finally:
        stop_services()

if __name__ == "__main__":
    mode = sys.argv[1] if len(sys.argv) > 1 else "--demo"
    
    if mode in ["--demo", "-d", "demo"]:
        run_live_demo()
    elif mode in ["--start", "-s", "start"]:
        start_services()
        print("Press Ctrl+C to stop services...")
        try:
            while True:
                time.sleep(1)
        except KeyboardInterrupt:
            stop_services()
    else:
        print("Usage:")
        print("  python run_intellishield.py --demo    (Start stack, execute attack simulation, and display results)")
        print("  python run_intellishield.py --start   (Start background services and keep running)")
