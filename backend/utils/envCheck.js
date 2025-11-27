/**
 * Simple environment variable validation. Fail fast in production if critical values missing.
 */
function checkEnv() {
  const required = [
    'JWT_SECRET',
    'JWT_REFRESH_SECRET',
    'FRONTEND_URL'
  ];
  const missing = required.filter(k => !process.env[k] || !String(process.env[k]).trim());
  if (missing.length) {
    const msg = `Missing required env vars: ${missing.join(', ')}`;
    if (process.env.NODE_ENV === 'production') {
      throw new Error(msg);
    } else {
      console.warn('⚠️  ' + msg);
    }
  }

  // Warn about mismatched SameSite None without HTTPS
  const sameSite = (process.env.COOKIE_SAMESITE || 'Strict').trim();
  if (sameSite === 'None' && process.env.NODE_ENV === 'production' && !process.env.SERVER_URL?.startsWith('https://')) {
    console.warn('⚠️ COOKIE_SAMESITE=None requires HTTPS. Set SERVER_URL=https://your-api-domain');
  }
}

module.exports = { checkEnv };
