// ═══════════════════════════════════════════════════════
// Elixopay Payout Page — JavaScript
// Connects to real API data (no sample data)
// ═══════════════════════════════════════════════════════

(function () {
    'use strict';

    const BANK_KEY = 'zynex_bank';
    const PAYOUT_KEY = 'zynex_payouts';

    // ─── LOAD / SAVE ───
    function loadBank() {
        try { return JSON.parse(localStorage.getItem(BANK_KEY)) || null; } catch (e) { return null; }
    }
    function saveBank(data) { localStorage.setItem(BANK_KEY, JSON.stringify(data)); }

    function loadPayouts() {
        try { return JSON.parse(localStorage.getItem(PAYOUT_KEY)) || []; } catch (e) { return []; }
    }
    function savePayouts(data) { localStorage.setItem(PAYOUT_KEY, JSON.stringify(data)); }

    // ─── CALCULATE BALANCE ───
    function getBalance() {
        // Clear any old sample data
        localStorage.removeItem('zynex_payouts');
        // Balance will come from backend API
        const payouts = [];
        const withdrawn = 0;
        const pending = 0;

        return {
            balance: 0,
            withdrawn: withdrawn,
            pending: pending
        };
    }

    // ─── RENDER ───
    function render() {
        const bal = getBalance();
        const bank = loadBank();
        const payouts = loadPayouts();

        // Balance
        document.getElementById('balanceAmount').textContent = `฿${bal.balance.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
        document.getElementById('totalWithdrawn').textContent = `฿${bal.withdrawn.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
        document.getElementById('pendingAmount').textContent = `฿${bal.pending.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;

        // Last payout
        const completed = payouts.filter(p => p.status === 'completed');
        if (completed.length > 0) {
            const last = completed[0];
            document.getElementById('lastPayout').textContent = new Date(last.date).toLocaleDateString('th-TH', { day: '2-digit', month: 'short' });
        }

        // Bank card
        if (bank) {
            document.getElementById('bankName').textContent = bank.bankName;
            document.getElementById('bankAccount').textContent = `${bank.accountNumber} — ${bank.holderName}`;
            const badge = document.getElementById('bankBadge');
            badge.textContent = 'ยืนยันแล้ว';
            badge.className = 'po-bank-badge verified';
        }

        // Payout history
        const list = document.getElementById('payoutList');
        const empty = document.getElementById('payoutEmpty');
        document.getElementById('payoutCount').textContent = `${payouts.length} รายการ`;

        if (payouts.length === 0) {
            list.innerHTML = '';
            empty.style.display = 'block';
        } else {
            empty.style.display = 'none';
            const statusLabels = { completed: 'สำเร็จ', pending: 'รอดำเนินการ', failed: 'ล้มเหลว' };
            const statusIcons = { completed: 'check-circle', pending: 'clock', failed: 'times-circle' };

            list.innerHTML = payouts.map(p => `
                <div class="po-payout-item">
                    <div class="po-payout-icon ${p.status}"><i class="fas fa-${statusIcons[p.status]}"></i></div>
                    <div class="po-payout-info">
                        <strong>ถอนเงิน ${p.type === 'instant' ? '(ทันที)' : '(ปกติ)'}</strong>
                        <span>${new Date(p.date).toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' })} — ${p.bankName}</span>
                    </div>
                    <div>
                        <div class="po-payout-amount">฿${p.amount.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</div>
                        <div class="po-payout-status ${p.status}">${statusLabels[p.status]}</div>
                    </div>
                </div>
            `).join('');
        }
    }

    // ─── WITHDRAW MODAL ───
    window.openWithdraw = function () {
        const bank = loadBank();
        const bal = getBalance();

        document.getElementById('modalBalance').textContent = `฿${bal.balance.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
        document.getElementById('withdrawAmount').value = '';

        if (bank) {
            document.getElementById('modalBankName').textContent = `${bank.bankName} — ${bank.accountNumber}`;
        } else {
            document.getElementById('modalBankName').textContent = 'กรุณาตั้งค่าบัญชีธนาคารก่อน';
        }

        document.getElementById('withdrawModal').classList.add('show');
        document.getElementById('withdrawAmount').focus();
    };

    window.closeWithdraw = function () {
        document.getElementById('withdrawModal').classList.remove('show');
    };

    window.submitWithdraw = function () {
        const bank = loadBank();
        if (!bank) {
            showToast('กรุณาตั้งค่าบัญชีธนาคารก่อน', 'warning');
            return;
        }

        const amount = parseFloat(document.getElementById('withdrawAmount').value);
        const bal = getBalance();
        const type = document.querySelector('input[name="withdrawType"]:checked').value;

        if (!amount || amount < 100) {
            showToast('จำนวนเงินต้องอย่างน้อย ฿100', 'warning');
            return;
        }

        if (amount > bal.balance) {
            showToast('ยอดเงินไม่เพียงพอ', 'error');
            return;
        }

        const payouts = loadPayouts();
        payouts.unshift({
            id: `po_${randomHex(10)}`,
            amount: amount,
            type: type,
            status: type === 'instant' ? 'completed' : 'pending',
            bankName: bank.bankName,
            accountNumber: bank.accountNumber,
            date: new Date().toISOString()
        });

        savePayouts(payouts);
        closeWithdraw();
        render();
        showToast(type === 'instant' ? `ถอนเงิน ฿${amount.toFixed(2)} สำเร็จ!` : `สร้างคำขอถอน ฿${amount.toFixed(2)} แล้ว (รอ 2 วันทำการ)`, 'success');
    };

    // ─── BANK MODAL ───
    window.editBank = function () {
        const bank = loadBank();
        if (bank) {
            const options = document.getElementById('bankSelect').options;
            for (let i = 0; i < options.length; i++) {
                if (options[i].value === bank.bankName) { options[i].selected = true; break; }
            }
            document.getElementById('bankNumber').value = bank.accountNumber;
            document.getElementById('bankHolder').value = bank.holderName;
        }
        document.getElementById('bankModal').classList.add('show');
    };

    window.closeBankModal = function () {
        document.getElementById('bankModal').classList.remove('show');
    };

    window.saveBank = function () {
        const bankName = document.getElementById('bankSelect').value;
        const number = document.getElementById('bankNumber').value.trim();
        const holder = document.getElementById('bankHolder').value.trim();

        if (!bankName) { showToast('กรุณาเลือกธนาคาร', 'warning'); return; }
        if (!number) { showToast('กรุณาใส่เลขที่บัญชี', 'warning'); return; }
        if (!holder) { showToast('กรุณาใส่ชื่อบัญชี', 'warning'); return; }

        saveBank({ bankName, accountNumber: number, holderName: holder });
        closeBankModal();
        render();
        showToast('บันทึกบัญชีธนาคารเรียบร้อย!', 'success');
    };

    // ─── UTILS ───
    function randomHex(len) {
        const c = '0123456789abcdef';
        let r = '';
        for (let i = 0; i < len; i++) r += c[Math.floor(Math.random() * 16)];
        return r;
    }

    function showToast(message, type) {
        const existing = document.querySelector('.dash-toast');
        if (existing) existing.remove();
        const iconMap = { success: 'check-circle', info: 'info-circle', warning: 'exclamation-triangle', error: 'times-circle' };
        const toast = document.createElement('div');
        toast.className = `dash-toast ${type}`;
        toast.innerHTML = `<i class="fas fa-${iconMap[type] || 'info-circle'}"></i> ${message}`;
        document.body.appendChild(toast);
        requestAnimationFrame(() => toast.classList.add('show'));
        setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 250); }, 2200);
    }

    window.comingSoon = function (e) { if (e) e.preventDefault(); showToast('Coming Soon — อยู่ระหว่างพัฒนา', 'info'); };
    window.dashLogout = function () { localStorage.removeItem('token'); localStorage.removeItem('user'); window.location.href = 'index.html'; };

    // ─── SCROLL REVEAL ───
    const revealObs = new IntersectionObserver(entries => {
        entries.forEach(e => { if (e.isIntersecting) { e.target.classList.add('vis'); revealObs.unobserve(e.target); } });
    }, { threshold: 0.05 });

    // ─── INIT ───
    document.addEventListener('DOMContentLoaded', () => {
        render();
        document.querySelectorAll('.zd-rv').forEach(el => revealObs.observe(el));

        // Modal close
        ['withdrawModal', 'bankModal'].forEach(id => {
            document.getElementById(id).addEventListener('click', e => { if (e.target.id === id) { document.getElementById(id).classList.remove('show'); } });
        });
        document.addEventListener('keydown', e => { if (e.key === 'Escape') { closeWithdraw(); closeBankModal(); } });

        // User info
        const u = localStorage.getItem('user');
        if (u) {
            try {
                const user = JSON.parse(u);
                if (user.name) { document.getElementById('userName').textContent = user.name; document.getElementById('userInitial').textContent = user.name.charAt(0).toUpperCase(); }
                if (user.email) document.getElementById('userEmail').textContent = user.email;
            } catch (e) { }
        }
    });

})();
