# 🔒 Elixopay Security Documentation

## Overview
This document outlines the security measures implemented in the Elixopay Payment Gateway to protect user data, prevent attacks, and ensure compliance with industry standards.

---

## 🛡️ Security Features Implemented

### 1. **Authentication & Authorization**

#### JWT Token Security
- **Strong Secret Keys**: 128-character randomly generated JWT secrets
- **Token Expiration**: Access tokens expire in 7 days, refresh tokens in 30 days
- **Secure Storage**: Tokens are never stored in database (stateless authentication)
- **Bearer Token Authentication**: Industry-standard Authorization header

#### Password Security
- **Strong Password Policy**:
  - Minimum 12 characters
  - Must contain: uppercase, lowercase, number, and special character
  - Enforced via express-validator
- **Bcrypt Hashing**: 12 rounds (configurable via `BCRYPT_ROUNDS`)
- **No Password Exposure**: Passwords never returned in API responses

#### Account Lockout Protection
- **Failed Login Attempts**: Max 5 attempts before lockout
- **Lockout Duration**: 30 minutes (configurable)
- **Automatic Reset**: Successful login clears attempt counter
- **User Feedback**: Remaining attempts shown to user

---

### 2. **Rate Limiting**

Protection against DDoS and brute force attacks:

| Endpoint Type | Limit | Window | Purpose |
|--------------|-------|--------|---------|
| **General API** | 100 requests | 15 minutes | Overall API protection |
| **Authentication** | 5 attempts | 15 minutes | Prevent brute force |
| **Payments** | 10 requests | 1 minute | Prevent payment spam |
| **API Keys** | 5 creations | 1 hour | Prevent key abuse |
| **Password Reset** | 3 attempts | 1 hour | Prevent reset spam |

All rate limits include:
- `RateLimit-*` headers for client awareness
- Automatic `Retry-After` headers
- IP-based tracking

---

### 3. **CORS (Cross-Origin Resource Sharing)**

#### Allowed Origins
**Development:**
- `http://localhost:*` (any port)
- `http://127.0.0.1:*` (any port)

**Production:**
- `https://elixopay.vercel.app`
- `https://elixopay.com`
- `https://*.railway.app`
- Configured via `FRONTEND_URL` environment variable

#### Security Features
- Credentials support enabled (`credentials: true`)
- Restricted HTTP methods: GET, POST, PUT, DELETE, PATCH, OPTIONS
- Allowed headers: Content-Type, Authorization, X-Requested-With, X-API-Key
- **Development Warning**: Logs unverified origins
- **Production Blocking**: Rejects unknown origins

---

### 4. **HTTP Security Headers**

Implemented via Helmet middleware:

```javascript
Content-Security-Policy: default-src 'self'
Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
X-Frame-Options: DENY
X-Content-Type-Options: nosniff
X-XSS-Protection: 1; mode=block
```

**Protection Against:**
- ✅ XSS (Cross-Site Scripting)
- ✅ Clickjacking
- ✅ MIME-type sniffing
- ✅ Man-in-the-middle attacks (HSTS)

---

### 5. **Input Validation & Sanitization**

Using `express-validator`:

#### User Registration
- Email: Valid format, normalized
- Password: Strong policy enforced
- Name: 2-100 characters, trimmed

#### Payment Creation
- Amount: Positive number validation
- Currency: Whitelist (THB, USD, EUR)
- Description: Max 500 characters

#### API Keys
- Name: 3-100 characters, required
- Type: Whitelist (live, test)

**SQL Injection Prevention**: Parameterized queries ready (when database is implemented)

---

### 6. **Environment Variables Security**

#### Critical Variables Protected
```bash
JWT_SECRET=<128-char random hex>
JWT_REFRESH_SECRET=<128-char random hex>
ENCRYPTION_KEY=<64-char random hex>
DB_PASSWORD=<strong password>
STRIPE_SECRET_KEY=<stripe key>
SMTP_PASSWORD=<app password>
```

#### Best Practices
- ✅ `.env` file in `.gitignore`
- ✅ `.env.example` provided (no sensitive data)
- ✅ Fallback values removed in production
- ✅ Separate production environment file (`.env.production`)

#### How to Generate Secrets
```bash
# JWT Secret (128 chars)
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"

# Encryption Key (64 chars)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

---

## 🚨 Security Checklist for Production

### Before Deployment

- [ ] **Change ALL default credentials**
  - [ ] JWT_SECRET
  - [ ] JWT_REFRESH_SECRET
  - [ ] ENCRYPTION_KEY
  - [ ] DB_PASSWORD
  - [ ] Admin credentials

- [ ] **Environment Configuration**
  - [ ] Set `NODE_ENV=production`
  - [ ] Configure FRONTEND_URL correctly
  - [ ] Enable HTTPS/TLS
  - [ ] Set up proper CORS origins

- [ ] **Database Security**
  - [ ] Use connection pooling
  - [ ] Enable SSL/TLS for DB connections
  - [ ] Implement prepared statements
  - [ ] Set up read replicas (if needed)
  - [ ] Configure backups

- [ ] **Monitoring & Logging**
  - [ ] Set up error tracking (Sentry, etc.)
  - [ ] Configure audit logging
  - [ ] Monitor rate limit hits
  - [ ] Set up alerts for failed auth attempts

- [ ] **API Security**
  - [ ] Implement API key rotation policy
  - [ ] Set up webhook signature verification
  - [ ] Enable request signing (if needed)
  - [ ] Test all rate limits

---

## 🔍 Security Testing

### Manual Testing
```bash
# Test rate limiting
for i in {1..10}; do curl -X POST http://localhost:3000/api/v1/auth/login; done

# Test password policy
curl -X POST http://localhost:3000/api/v1/auth/register \
  -H "Content-Type: application/json" \
  -d '{"email":"test@test.com","password":"weak","name":"Test"}'

# Test CORS
curl -H "Origin: https://evil.com" http://localhost:3000/api/v1/auth/login
```

### Automated Security Scanning
```bash
# Install security tools
npm install -g snyk npm-audit

# Run security audit
npm audit
npm audit fix

# Snyk security scan
snyk test
snyk monitor
```

---

## 🚀 Incident Response

### If Security Breach Detected

1. **Immediate Actions**
   - [ ] Rotate all JWT secrets immediately
   - [ ] Invalidate all active sessions
   - [ ] Disable compromised API keys
   - [ ] Block suspicious IP addresses

2. **Investigation**
   - [ ] Check audit logs
   - [ ] Identify attack vector
   - [ ] Assess data exposure
   - [ ] Document timeline

3. **Recovery**
   - [ ] Patch vulnerabilities
   - [ ] Notify affected users
   - [ ] Reset compromised credentials
   - [ ] Update security policies

4. **Prevention**
   - [ ] Implement additional monitoring
   - [ ] Update security documentation
   - [ ] Train team on new threats
   - [ ] Review and improve security measures

---

## 📞 Security Contacts

- **Security Email**: security@elixopay.com
- **Bug Bounty**: Contact us for responsible disclosure
- **Support Email**: support@elixopay.com

---

## 📚 Additional Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [Node.js Security Best Practices](https://nodejs.org/en/docs/guides/security/)
- [Express Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)
- [JWT Best Practices](https://tools.ietf.org/html/rfc8725)

---

## 🔄 Last Updated

**Date**: November 17, 2024  
**Version**: 1.0.0  
**Updated By**: Security Team

---

**Remember**: Security is an ongoing process, not a one-time task. Regular audits and updates are essential.
