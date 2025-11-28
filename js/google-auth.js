// Google OAuth Sign-In (Google Identity Services)
const GOOGLE_CLIENT_ID = 'YOUR_GOOGLE_CLIENT_ID'; // TODO: Replace with your actual client ID

function handleGoogleSignIn() {
	google.accounts.id.initialize({
		client_id: GOOGLE_CLIENT_ID,
		callback: handleGoogleCredentialResponse
	});
	google.accounts.id.prompt();
}

function handleGoogleCredentialResponse(response) {
	// Send credential to backend for verification
	apiFetch('/api/v1/auth/google', {
		method: 'POST',
		body: JSON.stringify({ credential: response.credential })
	})
	.then(async res => {
		const result = await res.json();
		if (res.ok && result.success && result.data) {
			// Save token/user info as needed
			if (result.data.token) {
				localStorage.setItem('token', result.data.token);
				localStorage.setItem('authToken', result.data.token);
			}
			if (result.data.refreshToken) {
				localStorage.setItem('refreshToken', result.data.refreshToken);
				localStorage.setItem('authRefreshToken', result.data.refreshToken);
			}
			if (result.data.user) {
				localStorage.setItem('user', JSON.stringify(result.data.user));
			}
			// Redirect by role
			const role = result.data.user && result.data.user.role;
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
		alert('Google login error: ' + err.message);
	});
}
