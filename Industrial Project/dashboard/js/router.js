/**
 * IntelliShield Client-Side Hash Router
 * Supports static hosting, deep linking, 404 handling, and responsive navigation sync.
 */

export class Router {
  constructor(routes = {}) {
    this.routes = routes;
    this.currentRoute = null;
    this.defaultRoute = '#/';
    this.container = null;

    window.addEventListener('hashchange', () => this.handleHashChange());
  }

  init(containerId = 'app') {
    this.container = document.getElementById(containerId);
    this.handleHashChange();
  }

  registerRoute(hash, handler) {
    this.routes[hash] = handler;
  }

  navigate(hash) {
    if (window.location.hash !== hash) {
      window.location.hash = hash;
    } else {
      this.handleHashChange();
    }
  }

  getCurrentHash() {
    const raw = window.location.hash || this.defaultRoute;
    return raw.split('?')[0]; // strip query params if any
  }

  handleHashChange() {
    const hash = this.getCurrentHash();
    const handler = this.routes[hash] || this.routes['404'] || this.routes[this.defaultRoute];

    this.currentRoute = hash;

    // Update desktop nav & mobile tabs active state
    this.syncNavElements(hash);

    // Scroll to top
    window.scrollTo({ top: 0, behavior: 'smooth' });

    if (handler && this.container) {
      try {
        handler(this.container);
      } catch (err) {
        console.error('Route render error:', err);
      }
    }

    // Trigger reveal observer for new DOM elements
    window.dispatchEvent(new CustomEvent('route-change', { detail: { route: hash } }));
  }

  syncNavElements(activeHash) {
    // 1. Desktop Nav
    document.querySelectorAll('.nav-link').forEach(link => {
      const href = link.getAttribute('href');
      if (href === activeHash || (activeHash === '#/' && href === '#/')) {
        link.classList.add('active');
        link.setAttribute('aria-current', 'page');
      } else {
        link.classList.remove('active');
        link.removeAttribute('aria-current');
      }
    });

    // 2. Mobile Bottom Tab Bar
    document.querySelectorAll('.tab-item').forEach(tab => {
      const href = tab.getAttribute('href');
      if (href === activeHash) {
        tab.classList.add('active');
      } else {
        tab.classList.remove('active');
      }
    });

    // 3. Mobile More Sheet Items
    document.querySelectorAll('.sheet-item').forEach(item => {
      const href = item.getAttribute('href');
      if (href === activeHash) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }
}

export const router = new Router();
