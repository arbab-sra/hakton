#!/usr/bin/env bash

# Exit immediately if a command exits with a non-zero status
set -e

echo "===================================================="
echo "🛡️  CodeMRI EC2 Pre-requisites Installer Script"
echo "===================================================="

# Detect OS distribution
if [ -f /etc/os-release ]; then
    . /etc/os-release
    OS=$NAME
else
    OS=$(uname -s)
fi

echo "📋 Detected OS: $OS"

# 1. Setup Swap file if it doesn't exist (critical for small EC2 instances with 1GB RAM)
if [ ! -f /swapfile ] && [ -z "$(sudo swapon --show)" ]; then
    echo "💾 Configuring 2GB Swap file for RAM safety..."
    sudo fallocate -l 2G /swapfile || sudo dd if=/dev/zero of=/swapfile bs=1M count=2048
    sudo chmod 600 /swapfile
    sudo mkswap /swapfile
    sudo swapon /swapfile
    echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab
    echo "✅ Swap file created and enabled successfully!"
else
    echo "💾 Swap is already configured."
fi

# 2. Update system packages
echo "🔄 Updating system package repository..."
if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
    sudo apt-get update -y
elif [[ "$OS" == *"Amazon Linux"* ]] || [[ "$OS" == *"Red Hat"* ]] || [[ "$OS" == *"CentOS"* ]]; then
    if command -v dnf &> /dev/null; then
        sudo dnf update -y
    else
        sudo yum update -y
    fi
fi

# 3. Install Docker & Docker Compose
echo "🐳 Installing Docker & Docker Compose..."
if [[ "$OS" == *"Ubuntu"* ]] || [[ "$OS" == *"Debian"* ]]; then
    sudo apt-get install -y ca-certificates curl gnupg lsb-release
    sudo mkdir -p /etc/apt/keyrings
    
    # Remove old keyring if exists
    sudo rm -f /etc/apt/keyrings/docker.gpg
    
    curl -fsSL https://download.docker.com/linux/ubuntu/gpg | sudo gpg --dearmor -o /etc/apt/keyrings/docker.gpg
    
    echo \
      "deb [arch=$(dpkg --print-architecture) signed-by=/etc/apt/keyrings/docker.gpg] https://download.docker.com/linux/ubuntu \
      $(lsb_release -cs) stable" | sudo tee /etc/apt/sources.list.d/docker.list > /dev/null
      
    sudo apt-get update -y
    sudo apt-get install -y docker-ce docker-ce-cli containerd.io docker-buildx-plugin docker-compose-plugin
    
elif [[ "$OS" == *"Amazon Linux"* ]]; then
    if [[ "$VERSION_ID" == "2" ]]; then
        sudo amazon-linux-extras install docker -y
    else
        sudo dnf install -y docker
    fi
    sudo systemctl enable docker
    sudo systemctl start docker
    
    # Install Docker Compose CLI plugin
    sudo mkdir -p /usr/local/lib/docker/cli-plugins
    sudo curl -SL https://github.com/docker/compose/releases/latest/download/docker-compose-linux-x86_64 -o /usr/local/lib/docker/cli-plugins/docker-compose
    sudo chmod +x /usr/local/lib/docker/cli-plugins/docker-compose
    
    # Add symlink for standalone docker compose command compatibility
    sudo ln -sf /usr/local/lib/docker/cli-plugins/docker-compose /usr/local/bin/docker-compose
fi

# Add current user to docker group
echo "👤 Adding $USER to docker group..."
sudo usermod -aG docker $USER || true

# 4. Install Node.js (via NVM - Node Version Manager)
echo "🟢 Installing Node Version Manager (NVM) & Node.js 22..."
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.39.7/install.sh | bash

# Load NVM into current bash context
export NVM_DIR="$HOME/.nvm"
[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"
[ -s "$NVM_DIR/bash_completion" ] && \. "$NVM_DIR/bash_completion"

nvm install 22
nvm use 22
nvm alias default 22

# Verify Node installation
echo "✅ Node.js version: $(node -v)"
echo "✅ NPM version: $(npm -v)"

# 5. Install Global npm packages (pnpm & pm2)
echo "📦 Installing pnpm and pm2 globally..."
npm install -g pnpm pm2

# 6. Output Verification
echo "===================================================="
echo "🎉 Installation Completed Successfully!"
echo "===================================================="
echo "🐳 Docker: $(docker --version)"
if docker compose version &> /dev/null; then
    echo "🐳 Docker Compose: $(docker compose version)"
else
    echo "🐳 Docker Compose: $(docker-compose --version || echo 'Standalone Docker Compose plugin')"
fi
echo "🟢 Node.js: $(node -v)"
echo "📦 pnpm: $(pnpm -v)"
echo "🚀 PM2: $(pm2 -v)"
echo "===================================================="
echo "⚠️ IMPORTANT: Please run 'newgrp docker' or log out and log back in"
echo "   for your user group modifications to take effect so you can use Docker without sudo."
echo "===================================================="
