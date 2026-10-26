/**
 * IntelliShield Theme Management System
 * Handles 'dark', 'light', and 'system' modes with zero flash of unstyled content.
 * Dispatches 'theme-change' custom event for canvas repainting.
 */

const STORAGE_KEY = 'intellishield-theme';

export class ThemeManager {
  constructor() {
    this.currentSetting = this.loadSetting();
    this.mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
    this.init();
  }

  loadSetting() {
    try {
      if (typeof window !== 'undefined' && window.location.search) {
        if (window.location.search.indexOf('theme=light') !== -1) return 'light';
        if (window.location.search.indexOf('theme=dark') !== -1) return 'dark';
      }
      return localStorage.getItem(STORAGE_KEY) || 'system';
    } catch (e) {
      return 'system';
    }
  }

  saveSetting(val) {
    try {
      localStorage.setItem(STORAGE_KEY, val);
    } catch (e) {}
  }

  getResolvedTheme() {
    if (this.currentSetting === 'system') {
      return this.mediaQuery.matches ? 'dark' : 'light';
    }
    return this.currentSetting;
  }

  init() {
    this.apply(this.getResolvedTheme(), false);

    // Watch for system theme changes if set to system
    this.mediaQuery.addEventListener('change', () => {
      if (this.currentSetting === 'system') {
        this.apply(this.getResolvedTheme(), true);
      }
    });
  }

  setTheme(theme) {
    if (!['dark', 'light', 'system'].includes(theme)) return;
    this.currentSetting = theme;
    this.saveSetting(theme);
    this.apply(this.getResolvedTheme(), true);
  }

  toggleTheme() {
    const resolved = this.getResolvedTheme();
    const next = resolved === 'dark' ? 'light' : 'dark';
    this.setTheme(next);
  }

  apply(theme, dispatch = true) {
    document.documentElement.setAttribute('data-theme', theme);

    if (dispatch) {
      window.dispatchEvent(new CustomEvent('theme-change', {
        detail: {
          theme,
          setting: this.currentSetting
        }
      }));
    }
  }

  getCanvasColors() {
    const isLight = this.getResolvedTheme() === 'light';
    const cs = getComputedStyle(document.documentElement);
    return {
      isLight,
      bg: cs.getPropertyValue('--canvas-bg').trim() || (isLight ? '#f4f6fa' : '#050811'),
      grid: cs.getPropertyValue('--canvas-grid').trim() || (isLight ? 'rgba(15,23,42,0.06)' : 'rgba(56,189,248,0.08)'),
      particle: cs.getPropertyValue('--canvas-particle').trim() || (isLight ? 'rgba(2,132,199,0.55)' : 'rgba(56,189,248,0.7)'),
      particleTrail: cs.getPropertyValue('--canvas-particle-trail').trim() || (isLight ? 'rgba(2,132,199,0.35)' : 'rgba(0,240,255,0.4)'),
      chartLine: cs.getPropertyValue('--canvas-chart-line').trim() || (isLight ? '#0284c7' : '#00f0ff'),
      chartFill: cs.getPropertyValue('--canvas-chart-fill').trim() || (isLight ? 'rgba(2,132,199,0.12)' : 'rgba(0,240,255,0.12)'),
      chartP99: cs.getPropertyValue('--canvas-chart-p99').trim() || '#f59e0b',
      clean: cs.getPropertyValue('--tier-clean').trim() || '#10b981',
      monitored: cs.getPropertyValue('--tier-monitored').trim() || '#06b6d4',
      throttled: cs.getPropertyValue('--tier-throttled').trim() || '#f59e0b',
      blocked: cs.getPropertyValue('--tier-blocked').trim() || '#ef4444'
    };
  }
}

export const themeManager = new ThemeManager();
if (typeof window !== 'undefined') {
  window.themeManager = themeManager;
}
