/**
 * IntelliShield Master Application Orchestrator
 * Connects theme management, spatial interactions, router, and event bus.
 */

import { themeManager } from './theme.js';
import { cursorEngine } from './cursor.js';
import { backgroundEngine } from './background.js';
import { router } from './router.js';
import { Icons } from './components/icons.js';
import { DrawerManager, toastManager } from './components/modal.js';
import { settingsDrawer } from './pages/settings.js';
import { ConsolePage } from './pages/console.js';
import { ArchitecturePage } from './pages/architecture.js';
import { MlMitigationPage } from './pages/ml_mitigation.js';
import { MlLabPage } from './pages/ml_lab.js';
import { MitigationPage } from './pages/mitigation.js';
import { SimulatorPage } from './pages/simulator.js';
import { OverviewPage } from './pages/overview.js';
import { BenchmarksPage } from './pages/benchmarks.js';
import { GlobePage } from './pages/globe_page.js';
import { DocsPage } from './pages/docs.js';
import { ResearchPage } from './pages/research.js';
import { tooltipManager } from './components/tooltip.js';
import { commandPalette } from './components/command_palette.js';

class IntelliShieldApp {
  constructor() {
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.init();
  }

  init() {
    // 1. Initialize Settings Drawer DOM
    const drawerEl = document.getElementById('settingsDrawer');
    if (drawerEl) {
      settingsDrawer.refreshDrawer(drawerEl);
    }

    // 2. Setup Navigation & Interaction Listeners
    this.setupNavigation();
    this.setupScrollProgress();
    this.setupSpatialInteractions();
    this.setupPreloader();
    this.setupThemeWatcher();
    this.setupShortcuts();

    // 3. Register Initial Hash Routes
    this.registerCoreRoutes();

    // 4. Initialize Router
    router.init('app');
  }

  setupPreloader() {
    const dismiss = () => {
      setTimeout(() => {
        const preload = document.getElementById('preload');
        if (preload) preload.classList.add('done');
      }, 200);
    };

    if (document.readyState === 'complete' || document.readyState === 'interactive') {
      dismiss();
    } else {
      window.addEventListener('load', dismiss);
    }
    // Reliable failsafe so preloader never gets stuck
    setTimeout(dismiss, 600);
  }

  setupNavigation() {
    // Theme toggle button
    const themeBtn = document.getElementById('themeToggleBtn');
    if (themeBtn) {
      this.updateThemeButtonIcon(themeBtn);
      themeBtn.addEventListener('click', () => {
        themeManager.toggleTheme();
        this.updateThemeButtonIcon(themeBtn);
      });
    }

    // Settings drawer toggle
    const settingsBtn = document.getElementById('settingsToggleBtn');
    if (settingsBtn) {
      settingsBtn.addEventListener('click', () => {
        DrawerManager.open('settingsDrawer');
      });
    }

    // Mobile More sheet toggle
    const moreBtn = document.getElementById('mobileMoreBtn');
    const moreSheet = document.getElementById('mobileMoreSheet');
    const backdrop = document.getElementById('drawerBackdrop');

    if (moreBtn && moreSheet) {
      moreBtn.addEventListener('click', () => {
        moreSheet.classList.toggle('open');
        if (backdrop) backdrop.classList.toggle('open');
      });
    }

    // Mobile settings link in more sheet
    const mobileSettingsLink = document.getElementById('mobileSettingsLink');
    if (mobileSettingsLink) {
      mobileSettingsLink.addEventListener('click', (e) => {
        e.preventDefault();
        if (moreSheet) moreSheet.classList.remove('open');
        DrawerManager.open('settingsDrawer');
      });
    }

    // Backdrop click closes drawers and sheets
    if (backdrop) {
      backdrop.addEventListener('click', () => {
        DrawerManager.closeAll();
        if (moreSheet) moreSheet.classList.remove('open');
      });
    }

    // Close on Escape key
    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        DrawerManager.closeAll();
        if (moreSheet) moreSheet.classList.remove('open');
      }
    });

    // Close mobile sheet when a link is clicked
    document.querySelectorAll('#mobileMoreSheet .sheet-item').forEach(item => {
      item.addEventListener('click', () => {
        if (moreSheet) moreSheet.classList.remove('open');
        if (backdrop) backdrop.classList.remove('open');
      });
    });
  }

  updateThemeButtonIcon(btn) {
    const isLight = themeManager.getResolvedTheme() === 'light';
    btn.innerHTML = isLight ? Icons.moon(18) : Icons.sun(18);
  }

  setupThemeWatcher() {
    window.addEventListener('theme-change', () => {
      const themeBtn = document.getElementById('themeToggleBtn');
      if (themeBtn) this.updateThemeButtonIcon(themeBtn);
      const drawerEl = document.getElementById('settingsDrawer');
      if (drawerEl) settingsDrawer.refreshDrawer(drawerEl);
    });
  }

  setupScrollProgress() {
    const nav = document.getElementById('mainNav');
    const prog = document.getElementById('progress');
    let ticking = false;

    window.addEventListener('scroll', () => {
      if (!ticking) {
        requestAnimationFrame(() => {
          const sy = window.scrollY || 0;
          if (nav) nav.classList.toggle('scrolled', sy > 35);
          
          if (prog) {
            const h = document.documentElement.scrollHeight - window.innerHeight;
            const pct = h > 0 ? (sy / h) * 100 : 0;
            prog.style.width = `${pct}%`;
          }
          ticking = false;
        });
        ticking = true;
      }
    }, { passive: true });
  }

  setupSpatialInteractions() {
    // 1. 3D Scroll Reveal via IntersectionObserver
    const revealObserver = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('in');
          revealObserver.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });

    const observeReveals = () => {
      document.querySelectorAll('.reveal, .d3').forEach(el => {
        if (!el.classList.contains('in')) {
          const rect = el.getBoundingClientRect();
          if (rect.top < (window.innerHeight || 800) && rect.bottom > 0) {
            el.classList.add('in');
          } else {
            revealObserver.observe(el);
          }
        }
      });
    };

    // Observe immediately and on route changes
    observeReveals();
    window.addEventListener('route-change', () => {
      observeReveals();
      setTimeout(observeReveals, 40);
      setTimeout(() => this.triggerCounters(), 60);
    });

    // 2. 3D Tilt Cards & Glow Tracking
    if (!matchMedia('(hover:none)').matches && !this.reduceMotion) {
      document.addEventListener('pointermove', (e) => {
        const card = e.target.closest('.tilt, .glow-track');
        document.querySelectorAll('.tilt.active, .glow-track.active').forEach(c => {
          if (c !== card) {
            c.style.transition = 'transform 0.5s var(--ease-spring)';
            c.style.transform = '';
            c.classList.remove('active');
          }
        });

        if (!card) return;

        const rect = card.getBoundingClientRect();
        const px = (e.clientX - rect.left) / rect.width;
        const py = (e.clientY - rect.top) / rect.height;

        if (card.classList.contains('tilt')) {
          const maxTilt = parseFloat(card.dataset.tilt || 6);
          const rx = (0.5 - py) * maxTilt;
          const ry = (px - 0.5) * maxTilt;
          card.style.transition = 'transform 0.08s linear';
          card.style.transform = `perspective(900px) rotateX(${rx}deg) rotateY(${ry}deg) translateZ(4px)`;
        }

        card.style.setProperty('--mx', `${px * 100}%`);
        card.style.setProperty('--my', `${py * 100}%`);
        card.classList.add('active');
      });

      document.addEventListener('pointerleave', () => {
        document.querySelectorAll('.tilt.active, .glow-track.active').forEach(c => {
          c.style.transition = 'transform 0.5s var(--ease-spring)';
          c.style.transform = '';
          c.classList.remove('active');
        });
      });
    }
  }

  triggerCounters() {
    const counters = document.querySelectorAll('[data-count]');
    const cio = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          this.animateCounter(entry.target);
          cio.unobserve(entry.target);
        }
      });
    }, { threshold: 0.3 });

    counters.forEach(c => cio.observe(c));
  }

  animateCounter(el) {
    const target = parseFloat(el.dataset.count) || 0;
    const decimals = parseInt(el.dataset.decimals || 0, 10);
    const suffix = el.dataset.suffix || '';
    const prefix = el.dataset.prefix || '';

    if (this.reduceMotion) {
      el.textContent = `${prefix}${target.toLocaleString()}${suffix}`;
      return;
    }

    const duration = 1400;
    const t0 = performance.now();

    const step = (t) => {
      const progress = Math.min((t - t0) / duration, 1);
      const ease = 1 - Math.pow(1 - progress, 3); // cubic ease-out
      const val = target * ease;
      el.textContent = `${prefix}${val.toLocaleString(undefined, { minimumFractionDigits: decimals, maximumFractionDigits: decimals })}${suffix}`;
      if (progress < 1) requestAnimationFrame(step);
    };

    requestAnimationFrame(step);
  }

  setupShortcuts() {
    window.addEventListener('keydown', (e) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        window.dispatchEvent(new CustomEvent('open-command-palette'));
      }
    });

    document.getElementById('cmdKTrigger')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('open-command-palette'));
    });
  }

  registerCoreRoutes() {
    let activePage = null;

    const cleanupActivePage = () => {
      if (activePage && typeof activePage.unmount === 'function') {
        activePage.unmount();
      }
      activePage = null;
      DrawerManager.closeAll();
    };

    router.registerRoute('#/', (container) => {
      cleanupActivePage();
      activePage = new OverviewPage();
      activePage.mount(container);
    });

    router.registerRoute('#/console', (container) => {
      cleanupActivePage();
      activePage = new ConsolePage();
      activePage.mount(container);
    });

    router.registerRoute('#/architecture', (container) => {
      cleanupActivePage();
      activePage = new ArchitecturePage();
      activePage.mount(container);
    });

    router.registerRoute('#/ml', () => {
      cleanupActivePage();
      router.navigate('#/console');
    });

    router.registerRoute('#/mitigation', () => {
      cleanupActivePage();
      router.navigate('#/console');
    });

    router.registerRoute('#/simulator', () => {
      cleanupActivePage();
      router.navigate('#/console');
    });

    router.registerRoute('#/benchmarks', (container) => {
      cleanupActivePage();
      activePage = new BenchmarksPage();
      activePage.mount(container);
    });

    router.registerRoute('#/globe', (container) => {
      cleanupActivePage();
      activePage = new GlobePage();
      activePage.mount(container);
    });

    router.registerRoute('#/docs', (container) => {
      cleanupActivePage();
      activePage = new DocsPage();
      activePage.mount(container);
    });

    router.registerRoute('#/research', (container) => {
      cleanupActivePage();
      activePage = new ResearchPage();
      activePage.mount(container);
    });

    router.registerRoute('#/settings', (container) => {
      cleanupActivePage();
      DrawerManager.open('settingsDrawer');
      container.innerHTML = `
        <div class="page-view active">
          <div class="page-header reveal">
            <div class="page-header-title">
              <h2>Console Settings</h2>
              <p>Configure visual preferences, custom cursor mechanics, telemetry rates, and bucket presets.</p>
            </div>
          </div>
          <div class="glass-panel reveal delay1" style="max-width: 680px; margin: 0 auto 32px auto; padding: 24px;" id="settingsPageContainer">
          </div>
        </div>
      `;
      const containerEl = container.querySelector('#settingsPageContainer');
      if (containerEl) {
        settingsDrawer.refreshDrawer(containerEl);
      }
    });

    router.registerRoute('404', (container) => {
      cleanupActivePage();
      container.innerHTML = `
        <div class="page-view active" style="text-align: center; padding: 60px 20px;">
          <h2 style="font-size: 3rem; color: var(--primary-cyan); margin-bottom: 12px;">404</h2>
          <p style="font-size: 1.1rem; margin-bottom: 24px;">Security routing exception: Target route does not exist.</p>
          <a href="#/" class="btn btn-primary">Return to Overview</a>
        </div>
      `;
    });
  }
}

// Register PWA Service Worker for offline capability
if ('serviceWorker' in navigator && (location.protocol === 'http:' || location.protocol === 'https:')) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('./sw.js').catch(() => {});
  });
}

// Instantiate master app
window.intellishieldApp = new IntelliShieldApp();
