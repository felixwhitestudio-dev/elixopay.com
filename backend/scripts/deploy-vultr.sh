#!/bin/bash
set -e

echo "🚀 Elixopay Backend Deployment Script for Vultr"
echo "================================================"

# Colors
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Configuration
SERVER_IP="${SERVER_IP:-45.76.161.48}"
DB_PASSWORD="${DB_PASSWORD:-Elixo2024SecurePass}"
ADMIN_EMAIL="${ADMIN_EMAIL:-admin@elixopay.com}"
ADMIN_PASSWORD="${ADMIN_PASSWORD:-Admin123!@#}"

echo -e "${YELLOW}Server IP: ${SERVER_IP}${NC}"
echo ""

# Update system
echo -e "${GREEN}[1/9]${NC} Updating system..."
apt update && apt upgrade -y

# Install Node.js 20
echo -e "${GREEN}[2/9]${NC} Installing Node.js 20..."
if ! command -v node &> /dev/null; then
    curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
    apt install -y nodejs
fi
echo "Node version: $(node --version)"

# Install dependencies
echo -e "${GREEN}[3/9]${NC} Installing dependencies..."
apt install -y git postgresql postgresql-contrib nginx

# Setup PostgreSQL
echo -e "${GREEN}[4/9]${NC} Setting up PostgreSQL..."
if ! sudo -u postgres psql -lqt | cut -d \| -f 1 | grep -qw elixopay; then
    sudo -u postgres psql << EOF
CREATE DATABASE elixopay;
CREATE USER elixopay_user WITH PASSWORD '${DB_PASSWORD}';
GRANT ALL PRIVILEGES ON DATABASE elixopay TO elixopay_user;
ALTER DATABASE elixopay OWNER TO elixopay_user;
EOF
    echo "✅ Database created"
else
    echo "✅ Database already exists"
fi

# Clone or update repo
echo -e "${GREEN}[5/9]${NC} Cloning/updating repository..."
if [ ! -d "/opt/elixopay.com" ]; then
    cd /opt
    git clone https://github.com/felixwhitestudio-dev/elixopay.com.git
else
    cd /opt/elixopay.com
    git pull origin main
fi

cd /opt/elixopay.com/backend
npm install --production

# Generate secrets
echo -e "${GREEN}[6/9]${NC} Generating JWT secrets..."
JWT_SEC=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")
JWT_REF=$(node -e "console.log(require('crypto').randomBytes(64).toString('hex'))")

# Create .env
echo -e "${GREEN}[7/9]${NC} Creating environment configuration..."
cat > .env << EOF
NODE_ENV=production
PORT=3000
API_VERSION=v1

# Database
DB_HOST=localhost
DB_PORT=5432
DB_NAME=elixopay
DB_USER=elixopay_user
DB_PASSWORD=${DB_PASSWORD}
DB_SSL=false

# JWT
JWT_SECRET=${JWT_SEC}
JWT_REFRESH_SECRET=${JWT_REF}
JWT_EXPIRES_IN=1h
JWT_REFRESH_EXPIRES_IN=7d

# CORS & Cookies
FRONTEND_URL=https://elixopay.com
FRONTEND_ALLOWED_ORIGINS=https://elixopay.com,https://www.elixopay.com
COOKIE_SAMESITE=None
MAX_SESSIONS_PER_USER=10
ALLOW_RAILWAY_WILDCARD=false

# Security
ARGON2_MEMORY_COST=19456
ARGON2_TIME_COST=2
ARGON2_PARALLELISM=1
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION_MS=1800000

# Server
SERVER_URL=http://${SERVER_IP}:3000

# Admin
ADMIN_EMAIL=${ADMIN_EMAIL}
ADMIN_PASSWORD=${ADMIN_PASSWORD}
ADMIN_VERIFY=true
EOF

echo "✅ Environment configured"

# Run migrations
echo -e "${GREEN}[8/9]${NC} Running database migrations..."
npm run migrate || echo "⚠️ Migrations may have already run"

# Seed admin
echo -e "${GREEN}Seeding admin user...${NC}"
npm run seed:admin

# Setup PM2
if ! command -v pm2 &> /dev/null; then
    npm install -g pm2
fi

# Stop existing process if running
pm2 delete elixopay-backend 2>/dev/null || true

# Start backend
pm2 start server.js --name elixopay-backend --env production
pm2 startup systemd -u root --hp /root
pm2 save

# Setup Nginx
echo -e "${GREEN}[9/9]${NC} Configuring Nginx..."
cat > /etc/nginx/sites-available/elixopay << 'NGINXEOF'
server {
    listen 80;
    server_name _;

    client_max_body_size 50M;

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
        
        # CORS headers (redundant with backend but safe)
        add_header Access-Control-Allow-Credentials true always;
    }
}
NGINXEOF

ln -sf /etc/nginx/sites-available/elixopay /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# Show status
echo ""
echo -e "${GREEN}================================================${NC}"
echo -e "${GREEN}✅ Deployment Complete!${NC}"
echo -e "${GREEN}================================================${NC}"
echo ""
pm2 status
echo ""
echo -e "${YELLOW}Backend URL:${NC} http://${SERVER_IP}"
echo -e "${YELLOW}Health Check:${NC} curl http://${SERVER_IP}/health"
echo ""
echo -e "${YELLOW}Admin credentials:${NC}"
echo -e "  Email: ${ADMIN_EMAIL}"
echo -e "  Password: ${ADMIN_PASSWORD}"
echo ""
echo -e "${YELLOW}Test login:${NC}"
echo "curl -X POST http://${SERVER_IP}/api/v1/auth/login \\"
echo "  -H 'Content-Type: application/json' \\"
echo "  -d '{\"email\":\"${ADMIN_EMAIL}\",\"password\":\"${ADMIN_PASSWORD}\"}' -v"
echo ""
echo -e "${GREEN}Next steps:${NC}"
echo "1. Test health endpoint"
echo "2. Test login"
echo "3. Update frontend js/api-config.js PROD_BASE to http://${SERVER_IP}"
echo "4. Setup SSL with Certbot (optional)"
echo ""
