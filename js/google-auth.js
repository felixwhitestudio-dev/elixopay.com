// Google OAuth Configuration
(function() {
  // Replace with your actual Google Client ID
  const GOOGLE_CLIENT_ID = 'YOUR_CLIENT_ID_HERE.apps.googleusercontent.com';
  
  window.GoogleAuth = {
    clientId: GOOGLE_CLIENT_ID,
    
    // Initialize Google Sign-In
    init: function() {
      console.log('🔐 Initializing Google Sign-In...');
      
      // Load Google API
      const script = document.createElement('script');
      script.src = 'https://accounts.google.com/gsi/client';
      script.async = true;
      script.defer = true;
      script.onload = () => {
        console.log('✅ Google Sign-In API loaded');
        this.renderButton();
      };
      document.head.appendChild(script);
    },
    
    // Render Google Sign-In button
    renderButton: function() {
      const buttonContainer = document.getElementById('google-signin-button');
      if (!buttonContainer) {
        console.warn('⚠️ Google Sign-In button container not found');
        return;
      }
      
      // Initialize Google Sign-In
      if (typeof google !== 'undefined') {
        google.accounts.id.initialize({
          client_id: this.clientId,
          callback: this.handleCredentialResponse.bind(this),
          auto_select: false,
          cancel_on_tap_outside: true
        });
        
        // Render the button
        google.accounts.id.renderButton(
          buttonContainer,
          {
            theme: 'outline',
            size: 'large',
            width: buttonContainer.offsetWidth,
            text: 'signin_with',
            shape: 'rectangular',
            logo_alignment: 'left'
          }
        );
        
        console.log('✅ Google Sign-In button rendered');
      }
    },
    
    // Handle Google Sign-In response
    handleCredentialResponse: async function(response) {
      console.log('🔐 Google Sign-In credential received');
      
      try {
        // Show loading state
        const btn = document.querySelector('#google-signin-button button');
        if (btn) {
          btn.disabled = true;
          btn.innerHTML = '<span class="spinner-border spinner-border-sm mr-2"></span>กำลังเข้าสู่ระบบ...';
        }
        
        // Send credential to backend for verification
        const apiResponse = await fetch(apiUrl('/api/v1/auth/google'), {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json'
          },
          body: JSON.stringify({
            credential: response.credential
          })
        });
        
        const result = await apiResponse.json();
        
        if (apiResponse.ok && result.success && result.data && result.data.token) {
          // Save tokens
          localStorage.setItem('token', result.data.token);
          localStorage.setItem('authToken', result.data.token);
          
          if (result.data.refreshToken) {
            localStorage.setItem('refreshToken', result.data.refreshToken);
            localStorage.setItem('authRefreshToken', result.data.refreshToken);
          }
          
          // Save user data
          localStorage.setItem('user', JSON.stringify(result.data.user));
          
          console.log('✅ Google Sign-In successful');
          
          // Redirect to dashboard
          window.location.href = '/dashboard.html';
        } else {
          // Handle error
          const errorMsg = result.error?.message || result.message || 'เกิดข้อผิดพลาดในการเข้าสู่ระบบด้วย Google';
          console.error('❌ Google Sign-In error:', errorMsg);
          alert(errorMsg);
          
          // Reset button
          if (btn) {
            btn.disabled = false;
            btn.innerHTML = '<svg class="w-5 h-5 mr-2" viewBox="0 0 24 24">...</svg>เข้าสู่ระบบด้วย Google';
          }
        }
      } catch (error) {
        console.error('❌ Google Sign-In error:', error);
        alert('ไม่สามารถเชื่อมต่อกับเซิร์ฟเวอร์ได้ กรุณาลองใหม่อีกครั้ง');
        
        // Reset button
        const btn = document.querySelector('#google-signin-button button');
        if (btn) {
          btn.disabled = false;
          btn.innerHTML = '<svg class="w-5 h-5 mr-2" viewBox="0 0 24 24">...</svg>เข้าสู่ระบบด้วย Google';
        }
      }
    }
  };
  
  // Auto-initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', () => {
      if (window.location.pathname.includes('login.html')) {
        window.GoogleAuth.init();
      }
    });
  } else {
    if (window.location.pathname.includes('login.html')) {
      window.GoogleAuth.init();
    }
  }
})();
