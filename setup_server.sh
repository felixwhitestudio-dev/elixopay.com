#!/bin/bash
set -e

echo "Installing Node.js 20 and dependencies..."
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo DEBIAN_FRONTEND=noninteractive apt-get install -y nodejs nginx postgresql-client
sudo npm install -g pm2

echo "Configuring Nginx Reverse Proxy..."
sudo rm -f /etc/nginx/sites-enabled/default

cat << 'EOF' | sudo tee /etc/nginx/sites-available/elixopay-api
server {
    listen 80;
    server_name _;

    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
EOF

sudo ln -s /etc/nginx/sites-available/elixopay-api /etc/nginx/sites-enabled/ || true
sudo systemctl restart nginx

echo "Creating App Directory..."
sudo mkdir -p /var/www/elixopay-api
sudo chown -R ubuntu:ubuntu /var/www/elixopay-api
echo "Server setup complete!"
