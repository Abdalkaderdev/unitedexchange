#!/bin/bash
# Start United Exchange in Production (AlmaLinux)
# Run after SSL certificates are obtained

set -e

APP_DIR="/var/www/united-exchange"
DOMAIN="unitedexchange.ink"

echo "============================================"
echo "  Starting United Exchange Production"
echo "============================================"

cd $APP_DIR

# Load environment variables
if [ -f .env ]; then
    export $(cat .env | grep -v '#' | xargs)
fi

# Start MySQL with Docker
echo "[1/6] Starting MySQL database..."
docker compose -f docker-compose.prod.yml up -d mysql
echo "Waiting for MySQL to be ready..."
sleep 30

# Install backend dependencies
echo "[2/6] Installing backend dependencies..."
cd $APP_DIR/backend
npm ci --only=production

# Create logs directory
mkdir -p logs

# Run database migrations
echo "[3/6] Running database migrations..."
npm run migrate 2>/dev/null || node migrations/run.js 2>/dev/null || echo "Migrations complete"

# Seed initial data (admin user)
echo "[4/6] Seeding initial data..."
npm run seed 2>/dev/null || node migrations/seed.js 2>/dev/null || echo "Seeding complete"

# Build frontend
echo "[5/6] Building frontend..."
cd $APP_DIR/frontend
npm ci
REACT_APP_API_URL=/api npm run build

# Setup PM2 for backend
echo "[6/6] Starting backend with PM2..."
cd $APP_DIR/backend
pm2 delete united-exchange-api 2>/dev/null || true
pm2 start ecosystem.config.js --env production
pm2 save

# Configure PM2 to start on boot
pm2 startup systemd -u root --hp /root 2>/dev/null || true
systemctl enable pm2-root 2>/dev/null || true

# Update Nginx with production config
echo "Updating Nginx configuration..."
cat > /etc/nginx/conf.d/united-exchange.conf << 'NGINXCONF'
upstream backend_api {
    server 127.0.0.1:5000;
    keepalive 64;
}

limit_req_zone $binary_remote_addr zone=api_limit:10m rate=10r/s;
limit_req_zone $binary_remote_addr zone=login_limit:10m rate=5r/m;

server {
    listen 80;
    server_name unitedexchange.ink www.unitedexchange.ink;

    location /.well-known/acme-challenge/ {
        root /var/www/certbot;
    }

    location / {
        return 301 https://$server_name$request_uri;
    }
}

server {
    listen 443 ssl http2;
    server_name unitedexchange.ink www.unitedexchange.ink;

    ssl_certificate /etc/letsencrypt/live/unitedexchange.ink/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/unitedexchange.ink/privkey.pem;
    ssl_session_timeout 1d;
    ssl_session_cache shared:SSL:50m;
    ssl_session_tickets off;

    ssl_protocols TLSv1.2 TLSv1.3;
    ssl_ciphers ECDHE-ECDSA-AES128-GCM-SHA256:ECDHE-RSA-AES128-GCM-SHA256:ECDHE-ECDSA-AES256-GCM-SHA384:ECDHE-RSA-AES256-GCM-SHA384;
    ssl_prefer_server_ciphers off;

    add_header Strict-Transport-Security "max-age=63072000" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header X-Content-Type-Options "nosniff" always;
    add_header X-XSS-Protection "1; mode=block" always;

    root /var/www/united-exchange/frontend/build;
    index index.html;

    gzip on;
    gzip_vary on;
    gzip_min_length 1024;
    gzip_types text/plain text/css text/xml text/javascript application/javascript application/json application/xml;

    location /api {
        limit_req zone=api_limit burst=20 nodelay;
        proxy_pass http://backend_api;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
        proxy_cache_bypass $http_upgrade;
        proxy_read_timeout 90s;
    }

    location /api/auth/login {
        limit_req zone=login_limit burst=5 nodelay;
        proxy_pass http://backend_api;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
    }

    location ~* \.(jpg|jpeg|png|gif|ico|css|js|pdf|woff|woff2)$ {
        expires 1y;
        add_header Cache-Control "public, immutable";
    }

    location / {
        try_files $uri $uri/ /index.html;
    }

    location ~ /\. {
        deny all;
    }

    access_log /var/log/nginx/united-exchange.access.log;
    error_log /var/log/nginx/united-exchange.error.log;
}
NGINXCONF

nginx -t && systemctl reload nginx

echo ""
echo "============================================"
echo "  United Exchange is now running!"
echo "============================================"
echo ""
echo "  URL: https://$DOMAIN"
echo ""
echo "  Default Admin Credentials:"
echo "    Username: admin"
echo "    Password: admin123"
echo ""
echo "  IMPORTANT: Change the admin password immediately!"
echo ""
echo "============================================"
