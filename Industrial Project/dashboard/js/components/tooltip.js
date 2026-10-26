/**
 * IntelliShield Universal Cyber Tooltip & Contextual Action Guide
 * Renders floating, high-contrast, theme-adaptive glass tooltips explaining:
 * - What the hovered element is
 * - What data or metric it represents
 * - Exactly what action will occur if clicked
 */

export class TooltipManager {
  constructor() {
    this.el = null;
    this.titleEl = null;
    this.badgeEl = null;
    this.bodyEl = null;
    this.actionEl = null;
    this.actionTextEl = null;
    this.visible = false;
    this.currentTarget = null;
    this.init();
  }

  init() {
    if (typeof document === 'undefined') return;

    this.el = document.getElementById('globalTooltip');
    if (!this.el) {
      this.el = document.createElement('div');
      this.el.id = 'globalTooltip';
      this.el.className = 'cyber-tooltip';
      this.el.setAttribute('role', 'tooltip');
      this.el.setAttribute('aria-hidden', 'true');
      this.el.innerHTML = `
        <div class="tooltip-header">
          <span class="tooltip-badge" id="tooltipBadge">INFO</span>
          <span class="tooltip-title" id="tooltipTitle"></span>
        </div>
        <div class="tooltip-body" id="tooltipBody"></div>
        <div class="tooltip-action" id="tooltipAction">
          <span class="tooltip-action-arrow">&rarr;</span>
          <span class="tooltip-action-text" id="tooltipActionText"></span>
        </div>
      `;
      document.body.appendChild(this.el);
    }

    this.badgeEl = this.el.querySelector('#tooltipBadge');
    this.titleEl = this.el.querySelector('#tooltipTitle');
    this.bodyEl = this.el.querySelector('#tooltipBody');
    this.actionEl = this.el.querySelector('#tooltipAction');
    this.actionTextEl = this.el.querySelector('#tooltipActionText');

    this.attachGlobalDelegation();
  }

  attachGlobalDelegation() {
    document.addEventListener('mouseover', (e) => {
      // Do not allow parent container tooltips to hijack interactive canvas elements
      if (e.target && (e.target.tagName === 'CANVAS' || e.target.closest('canvas'))) return;

      const target = e.target.closest('[data-tooltip], [data-tooltip-desc], [data-tooltip-title]');
      if (target) {
        this.currentTarget = target;
        const title = target.getAttribute('data-tooltip-title') || target.getAttribute('aria-label') || target.getAttribute('title') || '';
        const desc = target.getAttribute('data-tooltip-desc') || target.getAttribute('data-tooltip') || '';
        const action = target.getAttribute('data-tooltip-action') || '';
        const badge = target.getAttribute('data-tooltip-badge') || (action ? 'ACTION' : 'METRIC');
        const tier = target.getAttribute('data-tooltip-tier') || '';

        this.show({
          x: e.clientX,
          y: e.clientY,
          title,
          desc,
          action,
          badge,
          tier
        });
      }
    }, { passive: true });

    document.addEventListener('mousemove', (e) => {
      if (e.target && (e.target.tagName === 'CANVAS' || e.target.closest('canvas'))) return;
      if (this.visible && this.currentTarget) {
        this.updatePosition(e.clientX, e.clientY);
      }
    }, { passive: true });

    document.addEventListener('mouseout', (e) => {
      const target = e.target.closest('[data-tooltip], [data-tooltip-desc], [data-tooltip-title]');
      if (target && target === this.currentTarget) {
        this.currentTarget = null;
        this.hide();
      }
    }, { passive: true });
  }

  show({ x, y, title = '', desc = '', action = '', badge = 'INFO', tier = '' }) {
    if (!this.el) return;

    // Reset tier classes
    this.el.className = 'cyber-tooltip';
    if (tier) {
      this.el.classList.add(`tier-${tier.toLowerCase()}`);
    }

    if (this.badgeEl) this.badgeEl.textContent = badge;
    if (this.titleEl) {
      this.titleEl.textContent = title;
      this.titleEl.style.display = title ? 'block' : 'none';
    }
    if (this.bodyEl) {
      this.bodyEl.textContent = desc;
      this.bodyEl.style.display = desc ? 'block' : 'none';
    }
    if (this.actionEl && this.actionTextEl) {
      if (action) {
        this.actionTextEl.textContent = action;
        this.actionEl.style.display = 'flex';
      } else {
        this.actionEl.style.display = 'none';
      }
    }

    this.updatePosition(x, y);
    this.el.classList.add('visible');
    this.visible = true;
  }

  updatePosition(x, y) {
    if (!this.el) return;
    const w = this.el.offsetWidth || 260;
    const h = this.el.offsetHeight || 90;
    const pad = 14;

    let posX = x + pad;
    let posY = y + pad;

    // Viewport collision handling
    if (posX + w > window.innerWidth - 12) {
      posX = x - w - pad;
      if (posX < 12) posX = 12;
    }

    if (posY + h > window.innerHeight - 12) {
      posY = y - h - pad;
      if (posY < 12) posY = 12;
    }

    this.el.style.left = `${Math.round(posX)}px`;
    this.el.style.top = `${Math.round(posY)}px`;
  }

  hide() {
    if (!this.el) return;
    this.el.classList.remove('visible');
    this.visible = false;
  }
}

export const tooltipManager = new TooltipManager();
if (typeof window !== 'undefined') {
  window.tooltipManager = tooltipManager;
}
