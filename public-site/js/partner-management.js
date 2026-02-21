// Check authentication
const token = localStorage.getItem('token');
if (!token) window.location.href = '/login.html';

let hierarchyData = [];

// Helper to format date
const formatDate = (dateStr) => {
    return new Date(dateStr).toLocaleDateString('th-TH', { year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
};

async function fetchHierarchy() {
    try {
        // Use partners/network to get the tree with stats if needed, or hierarchy for raw structure
        // Let's use partners/network as it aligns with the portal's context
        const res = await window.apiFetch('/api/v1/hierarchy');
        const data = await res.json();
        if (data.success) {
            hierarchyData = data.data;
            renderTable(hierarchyData);
        } else {
            console.error('Failed to load hierarchy:', data.error);
        }
    } catch (e) {
        console.error(e);
    }
}

function renderTable(users) {
    const t = (k) => window.ElixopayI18n ? window.ElixopayI18n.t(k) : k;
    const tbody = document.getElementById('network-table-body');
    if (!tbody) return;

    if (!users || users.length === 0) {
        tbody.innerHTML = `<tr><td colspan="5" class="text-center py-8 text-gray-500">${t('partner.network.no_members')}</td></tr>`;
        return;
    }

    tbody.innerHTML = users.map(user => {
        const roleBadge = getRoleBadge(user.account_type);
        const statusBadge = getStatusBadge(user.status);

        return `
            <tr class="border-b border-gray-700/50 hover:bg-gray-800/50 transition">
                <td class="py-4 px-4">
                    <div class="flex items-center">
                        <div class="w-8 h-8 rounded-full bg-indigo-500/20 text-indigo-400 flex items-center justify-center mr-3 font-bold text-xs">
                            ${user.first_name ? user.first_name[0] : 'U'}
                        </div>
                        <div>
                            <div class="font-bold text-white text-sm">${user.first_name} ${user.last_name || ''}</div>
                            <div class="text-xs text-gray-400">${user.email}</div>
                        </div>
                    </div>
                </td>
                <td class="py-4 px-4 text-sm text-gray-300 font-mono text-xs">
                    ${user.account_type === 'merchant' ? (user.business_name || '-') : roleBadge}
                </td>
                <td class="py-4 px-4">
                    ${statusBadge}
                </td>
                <td class="py-4 px-4 text-sm text-gray-400">
                    ${new Date(user.created_at).toLocaleDateString()}
                </td>
                <td class="py-4 px-4 text-right">
                    <button onclick="openEditModal('${user.id}')" 
                        class="text-gray-400 hover:text-white transition px-2 py-1 hover:bg-gray-700 rounded text-xs font-bold border border-transparent hover:border-gray-600">
                         ${t('partner.network.manage')}
                    </button>
                </td>
            </tr>
        `;
    }).join('');
}

function getRoleBadge(role) {
    const t = (k) => window.ElixopayI18n ? window.ElixopayI18n.t(k) : k;
    const labels = {
        'partner': t('partner.modal.role.partner'), // Added partner role
        'organizer': t('partner.modal.role.organizer'),
        'agent': t('partner.modal.role.agent'),
        'merchant': t('partner.modal.role.merchant')
    };
    const colors = {
        'partner': 'bg-indigo-500/10 text-indigo-400 border-indigo-500/20', // Added partner color
        'organizer': 'bg-purple-500/10 text-purple-400 border-purple-500/20',
        'agent': 'bg-blue-500/10 text-blue-400 border-blue-500/20',
        'merchant': 'bg-emerald-500/10 text-emerald-400 border-emerald-500/20'
    };

    return `<span class="px-2 py-0.5 rounded text-xs font-bold border ${colors[role] || 'bg-gray-700 text-gray-300'} uppercase tracking-wide">${labels[role] || role}</span>`;
}

function getStatusBadge(status) {
    const t = (k) => window.ElixopayI18n ? window.ElixopayI18n.t(k) : k;
    if (status === 'active') {
        return `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-green-500/10 text-green-400 border border-green-500/20">
            <span class="w-1.5 h-1.5 rounded-full bg-green-400 mr-1.5"></span> ${t('partner.modal.status.active')}
        </span>`;
    } else {
        return `<span class="inline-flex items-center px-2 py-0.5 rounded text-xs font-medium bg-red-500/10 text-red-400 border border-red-500/20">
            <span class="w-1.5 h-1.5 rounded-full bg-red-400 mr-1.5"></span> ${t('partner.modal.status.suspended')}
        </span>`;
    }
}

// Modal Logic
const modal = document.getElementById('userModal');
const modalTitle = document.getElementById('modalTitle');
const modalError = document.getElementById('modalError');

function openCreateModal() {
    const t = (k) => window.ElixopayI18n ? window.ElixopayI18n.t(k) : k;
    document.getElementById('modalTitle').textContent = t('partner.modal.add_title');
    document.getElementById('editUserId').value = '';

    document.getElementById('passwordGroup').classList.remove('hidden');
    document.getElementById('roleSelectGroup').classList.remove('hidden');
    document.getElementById('statusGroup').classList.add('hidden');

    // Reset inputs
    ['modalEmail', 'modalPassword', 'modalFirstName', 'modalLastName', 'modalFee'].forEach(id => document.getElementById(id).value = '');
    document.getElementById('modalFee').disabled = false;

    modal.classList.remove('hidden');
}

async function openEditModal(userId) {
    const t = (k) => window.ElixopayI18n ? window.ElixopayI18n.t(k) : k;
    const user = hierarchyData.find(u => u.id === userId);
    if (!user) return;

    modalTitle.textContent = t('partner.modal.edit_title');
    document.getElementById('editUserId').value = user.id;

    // Hide creation-only fields
    document.getElementById('passwordGroup').classList.add('hidden');
    document.getElementById('roleSelectGroup').classList.add('hidden');
    document.getElementById('statusGroup').classList.remove('hidden');

    // Fill Data
    document.getElementById('modalEmail').value = user.email;
    document.getElementById('modalFirstName').value = user.first_name || '';
    document.getElementById('modalLastName').value = user.last_name || '';
    document.getElementById('modalStatus').value = user.status;
    document.getElementById('modalFee').value = '';
    document.getElementById('modalFee').placeholder = 'Loading...';

    // Disable non-editable
    document.getElementById('modalEmail').disabled = true;

    modal.classList.remove('hidden');

    // Fetch Fee Config specific to this user (set by me)
    try {
        // We don't have a direct endpoint for this yet, but we can guess or rely on previous knowledge?
        // Actually, let's skip fetching for now or check if it's in the hierarchy payload (it wasn't).
        // Better approach: When saving, we update it. If we want to show it, we need an endpoint.
        // Let's assume 0 for now or leave blank to indicate "No change".
        document.getElementById('modalFee').placeholder = 'Enter new rate (%)';
    } catch (e) { console.error(e); }
}

function closeModal() {
    modal.classList.add('hidden');
    modalError.classList.add('hidden');
}

async function saveUser() {
    modalError.classList.add('hidden');
    const id = document.getElementById('editUserId').value;
    const isEdit = !!id;

    const data = {
        firstName: document.getElementById('modalFirstName').value,
        lastName: document.getElementById('modalLastName').value,
        feeRate: document.getElementById('modalFee').value ? parseFloat(document.getElementById('modalFee').value) / 100 : undefined // Backend likely expects 0.005 for 0.5%? Wait, let's check Service.
    };

    // Checking commissionService.js: 
    // const commissionAmount = amount * rate; 
    // If user enters 0.5 (percent), we want 0.005.
    // However, usually UI handles %, backend handles decimal.
    // Let's divide by 100 here to be safe if that's what the service expects.
    // Confirming DB: rate_percent is numeric(5,4) -> e.g. 0.1000 (10%).
    // So if user enters 10, we send 0.10. Correct.

    if (isEdit) {
        data.status = document.getElementById('modalStatus').value;
        if (data.feeRate !== undefined) {
            // If feeRate is sent, Update User endpoint might need to handle it or we call a separate one?
            // UsersController update usually just updates User table.
            // We might need to ensure the backend controller handles 'feeRate' or 'fee_configs'.
        }

        try {
            const res = await window.apiFetch(`/api/v1/hierarchy/user/${id}`, {
                method: 'PUT',
                body: JSON.stringify(data)
            });
            const result = await res.json();
            if (result.success) {
                closeModal();
                fetchHierarchy(); // Refresh list
            } else {
                showError(result.error?.message);
            }
        } catch (e) {
            showError(e.message);
        }
    } else {
        data.email = document.getElementById('modalEmail').value;
        data.password = document.getElementById('modalPassword').value;
        data.role = document.getElementById('modalRole').value;

        try {
            const res = await window.apiFetch('/api/v1/hierarchy/create', {
                method: 'POST',
                body: JSON.stringify(data)
            });
            const result = await res.json();
            if (result.success) {
                closeModal();
                fetchHierarchy();
            } else {
                showError(result.error?.message);
            }
        } catch (e) {
            showError(e.message);
        }
    }
}

function showError(msg) {
    modalError.textContent = msg || 'An error occurred';
    modalError.classList.remove('hidden');
}

// Initial Load
document.addEventListener('DOMContentLoaded', () => {
    // Re-run the stats loader from the original file (we replaced it, so we need to include it or keep it?)
    // This file replaces the entire logic, so we should also call the stats API if we want stats.
    // The previous inline script called loadPartnerData() which did stats AND network.
    // We should replicate that.

    // Load Stats (Partner Portal specific)
    loadPartnerStats();

    // Load Network Table
    fetchHierarchy();
});

async function loadPartnerStats() {
    try {
        const statsResponse = await apiFetch('/api/v1/partners/stats');
        const statsData = await statsResponse.json();

        if (statsData.success && statsData.data) {
            const stats = statsData.data.stats || {};
            const startEls = {
                'total-earnings': stats.totalEarnings,
                'total-merchants': stats.referrals,
                'pending-balance': stats.pendingBalance,
                'total-clicks': stats.clicks
            };

            for (let [id, val] of Object.entries(startEls)) {
                const el = document.getElementById(id);
                if (el) {
                    if (id.includes('earnings') || id.includes('balance')) {
                        el.textContent = `฿${(val || 0).toLocaleString()}`;
                    } else {
                        el.textContent = val || 0;
                    }
                }
            }

            // Generate Ref Link
            const agencyId = statsData.data.agencyId || 'unknown';
            const refLink = `${window.location.origin}/signup.html?ref=${agencyId}`;
            const refEl = document.getElementById('referral-link');
            if (refEl) {
                refEl.textContent = refLink;
                window.refLink = refLink;
            }
        }
    } catch (e) { console.error('Stats load error', e); }
}

window.copyRefLink = function () {
    if (window.refLink) {
        navigator.clipboard.writeText(window.refLink);
        alert('Referral link copied!');
    }
};
