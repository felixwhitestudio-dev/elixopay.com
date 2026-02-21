# Vultr VPS Deployment Guide

## Quick Deploy (Automated)

1. **Copy deployment script to server:**
```bash
scp backend/scripts/deploy-vultr.sh root@45.76.161.48:/tmp/
```

2. **SSH and run:**
```bash
ssh root@45.76.161.48
chmod +x /tmp/deploy-vultr.sh
/tmp/deploy-vultr.sh
```

That's it! The script handles:
- System updates
- Node.js 20 installation
- PostgreSQL setup
- Repository clone
- Environment configuration
- Database migrations
- Admin user seeding
- PM2 process manager
- Nginx reverse proxy

---

## Manual Deployment Steps

### 1. Connect to Server
```bash
ssh root@45.76.161.48
```

### 2. Install Dependencies
```bash
apt update && apt upgrade -y
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs git postgresql postgresql-contrib nginx
```

### 3. Setup PostgreSQL
```bash
sudo -u postgres psql << EOF
CREATE DATABASE elixopay;
CREATE USER elixopay_user WITH PASSWORD 'YourSecurePassword';
GRANT ALL PRIVILEGES ON DATABASE elixopay TO elixopay_user;
ALTER DATABASE elixopay OWNER TO elixopay_user;
EOF
```

### 4. Clone Repository
```bash
cd /opt
git clone https://github.com/felixwhitestudio-dev/elixopay.com.git
cd elixopay.com/backend
npm install --production
```

### 5. Configure Environment
Create `/opt/elixopay.com/backend/.env`:
```bash
NODE_ENV=production
PORT=3000
DB_HOST=localhost
DB_PORT=5432
DB_NAME=elixopay
DB_USER=elixopay_user
DB_PASSWORD=YourSecurePassword
JWT_SECRET=<64-byte-hex>
JWT_REFRESH_SECRET=<64-byte-hex>
FRONTEND_URL=https://elixopay.com
FRONTEND_ALLOWED_ORIGINS=https://elixopay.com,https://www.elixopay.com
COOKIE_SAMESITE=None
MAX_SESSIONS_PER_USER=10
ADMIN_EMAIL=admin@elixopay.com
ADMIN_PASSWORD=StrongPassword123!
```

Generate secrets:
```bash
node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
```

### 6. Run Migrations & Seed
```bash
npm run migrate
npm run seed:admin
```

### 7. Start with PM2
```bash
npm install -g pm2
pm2 start server.js --name elixopay-backend
pm2 startup
pm2 save
```

### 8. Configure Nginx
```bash
cat > /etc/nginx/sites-available/elixopay << 'EOF'
server {
    listen 80;
    server_name _;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

ln -sf /etc/nginx/sites-available/elixopay /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx
```

---

## Testing

Run test script:
```bash
./backend/scripts/test-backend.sh http://45.76.161.48
```

Manual tests:
```bash
# Health
curl http://45.76.161.48/health | jq

# Login
curl -X POST http://45.76.161.48/api/v1/auth/login \
  -H "Content-Type: application/json" \
  -d '{"email":"admin@elixopay.com","password":"Admin123!@#"}' -v

# Dashboard
curl http://45.76.161.48/api/v1/dashboard \
  -H "Cookie: access_token=<token>" | jq
```

---

## Maintenance

### View Logs
```bash
pm2 logs elixopay-backend
```

### Restart Service
```bash
pm2 restart elixopay-backend
```

### Update Code
```bash
cd /opt/elixopay.com
git pull origin main
cd backend
npm install --production
pm2 restart elixopay-backend
```

### Database Backup
```bash
sudo -u postgres pg_dump elixopay > /backup/elixopay_$(date +%Y%m%d).sql
```

---

## SSL Setup (Optional)

Install Certbot:
```bash
apt install -y certbot python3-certbot-nginx
```

Get certificate (requires domain pointing to server):
```bash
certbot --nginx -d api.elixopay.com
```

After SSL:
- Change `COOKIE_SAMESITE=Strict` in .env
- Update `SERVER_URL=https://api.elixopay.com`
- Restart: `pm2 restart elixopay-backend`

---

## Troubleshooting

### Port 3000 already in use
```bash
pm2 delete all
lsof -ti:3000 | xargs kill -9
```

### Database connection fails
```bash
# Check PostgreSQL status
systemctl status postgresql

# Test connection
psql -h localhost -U elixopay_user -d elixopay
```

### Nginx not proxying
```bash
# Check Nginx config
nginx -t

# Check logs
tail -f /var/log/nginx/error.log
```

### CORS issues
Check `/health` diagnostics:
```bash
curl http://45.76.161.48/health | jq '.diagnostics'
```

Ensure `allowedOrigins` contains your frontend domain.

---

## Server Info

- **IP:** 45.76.161.48
- **Location:** Singapore
- **OS:** Ubuntu 22.04 LTS
- **Specs:** 2 vCPU, 2GB RAM, 65GB Storage
- **Backend Port:** 3000 (proxied via Nginx on port 80)

---

## Environment Variables Reference

| Variable | Required | Default | Notes |
|----------|----------|---------|-------|
| `NODE_ENV` | ✅ | - | `production` for deployment |
| `PORT` | ✅ | 3000 | Backend listen port |
| `DB_HOST` | ✅ | - | `localhost` for local PostgreSQL |
| `DB_PASSWORD` | ✅ | - | Strong password required |
| `JWT_SECRET` | ✅ | - | 64-byte hex (use crypto.randomBytes) |
| `JWT_REFRESH_SECRET` | ✅ | - | 64-byte hex (different from JWT_SECRET) |
| `FRONTEND_URL` | ✅ | - | Primary frontend origin |
| `FRONTEND_ALLOWED_ORIGINS` | ✅ | - | Comma-separated list of allowed origins |
| `COOKIE_SAMESITE` | ✅ | Strict | `None` for cross-domain, `Strict` for same-domain |
| `ADMIN_EMAIL` | ⚠️ | - | For auto-seeding admin user |
| `ADMIN_PASSWORD` | ⚠️ | - | Strong password for admin |
| `MAX_SESSIONS_PER_USER` | ⚠️ | 10 | Limit concurrent sessions |
