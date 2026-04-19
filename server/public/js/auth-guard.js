(function () {
    // Hide page until auth completes to prevent content flash
    const root = document.documentElement;
    const prevVisibility = root.style.visibility;
    root.style.visibility = 'hidden';

    const requiredRole = document.currentScript && document.currentScript.getAttribute('data-require-role');
    const redirectLogin = () => {
        ['token', 'user'].forEach(k => localStorage.removeItem(k));
        window.location.replace('/login.html');
    };

    apiFetch(API_CONFIG.ENDPOINTS.auth.me)
        .then(resp => {
            if (!resp || !resp.ok) throw new Error('Auth check failed');
            return resp.json();
        })
        .then(data => {
            const user = data && data.data && data.data.user;
            if (!user) throw new Error('User missing in response');
            localStorage.setItem('user', JSON.stringify(user));

            if (requiredRole) {
                if (user.role?.toLowerCase() === 'admin') {
                    // Admin can access everything
                } else if (user.role === requiredRole) {
                    // Exact match
                } else if (requiredRole === 'user' && ['merchant', 'partner', 'organizer', 'agent'].includes(user.role)) {
                    // Hierarchy roles can access basic user pages
                } else {
                    console.warn('Role mismatch. Required:', requiredRole, 'Got:', user.role);
                    return redirectLogin();
                }
            }

            const nameEl = document.getElementById('user-name');
            if (nameEl) nameEl.textContent = `👋 ${user.name || user.email || 'User'}`;

            // Notify page scripts that auth is ready
            try { window.dispatchEvent(new CustomEvent('auth:ready', { detail: user })); } catch (_) { }
        })
        .catch(err => {
            console.warn('Auth guard redirecting:', err.message);
            return redirectLogin();
        })
        .finally(() => {
            // Reveal page content if we didn't redirect
            // If redirecting, the navigation will replace document soon
            root.style.visibility = prevVisibility || 'visible';
        });
})();
/**
 * security-utils.js
 * Frontend security utilities for Elixopay Payment Gateway
 * Implements Re-authentication for sensitive actions and Idle Timeout tracking.
 */

window.ElixopaySecurity = {
    /**
     * Prompts the user to re-enter their password for a sensitive action.
     * @param {Function} actionCallback - The function to execute if authentication succeeds.
     * @param {string} actionDescription - Description of the action for the prompt (e.g., "Request Payout").
     */
    promptReauth: function (actionDescription = 'perform this sensitive action') {
        return new Promise(async (resolve, reject) => {
            const titleText = window.ElixopayI18n ? window.ElixopayI18n.t('security.reauth_title') || 'Security Verification' : 'Security Verification';
            const descText = window.ElixopayI18n
                ? window.ElixopayI18n.t('security.reauth_desc') || `Please verify your password to ${actionDescription}.`
                : `Please verify your password to ${actionDescription}.`;
            const pwdPlaceholder = window.ElixopayI18n ? window.ElixopayI18n.t('auth.password') || 'Password' : 'Password';
            const btnConfirm = window.ElixopayI18n ? window.ElixopayI18n.t('common.verify') || 'Verify' : 'Verify';
            const btnCancel = window.ElixopayI18n ? window.ElixopayI18n.t('common.cancel') || 'Cancel' : 'Cancel';

            const { value: password, isConfirmed } = await Swal.fire({
                title: `<span style="color: #f1f5f9;">${titleText}</span>`,
                html: `
                    <p style="color: #94a3b8; font-size: 0.9rem; margin-bottom: 20px;">${descText}</p>
                    <input type="password" id="reauth-password" class="swal2-input" placeholder="${pwdPlaceholder}" style="background: rgba(15, 23, 42, 0.5); border-color: #334155; color: white;">
                `,
                background: '#1e293b',
                showCancelButton: true,
                confirmButtonText: btnConfirm,
                cancelButtonText: btnCancel,
                confirmButtonColor: '#6366f1', // Indigo primary
                cancelButtonColor: '#475569',
                focusConfirm: false,
                preConfirm: () => {
                    const pwd = Swal.getPopup().querySelector('#reauth-password').value;
                    if (!pwd) {
                        Swal.showValidationMessage(`Please enter your password`);
                    }
                    return pwd;
                }
            });

            if (isConfirmed && password) {
                Swal.showLoading();

                try {
                    // Call backend to verify password
                    const response = await window.apiFetch('/api/v1/auth/verify-password', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({ password })
                    });

                    const result = await response.json();

                    if (result.success) {
                        // Password verified, resolve promise
                        Swal.close();
                        resolve(result.data?.actionToken);
                    } else {
                        Swal.fire({
                            icon: 'error',
                            title: 'Verification Failed',
                            text: result.error?.message || 'Incorrect password.',
                            background: '#1e293b',
                            color: 'white',
                            confirmButtonColor: '#6366f1'
                        }).then(() => reject(new Error('Incorrect password')));
                    }
                } catch (error) {
                    console.error('Re-auth error:', error);
                    Swal.fire({
                        icon: 'error',
                        title: 'Error',
                        text: 'An error occurred during verification. Please try again.',
                        background: '#1e293b',
                        color: 'white'
                    }).then(() => reject(error));
                }
            } else {
                reject(new Error('Verification cancelled'));
            }
        });
    },

    /**
     * Initializes the Idle Timeout tracker.
     * Logs the user out if no activity is detected for `timeoutMinutes`.
     * Shows a warning 1 minute before logging out.
     */
    initIdleTimeout: function (timeoutMinutes = 15) {
        let timeoutTimer;
        let warningTimer;

        const timeoutMs = timeoutMinutes * 60 * 1000;
        const warningMs = Math.max(0, timeoutMs - (60 * 1000)); // Warn 1 minute before

        let isWarningOpen = false;

        const logout = () => {
            console.log('Idle timeout reached. Logging out.');
            ['token', 'user', 'authToken'].forEach(k => localStorage.removeItem(k));
            window.location.replace('/login.html?expired=1');
        };

        const showWarning = () => {
            isWarningOpen = true;

            const titleText = window.ElixopayI18n ? window.ElixopayI18n.t('security.timeout_title') || 'Session Expiring Soon' : 'Session Expiring Soon';
            const descText = window.ElixopayI18n
                ? window.ElixopayI18n.t('security.timeout_desc') || 'Your session will expire in 60 seconds due to inactivity.'
                : 'Your session will expire in 60 seconds due to inactivity.';

            let timeLeft = 60;

            Swal.fire({
                title: `<span style="color: #f1f5f9; font-size: 1.25rem;">${titleText}</span>`,
                html: `<p style="color: #94a3b8; margin: 10px 0;">${descText}</p>
                       <div style="font-size: 2rem; font-weight: bold; color: #f59e0b; margin: 15px 0;" id="timeout-countdown">${timeLeft}</div>`,
                icon: 'warning',
                background: '#1e293b',
                color: 'white',
                confirmButtonText: 'Keep Session Active',
                confirmButtonColor: '#10b981',
                allowOutsideClick: false,
                allowEscapeKey: false,
                didOpen: () => {
                    const timerInterval = setInterval(() => {
                        timeLeft--;
                        const display = Swal.getPopup().querySelector('#timeout-countdown');
                        if (display) display.textContent = timeLeft;

                        if (timeLeft <= 0) {
                            clearInterval(timerInterval);
                            Swal.close();
                            logout();
                        }
                    }, 1000);

                    // Attach interval id to swal so we can clear it if they click "Keep Active"
                    Swal.getPopup().dataset.intervalId = timerInterval;
                },
                willClose: () => {
                    const popup = Swal.getPopup();
                    if (popup && popup.dataset.intervalId) {
                        clearInterval(popup.dataset.intervalId);
                    }
                }
            }).then((result) => {
                isWarningOpen = false;
                if (result.isConfirmed) {
                    resetTimers(); // User chose to stay logged in

                    // Optional: hit a backend /refresh endpoint here if JWT needs extending
                    if (window.apiFetch) {
                        window.apiFetch('/api/v1/auth/refresh', { method: 'POST', _triedRefresh: true })
                            .catch(e => console.warn('Refresh failed', e));
                    }
                }
            });
        };

        const resetTimers = () => {
            if (isWarningOpen) return; // Don't reset if the warning is showing

            clearTimeout(timeoutTimer);
            clearTimeout(warningTimer);

            warningTimer = setTimeout(showWarning, warningMs);
            timeoutTimer = setTimeout(logout, timeoutMs);
        };

        // Standard DOM events to track activity
        const events = ['mousemove', 'keydown', 'mousedown', 'touchstart', 'scroll'];

        // Throttled event listener so we don't reset timers thousands of times per second
        let throttleTimer;
        const activityHandler = () => {
            if (throttleTimer) return;
            throttleTimer = setTimeout(() => {
                resetTimers();
                throttleTimer = null;
            }, 1000); // 1 second throttle
        };

        events.forEach(event => {
            document.addEventListener(event, activityHandler, { passive: true });
        });

        // Initialize timers
        resetTimers();
        console.log(`Security: Idle timeout initialized (${timeoutMinutes}m)`);
    }
};

// Initialize idle timeout globally if user is logged in
document.addEventListener('DOMContentLoaded', () => {
    const user = localStorage.getItem('user');
    const token = localStorage.getItem('token') || localStorage.getItem('authToken');

    // Only run on non-public pages where user is authenticated
    if (user && token && !window.location.pathname.includes('login') && !window.location.pathname.includes('signup')) {
        // Init with 15 minutes timeout
        window.ElixopaySecurity.initIdleTimeout(15);
    }
});
