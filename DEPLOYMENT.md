# IntelliShield Layer-7 ML Ingress Proxy - Deployment & Hosting Guide

This guide provides deployment and hosting instructions for IntelliShield, an adaptive Layer-7 application security ingress proxy powered by unsupervised Isolation Forest machine learning and dynamic token bucket throttling.

---

## 1. System Architecture & Port Allocation

IntelliShield coordinates three concurrent micro-services:

| Service Component | Port | Binding | Description |
| :--- | :--- | :--- | :--- |
| **Ingress Reverse Proxy & Dashboard** | `8080` (or `$PORT`) | `0.0.0.0` | Client entrypoint, traffic analysis, rate limiter, real-time web dashboard |
| **Protected Upstream Service** | `3000` | `0.0.0.0` | Mock e-commerce and authentication REST API (`/api/v1/...`) |
| **Isolation Forest ML Worker** | `5001` | `0.0.0.0` | Unsupervised anomaly scoring engine (`/score_batch`) |

When traffic arrives at port `8080`:
1. Normal traffic is forwarded to port `3000`.
2. Telemetry is batched and evaluated by the ML inference engine on port `5001`.
3. High-entropy floods or bot patterns are throttled with HTTP 429 or blocked with HTTP 403 before reaching port `3000`.
4. Operators can observe real-time telemetry at `http://localhost:8080/dashboard`.

---

## 2. Option A: Instant Free Live Hosting via Public Tunnel (Zero-Config)

If the local system is running the services, you can expose the dashboard and ingress proxy publicly with full HTTPS within 5 seconds without deploying to external cloud servers.

### Method 1: Cloudflare Tunnel (Recommended, No Account Required)
Run via PowerShell or Terminal:
```bash
# Using winget to install cloudflared (if not already installed)
winget install --id Cloudflare.cloudflared

# Expose local port 8080 to a global secure HTTPS URL
cloudflared tunnel --url http://localhost:8080
```
Cloudflare will output a public URL such as `https://[random-string].trycloudflare.com`. Anyone can access the dashboard and send live traffic to that URL.

### Method 2: LocalTunnel (Node.js)
```bash
npx localtunnel --port 8080
```
This generates an immediate public HTTPS URL forwarding to your local IntelliShield dashboard.

---

## 3. Option B: 1-Click Cloud Deployment on Render (Free Tier)

Render natively supports both Docker and Python repositories connected to GitHub.

1. **Push your code to GitHub** (see Section 6 below).
2. Go to [https://dashboard.render.com](https://dashboard.render.com) and click **New + -> Web Service**.
3. Select your GitHub repository.
4. Configure service settings:
   - **Environment**: `Docker` (or `Python 3`)
   - **Build Command**: `pip install -r requirements.txt` (if using Python)
   - **Start Command**: `python "Industrial Project/run_intellishield.py" --start`
   - **Instance Type**: `Free`
5. Render automatically supplies the `PORT` environment variable. IntelliShield reads this variable dynamically and binds to the specified port.
6. Click **Create Web Service**. Your live public application will be available at `https://[your-service-name].onrender.com/dashboard`.

---

## 4. Option C: Cloud Deployment on Railway

1. Install Railway CLI or connect via GitHub at [https://railway.app](https://railway.app).
2. Click **New Project -> Deploy from GitHub repo**.
3. Railway automatically detects the root `Dockerfile`.
4. The service will build and provide a public `.up.railway.app` domain.

---

## 5. Option D: Local Containerized Deployment (Docker Compose)

To run the containerized stack locally:

```bash
# Build and launch container in detached mode
docker compose up -d --build

# Verify container status
docker ps

# Stream logs
docker compose logs -f

# Access dashboard in your browser
http://localhost:8080/dashboard

# Terminate stack
docker compose down
```

---

## 6. Local Native Execution

To execute natively on Windows / Linux / macOS:

```bash
# Install required ML dependencies
pip install -r requirements.txt

# Run in continuous daemon mode (all 3 services active)
python "Industrial Project/run_intellishield.py" --start

# Or run the live automated attack validation test suite
python "Industrial Project/run_intellishield.py" --demo
```

### Key URLs:
- **Interactive Web Dashboard**: `http://127.0.0.1:8080/dashboard` (Multi-page console with live telemetry & offline simulator)
- **System Health Endpoint**: `http://127.0.0.1:8080/intellishield/health`
- **Telemetry State API**: `http://127.0.0.1:8080/intellishield/status`
- **Live Event Stream API**: `http://127.0.0.1:8080/intellishield/events`
- **Simulation Control API**: `http://127.0.0.1:8080/intellishield/simulate`
- **Protected Upstream Service**: `http://127.0.0.1:3000/health`

---

## 7. Static Dashboard Hosting & Dual-Mode Architecture

The IntelliShield web dashboard (`Industrial Project/dashboard/`) is architected with **zero build dependencies** using standard HTML5, CSS custom properties, and ES Modules. It operates seamlessly in dual modes:

1. **Live Production Mode**: When running alongside the proxy gateway on port `8080`, the console automatically polls `/intellishield/status` and `/intellishield/events` every 1000 ms, streaming live per-IP telemetry, P50/P99 latency, anomaly scores, and real-time mitigation actions.
2. **Deterministic Simulator Mode**: When deployed to static web hosts without a live proxy backend (or when the backend is unreachable), the console activates `DemoSource`—a deterministic client-side simulator implementing the identical mathematical formulations from `PROJECT_INFO.md` (8D feature vectors, raw Isolation Forest anomaly scoring, 4 safety boosters, quadratic penalty throttling, and token bucket dynamics).

### Free Static Hosting Options:
- **GitHub Pages**: Deploy the `Industrial Project/dashboard/` directory directly to GitHub Pages. All hash routes (`#/`, `#/console`, `#/architecture`, `#/ml`, `#/mitigation`, `#/simulator`, `#/benchmarks`, `#/globe`, `#/docs`, `#/research`) operate client-side without server rewrites.
- **Cloudflare Pages / Vercel / Netlify**: Connect repository with publish directory set to `Industrial Project/dashboard`.
- **Offline / Viva Mode**: Open `Industrial Project/dashboard/index.html` directly or via `npx serve "Industrial Project/dashboard"` on an isolated presentation laptop for zero-latency Review 3 defense.
