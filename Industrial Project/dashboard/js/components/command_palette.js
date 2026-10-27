/**
 * IntelliShield Command Palette & Spotlight Overlay
 * Triggered via Ctrl+K / Cmd+K. Searchable quick jumps, NOC presentation mode,
 * theme toggling, attack simulations, and blueprint inspection shortcuts.
 */

import { router } from '../router.js';
import { themeManager } from '../theme.js';
import { dataManager } from '../datasource.js';
import { toastManager } from './modal.js';
import { Icons } from './icons.js';

export class CommandPalette {
  constructor() {
    this.isOpen = false;
    this.selectedIndex = 0;
    this.backdrop = null;
    this.input = null;
    this.resultsList = null;

    this.actions = [
      // Navigation
      {
        id: 'nav-overview',
        category: 'PAGES',
        label: 'Jump to: Overview',
        desc: 'Hero KPIs, value proposition, and decoupled architecture summary',
        keywords: 'home main hero stats',
        icon: Icons.shield(16),
        run: () => router.navigate('#/')
      },
      {
        id: 'nav-console',
        category: 'PAGES',
        label: 'Jump to: Live Telemetry Console',
        desc: 'Real-time charts, per-IP ledger, terminal stream, and simulation suite',
        keywords: 'dashboard velocity traffic requests logs ledger terminal',
        icon: Icons.activity(16),
        run: () => router.navigate('#/console')
      },
      {
        id: 'nav-arch',
        category: 'PAGES',
        label: 'Jump to: Architecture Topology',
        desc: 'Interactive dual-path canvas, request lifecycle stepper, and blueprints',
        keywords: 'diagram flow sync async network tokio axum',
        icon: Icons.network(16),
        run: () => router.navigate('#/architecture')
      },
      {
        id: 'nav-globe',
        category: 'PAGES',
        label: 'Jump to: Global View',
        desc: 'Interactive 3D dot-sphere attack arc visualization',
        keywords: 'earth globe 3d world map attacks geo ip',
        icon: Icons.globe(16),
        run: () => router.navigate('#/globe')
      },

      // Attack Simulations
      {
        id: 'sim-ddos',
        category: 'ATTACK SIMULATIONS',
        label: 'Simulate: Volumetric Flood (DDoS)',
        desc: 'Inject 80 req/s automated flood script flagging within 85 ms -> HTTP 429',
        keywords: 'flood attack ddos rate limit socket burst',
        icon: Icons.alert(16),
        run: () => {
          router.navigate('#/console');
          setTimeout(() => {
            document.querySelector('.sim-scenario-btn[data-scenario="ddos"]')?.click();
          }, 300);
        }
      },
      {
        id: 'sim-scraper',
        category: 'ATTACK SIMULATIONS',
        label: 'Simulate: Stealth Scraper (Bot)',
        desc: 'Inject low-and-slow bot exhibiting rigid timer variance (zero jitter)',
        keywords: 'crawler scraping scraper rigid interval variance bot',
        icon: Icons.cpu(16),
        run: () => {
          router.navigate('#/console');
          setTimeout(() => {
            document.querySelector('.sim-scenario-btn[data-scenario="scrape"]')?.click();
          }, 300);
        }
      },
      {
        id: 'sim-credential',
        category: 'ATTACK SIMULATIONS',
        label: 'Simulate: Credential Stuffing',
        desc: 'Inject brute-force login probe triggering 401 error ratio penalty -> HTTP 403',
        keywords: 'auth login password stuffing brute force 403',
        icon: Icons.cross(16),
        run: () => {
          router.navigate('#/console');
          setTimeout(() => {
            document.querySelector('.sim-scenario-btn[data-scenario="credential"]')?.click();
          }, 300);
        }
      },
      {
        id: 'sim-flash',
        category: 'ATTACK SIMULATIONS',
        label: 'Simulate: Benign Flash Crowd',
        desc: 'Test 15 concurrent human users with high jitter (100% 200 OK pass-through)',
        keywords: 'surge product drop traffic flash crowd false positive',
        icon: Icons.check(16),
        run: () => {
          router.navigate('#/console');
          setTimeout(() => {
            document.querySelector('.sim-scenario-btn[data-scenario="flash"]')?.click();
          }, 300);
        }
      },
      {
        id: 'sim-demo',
        category: 'ATTACK SIMULATIONS',
        label: 'Run Full Review 3 Demo Sequence',
        desc: 'Automated 4-phase sequence: Benign -> Scraper -> Flood -> Flash Crowd',
        keywords: 'demo full review walkthrough presentation',
        icon: Icons.play(16),
        run: () => {
          router.navigate('#/console');
          setTimeout(() => {
            document.getElementById('btnRunFullDemo')?.click();
          }, 300);
        }
      },
      {
        id: 'sim-cooldown',
        category: 'ATTACK SIMULATIONS',
        label: 'Trigger Traffic Cooldown & Reset',
        desc: 'Flush sliding-window buffer and restore token buckets to Clean parameters',
        keywords: 'cooldown restore flush reset clean',
        icon: Icons.refresh(16),
        run: () => {
          router.navigate('#/console');
          setTimeout(() => {
            document.querySelector('.sim-scenario-btn[data-scenario="cooldown"]')?.click();
          }, 300);
        }
      },

      // Engineering Blueprints Inspection
      {
        id: 'inspect-arch',
        category: 'ENGINEERING BLUEPRINTS',
        label: 'Inspect: System Architecture Blueprint',
        desc: 'Open full-resolution Fig. 1 wire-speed gateway diagram with 2x zoom',
        keywords: 'blueprint zoom system architecture diagram',
        icon: Icons.layers(16),
        run: () => {
          router.navigate('#/architecture');
          setTimeout(() => {
            document.querySelector('.blueprint-card-trigger[data-src*="system_architecture"]')?.click();
          }, 350);
        }
      },
      {
        id: 'inspect-dataflow',
        category: 'ENGINEERING BLUEPRINTS',
        label: 'Inspect: Telemetry & Data Flow Blueprint',
        desc: 'Open full-resolution Fig. 2 sliding-window pipeline diagram with 2x zoom',
        keywords: 'blueprint zoom data flow diagram sliding window',
        icon: Icons.layers(16),
        run: () => {
          router.navigate('#/architecture');
          setTimeout(() => {
            document.querySelector('.blueprint-card-trigger[data-src*="data_flow_diagram"]')?.click();
          }, 350);
        }
      },

      // System Controls
      {
        id: 'action-theme',
        category: 'SYSTEM CONTROLS',
        label: 'Toggle Dark / Light Theme',
        desc: 'Switch between Obsidian Dark (#050811) and Slate Light (#f4f6fa)',
        keywords: 'theme color mode dark light toggle white black',
        icon: Icons.sun(16),
        run: () => themeManager.toggleTheme()
      },
      {
        id: 'action-noc',
        category: 'SYSTEM CONTROLS',
        label: 'Toggle NOC / Presentation Mode',
        desc: 'Fullscreen presentation mode automatically cycling through critical screens',
        keywords: 'fullscreen noc presentation auto cycle kiosk display',
        icon: Icons.activity(16),
        run: () => this.toggleNocMode()
      },
      {
        id: 'action-reset',
        category: 'SYSTEM CONTROLS',
        label: 'Reset All Client Telemetry Data',
        desc: 'Flush sliding-window telemetry ledger and reputation scores in memory',
        keywords: 'reset clear wipe purge ledger',
        icon: Icons.refresh(16),
        run: () => {
          dataManager.resetTelemetry();
          toastManager.show('Client telemetry ledger flushed to clean baseline', 'clean');
        }
      }
    ];

    this.filtered = [...this.actions];
    this.init();
  }

  init() {
    this.createDom();
    window.addEventListener('open-command-palette', () => this.open());
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && this.isOpen) {
        this.close();
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        if (this.isOpen) this.close();
        else this.open();
      }
    });
  }

  createDom() {
    this.backdrop = document.createElement('div');
    this.backdrop.id = 'cmdKBackdrop';
    this.backdrop.className = 'modal-backdrop';
    this.backdrop.innerHTML = `
      <div class="modal" style="max-width: 620px; padding: 0; overflow: hidden; box-shadow: 0 24px 60px rgba(0,0,0,0.8), 0 0 30px rgba(0, 240, 255, 0.2);" role="dialog" aria-modal="true" aria-label="Spotlight Command Palette">
        <div style="padding: 14px 18px; border-bottom: 1px solid var(--border-subtle); display: flex; align-items: center; gap: 12px; background: var(--bg-surface-elevated);">
          <span style="color: var(--primary-cyan); display: flex;">${Icons.search(18)}</span>
          <input type="text" id="cmdKInput" placeholder="Type to search pages, attack simulations, blueprints, controls..." style="width: 100%; background: transparent; border: none; outline: none; color: var(--text-primary); font-family: var(--font-body); font-size: 0.95rem;">
          <kbd style="font-family: var(--font-mono); font-size: 0.72rem; background: var(--bg-card); padding: 3px 8px; border-radius: 4px; border: 1px solid var(--border-medium); color: var(--text-muted);">ESC</kbd>
        </div>
        <div id="cmdKResults" style="max-height: 380px; overflow-y: auto; padding: 10px;"></div>
      </div>
    `;

    document.body.appendChild(this.backdrop);
    this.input = this.backdrop.querySelector('#cmdKInput');
    this.resultsList = this.backdrop.querySelector('#cmdKResults');

    // Backdrop click
    this.backdrop.addEventListener('click', (e) => {
      if (e.target === this.backdrop) this.close();
    });

    // Input search
    this.input.addEventListener('input', (e) => {
      const q = e.target.value.toLowerCase().trim();
      if (!q) {
        this.filtered = [...this.actions];
      } else {
        const words = q.split(/\s+/);
        this.filtered = this.actions.filter(a => {
          const hay = `${a.category} ${a.label} ${a.desc} ${a.keywords || ''}`.toLowerCase();
          return words.every(w => hay.includes(w));
        });
      }
      this.selectedIndex = 0;
      this.renderResults();
    });

    // Keyboard navigation
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        if (this.filtered.length > 0) {
          this.selectedIndex = (this.selectedIndex + 1) % this.filtered.length;
          this.renderResults();
        }
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        if (this.filtered.length > 0) {
          this.selectedIndex = (this.selectedIndex - 1 + this.filtered.length) % this.filtered.length;
          this.renderResults();
        }
      } else if (e.key === 'Enter') {
        e.preventDefault();
        const action = this.filtered[this.selectedIndex];
        if (action) {
          this.close();
          action.run();
        }
      } else if (e.key === 'Escape') {
        this.close();
      }
    });
  }

  open() {
    this.isOpen = true;
    this.backdrop.classList.add('open');
    this.input.value = '';
    this.filtered = [...this.actions];
    this.selectedIndex = 0;
    this.renderResults();
    setTimeout(() => this.input.focus(), 60);
  }

  close() {
    this.isOpen = false;
    this.backdrop.classList.remove('open');
  }

  renderResults() {
    if (this.filtered.length === 0) {
      this.resultsList.innerHTML = `
        <div style="padding: 24px; text-align: center; color: var(--text-muted); font-size: 0.88rem;">
          No matching commands or actions found. Try searching for "flood", "console", "architecture", or "theme".
        </div>
      `;
      return;
    }

    let lastCategory = '';
    let html = '';

    this.filtered.forEach((item, idx) => {
      if (item.category !== lastCategory) {
        lastCategory = item.category;
        html += `
          <div style="font-family: var(--font-mono); font-size: 0.68rem; font-weight: 700; color: var(--text-muted); padding: 8px 12px 4px; letter-spacing: 0.08em; text-transform: uppercase;">
            ${lastCategory}
          </div>
        `;
      }

      const isSelected = idx === this.selectedIndex;
      html += `
        <div class="cmd-item" data-idx="${idx}" style="padding: 10px 14px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: space-between; cursor: pointer; margin-bottom: 2px; transition: background 0.12s ease; background: ${isSelected ? 'var(--bg-card-hover)' : 'transparent'}; border: 1px solid ${isSelected ? 'var(--border-glow)' : 'transparent'};">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="color: var(--primary-cyan); display: flex; align-items: center;">${item.icon}</span>
            <div>
              <div style="font-weight: 600; font-size: 0.88rem; color: var(--text-primary); line-height: 1.25;">${item.label}</div>
              <div style="font-size: 0.74rem; color: var(--text-muted); line-height: 1.4; margin-top: 2px;">${item.desc}</div>
            </div>
          </div>
          <span style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-muted); padding: 2px 6px; border-radius: 3px; background: rgba(255,255,255,0.04); border: 1px solid var(--border-subtle);">↵ Enter</span>
        </div>
      `;
    });

    this.resultsList.innerHTML = html;

    this.resultsList.querySelectorAll('.cmd-item').forEach(el => {
      el.addEventListener('click', () => {
        const idx = parseInt(el.dataset.idx, 10);
        const action = this.filtered[idx];
        if (action) {
          this.close();
          action.run();
        }
      });
    });
  }

  toggleNocMode() {
    const isFull = !!document.fullscreenElement;
    if (!isFull) {
      document.documentElement.requestFullscreen().then(() => {
        document.body.classList.add('noc-mode-active');
        toastManager.show('NOC Presentation Mode Activated (Auto-cycling critical views)', 'clean');
        this.startNocCycle();
      }).catch(() => {
        toastManager.show('Fullscreen request denied', 'throttled');
      });
    } else {
      document.exitFullscreen().then(() => {
        document.body.classList.remove('noc-mode-active');
        toastManager.show('NOC Mode Deactivated', 'clean');
      });
    }
  }

  startNocCycle() {
    const routes = ['#/console', '#/architecture', '#/globe', '#/'];
    let idx = 0;
    const interval = setInterval(() => {
      if (!document.fullscreenElement) {
        clearInterval(interval);
        return;
      }
      idx = (idx + 1) % routes.length;
      router.navigate(routes[idx]);
    }, 12000);
  }
}

export const commandPalette = new CommandPalette();
