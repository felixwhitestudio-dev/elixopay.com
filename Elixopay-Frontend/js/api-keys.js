// ═══════════════════════════════════════════════════════
// Elixopay API Keys Page — JavaScript
// ═══════════════════════════════════════════════════════

(function () {
    'use strict';

    let _apiKeys = [];
    const visibility = {};

    // ─── LOAD KEYS FROM API ───
    async function loadKeys() {
        try {
            const res = await window.apiFetch(window.API_CONFIG.ENDPOINTS.apiKeys.list);
            const data = await res.json();
            
            if (data.success) {
                _apiKeys = data.data.apiKeys || [];
                displayKeys();
            } else {
                showToast('Failed to load API keys', 'error');
            }
        } catch (error) {
            console.error('Error loading API keys:', error);
            showToast('Error loading API keys', 'error');
        }
    }

    // ─── RENDER KEYS ───
    function displayKeys() {
        const liveContainer = document.getElementById('liveKeysContainer');
        const testContainer = document.getElementById('testKeysContainer');
        
        liveContainer.innerHTML = '';
        testContainer.innerHTML = '';

        const liveKeys = _apiKeys.filter(k => k.mode === 'live' && k.isActive);
        const testKeys = _apiKeys.filter(k => k.mode === 'test' && k.isActive);

        if (liveKeys.length === 0) {
            liveContainer.innerHTML = '<p style="color: #64748b; margin: 1rem 0;">No active live keys found. Generate one to get started.</p>';
        } else {
            liveKeys.forEach(key => liveContainer.appendChild(createKeyBlock(key)));
        }

        if (testKeys.length === 0) {
            testContainer.innerHTML = '<p style="color: #64748b; margin: 1rem 0;">No active test keys found. Generate one to get started.</p>';
        } else {
            testKeys.forEach(key => testContainer.appendChild(createKeyBlock(key)));
        }
    }

    function createKeyBlock(keyObj) {
        // Initialize visibility state if not exists
        if (visibility[keyObj.id] === undefined) {
            visibility[keyObj.id] = false;
        }

        const block = document.createElement('div');
        block.className = 'ak-key-block';
        
        const isVisible = visibility[keyObj.id];
        const displayValue = isVisible ? keyObj.token : maskKey(keyObj.token);
        const iconClass = isVisible ? 'fas fa-eye-slash' : 'fas fa-eye';
        
        block.innerHTML = `
            <div class="ak-key-label" style="justify-content: space-between; display: flex; width: 100%;">
                <div style="display: flex; gap: 1rem; align-items: flex-start;">
                    <i class="fas fa-server"></i>
                    <div>
                        <strong>${keyObj.name}</strong>
                        <span>Created: ${new Date(keyObj.createdAt).toLocaleDateString()}</span>
                    </div>
                </div>
                <button class="ak-btn outline" style="color: #ef4444; border-color: #ef4444; padding: 4px 8px; font-size: 0.8rem;" onclick="revokeKey('${keyObj.id}')">
                    <i class="fas fa-trash"></i> Revoke
                </button>
            </div>
            <div class="ak-key-row">
                <code id="key-${keyObj.id}" data-value="${keyObj.token}" class="${isVisible ? '' : 'masked'}">${displayValue}</code>
                <button onclick="copyKey('key-${keyObj.id}')" class="ak-copy" title="Copy">
                    <i class="far fa-copy"></i>
                </button>
                <button onclick="toggleKeyVisibility('${keyObj.id}')" class="ak-toggle" title="Show/Hide">
                    <i class="${iconClass}"></i>
                </button>
            </div>
        `;
        
        return block;
    }

    function maskKey(key) {
        return key.substring(0, 10) + '••••••••••••••••••••••••';
    }

    // ─── COPY KEY ───
    window.copyKey = function (id) {
        const el = document.getElementById(id);
        if (!el) return;
        const value = el.dataset.value;

        navigator.clipboard.writeText(value).then(() => {
            showToast('Key copied!', 'success');
        }).catch(() => {
            // Fallback
            const temp = document.createElement('textarea');
            temp.value = value;
            document.body.appendChild(temp);
            temp.select();
            document.execCommand('copy');
            document.body.removeChild(temp);
            showToast('Key copied!', 'success');
        });
    };

    // ─── TOGGLE VISIBILITY ───
    window.toggleKeyVisibility = function (keyId) {
        visibility[keyId] = !visibility[keyId];
        displayKeys(); // Re-render to update UI
    };

    // ─── GENERATE NEW KEY ───
    window.generateNewKey = async function (env) {
        const keyName = prompt(`Enter a name for this new ${env} key:`, `My ${env === 'live' ? 'Production' : 'Test'} Key`);
        if (!keyName) return;

        try {
            const res = await window.apiFetch(window.API_CONFIG.ENDPOINTS.apiKeys.create, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ name: keyName, mode: env })
            });
            const data = await res.json();

            if (data.success) {
                showToast(`${env} Key generated successfully!`, 'success');
                // Auto-show newly generated key
                visibility[data.data.apiKey.id] = true;
                loadKeys(); // Reload list
            } else {
                showToast(data.message || 'Failed to generate key', 'error');
            }
        } catch (error) {
            console.error('Error generating key:', error);
            showToast('Error generating key', 'error');
        }
    };

    // ─── REVOKE KEY ───
    window.revokeKey = async function (keyId) {
        if (!confirm('Are you sure you want to revoke this API Key? Any systems using it will fail immediately.')) {
            return;
        }

        try {
            const res = await window.apiFetch(window.API_CONFIG.ENDPOINTS.apiKeys.revoke(keyId), {
                method: 'DELETE'
            });
            const data = await res.json();

            if (data.success) {
                showToast('API Key revoked successfully.', 'success');
                loadKeys(); // Reload list
            } else {
                showToast(data.message || 'Failed to revoke key', 'error');
            }
        } catch (error) {
            console.error('Error revoking key:', error);
            showToast('Error revoking key', 'error');
        }
    };

    // ─── REGENERATE MODAL (UNUSED NOW) ───
    window.closeRegenModal = function () {
        const modal = document.getElementById('regenModal');
        if (modal) modal.classList.remove('show');
    };

    // ─── COPY CODE EXAMPLE ───
    window.copyCodeExample = function () {
        const code = document.getElementById('codeExample');
        if (!code) return;
        navigator.clipboard.writeText(code.textContent).then(() => {
            showToast('Code copied!', 'success');
        });
    };

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
    }, { threshold: 0.08 });

    // ─── INIT ───
    document.addEventListener('DOMContentLoaded', () => {
        loadKeys();

        document.querySelectorAll('.zd-rv').forEach(el => revealObs.observe(el));

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

    // Close modal on overlay / escape
    document.addEventListener('click', (e) => {
        if (e.target.classList.contains('st-modal-overlay')) closeRegenModal();
    });
    document.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') closeRegenModal();
    });

})();
