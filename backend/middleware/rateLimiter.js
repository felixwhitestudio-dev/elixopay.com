const rateLimit = require('express-rate-limit');

/**
 * General API rate limiter
 * Limits requests to prevent DDoS attacks
 */
exports.generalLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS) || 100, // limit each IP to 100 requests per windowMs
  message: {
    success: false,
    error: {
      message: 'Too many requests from this IP, please try again later.',
      retryAfter: 'Check the Retry-After header'
    }
  },
  standardHeaders: true, // Return rate limit info in the `RateLimit-*` headers
  legacyHeaders: false, // Disable the `X-RateLimit-*` headers
  // Skip rate limiting for certain IPs (optional)
  skip: (req) => {
    // Skip rate limiting for health checks
    return req.path === '/health' || req.path === '/';
  }
});

/**
 * Strict rate limiter for authentication endpoints
 * Prevents brute force attacks on login/register
 */
exports.authLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_LOGIN_WINDOW_MS) || 15 * 60 * 1000, // 15 minutes
  max: parseInt(process.env.RATE_LIMIT_LOGIN_MAX) || 5, // limit each IP to 5 login attempts per windowMs
  message: {
    success: false,
    error: {
      message: 'Too many login attempts from this IP, please try again after 15 minutes.',
      retryAfter: 'Check the Retry-After header'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
  skipSuccessfulRequests: true, // Don't count successful requests
});

/**
 * Payment rate limiter
 * More strict limits for payment operations
 */
exports.paymentLimiter = rateLimit({
  windowMs: 60 * 1000, // 1 minute
  max: 10, // limit each IP to 10 payment requests per minute
  message: {
    success: false,
    error: {
      message: 'Too many payment requests, please slow down.',
      retryAfter: 'Check the Retry-After header'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * API Key creation rate limiter
 * Prevent API key spam
 */
exports.apiKeyLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 5, // limit each IP to 5 API key creations per hour
  message: {
    success: false,
    error: {
      message: 'Too many API key creation attempts, please try again later.',
      retryAfter: 'Check the Retry-After header'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});

/**
 * Password reset rate limiter
 */
exports.passwordResetLimiter = rateLimit({
  windowMs: 60 * 60 * 1000, // 1 hour
  max: 3, // limit each IP to 3 password reset attempts per hour
  message: {
    success: false,
    error: {
      message: 'Too many password reset attempts, please try again later.',
      retryAfter: 'Check the Retry-After header'
    }
  },
  standardHeaders: true,
  legacyHeaders: false,
});
