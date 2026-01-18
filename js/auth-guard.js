(function () {
  // Hide page until auth completes to prevent content flash
  const root = document.documentElement;
  const prevVisibility = root.style.visibility;
  root.style.visibility = 'hidden';

  const requiredRole = document.currentScript && document.currentScript.getAttribute('data-require-role');
  const redirectLogin = () => {
    ['token', 'user'].forEach(k => localStorage.removeItem(k));
    window.location.replace('/login.html');
  };

  apiFetch(API_CONFIG.ENDPOINTS.auth.me)
    .then(resp => {
      if (!resp || !resp.ok) throw new Error('Auth check failed');
      return resp.json();
    })
    .then(data => {
      const user = data && data.data && data.data.user;
      if (!user) throw new Error('User missing in response');
      localStorage.setItem('user', JSON.stringify(user));

      if (requiredRole && user.role !== requiredRole && user.role !== 'merchant' && user.role !== 'admin') {
        console.warn('Role mismatch. Required:', requiredRole, 'Got:', user.role);
        return redirectLogin();
      }

      const nameEl = document.getElementById('user-name');
      if (nameEl) nameEl.textContent = `👋 ${user.name || user.email || 'User'}`;

      // Notify page scripts that auth is ready
      try { window.dispatchEvent(new CustomEvent('auth:ready', { detail: user })); } catch (_) { }
    })
    .catch(err => {
      console.warn('Auth guard redirecting:', err.message);
      return redirectLogin();
    })
    .finally(() => {
      // Reveal page content if we didn't redirect
      // If redirecting, the navigation will replace document soon
      root.style.visibility = prevVisibility || 'visible';
    });
})();
