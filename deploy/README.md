# United Exchange - Deployment Guide

## Server Requirements
- Ubuntu 20.04 LTS or later
- Node.js 18.x
- MySQL 8.0
- Nginx
- PM2
- 2GB RAM minimum
- 20GB disk space

## Initial Server Setup

```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Node.js 18
curl -fsSL https://deb.nodesource.com/setup_18.x | sudo -E bash -
sudo apt install -y nodejs

# Install MySQL
sudo apt install -y mysql-server
sudo mysql_secure_installation

# Install Nginx
sudo apt install -y nginx

# Install PM2
sudo npm install -g pm2

# Create app directory
sudo mkdir -p /var/www/united-exchange
sudo chown $USER:$USER /var/www/united-exchange
```

## Database Setup

```bash
# Login to MySQL
sudo mysql

# Create database and user
CREATE DATABASE united_exchange;
CREATE USER 'exchange_user'@'localhost' IDENTIFIED BY 'secure_password';
GRANT ALL PRIVILEGES ON united_exchange.* TO 'exchange_user'@'localhost';
FLUSH PRIVILEGES;
EXIT;

# Run migrations
cd /var/www/united-exchange/backend
mysql -u exchange_user -p united_exchange < migrations/production_schema.sql
mysql -u exchange_user -p united_exchange < migrations/003_customers.sql
mysql -u exchange_user -p united_exchange < migrations/004_cash_drawer.sql
mysql -u exchange_user -p united_exchange < migrations/005_shifts.sql
mysql -u exchange_user -p united_exchange < migrations/006_compliance.sql
```

## Application Deployment

```bash
# Clone repository
cd /var/www/united-exchange
git clone <your-repo-url> .

# Backend setup
cd backend
cp .env.example .env
nano .env  # Configure environment variables
npm ci --only=production

# Frontend setup
cd ../frontend
npm ci
npm run build

# Start with PM2
cd ../backend
pm2 start ecosystem.config.js --env production
pm2 save
pm2 startup
```

## Nginx Configuration

```bash
# Copy nginx config
sudo cp deploy/nginx/united-exchange.conf /etc/nginx/sites-available/
sudo ln -s /etc/nginx/sites-available/united-exchange.conf /etc/nginx/sites-enabled/

# Edit domain name
sudo nano /etc/nginx/sites-available/united-exchange.conf

# Test and reload
sudo nginx -t
sudo systemctl reload nginx
```

## SSL Setup (Let's Encrypt)

```bash
# Install Certbot
sudo apt install -y certbot python3-certbot-nginx

# Get certificate
sudo certbot --nginx -d your-domain.com -d www.your-domain.com

# Auto-renewal is set up automatically
```

## Automated Backups

```bash
# Make backup script executable
chmod +x deploy/scripts/backup.sh

# Add to crontab (daily at 2 AM)
crontab -e
0 2 * * * /var/www/united-exchange/deploy/scripts/backup.sh
```

## Monitoring

```bash
# PM2 monitoring
pm2 monit

# View logs
pm2 logs

# Check health
curl http://localhost:5000/api/health
```

## Troubleshooting

### Backend not starting
```bash
pm2 logs united-exchange-api --lines 100
```

### Database connection issues
```bash
mysql -u exchange_user -p -e "SELECT 1"
```

### Nginx errors
```bash
sudo nginx -t
sudo tail -f /var/log/nginx/error.log
```
