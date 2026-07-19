#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

# Load NVM (Node Version Manager) environment if available
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"

echo "===================================================="
# Output CodeMRI EC2 PM2 Deployment Banner
echo "🧠🔍 Starting CodeMRI EC2 PM2 Deployment & Run"
echo "===================================================="

# 1. Environment Check
if [ ! -f .env ]; then
  if [ -f .env.example ]; then
    echo "⚠️ .env file not found. Copying from .env.example..."
    cp .env.example .env
    echo "⚠️ Created default .env. Please configure your secrets inside .env!"
  else
    echo "❌ Error: Neither .env nor .env.example found. Please create a .env file."
    exit 1
  fi
fi

# 2. Start Database and Redis services via Docker Compose
echo "🐳 Starting Postgres and Redis containers..."
sudo docker compose up -d postgres redis || sudo docker-compose up -d postgres redis || docker compose up -d postgres redis

# 3. Install Workspace dependencies
echo "📦 Installing workspace dependencies via pnpm..."
pnpm install

# 4. Build Workspace packages (Shared modules & Next.js frontend)
echo "🛠️ Building packages, frontend, and worker..."
pnpm build

# 5. Sync and run database migrations
echo "🗄️ Running database schema generation and migrations..."
pnpm db:generate
pnpm db:migrate

# 6. PM2 Process management check
if ! command -v pm2 &> /dev/null; then
  echo "⚠️ PM2 is not installed globally."
  echo "👉 Installing PM2 globally via npm..."
  sudo npm install -g pm2 || npm install -g pm2
fi

# 7. Start or reload applications under PM2 control
echo "🚀 Deploying applications with PM2..."
if pm2 list | grep -q "codemri-web"; then
  echo "🔄 Reloading existing PM2 processes..."
  pm2 reload ecosystem.config.cjs
else
  echo "🆕 Starting processes under PM2..."
  pm2 start ecosystem.config.cjs
fi

# Save PM2 process list to load on reboot
pm2 save

echo "===================================================="
echo "🎉 Deployment Successful!"
echo "📈 PM2 status:"
pm2 status
echo "===================================================="
