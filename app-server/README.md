## Backend Overview

This backend powers the Elixopay API: authentication (JWT access + refresh), session management, CSRF protection, and payment-related routes. It uses PostgreSQL as the primary datastore.

## Authentication & Sessions

- Access Token: Short‑lived JWT issued as `access_token` HttpOnly cookie.
- Refresh Token: Long‑lived JWT in `refresh_token` HttpOnly cookie; rotated on each refresh.
- CSRF: Double‑submit cookie pattern (`csrf_token` cookie + `X-CSRF-Token` header) enforced on mutating requests.
- Sessions: Each refresh token maps to a DB row in `sessions` with hashed refresh token (SHA‑256) for lookup.
- Session Cap: Oldest sessions beyond `MAX_SESSIONS_PER_USER` are pruned.

## Password Hashing Migration

New passwords are hashed with Argon2id. Legacy bcrypt hashes are still accepted and upgraded transparently on successful login.

### Hash Strategy

| Stage | Algorithm | Notes |
|-------|-----------|-------|
| Legacy | bcrypt (cost ~12) | Detected by `$2` prefix |
| Current | Argon2id | Memory 19,456 KB, time 2, parallelism 1 (tunable via env) |

### Upgrade Flow
1. User logs in with bcrypt hash.
2. Password verified via bcrypt.
3. Immediately rehashed with Argon2id and stored back into `users.password`.
4. Subsequent logins use Argon2 verify.

### Environment Overrides (Optional)
`ARGON2_MEMORY_COST` (default 19456)
`ARGON2_TIME_COST` (default 2)
`ARGON2_PARALLELISM` (default 1)
`COOKIE_SAMESITE` (Strict | Lax | None, default Strict) — use `None` only when frontend & backend are on different domains; requires HTTPS so `secure` is forced.

## Refresh Token Rotation
On `/auth/refresh`, the session row token hash is replaced and expiry extended. New cookies for access/refresh/CSRF are set. Audit logged.

## Audit Logging
Important auth events (`register`, `login`, `refresh`, `logout`, `session_revoke`) are recorded in `audit_logs` with IP and user-agent for forensic review.

## Security Notes
- HttpOnly + SameSite Strict cookies reduce XSS and CSRF risk.
- CSRF double-submit ensures mutating requests originate from a page with the cookie.
- Refresh token hashing protects tokens at rest if DB is leaked.
- Argon2id increases resistance against GPU/ASIC brute-force vs bcrypt.

## Future Enhancements
- Add 2FA/TOTP real implementation.
- Expose audit log viewer endpoint for admins.
- Harden CSP / Permissions-Policy headers further.

## Dashboard Endpoint

`GET /api/v1/dashboard`

Returns role-aware summary data for the authenticated user.

Response Shape:
```
{
	success: true,
	data: {
		user: { id, email, name, role, isVerified },
		sessions: {
			total: <number>,
			recent: [ { id, created_at, ip_address, user_agent, expires_at }, ... ]
		},
		stats?: {            // present only if role === 'admin'
			totalUsers: <number>,
			totalAgencies: <number>
		}
	}
}
```

Notes:
- Requires authentication (access token cookie).
- CSRF not required (GET request).
- Admin stats kept lightweight; expand as needed.

## Cross-Domain Deployment & Cookies

If frontend and backend are on different apex domains (e.g. `app.example.com` and `api.example.net`), browsers treat requests as cross-site and will drop `SameSite=Strict` cookies. Set:

```
COOKIE_SAMESITE=None
```

This forces `secure=true` automatically. Ensure you use HTTPS. For staging on free hosts (Railway/Render) map a custom subdomain (e.g. `api.elixopay.com`) to keep `Strict` where possible for better CSRF protection.

Recommended production setup:
1. Issue a dedicated API subdomain (`api.elixopay.com`).
2. Keep `COOKIE_SAMESITE=Strict` (preferred) so refresh/access cookies are only sent from same-site pages.
3. Allow CORS origins explicitly via `FRONTEND_URL`, avoid wildcards.

## Minimal Required Environment Variables

```
JWT_SECRET=change_me
JWT_REFRESH_SECRET=change_me_refresh
DB_HOST=...
DB_USER=...
DB_PASSWORD=...
DB_NAME=elixopay
FRONTEND_URL=https://elixopay.com
MAX_SESSIONS_PER_USER=10
COOKIE_SAMESITE=Strict
FRONTEND_ALLOWED_ORIGINS=https://elixopay.com,https://www.elixopay.com
```

Optional hardening:
```
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION_MS=1800000
ARGON2_MEMORY_COST=19456
ARGON2_TIME_COST=2
ARGON2_PARALLELISM=1
LOG_LEVEL=silent   # Suppress SQL summaries
ALLOW_RAILWAY_WILDCARD=false  # If true, allow any *.railway.app origin in production
```

## Quick Free Deployment Guide

Railway (Backend):
1. Create new project → Postgres plugin → Deploy repository.
2. Set env vars above in Railway dashboard.
3. Add a custom domain or note the generated `.railway.app` URL.
4. If using generated domain for frontend, set `COOKIE_SAMESITE=None` temporarily.

Netlify / Vercel (Frontend):
1. Deploy static site (this root). Ensure `netlify.toml` / `vercel.json` includes correct redirect rules.
2. In `js/api-config.js` set `PROD_BASE` to your API domain.
3. If cross-domain: set `COOKIE_SAMESITE=None` until you migrate to shared apex.

After DNS consolidation (frontend & backend share apex but different subdomains) revert `COOKIE_SAMESITE` back to `Strict`.

### CORS Troubleshooting

1. Console error `blocked by CORS policy` and missing `Access-Control-Allow-Origin`: ensure the exact origin domain (with protocol) is listed in `FRONTEND_ALLOWED_ORIGINS` or matches `FRONTEND_URL`.
2. Preflight (OPTIONS) fails: confirm backend is running and no earlier middleware throws before `cors()`.
3. Cookies not set: set `COOKIE_SAMESITE=None` (HTTPS only) if frontend and backend are different apex domains.
4. Mismatch http/https: origins must use HTTPS in production; mixing protocols blocks cookies.
5. Change applied but still blocked: restart/redeploy backend—environment changes take effect only after process restart.
6. Need temporary wide allow for Railway staging: set `ALLOW_RAILWAY_WILDCARD=true` (avoid in production).

### Health Endpoint Diagnostics
`GET /health` now returns a `diagnostics` object:

```
{
	diagnostics: {
		cookieSameSite: "Strict|Lax|None",
		allowedOrigins: ["https://elixopay.com", ...],
		allowRailwayWildcard: false,
		frontendUrl: "https://elixopay.com"
	}
}
```

Use this to confirm runtime config matches environment variables after deploy. If `allowedOrigins` is empty, verify `FRONTEND_ALLOWED_ORIGINS` or `FRONTEND_URL` are set.

## Admin Seeding

To create or update an admin user automatically:

Environment variables:
```
ADMIN_EMAIL=admin@elixopay.com
ADMIN_PASSWORD=StrongPass123!   # optional; random generated if omitted
ADMIN_NAME=Platform Admin       # optional
ADMIN_VERIFY=true               # optional (default true)
```
Run:
```
npm run seed:admin
```
If `ADMIN_PASSWORD` is omitted a secure 16‑character password is generated and printed in the JSON output under `generatedPassword` (store it securely; it is not logged elsewhere).

On Railway add these variables, then trigger a deploy or run an exec shell to execute:
```
railway run npm run seed:admin
```
(Or use the web console shell.)

Re-run safely to rotate password or promote existing non-admin user to admin.




