// API Configuration Helper
// ใช้ไฟล์นี้ในทุกหน้าแทนการ hardcode localhost

(function () {
  // Preferred production API URL
  // TODO: Update this to your actual production domain when ready (e.g. https://api.elixopay.com)
  const PROD_BASE = 'https://api.elixopay.com';
  const DEV_BASE = 'http://localhost:3000';

  // Allow overriding the API base via localStorage for flexibility
  // e.g. localStorage.setItem('api_base_url', 'http://localhost:3000')
  const overrideBase = localStorage.getItem('api_base_url');

  // Default to DEV when on localhost or local file system, otherwise use production
  const isLocalhost = window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1' ||
    window.location.protocol === 'file:';

  // Check for explicit mode
  const urlParams = new URLSearchParams(window.location.search);
  const forceMode = urlParams.get('api'); // ?api=local or ?api=remote or ?api=demo

  let BASE;
  let IS_DEMO = false;

  if (forceMode === 'demo') {
    IS_DEMO = true;
    console.log('✨ Demo Mode Activated');
  } else if (forceMode === 'remote') {
    BASE = PROD_BASE;
  } else if (forceMode === 'local') {
    BASE = DEV_BASE;
  } else if (overrideBase) {
    BASE = overrideBase;
  } else if (isLocalhost) {
    BASE = DEV_BASE;
  } else {
    BASE = PROD_BASE;
  }

  // API Configuration
  window.API_CONFIG = {
    BASE_URL: BASE,
    IS_DEMO: IS_DEMO,
    ENDPOINTS: {
      auth: {
        login: '/api/v1/auth/login',
        register: '/api/v1/auth/register',
        logout: '/api/v1/auth/logout',
        me: '/api/v1/auth/me',
        refresh: '/api/v1/auth/refresh',
      },
      payments: {
        list: '/api/v1/payments',
        create: '/api/v1/payments',
        detail: (id) => `/api/v1/payments/${id}`,
        confirm: (id) => `/api/v1/payments/${id}/confirm`,
        cancel: (id) => `/api/v1/payments/${id}/cancel`,
        refund: (id) => `/api/v1/payments/${id}/refund`,
      },
      balances: {
        me: '/api/v1/balances/me',
      },
      ledger: {
        me: '/api/v1/ledger/me',
      },
      users: {
        stats: '/api/v1/users/stats',
        profile: '/api/v1/users/profile',
        // Wallet specific endpoints
        exchangeRate: '/api/v1/wallet/exchange-rate',
        exchange: '/api/v1/wallet/exchange'
      },
      apiKeys: {
        list: '/api/v1/api-keys',
        create: '/api/v1/api-keys',
        revoke: (id) => `/api/v1/api-keys/${id}`,
      }
    },
    kbank: {
      qr: '/api/v1/kbank/qr'
    }
  };

  // Helper function to build full URL
  window.apiUrl = function (endpoint) {
    return window.API_CONFIG.BASE_URL + endpoint;
  };

  // Helper for authenticated fetch
  // Helper to read cookie (for CSRF double-submit)
  function getCookie(name) {
    const value = `; ${document.cookie}`;
    const parts = value.split(`; ${name}=`);
    if (parts.length === 2) return parts.pop().split(';').shift();
    return null;
  }

  window.apiFetch = async function (endpoint, options = {}) {
    // If Demo Mode is active, hijack the request
    if (window.API_CONFIG.IS_DEMO) {
      return mockFetch(endpoint, options);
    }

    const url = typeof endpoint === 'string' ? apiUrl(endpoint) : endpoint;
    const isMutating = options.method && ['POST', 'PUT', 'PATCH', 'DELETE'].includes(options.method.toUpperCase());
    const csrf = isMutating ? getCookie('csrf_token') : null;

    const defaultHeaders = {
      'Content-Type': 'application/json',
      // Backward compatibility: still send Authorization if legacy token exists
      ...(localStorage.getItem('token') && { 'Authorization': `Bearer ${localStorage.getItem('token')}` }),
      ...(csrf && { 'X-CSRF-Token': csrf })
    };

    let response = await fetch(url, {
      credentials: 'include', // include cookies
      ...options,
      headers: {
        ...defaultHeaders,
        ...(options.headers || {})
      }
    });

    if (response.status === 401 && window.location.pathname !== '/login.html') {
      // Attempt silent refresh once (only for non-login endpoints)
      const triedRefresh = options._triedRefresh;
      if (!triedRefresh) {
        const refreshResp = await fetch(apiUrl('/api/v1/auth/refresh'), {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' }
        });
        if (refreshResp.ok) {
          const newCsrf = getCookie('csrf_token');
          if (isMutating && newCsrf) {
            defaultHeaders['X-CSRF-Token'] = newCsrf;
          }
          // Retry original request with flag to avoid loop
          response = await fetch(url, {
            credentials: 'include',
            ...options,
            _triedRefresh: true,
            headers: {
              ...defaultHeaders,
              ...(options.headers || {})
            }
          });
        }
      }
      if (response.status === 401) {
        ['token', 'user'].forEach(k => localStorage.removeItem(k));
        window.location.href = '/login.html';
        return null;
      }
    }
    return response;
  };

  console.log(`🔗 API Base: ${window.API_CONFIG.BASE_URL} | Demo Mode: ${window.API_CONFIG.IS_DEMO}`);
  window.setApiBase = function (url) {
    if (!url) return;
    localStorage.setItem('api_base_url', url);
    window.location.reload();
  };

  // Frontend URL resolution to ensure the Home/Logo links point to the correct environment
  const FRONTEND_PROD = 'https://www.elixopay.com';
  const FRONTEND_DEV = 'http://localhost:8080'; // Local public site running on 8080
  window.API_CONFIG.FRONTEND_URL = isLocalhost ? FRONTEND_DEV : FRONTEND_PROD;

  // Automatically update all hardcoded Elixopay homepage links to resolve conditionally based on the environment
  document.addEventListener('DOMContentLoaded', () => {
    document.querySelectorAll('a[href^="https://www.elixopay.com"]').forEach(link => {
      try {
        const url = new URL(link.href);
        const frontendUrl = new URL(window.API_CONFIG.FRONTEND_URL);
        link.href = `${frontendUrl.origin}${url.pathname}${url.search}${url.hash}`;
      } catch (e) {
        link.href = window.API_CONFIG.FRONTEND_URL;
      }
    });
  });
})();
