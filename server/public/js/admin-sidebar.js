/**
 * Elixopay Admin Sidebar Component
 * Dark-theme sidebar for admin pages. Injects HTML, active link, mobile toggle.
 */
(function () {
  'use strict';

  const ADMIN_SIDEBAR_HTML = `
    <aside class="ep-sidebar" id="ep-sidebar">
      <div class="ep-sidebar-header">
        <a href="/admin-dashboard.html" class="ep-sidebar-logo">
          <div class="ep-sidebar-logo-icon" style="background: linear-gradient(135deg, #ef4444, #dc2626);">
            <i class="fas fa-shield-halved" style="font-size:0.85rem;"></i>
          </div>
          <div class="ep-sidebar-logo-text">Elixo<span>Admin</span></div>
        </a>
      </div>

      <nav class="ep-sidebar-nav">
        <!-- OVERVIEW -->
        <div class="ep-sidebar-section">
          <span class="ep-sidebar-label" data-i18n="admin.sidebar.overview">Overview</span>
          <a href="/admin-dashboard.html" class="ep-sidebar-link" data-page="admin-dashboard">
            <i class="fas fa-gauge-high"></i>
            <span data-i18n="admin.sidebar.dashboard">Dashboard</span>
          </a>
          <a href="/admin-pending.html" class="ep-sidebar-link" data-page="admin-pending">
            <i class="fas fa-user-clock"></i>
            <span data-i18n="admin.pending.title">KYC Applications</span>
          </a>
        </div>

        <!-- FINANCE -->
        <div class="ep-sidebar-section">
          <span class="ep-sidebar-label" data-i18n="admin.sidebar.finance">Finance</span>
          <a href="/admin-payouts.html" class="ep-sidebar-link" data-page="admin-payouts">
            <i class="fas fa-money-bill-transfer"></i>
            <span data-i18n="admin.sidebar.payouts">Payouts</span>
          </a>
          <a href="/admin-liquidity.html" class="ep-sidebar-link" data-page="admin-liquidity">
            <i class="fas fa-vault"></i>
            <span data-i18n="admin.sidebar.liquidity">Liquidity</span>
          </a>
        </div>

        <!-- LINKS -->
        <div class="ep-sidebar-section">
          <span class="ep-sidebar-label" data-i18n="admin.sidebar.quick_links">Quick Links</span>
          <a href="/dashboard.html" class="ep-sidebar-link">
            <i class="fas fa-arrow-left"></i>
            <span data-i18n="admin.sidebar.goHome">Merchant View</span>
          </a>
        </div>
      </nav>

      <div class="ep-sidebar-footer">
        <!-- Theme Toggle -->
        <div class="ep-sidebar-theme-row">
          <button class="ep-theme-toggle" id="ep-theme-toggle" onclick="window.epToggleTheme && window.epToggleTheme()" title="Toggle theme">
            <i class="fas fa-moon" id="ep-theme-icon-admin"></i>
            <span id="ep-theme-label-admin" data-i18n="sidebar.dark_mode">Dark Mode</span>
          </button>
        </div>

        <!-- Language Switcher -->
        <div class="ep-sidebar-lang" id="ep-lang-switcher">
          <div class="ep-lang-row">
            <i class="fas fa-globe" style="color:var(--ep-text-muted);font-size:0.8rem;"></i>
            <select id="langSelect" class="ep-lang-select" onchange="window.changeLanguage && window.changeLanguage(this.value)">
              <option value="th">🇹🇭 ไทย</option>
              <option value="en">🇬🇧 English</option>
              <option value="zh">🇨🇳 中文</option>
            </select>
          </div>
        </div>

        <div class="ep-sidebar-user">
          <div class="ep-sidebar-avatar" style="background: linear-gradient(135deg, #991b1b, #dc2626);" id="ep-sidebar-initial">A</div>
          <div class="ep-sidebar-user-info">
            <div class="ep-sidebar-user-name" id="ep-sidebar-name">Admin</div>
            <div class="ep-sidebar-user-email" id="ep-sidebar-email">Super User</div>
          </div>
        </div>
        <button class="ep-sidebar-logout" onclick="window.epAdminLogout()">
          <i class="fas fa-arrow-right-from-bracket"></i>
          <span data-i18n="nav.signout">Sign Out</span>
        </button>
      </div>
    </aside>
    <div class="ep-sidebar-backdrop" id="ep-sidebar-backdrop"></div>
  `;

  const MOBILE_HEADER_HTML = `
    <div class="ep-mobile-header" id="ep-mobile-header">
      <button class="ep-mobile-toggle" onclick="window.epToggleSidebar()">
        <i class="fas fa-bars"></i>
      </button>
      <div class="ep-sidebar-logo-text" style="font-size:1rem;">Elixo<span>Admin</span></div>
      <div style="width:36px;"></div>
    </div>
  `;

  function init() {
    const mainWrap = document.querySelector('.ep-main-wrap');
    if (!mainWrap) return;

    mainWrap.insertAdjacentHTML('beforebegin', ADMIN_SIDEBAR_HTML);
    mainWrap.insertAdjacentHTML('afterbegin', MOBILE_HEADER_HTML);

    highlightActive();
    loadAdminInfo();
    initAdminTheme();

    // Sync language selector
    const saved = localStorage.getItem('elixopay-lang') || 'th';
    const sel = document.getElementById('langSelect');
    if (sel) sel.value = saved;

    const backdrop = document.getElementById('ep-sidebar-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', () => closeSidebar());
    }
  }

  function initAdminTheme() {
    const theme = localStorage.getItem('elixopay-theme') || 'dark';
    applyAdminTheme(theme);
  }

  function applyAdminTheme(theme) {
    const icon = document.getElementById('ep-theme-icon-admin');
    const label = document.getElementById('ep-theme-label-admin');
    if (theme === 'light') {
      document.body.classList.add('ep-light');
      if (icon) icon.className = 'fas fa-sun';
      if (label) label.textContent = 'Light Mode';
    } else {
      document.body.classList.remove('ep-light');
      if (icon) icon.className = 'fas fa-moon';
      if (label) label.textContent = 'Dark Mode';
    }
    localStorage.setItem('elixopay-theme', theme);
  }

  window.epToggleTheme = function () {
    const current = localStorage.getItem('elixopay-theme') || 'dark';
    applyAdminTheme(current === 'dark' ? 'light' : 'dark');
  };

  function highlightActive() {
    const path = window.location.pathname;
    const links = document.querySelectorAll('.ep-sidebar-link[data-page]');
    links.forEach(link => {
      const page = link.getAttribute('data-page');
      if (path.includes(page)) {
        link.classList.add('active');
      }
    });
  }

  function loadAdminInfo() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        const name = user.name || `${user.firstName || ''} ${user.lastName || ''}`.trim() || 'Admin';
        const nameEl = document.getElementById('ep-sidebar-name');
        const initialEl = document.getElementById('ep-sidebar-initial');
        if (nameEl) nameEl.textContent = name;
        if (initialEl) initialEl.textContent = name.charAt(0).toUpperCase();
      } catch (e) { /* ignore */ }
    }
  }

  window.epToggleSidebar = function () {
    const sidebar = document.getElementById('ep-sidebar');
    const backdrop = document.getElementById('ep-sidebar-backdrop');
    if (sidebar) sidebar.classList.toggle('open');
    if (backdrop) backdrop.classList.toggle('open');
  };

  function closeSidebar() {
    const sidebar = document.getElementById('ep-sidebar');
    const backdrop = document.getElementById('ep-sidebar-backdrop');
    if (sidebar) sidebar.classList.remove('open');
    if (backdrop) backdrop.classList.remove('open');
  }

  window.epAdminLogout = async function () {
    try {
      if (window.apiFetch && window.API_CONFIG) {
        await window.apiFetch(window.API_CONFIG.ENDPOINTS.auth.logout, { method: 'POST' });
      }
    } catch (e) {
      console.error('Logout error', e);
    }
    localStorage.clear();
    window.location.href = '/login.html';
  };

  if (!window.logout) {
    window.logout = window.epAdminLogout;
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
