// ==========================================
// Elixopay UI Enhancements (Professional Look)
// Include this script at the end of the body tag
// requires SweetAlert2: <script src="https://cdn.jsdelivr.net/npm/sweetalert2@11"></script>
// ==========================================

// --- 1. Toast Notification System (SweetAlert2 Wrap) ---
// Wrapped in try-catch to prevent SweetAlert2 load failure from killing the entire script
let Toast = null;
try {
    if (typeof Swal !== 'undefined') {
        Toast = Swal.mixin({
            toast: true,
            position: 'top-end',
            showConfirmButton: false,
            timer: 3000,
            timerProgressBar: true,
            background: 'var(--dark-card, #1E293B)',
            color: 'var(--text-primary, #F8FAFC)',
            didOpen: (toast) => {
                toast.addEventListener('mouseenter', Swal.stopTimer)
                toast.addEventListener('mouseleave', Swal.resumeTimer)
            }
        });
    }
} catch (e) {
    console.warn('SweetAlert2 not available, falling back to native alerts.');
}

/**
 * Global function to show a beautiful toast instead of alert()
 * @param {string} title - The message to display
 * @param {string} icon - 'success', 'error', 'warning', 'info'
 */
window.showToast = function (title, icon = 'info') {
    if (Toast) {
        Toast.fire({ icon: icon, title: title });
    } else {
        console.log('[Toast]', icon, title);
    }
};

/**
 * Overwrite window.alert to use SweetAlert2 Modal globally for fallback compatibility
 * This instantly makes all old alert() calls look professional.
 */
const originalAlert = window.alert;
if (typeof Swal !== 'undefined') {
    window.alert = function (message) {
        Swal.fire({
            text: message,
            icon: 'info',
            confirmButtonText: 'OK',
            confirmButtonColor: '#8B5CF6',
            background: 'var(--dark-card, #1E293B)',
            color: 'var(--text-primary, #F8FAFC)',
            backdrop: `rgba(0,0,0,0.6)`
        });
    };
}


// --- 2. Cookie Consent Banner ---
function initCookieConsent() {
    // Check if user already accepted
    const consent = localStorage.getItem('elixopay_cookie_consent');
    if (consent === 'accepted') return;

    // Get current language
    const lang = localStorage.getItem('elixopay_lang') || 'th';
    const cookieText = {
        th: { title: 'เราใช้คุกกี้', desc: 'เราใช้คุกกี้เพื่อเพิ่มประสบการณ์การใช้งาน แสดงเนื้อหาที่เหมาะสม และวิเคราะห์การเข้าชม เมื่อคลิก "ยอมรับทั้งหมด" ถือว่าคุณยินยอมให้เราใช้คุกกี้', link: 'อ่านนโยบายความเป็นส่วนตัว', accept: 'ยอมรับทั้งหมด', decline: 'ปฏิเสธ' },
        en: { title: 'We use cookies', desc: 'We use cookies to enhance your browsing experience, serve personalized content, and analyze our traffic. By clicking "Accept All", you consent to our use of cookies.', link: 'Read our Privacy Policy', accept: 'Accept All', decline: 'Decline' },
        zh: { title: '我们使用Cookie', desc: '我们使用Cookie来增强您的浏览体验、提供个性化内容并分析我们的流量。点击"全部接受"即表示您同意我们使用Cookie。', link: '阅读隐私政策', accept: '全部接受', decline: '拒绝' }
    };
    const ct = cookieText[lang] || cookieText.th;

    // Create Banner Element
    const banner = document.createElement('div');
    banner.id = 'cookie-consent-banner';
    banner.innerHTML = `
        <div class="cookie-content">
            <div class="cookie-icon"><i class="fa-solid fa-cookie-bite"></i></div>
            <div class="cookie-text">
                <h4 style="margin:0 0 5px 0; font-size:1rem; font-weight:600; color:white;">${ct.title}</h4>
                <p style="margin:0; font-size:0.85rem; color:#cbd5e1; line-height:1.4;">
                    ${ct.desc} 
                    <a href="privacy.html" style="color:#d946ef; text-decoration:none;">${ct.link}</a>.
                </p>
            </div>
        </div>
        <div class="cookie-buttons">
            <button id="btn-cookie-accept" class="cookie-btn cookie-btn-primary">${ct.accept}</button>
            <button id="btn-cookie-reject" class="cookie-btn cookie-btn-secondary">${ct.decline}</button>
        </div>
    `;

    // Add Styles inline for portability
    const style = document.createElement('style');
    style.innerHTML = `
        #cookie-consent-banner {
            position: fixed;
            bottom: 20px;
            left: 50%;
            transform: translateX(-50%);
            width: 90%;
            max-width: 800px;
            background: rgba(30, 41, 59, 0.95);
            backdrop-filter: blur(10px);
            border: 1px solid rgba(255, 255, 255, 0.1);
            border-radius: 16px;
            padding: 20px;
            display: flex;
            align-items: center;
            justify-content: space-between;
            gap: 20px;
            box-shadow: 0 20px 40px rgba(0, 0, 0, 0.4);
            z-index: 99999;
            font-family: 'Inter', sans-serif;
            animation: slideUp 0.5s cubic-bezier(0.16, 1, 0.3, 1) forwards;
        }
        @keyframes slideUp {
            from { opacity: 0; transform: translate(-50%, 100px); }
            to { opacity: 1; transform: translate(-50%, 0); }
        }
        .cookie-content {
            display: flex;
            align-items: flex-start;
            gap: 15px;
        }
        .cookie-icon {
            font-size: 1.5rem;
            color: #d946ef; /* Fuchsia */
            margin-top: 2px;
        }
        .cookie-buttons {
            display: flex;
            gap: 10px;
            flex-shrink: 0;
        }
        .cookie-btn {
            padding: 8px 16px;
            border-radius: 8px;
            font-weight: 600;
            font-size: 0.85rem;
            cursor: pointer;
            transition: all 0.2s;
            border: none;
        }
        .cookie-btn-primary {
            background: linear-gradient(135deg, #a855f7 0%, #d946ef 100%);
            color: white;
        }
        .cookie-btn-primary:hover {
            transform: translateY(-2px);
            box-shadow: 0 4px 12px rgba(217, 70, 239, 0.3);
        }
        .cookie-btn-secondary {
            background: transparent;
            border: 1px solid rgba(255, 255, 255, 0.2);
            color: white;
        }
        .cookie-btn-secondary:hover {
            background: rgba(255, 255, 255, 0.05);
        }
        @media (max-width: 640px) {
            #cookie-consent-banner {
                flex-direction: column;
                bottom: 10px;
                width: 95%;
            }
            .cookie-buttons {
                width: 100%;
                justify-content: flex-end;
            }
        }
    `;

    document.head.appendChild(style);
    document.body.appendChild(banner);

    // Event Listeners
    document.getElementById('btn-cookie-accept').addEventListener('click', () => {
        localStorage.setItem('elixopay_cookie_consent', 'accepted');
        banner.style.animation = 'slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards';
        setTimeout(() => banner.remove(), 400);
    });

    document.getElementById('btn-cookie-reject').addEventListener('click', () => {
        // Technically still need basic cookies to function, but store preference.
        localStorage.setItem('elixopay_cookie_consent', 'rejected');
        banner.style.animation = 'slideDown 0.4s cubic-bezier(0.16, 1, 0.3, 1) forwards';
        setTimeout(() => banner.remove(), 400);
    });

    // Add slideDown animation
    const styleSlideDown = document.createElement('style');
    styleSlideDown.innerHTML = `
        @keyframes slideDown {
            from { opacity: 1; transform: translate(-50%, 0); }
            to { opacity: 0; transform: translate(-50%, 100px); }
        }
    `;
    document.head.appendChild(styleSlideDown);
}

// --- 2.5. Mobile Menu Toggle (runs IMMEDIATELY, no dependencies) ---
function initMobileMenu() {
    const mobileBtn = document.querySelector('.mobile-menu-btn');
    const navLinks = document.querySelector('.nav-links');
    if (mobileBtn && navLinks) {
        // Remove existing listeners by cloning (defensive programming)
        const newBtn = mobileBtn.cloneNode(true);
        if (mobileBtn.parentNode) {
            mobileBtn.parentNode.replaceChild(newBtn, mobileBtn);
        }

        newBtn.addEventListener('click', function (e) {
            e.stopPropagation();
            navLinks.classList.toggle('show');
        });

        // Close menu when clicking outside
        document.addEventListener('click', function (e) {
            if (!navLinks.contains(e.target) && !newBtn.contains(e.target)) {
                navLinks.classList.remove('show');
            }
        });
    }
}

// Initialize mobile menu IMMEDIATELY (before DOMContentLoaded in case it already fired)
if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initMobileMenu);
} else {
    // DOM already loaded, run now
    initMobileMenu();
}

// Run other enhancements on load (wrapped in try-catch for safety)
document.addEventListener('DOMContentLoaded', () => {
    try { initCookieConsent(); } catch (e) { console.warn('Cookie consent init failed:', e); }
    try { initCopyCodeButtons(); } catch (e) { console.warn('Copy buttons init failed:', e); }
    try { initStatusIndicator(); } catch (e) { console.warn('Status indicator init failed:', e); }
    try { initAuthNavigation(); } catch (e) { console.warn('Auth navigation init failed:', e); }
});


// --- 3. Copy Code Buttons ---
function initCopyCodeButtons() {
    const codeBlocks = document.querySelectorAll('.code-block');
    if (!codeBlocks.length) return;

    // Inject required CSS once
    const style = document.createElement('style');
    style.innerHTML = `
        .code-block {
            position: relative;
        }
        .copy-code-btn {
            position: absolute;
            top: 10px;
            right: 10px;
            background: rgba(139, 92, 246, 0.2);
            border: 1px solid rgba(139, 92, 246, 0.4);
            color: #c084fc;
            border-radius: 6px;
            padding: 4px 10px;
            font-size: 0.75rem;
            font-weight: 600;
            font-family: 'Inter', sans-serif;
            cursor: pointer;
            transition: all 0.2s;
            display: flex;
            align-items: center;
            gap: 5px;
            z-index: 10;
            white-space: nowrap;
        }
        .copy-code-btn:hover {
            background: rgba(139, 92, 246, 0.35);
            border-color: rgba(139, 92, 246, 0.7);
            color: white;
        }
        .copy-code-btn.copied {
            background: rgba(16, 185, 129, 0.2);
            border-color: rgba(16, 185, 129, 0.4);
            color: #34d399;
        }
    `;
    document.head.appendChild(style);

    codeBlocks.forEach(block => {
        // Skip if this code block already has a copy button (avoid duplication)
        if (block.querySelector('.copy-btn, .copy-code-btn, [data-copy]')) return;

        // Make sure position is relative for absolute child
        block.style.position = 'relative';

        const btn = document.createElement('button');
        btn.className = 'copy-code-btn';
        btn.innerHTML = '<i class="far fa-copy"></i> Copy';
        btn.setAttribute('aria-label', 'Copy code to clipboard');

        btn.addEventListener('click', () => {
            const text = block.innerText.replace('Copy', '').trim();
            navigator.clipboard.writeText(text).then(() => {
                btn.innerHTML = '<i class="fas fa-check"></i> Copied!';
                btn.classList.add('copied');
                setTimeout(() => {
                    btn.innerHTML = '<i class="far fa-copy"></i> Copy';
                    btn.classList.remove('copied');
                }, 2000);
            }).catch(() => {
                showToast('Failed to copy. Please select manually.', 'error');
            });
        });

        block.appendChild(btn);
    });
}


// --- 4. System Status Indicator ---
// Adds a fixed floating "All Systems Operational" badge at the bottom-right corner.
function initStatusIndicator() {
    // Don't add twice
    if (document.getElementById('status-indicator-pill')) return;

    const pill = document.createElement('a');
    pill.id = 'status-indicator-pill';
    pill.href = 'status.html';
    pill.title = 'System Status';
    pill.innerHTML = `
        <span class="status-dot"></span>
        <span class="status-label" data-i18n="status.all_operational">All Systems Operational</span>
    `;

    // Wait until the DOM has been translated initially, then translate this element specifically if possible.
    setTimeout(() => {
        if (typeof ElixopayI18n !== 'undefined' && typeof ElixopayI18n.updatePage === 'function') {
            ElixopayI18n.updatePage();
        } else if (typeof window.updateContent === 'function') {
            window.updateContent();
        }
    }, 100);

    const style = document.createElement('style');
    style.innerHTML = `
        #status-indicator-pill {
            position: fixed;
            bottom: 24px;
            right: 24px;
            z-index: 9999;
            display: inline-flex;
            align-items: center;
            gap: 8px;
            background: rgba(10, 20, 15, 0.75);
            backdrop-filter: blur(12px);
            -webkit-backdrop-filter: blur(12px);
            border: 1px solid rgba(16, 185, 129, 0.35);
            color: #34d399;
            border-radius: 99px;
            padding: 7px 16px 7px 12px;
            font-size: 0.78rem;
            font-weight: 600;
            font-family: 'Inter', sans-serif;
            text-decoration: none;
            box-shadow: 0 4px 24px rgba(0,0,0,0.35), 0 0 0 1px rgba(16,185,129,0.1);
            transition: transform 0.2s, box-shadow 0.2s, background 0.2s;
            cursor: pointer;
            user-select: none;
        }
        #status-indicator-pill:hover {
            transform: translateY(-2px);
            background: rgba(10, 28, 18, 0.88);
            box-shadow: 0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(16,185,129,0.25);
        }
        .status-dot {
            width: 8px;
            height: 8px;
            border-radius: 50%;
            background: #34d399;
            flex-shrink: 0;
            animation: pulse-status 2s infinite;
        }
        @keyframes pulse-status {
            0%   { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0.7); }
            70%  { box-shadow: 0 0 0 7px rgba(52, 211, 153, 0); }
            100% { box-shadow: 0 0 0 0 rgba(52, 211, 153, 0); }
        }
        .status-label { color: #34d399; }
    `;
    document.head.appendChild(style);
    document.body.appendChild(pill);
}

// --- 5. Global Auth Navigation Toggle ---
function initAuthNavigation() {
    const userStr = localStorage.getItem('user');
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');

    if (userStr && token) {
        try {
            const navLinks = document.querySelector('.nav-links');
            if (navLinks) {
                // Remove login/signup wrappers
                const loginBtn = navLinks.querySelector('a[href*="login.html"]');
                const signupBtn = navLinks.querySelector('a[href*="signup.html"]');
                if (loginBtn && loginBtn.parentElement && loginBtn.parentElement.tagName === 'LI') loginBtn.parentElement.remove();
                if (signupBtn && signupBtn.parentElement && signupBtn.parentElement.tagName === 'LI' && signupBtn.parentElement !== (loginBtn && loginBtn.parentElement)) signupBtn.parentElement.remove();
                if (loginBtn && loginBtn.parentElement && loginBtn.parentElement.tagName !== 'LI') loginBtn.remove();
                if (signupBtn && signupBtn.parentElement && signupBtn.parentElement.tagName !== 'LI') signupBtn.remove();

                const dashboardUrl = window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1'
                    ? 'http://localhost:3000/dashboard.html'
                    : 'https://app.elixopay.com/dashboard.html';

                // Dashboard Button
                const dashboardLi = document.createElement('li');
                dashboardLi.className = 'auth-dynamic-btn';
                dashboardLi.innerHTML = `
                    <a href="${dashboardUrl}" class="btn btn-primary" style="background: linear-gradient(135deg, #10b981 0%, #059669 100%); line-height: 1.5;">
                        <i class="fas fa-layer-group"></i> <span data-i18n="nav.dashboard">Dashboard</span>
                    </a>
                `;

                // Logout Button
                const logoutLi = document.createElement('li');
                logoutLi.className = 'auth-dynamic-btn';
                logoutLi.innerHTML = `
                    <a href="#" class="btn btn-outline" style="border: 1px solid rgba(239, 68, 68, 0.5); color: #ef4444; line-height: 1.5;" onclick="localStorage.removeItem('user'); localStorage.removeItem('token'); localStorage.removeItem('authToken'); window.location.reload(); return false;">
                        <i class="fas fa-sign-out-alt"></i> <span data-i18n="nav.logout">ออกจากระบบ</span>
                    </a>
                `;

                // Insert components avoiding the language selector
                const langSelect = navLinks.querySelector('.lang-select');
                if (langSelect && langSelect.parentElement && langSelect.parentElement.tagName === 'LI') {
                    navLinks.insertBefore(dashboardLi, langSelect.parentElement);
                    navLinks.insertBefore(logoutLi, langSelect.parentElement);
                } else if (langSelect) {
                    navLinks.insertBefore(dashboardLi, langSelect);
                    navLinks.insertBefore(logoutLi, langSelect);
                } else {
                    navLinks.appendChild(dashboardLi);
                    navLinks.appendChild(logoutLi);
                }
            }
        } catch (e) {
            console.error('Error handling auth navigation', e);
        }
    }
}
