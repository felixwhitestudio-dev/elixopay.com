// ═══════════════════════════════════════════════════════
// Elixopay Dashboard — Clean Sidebar Layout
// ═══════════════════════════════════════════════════════

(function () {
    'use strict';

    // ─── SCROLL REVEAL ───
    const revealObs = new IntersectionObserver(entries => {
        entries.forEach(e => {
            if (e.isIntersecting) {
                e.target.classList.add('vis');
                revealObs.unobserve(e.target);
            }
        });
    }, { threshold: 0.08 });

    document.querySelectorAll('.zd-rv').forEach(el => revealObs.observe(el));

    // ─── COPY MERCHANT ID ───
    window.copyMerchantId = function () {
        const el = document.getElementById('merchantId');
        if (!el) return;
        const text = el.textContent.trim();
        navigator.clipboard.writeText(text).then(() => {
            showToast('Copied!', 'success');
        }).catch(() => {
            const range = document.createRange();
            range.selectNode(el);
            window.getSelection().removeAllRanges();
            window.getSelection().addRange(range);
            document.execCommand('copy');
            window.getSelection().removeAllRanges();
            showToast('Copied!', 'success');
        });
    };

    // ─── COMING SOON HANDLER ───
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

    // ─── CHART ───
    function initChart() {
        const ctx = document.getElementById('revenueChart');
        if (!ctx) return;

        const chart = new Chart(ctx, {
            type: 'line',
            data: { labels: [], datasets: [{ label: 'Revenue (THB)', data: [], borderColor: '#3b82f6', backgroundColor: 'transparent', borderWidth: 1.5, pointRadius: 0, pointHoverRadius: 4, pointHoverBackgroundColor: '#3b82f6', pointHoverBorderColor: '#fff', pointHoverBorderWidth: 2, tension: 0.3, fill: true }] },
            options: {
                responsive: true,
                maintainAspectRatio: false,
                interaction: { intersect: false, mode: 'index' },
                plugins: {
                    legend: { display: false },
                    tooltip: {
                        backgroundColor: '#16171e', titleColor: '#c9cdd6', bodyColor: '#f0f1f4',
                        borderColor: 'rgba(255,255,255,0.06)', borderWidth: 1, padding: 10, cornerRadius: 6,
                        displayColors: false, titleFont: { family: 'Inter', size: 11 },
                        bodyFont: { family: 'Inter', size: 13, weight: '600' },
                        callbacks: { label: ctx => '฿' + (ctx.parsed.y || 0).toLocaleString() }
                    }
                },
                scales: {
                    x: { grid: { color: 'rgba(255,255,255,0.025)', drawBorder: false }, ticks: { color: '#4e5562', font: { size: 11, family: 'Inter' }, maxTicksLimit: 7 } },
                    y: { grid: { color: 'rgba(255,255,255,0.025)', drawBorder: false }, ticks: { color: '#4e5562', font: { size: 11, family: 'Inter' }, callback: v => '฿' + v.toLocaleString() }, beginAtZero: true }
                }
            },
            plugins: [{
                id: 'grad',
                beforeDatasetsDraw(chart) {
                    const { ctx, chartArea } = chart;
                    if (!chartArea) return;
                    const g = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
                    g.addColorStop(0, 'rgba(59,130,246,0.06)');
                    g.addColorStop(1, 'rgba(59,130,246,0)');
                    chart.data.datasets[0].backgroundColor = g;
                }
            }]
        });

        window._chart = chart;
        setDays(7);
    }

    function setDays(n) {
        const c = window._chart;
        if (!c) return;
        const labels = [], data = [], now = new Date();
        for (let i = n - 1; i >= 0; i--) {
            const d = new Date(now); d.setDate(d.getDate() - i);
            labels.push(n > 60 ? d.toLocaleDateString('en', { month: 'short' }) : d.toLocaleDateString('en', { month: 'short', day: 'numeric' }));
            data.push(0);
        }
        c.data.labels = labels;
        c.data.datasets[0].data = data;
        c.update('none');
    }

    window.updateChartFilter = function () {
        const s = document.getElementById('chartDateFilter');
        if (s) setDays(parseInt(s.value));
    };

    // ─── MERCHANT ID GENERATOR ───
    // Format: ZNX-XXXXXXX (7 alphanumeric chars = 36^7 ≈ 78 billion combos, supports 1M+ merchants easily)
    function generateMerchantId() {
        const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
        let id = 'ZNX-';
        for (let i = 0; i < 7; i++) {
            id += chars.charAt(Math.floor(Math.random() * chars.length));
        }
        return id;
    }

    function getMerchantId() {
        let id = localStorage.getItem('zynex_merchantId');
        if (!id) {
            id = generateMerchantId();
            localStorage.setItem('zynex_merchantId', id);
        }
        return id;
    }

    // ─── INIT ───
    document.addEventListener('DOMContentLoaded', () => {
        initChart();

        // Set merchant ID
        const mid = document.getElementById('merchantId');
        if (mid) mid.textContent = getMerchantId();

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

})();
