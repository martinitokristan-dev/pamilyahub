#!/bin/sh

# Clear old caches first to prevent stale data
php artisan config:clear
php artisan route:clear

# Rebuild caches
php artisan config:cache
php artisan route:cache

# Run migrations (creates note_folders, incomes tables if missing)
php artisan migrate --force

# Ensure storage directories exist and are writable
php artisan storage:link 2>/dev/null || true
mkdir -p /var/www/storage/framework/cache/data
chown -R www-data:www-data /var/www/storage/framework/cache

php-fpm -D
nginx -g "daemon off;"
