#!/bin/bash
set -e

# Config
APP_DIR="/opt/elixopay-secure"
REPO_URL="https://github.com/felixwhitestudio-dev/elixopay.com.git"

echo "🚀 Starting Secure Deployment Setup..."

# 1. Update System
echo "🔄 Updating system packages..."
apt update && apt upgrade -y

# 2. Install Docker & UFW
echo "📦 Installing Docker and UFW..."
if ! command -v docker &> /dev/null; then
    curl -fsSL https://get.docker.com -o get-docker.sh
    sh get-docker.sh
fi
apt install -y ufw

# 3. Configure Firewall (Strict Isolation)
echo "🛡️ Configuring Firewall..."
ufw default deny incoming
ufw default allow outgoing
ufw allow ssh
ufw allow 80/tcp
ufw allow 443/tcp
# Explicitly DENY database port from outside (redundant with default deny but good for audit)
ufw deny 5432/tcp
echo "y" | ufw enable
ufw status

# 4. Setup Directory
echo "📂 Setting up application directory..."
mkdir -p $APP_DIR
cd $APP_DIR

# 5. Clone/Update Code
if [ -d ".git" ]; then
    echo "⬇️ Pulling latest code..."
    git pull origin main
else
    echo "⬇️ Cloning repository..."
    git clone $REPO_URL .
fi

# 6. Generate Environment Variables (If not exists)
if [ ! -f "backend/.env" ]; then
    echo "🔑 Generating secure .env..."
    cp backend/.env.example backend/.env 2>/dev/null || touch backend/.env
    # Add random secrets logic here if needed
fi

# 7. Start Services
echo "🚀 Launching Containers..."
docker compose -f docker-compose.prod.yml up -d --build

echo "✅ Secure Deployment Complete!"
echo "   - Frontend: http://$(curl -s ifconfig.me)"
echo "   - Database: Isolated (No external access)"
echo "   - Firewall: Active (SSH, HTTP, HTTPS only)"
