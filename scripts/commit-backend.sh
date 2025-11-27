#!/bin/bash
# Quick commit and push backend changes

cd /Users/felixonthecloud/Elixopay

echo "📦 Adding all changes..."
git add .

echo "💬 Creating commit..."
git commit -m "feat(backend): Add cookie auth, CORS config, dashboard endpoint, admin seeding

- Implement HttpOnly cookie-based authentication with refresh token rotation
- Add CSRF double-submit cookie protection
- Configure CORS with FRONTEND_ALLOWED_ORIGINS support
- Add dashboard endpoint (GET /api/v1/dashboard) with role-aware data
- Implement admin user seeding via npm run seed:admin
- Add environment validation (utils/envCheck.js)
- Enhance /health endpoint with diagnostics (allowedOrigins, cookieSameSite)
- Support configurable COOKIE_SAMESITE for cross-domain deployment
- Migrate password hashing to Argon2id with bcrypt legacy support
- Add session management (list/revoke endpoints)
- Implement session cap enforcement (MAX_SESSIONS_PER_USER)
- Add audit logging for auth events
- Create deployment guides (DEPLOY_CHECKLIST.md)
- Add Vultr deployment script (scripts/deploy-vultr.sh)"

echo "🚀 Pushing to GitHub..."
git push origin main

echo "✅ Changes pushed successfully!"
echo ""
echo "Next: SSH to server and run deployment script"
echo "  scp backend/scripts/deploy-vultr.sh root@45.76.161.48:/tmp/"
echo "  ssh root@45.76.161.48"
echo "  chmod +x /tmp/deploy-vultr.sh"
echo "  /tmp/deploy-vultr.sh"
