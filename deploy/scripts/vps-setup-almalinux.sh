#!/bin/bash
# VPS Setup Script for United Exchange
# For AlmaLinux 9.x / RHEL-based systems
# Domain: unitedexchange.ink

set -e

DOMAIN="unitedexchange.ink"
APP_DIR="/var/www/united-exchange"
REPO_URL="https://github.com/Abdalkaderdev/unitedexchange.git"

echo "============================================"
echo "  United Exchange VPS Setup (AlmaLinux)"
echo "  Domain: $DOMAIN"
echo "============================================"

# Update system
echo "[1/10] Updating system packages..."
dnf update -y

# Install EPEL repository
echo "[2/10] Installing EPEL repository..."
dnf install -y epel-release

# Install required packages
echo "[3/10] Installing required packages..."
dnf install -y curl wget git nginx certbot python3-certbot-nginx firewalld

# Install Node.js 20.x
echo "[4/10] Installing Node.js 20.x..."
dnf module reset nodejs -y 2>/dev/null || true
dnf module enable nodejs:20 -y 2>/dev/null || true
dnf install -y nodejs npm || {
    curl -fsSL https://rpm.nodesource.com/setup_20.x | bash -
    dnf install -y nodejs
}

# Install PM2 globally
echo "[5/10] Installing PM2..."
npm install -g pm2

# Install Docker
echo "[6/10] Installing Docker..."
dnf config-manager --add-repo https://download.docker.com/linux/centos/docker-ce.repo
dnf install -y docker-ce docker-ce-cli containerd.io docker-compose-plugin
systemctl enable docker
systemctl start docker

# Configure firewall
echo "[7/10] Configuring firewall..."
systemctl enable firewalld
systemctl start firewalld
firewall-cmd --permanent --add-service=http
firewall-cmd --permanent --add-service=https
firewall-cmd --permanent --add-service=ssh
firewall-cmd --reload

# Enable and start Nginx
echo "[8/10] Setting up Nginx..."
systemctl enable nginx
systemctl start nginx

# Set SELinux to allow Nginx proxy
echo "[9/10] Configuring SELinux..."
setsebool -P httpd_can_network_connect 1 2>/dev/null || true

# Clone repository
echo "[10/10] Cloning repository..."
mkdir -p $APP_DIR
if [ -d "$APP_DIR/.git" ]; then
    cd $APP_DIR && git pull origin main
else
    git clone $REPO_URL $APP_DIR
fi
cd $APP_DIR

# Copy production environment file
cp deploy/.env.production .env

# Create certbot webroot directory
mkdir -p /var/www/certbot

# Setup Nginx temporary config
cat > /etc/nginx/conf.d/united-exchange.conf << 'NGINX'
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

# Remove default nginx page
rm -f /etc/nginx/conf.d/default.conf 2>/dev/null || true

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
echo "   cd $APP_DIR && ./deploy/scripts/start-production-almalinux.sh"
echo ""
echo "============================================"
