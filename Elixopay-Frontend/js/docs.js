// ═══════════════════════════════════════════════════════
// Elixopay Docs Page — JavaScript
// ═══════════════════════════════════════════════════════

(function () {
    'use strict';

    // ─── COPY CODE BLOCK ───
    window.copyBlock = function (btn) {
        const block = btn.closest('.doc-code');
        const code = block.querySelector('code');
        if (!code) return;

        navigator.clipboard.writeText(code.textContent).then(() => {
            showToast('Copied!', 'success');
            btn.innerHTML = '<i class="fas fa-check"></i>';
            setTimeout(() => { btn.innerHTML = '<i class="far fa-copy"></i>'; }, 1500);
        });
    };

    // ─── ACTIVE NAV LINK ON SCROLL ───
    const sections = document.querySelectorAll('.doc-section[id]');
    const navLinks = document.querySelectorAll('.doc-nav-link');

    function updateActiveNav() {
        let current = '';
        sections.forEach(sec => {
            const top = sec.offsetTop - 80;
            if (window.scrollY >= top) {
                current = sec.id;
            }
        });

        navLinks.forEach(link => {
            link.classList.remove('active');
            if (link.getAttribute('href') === '#' + current) {
                link.classList.add('active');
            }
        });
    }

    window.addEventListener('scroll', updateActiveNav, { passive: true });

    // Smooth scroll for nav links
    navLinks.forEach(link => {
        link.addEventListener('click', (e) => {
            e.preventDefault();
            const target = document.querySelector(link.getAttribute('href'));
            if (target) {
                target.scrollIntoView({ behavior: 'smooth', block: 'start' });
            }
        });
    });

    // ─── COMING SOON ───
    window.comingSoon = function (e) {
        if (e) e.preventDefault();
        showToast('Coming Soon — อยู่ระหว่างพัฒนา', 'info');
    };

    // ─── TOAST ───
    function showToast(message, type) {
        const existing = document.querySelector('.dash-toast');
        if (existing) existing.remove();

        const iconMap = { success: 'check-circle', info: 'info-circle', warning: 'exclamation-triangle', error: 'times-circle' };
        const toast = document.createElement('div');
        toast.className = `dash-toast ${type}`;
        toast.innerHTML = `<i class="fas fa-${iconMap[type] || 'info-circle'}"></i> ${message}`;
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => {
            toast.classList.remove('show');
            setTimeout(() => toast.remove(), 250);
        }, 2200);
    }

    // ─── LOGOUT ───
    window.dashLogout = function () {
        localStorage.removeItem('token');
        localStorage.removeItem('user');
        window.location.href = 'index.html';
    };

    // ─── SCROLL REVEAL ───
    const revealObs = new IntersectionObserver(entries => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                e.target.classList.add('vis');
                revealObs.unobserve(e.target);
            }
        });
    }, { threshold: 0.05 });

    // ─── INIT ───
    document.addEventListener('DOMContentLoaded', () => {
        document.querySelectorAll('.zd-rv').forEach(el => revealObs.observe(el));
        updateActiveNav();

        // User info
        const u = localStorage.getItem('user');
        if (u) {
            try {
                const user = JSON.parse(u);
                const n = document.getElementById('userName');
                const e = document.getElementById('userEmail');
                const i = document.getElementById('userInitial');
                if (n && user.name) n.textContent = user.name;
                if (e && user.email) e.textContent = user.email;
                if (i && user.name) i.textContent = user.name.charAt(0).toUpperCase();
            } catch (e) { }
        }
    });

})();
