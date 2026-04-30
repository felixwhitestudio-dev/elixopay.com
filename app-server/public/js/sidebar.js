/**
 * Elixopay Merchant Sidebar Component
 * Sidebar navigation, notifications, language switching, dark/light theme, user identity.
 */
(function () {
  'use strict';

  const SIDEBAR_HTML = `
    <aside class="ep-sidebar" id="ep-sidebar">
      <div class="ep-sidebar-header">
        <a href="/dashboard.html" class="ep-sidebar-logo">
          <div class="ep-sidebar-logo-icon">E</div>
          <div class="ep-sidebar-logo-text">Elixo<span>pay</span></div>
        </a>
        <!-- Notification Bell -->
        <button class="ep-notif-bell" id="ep-notif-bell" onclick="window.epToggleNotifications()" title="Notifications">
          <i class="fas fa-bell"></i>
          <span class="ep-notif-dot" id="ep-notif-dot"></span>
        </button>
      </div>

      <!-- Notification Dropdown Panel -->
      <div class="ep-notif-panel" id="ep-notif-panel">
        <div class="ep-notif-header">
          <span data-i18n="nav.notifications">Notifications</span>
          <button class="ep-notif-mark-read" onclick="window.epClearNotifications()" data-i18n="nav.notifications_mark_read">Mark all read</button>
        </div>
        <div class="ep-notif-list" id="ep-notif-list">
          <!-- Notifications injected here -->
        </div>
      </div>

      <nav class="ep-sidebar-nav">
        <!-- MAIN -->
        <div class="ep-sidebar-section">
          <span class="ep-sidebar-label" data-i18n="sidebar.main">Main</span>
          <a href="/dashboard.html" class="ep-sidebar-link" data-page="dashboard">
            <i class="fas fa-chart-pie"></i>
            <span data-i18n="nav.dashboard">Dashboard</span>
          </a>
          <a href="/transactions.html" class="ep-sidebar-link" data-page="transactions">
            <i class="fas fa-arrow-right-arrow-left"></i>
            <span data-i18n="nav.transactions">Transactions</span>
          </a>
          <a href="/billing.html" class="ep-sidebar-link" data-page="billing">
            <i class="fas fa-file-invoice-dollar"></i>
            <span data-i18n="nav.billing">Billing</span>
          </a>
          <a href="/payout.html" class="ep-sidebar-link" data-page="payout">
            <i class="fas fa-file-invoice"></i>
            <span data-i18n="nav.settlement">Settlement</span>
          </a>
        </div>

        <!-- DEVELOPER -->
        <div class="ep-sidebar-section">
          <span class="ep-sidebar-label" data-i18n="sidebar.developer">Developer</span>
          <a href="/api-keys.html" class="ep-sidebar-link" data-page="api-keys">
            <i class="fas fa-key"></i>
            <span>API Keys</span>
          </a>
          <a href="/webhooks.html" class="ep-sidebar-link" data-page="webhooks">
            <i class="fas fa-plug"></i>
            <span data-i18n="nav.webhooks">Webhooks</span>
          </a>
          <a href="https://www.elixopay.com/apidocs.html" target="_blank" class="ep-sidebar-link">
            <i class="fas fa-book"></i>
            <span data-i18n="nav.docs">Documentation</span>
            <i class="fas fa-arrow-up-right-from-square ep-external-icon"></i>
          </a>
        </div>

        <!-- PARTNER -->
        <div class="ep-sidebar-section">
          <span class="ep-sidebar-label" data-i18n="sidebar.partner">Partner</span>
          <a href="/partner-portal.html" class="ep-sidebar-link" data-page="partner-portal">
            <i class="fas fa-handshake"></i>
            <span data-i18n="nav.partner">Partner Hub</span>
          </a>
        </div>

        <!-- ACCOUNT -->
        <div class="ep-sidebar-section">
          <span class="ep-sidebar-label" data-i18n="sidebar.account">Account</span>
          <a href="/profile.html" class="ep-sidebar-link" data-page="profile">
            <i class="fas fa-user-circle"></i>
            <span data-i18n="sidebar.profile">Profile</span>
          </a>
          <a href="/kyc.html" class="ep-sidebar-link" data-page="kyc">
            <i class="fas fa-id-card"></i>
            <span data-i18n="sidebar.kyc">KYC Verification</span>
          </a>
          <a href="/settings.html" class="ep-sidebar-link" data-page="settings">
            <i class="fas fa-cog"></i>
            <span data-i18n="nav.settings">Settings</span>
          </a>
        </div>
      </nav>

      <div class="ep-sidebar-footer">
        <!-- Theme Toggle -->
        <div class="ep-sidebar-theme-row">
          <button class="ep-theme-toggle" id="ep-theme-toggle" onclick="window.epToggleTheme()" title="Toggle theme">
            <i class="fas fa-moon" id="ep-theme-icon"></i>
            <span id="ep-theme-label" data-i18n="sidebar.dark_mode">Dark Mode</span>
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
          <div class="ep-sidebar-avatar" id="ep-sidebar-initial">U</div>
          <div class="ep-sidebar-user-info">
            <div class="ep-sidebar-user-name" id="ep-sidebar-name">Loading...</div>
            <div class="ep-sidebar-user-email" id="ep-sidebar-email">...</div>
          </div>
        </div>
        <button class="ep-sidebar-logout" onclick="window.epSidebarLogout()">
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
      <a href="/dashboard.html" class="ep-sidebar-logo" style="gap:8px;">
        <div class="ep-sidebar-logo-icon" style="width:28px;height:28px;font-size:0.9rem;">E</div>
        <div class="ep-sidebar-logo-text" style="font-size:1rem;">Elixo<span>pay</span></div>
      </a>
      <div class="ep-mobile-actions">
        <button class="ep-notif-bell ep-notif-bell-mobile" id="ep-notif-bell-mobile" onclick="window.epToggleNotifications()">
          <i class="fas fa-bell"></i>
          <span class="ep-notif-dot" id="ep-notif-dot-mobile"></span>
        </button>
        <select id="langSelectMobile" class="ep-lang-select-mobile" onchange="window.changeLanguage && window.changeLanguage(this.value)">
          <option value="th">TH</option>
          <option value="en">EN</option>
          <option value="zh">ZH</option>
        </select>
      </div>
    </div>
  `;

  // ── MOCK NOTIFICATIONS (replace with real API later) ──
  function getDefaultNotifications() {
    const lang = localStorage.getItem('elixopay-lang') || 'th';
    const notifs = {
      th: [
        { id: 1, icon: 'fa-check-circle', color: '#22c55e', title: 'KYC อนุมัติแล้ว', desc: 'เอกสารยืนยันตัวตนของคุณได้รับการอนุมัติ', time: '2 ชม. ที่แล้ว', read: false },
        { id: 2, icon: 'fa-credit-card', color: '#7c3aed', title: 'รายการชำระเงินสำเร็จ', desc: '฿5,000 ชำระเงินเข้าบัญชีร้านค้าเรียบร้อย', time: '5 ชม. ที่แล้ว', read: false },
        { id: 3, icon: 'fa-shield-halved', color: '#3b82f6', title: 'อัปเกรดความปลอดภัย', desc: 'แนะนำเปิด 2FA เพื่อความปลอดภัย', time: '1 วัน ที่แล้ว', read: true },
      ],
      en: [
        { id: 1, icon: 'fa-check-circle', color: '#22c55e', title: 'KYC Approved', desc: 'Your identity documents have been verified', time: '2h ago', read: false },
        { id: 2, icon: 'fa-credit-card', color: '#7c3aed', title: 'Payment Received', desc: '฿5,000 settled to your bank account', time: '5h ago', read: false },
        { id: 3, icon: 'fa-shield-halved', color: '#3b82f6', title: 'Security Upgrade', desc: 'Enable 2FA for better security', time: '1d ago', read: true },
      ],
      zh: [
        { id: 1, icon: 'fa-check-circle', color: '#22c55e', title: 'KYC 已通过', desc: '您的身份文件已通过验证', time: '2小时前', read: false },
        { id: 2, icon: 'fa-credit-card', color: '#7c3aed', title: '收款成功', desc: '฿5,000 已结算至银行账户', time: '5小时前', read: false },
        { id: 3, icon: 'fa-shield-halved', color: '#3b82f6', title: '安全升级', desc: '建议开启2FA', time: '1天前', read: true },
      ]
    };
    return notifs[lang] || notifs.en;
  }

  // ── INIT ──
  function init() {
    const mainWrap = document.querySelector('.ep-main-wrap');
    if (!mainWrap) return;

    mainWrap.insertAdjacentHTML('beforebegin', SIDEBAR_HTML);
    mainWrap.insertAdjacentHTML('afterbegin', MOBILE_HEADER_HTML);

    highlightActive();
    loadUserInfo();
    syncLangSelector();
    initTheme();
    loadNotifications();

    // Re-apply i18n translations after sidebar injects new DOM elements
    if (window.ElixopayI18n && window.ElixopayI18n.updatePage) {
      window.ElixopayI18n.updatePage();
    }

    // Backdrop close
    const backdrop = document.getElementById('ep-sidebar-backdrop');
    if (backdrop) {
      backdrop.addEventListener('click', () => closeSidebar());
    }

    // Close notification panel on outside click
    document.addEventListener('click', (e) => {
      const panel = document.getElementById('ep-notif-panel');
      const bell = document.getElementById('ep-notif-bell');
      const bellMobile = document.getElementById('ep-notif-bell-mobile');
      if (panel && panel.classList.contains('open') && !panel.contains(e.target) && e.target !== bell && !bell?.contains(e.target) && e.target !== bellMobile && !bellMobile?.contains(e.target)) {
        panel.classList.remove('open');
      }
    });

    // Listen for language changes
    window.addEventListener('languageChanged', (e) => {
      syncLangSelectorValue(e.detail.lang);
      loadNotifications();
    });
  }

  // ── NOTIFICATIONS ──
  function loadNotifications() {
    const list = document.getElementById('ep-notif-list');
    if (!list) return;

    const notifs = getDefaultNotifications();
    const unread = notifs.filter(n => !n.read).length;

    // Update dots
    const dot = document.getElementById('ep-notif-dot');
    const dotMobile = document.getElementById('ep-notif-dot-mobile');
    if (dot) dot.style.display = unread > 0 ? 'block' : 'none';
    if (dotMobile) dotMobile.style.display = unread > 0 ? 'block' : 'none';

    if (notifs.length === 0) {
      list.innerHTML = `<div class="ep-notif-empty"><i class="far fa-bell-slash"></i><span data-i18n="nav.notifications_empty">No new notifications</span></div>`;
      return;
    }

    list.innerHTML = notifs.map(n => `
      <div class="ep-notif-item${n.read ? ' read' : ''}">
        <div class="ep-notif-icon" style="color:${n.color};">
          <i class="fas ${n.icon}"></i>
        </div>
        <div class="ep-notif-body">
          <div class="ep-notif-title">${n.title}</div>
          <div class="ep-notif-desc">${n.desc}</div>
          <div class="ep-notif-time"><i class="far fa-clock"></i> ${n.time}</div>
        </div>
      </div>
    `).join('');
  }

  window.epToggleNotifications = function () {
    const panel = document.getElementById('ep-notif-panel');
    if (panel) panel.classList.toggle('open');
  };

  window.epClearNotifications = function () {
    const dot = document.getElementById('ep-notif-dot');
    const dotMobile = document.getElementById('ep-notif-dot-mobile');
    if (dot) dot.style.display = 'none';
    if (dotMobile) dotMobile.style.display = 'none';
    const items = document.querySelectorAll('.ep-notif-item');
    items.forEach(i => i.classList.add('read'));
  };

  // ── THEME TOGGLE ──
  function initTheme() {
    const saved = localStorage.getItem('elixopay-theme') || 'dark';
    applyTheme(saved);
  }

  function applyTheme(theme) {
    const body = document.body;
    const icon = document.getElementById('ep-theme-icon');
    const label = document.getElementById('ep-theme-label');

    if (theme === 'light') {
      body.classList.add('ep-light');
      if (icon) { icon.className = 'fas fa-sun'; }
      if (label) label.textContent = 'Light Mode';
    } else {
      body.classList.remove('ep-light');
      if (icon) { icon.className = 'fas fa-moon'; }
      if (label) label.textContent = 'Dark Mode';
    }
    localStorage.setItem('elixopay-theme', theme);
  }

  window.epToggleTheme = function () {
    const current = localStorage.getItem('elixopay-theme') || 'dark';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  };

  // ── ACTIVE LINK ──
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

  // ── LANGUAGE SYNC ──
  function syncLangSelector() {
    const saved = localStorage.getItem('elixopay-lang') || 'th';
    syncLangSelectorValue(saved);
  }

  function syncLangSelectorValue(lang) {
    const sel = document.getElementById('langSelect');
    const selMobile = document.getElementById('langSelectMobile');
    if (sel) sel.value = lang;
    if (selMobile) selMobile.value = lang;
  }

  // ── USER INFO ──
  function loadUserInfo() {
    const userStr = localStorage.getItem('user');
    if (userStr) {
      try {
        const user = JSON.parse(userStr);
        updateUserUI(user);
      } catch (e) { /* ignore */ }
    }

    if (window.apiFetch && window.API_CONFIG) {
      window.apiFetch(window.API_CONFIG.ENDPOINTS.auth.me)
        .then(res => res.ok ? res.json() : null)
        .then(data => {
          if (data && data.data && data.data.user) {
            updateUserUI(data.data.user);
          }
        })
        .catch(() => { /* silent */ });
    }
  }

  function updateUserUI(user) {
    const name = `${user.firstName || user.name || ''} ${user.lastName || ''}`.trim() || 'Merchant';
    const email = user.email || '';
    const initial = name.charAt(0).toUpperCase();

    const nameEl = document.getElementById('ep-sidebar-name');
    const emailEl = document.getElementById('ep-sidebar-email');
    const initialEl = document.getElementById('ep-sidebar-initial');

    if (nameEl) nameEl.textContent = name;
    if (emailEl) emailEl.textContent = email;
    if (initialEl) initialEl.textContent = initial;
  }

  // ── SIDEBAR TOGGLE ──
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

  // ── LOGOUT ──
  window.epSidebarLogout = async function () {
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
    window.logout = window.epSidebarLogout;
  }

  // Init on DOM ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
