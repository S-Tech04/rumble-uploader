#!/bin/bash

set -e

echo "================================"
echo "Rumble Video Uploader Setup"
echo "================================"
echo ""

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
NC='\033[0m' # No Color

# Function to generate random secret
generate_secret() {
    openssl rand -base64 32 2>/dev/null || cat /dev/urandom | tr -dc 'a-zA-Z0-9' | fold -w 32 | head -n 1
}

# Check if Node.js is installed
echo -e "${YELLOW}Checking Node.js installation...${NC}"
if command -v node &> /dev/null; then
    NODE_VERSION=$(node -v | cut -d'v' -f2 | cut -d'.' -f1)
    echo -e "${GREEN}Node.js $(node -v) is installed${NC}"
    
    if [ "$NODE_VERSION" -lt 18 ]; then
        echo -e "${YELLOW}Node.js version is below 18. Installing Node.js 24...${NC}"
        INSTALL_NODE=true
    else
        INSTALL_NODE=false
    fi
else
    echo -e "${YELLOW}Node.js is not installed. Installing Node.js 24...${NC}"
    INSTALL_NODE=true
fi

# Install Node.js 24 if needed
if [ "$INSTALL_NODE" = true ]; then
    if [ -f /etc/debian_version ]; then
        # Debian/Ubuntu
        echo -e "${YELLOW}Installing Node.js 24 on Debian/Ubuntu...${NC}"
        curl -fsSL https://deb.nodesource.com/setup_24.x | sudo -E bash -
        sudo apt-get install -y nodejs
    elif [ -f /etc/redhat-release ]; then
        # RHEL/CentOS/Fedora
        echo -e "${YELLOW}Installing Node.js 24 on RHEL/CentOS/Fedora...${NC}"
        curl -fsSL https://rpm.nodesource.com/setup_24.x | sudo bash -
        sudo yum install -y nodejs
    else
        echo -e "${RED}Unsupported OS. Please install Node.js 24 manually from https://nodejs.org/${NC}"
        exit 1
    fi
    
    echo -e "${GREEN}Node.js $(node -v) installed successfully${NC}"
fi

# Check npm
if ! command -v npm &> /dev/null; then
    echo -e "${RED}npm is not installed. Please install Node.js properly.${NC}"
    exit 1
fi

# Install Chrome/Chromium for Puppeteer
echo ""
echo -e "${YELLOW}Installing Chrome/Chromium for web scraping...${NC}"
if [ -f /etc/debian_version ]; then
    # Debian/Ubuntu
    echo -e "${YELLOW}Installing Chrome on Debian/Ubuntu...${NC}"
    
    # Install Chrome dependencies
    sudo apt-get update
    sudo apt-get install -y wget gnupg ca-certificates
    
    # Check if Chrome is already installed
    if command -v google-chrome-stable &> /dev/null; then
        echo -e "${GREEN}Google Chrome is already installed${NC}"
    else
        # Add Chrome repo
        wget -qO- https://dl.google.com/linux/linux_signing_key.pub | sudo gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg
        echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" | sudo tee /etc/apt/sources.list.d/google-chrome.list
        
        # Install Chrome
        sudo apt-get update
        sudo apt-get install -y google-chrome-stable
        
        if command -v google-chrome-stable &> /dev/null; then
            echo -e "${GREEN}Google Chrome installed successfully${NC}"
        else
            echo -e "${YELLOW}Chrome installation failed, trying Chromium...${NC}"
            sudo apt-get install -y chromium-browser || sudo apt-get install -y chromium
        fi
    fi
elif [ -f /etc/redhat-release ]; then
    # RHEL/CentOS/Fedora
    echo -e "${YELLOW}Installing Chrome on RHEL/CentOS/Fedora...${NC}"
    
    if command -v google-chrome-stable &> /dev/null; then
        echo -e "${GREEN}Google Chrome is already installed${NC}"
    else
        cat <<EOF | sudo tee /etc/yum.repos.d/google-chrome.repo
[google-chrome]
name=google-chrome
baseurl=http://dl.google.com/linux/chrome/rpm/stable/x86_64
enabled=1
gpgcheck=1
gpgkey=https://dl.google.com/linux/linux_signing_key.pub
EOF
        sudo yum install -y google-chrome-stable || sudo dnf install -y google-chrome-stable
        
        if ! command -v google-chrome-stable &> /dev/null; then
            echo -e "${YELLOW}Chrome installation failed, trying Chromium...${NC}"
            sudo yum install -y chromium || sudo dnf install -y chromium
        fi
    fi
else
    echo -e "${YELLOW}Could not detect OS. Attempting to install Chromium...${NC}"
    if command -v apt-get &> /dev/null; then
        sudo apt-get install -y chromium-browser || sudo apt-get install -y chromium
    elif command -v yum &> /dev/null; then
        sudo yum install -y chromium || sudo dnf install -y chromium
    else
        echo -e "${YELLOW}Could not install Chrome automatically. Please install Chrome or Chromium manually.${NC}"
    fi
fi

# Detect Chrome path and store it
CHROME_PATH=""
if [ -f "/usr/bin/google-chrome-stable" ]; then
    CHROME_PATH="/usr/bin/google-chrome-stable"
elif [ -f "/usr/bin/google-chrome" ]; then
    CHROME_PATH="/usr/bin/google-chrome"
elif [ -f "/usr/bin/chromium-browser" ]; then
    CHROME_PATH="/usr/bin/chromium-browser"
elif [ -f "/usr/bin/chromium" ]; then
    CHROME_PATH="/usr/bin/chromium"
fi

if [ -n "$CHROME_PATH" ]; then
    echo -e "${GREEN}Chrome found at: $CHROME_PATH${NC}"
else
    echo -e "${YELLOW}Warning: Chrome not found. You may need to install it manually.${NC}"
fi

# Install PM2 globally if not already installed
echo -e "${YELLOW}Checking PM2 installation...${NC}"
if ! command -v pm2 &> /dev/null; then
    echo -e "${YELLOW}Installing PM2...${NC}"
    sudo npm install -g pm2
    echo -e "${GREEN}PM2 installed successfully${NC}"
else
    echo -e "${GREEN}PM2 is already installed${NC}"
fi

# Prompt for configuration
echo ""
echo -e "${YELLOW}Configuration Setup${NC}"
echo -e "${YELLOW}Press Enter to use default values shown in [brackets]${NC}"
echo ""

# API URL
read -p "Enter API Base URL [https://anime-api-itzzzme.vercel.app/api]: " API_BASE
API_BASE=${API_BASE:-"https://anime-api-itzzzme.vercel.app/api"}

# Rumble Upload Host
read -p "Enter Rumble Upload Host [https://web17.rumble.com]: " RUMBLE_UPLOAD_HOST
RUMBLE_UPLOAD_HOST=${RUMBLE_UPLOAD_HOST:-"https://web17.rumble.com"}

# Auth Password
read -sp "Enter Authentication Password [admin123]: " AUTH_PASSWORD
echo ""
AUTH_PASSWORD=${AUTH_PASSWORD:-"admin123"}

# JWT Secrets (generate automatically)
echo -e "${YELLOW}Generating JWT secrets...${NC}"
JWT_SECRET=$(generate_secret)
JWT_REFRESH_SECRET=$(generate_secret)
echo -e "${GREEN}JWT secrets generated${NC}"

# Create .env file
echo -e "${YELLOW}Creating .env file...${NC}"
cat > .env << EOF
JWT_SECRET=${JWT_SECRET}
JWT_REFRESH_SECRET=${JWT_REFRESH_SECRET}
AUTH_PASSWORD=${AUTH_PASSWORD}
API_BASE=${API_BASE}
RUMBLE_UPLOAD_HOST=${RUMBLE_UPLOAD_HOST}
CHROME_PATH=${CHROME_PATH}
EOF

echo -e "${GREEN}.env file created${NC}"

# Install backend dependencies
echo ""
echo -e "${YELLOW}Installing backend dependencies...${NC}"
npm install

# Install frontend dependencies
echo -e "${YELLOW}Installing frontend dependencies...${NC}"
cd frontend
npm install
cd ..

# Create necessary directories
echo -e "${YELLOW}Creating necessary directories...${NC}"
mkdir -p temp
mkdir -p downloaded
mkdir -p public

# Build frontend (Vite builds directly to ../public)
echo -e "${YELLOW}Building frontend...${NC}"
cd frontend
if npm run build; then
    echo -e "${GREEN}Frontend built successfully${NC}"
else
    echo -e "${RED}Frontend build failed${NC}"
    cd ..
    exit 1
fi
cd ..

# Verify build output
if [ -d "public" ] && [ "$(ls -A public 2>/dev/null)" ]; then
    echo -e "${GREEN}Frontend build verified in public directory${NC}"
else
    echo -e "${RED}Error: Build output not found in public directory${NC}"
    exit 1
fi

# Stop existing PM2 processes if any
echo -e "${YELLOW}Stopping existing PM2 processes...${NC}"
pm2 delete rumble 2>/dev/null || true

# Start application with PM2
echo -e "${YELLOW}Starting application with PM2...${NC}"
pm2 start server.js --name rumble --time

# Save PM2 configuration
echo -e "${YELLOW}Saving PM2 configuration...${NC}"
pm2 save

# Setup PM2 to start on system boot
echo -e "${YELLOW}Setting up PM2 startup script...${NC}"
pm2 startup | grep -oP 'sudo .+' | sh || echo -e "${YELLOW}Note: Run the command above with sudo to enable PM2 on system startup${NC}"

echo ""
echo -e "${GREEN}================================${NC}"
echo -e "${GREEN}Setup completed successfully!${NC}"
echo -e "${GREEN}================================${NC}"
echo ""
echo -e "Application is running on: ${GREEN}http://localhost:3000${NC}"
echo ""
echo -e "Useful PM2 commands:"
echo -e "  ${YELLOW}pm2 status${NC}          - Check application status"
echo -e "  ${YELLOW}pm2 logs rumble${NC}     - View application logs"
echo -e "  ${YELLOW}pm2 restart rumble${NC}  - Restart application"
echo -e "  ${YELLOW}pm2 stop rumble${NC}     - Stop application"
echo -e "  ${YELLOW}pm2 delete rumble${NC}   - Remove application from PM2"
echo ""
echo -e "Configuration:"
echo -e "  API Base: ${GREEN}${API_BASE}${NC}"
echo -e "  Rumble Host: ${GREEN}${RUMBLE_UPLOAD_HOST}${NC}"
echo -e "  Password: ${GREEN}${AUTH_PASSWORD}${NC}"
echo ""
