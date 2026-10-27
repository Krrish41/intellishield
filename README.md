# IntelliShield

**Adaptive Layer-7 Ingress Proxy with Unsupervised Threat Isolation & Real-Time Telemetry**

[![Live Demo](https://img.shields.io/badge/Live%20Dashboard-GitHub%20Pages-00f0ff?style=flat-square)](https://krrish41.github.io/intellishield/)
[![License: MIT](https://img.shields.io/badge/License-MIT-blue.svg?style=flat-square)](LICENSE)
[![Python 3.10+](https://img.shields.io/badge/Python-3.10%2B-brightgreen.svg?style=flat-square)](https://www.python.org/)
[![Rust Core](https://img.shields.io/badge/Rust-Edition%202021-orange.svg?style=flat-square)](https://www.rust-lang.org/)
[![Docker Ready](https://img.shields.io/badge/Docker-Supported-2496ED.svg?style=flat-square)](https://www.docker.com/)

> **Live Interactive Dashboard:** [https://krrish41.github.io/intellishield/](https://krrish41.github.io/intellishield/)

---

## Overview

IntelliShield is a Layer-7 application security ingress proxy designed to distinguish distributed volumetric floods, automated web scraping bots, and credential stuffing vectors from benign human flash crowds. Traditional rate limiters operate on coarse, static thresholds that fail under asymmetric traffic surges. IntelliShield pairs an asynchronous Layer-7 reverse proxy with an unsupervised Isolation Forest inference engine that scores client request behavior across eight statistical telemetry dimensions without requiring labeled attack signatures.

When anomalous traffic patterns are detected, IntelliShield applies continuous quadratic rate-limiting penalties, shrinking token bucket burst capacities and refill rates dynamically rather than terminating connections abruptly.

---

## Key System Components

```
                            +-------------------------------------------+
                            |       External Client Ingress Traffic     |
                            +-------------------------------------------+
                                                  |
                                                  v
                                    +---------------------------+
                                    | IntelliShield Ingress     |
                                    | Reverse Proxy (:8080)     |
                                    +---------------------------+
                                      |                       |
                 Asynchronous Telemetry Stream          Evaluated Request Dispatch
                                      |                       |
                                      v                       v
               +-----------------------------+     +-------------------------------+
               | Isolation Forest ML Worker  |     |  Protected Upstream Service   |
               | Engine (:5001)              |     |  (:3000 Mock E-Commerce API)  |
               +-----------------------------+     +-------------------------------+
                                      |
                           Continuous Threat Score S in [0.0, 1.0]
                                      |
                                      v
                        +---------------------------+
                        |  Token Bucket Throttler   |
                        |  & Live Dashboard (:8080) |
                        +---------------------------+
```

1. **Ingress Reverse Proxy (`:8080`)**: High-throughput gateway implemented in Python and Rust that terminates client connections, enforces token bucket rate-limits, and serves the live operational dashboard.
2. **Threat Intelligence Inference Worker (`:5001`)**: Isolation Forest machine learning microservice that ingests 8D client telemetry vectors and computes continuous anomaly scores $S \in [0.0, 1.0]$ in under 1.5 milliseconds.
3. **Protected Upstream Service (`:3000`)**: Mock e-commerce and authentication REST API simulating real-world workloads (`/api/v1/products`, `/api/v1/auth/login`, `/api/v1/users`).
4. **Interactive Dashboard**: Modern browser interface providing real-time telemetry streaming, interactive 3D globe node visualization, vector simulation controls, and dynamic penalty curve adjustments.

---

## 8-Dimensional Telemetry Vector

Every ingress client is continuously profiled across eight behavioral metrics:

| Dimension | Telemetry Feature | Mathematical Formulation | Target Detection Profile |
| :---: | :--- | :--- | :--- |
| $f_0$ | Request Velocity | $V = \frac{\Delta N}{\Delta t}$ | High-frequency volumetric denial-of-service |
| $f_1$ | Endpoint Entropy | $H = -\sum p_i \log_2(p_i)$ | Targeted brute-force vs. natural browsing |
| $f_2$ | Inter-Arrival Variance | $\sigma^2(\Delta t)$ | Programmatic bots with fixed interval timers |
| $f_3$ | Error Ratio | $E = \frac{N_{4xx} + N_{5xx}}{N_{total}}$ | Fuzzing tools and credential stuffing |
| $f_4$ | Payload Size Variation | $\sigma^2(L_{payload})$ | Automated scrapers vs. interactive inputs |
| $f_5$ | Path Traversal Depth | $D = \text{slash\_count}(path)$ | Directory enumeration and path traversal |
| $f_6$ | Method Distribution | $\frac{N_{POST} + N_{PUT}}{N_{total}}$ | Resource-exhausting write abuse |
| $f_7$ | User-Agent Consistency | $H(UA)$ | Headless scrapers with rotating identifiers |

---

## Mitigation Mechanics: Dynamic Quadratic Penalties

Rather than applying binary drop-or-forward rules, IntelliShield modulates token bucket capacity $C(S)$ and refill rate $r(S)$ via continuous quadratic decay:

$$C(S) = C_{base} \cdot \max\left(0, 1 - \left(\frac{S - S_{floor}}{1.0 - S_{floor}}\right)^2\right)$$

$$r(S) = r_{base} \cdot \max\left(0, 1 - \left(\frac{S - S_{floor}}{1.0 - S_{floor}}\right)^2\right)$$

- **Clean Tier ($S < 0.35$)**: Full burst capacity ($C = 30$, $r = 10 \text{ req/s}$).
- **Monitored Tier ($0.35 \le S < 0.65$)**: Retains standard limits with enhanced telemetry logging.
- **Throttled Tier ($0.65 \le S < 0.85$)**: Capacity collapses to $C \le 4$, refill rate drops to $r \le 1 \text{ req/s}$, enforcing HTTP 429 backpressure.
- **Blocked Tier ($S \ge 0.85$)**: Zero capacity ($C = 0$), immediate HTTP 403 rejection.

---

## Quickstart

### Prerequisites
- Python 3.10 or higher
- Optional: Rust toolchain (for compiling the native Rust core proxy)
- Optional: Docker & Docker Compose

### 1. Clone the Repository
```bash
git clone https://github.com/Krrish41/intellishield.git
cd intellishield
```

### 2. Install Python Dependencies
```bash
pip install -r requirements.txt
```

### 3. Launch All Services
```bash
python run.py --start
```

The system will initialize all three microservices:
- Mock Upstream Service: `http://127.0.0.1:3000`
- Isolation Forest ML Worker: `http://127.0.0.1:5001`
- IntelliShield Proxy & Dashboard: `http://127.0.0.1:8080/dashboard`

### 4. Run Multi-Vector Attack Simulator
In a separate terminal window, execute the automated 4-phase attack simulation:
```bash
python run.py --demo
```

This generates:
1. Benign human traffic baseline
2. Volumetric DDoS flood (`10.0.0.99`)
3. Low-and-slow scraping bot (`10.0.0.88`)
4. Credential stuffing attack on `/api/v1/auth/login` (`10.0.0.77`)
5. Flash crowd traffic spike (demonstrating zero false positives)

---

## Docker Deployment

To launch the complete multi-tier stack in an isolated container:

```bash
docker-compose up --build
```

Access the live dashboard at `http://localhost:8080/dashboard`.

---

## Live Dashboard on GitHub Pages

The frontend monitoring console runs completely standalone in the browser using an integrated client-side simulation engine:

- **Live URL**: [https://krrish41.github.io/intellishield/](https://krrish41.github.io/intellishield/)
- Features: 8D behavioral sliders, 2D decision tree partition visualizer, token bucket liquid reservoir animation, 3D dot-sphere attack globe, and multi-scenario injection triggers.

---

## Repository Structure

```
intellishield/
├── .github/workflows/
│   └── deploy-pages.yml          # GitHub Actions automated Pages deployment
├── Dockerfile                    # Container definition
├── docker-compose.yml            # Multi-service container orchestration
├── Procfile                      # Cloud container entrypoint (Render, Railway, Heroku)
├── requirements.txt              # Production Python dependencies
├── run.py                        # Root launcher script
├── index.html                    # Root entrypoint redirect for GitHub Pages
├── DEPLOYMENT.md                 # Production hosting and cloud deployment guide
└── Industrial Project/
    ├── run_intellishield.py      # Multi-tier process supervisor
    ├── core/                     # High-performance Rust Layer-7 proxy (Hyper/Tokio)
    ├── ml_engine/                # Isolation Forest training and inference worker
    │   ├── isolation_forest_engine.py
    │   ├── ml_worker_server.py
    │   └── models/               # Serialized model weights (.joblib)
    ├── proxy_engine/             # Python Layer-7 proxy gateway and health monitor
    ├── mock_backend/             # Mock upstream REST API microservice
    ├── simulator/                # Traffic generators and automated demo suites
    ├── dashboard/                # Modern ES6 HTML5/CSS3 real-time dashboard
    │   ├── index.html            # Dashboard web interface
    │   ├── css/                  # Liquid Glass styling, animations, tokens
    │   ├── js/                   # Telemetry streaming, charts, 3D globe
    │   └── assets/               # Architecture blueprints and system diagrams
    └── assets/                   # Architecture diagrams and system assets
```

---

## Authors & Academic Citation

Developed as a capstone engineering research initiative at Vellore Institute of Technology (VIT), Chennai:

- **Krrish Ranjan** — School of Computer Science and Engineering, VIT Chennai ([krrish41@gmail.com](mailto:krrish41@gmail.com))
- **Aashman Gupta** — School of Computer Science and Engineering, VIT Chennai
- **Krishnaraj N** — Associate Professor, School of Computer Science and Engineering, VIT Chennai

---

## License

This project is licensed under the MIT License — see the [LICENSE](LICENSE) file for details.
