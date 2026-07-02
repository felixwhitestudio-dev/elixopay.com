// ═══════════════════════════════════════════════════════
// Elixopay Billing Page — JavaScript
// ═══════════════════════════════════════════════════════

(function () {
    'use strict';

    // ─── CALCULATE BILLING FROM TRANSACTIONS ───
    function calculateBilling() {
        let txData = [];
        try { txData = JSON.parse(localStorage.getItem('zynex_transactions')) || []; } catch (e) { }

        const now = new Date();
        const thisMonth = txData.filter(t => {
            const d = new Date(t.date);
            return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
        });

        const succeeded = thisMonth.filter(t => t.status === 'succeeded');
        const totalFee = succeeded.reduce((s, t) => s + t.fee, 0);
        const totalVolume = succeeded.reduce((s, t) => s + t.amount, 0);

        return {
            monthFee: totalFee,
            monthTx: succeeded.length,
            monthVolume: totalVolume,
            allTx: txData
        };
    }

    // ─── GENERATE INVOICES ───
    function generateInvoices() {
        const stored = localStorage.getItem('zynex_invoices');
        if (stored) {
            try { return JSON.parse(stored); } catch (e) { }
        }

        let txData = [];
        try { txData = JSON.parse(localStorage.getItem('zynex_transactions')) || []; } catch (e) { }

        if (txData.length === 0) return [];

        // Generate invoices for past months
        const invoices = [];
        const now = new Date();

        for (let m = 1; m <= 3; m++) {
            const d = new Date(now.getFullYear(), now.getMonth() - m, 1);
            const monthName = d.toLocaleDateString('th-TH', { month: 'long', year: 'numeric' });
            const txCount = Math.floor(Math.random() * 30) + 5;
            const volume = Math.round((Math.random() * 50000 + 5000) * 100) / 100;
            const fee = Math.round(volume * 0.025 * 100) / 100;

            invoices.push({
                id: `INV-${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}`,
                period: monthName,
                txCount: txCount,
                volume: volume,
                fee: fee,
                status: m === 1 ? 'pending' : 'paid',
                date: d.toISOString()
            });
        }

        localStorage.setItem('zynex_invoices', JSON.stringify(invoices));
        return invoices;
    }

    // ─── RENDER ───
    function render() {
        const billing = calculateBilling();
        const invoices = generateInvoices();

        // Summary cards
        document.getElementById('monthFee').textContent = `฿${billing.monthFee.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
        document.getElementById('monthTx').textContent = billing.monthTx.toLocaleString();
        document.getElementById('monthVolume').textContent = `฿${billing.monthVolume.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;

        // Invoice list
        const list = document.getElementById('invoiceList');
        const empty = document.getElementById('invoiceEmpty');
        document.getElementById('invoiceCount').textContent = `${invoices.length} รายการ`;

        if (invoices.length === 0) {
            list.innerHTML = '';
            empty.style.display = 'block';
        } else {
            empty.style.display = 'none';
            list.innerHTML = invoices.map(inv => `
                <div class="bi-invoice-item">
                    <div class="bi-inv-icon"><i class="fas fa-file-alt"></i></div>
                    <div class="bi-inv-info">
                        <strong>${inv.id} — ${inv.period}</strong>
                        <span>${inv.txCount} รายการ | ยอดขาย ฿${inv.volume.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                    </div>
                    <div class="bi-inv-right">
                        <span class="bi-inv-amount">฿${inv.fee.toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span>
                        <span class="bi-inv-status ${inv.status}">${inv.status === 'paid' ? 'ชำระแล้ว' : 'รอชำระ'}</span>
                    </div>
                    <button class="bi-inv-download" onclick="downloadInvoice('${inv.id}')" title="ดาวน์โหลด"><i class="fas fa-download"></i></button>
                </div>
            `).join('');
        }
    }

    // ─── DOWNLOAD INVOICE ───
    window.downloadInvoice = function (id) {
        showToast(`กำลังเตรียม Invoice ${id}...`, 'info');
        setTimeout(() => {
            showToast('ฟีเจอร์ดาวน์โหลด PDF อยู่ระหว่างพัฒนา', 'info');
        }, 800);
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
        setTimeout(() => { toast.classList.remove('show'); setTimeout(() => toast.remove(), 250); }, 2200);
    }

    // ─── UTILS ───
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
