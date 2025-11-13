// Configuration for different environments
const config = {
  development: {
    apiUrl: 'http://localhost:3000',
    stripePublicKey: 'pk_test_YOUR_TEST_KEY',
  },
  production: {
    apiUrl: 'https://api.yourdomain.com',
    stripePublicKey: 'pk_live_YOUR_LIVE_KEY',
  }
};

// Auto-detect environment
const isDevelopment = window.location.hostname === 'localhost' || 
                      window.location.hostname === '127.0.0.1';

const ENV = isDevelopment ? 'development' : 'production';

// Export configuration
window.ELIXOPAY_CONFIG = config[ENV];

console.log(`🚀 Elixopay running in ${ENV} mode`);
