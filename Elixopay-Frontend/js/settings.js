// ═══════════════════════════════════════════════════════
// Elixopay Settings Page — JavaScript
// ═══════════════════════════════════════════════════════

(function () {
    'use strict';

    const STORAGE_KEY = 'zynex_settings';

    // ─── DEFAULT SETTINGS ───
    const defaults = {
        profile: {
            bizName: '',
            bizType: '',
            bizEmail: '',
            bizPhone: '',
            bizWebsite: '',
            bizAddress: ''
        },
        payment: {
            paymentCurrency: 'THB',
            autoPayout: 'manual',
            paymentDesc: '',
            testMode: false,
            autoCapture: true
        },
        notifications: {
            notifEmailSuccess: true,
            notifEmailFail: true,
            notifEmailPayout: true,
            notifDailySummary: false,
            notifSmsHighValue: false,
            notifSmsSecurity: true
        },
        display: {
            displayLang: 'th',
            displayTimezone: 'Asia/Bangkok',
            displayDateFormat: 'DD/MM/YYYY',
            displayNumberFormat: 'th'
        }
    };

    // ─── LOAD SETTINGS ───
    function loadSettings() {
        let saved = {};
        try {
            saved = JSON.parse(localStorage.getItem(STORAGE_KEY)) || {};
        } catch (e) { }

        const settings = {};
        for (const section in defaults) {
            settings[section] = { ...defaults[section], ...saved[section] };
        }
        return settings;
    }

    // ─── POPULATE FORM ───
    function populateForm(settings) {
        for (const section in settings) {
            for (const key in settings[section]) {
                const el = document.getElementById(key);
                if (!el) continue;

                if (el.type === 'checkbox') {
                    el.checked = settings[section][key];
                } else {
                    el.value = settings[section][key];
                }
            }
        }
    }

    // ─── SAVE SETTINGS ───
    window.saveSettings = function (section) {
        const settings = loadSettings();

        if (!settings[section]) return;

        for (const key in defaults[section]) {
            const el = document.getElementById(key);
            if (!el) continue;

            if (el.type === 'checkbox') {
                settings[section][key] = el.checked;
            } else {
                settings[section][key] = el.value;
            }
        }

        localStorage.setItem(STORAGE_KEY, JSON.stringify(settings));
        showToast('Saved! — บันทึกเรียบร้อย', 'success');
    };

    // ─── COMING SOON ───
    window.comingSoon = function (e) {
        if (e) e.preventDefault();
        showToast('Coming Soon — อยู่ระหว่างพัฒนา', 'info');
    };

    // ─── CONFIRM MODAL ───
    window.confirmAction = function (action) {
        const modal = document.getElementById('confirmModal');
        const title = document.getElementById('modalTitle');
        const desc = document.getElementById('modalDesc');
        const confirmBtn = document.getElementById('modalConfirm');

        if (action === 'deactivate') {
            title.textContent = 'Deactivate Account';
            desc.textContent = 'คุณแน่ใจหรือไม่ว่าต้องการปิดการใช้งานบัญชีชั่วคราว? คุณจะไม่สามารถรับชำระเงินได้จนกว่าจะเปิดใช้งานอีกครั้ง';
            confirmBtn.textContent = 'Deactivate';
            confirmBtn.className = 'st-btn outline warning';
            confirmBtn.onclick = function () {
                showToast('Coming Soon — อยู่ระหว่างพัฒนา', 'info');
                closeModal();
            };
        } else if (action === 'delete') {
            title.textContent = 'Delete Account';
            desc.textContent = 'คุณแน่ใจหรือไม่ว่าต้องการลบบัญชีอย่างถาวร? การดำเนินการนี้ไม่สามารถเรียกคืนได้ ข้อมูลทั้งหมดจะถูกลบ';
            confirmBtn.textContent = 'Delete Permanently';
            confirmBtn.className = 'st-btn danger';
            confirmBtn.onclick = function () {
                showToast('Coming Soon — อยู่ระหว่างพัฒนา', 'info');
                closeModal();
            };
        }

        modal.classList.add('show');
    };

    window.closeModal = function () {
        document.getElementById('confirmModal').classList.remove('show');
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

    // ─── STRIPE CONNECT ───
    window.startStripeOnboarding = async function() {
        const btn = document.getElementById('btnConnectStripe');
        if (btn) {
            btn.disabled = true;
            btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> กำลังเตรียมการ...';
        }
        
        try {
            const res = await window.apiFetch(window.API_CONFIG.ENDPOINTS.stripeConnect.onboard, {
                method: 'POST'
            });
            const data = await res.json();
            
            if (data.success && data.data && data.data.url) {
                window.location.href = data.data.url;
            } else {
                throw new Error(data.message || 'Failed to generate Stripe onboarding link');
            }
        } catch (error) {
            console.error('Stripe Onboarding Error:', error);
            showToast('error', 'ไม่สามารถเชื่อมต่อ Stripe ได้: ' + error.message);
            if (btn) {
                btn.disabled = false;
                btn.innerHTML = '<i class="fas fa-plug"></i> ตั้งค่าการรับชำระเงิน (Connect to Stripe)';
            }
        }
    };

    window.checkStripeStatus = async function() {
        try {
            const res = await window.apiFetch(window.API_CONFIG.ENDPOINTS.stripeConnect.status);
            const data = await res.json();
            
            const badge = document.getElementById('stripeStatusBadge');
            const desc = document.getElementById('stripeStatusDesc');
            const container = document.getElementById('stripeActionContainer');
            
            if (!data.success) throw new Error('Failed to fetch status');
            
            const isCompleted = data.data.chargesEnabled && data.data.payoutsEnabled;
            
            if (isCompleted) {
                badge.innerHTML = '<i class="fas fa-check-circle"></i> พร้อมใช้งาน';
                badge.style.background = '#dcfce7';
                badge.style.color = '#166534';
                desc.textContent = 'บัญชีของคุณพร้อมรับชำระเงินและโอนเงินแล้ว';
                
                container.innerHTML = `
                    <i class="fas fa-check-circle" style="font-size: 2rem; color: #22c55e; margin-bottom: 1rem;"></i>
                    <h3 style="font-size: 1.1rem; color: #334155; margin-bottom: 0.5rem;">การเชื่อมต่อเสร็จสมบูรณ์</h3>
                    <p style="color: #64748b; margin-bottom: 0.5rem; font-size: 0.95rem;">คุณสามารถเริ่มรับการชำระเงินผ่านบัตรเครดิตได้ทันที</p>
                    <p style="color: #94a3b8; font-size: 0.85rem;">Stripe Account ID: <strong>${data.data.accountId}</strong></p>
                `;
                container.style.border = '1px solid #bbf7d0';
                container.style.background = '#f0fdf4';
            } else if (data.data.accountId) {
                badge.innerHTML = '<i class="fas fa-exclamation-triangle"></i> ข้อมูลไม่ครบ';
                badge.style.background = '#fef08a';
                badge.style.color = '#854d0e';
                desc.textContent = 'คุณยังกรอกข้อมูลกับ Stripe ไม่ครบ';
                
                container.innerHTML = `
                    <i class="fas fa-exclamation-circle" style="font-size: 2rem; color: #eab308; margin-bottom: 1rem;"></i>
                    <h3 style="font-size: 1.1rem; color: #334155; margin-bottom: 0.5rem;">กรุณากรอกข้อมูลให้ครบถ้วน</h3>
                    <p style="color: #64748b; margin-bottom: 1.5rem; font-size: 0.95rem;">Stripe ต้องการข้อมูลเพิ่มเติมเกี่ยวกับธุรกิจของคุณเพื่อเปิดใช้งานการรับเงิน</p>
                    <button id="btnConnectStripe" class="st-btn primary" onclick="startStripeOnboarding()" style="background: #eab308; border-color: #eab308;">
                        <i class="fas fa-edit"></i> ดำเนินการตั้งค่าต่อ
                    </button>
                `;
            }
        } catch (error) {
            console.error('Check Stripe Status Error:', error);
            const badge = document.getElementById('stripeStatusBadge');
            const desc = document.getElementById('stripeStatusDesc');
            if (badge) badge.innerHTML = '<i class="fas fa-times-circle"></i> ตรวจสอบไม่ได้';
            if (desc) desc.textContent = 'เกิดข้อผิดพลาดในการดึงข้อมูลจาก Stripe';
        }
    };

    // ─── SCROLL REVEAL ───
    const revealObs = new IntersectionObserver(entries => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                e.target.classList.add('vis');
                revealObs.unobserve(e.target);
            }
        });
    }, { threshold: 0.08 });

    // ─── INIT ───
    document.addEventListener('DOMContentLoaded', () => {
        populateForm(loadSettings());

        document.querySelectorAll('.zd-rv').forEach(el => revealObs.observe(el));
        
        // Fetch Stripe Connect Status
        if (typeof window.checkStripeStatus === 'function') {
            window.checkStripeStatus();
        }

        // Load user info
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

    // Close modal on overlay click
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('st-modal-overlay')) {
            closeModal();
        }
    });

    // Close modal on Escape
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });

})();
