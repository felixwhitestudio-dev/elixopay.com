// API Configuration Helper
// ใช้ไฟล์นี้ในทุกหน้าแทนการ hardcode localhost

(function () {
  // Preferred production API URL
  // TODO: Update this to your actual production domain when ready (e.g. https://api.elixopay.com)
  const PROD_BASE = 'https://elixopay-com.onrender.com';
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

  // --- Mock Data Generator ---
  async function mockFetch(endpoint, options) {
    console.log(`[Demo] Mocking verify request: ${endpoint}`, options);
    await new Promise(r => setTimeout(r, 800)); // Simulate network delay

    // Helper to create success response
    const success = (data) => ({
      ok: true,
      status: 200,
      json: async () => ({ success: true, data })
    });

    // Login
    if (endpoint.includes('/auth/login')) {
      return success({
        token: 'demo-token-123',
        user: { id: 1, email: 'demo@elixopay.com', role: 'user', first_name: 'Demo', last_name: 'User' }
      });
    }

    // User Profile / Me
    if (endpoint.includes('/auth/me') || endpoint.includes('/users/profile')) {
      return success({
        user: { id: 1, email: 'demo@elixopay.com', role: 'user', first_name: 'Demo', last_name: 'User' }
      });
    }

    // Balances
    if (endpoint.includes('/balances/me')) {
      return success({
        thb: 50000.00,
        usdt: 1250.50
      });
    }

    // Stats
    if (endpoint.includes('/users/stats')) {
      return success({
        success_rate: '99.9%',
        total_transactions: 1250,
        total_customers: 85
      });
    }

    // Exchange Rate
    if (endpoint.includes('/wallet/exchange-rate')) {
      return success({
        buyRate: 34.50,
        sellRate: 33.80
      });
    }

    // Create Payment (Deposit)
    if (endpoint.includes('/payments') && options.method === 'POST') {
      return success({
        id: 'pay_' + Date.now(),
        amount: JSON.parse(options.body).amount,
        status: 'pending',
        qr_raw: '00020101021129370016A000000677010111011300660000000005802TH530376463041009', // Mock PromptPay
        expiry_minutes: 15
      });
    }

    // Confirm Payment
    if (endpoint.includes('/confirm')) {
      return success({ status: 'completed' });
    }

    // Bank Accounts
    if (endpoint.includes('/users/bank-accounts')) {
      if (options.method === 'DELETE') return success({});
      return success({
        bank_accounts: [
          { id: 1, bank_name: 'KBank', account_number: '123-4-56789-0', type: 'saving' },
          { id: 2, bank_name: 'SCB', account_number: '987-6-54321-0', type: 'saving' }
        ]
      });
    }

    // Recent Activity / Ledger
    if (endpoint.includes('/ledger/me') || endpoint.includes('/payments')) {
      return success({
        transactions: [
          { id: 1, type: 'deposit', amount: 5000, currency: 'THB', status: 'completed', created_at: new Date().toISOString() },
          { id: 2, type: 'exchange', amount: 1000, currency: 'THB', status: 'completed', created_at: new Date(Date.now() - 86400000).toISOString() },
          { id: 3, type: 'withdraw', amount: 500, currency: 'THB', status: 'completed', created_at: new Date(Date.now() - 172800000).toISOString() }
        ]
      });
    }

    // Default fallback
    return success({});
  }

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
})();
