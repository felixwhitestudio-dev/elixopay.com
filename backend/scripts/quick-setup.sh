#!/bin/bash
# Quick Setup Script - Easy to type

cd /opt/elixopay.com/backend

# Create .env file
cat > .env << 'ENVEND'
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

# Generate JWT secrets
node -e "console.log('JWT_SECRET=' + require('crypto').randomBytes(64).toString('hex'))" >> .env
node -e "console.log('JWT_REFRESH_SECRET=' + require('crypto').randomBytes(64).toString('hex'))" >> .env

echo "✅ .env created!"

# Run migrations
npm run migrate

# Seed admin
npm run seed:admin

# Install PM2
npm install -g pm2

# Start backend
pm2 delete elixopay-backend 2>/dev/null || true
pm2 start server.js --name elixopay-backend --env production
pm2 startup systemd -u root --hp /root
pm2 save

# Setup Nginx
cat > /etc/nginx/sites-available/elixopay << 'NGINXEND'
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

echo ""
echo "🎉 Deployment Complete!"
echo "Backend: http://45.76.161.48"
echo "Admin: admin@elixopay.com / Admin123!@#"
pm2 status
