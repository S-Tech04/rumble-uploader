# Rumble Video Uploader Setup Script for Windows
# Run with: powershell -ExecutionPolicy Bypass -File setup.ps1

$ErrorActionPreference = "Stop"

Write-Host "================================" -ForegroundColor Cyan
Write-Host "Rumble Video Uploader Setup" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Function to generate random secret
function Generate-Secret {
    $bytes = New-Object byte[] 32
    [Security.Cryptography.RNGCryptoServiceProvider]::Create().GetBytes($bytes)
    return [Convert]::ToBase64String($bytes)
}

# Check if running as Administrator
$isAdmin = ([Security.Principal.WindowsPrincipal] [Security.Principal.WindowsIdentity]::GetCurrent()).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $isAdmin) {
    Write-Host "Warning: Not running as Administrator. Some operations may fail." -ForegroundColor Yellow
    Write-Host "Consider running: powershell -ExecutionPolicy Bypass -File setup.ps1 as Administrator" -ForegroundColor Yellow
    Write-Host ""
}

# Check if Node.js is installed
Write-Host "Checking Node.js installation..." -ForegroundColor Yellow
try {
    $nodeVersion = node --version
    $nodeMajor = [int]($nodeVersion -replace 'v(\d+)\..*', '$1')
    Write-Host "Node.js $nodeVersion is installed" -ForegroundColor Green
    
    if ($nodeMajor -lt 18) {
        Write-Host "Node.js version is below 18. Please install Node.js 24 manually." -ForegroundColor Yellow
        $installNode = $true
    } else {
        $installNode = $false
    }
} catch {
    Write-Host "Node.js is not installed." -ForegroundColor Yellow
    $installNode = $true
}

# Install Node.js if needed
if ($installNode) {
    Write-Host ""
    Write-Host "Node.js 24 is required. Please install it manually:" -ForegroundColor Red
    Write-Host "1. Download from: https://nodejs.org/dist/v24.0.0/node-v24.0.0-x64.msi" -ForegroundColor Yellow
    Write-Host "2. Run the installer" -ForegroundColor Yellow
    Write-Host "3. Restart PowerShell and run this script again" -ForegroundColor Yellow
    Write-Host ""
    
    $response = Read-Host "Do you want to open the download page in your browser? (Y/N)"
    if ($response -eq "Y" -or $response -eq "y") {
        Start-Process "https://nodejs.org/en/download"
    }
    exit 1
}

# Check npm
Write-Host "Checking npm installation..." -ForegroundColor Yellow
try {
    $npmVersion = npm --version
    Write-Host "npm $npmVersion is installed" -ForegroundColor Green
} catch {
    Write-Host "npm is not installed. Please install Node.js properly." -ForegroundColor Red
    exit 1
}

# Install PM2 globally if not already installed
Write-Host "Checking PM2 installation..." -ForegroundColor Yellow
try {
    $pm2Version = pm2 --version
    Write-Host "PM2 is already installed (v$pm2Version)" -ForegroundColor Green
} catch {
    Write-Host "Installing PM2..." -ForegroundColor Yellow
    npm install -g pm2
    npm install -g pm2-windows-startup
    Write-Host "PM2 installed successfully" -ForegroundColor Green
}

# Check for Chrome installation
Write-Host ""
Write-Host "Checking Chrome installation for web scraping..." -ForegroundColor Yellow
$chromePaths = @(
    "C:\Program Files\Google\Chrome\Application\chrome.exe",
    "C:\Program Files (x86)\Google\Chrome\Application\chrome.exe",
    "$env:LOCALAPPDATA\Google\Chrome\Application\chrome.exe"
)

$CHROME_PATH = ""
foreach ($path in $chromePaths) {
    if (Test-Path $path) {
        $CHROME_PATH = $path
        Write-Host "Chrome found at: $CHROME_PATH" -ForegroundColor Green
        break
    }
}

if ([string]::IsNullOrEmpty($CHROME_PATH)) {
    Write-Host "Chrome not found. Please install Google Chrome for web scraping functionality." -ForegroundColor Yellow
    Write-Host "Download from: https://www.google.com/chrome/" -ForegroundColor Yellow
    Write-Host ""
    $response = Read-Host "Do you want to open the Chrome download page? (Y/N)"
    if ($response -eq "Y" -or $response -eq "y") {
        Start-Process "https://www.google.com/chrome/"
    }
    Write-Host ""
    Write-Host "You can continue setup and install Chrome later." -ForegroundColor Yellow
    Write-Host "After installing Chrome, update CHROME_PATH in .env file." -ForegroundColor Yellow
    Write-Host ""
}

# Check for FFmpeg installation
Write-Host ""
Write-Host "Checking FFmpeg installation for video processing..." -ForegroundColor Yellow
try {
    $ffmpegVersion = ffmpeg -version 2>$null | Select-Object -First 1
    Write-Host "FFmpeg is already installed" -ForegroundColor Green
    Write-Host $ffmpegVersion -ForegroundColor Gray
} catch {
    Write-Host "FFmpeg not found. FFmpeg is required for video processing." -ForegroundColor Yellow
    Write-Host ""
    Write-Host "Please install FFmpeg manually:" -ForegroundColor Yellow
    Write-Host "1. Download from: https://www.gyan.dev/ffmpeg/builds/ffmpeg-release-essentials.zip" -ForegroundColor Cyan
    Write-Host "2. Extract to C:\ffmpeg" -ForegroundColor Cyan
    Write-Host "3. Add C:\ffmpeg\bin to your System PATH" -ForegroundColor Cyan
    Write-Host ""
    Write-Host "Or use Chocolatey (if installed): choco install ffmpeg" -ForegroundColor Cyan
    Write-Host ""
    $response = Read-Host "Do you want to open the FFmpeg download page? (Y/N)"
    if ($response -eq "Y" -or $response -eq "y") {
        Start-Process "https://www.gyan.dev/ffmpeg/builds/"
    }
    Write-Host ""
    Write-Host "WARNING: Application will not work properly without FFmpeg!" -ForegroundColor Red
    Write-Host "You can install FFmpeg later and restart the application." -ForegroundColor Yellow
    Write-Host ""
    $response = Read-Host "Do you want to continue without FFmpeg? (Y/N)"
    if ($response -ne "Y" -and $response -ne "y") {
        Write-Host "Setup cancelled. Please install FFmpeg and run setup again." -ForegroundColor Red
        exit 1
    }
}

# Prompt for configuration
Write-Host ""
Write-Host "Configuration Setup" -ForegroundColor Yellow
Write-Host "Press Enter to use default values shown in [brackets]" -ForegroundColor Yellow
Write-Host ""

# API URL
$API_BASE = Read-Host "Enter API Base URL [https://anime-api-itzzzme.vercel.app/api]"
if ([string]::IsNullOrWhiteSpace($API_BASE)) {
    $API_BASE = "https://anime-api-itzzzme.vercel.app/api"
}

# Rumble Upload Host
$RUMBLE_UPLOAD_HOST = Read-Host "Enter Rumble Upload Host [https://web17.rumble.com]"
if ([string]::IsNullOrWhiteSpace($RUMBLE_UPLOAD_HOST)) {
    $RUMBLE_UPLOAD_HOST = "https://web17.rumble.com"
}

# Auth Password
$AUTH_PASSWORD = Read-Host "Enter Authentication Password [admin123]" -AsSecureString
$AUTH_PASSWORD_PLAIN = [Runtime.InteropServices.Marshal]::PtrToStringAuto([Runtime.InteropServices.Marshal]::SecureStringToBSTR($AUTH_PASSWORD))
if ([string]::IsNullOrWhiteSpace($AUTH_PASSWORD_PLAIN)) {
    $AUTH_PASSWORD_PLAIN = "admin123"
}

# JWT Secrets (generate automatically)
Write-Host "Generating JWT secrets..." -ForegroundColor Yellow
$JWT_SECRET = Generate-Secret
$JWT_REFRESH_SECRET = Generate-Secret
Write-Host "JWT secrets generated" -ForegroundColor Green

# Create .env file
Write-Host "Creating .env file..." -ForegroundColor Yellow
$envContent = @"
JWT_SECRET=$JWT_SECRET
JWT_REFRESH_SECRET=$JWT_REFRESH_SECRET
AUTH_PASSWORD=$AUTH_PASSWORD_PLAIN
API_BASE=$API_BASE
RUMBLE_UPLOAD_HOST=$RUMBLE_UPLOAD_HOST
CHROME_PATH=$CHROME_PATH
"@

Set-Content -Path ".env" -Value $envContent
Write-Host ".env file created" -ForegroundColor Green

# Install backend dependencies
Write-Host ""
Write-Host "Installing backend dependencies..." -ForegroundColor Yellow
npm install

# Install frontend dependencies
Write-Host "Installing frontend dependencies..." -ForegroundColor Yellow
Set-Location frontend
npm install
Set-Location ..

# Create necessary directories
Write-Host "Creating necessary directories..." -ForegroundColor Yellow
New-Item -ItemType Directory -Force -Path "temp" | Out-Null
New-Item -ItemType Directory -Force -Path "downloaded" | Out-Null
New-Item -ItemType Directory -Force -Path "public" | Out-Null

# Build frontend (Vite builds directly to ../public)
Write-Host "Building frontend..." -ForegroundColor Yellow
Set-Location frontend
try {
    npm run build
    if ($LASTEXITCODE -ne 0) {
        throw "Build failed with exit code $LASTEXITCODE"
    }
    Write-Host "Frontend built successfully" -ForegroundColor Green
} catch {
    Write-Host "Frontend build failed: $_" -ForegroundColor Red
    Set-Location ..
    exit 1
}
Set-Location ..

# Verify build output
if (Test-Path "public" -PathType Container) {
    $publicFiles = Get-ChildItem -Path "public" -ErrorAction SilentlyContinue
    if ($publicFiles) {
        Write-Host "Frontend build verified in public directory" -ForegroundColor Green
    } else {
        Write-Host "Error: Build output not found in public directory" -ForegroundColor Red
        exit 1
    }
} else {
    Write-Host "Error: public directory does not exist after build" -ForegroundColor Red
    exit 1
}

# Stop existing PM2 processes if any
Write-Host "Stopping existing PM2 processes..." -ForegroundColor Yellow
try {
    pm2 delete rumble 2>$null
} catch {
    # Process doesn't exist, ignore
}

# Start application with PM2
Write-Host "Starting application with PM2..." -ForegroundColor Yellow
pm2 start server.js --name rumble --time

# Save PM2 configuration
Write-Host "Saving PM2 configuration..." -ForegroundColor Yellow
pm2 save

# Setup PM2 to start on system boot (Windows)
Write-Host "Setting up PM2 to start on Windows boot..." -ForegroundColor Yellow
try {
    pm2-startup install
    Write-Host "PM2 startup configured" -ForegroundColor Green
} catch {
    Write-Host "Could not configure PM2 startup automatically." -ForegroundColor Yellow
    Write-Host "Run 'pm2-startup install' manually if needed." -ForegroundColor Yellow
}

Write-Host ""
Write-Host "================================" -ForegroundColor Green
Write-Host "Setup completed successfully!" -ForegroundColor Green
Write-Host "================================" -ForegroundColor Green
Write-Host ""
Write-Host "Application is running on: " -NoNewline
Write-Host "http://localhost:3000" -ForegroundColor Green
Write-Host ""
Write-Host "Useful PM2 commands:" -ForegroundColor Cyan
Write-Host "  pm2 status          " -ForegroundColor Yellow -NoNewline
Write-Host "- Check application status"
Write-Host "  pm2 logs rumble     " -ForegroundColor Yellow -NoNewline
Write-Host "- View application logs"
Write-Host "  pm2 restart rumble  " -ForegroundColor Yellow -NoNewline
Write-Host "- Restart application"
Write-Host "  pm2 stop rumble     " -ForegroundColor Yellow -NoNewline
Write-Host "- Stop application"
Write-Host "  pm2 delete rumble   " -ForegroundColor Yellow -NoNewline
Write-Host "- Remove application from PM2"
Write-Host ""
Write-Host "Configuration:" -ForegroundColor Cyan
Write-Host "  API Base: " -NoNewline
Write-Host $API_BASE -ForegroundColor Green
Write-Host "  Rumble Host: " -NoNewline
Write-Host $RUMBLE_UPLOAD_HOST -ForegroundColor Green
Write-Host "  Password: " -NoNewline
Write-Host $AUTH_PASSWORD_PLAIN -ForegroundColor Green
Write-Host ""
