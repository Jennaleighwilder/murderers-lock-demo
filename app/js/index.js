// Tab switching
    document.querySelectorAll('.auth-tab').forEach(tab => {
      tab.addEventListener('click', () => {
        document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
        document.querySelectorAll('.auth-form').forEach(f => f.classList.remove('active'));
        tab.classList.add('active');
        document.getElementById(tab.dataset.tab + '-form').classList.add('active');
        document.getElementById(tab.dataset.tab + '-error').classList.remove('visible');
      });
    });

    // Simple auth (MVP: localStorage, upgrade to real auth later)
    const AUTH_KEY = 'vault_manager_auth';

    document.getElementById('login-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const err = document.getElementById('login-error');
      err.classList.remove('visible');
      const email = (e.target.email.value || '').trim();
      const password = e.target.password.value;
      if (typeof Validate !== 'undefined' && !Validate.validateEmail(email)) {
        err.textContent = 'Please enter a valid email address.';
        err.classList.add('visible');
        return;
      }
      const stored = JSON.parse(localStorage.getItem(AUTH_KEY) || '{}');
      if (stored.email === email && stored.password === password) {
        sessionStorage.setItem('vault_user', email);
        window.location.href = 'dashboard.html';
      } else {
        err.textContent = 'Invalid email or password.';
        err.classList.add('visible');
      }
    });

    document.getElementById('create-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const err = document.getElementById('create-error');
      err.classList.remove('visible');
      const email = (e.target.email.value || '').trim();
      const password = e.target.password.value;
      const confirm = e.target.confirm.value;
      if (typeof Validate !== 'undefined' && !Validate.validateEmail(email)) {
        err.textContent = 'Please enter a valid email address.';
        err.classList.add('visible');
        return;
      }
      if (password !== confirm) {
        err.textContent = 'Passwords do not match.';
        err.classList.add('visible');
        return;
      }
      if (typeof Validate !== 'undefined') {
        const pwCheck = Validate.validatePassword(password);
        if (!pwCheck.valid) {
          err.textContent = (pwCheck.errors && pwCheck.errors[0]) || 'Invalid password.';
          err.classList.add('visible');
          return;
        }
      } else if (password.length < 12) {
        err.textContent = 'Password must be at least 12 characters.';
        err.classList.add('visible');
        return;
      }
      localStorage.setItem(AUTH_KEY, JSON.stringify({
        email,
        password: password,
        createdAt: new Date().toISOString()
      }));
      const displayName = (e.target.elements.displayName && e.target.elements.displayName.value) ? e.target.elements.displayName.value.trim() : '';
      localStorage.setItem('vault_manager_profile', JSON.stringify({ displayName }));
      sessionStorage.setItem('vault_user', email);
      window.location.href = 'dashboard.html';
    });