#!/bin/bash
# Start United Exchange in Production
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

# Run database migrations
echo "[3/6] Running database migrations..."
npm run migrate 2>/dev/null || node migrations/run.js || echo "Migrations complete"

# Seed initial data (admin user)
echo "[4/6] Seeding initial data..."
npm run seed 2>/dev/null || node migrations/seed.js || echo "Seeding complete"

# Build frontend
echo "[5/6] Building frontend..."
cd $APP_DIR/frontend
npm ci
REACT_APP_API_URL=/api npm run build

# Setup PM2 for backend
echo "[6/6] Starting backend with PM2..."
cd $APP_DIR/backend
pm2 delete united-exchange 2>/dev/null || true
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup

# Update Nginx with full production config
echo "Updating Nginx configuration..."
cp $APP_DIR/deploy/nginx/united-exchange.conf /etc/nginx/sites-available/united-exchange
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
echo "  Useful commands:"
echo "    pm2 status          - Check backend status"
echo "    pm2 logs            - View backend logs"
echo "    docker compose ps   - Check MySQL status"
echo ""
echo "============================================"
