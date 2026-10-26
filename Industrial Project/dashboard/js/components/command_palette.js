/**
 * IntelliShield Command Palette & Spotlight Overlay
 * Triggered via Ctrl+K / Cmd+K. Searchable quick jumps, NOC presentation mode,
 * theme toggling, and export shortcuts.
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
      { id: 'nav-overview', label: 'Jump to: Overview', desc: 'Hero KPIs and value proposition', icon: Icons.shield(16), run: () => router.navigate('#/') },
      { id: 'nav-console', label: 'Jump to: Live Telemetry Console', desc: 'Real-time charts, per-IP ledger, terminal stream', icon: Icons.activity(16), run: () => router.navigate('#/console') },
      { id: 'nav-arch', label: 'Jump to: Architecture Topology', desc: 'Interactive dual-path diagram & lifecycle stepper', icon: Icons.network(16), run: () => router.navigate('#/architecture') },
      { id: 'nav-ml', label: 'Jump to: ML & Mitigation Lab', desc: '8D telemetry sliders, Isolation Forest scoring, and quadratic token bucket', icon: Icons.cpu(16), run: () => router.navigate('#/ml') },
      { id: 'nav-globe', label: 'Jump to: Global View', desc: '3D dot-sphere attack arc visualization', icon: Icons.globe(16), run: () => router.navigate('#/globe') },
      { id: 'nav-docs', label: 'Jump to: Docs & Deployment', desc: 'Docker, Rust, and Cloudflare tunnel runbooks', icon: Icons.code(16), run: () => router.navigate('#/docs') },
      { id: 'nav-research', label: 'Jump to: Research & Viva Guide', desc: '205 technical defense questions & practice mode', icon: Icons.book(16), run: () => router.navigate('#/research') },
      { id: 'action-theme', label: 'Toggle Dark / Light Theme', desc: 'Cross-fade UI and repaint canvas layers', icon: Icons.sun(16), run: () => themeManager.toggleTheme() },
      { id: 'action-demo', label: 'Run Full Review 3 Demo', desc: 'Auto-play 4-phase attack validation sequence in Live Console', icon: Icons.play(16), run: () => { router.navigate('#/console'); setTimeout(() => document.getElementById('btnRunFullDemo')?.click(), 300); } },
      { id: 'action-noc', label: 'Toggle NOC / Presentation Mode', desc: 'Fullscreen display cycling through critical views', icon: Icons.activity(16), run: () => this.toggleNocMode() },
      { id: 'action-reset', label: 'Reset All Client Telemetry', desc: 'Flush sliding-window telemetry and reputation scores', icon: Icons.refresh(16), run: () => dataManager.resetTelemetry() }
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
    });
  }

  createDom() {
    this.backdrop = document.createElement('div');
    this.backdrop.id = 'cmdKBackdrop';
    this.backdrop.className = 'modal-backdrop';
    this.backdrop.innerHTML = `
      <div class="modal" style="max-width: 580px; padding: 0; overflow: hidden;" role="dialog" aria-modal="true" aria-label="Command Palette">
        <div style="padding: 14px 16px; border-bottom: 1px solid var(--border-subtle); display: flex; align-items: center; gap: 10px;">
          ${Icons.search(18)}
          <input type="text" id="cmdKInput" placeholder="Type a command or jump to page..." style="width: 100%; background: transparent; border: none; outline: none; color: var(--text-primary); font-family: var(--font-body); font-size: 0.95rem;">
          <kbd style="font-family: var(--font-mono); font-size: 0.72rem; background: var(--bg-surface-elevated); padding: 2px 6px; border-radius: 4px; border: 1px solid var(--border-medium); color: var(--text-muted);">ESC</kbd>
        </div>
        <div id="cmdKResults" style="max-height: 340px; overflow-y: auto; padding: 8px;"></div>
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
      this.filtered = this.actions.filter(a => a.label.toLowerCase().includes(q) || a.desc.toLowerCase().includes(q));
      this.selectedIndex = 0;
      this.renderResults();
    });

    // Keyboard navigation
    this.input.addEventListener('keydown', (e) => {
      if (e.key === 'ArrowDown') {
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex + 1) % this.filtered.length;
        this.renderResults();
      } else if (e.key === 'ArrowUp') {
        e.preventDefault();
        this.selectedIndex = (this.selectedIndex - 1 + this.filtered.length) % this.filtered.length;
        this.renderResults();
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
    setTimeout(() => this.input.focus(), 50);
  }

  close() {
    this.isOpen = false;
    this.backdrop.classList.remove('open');
  }

  renderResults() {
    if (this.filtered.length === 0) {
      this.resultsList.innerHTML = `<div style="padding: 16px; text-align: center; color: var(--text-muted); font-size: 0.85rem;">No matching commands found.</div>`;
      return;
    }

    this.resultsList.innerHTML = this.filtered.map((item, idx) => `
      <div class="cmd-item" data-idx="${idx}" style="padding: 10px 14px; border-radius: var(--radius-sm); display: flex; align-items: center; justify-content: space-between; cursor: pointer; background: ${idx === this.selectedIndex ? 'var(--bg-card-hover)' : 'transparent'};">
        <div style="display: flex; align-items: center; gap: 12px;">
          <span style="color: var(--primary-cyan);">${item.icon}</span>
          <div>
            <div style="font-weight: 600; font-size: 0.88rem; color: var(--text-primary);">${item.label}</div>
            <div style="font-size: 0.75rem; color: var(--text-muted);">${item.desc}</div>
          </div>
        </div>
        <span style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--text-muted);">↵</span>
      </div>
    `).join('');

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
        toastManager.show('NOC Presentation Mode Activated (Auto-cycling views)', 'clean');
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
    const routes = ['#/console', '#/architecture', '#/ml', '#/mitigation'];
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
