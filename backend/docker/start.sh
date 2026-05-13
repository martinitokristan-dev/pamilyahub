#!/bin/sh
set -e

# Run migrations FIRST — new tables must exist before route scanning
php artisan migrate --force

# Clear old caches
php artisan config:clear
php artisan route:clear
php artisan view:clear

# Rebuild caches (now aware of all tables and routes)
php artisan config:cache
php artisan route:cache

# Ensure storage directories exist and are writable
php artisan storage:link 2>/dev/null || true
mkdir -p /var/www/storage/framework/cache/data
chown -R www-data:www-data /var/www/storage/framework/cache

php-fpm -D
nginx -g "daemon off;"
