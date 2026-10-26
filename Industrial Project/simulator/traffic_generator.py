import time
import random
import json
import urllib.request
import urllib.error
import threading
from concurrent.futures import ThreadPoolExecutor

PROXY_URL = "http://127.0.0.1:8080"

LEGITIMATE_PATHS = [
    "/api/v1/products",
    "/api/v1/user/profile",
    "/api/v1/products?category=Hardware",
    "/api/v1/products?category=Software",
    "/api/v1/checkout"
]

USER_AGENTS = [
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/128.0.0.0 Safari/537.36",
    "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.5 Safari/605.1.15",
    "Mozilla/5.0 (X11; Linux x86_64; rv:129.0) Gecko/20100101 Firefox/129.0",
    "Mozilla/5.0 (iPhone; CPU iPhone OS 17_5 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Mobile/15E148"
]

def send_request(ip: str, path: str, method: str = "GET", payload: dict = None, ua: str = None) -> tuple:
    """Send request to IntelliShield Proxy with spoofed client IP"""
    url = f"{PROXY_URL}{path}"
    data = json.dumps(payload).encode('utf-8') if payload else None
    
    req = urllib.request.Request(url, data=data, method=method)
    req.add_header("X-Forwarded-For", ip)
    req.add_header("User-Agent", ua or random.choice(USER_AGENTS))
    if payload:
        req.add_header("Content-Type", "application/json")
        
    start_t = time.perf_counter()
    try:
        with urllib.request.urlopen(req, timeout=3.0) as resp:
            elapsed_ms = (time.perf_counter() - start_t) * 1000.0
            return resp.status, elapsed_ms, resp.read().decode('utf-8', errors='ignore')
    except urllib.error.HTTPError as e:
        elapsed_ms = (time.perf_counter() - start_t) * 1000.0
        return e.code, elapsed_ms, e.read().decode('utf-8', errors='ignore')
    except Exception as e:
        elapsed_ms = (time.perf_counter() - start_t) * 1000.0
        return 502, elapsed_ms, str(e)

def simulate_legitimate_users(num_users: int = 5, duration_sec: int = 10, print_callback=None):
    """Simulate normal human browsing patterns: diverse endpoints, random intervals"""
    print(f"\n[Legitimate Traffic] Simulating {num_users} normal users for {duration_sec} seconds...")
    stop_flag = False
    
    def user_worker(user_id: int):
        ip = f"192.168.1.{100 + user_id}"
        ua = USER_AGENTS[user_id % len(USER_AGENTS)]
        while not stop_flag:
            path = random.choice(LEGITIMATE_PATHS)
            method = "POST" if path == "/api/v1/checkout" else "GET"
            payload = {"cart_id": "c_8891"} if method == "POST" else None
            
            status, ms, _ = send_request(ip, path, method, payload, ua)
            if print_callback:
                print_callback(ip, "Legitimate", path, status, ms)
            
            # Human sleep variance: 0.2s to 1.2s
            time.sleep(random.uniform(0.2, 1.2))

    threads = []
    for i in range(num_users):
        t = threading.Thread(target=user_worker, args=(i,), daemon=True)
        t.start()
        threads.append(t)
        
    time.sleep(duration_sec)
    stop_flag = True

def simulate_volumetric_ddos(bot_ip: str = "10.0.0.99", requests_count: int = 150, print_callback=None):
    """Simulate high-rate Layer-7 flood: single endpoint, rapid burst"""
    print(f"\n[Attack Simulation] Launching Volumetric L7 DDoS from IP: {bot_ip} ({requests_count} rapid bursts)...")
    path = "/api/v1/products"
    ua = "BotnetAgent/1.0 (Automated Flooder)"
    
    for i in range(requests_count):
        status, ms, _ = send_request(bot_ip, path, "GET", None, ua)
        if print_callback:
            print_callback(bot_ip, "Volumetric DDoS", path, status, ms)
        time.sleep(0.01) # Rapid 100 req/s

def simulate_low_and_slow_bot(bot_ip: str = "10.0.0.88", count: int = 35, print_callback=None):
    """Simulate low-and-slow scraping bot: exact interval (zero variance), targeted endpoint"""
    print(f"\n[Attack Simulation] Launching Low-and-Slow Bot from IP: {bot_ip} (Target: Scraping /api/v1/products)...")
    path = "/api/v1/products"
    ua = "ScraperScript/2.4 (Python Requests)"
    
    for i in range(count):
        status, ms, _ = send_request(bot_ip, path, "GET", None, ua)
        if print_callback:
            print_callback(bot_ip, "Low-and-Slow Bot", path, status, ms)
        time.sleep(0.15) # Rigid programmatic timing

def simulate_credential_stuffing(bot_ip: str = "10.0.0.77", count: int = 30, print_callback=None):
    """Simulate automated credential stuffing attack: high 401 error ratio"""
    print(f"\n[Attack Simulation] Launching Credential Stuffing from IP: {bot_ip} (Target: /api/v1/auth/login)...")
    path = "/api/v1/auth/login"
    ua = "CredentialHarvester/3.1"
    
    passwords = ["123456", "password", "admin123", "letmein", "secret", "qwerty"]
    for i in range(count):
        payload = {"username": f"user_{i}", "password": random.choice(passwords)}
        status, ms, _ = send_request(bot_ip, path, "POST", payload, ua)
        if print_callback:
            print_callback(bot_ip, "Credential Stuffing", path, status, ms)
        time.sleep(0.10)

def simulate_flash_crowd(num_users: int = 15, duration_sec: int = 4, print_callback=None):
    """
    Simulate sudden surge of legitimate human users (flash crowd event).
    Demonstrates zero false-positives under legitimate traffic spikes.
    High aggregate rate across multiple distinct client IPs with human variance and diverse paths.
    """
    print(f"\n[Flash Crowd Simulation] Simulating surge of {num_users} legitimate users for {duration_sec}s...")
    stop_flag = False

    def flash_user_worker(user_id: int):
        ip = f"192.168.2.{100 + user_id}"
        ua = USER_AGENTS[user_id % len(USER_AGENTS)]
        while not stop_flag:
            path = random.choice(LEGITIMATE_PATHS)
            method = "POST" if path == "/api/v1/checkout" else "GET"
            payload = {"cart_id": f"flash_c_{user_id}"} if method == "POST" else None

            status, ms, _ = send_request(ip, path, method, payload, ua)
            if print_callback:
                print_callback(ip, "Flash Crowd (Benign)", path, status, ms)

            time.sleep(random.uniform(0.15, 0.50))

    threads = []
    for i in range(num_users):
        t = threading.Thread(target=flash_user_worker, args=(i,), daemon=True)
        t.start()
        threads.append(t)

    time.sleep(duration_sec)
    stop_flag = True
