// Google OAuth Sign-In (Popup Flow)
const GOOGLE_CLIENT_ID = '908736098316-3b1itv1mt4jvvavtpdj7i7ptmvk8ethl.apps.googleusercontent.com';
let tokenClient;

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
		alert('Google Auth library not loaded yet. Please try again.');
	}
}

// Handle success callback
function handleGoogleCallback(accessToken) {
	const path = '/api/v1/auth/google';
	const req = window.apiFetch
		? window.apiFetch(path, { method: 'POST', body: JSON.stringify({ accessToken }) })
		: fetch(((window.API_CONFIG && window.API_CONFIG.BASE_URL) || 'http://localhost:3000') + path, {
			method: 'POST',
			headers: { 'Content-Type': 'application/json' },
			body: JSON.stringify({ accessToken })
		});

	req.then(async res => {
		const result = await res.json();
		if (res.ok && result.success) {
			if (result.status === 'REQUIRE_COMPLETION') {
				// User does not exist, redirect to complete profile
				sessionStorage.setItem('tempGoogleToken', result.data.tempToken);
				window.location.href = '/complete-profile.html';
				return;
			}

			// Standard Login Success (User exists)
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

			// Redirect based on role
			const role = result.data?.user?.role || 'user';
			if (role === 'admin') {
				window.location.href = '/admin-dashboard.html';
			} else {
				window.location.href = '/dashboard.html';
			}
		} else {
			alert(result.error?.message || result.message || 'Google login failed');
		}
	})
		.catch(err => {
			console.error(err);
			alert('Google login error: ' + err.message);
		});
}

// Auto-init when script loads (if GIS is ready)
window.onload = () => {
	// Wait for GIS script
	const checkGoogle = setInterval(() => {
		if (typeof google !== 'undefined' && google.accounts && google.accounts.oauth2) {
			initGoogleAuth();
			clearInterval(checkGoogle);
		}
	}, 500);
}
