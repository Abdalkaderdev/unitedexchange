# United Exchange - VPS Deployment Guide

## Target Server
- **Provider**: Namecheap Pulsar VPS
- **Domain**: unitedexchange.ink
- **OS**: Ubuntu 22.04 LTS (recommended)

## Quick Start

### Step 1: Initial VPS Setup

SSH into your VPS and run:

```bash
# Download and run the setup script
curl -fsSL https://raw.githubusercontent.com/Abdalkaderdev/unitedexchange/main/deploy/scripts/vps-setup.sh | bash
```

Or manually:

```bash
# Clone the repository
git clone https://github.com/Abdalkaderdev/unitedexchange.git /var/www/united-exchange
cd /var/www/united-exchange

# Make scripts executable
chmod +x deploy/scripts/*.sh

# Run initial setup
./deploy/scripts/vps-setup.sh
```

### Step 2: Configure DNS

In Namecheap DNS settings, add:

| Type | Host | Value | TTL |
|------|------|-------|-----|
| A | @ | YOUR_VPS_IP | Auto |
| A | www | YOUR_VPS_IP | Auto |

Wait 5-30 minutes for DNS propagation.

### Step 3: SSL Certificate

Once DNS is active:

```bash
certbot --nginx -d unitedexchange.ink -d www.unitedexchange.ink
```

### Step 4: Start Application

```bash
cd /var/www/united-exchange
./deploy/scripts/start-production.sh
```

## Default Credentials

After deployment, login with:
- **Username**: admin
- **Password**: admin123

⚠️ **CHANGE THIS IMMEDIATELY** after first login!

## Configuration

### Environment Variables

Edit `/var/www/united-exchange/.env`:

```bash
# Database (auto-configured)
DB_ROOT_PASSWORD=your_secure_password
DB_NAME=united_exchange
DB_USER=ue_admin
DB_PASSWORD=your_db_password

# JWT Secrets (MUST CHANGE IN PRODUCTION)
JWT_ACCESS_SECRET=your-very-long-random-string-here
JWT_REFRESH_SECRET=another-very-long-random-string-here

# Email for scheduled reports
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your-email@gmail.com
SMTP_PASS=your-app-password
SMTP_FROM=noreply@unitedexchange.ink
```

### Generate Secure Secrets

```bash
# Generate JWT secrets
openssl rand -base64 64
```

## Management Commands

### Application Status
```bash
pm2 status                    # Backend status
pm2 logs                      # Backend logs
pm2 logs --lines 100          # Last 100 log lines
docker compose -f docker-compose.prod.yml ps  # MySQL status
```

### Restart Services
```bash
pm2 restart united-exchange-api   # Restart backend
docker compose -f docker-compose.prod.yml restart mysql  # Restart MySQL
sudo systemctl reload nginx       # Reload Nginx
```

### Update Application
```bash
cd /var/www/united-exchange
git pull origin main
./deploy/scripts/deploy.sh production
```

### Database Backup
```bash
./deploy/scripts/backup.sh
```

### View Logs
```bash
# Backend logs
tail -f /var/www/united-exchange/backend/logs/pm2-combined.log

# Nginx logs
tail -f /var/log/nginx/united-exchange.access.log
tail -f /var/log/nginx/united-exchange.error.log

# MySQL logs
docker compose -f docker-compose.prod.yml logs mysql
```

## Troubleshooting

### Backend won't start
```bash
# Check logs
pm2 logs united-exchange-api --lines 50

# Check if MySQL is running
docker compose -f docker-compose.prod.yml ps

# Test database connection
docker exec -it united_exchange_db mysql -u ue_admin -p
```

### Nginx errors
```bash
# Test configuration
nginx -t

# Check error log
tail -50 /var/log/nginx/error.log
```

### SSL certificate renewal
```bash
# Test renewal
certbot renew --dry-run

# Force renewal
certbot renew --force-renewal
```

## Architecture

```
                    ┌─────────────────┐
                    │   Cloudflare    │
                    │   (Optional)    │
                    └────────┬────────┘
                             │
                    ┌────────▼────────┐
                    │     Nginx       │
                    │  :80 → :443     │
                    │   SSL/HTTPS     │
                    └────────┬────────┘
                             │
            ┌────────────────┴────────────────┐
            │                                 │
    ┌───────▼───────┐                ┌───────▼───────┐
    │   Frontend    │                │    /api/*     │
    │  Static Files │                │    Proxy      │
    │  React Build  │                └───────┬───────┘
    └───────────────┘                        │
                                    ┌────────▼────────┐
                                    │    Backend      │
                                    │  Node.js/PM2    │
                                    │    :5000        │
                                    └────────┬────────┘
                                             │
                                    ┌────────▼────────┐
                                    │     MySQL       │
                                    │    Docker       │
                                    │    :3306        │
                                    └─────────────────┘
```

## Security Checklist

- [ ] Changed default admin password
- [ ] Updated JWT secrets in .env
- [ ] Configured firewall (UFW)
- [ ] SSL certificate installed
- [ ] Disabled root SSH login
- [ ] Set up automatic security updates
- [ ] Configured backup schedule
- [ ] Set up monitoring (optional)

## Support

For issues, check:
1. Application logs: `pm2 logs`
2. Nginx logs: `/var/log/nginx/`
3. MySQL logs: `docker compose logs mysql`
