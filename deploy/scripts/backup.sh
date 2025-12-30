#!/bin/bash
# Database backup script for United Exchange
# Add to crontab: 0 2 * * * /path/to/backup.sh

set -e

# Configuration
DB_NAME="${DB_NAME:-united_exchange}"
DB_USER="${DB_USER:-exchange_user}"
DB_PASSWORD="${DB_PASSWORD:-your_password}"
BACKUP_DIR="/var/backups/united-exchange/db"
RETENTION_DAYS=30

# Create backup directory
mkdir -p $BACKUP_DIR

# Generate filename
TIMESTAMP=$(date +%Y%m%d_%H%M%S)
BACKUP_FILE="$BACKUP_DIR/${DB_NAME}_${TIMESTAMP}.sql.gz"

echo "=== Database Backup ==="
echo "Database: $DB_NAME"
echo "Time: $(date)"

# Create backup
echo "Creating backup..."
mysqldump -u $DB_USER -p$DB_PASSWORD $DB_NAME | gzip > $BACKUP_FILE

# Verify backup
if [ -f "$BACKUP_FILE" ]; then
    SIZE=$(ls -lh $BACKUP_FILE | awk '{print $5}')
    echo "Backup created: $BACKUP_FILE ($SIZE)"
else
    echo "ERROR: Backup failed!"
    exit 1
fi

# Clean old backups
echo "Cleaning backups older than $RETENTION_DAYS days..."
find $BACKUP_DIR -name "*.sql.gz" -mtime +$RETENTION_DAYS -delete

echo "=== Backup Complete ==="
