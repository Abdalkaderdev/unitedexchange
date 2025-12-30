#!/bin/bash
# Deployment script for United Exchange
# Usage: ./deploy.sh [production|staging]

set -e

ENV=${1:-production}
APP_DIR="/var/www/united-exchange"
BACKUP_DIR="/var/backups/united-exchange"

echo "=== United Exchange Deployment ==="
echo "Environment: $ENV"
echo "Time: $(date)"

# Create backup
echo "Creating backup..."
mkdir -p $BACKUP_DIR
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
tar -czf "$BACKUP_DIR/backup_$TIMESTAMP.tar.gz" -C $APP_DIR . 2>/dev/null || true

# Pull latest code
echo "Pulling latest code..."
cd $APP_DIR
git pull origin main

# Backend deployment
echo "Deploying backend..."
cd $APP_DIR/backend
npm ci --only=production

# Run migrations
echo "Running database migrations..."
npm run migrate 2>/dev/null || echo "No migration script found"

# Build frontend
echo "Building frontend..."
cd $APP_DIR/frontend
npm ci
npm run build

# Restart services
echo "Restarting services..."
pm2 reload ecosystem.config.js --env $ENV

# Reload nginx
echo "Reloading nginx..."
sudo nginx -t && sudo systemctl reload nginx

# Cleanup old backups (keep last 5)
echo "Cleaning old backups..."
ls -t $BACKUP_DIR/backup_*.tar.gz | tail -n +6 | xargs rm -f 2>/dev/null || true

echo "=== Deployment Complete ==="
echo "Time: $(date)"
