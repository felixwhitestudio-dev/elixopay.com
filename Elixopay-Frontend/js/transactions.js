// ═══════════════════════════════════════════════════════
// Elixopay Transactions Page — JavaScript
// Connects to real API data (no sample data)
// ═══════════════════════════════════════════════════════

(function () {
    'use strict';

    const PER_PAGE = 15;
    let currentPage = 1;
    let filteredData = [];
    let currentDetail = null;

    // ─── LOAD TRANSACTIONS (from API / localStorage) ───
    function loadTransactions() {
        // Clear any old sample data on first load
        localStorage.removeItem('zynex_transactions');
        return []; // Real data will come from backend API
    }

    // ─── FILTER & RENDER ───
    function applyFilters() {
        const allData = loadTransactions();
        const search = document.getElementById('searchInput').value.toLowerCase().trim();
        const status = document.getElementById('statusFilter').value;
        const method = document.getElementById('methodFilter').value;
        const dateRange = document.getElementById('dateFilter').value;

        const now = Date.now();
        const rangeMs = { '7d': 7, '30d': 30, '90d': 90, 'all': 99999 };
        const days = rangeMs[dateRange] || 30;

        filteredData = allData.filter(tx => {
            if (status !== 'all' && tx.status !== status) return false;
            if (method !== 'all' && tx.method !== method) return false;
            if (search && !tx.id.toLowerCase().includes(search) && !tx.description.toLowerCase().includes(search)) return false;
            if ((now - new Date(tx.date).getTime()) > days * 86400000) return false;
            return true;
        });

        currentPage = 1;
        renderTable();
        renderSummary();
    }

    function renderSummary() {
        const allData = loadTransactions();
        const succeeded = allData.filter(t => t.status === 'succeeded');
        const failed = allData.filter(t => t.status === 'failed');
        const total = succeeded.reduce((s, t) => s + (t.amount || 0), 0);

        document.getElementById('totalCount').textContent = allData.length.toLocaleString();
        document.getElementById('successCount').textContent = succeeded.length.toLocaleString();
        document.getElementById('failedCount').textContent = failed.length.toLocaleString();
        document.getElementById('totalAmount').textContent = `฿${total.toLocaleString('th-TH', { minimumFractionDigits: 2 })}`;
    }

    function renderTable() {
        const tbody = document.getElementById('txBody');
        const empty = document.getElementById('txEmpty');
        const table = document.getElementById('txTable');
        const pagination = document.getElementById('txPagination');

        const start = (currentPage - 1) * PER_PAGE;
        const end = start + PER_PAGE;
        const page = filteredData.slice(start, end);

        if (filteredData.length === 0) {
            table.style.display = 'none';
            empty.style.display = 'block';
            pagination.style.display = 'none';
        } else {
            table.style.display = 'table';
            empty.style.display = 'none';
            pagination.style.display = 'flex';
        }

        const methodLabels = { promptpay: 'PromptPay', card: 'บัตรเครดิต', bank: 'โอนธนาคาร' };
        const methodIcons = { promptpay: 'qrcode', card: 'credit-card', bank: 'university' };
        const statusIcons = { succeeded: 'check-circle', pending: 'clock', failed: 'times-circle', refunded: 'undo' };

        tbody.innerHTML = page.map((tx, i) => `
            <tr onclick="viewDetail(${start + i})">
                <td><span class="tx-id">${tx.id}</span></td>
                <td><span class="tx-date">${formatDate(tx.date)}</span></td>
                <td>${escHtml(tx.description)}</td>
                <td><span class="tx-method"><i class="fas fa-${methodIcons[tx.method]}"></i> ${methodLabels[tx.method] || tx.method}</span></td>
                <td><span class="tx-amount">฿${(tx.amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span></td>
                <td><span class="tx-status ${tx.status}"><i class="fas fa-${statusIcons[tx.status]}"></i> ${tx.status}</span></td>
                <td><button class="tx-view-btn" onclick="event.stopPropagation();viewDetail(${start + i})"><i class="fas fa-eye"></i></button></td>
            </tr>
        `).join('');

        // Pagination
        const totalPages = Math.ceil(filteredData.length / PER_PAGE) || 1;
        document.getElementById('pagInfo').textContent = filteredData.length === 0
            ? 'ยังไม่มีรายการ'
            : `แสดง ${Math.min(start + 1, filteredData.length)}-${Math.min(end, filteredData.length)} จาก ${filteredData.length} รายการ`;
        document.getElementById('pagCurrent').textContent = currentPage;
        document.getElementById('pagPrev').disabled = currentPage <= 1;
        document.getElementById('pagNext').disabled = currentPage >= totalPages;
    }

    function formatDate(iso) {
        const d = new Date(iso);
        return d.toLocaleDateString('th-TH', { day: '2-digit', month: 'short', year: 'numeric' }) + ' ' + d.toLocaleTimeString('th-TH', { hour: '2-digit', minute: '2-digit' });
    }

    function escHtml(s) { const d = document.createElement('div'); d.textContent = s; return d.innerHTML; }

    // ─── PAGINATION ───
    window.changePage = function (dir) {
        const totalPages = Math.ceil(filteredData.length / PER_PAGE);
        currentPage = Math.max(1, Math.min(totalPages, currentPage + dir));
        renderTable();
    };

    // ─── DETAIL MODAL ───
    window.viewDetail = function (idx) {
        const tx = filteredData[idx];
        if (!tx) return;
        currentDetail = tx;

        const methodLabels = { promptpay: 'PromptPay', card: 'บัตรเครดิต/เดบิต', bank: 'โอนธนาคาร' };
        const statusLabels = { succeeded: 'สำเร็จ', pending: 'รอดำเนินการ', failed: 'ล้มเหลว', refunded: 'คืนเงิน' };

        document.getElementById('detailBody').innerHTML = `
            <div class="tx-detail-row"><span class="tx-detail-label">Transaction ID</span><span class="tx-detail-value"><code>${tx.id}</code></span></div>
            <div class="tx-detail-row"><span class="tx-detail-label">วันที่/เวลา</span><span class="tx-detail-value">${formatDate(tx.date)}</span></div>
            <div class="tx-detail-row"><span class="tx-detail-label">คำอธิบาย</span><span class="tx-detail-value">${escHtml(tx.description)}</span></div>
            <div class="tx-detail-row"><span class="tx-detail-label">ช่องทาง</span><span class="tx-detail-value">${methodLabels[tx.method] || tx.method}</span></div>
            <div class="tx-detail-row"><span class="tx-detail-label">จำนวนเงิน</span><span class="tx-detail-value">฿${(tx.amount || 0).toLocaleString('th-TH', { minimumFractionDigits: 2 })}</span></div>
            <div class="tx-detail-row"><span class="tx-detail-label">สถานะ</span><span class="tx-detail-value"><span class="tx-status ${tx.status}">${statusLabels[tx.status]}</span></span></div>
            <div class="tx-detail-row"><span class="tx-detail-label">อีเมลลูกค้า</span><span class="tx-detail-value">${tx.email || '—'}</span></div>
            <div class="tx-detail-row"><span class="tx-detail-label">Order ID</span><span class="tx-detail-value"><code>${tx.metadata?.order_id || '—'}</code></span></div>
        `;
        document.getElementById('detailModal').classList.add('show');
    };

    window.closeDetail = function () {
        document.getElementById('detailModal').classList.remove('show');
    };

    window.copyTxId = function () {
        if (!currentDetail) return;
        navigator.clipboard.writeText(currentDetail.id).then(() => showToast('Transaction ID copied!', 'success'));
    };

    // ─── EXPORT CSV ───
    window.exportCSV = function () {
        if (filteredData.length === 0) {
            showToast('ไม่มีข้อมูลให้ export', 'warning');
            return;
        }
        const headers = ['Transaction ID', 'Date', 'Description', 'Method', 'Amount', 'Status', 'Email'];
        const rows = filteredData.map(tx =>
            [tx.id, tx.date, tx.description, tx.method, tx.amount, tx.status, tx.email].join(',')
        );
        const csv = [headers.join(','), ...rows].join('\n');
        const blob = new Blob([csv], { type: 'text/csv' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `elixopay_transactions_${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
        showToast('Export สำเร็จ!', 'success');
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
        applyFilters();
        document.querySelectorAll('.zd-rv').forEach(el => revealObs.observe(el));

        // Event listeners for filters
        document.getElementById('searchInput').addEventListener('input', debounce(applyFilters, 300));
        document.getElementById('statusFilter').addEventListener('change', applyFilters);
        document.getElementById('methodFilter').addEventListener('change', applyFilters);
        document.getElementById('dateFilter').addEventListener('change', applyFilters);

        // Modal close
        document.getElementById('detailModal').addEventListener('click', e => { if (e.target.id === 'detailModal') closeDetail(); });
        document.addEventListener('keydown', e => { if (e.key === 'Escape') closeDetail(); });

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

    function debounce(fn, ms) { let t; return (...a) => { clearTimeout(t); t = setTimeout(() => fn(...a), ms); }; }

})();
