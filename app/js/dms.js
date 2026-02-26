const DMS_KEY = 'vault_manager_dms';
    const API = '/api';

    function getUserId() {
      return sessionStorage.getItem('vault_user') || 'default';
    }

    function getDMS() {
      return JSON.parse(localStorage.getItem(DMS_KEY) || '{}');
    }

    function saveDMS(d) {
      localStorage.setItem(DMS_KEY, JSON.stringify(d));
    }

    async function apiCheckIn() {
      const res = await fetch(API + '/dms-check-in', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: getUserId() })
      });
      return res.json();
    }

    async function apiGetConfig() {
      const res = await fetch(API + '/dms-config?userId=' + encodeURIComponent(getUserId()));
      return res.json();
    }

    async function apiSaveConfig(data) {
      const res = await fetch(API + '/dms-config', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId: getUserId(), ...data })
      });
      return res.json();
    }

    const user = sessionStorage.getItem('vault_user');
    if (!user) window.location.href = 'index.html';

    function updateToggleLabel() {
      const enabled = document.getElementById('dms-enabled').checked;
      document.getElementById('toggle-label').textContent = enabled ? 'ON' : 'OFF';
    }

    function updateStatus() {
      const dms = getDMS();
      const badge = document.getElementById('status-badge');
      const text = document.getElementById('status-text');
      const btn = document.getElementById('checkin-btn');

      if (!dms.enabled) {
        badge.textContent = 'DISABLED';
        badge.className = 'status-badge status-warning';
        text.textContent = 'Enable the Dead Man\'s Switch above to protect your assets.';
        btn.style.display = 'none';
        return;
      }

      const lastCheckIn = dms.lastCheckIn ? new Date(dms.lastCheckIn) : null;
      const intervalDays = dms.intervalDays || 7;
      const graceDays = dms.graceDays || 5;
      const dueDate = lastCheckIn ? new Date(lastCheckIn.getTime() + intervalDays * 24 * 60 * 60 * 1000) : new Date();
      const graceEnd = new Date(dueDate.getTime() + graceDays * 24 * 60 * 60 * 1000);
      const now = new Date();

      if (!lastCheckIn) {
        badge.textContent = 'NEEDS FIRST CHECK-IN';
        badge.className = 'status-badge status-warning';
        text.textContent = 'Check in now to start your interval.';
        btn.style.display = 'block';
        return;
      }

      if (now > graceEnd) {
        badge.textContent = 'OVERDUE — CONTACTS NOTIFIED';
        badge.className = 'status-badge status-overdue';
        text.textContent = `You missed check-in by ${graceDays} days. In production, your ${(dms.contacts || []).length} contact(s) would have received access instructions. Check in now to reset.`;
        btn.style.display = 'block';
      } else if (now > dueDate) {
        const daysLeft = Math.ceil((graceEnd - now) / (24 * 60 * 60 * 1000));
        badge.textContent = 'GRACE PERIOD';
        badge.className = 'status-badge status-warning';
        text.textContent = `Check-in overdue. ${daysLeft} day(s) until contacts are notified. Check in now to reset.`;
        btn.style.display = 'block';
      } else {
        const daysLeft = Math.ceil((dueDate - now) / (24 * 60 * 60 * 1000));
        badge.textContent = 'ALL GOOD';
        badge.className = 'status-badge status-ok';
        text.textContent = `Next check-in due in ${daysLeft} day(s) (by ${dueDate.toLocaleDateString()}).`;
        btn.style.display = 'block';
      }
    }

    function renderContacts() {
      const dms = getDMS();
      const contacts = dms.contacts || [];
      const list = document.getElementById('contacts-list');
      list.innerHTML = '';

      if (contacts.length === 0) {
        list.innerHTML = '<p style="color: var(--text-gray); font-size: 14px;">No contacts yet. Add at least one.</p>';
        return;
      }

      contacts.forEach((c, i) => {
        const div = document.createElement('div');
        div.className = 'contact-item';
        div.innerHTML = `
          <span>
            <strong>${escapeHtml(c.name)}</strong>
            <div class="email">${escapeHtml(c.email)}</div>
            ${c.relationship ? `<div style="font-size: 11px; color: var(--text-gray);">${escapeHtml(c.relationship)}</div>` : ''}
          </span>
          <button type="button" class="btn btn-secondary btn-sm" data-index="${i}">Remove</button>
        `;
        div.querySelector('button').addEventListener('click', async () => {
          const d = getDMS();
          d.contacts = (d.contacts || []).filter((_, j) => j !== i);
          saveDMS(d);
          try { await apiSaveConfig({ contacts: d.contacts }); } catch (e) {}
          renderContacts();
        });
        list.appendChild(div);
      });
    }

    function escapeHtml(s) {
      const div = document.createElement('div');
      div.textContent = s || '';
      return div.innerHTML;
    }

    document.getElementById('dms-enabled').addEventListener('change', updateToggleLabel);

    document.getElementById('checkin-btn').addEventListener('click', async () => {
      const btn = document.getElementById('checkin-btn');
      btn.disabled = true;
      try {
        await apiCheckIn();
        const dms = getDMS();
        dms.lastCheckIn = new Date().toISOString();
        saveDMS(dms);
        document.getElementById('checkin-success').style.display = 'block';
        setTimeout(() => document.getElementById('checkin-success').style.display = 'none', 2000);
        updateStatus();
      } catch (e) {
        const dms = getDMS();
        dms.lastCheckIn = new Date().toISOString();
        saveDMS(dms);
        updateStatus();
      }
      btn.disabled = false;
    });

    document.getElementById('dms-form').addEventListener('submit', async (e) => {
      e.preventDefault();
      const dms = getDMS();
      dms.enabled = document.getElementById('dms-enabled').checked;
      dms.intervalDays = parseInt(document.getElementById('interval-days').value, 10);
      dms.graceDays = parseInt(document.getElementById('grace-days').value, 10);
      saveDMS(dms);
      updateToggleLabel();
      try {
        await apiSaveConfig({
          enabled: dms.enabled,
          intervalDays: dms.intervalDays,
          graceDays: dms.graceDays,
          contacts: dms.contacts || []
        });
      } catch (err) {}
      document.getElementById('dms-save-success').style.display = 'block';
      setTimeout(() => document.getElementById('dms-save-success').style.display = 'none', 2000);
      updateStatus();
    });

    document.getElementById('add-contact').addEventListener('click', async () => {
      const name = document.getElementById('contact-name').value.trim();
      const email = document.getElementById('contact-email').value.trim();
      const relationship = document.getElementById('contact-relation').value.trim();
      if (!name || !email) {
        alert('Name and email required.');
        return;
      }
      const dms = getDMS();
      dms.contacts = dms.contacts || [];
      dms.contacts.push({ name, email, relationship });
      saveDMS(dms);
      try {
        await apiSaveConfig({ contacts: dms.contacts });
      } catch (err) {}
      document.getElementById('contact-name').value = '';
      document.getElementById('contact-email').value = '';
      document.getElementById('contact-relation').value = '';
      renderContacts();
    });

    (async function init() {
      let dms = getDMS();
      try {
        const server = await apiGetConfig();
        if (server && (server.lastCheckIn || server.enabled !== undefined)) {
          dms = { ...dms, ...server };
          saveDMS(dms);
        }
      } catch (err) {}
      document.getElementById('dms-enabled').checked = dms.enabled || false;
      document.getElementById('interval-days').value = String(dms.intervalDays || 7);
      document.getElementById('grace-days').value = String(dms.graceDays || 5);
      updateToggleLabel();
      updateStatus();
      renderContacts();
    })();