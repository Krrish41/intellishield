/**
 * IntelliShield Empirical Benchmarks & Performance Page Component (#/benchmarks)
 * Strict compliance with PROJECT_INFO.md section 8: Throughput, latency,
 * attack mitigation efficacy, ROC-AUC, and total cost of ownership (TCO).
 */

export class BenchmarksPage {
  constructor() {
    this.container = null;
    this.activeMetric = 'throughput'; // 'throughput', 'latency', 'cpu', 'cost'
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
            <h2>Empirical Performance Benchmarks & Validation</h2>
            <p>Empirical evaluation across 1,000 to 10,000 concurrent client sessions using multi-core benchmarking harnesses.</p>
          </div>
          <div class="page-actions">
            <button class="btn btn-primary btn-sm metric-toggle-btn" data-metric="throughput">Throughput</button>
            <button class="btn btn-secondary btn-sm metric-toggle-btn" data-metric="latency">Latency</button>
            <button class="btn btn-secondary btn-sm metric-toggle-btn" data-metric="cpu">CPU Load</button>
            <button class="btn btn-secondary btn-sm metric-toggle-btn" data-metric="cost">Annual TCO</button>
          </div>
        </div>

        <!-- Ingress Performance Comparison Section -->
        <div class="glass-panel reveal delay1" style="padding: 24px; margin-bottom: 32px;">
          <h3 style="font-size: 1.15rem; margin-bottom: 6px;">Ingress Forwarding Throughput & Latency Comparison</h3>
          <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 20px;">
            Benchmarked under 5,000 concurrent client sessions on multi-core hardware testbeds
          </p>

          <!-- Interactive Bar Charts Container -->
          <div id="benchmarkBarsContainer" style="margin-bottom: 24px;"></div>

          <!-- Comprehensive Metrics Table -->
          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Architecture</th>
                  <th>Peak Throughput</th>
                  <th>P50 Latency</th>
                  <th>P99 Latency</th>
                  <th>CPU Utilization</th>
                  <th>Memory Safety</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="font-weight: 600;">NGINX (Baseline)</td>
                  <td style="font-family: var(--font-mono);">94,200 req/s</td>
                  <td style="font-family: var(--font-mono);">0.78 ms</td>
                  <td style="font-family: var(--font-mono);">2.40 ms</td>
                  <td>82% (4 cores)</td>
                  <td><span class="chip chip-blocked" style="font-size: 0.7rem;">Unsafe (C)</span></td>
                </tr>
                <tr>
                  <td style="font-weight: 600;">HAProxy 2.8</td>
                  <td style="font-family: var(--font-mono);">91,500 req/s</td>
                  <td style="font-family: var(--font-mono);">0.81 ms</td>
                  <td style="font-family: var(--font-mono);">2.55 ms</td>
                  <td>85% (4 cores)</td>
                  <td><span class="chip chip-blocked" style="font-size: 0.7rem;">Unsafe (C)</span></td>
                </tr>
                <tr>
                  <td style="font-weight: 600;">Synchronous ML Proxy</td>
                  <td style="font-family: var(--font-mono); color: var(--tier-blocked);">3,450 req/s</td>
                  <td style="font-family: var(--font-mono); color: var(--tier-blocked);">28.60 ms</td>
                  <td style="font-family: var(--font-mono); color: var(--tier-blocked);">64.20 ms</td>
                  <td>98% (Saturation)</td>
                  <td><span class="chip chip-throttled" style="font-size: 0.7rem;">GC Pauses</span></td>
                </tr>
                <tr>
                  <td style="font-weight: 600;">ModSecurity WAF</td>
                  <td style="font-family: var(--font-mono);">14,800 req/s</td>
                  <td style="font-family: var(--font-mono);">12.40 ms</td>
                  <td style="font-family: var(--font-mono);">38.10 ms</td>
                  <td>94% (4 cores)</td>
                  <td><span class="chip chip-blocked" style="font-size: 0.7rem;">Unsafe (C++)</span></td>
                </tr>
                <tr style="background: rgba(0, 240, 255, 0.06); font-weight: 700;">
                  <td style="color: var(--primary-cyan);">IntelliShield (Proposed)</td>
                  <td style="font-family: var(--font-mono); color: var(--primary-cyan);">88,740 req/s</td>
                  <td style="font-family: var(--font-mono); color: var(--primary-cyan);">0.85 ms</td>
                  <td style="font-family: var(--font-mono); color: var(--primary-cyan);">2.74 ms</td>
                  <td>74% (4 cores)</td>
                  <td><span class="chip chip-clean" style="font-size: 0.7rem;">Guaranteed (Rust)</span></td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Attack Mitigation Efficacy & Accuracy Matrix -->
        <div class="glass-panel reveal delay2" style="padding: 24px; margin-bottom: 32px;">
          <div style="display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 16px;">
            <div>
              <h3 style="font-size: 1.15rem; margin-bottom: 4px;">Attack Mitigation & Detection Accuracy Evaluation</h3>
              <p style="font-size: 0.8rem; color: var(--text-muted);">
                Validating detection latency and false positive resistance across synthetic Layer-7 profiles
              </p>
            </div>
            <div style="text-align: right;">
              <span style="font-size: 0.75rem; color: var(--text-muted); font-weight: 700;">OVERALL MODEL ACCURACY</span>
              <div style="font-family: var(--font-heading); font-size: 1.8rem; font-weight: 800; color: var(--primary-cyan);">
                0.968 <span style="font-size: 0.85rem; font-weight: 500; color: var(--text-muted);">ROC-AUC</span>
              </div>
            </div>
          </div>

          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Attack Scenario</th>
                  <th>Injected Profile</th>
                  <th>Detection Time</th>
                  <th>Mitigation Efficacy</th>
                  <th>False Positive Rate</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="font-weight: 600;">Volumetric HTTP Flood</td>
                  <td>80 req/s burst</td>
                  <td style="font-family: var(--font-mono); color: var(--primary-cyan);">85 ms</td>
                  <td style="color: var(--tier-clean); font-weight: 600;">99.4% Blocked / 429</td>
                  <td>0.8% (Benign traffic clear)</td>
                </tr>
                <tr>
                  <td style="font-weight: 600;">Low-and-Slow Scraper</td>
                  <td>4 req/s, $\\sigma^2 \\approx 0$</td>
                  <td style="font-family: var(--font-mono); color: var(--primary-cyan);">140 ms</td>
                  <td style="color: var(--tier-clean); font-weight: 600;">96.8% Throttled</td>
                  <td>1.2% (Normal browsing clean)</td>
                </tr>
                <tr>
                  <td style="font-weight: 600;">Credential Stuffing</td>
                  <td>Randomized /auth/login</td>
                  <td style="font-family: var(--font-mono); color: var(--primary-cyan);">92 ms</td>
                  <td style="color: var(--tier-clean); font-weight: 600;">98.7% Dropped / 403</td>
                  <td>0.4% (Legitimate auth safe)</td>
                </tr>
                <tr>
                  <td style="font-weight: 600;">Benign Flash Crowd</td>
                  <td>50 req/s surge, high jitter</td>
                  <td style="font-family: var(--font-mono); color: var(--tier-clean);">No false drop</td>
                  <td style="color: var(--tier-clean); font-weight: 600;">100% Passed (200 OK)</td>
                  <td>1.1% (Slight transient throttle)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>

        <!-- Economic & Total Cost of Ownership (TCO) Analysis -->
        <div class="glass-panel reveal delay3" style="padding: 24px; margin-bottom: 32px;">
          <h3 style="font-size: 1.15rem; margin-bottom: 6px;">Total Cost of Ownership (TCO) Economic Analysis</h3>
          <p style="font-size: 0.8rem; color: var(--text-muted); margin-bottom: 20px;">
            Comparing annual operational expenses for 40 Million requests/month infrastructure
          </p>

          <div class="table-container">
            <table class="data-table">
              <thead>
                <tr>
                  <th>Cost Component</th>
                  <th>Commercial Cloud WAF (e.g. AWS WAF)</th>
                  <th>Legacy Hardware Appliance</th>
                  <th>IntelliShield (Edge Server)</th>
                </tr>
              </thead>
              <tbody>
                <tr>
                  <td style="font-weight: 600;">Base Hardware / VM CapEx</td>
                  <td>$0 (SaaS model)</td>
                  <td>$18,500 (Proprietary rack unit)</td>
                  <td style="color: var(--tier-clean); font-weight: 600;">$4,200 (Commodity edge server)</td>
                </tr>
                <tr>
                  <td style="font-weight: 600;">Request Inspection Fees</td>
                  <td>$24,000 / year ($0.60 per 1M reqs)</td>
                  <td>$0 (Local processing)</td>
                  <td style="color: var(--tier-clean); font-weight: 600;">$0 (Open-source local engine)</td>
                </tr>
                <tr>
                  <td style="font-weight: 600;">Rule & License Subscriptions</td>
                  <td>$7,200 / year</td>
                  <td>$12,400 / year</td>
                  <td style="color: var(--tier-clean); font-weight: 600;">$0 (Self-hosted open-source)</td>
                </tr>
                <tr>
                  <td style="font-weight: 600;">Maintenance & Power OpEx</td>
                  <td>$3,600 / year</td>
                  <td>$6,800 / year</td>
                  <td>$3,600 / year</td>
                </tr>
                <tr style="background: rgba(16, 185, 129, 0.08); font-weight: 800;">
                  <td>Total Annual TCO (Year 1)</td>
                  <td style="font-family: var(--font-mono); color: var(--tier-blocked);">$34,800</td>
                  <td style="font-family: var(--font-mono); color: var(--tier-throttled);">$37,700</td>
                  <td style="font-family: var(--font-mono); color: var(--tier-clean); font-size: 1.05rem;">$7,800 (77.5% Cost Reduction)</td>
                </tr>
              </tbody>
            </table>
          </div>
        </div>
      </div>
    `;

    this.renderBars(this.activeMetric);
  }

  attachEvents() {
    this.container.querySelectorAll('.metric-toggle-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const metric = btn.dataset.metric;
        this.activeMetric = metric;

        this.container.querySelectorAll('.metric-toggle-btn').forEach(b => {
          b.className = b.dataset.metric === metric ? 'btn btn-primary btn-sm metric-toggle-btn' : 'btn btn-secondary btn-sm metric-toggle-btn';
        });

        this.renderBars(metric);
      });
    });
  }

  renderBars(metric) {
    const container = this.container.querySelector('#benchmarkBarsContainer');
    if (!container) return;

    let items = [];
    if (metric === 'throughput') {
      items = [
        { label: 'NGINX (C Baseline)', val: 94200, max: 100000, display: '94,200 req/s', color: 'var(--text-muted)' },
        { label: 'HAProxy 2.8', val: 91500, max: 100000, display: '91,500 req/s', color: 'var(--text-muted)' },
        { label: 'IntelliShield (Proposed Rust)', val: 88740, max: 100000, display: '88,740 req/s (Within 5.8%)', color: 'var(--primary-cyan)' },
        { label: 'ModSecurity WAF', val: 14800, max: 100000, display: '14,800 req/s', color: 'var(--tier-throttled)' },
        { label: 'Synchronous ML Proxy', val: 3450, max: 100000, display: '3,450 req/s', color: 'var(--tier-blocked)' }
      ];
    } else if (metric === 'latency') {
      items = [
        { label: 'NGINX', val: 0.78, max: 30.0, display: '0.78 ms', color: 'var(--text-muted)' },
        { label: 'HAProxy 2.8', val: 0.81, max: 30.0, display: '0.81 ms', color: 'var(--text-muted)' },
        { label: 'IntelliShield (Proposed Rust)', val: 0.85, max: 30.0, display: '0.85 ms (Sub-millisecond)', color: 'var(--primary-cyan)' },
        { label: 'ModSecurity WAF', val: 12.40, max: 30.0, display: '12.40 ms', color: 'var(--tier-throttled)' },
        { label: 'Synchronous ML Proxy', val: 28.60, max: 30.0, display: '28.60 ms (33x Latency Gap)', color: 'var(--tier-blocked)' }
      ];
    } else if (metric === 'cpu') {
      items = [
        { label: 'IntelliShield (Proposed Rust)', val: 74, max: 100, display: '74% (Lowest utilization)', color: 'var(--tier-clean)' },
        { label: 'NGINX', val: 82, max: 100, display: '82%', color: 'var(--text-muted)' },
        { label: 'HAProxy 2.8', val: 85, max: 100, display: '85%', color: 'var(--text-muted)' },
        { label: 'ModSecurity WAF', val: 94, max: 100, display: '94%', color: 'var(--tier-throttled)' },
        { label: 'Synchronous ML Proxy', val: 98, max: 100, display: '98% (CPU Saturation)', color: 'var(--tier-blocked)' }
      ];
    } else if (metric === 'cost') {
      items = [
        { label: 'IntelliShield (Edge Deployment)', val: 7800, max: 40000, display: '$7,800 / year (77.5% Savings)', color: 'var(--tier-clean)' },
        { label: 'Commercial Cloud WAF (AWS WAF)', val: 34800, max: 40000, display: '$34,800 / year', color: 'var(--tier-blocked)' },
        { label: 'Legacy Hardware Appliance', val: 37700, max: 40000, display: '$37,700 / year', color: 'var(--tier-throttled)' }
      ];
    }

    container.innerHTML = items.map(item => {
      const pct = Math.max(3, Math.round((item.val / item.max) * 100));
      return `
        <div class="bar-row">
          <div class="bar-label-group">
            <span style="color: var(--text-primary);">${item.label}</span>
            <span style="font-family: var(--font-mono); font-weight: 700; color: ${item.color};">${item.display}</span>
          </div>
          <div class="bar-track">
            <div class="bar-fill" style="width: ${pct}%; background: ${item.color};"></div>
          </div>
        </div>
      `;
    }).join('');
  }
}
