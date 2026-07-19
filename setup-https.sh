#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

# Load NVM (Node Version Manager) environment if available
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

echo "===================================================="
echo "🔒 CodeMRI EC2 HTTPS (SSL) Setup Script"
echo "===================================================="

# Detect OS distribution
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
else
    OS=$(uname -s)
fi

# Fetch public IP address
PUBLIC_IP=$(curl -s https://api.ipify.org || echo "15.206.160.40")
DEFAULT_DOMAIN="${PUBLIC_IP}.sslip.io"

echo "📋 Detected OS: $OS"
echo "📋 Detected Public IP: $PUBLIC_IP"
echo "💡 You can use the free wildcard domain: $DEFAULT_DOMAIN"
echo "===================================================="

# Prompt for Domain Name (using non-interactive default if run inside non-interactive shells)
DOMAIN=${1:-$DEFAULT_DOMAIN}
EMAIL=${2:-"admin@$DOMAIN"}

echo "🌐 Domain Name target: $DOMAIN"
echo "📧 Let's Encrypt Email: $EMAIL"
echo "===================================================="

# 1. Install Nginx and Certbot dependencies
echo "🔄 Installing Nginx and Certbot..."
if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
    sudo apt-get update -y
    sudo apt-get install -y nginx certbot python3-certbot-nginx
elif [[ "$OS" == *"Amazon Linux"* ]]; then
    sudo dnf install -y nginx certbot python3-certbot-nginx || sudo yum install -y nginx certbot python3-certbot-nginx
fi

# 2. Write Nginx Reverse Proxy Server Block Configuration
echo "⚙️ Configuring Nginx reverse proxy..."
NGINX_CONF="/etc/nginx/sites-available/codemri"
NGINX_LINK="/etc/nginx/sites-enabled/codemri"

# Setup configuration for sites-available/sites-enabled structure (Ubuntu/Debian standard)
if [ -d /etc/nginx/sites-available ]; then
    sudo tee "$NGINX_CONF" > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
    # Remove default Nginx block link if present and enable our configuration block
    sudo rm -f /etc/nginx/sites-enabled/default
    sudo ln -sf "$NGINX_CONF" "$NGINX_LINK"
else
    # Amazon Linux / RedHat standard (direct integration in nginx.conf or conf.d)
    sudo tee "/etc/nginx/conf.d/codemri.conf" > /dev/null <<EOF
server {
    listen 80;
    server_name $DOMAIN;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host \$host;
        proxy_cache_bypass \$http_upgrade;
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto \$scheme;
    }
}
EOF
fi

# Enable and test Nginx configuration
sudo systemctl enable nginx
sudo systemctl restart nginx
sudo nginx -t

# 3. Request SSL Certificate from Let's Encrypt via Certbot
if [ -d "/etc/letsencrypt/live/$DOMAIN" ]; then
    echo "🔒 SSL certificate for $DOMAIN already exists. Skipping Certbot request..."
else
    echo "🔑 Requesting Let's Encrypt SSL certificate..."
    # Obtain certificate and let Certbot configure Nginx automatically
    sudo certbot --nginx --non-interactive --agree-tos --email "$EMAIL" -d "$DOMAIN" --redirect
fi

# 4. Restart Nginx to load SSL
echo "🔄 Reloading Nginx with SSL certificate active..."
sudo systemctl restart nginx

# 5. Automatically update NEXT_PUBLIC_APP_URL inside the local .env
ENV_FILE="./.env"
if [ -f "$ENV_FILE" ]; then
    echo "📝 Updating NEXT_PUBLIC_APP_URL inside $ENV_FILE to https://$DOMAIN..."
    # Replace NEXT_PUBLIC_APP_URL matching line with the new HTTPS URL
    sudo sed -i "s|NEXT_PUBLIC_APP_URL=.*|NEXT_PUBLIC_APP_URL=https://$DOMAIN|g" "$ENV_FILE"
    
    # Reload web server under PM2 control to apply configuration updates
    if command -v pm2 &> /dev/null; then
        echo "🚀 Restarting pm2 server to apply HTTPS variables..."
        pm2 restart codemri-web || true
    fi
fi

echo "===================================================="
echo "🎉 HTTPS SSL Configuration Completed Successfully!"
echo "👉 Your app is now secure at: https://$DOMAIN"
echo "⚠️ IMPORTANT: Please ensure port 443 (HTTPS) is allowed in your EC2 Security Groups!"
echo "===================================================="
