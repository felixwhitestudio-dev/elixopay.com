(function() {
  // Simple front-end auth guard
  const requiredRole = document.currentScript && document.currentScript.getAttribute('data-require-role');
  const token = localStorage.getItem('token');

  // Redirect immediately if no token
  if (!token) {
    localStorage.clear();
    window.location.replace('/login.html');
    return;
  }

  // Verify token with backend and hydrate user info
  apiFetch(API_CONFIG.ENDPOINTS.auth.me)
    .then(resp => {
      if (!resp || !resp.ok) throw new Error('Auth check failed');
      return resp.json();
    })
    .then(data => {
      const user = data && data.data && data.data.user;
      if (!user) throw new Error('User missing in response');
      localStorage.setItem('user', JSON.stringify(user));

      // Role check (optional)
      if (requiredRole && user.role !== requiredRole) {
        console.warn('Role mismatch. Required:', requiredRole, 'Got:', user.role);
        localStorage.clear();
        window.location.replace('/login.html');
        return;
      }

      // Populate UI element if present
      const nameEl = document.getElementById('user-name');
      if (nameEl) {
        nameEl.textContent = `👋 ${user.name || user.email || 'User'}`;
      }
    })
    .catch(err => {
      console.warn('Auth guard redirecting:', err.message);
      localStorage.clear();
      window.location.replace('/login.html');
    });
})();
