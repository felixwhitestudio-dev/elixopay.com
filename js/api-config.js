// API Configuration Helper
// ใช้ไฟล์นี้ในทุกหน้าแทนการ hardcode localhost

(function() {
  // Preferred production API URL
  const PROD_BASE = 'https://elixopay-production-de65.up.railway.app'; // 👈 ค่าเริ่มต้นชี้ไปยัง Railway ของคุณ
  const DEV_BASE = 'http://localhost:3000';
  
  // Allow overriding the API base via localStorage for flexibility
  // e.g. localStorage.setItem('api_base_url', 'http://localhost:3000')
  const overrideBase = localStorage.getItem('api_base_url');
  
  // Default to DEV when on localhost, otherwise use production
  const isLocalhost = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1';
  
  // Check for explicit mode
  const urlParams = new URLSearchParams(window.location.search);
  const forceMode = urlParams.get('api'); // ?api=local or ?api=remote
  
  let BASE;
  if (forceMode === 'remote') {
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
      },
      apiKeys: {
        list: '/api/v1/api-keys',
        create: '/api/v1/api-keys',
        revoke: (id) => `/api/v1/api-keys/${id}`,
      }
    }
  };
  
  // Helper function to build full URL
  window.apiUrl = function(endpoint) {
    return window.API_CONFIG.BASE_URL + endpoint;
  };
  
  // Helper for authenticated fetch
  window.apiFetch = async function(endpoint, options = {}) {
    const token = localStorage.getItem('token');
    const url = typeof endpoint === 'string' ? apiUrl(endpoint) : endpoint;
    
    const defaultOptions = {
      headers: {
        'Content-Type': 'application/json',
        ...(token && { 'Authorization': `Bearer ${token}` }),
      },
    };
    
    const response = await fetch(url, {
      ...defaultOptions,
      ...options,
      headers: {
        ...defaultOptions.headers,
        ...options.headers,
      },
    });
    
    // Auto logout on 401
    if (response.status === 401 && window.location.pathname !== '/login.html') {
      localStorage.clear();
      window.location.href = '/login.html';
      return null;
    }
    
    return response;
  };
  
  console.log(`🔗 API Base: ${window.API_CONFIG.BASE_URL}`);
  window.setApiBase = function(url) {
    if (!url) return;
    localStorage.setItem('api_base_url', url);
    window.location.reload();
  };
})();
