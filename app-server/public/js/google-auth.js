// Google OAuth Sign-In (Popup Flow)
const GOOGLE_CLIENT_ID = '811815196850-rvb15n3t7sr6qjg34a0k735kr2gjsivp.apps.googleusercontent.com';
let tokenClient;

// Show a non-blocking toast message instead of alert()
function showGoogleToast(msg, isError) {
	let toast = document.getElementById('google-toast');
	if (!toast) {
		toast = document.createElement('div');
		toast.id = 'google-toast';
		toast.style.cssText = 'position:fixed;top:24px;left:50%;transform:translateX(-50%);z-index:99999;padding:14px 28px;border-radius:12px;font-size:14px;font-weight:500;color:#fff;box-shadow:0 8px 32px rgba(0,0,0,0.3);transition:opacity 0.3s,transform 0.3s;opacity:0;transform:translateX(-50%) translateY(-20px);';
		document.body.appendChild(toast);
	}
	toast.style.background = isError ? 'linear-gradient(135deg,#ef4444,#dc2626)' : 'linear-gradient(135deg,#7c3aed,#6366f1)';
	toast.textContent = msg;
	toast.style.opacity = '1';
	toast.style.transform = 'translateX(-50%) translateY(0)';
	setTimeout(() => {
		toast.style.opacity = '0';
		toast.style.transform = 'translateX(-50%) translateY(-20px)';
	}, 4000);
}

// Initialize Token Client on load
function initGoogleAuth() {
	if (typeof google === 'undefined') return;
	tokenClient = google.accounts.oauth2.initTokenClient({
		client_id: GOOGLE_CLIENT_ID,
		scope: 'https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
		callback: (tokenResponse) => {
			if (tokenResponse && tokenResponse.access_token) {
				handleGoogleCallback(tokenResponse.access_token);
			}
		},
	});
}

// Triggered by button click
function handleGoogleSignIn() {
	if (!tokenClient) {
		initGoogleAuth();
	}
	if (tokenClient) {
		tokenClient.requestAccessToken();
	} else {
		showGoogleToast('Google Sign-In is not available. Please use email login.', true);
	}
}

// Handle success callback
function handleGoogleCallback(accessToken) {
	const path = '/api/v1/auth/google';
	const req = window.apiFetch
		? window.apiFetch(path, { method: 'POST', body: JSON.stringify({ accessToken }) })
		: fetch(path, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ accessToken })
		});

	req.then(async res => {
		const result = await res.json();
		if (res.ok && result.success) {
			if (result.status === 'REQUIRE_COMPLETION') {
				sessionStorage.setItem('tempGoogleToken', result.data.tempToken);
				window.location.href = '/complete-profile.html';
				return;
			}

			if (result.data) {
				if (result.data.token || result.token) {
					const finalToken = result.data.token || result.token;
					localStorage.setItem('token', finalToken);
					localStorage.setItem('authToken', finalToken);
				}
				if (result.data.refreshToken) {
					localStorage.setItem('refreshToken', result.data.refreshToken);
				}
				if (result.data.user) {
					localStorage.setItem('user', JSON.stringify(result.data.user));
				}
			}

			const role = result.data?.user?.role || 'user';
			if (role === 'admin') {
				window.location.href = '/admin-dashboard.html';
			} else {
				window.location.href = '/dashboard.html';
			}
		} else {
			showGoogleToast(result.error?.message || result.message || 'Google login failed', true);
		}
	})
		.catch(err => {
			console.warn('Google login error:', err.message);
			showGoogleToast('Google Sign-In is temporarily unavailable. Please use email login.', true);
		});
}

// Auto-init when script loads (if GIS is ready)
window.addEventListener('load', () => {
	let attempts = 0;
	const checkGoogle = setInterval(() => {
		attempts++;
		if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
			initGoogleAuth();
			clearInterval(checkGoogle);
		} else if (attempts > 20) {
			console.warn("Google Auth library failed to load within 10 seconds.");
			clearInterval(checkGoogle);
		}
	}, 500);
});
