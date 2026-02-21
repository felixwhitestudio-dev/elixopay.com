// Simple double-submit cookie CSRF protection
// Assumes a non-HttpOnly cookie 'csrf_token' is issued during login/register
// For mutating requests, expects matching 'X-CSRF-Token' header.
module.exports = function csrfProtection(req, res, next) {
  const method = req.method.toUpperCase();
  const isMutating = ['POST','PUT','PATCH','DELETE'].includes(method);
  if (!isMutating) return next();

  const path = req.path || '';
  // Allowlist: auth bootstrap and webhooks should bypass CSRF
  // - Login/Register need to create CSRF cookie, so cannot enforce beforehand
  // - Refresh rotates cookies and returns a new CSRF token
  // - Webhooks (e.g., Stripe) are third-party callbacks
  const allowlist = [
    /^\/api\/v\d+\/auth\/login$/,
    /^\/api\/v\d+\/auth\/register$/,
    /^\/api\/v\d+\/auth\/refresh$/,
    /^\/api\/v\d+\/webhooks\//,
    /^\/health$/
  ];
  if (allowlist.some((re) => re.test(path))) {
    return next();
  }

  const csrfHeader = req.headers['x-csrf-token'];
  const csrfCookie = req.cookies && req.cookies.csrf_token;
  if (!csrfHeader || !csrfCookie || csrfHeader !== csrfCookie) {
    return res.status(403).json({
      success: false,
      error: { message: 'CSRF token invalid or missing' }
    });
  }
  next();
};