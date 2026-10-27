/**
 * IntelliShield Dual Cursor & Touch Interaction Engine
 * Desktop fine pointer: Eased lerp ring, magnetic buttons, data-driven comet trail.
 * Mobile coarse pointer: Tap ripples, packet finger trail, optional haptic ticks.
 * Zero layout thrash, disabled under prefers-reduced-motion.
 */

const STORAGE_CURSOR_KEY = 'intellishield-custom-cursor';
const STORAGE_HAPTICS_KEY = 'intellishield-haptics';

export class CursorEngine {
  constructor() {
    this.isTouch = window.matchMedia('(pointer: coarse)').matches;
    this.reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    this.enabled = this.loadCursorPref();
    this.hapticsEnabled = this.loadHapticsPref();
    
    this.mouse = { x: -100, y: -100 };
    this.ring = { x: -100, y: -100 };
    this.trail = [];
    this.worstTierColor = 'var(--tier-clean)';
    this.activeMagnetic = null;
    this.isClicking = false;

    this.dotEl = null;
    this.ringEl = null;
    this.rAF = null;

    if (!this.reduceMotion && this.enabled) {
      this.init();
    }
  }

  loadCursorPref() {
    try {
      const v = localStorage.getItem(STORAGE_CURSOR_KEY);
      return v !== null ? v === 'true' : true;
    } catch (e) {
      return true;
    }
  }

  saveCursorPref(val) {
    try {
      localStorage.setItem(STORAGE_CURSOR_KEY, String(val));
    } catch (e) {}
  }

  loadHapticsPref() {
    try {
      const v = localStorage.getItem(STORAGE_HAPTICS_KEY);
      return v !== null ? v === 'true' : true;
    } catch (e) {}
    return true;
  }

  saveHapticsPref(val) {
    try {
      localStorage.setItem(STORAGE_HAPTICS_KEY, String(val));
    } catch (e) {}
  }

  init() {
    if (this.isTouch) {
      this.initTouchHandlers();
    } else {
      this.initMouseHandlers();
    }
  }

  initMouseHandlers() {
    document.body.classList.add('custom-cursor-active');

    this.dotEl = document.getElementById('cursorDot');
    this.ringEl = document.getElementById('cursorRing');

    if (!this.dotEl) {
      this.dotEl = document.createElement('div');
      this.dotEl.id = 'cursorDot';
      document.body.appendChild(this.dotEl);
    }
    if (!this.ringEl) {
      this.ringEl = document.createElement('div');
      this.ringEl.id = 'cursorRing';
      document.body.appendChild(this.ringEl);
    }

    window.addEventListener('pointermove', (e) => {
      this.mouse.x = e.clientX;
      this.mouse.y = e.clientY;

      if (this.dotEl) {
        this.dotEl.style.transform = `translate3d(${e.clientX}px, ${e.clientY}px, 0) translate(-50%, -50%)`;
      }

      // Add particle to comet trail
      if (Math.random() < 0.6) {
        this.addTrailParticle(e.clientX, e.clientY);
      }
    }, { passive: true });

    window.addEventListener('pointerdown', () => {
      this.isClicking = true;
      if (this.ringEl) this.ringEl.classList.add('active-click');
    });

    window.addEventListener('pointerup', () => {
      this.isClicking = false;
      if (this.ringEl) this.ringEl.classList.remove('active-click');
    });

    // Magnetic pull & hover detection on interactive elements
    document.addEventListener('mouseover', (e) => {
      const target = e.target.closest('a, button, input, .clickable, .card');
      if (target) {
        if (this.ringEl) this.ringEl.classList.add('hovering');

        if (target.classList.contains('btn') || target.tagName === 'BUTTON') {
          this.activeMagnetic = target;
        }
      }
    });

    document.addEventListener('mouseout', (e) => {
      const target = e.target.closest('a, button, input, .clickable, .card');
      if (target) {
        if (this.ringEl) this.ringEl.classList.remove('hovering');
        
        if (this.activeMagnetic) {
          this.activeMagnetic.style.transform = '';
          this.activeMagnetic = null;
        }
      }
    });

    this.startLoop();
  }

  initTouchHandlers() {
    window.addEventListener('touchstart', (e) => {
      if (e.touches.length > 0) {
        const touch = e.touches[0];
        this.spawnTouchRipple(touch.clientX, touch.clientY);
      }
    }, { passive: true });

    window.addEventListener('touchmove', (e) => {
      if (e.touches.length > 0 && Math.random() < 0.5) {
        const touch = e.touches[0];
        this.addTrailParticle(touch.clientX, touch.clientY);
      }
    }, { passive: true });
  }

  spawnTouchRipple(x, y) {
    const ripple = document.createElement('div');
    ripple.className = 'touch-ripple';
    ripple.style.left = `${x}px`;
    ripple.style.top = `${y}px`;
    ripple.style.width = '60px';
    ripple.style.height = '60px';
    document.body.appendChild(ripple);
    setTimeout(() => ripple.remove(), 450);
  }

  addTrailParticle(x, y) {
    if (this.trail.length > 12) return;
    const dot = document.createElement('div');
    dot.style.position = 'fixed';
    dot.style.left = `${x}px`;
    dot.style.top = `${y}px`;
    dot.style.width = '4px';
    dot.style.height = '4px';
    dot.style.borderRadius = '50%';
    dot.style.backgroundColor = this.worstTierColor;
    dot.style.boxShadow = `0 0 6px ${this.worstTierColor}`;
    dot.style.pointerEvents = 'none';
    dot.style.zIndex = '9998';
    dot.style.transform = 'translate(-50%, -50%)';
    dot.style.transition = 'opacity 0.4s ease, transform 0.4s ease';
    document.body.appendChild(dot);
    this.trail.push(dot);

    requestAnimationFrame(() => {
      dot.style.opacity = '0';
      dot.style.transform = 'translate(-50%, -50%) scale(0.2)';
    });

    setTimeout(() => {
      dot.remove();
      const idx = this.trail.indexOf(dot);
      if (idx > -1) this.trail.splice(idx, 1);
    }, 400);
  }

  setTierColor(tier) {
    if (tier === 'Blocked') {
      this.worstTierColor = 'var(--tier-blocked)';
    } else if (tier === 'Throttled') {
      this.worstTierColor = 'var(--tier-throttled)';
    } else if (tier === 'Monitored') {
      this.worstTierColor = 'var(--tier-monitored)';
    } else {
      this.worstTierColor = 'var(--tier-clean)';
    }

    if (this.ringEl) {
      this.ringEl.style.borderColor = this.worstTierColor;
    }
  }

  triggerHaptic(pattern = 15) {
    if (this.hapticsEnabled && 'vibrate' in navigator) {
      try {
        navigator.vibrate(pattern);
      } catch (e) {}
    }
  }

  startLoop() {
    const loop = () => {
      // Eased lerp for ring follower
      const ease = 0.18;
      this.ring.x += (this.mouse.x - this.ring.x) * ease;
      this.ring.y += (this.mouse.y - this.ring.y) * ease;

      if (this.ringEl) {
        this.ringEl.style.transform = `translate3d(${this.ring.x}px, ${this.ring.y}px, 0) translate(-50%, -50%)`;
      }

      // Magnetic pull effect on active button
      if (this.activeMagnetic) {
        const rect = this.activeMagnetic.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const deltaX = (this.mouse.x - centerX) * 0.15;
        const deltaY = (this.mouse.y - centerY) * 0.15;
        this.activeMagnetic.style.transform = `translate3d(${deltaX}px, ${deltaY}px, 0)`;
      }

      this.rAF = requestAnimationFrame(loop);
    };
    this.rAF = requestAnimationFrame(loop);
  }

  setEnabled(enable) {
    this.enabled = enable;
    this.saveCursorPref(enable);
    if (!enable) {
      document.body.classList.remove('custom-cursor-active');
      if (this.dotEl) this.dotEl.style.display = 'none';
      if (this.ringEl) this.ringEl.style.display = 'none';
      if (this.rAF) cancelAnimationFrame(this.rAF);
    } else {
      document.body.classList.add('custom-cursor-active');
      if (this.dotEl) this.dotEl.style.display = '';
      if (this.ringEl) this.ringEl.style.display = '';
      if (!this.rAF) this.startLoop();
    }
  }
}

export const cursorEngine = new CursorEngine();
