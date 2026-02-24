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

        if (!response) {
            throw new Error('การเชื่อมต่อล้มเหลว หรือ เซสชั่นหมดอายุ');
        }

        const data = await response.json();

        if (response.ok && data.success) {
            // --- Handle 2FA required ---
            if (data.status === 'REQUIRE_2FA') {
                const { tempToken, email: userEmail } = data.data;
                const { value: totpCode } = await Swal.fire({
                    title: '🔐 Two-Factor Authentication',
                    html: `
                        <p style="margin-bottom:12px;color:#6b7280;">กรุณากรอกรหัส 6 หลักจากแอป Authenticator ของคุณ</p>
                        <input id="totp-input" type="text" inputmode="numeric" maxlength="6" pattern="[0-9]*"
                            autocomplete="one-time-code"
                            placeholder="000000"
                            style="text-align:center;font-size:28px;letter-spacing:8px;padding:12px;width:200px;border:2px solid #e5e7eb;border-radius:12px;outline:none;font-family:monospace;"
                            onfocus="this.style.borderColor='#635BFF'"
                            onblur="this.style.borderColor='#e5e7eb'">
                    `,
                    focusConfirm: false,
                    showCancelButton: true,
                    confirmButtonText: 'ยืนยัน',
                    cancelButtonText: 'ยกเลิก',
                    confirmButtonColor: '#635BFF',
                    preConfirm: () => {
                        const code = document.getElementById('totp-input').value;
                        if (!code || code.length !== 6) {
                            Swal.showValidationMessage('กรุณากรอกรหัส 6 หลัก');
                            return false;
                        }
                        return code;
                    },
                    didOpen: () => {
                        const inp = document.getElementById('totp-input');
                        if (inp) inp.focus();
                    }
                });

                if (!totpCode) {
                    // User cancelled
                    return;
                }

                // Validate 2FA code
                const twoFaRes = await window.apiFetch('/api/v1/auth/2fa/validate', {
                    method: 'POST',
                    body: JSON.stringify({ email: userEmail, token: totpCode, tempToken })
                });
                const twoFaData = await twoFaRes.json();

                if (twoFaRes.ok && twoFaData.success) {
                    const finalToken = twoFaData.token || (twoFaData.data && twoFaData.data.token);
                    localStorage.setItem('token', finalToken);
                    if (twoFaData.data && twoFaData.data.user) {
                        localStorage.setItem('user', JSON.stringify(twoFaData.data.user));
                    }
                    window.location.href = '/dashboard.html';
                } else {
                    errorMsg.textContent = twoFaData.message || 'รหัส 2FA ไม่ถูกต้อง';
                    errorBox.classList.remove('hidden');
                }
                return;
            }

            // --- Normal login (no 2FA) ---
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
                errorMsg.innerHTML = 'ไม่พบผู้ใช้งานนี้ในระบบ';
            } else if (response.status === 401) {
                errorMsg.innerHTML = 'รหัสผ่านไม่ถูกต้อง';
            } else if (response.status === 403 && data.status === 'UNVERIFIED') {
                errorMsg.innerHTML = `
                    บัญชีของคุณยังไม่ได้ยืนยันอีเมล กรุณาตรวจสอบกล่องจดหมายของคุณ<br>
                    <button type="button" onclick="resendVerification('${email}')" class="mt-2 px-3 py-1 bg-purple-100 text-purple-700 hover:bg-purple-200 rounded text-sm font-medium transition">
                        ส่ิงอีเมลยืนยันอีกครั้ง
                    </button>
                `;
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

window.resendVerification = async function (email) {
    Swal.fire({
        title: 'กำลังส่งอีเมล...',
        allowOutsideClick: false,
        didOpen: () => {
            Swal.showLoading();
        }
    });

    try {
        const response = await window.apiFetch(window.API_CONFIG.ENDPOINTS.auth.resendVerification || '/api/v1/auth/resend-verification', {
            method: 'POST',
            body: JSON.stringify({ email })
        });
        const data = await response.json();

        if (response.ok && data.success) {
            Swal.fire({
                icon: 'success',
                title: 'ส่งอีเมลแล้ว!',
                text: 'กรุณาตรวจสอบกล่องจดหมาย หรือ Junk Folder ของคุณ',
                confirmButtonColor: '#635BFF'
            });
        } else {
            throw new Error(data.message || 'ส่งอีเมลไม่สำเร็จ');
        }
    } catch (err) {
        Swal.fire({
            icon: 'error',
            title: 'ผิดพลาด',
            text: err.message,
            confirmButtonColor: '#635BFF'
        });
    }
};

// Initialization
document.addEventListener('DOMContentLoaded', () => {
    // Initial spinner hide just in case
    const spin = document.getElementById('login-spinner');
    if (spin) spin.classList.add('hidden');
});
