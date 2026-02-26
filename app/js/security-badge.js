/**
 * Security Badge — Vault health grade (A/B/C/D)
 * Badass at-a-glance security status
 */
(function (global) {
  'use strict';

  function grade(report) {
    if (!report || report.total === 0) return { grade: '—', label: 'No entries', color: 'var(--text-gray)' };
    if (report.breached && report.breached.length > 0) return { grade: 'D', label: 'Breached', color: 'var(--neon-pink)' };
    if (report.weak && report.weak.length > 0 || report.reused && report.reused.length > 0) {
      const weak = (report.weak || []).length;
      const reused = (report.reused || []).length;
      if (weak > 2 || reused > 2) return { grade: 'C', label: 'Needs work', color: 'var(--neon-orange)' };
      return { grade: 'B', label: 'Good', color: 'var(--neon-gold)' };
    }
    return { grade: 'A', label: 'Excellent', color: 'var(--neon-lime)' };
  }

  function render(container, report) {
    if (!container) return;
    const g = grade(report);
    container.innerHTML = `<div class="security-badge" style="display:inline-flex;align-items:center;gap:8px;padding:8px 16px;background:rgba(0,0,0,0.5);border:2px solid ${g.color};border-radius:12px;">
      <span style="font-size:24px;font-weight:900;color:${g.color};">${g.grade}</span>
      <span style="font-size:12px;color:var(--text-silver);">Security: ${g.label}</span>
    </div>`;
  }

  global.SecurityBadge = { grade, render };
})(typeof window !== 'undefined' ? window : globalThis);
