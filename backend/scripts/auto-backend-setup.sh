#!/bin/bash
# Elixopay Backend Auto Setup Script
set -e

# Update system
apt update && apt upgrade -y

# Install Node.js, Git, PostgreSQL, Nginx, PM2
apt install -y nodejs git postgresql postgresql-contrib nginx
npm install -g pm2

# Setup PostgreSQL
sudo -u postgres psql << EOF
CREATE DATABASE IF NOT EXISTS elixopay;
DO $$ BEGIN IF NOT EXISTS (SELECT FROM pg_catalog.pg_user WHERE usename = 'elixopay_user') THEN CREATE USER elixopay_user WITH PASSWORD 'Elixo2024SecurePass'; END IF; END $$;
GRANT ALL PRIVILEGES ON DATABASE elixopay TO elixopay_user;
ALTER DATABASE elixopay OWNER TO elixopay_user;
EOF

# Clone repo if not exists
if [ ! -d "/opt/elixopay.com" ]; then
  cd /opt
  git clone https://github.com/felixwhitestudio-dev/elixopay.com.git
fi
cd /opt/elixopay.com/backend
npm install

# Create .env
cat > .env << ENVEND
NODE_ENV=production
PORT=3000
DB_HOST=localhost
DB_NAME=elixopay
DB_USER=elixopay_user
DB_PASSWORD=Elixo2024SecurePass
FRONTEND_URL=https://elixopay.com
SERVER_URL=http://45.76.161.48
ADMIN_EMAIL=admin@elixopay.com
ADMIN_PASSWORD=Admin123!@#
ENVEND

node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(64).toString('hex'))" >> .env
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(64).toString('hex'))" >> .env

# Run migrations & seed admin
npm run migrate || true
npm run seed:admin || true

# Start backend
pm2 delete elixopay-backend 2>/dev/null || true
pm2 start server.js --name elixopay-backend --env production
pm2 startup systemd -u root --hp /root
pm2 save

# Setup Nginx reverse proxy
cat > /etc/nginx/sites-available/elixopay << NGINXEND
server {
    listen 80;
    server_name _;
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }
}
NGINXEND
ln -sf /etc/nginx/sites-available/elixopay /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl restart nginx

# Show status
pm2 status
systemctl status nginx

echo "\n✅ Backend setup complete!"
echo "URL: http://45.76.161.48"
echo "Admin: admin@elixopay.com / Admin123!@#"
