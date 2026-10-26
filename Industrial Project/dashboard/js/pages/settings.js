/**
 * IntelliShield Settings Drawer Component
 * Configures themes, custom cursor, motion preferences, data source modes, and reset actions.
 */

import { themeManager } from '../theme.js';
import { cursorEngine } from '../cursor.js';
import { Icons } from '../components/icons.js';
import { DrawerManager } from '../components/modal.js';

export class SettingsDrawer {
  constructor() {
    this.dataSourceMode = this.loadDataSourceMode();
    this.pollInterval = this.loadPollInterval();
    this.soundAlerts = this.loadSoundAlerts();
  }

  loadDataSourceMode() {
    try {
      return localStorage.getItem('intellishield-source-mode') || 'auto';
    } catch (e) {
      return 'auto';
    }
  }

  saveDataSourceMode(mode) {
    try {
      localStorage.setItem('intellishield-source-mode', mode);
    } catch (e) {}
  }

  loadPollInterval() {
    try {
      return parseInt(localStorage.getItem('intellishield-poll-ms'), 10) || 1000;
    } catch (e) {
      return 1000;
    }
  }

  savePollInterval(ms) {
    try {
      localStorage.setItem('intellishield-poll-ms', String(ms));
    } catch (e) {}
  }

  loadSoundAlerts() {
    try {
      return localStorage.getItem('intellishield-sound') === 'true';
    } catch (e) {
      return false;
    }
  }

  saveSoundAlerts(val) {
    try {
      localStorage.setItem('intellishield-sound', String(val));
    } catch (e) {}
  }

  render() {
    const currentTheme = themeManager.currentSetting;
    const isCustomCursor = cursorEngine.enabled;
    const isHaptics = cursorEngine.hapticsEnabled;

    return `
      <div class="drawer-header">
        <div style="display: flex; align-items: center; gap: 8px;">
          ${Icons.settings(20)}
          <h3 style="font-size: 1.1rem; margin: 0;">Console Settings</h3>
        </div>
        <button class="drawer-close" id="closeSettingsBtn" aria-label="Close Settings Drawer">
          ${Icons.cross(18)}
        </button>
      </div>

      <!-- Theme Selector -->
      <div class="form-group">
        <label class="form-label">Color Theme</label>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
          <button class="btn btn-secondary ${currentTheme === 'dark' ? 'btn-primary' : ''}" id="setThemeDark">
            ${Icons.moon(16)} Dark
          </button>
          <button class="btn btn-secondary ${currentTheme === 'light' ? 'btn-primary' : ''}" id="setThemeLight">
            ${Icons.sun(16)} Light
          </button>
          <button class="btn btn-secondary ${currentTheme === 'system' ? 'btn-primary' : ''}" id="setThemeSystem">
            ${Icons.cpu(16)} System
          </button>
        </div>
      </div>

      <!-- Data Source Selector -->
      <div class="form-group" style="margin-top: 14px;">
        <label class="form-label">
          <span>Telemetry Data Source</span>
          <span style="font-family: var(--font-mono); font-size: 0.72rem; color: var(--primary-cyan);">${this.dataSourceMode.toUpperCase()}</span>
        </label>
        <div style="display: grid; grid-template-columns: repeat(3, 1fr); gap: 8px;">
          <button class="btn btn-secondary ${this.dataSourceMode === 'auto' ? 'btn-primary' : ''}" id="setSourceAuto">
            Auto
          </button>
          <button class="btn btn-secondary ${this.dataSourceMode === 'live' ? 'btn-primary' : ''}" id="setSourceLive">
            Live (:8080)
          </button>
          <button class="btn btn-secondary ${this.dataSourceMode === 'demo' ? 'btn-primary' : ''}" id="setSourceDemo">
            Demo Sim
          </button>
        </div>
        <p style="font-size: 0.75rem; color: var(--text-muted); margin-top: 6px;">
          Auto tries live proxy first; falls back to deterministic client simulator if unreachable.
        </p>
      </div>

      <!-- Refresh Rate -->
      <div class="form-group" style="margin-top: 14px;">
        <label class="form-label">
          <span>Polling Refresh Rate</span>
          <span id="pollRateVal" style="font-family: var(--font-mono);">${this.pollInterval} ms</span>
        </label>
        <input type="range" id="pollRateSlider" min="500" max="3000" step="250" value="${this.pollInterval}">
      </div>

      <!-- Custom Cursor Toggle -->
      <div class="form-group" style="display: flex; flex-direction: row; align-items: center; justify-content: space-between; margin-top: 10px;">
        <div>
          <div style="font-weight: 600; font-size: 0.85rem;">Custom Cursor & Magnetics</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">Lerp follower ring and button magnetic pull</div>
        </div>
        <label class="switch">
          <input type="checkbox" id="cursorToggle" ${isCustomCursor ? 'checked' : ''}>
          <span class="switch-slider"></span>
        </label>
      </div>

      <!-- Haptics Feedback Toggle -->
      <div class="form-group" style="display: flex; flex-direction: row; align-items: center; justify-content: space-between; margin-top: 10px;">
        <div>
          <div style="font-weight: 600; font-size: 0.85rem;">Haptic Vibrations</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">Mobile vibration tick on reputation tier changes</div>
        </div>
        <label class="switch">
          <input type="checkbox" id="hapticsToggle" ${isHaptics ? 'checked' : ''}>
          <span class="switch-slider"></span>
        </label>
      </div>

      <!-- Sound Alerts Toggle -->
      <div class="form-group" style="display: flex; flex-direction: row; align-items: center; justify-content: space-between; margin-top: 10px;">
        <div>
          <div style="font-weight: 600; font-size: 0.85rem;">Audio Alerts</div>
          <div style="font-size: 0.75rem; color: var(--text-muted);">Synthesized audio alert on Block/Throttle events (off by default)</div>
        </div>
        <label class="switch">
          <input type="checkbox" id="soundToggle" ${this.soundAlerts ? 'checked' : ''}>
          <span class="switch-slider"></span>
        </label>
      </div>

      <!-- Emergency Telemetry Reset -->
      <div style="margin-top: 24px; padding-top: 20px; border-top: 1px solid var(--border-subtle); display: flex; flex-direction: column; gap: 10px;">
        <button class="btn btn-danger" id="resetTelemetryBtn" style="width: 100%;">
          ${Icons.refresh(16)} Reset Telemetry & Reputation
        </button>
        <button class="btn btn-ghost" id="restoreDefaultsBtn" style="width: 100%; font-size: 0.8rem;">
          Restore Default Settings
        </button>
      </div>
    `;
  }

  attachEvents(container) {
    // Theme triggers
    container.querySelector('#setThemeDark')?.addEventListener('click', () => {
      themeManager.setTheme('dark');
      this.refreshDrawer(container);
    });
    container.querySelector('#setThemeLight')?.addEventListener('click', () => {
      themeManager.setTheme('light');
      this.refreshDrawer(container);
    });
    container.querySelector('#setThemeSystem')?.addEventListener('click', () => {
      themeManager.setTheme('system');
      this.refreshDrawer(container);
    });

    // Close button
    container.querySelector('#closeSettingsBtn')?.addEventListener('click', () => {
      DrawerManager.close('settingsDrawer');
    });

    // Data source triggers
    container.querySelector('#setSourceAuto')?.addEventListener('click', () => {
      this.dataSourceMode = 'auto';
      this.saveDataSourceMode('auto');
      window.dispatchEvent(new CustomEvent('datasource-change', { detail: { mode: 'auto' } }));
      this.refreshDrawer(container);
    });
    container.querySelector('#setSourceLive')?.addEventListener('click', () => {
      this.dataSourceMode = 'live';
      this.saveDataSourceMode('live');
      window.dispatchEvent(new CustomEvent('datasource-change', { detail: { mode: 'live' } }));
      this.refreshDrawer(container);
    });
    container.querySelector('#setSourceDemo')?.addEventListener('click', () => {
      this.dataSourceMode = 'demo';
      this.saveDataSourceMode('demo');
      window.dispatchEvent(new CustomEvent('datasource-change', { detail: { mode: 'demo' } }));
      this.refreshDrawer(container);
    });

    // Polling rate
    const slider = container.querySelector('#pollRateSlider');
    const label = container.querySelector('#pollRateVal');
    slider?.addEventListener('input', (e) => {
      const val = parseInt(e.target.value, 10);
      label.textContent = `${val} ms`;
      this.pollInterval = val;
      this.savePollInterval(val);
      window.dispatchEvent(new CustomEvent('poll-rate-change', { detail: { intervalMs: val } }));
    });

    // Cursor toggle
    container.querySelector('#cursorToggle')?.addEventListener('change', (e) => {
      cursorEngine.setEnabled(e.target.checked);
    });

    // Haptics toggle
    container.querySelector('#hapticsToggle')?.addEventListener('change', (e) => {
      cursorEngine.hapticsEnabled = e.target.checked;
      cursorEngine.saveHapticsPref(e.target.checked);
    });

    // Sound toggle
    container.querySelector('#soundToggle')?.addEventListener('change', (e) => {
      this.soundAlerts = e.target.checked;
      this.saveSoundAlerts(e.target.checked);
    });

    // Reset telemetry
    container.querySelector('#resetTelemetryBtn')?.addEventListener('click', async () => {
      if (confirm('Reset all client reputation scores and rolling telemetry buffers?')) {
        window.dispatchEvent(new CustomEvent('reset-telemetry'));
        DrawerManager.close('settingsDrawer');
      }
    });

    // Restore defaults
    container.querySelector('#restoreDefaultsBtn')?.addEventListener('click', () => {
      localStorage.clear();
      window.location.reload();
    });
  }

  refreshDrawer(container) {
    container.innerHTML = this.render();
    this.attachEvents(container);
  }
}

export const settingsDrawer = new SettingsDrawer();
