#!/bin/bash
# ─────────────────────────────────────────
# Elixopay — SSL Setup Script for EC2
# ─────────────────────────────────────────
# Usage: sudo bash setup-ssl.sh <domain>
# Example: sudo bash setup-ssl.sh api.elixopay.com
#
# Prerequisites:
# - Ubuntu 22.04+ on EC2
# - Port 80 and 443 open in Security Group
# - Domain DNS pointing to EC2 public IP

set -e

DOMAIN=${1:-api.elixopay.com}
EMAIL=${2:-admin@elixopay.com}

echo "══════════════════════════════════════════"
echo "  Elixopay SSL Setup — $DOMAIN"
echo "══════════════════════════════════════════"

# ─── Step 1: Install Nginx (if not present) ───
echo "📦 Step 1: Installing Nginx..."
if ! command -v nginx &> /dev/null; then
    apt-get update
    apt-get install -y nginx
    systemctl enable nginx
    echo "   ✅ Nginx installed"
else
    echo "   ✅ Nginx already installed"
fi

# ─── Step 2: Install Certbot ───
echo "📦 Step 2: Installing Certbot..."
if ! command -v certbot &> /dev/null; then
    apt-get install -y certbot python3-certbot-nginx
    echo "   ✅ Certbot installed"
else
    echo "   ✅ Certbot already installed"
fi

# ─── Step 3: Create ACME challenge directory ───
echo "📁 Step 3: Creating challenge directory..."
mkdir -p /var/www/certbot

# ─── Step 4: Copy Nginx config ───
echo "📄 Step 4: Setting up Nginx config..."
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

# First, set up a temporary HTTP-only config for cert generation
cat > /etc/nginx/sites-available/elixopay-temp << 'TEMP_EOF'
server {
    listen 80;
    server_name DOMAIN_PLACEHOLDER;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'Elixopay SSL setup in progress...';
        add_header Content-Type text/plain;
    }
}
TEMP_EOF
sed -i "s/DOMAIN_PLACEHOLDER/$DOMAIN/g" /etc/nginx/sites-available/elixopay-temp

# Enable temp config
rm -f /etc/nginx/sites-enabled/default
ln -sf /etc/nginx/sites-available/elixopay-temp /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
echo "   ✅ Temporary Nginx config active"

# ─── Step 5: Generate SSL Certificate ───
echo "🔐 Step 5: Generating SSL certificate for $DOMAIN..."
certbot certonly \
    --webroot \
    --webroot-path /var/www/certbot \
    -d "$DOMAIN" \
    --email "$EMAIL" \
    --agree-tos \
    --no-eff-email \
    --non-interactive

echo "   ✅ Certificate generated!"

# ─── Step 6: Install full Nginx config ───
echo "📄 Step 6: Installing production Nginx config..."
if [ -f "$SCRIPT_DIR/nginx.conf" ]; then
    cp "$SCRIPT_DIR/nginx.conf" /etc/nginx/sites-available/elixopay
    # Replace domain placeholder if needed
    sed -i "s/api.elixopay.com/$DOMAIN/g" /etc/nginx/sites-available/elixopay
else
    echo "   ⚠️  nginx.conf not found at $SCRIPT_DIR/nginx.conf"
    echo "   Please manually copy deploy/nginx.conf to /etc/nginx/sites-available/elixopay"
fi

# Switch from temp to production config
rm -f /etc/nginx/sites-enabled/elixopay-temp
ln -sf /etc/nginx/sites-available/elixopay /etc/nginx/sites-enabled/
nginx -t && systemctl reload nginx
echo "   ✅ Production Nginx config active"

# ─── Step 7: Setup auto-renewal ───
echo "🔄 Step 7: Setting up auto-renewal..."
# Certbot auto-renewal is handled by systemd timer on Ubuntu
# Verify it's enabled:
systemctl enable certbot.timer
systemctl start certbot.timer

# Add post-renewal hook to reload Nginx
cat > /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh << 'HOOK_EOF'
#!/bin/bash
nginx -t && systemctl reload nginx
HOOK_EOF
chmod +x /etc/letsencrypt/renewal-hooks/deploy/reload-nginx.sh
echo "   ✅ Auto-renewal configured (certbot.timer)"

# ─── Step 8: Test renewal ───
echo "🧪 Step 8: Testing certificate renewal (dry run)..."
certbot renew --dry-run
echo "   ✅ Renewal test passed!"

echo ""
echo "══════════════════════════════════════════"
echo "  ✅ SSL Setup Complete!"
echo "══════════════════════════════════════════"
echo ""
echo "  Domain:       https://$DOMAIN"
echo "  Certificate:  /etc/letsencrypt/live/$DOMAIN/"
echo "  Nginx Config: /etc/nginx/sites-available/elixopay"
echo "  Auto-renewal: Enabled (certbot.timer)"
echo ""
echo "  Next: Verify in browser → https://$DOMAIN"
echo "══════════════════════════════════════════"
