// Helper Functions
function togglePassword() {
    const input = document.getElementById('password');
    const eye = document.getElementById('eye-icon');
    const eyeOff = document.getElementById('eye-off-icon');
    if (input.type === 'password') {
        input.type = 'text';
        eye.classList.add('hidden');
        eyeOff.classList.remove('hidden');
    } else {
        input.type = 'password';
        eye.classList.remove('hidden');
        eyeOff.classList.add('hidden');
    }
}

function clearError(field) {
    const errField = document.getElementById(field + '-error');
    if (errField) errField.classList.add('hidden');
    const formErr = document.getElementById('form-error');
    if (formErr) formErr.classList.add('hidden');
}

function showForgotPassword(event) {
    event.preventDefault();
    alert('โปรดติดต่อ support@elixopay.com หรือใช้ฟีเจอร์ "ลืมรหัสผ่าน" (จะมีในเวอร์ชันถัดไป)');
}

// Handle Standard Login
window.handleLogin = async function (event) {
    event.preventDefault();
    const email = document.getElementById('email').value.trim();
    const password = document.getElementById('password').value;
    const btn = document.getElementById('login-btn');
    const spinner = document.getElementById('login-spinner');
    const errorBox = document.getElementById('form-error');
    const errorMsg = document.getElementById('form-error-message');

    if (errorBox) errorBox.classList.add('hidden');
    btn.disabled = true;
    spinner.classList.remove('hidden');

    try {
        // Use apiFetch to support Demo Mode interception
        // Ensure API_CONFIG is loaded
        if (!window.API_CONFIG) {
            throw new Error("API Config not loaded");
        }

        const response = await window.apiFetch(window.API_CONFIG.ENDPOINTS.auth.login, {
            method: 'POST',
            body: JSON.stringify({ email, password })
        });

        const data = await response.json();

        if (response.ok && data.success) {
            // Support both top-level token and nested data.token
            const token = data.token || (data.data && data.data.token);

            if (token) {
                localStorage.setItem('token', token);
                // Also save user data if available
                const user = data.data && data.data.user ? data.data.user : (data.user || null);
                if (user) {
                    localStorage.setItem('user', JSON.stringify(user));
                }

                // Redirect
                const urlParams = new URLSearchParams(window.location.search);
                const redirect = urlParams.get('redirect');
                if (redirect) {
                    try {
                        const targetUrl = new URL(redirect, window.location.origin);
                        if (targetUrl.origin === window.location.origin) {
                            window.location.href = redirect;
                        } else {
                            window.location.href = '/dashboard.html';
                        }
                    } catch (e) {
                        window.location.href = '/dashboard.html';
                    }
                } else {
                    window.location.href = '/dashboard.html';
                }
            } else {
                // Show error but success=true? rare case
                errorMsg.textContent = 'เกิดผิดพลาดในการล็อกอิน';
                errorBox.classList.remove('hidden');
            }
        } else {
            // Show error
            errorMsg.textContent = data.message || 'อีเมลหรือรหัสผ่านไม่ถูกต้อง';

            // Handle "User not found" specifically if needed
            if (response.status === 404) {
                errorMsg.textContent = 'ไม่พบผู้ใช้งานนี้ในระบบ';
            } else if (response.status === 401) {
                errorMsg.textContent = 'รหัสผ่านไม่ถูกต้อง';
            }

            errorBox.classList.remove('hidden');
        }
    } catch (e) {
        console.error(e);
        errorMsg.textContent = 'เกิดข้อผิดพลาดในการเชื่อมต่อเซิร์ฟเวอร์: ' + e.message;
        errorBox.classList.remove('hidden');
    } finally {
        if (btn) btn.disabled = false;
        if (spinner) spinner.classList.add('hidden');
    }
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    // Initial spinner hide just in case
    const spin = document.getElementById('login-spinner');
    if (spin) spin.classList.add('hidden');
});
