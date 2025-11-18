# 🔐 Elixopay - Secure Payment Gateway

[![Security](https://img.shields.io/badge/security-hardened-green.svg)](./SECURITY_README.md)
[![License](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)

Elixopay is a modern, secure payment gateway built with Node.js and Express. This project implements industry-standard security practices to protect user data and prevent common web vulnerabilities.

---

## 🚀 Quick Start

### Prerequisites
- Node.js >= 18.0.0
- npm >= 9.0.0
- PostgreSQL (for production)

### Installation

1. **Clone the repository**
```bash
git clone https://github.com/yourusername/elixopay.git
cd elixopay
```

2. **Install dependencies**
```bash
# Install root dependencies (frontend)
npm install

# Install backend dependencies
cd backend
npm install
```

3. **Configure environment variables**
```bash
# Copy example env file
cp backend/.env.example backend/.env

# Generate secure secrets
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Copy output to JWT_SECRET in .env

node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# Copy output to JWT_REFRESH_SECRET in .env

node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
# Copy output to ENCRYPTION_KEY in .env
```

4. **Start development server**
```bash
# From project root - runs both frontend and backend
npm run dev

# Or run separately:
npm run dev:backend   # Backend only
npm run dev:frontend  # Frontend only
```

---

## 📂 Project Structure

```
elixopay/
├── backend/
│   ├── config/          # Database configuration
│   ├── controllers/     # Business logic
│   ├── middleware/      # Auth, validation, rate limiting
│   ├── migrations/      # Database migrations
│   ├── routes/          # API routes
│   ├── utils/           # Helper functions
│   └── server.js        # Express app entry point
├── js/                  # Frontend JavaScript
├── *.html               # Frontend pages
├── SECURITY_README.md   # Security documentation
└── START_HERE.md        # Quick start guide
```

---

## 🔒 Security Features

This project implements comprehensive security measures:

### ✅ Authentication & Authorization
- JWT-based stateless authentication
- Strong password policy (12+ chars, special chars required)
- Account lockout after 5 failed attempts
- Bcrypt password hashing (12 rounds)

### ✅ Rate Limiting
- API-wide rate limiting (100 req/15min)
- Strict auth endpoint limits (5 req/15min)
- Payment rate limiting (10 req/min)
- Password reset throttling (3 req/hour)

### ✅ Security Headers
- Helmet.js implementation
- HSTS enabled (HTTPS enforcement)
- XSS protection
- Clickjacking prevention
- CSP (Content Security Policy)

### ✅ Input Validation
- express-validator for all inputs
- SQL injection prevention ready
- XSS sanitization
- Email normalization

### ✅ CORS Protection
- Whitelist-based origin validation
- Credentials support
- Development/production configs

**📖 Full security documentation**: [SECURITY_README.md](./SECURITY_README.md)

---

## 🌐 API Endpoints

### Base URL
- **Local**: `http://localhost:3000/api/v1`
- **Production**: `https://elixopay-production.up.railway.app/api/v1`

### Authentication
```bash
# Register
POST /auth/register
Content-Type: application/json
{
  "email": "user@example.com",
  "password": "SecurePass123!@#",
  "name": "John Doe"
}

# Login
POST /auth/login
Content-Type: application/json
{
  "email": "user@example.com",
  "password": "SecurePass123!@#"
}

# Get current user
GET /auth/me
Authorization: Bearer <token>
```

### Payments
```bash
# Create payment
POST /payments
Authorization: Bearer <token>
Content-Type: application/json
{
  "amount": 100.00,
  "currency": "THB",
  "description": "Payment for services"
}

# Get payment history
GET /payments
Authorization: Bearer <token>
```

### Demo Account
```
Email: demo@elixopay.com
Password: demo1234
```

---

## 🏗️ Agency System (Phase 1)

The multi-level agency feature enables agencies to have nested sub-agencies and onboard merchant websites. Phase 1 delivers foundational tables and CRUD APIs (no financial ledger yet).

### Data Model (Phase 1 Only)
| Table | Purpose |
|-------|---------|
| `agencies` | Stores top-level and nested agencies (via `parent_id`). |
| `agency_members` | Links users to agencies with roles (`owner`, `manager`, `finance`, `support`). |
| `merchant_sites` | Merchant/website entities associated to an agency. |
| `commission_rules` | Configurable commission definitions per agency level (DIRECT/SUB_AGENCY/MERCHANT). |

### New Endpoints
Base prefix: `/api/v1`

Agencies:
```bash
GET    /agencies                      # List agencies (query: parent_id, search)
POST   /agencies                      # Create agency (admin)
GET    /agencies/:id                  # Get agency detail
POST   /agencies/:id/sub-agencies     # Create sub-agency (admin)
GET    /agencies/:id/members          # List members
POST   /agencies/:id/members          # Add member (admin)
```

Merchant Sites:
```bash
GET    /merchant-sites?agency_id=...  # List sites
POST   /merchant-sites                # Create site
GET    /merchant-sites/:id            # Site detail
PATCH  /merchant-sites/:id            # Update site fields
```

Commission Rules:
```bash
GET    /commission-rules?agency_id=...           # List rules (active only by default)
POST   /commission-rules                         # Create rule (admin)
PATCH  /commission-rules/:id/deactivate          # Soft deactivate rule
```

### Roles (Initial)
Phase 1 reuses `user.role` for admin gating. Future phases will enforce membership-level permissions via `agency_members` (e.g. finance vs support). Only `admin` / `super_admin` may create agencies, sub-agencies, commission rules, or add members.

### Coming in Phase 2
| Feature | Description |
|---------|-------------|
| Balances / Ledger | Track commission accruals, reversals, withdrawals. |
| Withdrawal Requests | Lifecycle (PENDING → APPROVED → PAID). |
| Commission Application | Automatic accrual on successful payment + settlement delay. |
| Reversal Logic | Refunds reverse credited commission entries. |
| Deeper RBAC | Enforce per-agency role scopes & audit logging. |

### Migration Files
- `migrations/20241118_phase1_agencies.sql` adds Phase 1 tables & indexes.

### Quick Test (After Auth)
```bash
# List agencies
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/v1/agencies

# Create agency (admin user required)
curl -X POST -H "Authorization: Bearer $ADMIN_TOKEN" -H "Content-Type: application/json" \
  -d '{"name":"Main Agency","code":"AG_MAIN"}' \
  http://localhost:3000/api/v1/agencies
```

If you need to remove Phase 1 functionality temporarily, delete the route files (`agencies.js`, `merchantSites.js`, `commissionRules.js`) and restart the server.

---

---

## 🛠️ Development

### Available Scripts

```bash
# Development
npm run dev              # Run both frontend & backend
npm run dev:local        # Same as above
npm run dev:remote       # Frontend only (use Railway backend)
npm run dev:backend      # Backend only
npm run dev:frontend     # Frontend only

# Database
npm --prefix backend run migrate    # Run migrations

# Production
npm start                # Start production server
```

### Environment Variables

| Variable | Description | Required |
|----------|-------------|----------|
| `NODE_ENV` | Environment (development/production) | Yes |
| `PORT` | Server port | Yes |
| `JWT_SECRET` | JWT signing secret | Yes |
| `JWT_REFRESH_SECRET` | Refresh token secret | Yes |
| `ENCRYPTION_KEY` | Data encryption key | Yes |
| `DB_HOST` | Database host | Yes |
| `DB_PASSWORD` | Database password | Yes |
| `FRONTEND_URL` | Frontend URL for CORS | Yes |
| `STRIPE_SECRET_KEY` | Stripe API key | No |

See [.env.example](./backend/.env.example) for full list.

---

## 🧪 Testing

```bash
# Run tests (when implemented)
npm test

# Security audit
npm audit
npm audit fix

# Check for vulnerabilities
npx snyk test
```

---

## 🚀 Deployment

### Railway (Recommended)

1. **Connect repository to Railway**
2. **Set environment variables** in Railway dashboard
3. **Deploy automatically** on push to main branch

### Manual Deployment

```bash
# Build (if needed)
npm run build

# Start production server
NODE_ENV=production npm start
```

---

## 📝 Contributing

1. Fork the repository
2. Create feature branch (`git checkout -b feature/amazing-feature`)
3. Commit changes (`git commit -m 'Add amazing feature'`)
4. Push to branch (`git push origin feature/amazing-feature`)
5. Open Pull Request

### Security Vulnerabilities

If you discover a security vulnerability, please email **security@elixopay.com** instead of using the issue tracker.

---

## 📄 License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👥 Authors

- **Elixopay Team**
- Email: support@elixopay.com
- Website: https://elixopay.com

---

## 🙏 Acknowledgments

- Express.js team for the excellent framework
- Helmet.js for security middleware
- Railway for hosting platform
- All contributors who helped improve this project

---

## 📞 Support

- 📧 Email: support@elixopay.com
- 🔒 Security: security@elixopay.com
- 📚 Documentation: [docs.elixopay.com](https://docs.elixopay.com)

---

**Made with ❤️ by Elixopay Team**
