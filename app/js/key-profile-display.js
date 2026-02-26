/**
 * key-profile-display.js
 * SVG Key Profile — 33 tumblers as key shape (frequencies = heights)
 * The code IS the key. Turn sideways to see.
 */

(function (global) {
  'use strict';

  const NUM_GATES = 33;
  const MIN_FREQ = 200;
  const MAX_FREQ = 1200;

  function freqToColor(freq) {
    const pct = (freq - MIN_FREQ) / (MAX_FREQ - MIN_FREQ);
    if (pct < 0.33) return '#00F5FF'; // Cyan - low
    if (pct < 0.66) return '#FFD700'; // Gold - medium
    return '#FF10F0'; // Pink - high
  }

  function freqToHeight(freq) {
    const pct = (freq - MIN_FREQ) / (MAX_FREQ - MIN_FREQ);
    return 15 + Math.max(5, pct * 85);
  }

  const KeyProfile = {
    container: null,
    rotated: false,

    /** Render 33 tumblers as key profile (sideways = key shape) */
    render(containerIdOrEl, gateFrequencies) {
      const container = typeof containerIdOrEl === 'string'
        ? document.getElementById(containerIdOrEl) || document.querySelector(containerIdOrEl)
        : containerIdOrEl;
      if (!container) return null;

      this.container = container;
      const freqs = gateFrequencies || Array.from({ length: NUM_GATES }, (_, i) => MIN_FREQ + (i * 30) % 1000);

      const barW = 8;
      const gap = 4;
      const totalW = NUM_GATES * (barW + gap) - gap;
      const maxH = 100;

      let svg = container.querySelector('svg.key-profile-svg');
      if (!svg) {
        svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
        svg.setAttribute('class', 'key-profile-svg');
        container.innerHTML = '';
        container.appendChild(svg);
      }

      svg.setAttribute('viewBox', `0 0 ${totalW + 40} ${maxH + 60}`);
      svg.setAttribute('width', '100%');
      svg.setAttribute('height', 'auto');
      svg.style.maxHeight = '140px';
      svg.style.display = 'block';
      svg.style.margin = '16px auto';

      const g = document.createElementNS('http://www.w3.org/2000/svg', 'g');
      g.setAttribute('transform', 'translate(20, 20)');

      freqs.forEach((freq, i) => {
        const h = freqToHeight(freq);
        const x = i * (barW + gap);
        const y = maxH - h;

        const rect = document.createElementNS('http://www.w3.org/2000/svg', 'rect');
        rect.setAttribute('x', x);
        rect.setAttribute('y', y);
        rect.setAttribute('width', barW);
        rect.setAttribute('height', h);
        rect.setAttribute('rx', 2);
        rect.setAttribute('fill', freqToColor(freq));
        rect.setAttribute('stroke', 'rgba(255,255,255,0.3)');
        rect.setAttribute('stroke-width', '1');
        rect.setAttribute('class', 'tumbler');
        rect.dataset.gateIndex = i;
        rect.dataset.freq = Math.round(freq);
        g.appendChild(rect);
      });

      svg.innerHTML = '';
      svg.appendChild(g);

      const label = document.createElement('div');
      label.className = 'key-profile-label';
      label.style.cssText = 'text-align:center;font-size:11px;color:#808080;margin-top:8px;';
      label.textContent = '33 Gates — Frequencies = Tumbler Heights (rotate to see key)';
      if (!container.querySelector('.key-profile-label')) container.appendChild(label);

      return this;
    },

    /** Play alignment animation — tumblers turn green in sequence */
    playAlignment(duration = 60) {
      const svg = this.container?.querySelector('svg.key-profile-svg');
      if (!svg) return;

      const rects = svg.querySelectorAll('rect.tumbler');
      rects.forEach(r => {
        r.style.transition = 'fill 0.15s, filter 0.15s';
        r.style.fill = '#333';
      });

      let idx = 0;
      const interval = setInterval(() => {
        if (idx >= rects.length) {
          clearInterval(interval);
          return;
        }
        const r = rects[idx];
        r.style.fill = '#39FF14';
        r.style.filter = 'drop-shadow(0 0 6px rgba(57,255,20,0.8))';
        idx++;
      }, duration);
    },

    /** Toggle rotated view (key sideways) */
    toggleRotate() {
      this.rotated = !this.rotated;
      const svg = this.container?.querySelector('svg.key-profile-svg');
      if (svg) {
        svg.style.transform = this.rotated ? 'rotate(-90deg)' : 'none';
        svg.style.transformOrigin = 'center center';
      }
      return this.rotated;
    }
  };

  global.KeyProfile = KeyProfile;
})(typeof window !== 'undefined' ? window : globalThis);
