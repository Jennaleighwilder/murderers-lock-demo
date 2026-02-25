/**
 * Proof of Work Visualizer
 *
 * Shows a visual progress during constant-time unlock/recovery delays.
 * Matches server-side 5s constant-time to prevent timing attacks.
 * Gives users feedback that work is in progress (not frozen).
 */
(function (global) {
  'use strict';

  const DEFAULT_DURATION_MS = 5000;

  const ProofOfWork = {
    /** Create and show visualizer. Returns { stop: () => void } */
    show(container, options = {}) {
      const duration = options.duration ?? DEFAULT_DURATION_MS;
      const message = options.message ?? 'Verifying...';
      const id = 'pow-viz-' + Date.now();

      const el = document.createElement('div');
      el.id = id;
      el.className = 'pow-visualizer';
      el.innerHTML = `
        <div class="pow-overlay">
          <div class="pow-content">
            <div class="pow-tumblers">
              <span class="pow-tumbler" data-i="0">◐</span>
              <span class="pow-tumbler" data-i="1">◑</span>
              <span class="pow-tumbler" data-i="2">◒</span>
              <span class="pow-tumbler" data-i="3">◓</span>
            </div>
            <p class="pow-message">${escapeHtml(message)}</p>
            <div class="pow-bar-wrap">
              <div class="pow-bar" id="${id}-bar"></div>
            </div>
          </div>
        </div>
      `;

      const style = document.createElement('style');
      style.textContent = `
        .pow-visualizer { position: relative; }
        .pow-overlay {
          position: absolute;
          inset: 0;
          background: rgba(0,0,0,0.85);
          border-radius: inherit;
          display: flex;
          align-items: center;
          justify-content: center;
          z-index: 10;
        }
        .pow-content { text-align: center; padding: 32px; max-width: 320px; }
        .pow-tumblers {
          display: flex;
          gap: 12px;
          justify-content: center;
          margin-bottom: 20px;
          font-size: 28px;
          color: var(--neon-cyan, #00F5FF);
        }
        .pow-tumbler {
          animation: pow-spin 1.2s linear infinite;
        }
        .pow-tumbler:nth-child(1) { animation-delay: 0s; }
        .pow-tumbler:nth-child(2) { animation-delay: 0.15s; }
        .pow-tumbler:nth-child(3) { animation-delay: 0.3s; }
        .pow-tumbler:nth-child(4) { animation-delay: 0.45s; }
        @keyframes pow-spin {
          0% { transform: rotate(0deg); opacity: 1; }
          100% { transform: rotate(360deg); opacity: 1; }
        }
        .pow-message {
          color: var(--text-silver, #E0E0E0);
          font-size: 14px;
          margin-bottom: 20px;
        }
        .pow-bar-wrap {
          height: 4px;
          background: rgba(255,16,240,0.2);
          border-radius: 4px;
          overflow: hidden;
        }
        .pow-bar {
          height: 100%;
          width: 0%;
          background: linear-gradient(90deg, var(--neon-cyan, #00F5FF), var(--neon-pink, #FF10F0));
          border-radius: 4px;
          transition: width 0.2s linear;
        }
      `;

      const parent = typeof container === 'string' ? document.querySelector(container) : container;
      if (!parent) return { stop: () => {} };

      parent.style.position = 'relative';
      parent.appendChild(style);
      parent.appendChild(el);

      const barEl = document.getElementById(id + '-bar');
      const start = Date.now();
      let raf = null;

      function tick() {
        const elapsed = Date.now() - start;
        const pct = Math.min(100, (elapsed / duration) * 100);
        if (barEl) barEl.style.width = pct + '%';
        if (elapsed < duration) raf = requestAnimationFrame(tick);
      }
      raf = requestAnimationFrame(tick);

      return {
        stop() {
          if (raf) cancelAnimationFrame(raf);
          if (barEl) barEl.style.width = '100%';
          setTimeout(() => {
            el.remove();
            style.remove();
          }, 150);
        }
      };
    }
  };

  function escapeHtml(s) {
    const d = document.createElement('div');
    d.textContent = s;
    return d.innerHTML;
  }

  if (typeof module !== 'undefined' && module.exports) {
    module.exports = ProofOfWork;
  } else {
    global.ProofOfWork = ProofOfWork;
  }
})(typeof window !== 'undefined' ? window : globalThis);
