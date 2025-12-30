#!/bin/bash
# VPS Initial Setup Script for United Exchange
# For Namecheap Pulsar VPS - Ubuntu/Debian
# Domain: unitedexchange.ink

set -e

DOMAIN="unitedexchange.ink"
APP_DIR="/var/www/united-exchange"
REPO_URL="https://github.com/Abdalkaderdev/unitedexchange.git"

echo "============================================"
echo "  United Exchange VPS Setup"
echo "  Domain: $DOMAIN"
echo "============================================"

# Update system
echo "[1/10] Updating system packages..."
apt update && apt upgrade -y

# Install required packages
echo "[2/10] Installing required packages..."
apt install -y curl wget git nginx certbot python3-certbot-nginx ufw

# Install Node.js 20.x
echo "[3/10] Installing Node.js 20.x..."
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt install -y nodejs

# Install PM2 globally
echo "[4/10] Installing PM2..."
npm install -g pm2

# Install Docker
echo "[5/10] Installing Docker..."
curl -fsSL https://get.docker.com | sh
systemctl enable docker
systemctl start docker

# Install Docker Compose
echo "[6/10] Installing Docker Compose..."
apt install -y docker-compose-plugin

# Configure firewall
echo "[7/10] Configuring firewall..."
ufw allow OpenSSH
ufw allow 'Nginx Full'
ufw --force enable

# Clone repository
echo "[8/10] Cloning repository..."
mkdir -p $APP_DIR
git clone $REPO_URL $APP_DIR
cd $APP_DIR

# Copy production environment file
echo "[9/10] Setting up environment..."
cp deploy/.env.production .env

# Create certbot webroot directory
mkdir -p /var/www/certbot

# Setup Nginx (temporary config for SSL)
echo "[10/10] Setting up Nginx..."
cat > /etc/nginx/sites-available/united-exchange << 'NGINX'
server {
    listen 80;
    server_name unitedexchange.ink www.unitedexchange.ink;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 200 'United Exchange - Setting up...';
        add_header Content-Type text/plain;
    }
}
NGINX

ln -sf /etc/nginx/sites-available/united-exchange /etc/nginx/sites-enabled/
rm -f /etc/nginx/sites-enabled/default
nginx -t && systemctl reload nginx

echo ""
echo "============================================"
echo "  Initial Setup Complete!"
echo "============================================"
echo ""
echo "Next steps:"
echo ""
echo "1. Wait for DNS to propagate, then run:"
echo "   certbot --nginx -d unitedexchange.ink -d www.unitedexchange.ink"
echo ""
echo "2. After SSL is set up, run:"
echo "   cd $APP_DIR && ./deploy/scripts/start-production.sh"
echo ""
echo "============================================"
