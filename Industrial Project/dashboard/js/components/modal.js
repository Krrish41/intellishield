/**
 * IntelliShield Modal, Drawer & Toast Notification System
 * Zero layout thrash, accessible keyboard escapes, and semantic tier styling.
 */

import { Icons } from './icons.js';

class ToastManager {
  constructor() {
    this.container = null;
    this.init();
  }

  init() {
    this.container = document.getElementById('toastContainer');
    if (!this.container) {
      this.container = document.createElement('div');
      this.container.id = 'toastContainer';
      this.container.className = 'toast-container';
      this.container.setAttribute('aria-live', 'polite');
      document.body.appendChild(this.container);
    }
  }

  show(message, type = 'clean', duration = 3500) {
    if (!this.container) this.init();

    const toast = document.createElement('div');
    toast.className = `toast toast-${type}`;

    let iconSvg = Icons.check(16);
    if (type === 'blocked') iconSvg = Icons.cross(16);
    else if (type === 'throttled') iconSvg = Icons.zap(16);
    else if (type === 'monitored') iconSvg = Icons.activity(16);

    toast.innerHTML = `
      <div style="color: var(--tier-${type}); flex-shrink: 0; margin-top: 2px;">
        ${iconSvg}
      </div>
      <div style="flex: 1; line-height: 1.4;">
        ${this.escapeHtml(message)}
      </div>
    `;

    this.container.appendChild(toast);

    setTimeout(() => {
      toast.style.opacity = '0';
      toast.style.transform = 'translateY(10px) scale(0.95)';
      toast.style.transition = 'all 0.25s ease';
      setTimeout(() => toast.remove(), 250);
    }, duration);
  }

  escapeHtml(str) {
    const p = document.createElement('p');
    p.textContent = str;
    return p.innerHTML;
  }
}

export const toastManager = new ToastManager();

export const DrawerManager = {
  open(id) {
    const el = document.getElementById(id);
    const backdrop = document.getElementById('drawerBackdrop');
    if (el) el.classList.add('open');
    if (backdrop) backdrop.classList.add('open');
  },
  close(id) {
    const el = document.getElementById(id);
    const backdrop = document.getElementById('drawerBackdrop');
    if (el) el.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
  },
  closeAll() {
    document.querySelectorAll('.drawer.open').forEach(d => d.classList.remove('open'));
    const backdrop = document.getElementById('drawerBackdrop');
    if (backdrop) backdrop.classList.remove('open');
  }
};

export const ModalManager = {
  open(id) {
    const el = document.getElementById(id);
    if (el) el.classList.add('open');
  },
  close(id) {
    const el = document.getElementById(id);
    if (el) el.classList.remove('open');
  }
};
