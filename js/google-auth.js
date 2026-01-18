// Google OAuth Sign-In (Popup Flow)
const GOOGLE_CLIENT_ID = '177412712756-es0cdrhb0cpk3462f69o4qjgnveag4jn.apps.googleusercontent.com'; // Actual Client ID
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
	const baseUrl = window.apiBaseUrl || '';
	fetch(baseUrl + '/api/v1/auth/google', {
		method: 'POST',
		headers: { 'Content-Type': 'application/json' },
		body: JSON.stringify({ accessToken: accessToken })
	})
		.then(async res => {
			const result = await res.json();
			if (res.ok && result.success && result.data) {
				// Save token/user info
				if (result.data.token) {
					localStorage.setItem('token', result.data.token);
					localStorage.setItem('authToken', result.data.token);
				}
				if (result.data.refreshToken) {
					localStorage.setItem('refreshToken', result.data.refreshToken);
				}
				if (result.data.user) {
					localStorage.setItem('user', JSON.stringify(result.data.user));
				}

				// Redirect based on role
				const role = result.data.user.role;
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
