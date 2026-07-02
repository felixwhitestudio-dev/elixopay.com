// ═══════════════════════════════════════════════════════
// Elixopay Webhooks Page — JavaScript
// ═══════════════════════════════════════════════════════

(function () {
    'use strict';

    let _endpoints = [];
    let editingId = null; // Unused for now, but kept for future expansion

    // ─── LOAD ENDPOINTS FROM API ───
    async function loadEndpoints() {
        try {
            const res = await window.apiFetch(window.API_CONFIG.ENDPOINTS.webhooks.list);
            const data = await res.json();
            
            if (data.success) {
                _endpoints = data.data.endpoints || [];
                render();
            } else {
                showToast('Failed to load Webhook endpoints', 'error');
            }
        } catch (error) {
            console.error('Error loading webhooks:', error);
            showToast('Error loading Webhook endpoints', 'error');
        }
    }

    // ─── RENDER ───
    function render() {
        const list = document.getElementById('endpointList');
        const empty = document.getElementById('emptyState');
        const count = document.getElementById('endpointCount');

        if (!list) return;
        count.textContent = `${_endpoints.length} endpoint${_endpoints.length !== 1 ? 's' : ''}`;

        if (_endpoints.length === 0) {
            list.style.display = 'none';
            empty.style.display = 'block';
            return;
        }

        empty.style.display = 'none';
        list.style.display = 'flex';

        list.innerHTML = _endpoints.map((ep, i) => `
            <div class="wh-endpoint">
                <span class="wh-ep-status ${ep.isActive ? 'active' : 'disabled'}"></span>
                <div class="wh-ep-info">
                    <span class="wh-ep-url">${escHtml(ep.url)}</span>
                    <div class="wh-ep-meta">
                        ${ep.description ? `<span><i class="fas fa-tag"></i> ${escHtml(ep.description)}</span>` : ''}
                        <span><i class="fas fa-calendar"></i> ${new Date(ep.createdAt).toLocaleDateString('th-TH')}</span>
                        <span><i class="fas fa-key"></i> ${ep.secret.substring(0, 12)}…</span>
                    </div>
                </div>
                <div class="wh-ep-events">
                    ${(ep.events || ['payment.success', 'payment.failed']).slice(0, 3).map(e => `<span class="wh-ep-event-tag">${e}</span>`).join('')}
                    ${(ep.events && ep.events.length > 3) ? `<span class="wh-ep-event-tag">+${ep.events.length - 3}</span>` : ''}
                </div>
                <div class="wh-ep-actions">
                    <button class="wh-ep-btn" onclick="testPing('${ep.id}')" title="Test Ping (Send dummy event)"><i class="fas fa-paper-plane"></i></button>
                    <button class="wh-ep-btn" onclick="copySecret('${ep.id}')" title="Copy Secret"><i class="fas fa-key"></i></button>
                    <button class="wh-ep-btn delete" onclick="deleteEndpoint('${ep.id}')" title="Delete"><i class="fas fa-trash"></i></button>
                </div>
            </div>
        `).join('');
    }

    function escHtml(str) {
        if (!str) return '';
        const d = document.createElement('div');
        d.textContent = str;
        return d.innerHTML;
    }

    // ─── ADD MODAL ───
    window.openAddModal = function () {
        editingId = null;
        document.getElementById('modalTitle').textContent = 'Add Webhook Endpoint';
        document.getElementById('modalSave').innerHTML = '<i class="fas fa-plus"></i> Add Endpoint';
        document.getElementById('endpointUrl').value = '';
        document.getElementById('endpointDesc').value = '';
        
        // Reset checkboxes
        document.querySelectorAll('#eventChecks input').forEach((cb, i) => {
            cb.checked = i < 2; // Default: first 2 checked
        });
        
        document.getElementById('addModal').classList.add('show');
        document.getElementById('endpointUrl').focus();
    };

    window.closeModal = function () {
        document.getElementById('addModal').classList.remove('show');
    };

    // ─── SAVE (CREATE) ───
    window.saveEndpoint = async function () {
        const url = document.getElementById('endpointUrl').value.trim();
        const desc = document.getElementById('endpointDesc').value.trim();
        
        // Collect checked events
        const events = Array.from(document.querySelectorAll('#eventChecks input:checked')).map(cb => cb.value);

        if (!url) {
            showToast('URL is required', 'error');
            return;
        }

        if (!url.startsWith('https://') && !url.startsWith('http://')) {
            showToast('URL must start with http:// or https://', 'error');
            return;
        }

        if (events.length === 0) {
            showToast('Please select at least one event', 'error');
            return;
        }

        const btn = document.getElementById('modalSave');
        btn.disabled = true;
        btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Saving...';

        try {
            const res = await window.apiFetch(window.API_CONFIG.ENDPOINTS.webhooks.create, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ url, description: desc, events })
            });
            const data = await res.json();

            if (data.success) {
                showToast('Webhook endpoint added!', 'success');
                closeModal();
                loadEndpoints();
            } else {
                showToast(data.message || 'Failed to add webhook', 'error');
            }
        } catch (error) {
            console.error('Error saving webhook:', error);
            showToast('Error saving webhook', 'error');
        } finally {
            btn.disabled = false;
            btn.innerHTML = '<i class="fas fa-plus"></i> Add Endpoint';
        }
    };

    // ─── DELETE ───
    window.deleteEndpoint = async function (id) {
        if (!confirm('Are you sure you want to delete this webhook endpoint? You will stop receiving events.')) return;

        try {
            const res = await window.apiFetch(window.API_CONFIG.ENDPOINTS.webhooks.delete(id), {
                method: 'DELETE'
            });
            const data = await res.json();

            if (data.success) {
                showToast('Endpoint deleted', 'success');
                loadEndpoints();
            } else {
                showToast(data.message || 'Failed to delete webhook', 'error');
            }
        } catch (error) {
            console.error('Error deleting webhook:', error);
            showToast('Error deleting webhook', 'error');
        }
    };

    // ─── TEST PING ───
    window.testPing = async function (id) {
        showToast('Sending test ping...', 'info');
        try {
            const res = await window.apiFetch(window.API_CONFIG.ENDPOINTS.webhooks.test, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ endpointId: id })
            });
            const data = await res.json();

            if (data.success) {
                showToast('Test event sent successfully!', 'success');
            } else {
                showToast(data.message || 'Failed to send test event', 'error');
            }
        } catch (error) {
            console.error('Error testing webhook:', error);
            showToast('Error sending test event', 'error');
        }
    };

    // ─── COPY SECRET ───
    window.copySecret = function (id) {
        const ep = _endpoints.find(e => e.id === id);
        if (!ep) return;

        navigator.clipboard.writeText(ep.secret).then(() => {
            showToast('Webhook secret copied! Use this to verify signatures.', 'success');
        }).catch(() => {
            const temp = document.createElement('textarea');
            temp.value = ep.secret;
            document.body.appendChild(temp);
            temp.select();
            document.execCommand('copy');
            document.body.removeChild(temp);
            showToast('Webhook secret copied!', 'success');
        });
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

    // ─── INIT ───
    document.addEventListener('DOMContentLoaded', () => {
        loadEndpoints();

        // Reveal animation
        const revealObs = new IntersectionObserver(entries => {
            entries.forEach(e => {
                if (e.isIntersecting) {
                    e.target.classList.add('vis');
                    revealObs.unobserve(e.target);
                }
            });
        }, { threshold: 0.08 });
        document.querySelectorAll('.zd-rv').forEach(el => revealObs.observe(el));

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

    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('wh-modal-overlay')) closeModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeModal();
    });

})();
