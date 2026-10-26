/**
 * IntelliShield Research, Academic Monograph & Defense Viva Knowledge Base (#/research)
 * Complete viva questions from section 12 of PROJECT_INFO.md with interactive practice mode.
 */

import { Icons } from '../components/icons.js';

export class ResearchPage {
  constructor() {
    this.container = null;
    this.practiceMode = false;
    this.searchTerm = '';
    this.vivaData = [
      {
        q: "Q1: What is the core problem statement of IntelliShield?",
        a: "Modern web applications and cloud microservices face aggressive Layer-7 cyber threats (volumetric floods, scrapers, credential stuffing). Traditional WAFs rely on static regex signatures that cannot detect zero-day behavioral variations, while existing Machine Learning intrusion detection systems execute inference synchronously inside the HTTP forwarding loop, incurring 10 to 50 ms latency penalties. IntelliShield resolves this conflict by decoupling fast-path request forwarding from asynchronous background ML threat scoring, delivering sub-millisecond median forwarding latency (0.85 ms) with memory-safe Rust execution and adaptive quadratic rate limiting."
      },
      {
        q: "Q2: Why is Layer-7 DDoS more dangerous than Layer-3 or Layer-4 DDoS?",
        a: "Layer-3/4 attacks (such as SYN floods or UDP amplification) target raw bandwidth and network infrastructure, which can be absorbed by upstream BGP scrubbing centers or cloud CDNs. Layer-7 attacks execute valid TCP handshakes and send syntactically legitimate HTTP requests that consume expensive backend compute resources (database queries, TLS handshakes, JSON serialization, and cryptographic hashing). A volumetric Layer-7 attack of only 5,000 req/s can crash an enterprise database cluster while appearing as legitimate network traffic to lower-layer firewalls."
      },
      {
        q: "Q3: What is a 'Low-and-Slow' attack, and why do traditional rate limiters fail against it?",
        a: "A low-and-slow attack sends requests at a deliberately low velocity (e.g., 2 to 4 requests per second) to stay well below static rate-limiting ceilings (e.g., 100 requests per minute). Despite the low rate, automated scrapers systematically extract database records or keep server worker threads tied up indefinitely. Traditional rate limiters look only at total request volume and fail to trigger. IntelliShield detects low-and-slow attacks by analyzing multidimensional metrics such as inter-arrival time variance (sigma^2_delta_t ≈ 0) and low URI Shannon entropy (H(U) < 0.8), which expose deterministic bot automation."
      },
      {
        q: "Q4: What is a 'Flash Crowd,' and how does IntelliShield prevent false-positive blocks?",
        a: "A flash crowd occurs when thousands of legitimate human users access a web service simultaneously during a major event (e.g., product launch, breaking news). Because total traffic volume spikes, naive volumetric firewalls mistake flash crowds for DDoS attacks and block legitimate users. IntelliShield distinguishes flash crowds from botnets through behavioral features: human traffic exhibits high inter-arrival time variance (sigma^2_delta_t > 0.5), diverse URI Shannon entropy, and varying payload distributions. Consequently, flash crowds remain classified in the Clean or Monitored tier, receiving HTTP 200 OK without blocking."
      },
      {
        q: "Q5: Why was Rust selected for the core proxy engine instead of Go or C/C++?",
        a: "High-concurrency reverse proxies require both maximum throughput and absolute memory safety. C and C++ (used in NGINX and HAProxy) deliver wire-speed execution but lack memory safety; over 70% of high-severity vulnerabilities in network daemons stem from buffer overflows, use-after-free bugs, and race conditions. Garbage-collected runtimes like Go and Java eliminate raw pointer bugs but introduce non-deterministic garbage collection pauses (20 to 100 ms) under memory pressure, causing latency spikes. Rust provides compile-time memory safety guarantees via its ownership, borrowing, and lifetime model with zero-cost abstractions and no garbage collection runtime."
      },
      {
        q: "Q6: Why did you choose an unsupervised machine learning model instead of supervised deep learning?",
        a: "Supervised deep learning models require massive quantities of labeled attack datasets (benign vs. malicious). In cybersecurity, threat actors constantly alter attack vectors, payload shapes, and timing profiles; supervised models fail to generalize to novel zero-day attack geometries not present in the training set. Furthermore, deep neural networks require significant matrix multiplication overhead that cannot meet the low-latency demands of edge gateways. Isolation Forest is unsupervised, requires no pre-labeled attack data, exhibits O(t log psi) evaluation complexity, and isolates anomalies based on the structural property that anomalous points deviate from normal baseline distributions."
      },
      {
        q: "Q7: How does the quadratic rate-limiting penalty formula function?",
        a: "When an anomaly score s exceeds the anomaly threshold (theta = 0.65), rather than dropping traffic completely, IntelliShield calculates: P = ((s - 0.65) / 0.35)^2. The capacity and refill multiplier is M = max(0.01, 1.0 - P). Because the penalty is quadratic, as s increases from 0.65 to 0.84, the token bucket capacity and refill rate degrade non-linearly (e.g., at s=0.75, M ≈ 0.92; at s=0.82, M ≈ 0.76). This progressively suppresses abusive clients with HTTP 429 status codes while allowing minor behavioral deviations to complete transactions."
      },
      {
        q: "Q8: What are the primary future research directions for IntelliShield?",
        a: "1. eBPF/XDP Kernel Bypass: Integrating extended Berkeley Packet Filters (eBPF) and eXpress Data Path (XDP) into the Linux kernel network driver. This will allow the proxy to drop volumetric packets classified in the Blocked Tier directly at the network interface card (NIC) driver level before memory allocation in the OS networking stack.\n2. Federated Threat Intelligence: Deploying federated learning across distributed edge proxy nodes, allowing multiple organizational gateways to collaboratively train anomaly detection models without sharing raw user telemetry.\n3. Hardware Acceleration: Offloading feature vector calculation and cryptographic TLS termination to SmartNICs or FPGA acceleration cards for 100 Gbps line-rate processing."
      }
    ];
  }

  mount(container) {
    this.container = container;
    this.render();
    this.attachEvents();
  }

  unmount() {}

  render() {
    this.container.innerHTML = `
      <div class="page-view active">
        <!-- Header -->
        <div class="page-header reveal">
          <div class="page-header-title">
            <h2>Academic Monograph & Technical Defense Viva Guide</h2>
            <p>B.Tech. Capstone Engineering Deliverables &bull; BCSE497J &bull; SCOPE, VIT Vellore</p>
          </div>
          <div class="page-actions">
            <button class="btn btn-secondary btn-sm" id="btnTogglePractice">
              ${Icons.book(14)} Practice Mode: ${this.practiceMode ? 'ON' : 'OFF'}
            </button>
            <button class="btn btn-primary btn-sm" id="btnRandomQuestion">
              ${Icons.refresh(14)} Random Question
            </button>
          </div>
        </div>

        <!-- Academic Identity & Review Metadata -->
        <div class="glass-panel reveal delay1" style="padding: 24px; margin-bottom: 32px;">
          <h3 style="font-size: 1.15rem; margin-bottom: 12px;">Institutional Capstone Identity</h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px; font-size: 0.85rem;">
            <div>
              <span style="color: var(--text-muted);">Academic Degree:</span>
              <div style="font-weight: 600;">B.Tech. in Computer Science and Engineering</div>
            </div>
            <div>
              <span style="color: var(--text-muted);">Institution:</span>
              <div style="font-weight: 600;">School of Computer Science and Engineering (SCOPE), VIT Vellore</div>
            </div>
            <div>
              <span style="color: var(--text-muted);">Student Investigators:</span>
              <div style="font-weight: 600;">Krrish Ranjan (23BKT0015) &bull; Aashman Gupta (23BKT0044)</div>
            </div>
            <div>
              <span style="color: var(--text-muted);">Faculty Guide / Supervisor:</span>
              <div style="font-weight: 600;">Dr. Krishnaraj N, Associate Professor, SCOPE</div>
            </div>
          </div>

          <!-- Milestones Timeline -->
          <div style="margin-top: 20px; padding-top: 16px; border-top: 1px solid var(--border-subtle); display: grid; grid-template-columns: repeat(auto-fit, minmax(180px, 1fr)); gap: 12px;">
            <div style="padding: 10px; background: var(--bg-surface-elevated); border-radius: var(--radius-sm);">
              <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700;">REVIEW 1 &bull; 29 JUL 2026</span>
              <div style="font-weight: 600; font-size: 0.82rem; margin-top: 2px;">Architecture Blueprint</div>
            </div>
            <div style="padding: 10px; background: var(--bg-surface-elevated); border-radius: var(--radius-sm);">
              <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700;">REVIEW 2 &bull; 05 SEP 2026</span>
              <div style="font-weight: 600; font-size: 0.82rem; margin-top: 2px;">Working Dual-Path Core</div>
            </div>
            <div style="padding: 10px; background: rgba(0, 240, 255, 0.08); border: 1px solid var(--primary-cyan); border-radius: var(--radius-sm);">
              <span style="font-size: 0.72rem; color: var(--primary-cyan); font-weight: 700;">REVIEW 3 &bull; 28 OCT 2026</span>
              <div style="font-weight: 700; font-size: 0.82rem; margin-top: 2px;">Full Stack & Benchmarks</div>
            </div>
            <div style="padding: 10px; background: var(--bg-surface-elevated); border-radius: var(--radius-sm);">
              <span style="font-size: 0.72rem; color: var(--text-muted); font-weight: 700;">FINAL VIVA &bull; NOV 2026</span>
              <div style="font-weight: 600; font-size: 0.82rem; margin-top: 2px;">Defense & Monograph</div>
            </div>
          </div>
        </div>

        <!-- 4 Key Research Gaps -->
        <div class="glass-panel reveal delay2" style="padding: 24px; margin-bottom: 32px;">
          <h3 style="font-size: 1.15rem; margin-bottom: 12px;">Key Research Gaps Addressed</h3>
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(260px, 1fr)); gap: 16px;">
            <div class="glass-panel" style="padding: 16px;">
              <strong style="color: var(--primary-cyan);">1. Machine Learning Latency Dilemma</strong>
              <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 6px; line-height: 1.5;">
                Standard ML intrusion detection evaluates feature vectors inline before returning a response, adding 10 to 50 ms latency. IntelliShield decouples evaluation via lock-free channels.
              </p>
            </div>
            <div class="glass-panel" style="padding: 16px;">
              <strong style="color: var(--tier-clean);">2. Memory Safety in Network Ingress</strong>
              <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 6px; line-height: 1.5;">
                NGINX and HAProxy are written in C/C++, where memory corruption bugs account for over 70% of high-severity CVEs. Rust eliminates memory vulnerabilities at compile time with zero garbage collection pauses.
              </p>
            </div>
            <div class="glass-panel" style="padding: 16px;">
              <strong style="color: var(--tier-monitored);">3. Static Rate Limiting Blind Spots</strong>
              <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 6px; line-height: 1.5;">
                Fixed RPM limits fail against low-and-slow scrapers and falsely penalize flash crowds. Multidimensional variance and entropy extraction expose programmatic automation accurately.
              </p>
            </div>
            <div class="glass-panel" style="padding: 16px;">
              <strong style="color: var(--tier-throttled);">4. Rigid Binary Blocking</strong>
              <p style="font-size: 0.8rem; color: var(--text-secondary); margin-top: 6px; line-height: 1.5;">
                Traditional firewalls enforce allow/drop policies. Quadratic token-bucket throttling progressively restricts burst volume without immediate disruption for borderline deviations.
              </p>
            </div>
          </div>
        </div>

        <!-- Technical Defense Viva Q&A Accordion -->
        <div class="glass-panel reveal delay3" style="padding: 24px; margin-bottom: 32px;">
          <div style="display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: 12px; margin-bottom: 20px;">
            <div>
              <h3 style="font-size: 1.15rem; margin-bottom: 4px;">Technical Defense Viva Q&A Knowledge Base</h3>
              <p style="font-size: 0.8rem; color: var(--text-muted);">
                Exhaustive faculty review panel questions derived from section 12 of PROJECT_INFO.md
              </p>
            </div>
            <input type="text" id="vivaSearchInput" class="form-input" placeholder="Search questions & answers..." style="width: 240px; min-height: 38px;">
          </div>

          <div id="vivaAccordionContainer" style="display: flex; flex-direction: column; gap: 10px;"></div>
        </div>
      </div>
    `;

    this.renderAccordion();
  }

  attachEvents() {
    // Search input
    this.container.querySelector('#vivaSearchInput')?.addEventListener('input', (e) => {
      this.searchTerm = e.target.value.toLowerCase().trim();
      this.renderAccordion();
    });

    // Practice mode toggle
    this.container.querySelector('#btnTogglePractice')?.addEventListener('click', (e) => {
      this.practiceMode = !this.practiceMode;
      e.currentTarget.innerHTML = `${Icons.book(14)} Practice Mode: ${this.practiceMode ? 'ON' : 'OFF'}`;
      this.renderAccordion();
    });

    // Random question trigger
    this.container.querySelector('#btnRandomQuestion')?.addEventListener('click', () => {
      const items = this.container.querySelectorAll('.accordion-item');
      if (items.length === 0) return;
      items.forEach(i => i.classList.remove('open'));
      const randIdx = Math.floor(Math.random() * items.length);
      const target = items[randIdx];
      target.classList.add('open');
      target.scrollIntoView({ behavior: 'smooth', block: 'center' });
    });
  }

  renderAccordion() {
    const container = this.container.querySelector('#vivaAccordionContainer');
    if (!container) return;

    const filtered = this.vivaData.filter(d =>
      d.q.toLowerCase().includes(this.searchTerm) || d.a.toLowerCase().includes(this.searchTerm)
    );

    if (filtered.length === 0) {
      container.innerHTML = `<div style="text-align: center; color: var(--text-muted); padding: 24px;">No questions matching search query.</div>`;
      return;
    }

    container.innerHTML = filtered.map((item, idx) => `
      <div class="accordion-item" id="vivaItem_${idx}">
        <button class="accordion-trigger" data-target="vivaItem_${idx}">
          <span>${item.q}</span>
          ${Icons.chevronDown(16)}
        </button>
        <div class="accordion-content">
          ${this.practiceMode ? `
            <div class="practice-gate" style="padding: 12px 0;">
              <button class="btn btn-secondary btn-sm show-answer-btn" data-target="vivaAns_${idx}">
                Reveal Technical Answer
              </button>
              <div id="vivaAns_${idx}" style="display: none; margin-top: 10px; line-height: 1.6;">
                ${this.formatAnswer(item.a)}
              </div>
            </div>
          ` : `
            <div style="line-height: 1.6;">${this.formatAnswer(item.a)}</div>
          `}
        </div>
      </div>
    `).join('');

    // Attach accordion toggles
    container.querySelectorAll('.accordion-trigger').forEach(trigger => {
      trigger.addEventListener('click', () => {
        const parent = trigger.closest('.accordion-item');
        parent.classList.toggle('open');
      });
    });

    // Attach practice reveal buttons
    container.querySelectorAll('.show-answer-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const ans = container.querySelector(`#${btn.dataset.target}`);
        if (ans) {
          ans.style.display = 'block';
          btn.style.display = 'none';
        }
      });
    });
  }

  formatAnswer(text) {
    return text.replace(/\n/g, '<br><br>');
  }
}
