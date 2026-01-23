# VPS Deployment Guide - 9Anime to Rumble Pipeline

Deploy the pipeline to a Hostinger VPS with aaPanel.

## Prerequisites

- Hostinger VPS with SSH access
- aaPanel installed
- Domain (optional, can use IP:port)

---

## Step 1: SSH into Your VPS

```bash
ssh root@YOUR_VPS_IP
```

---

## Step 2: Install Node.js

```bash
# Install Node.js 20 LTS
curl -fsSL https://deb.nodesource.com/setup_20.x | bash -
apt-get install -y nodejs

# Verify installation
node -v
npm -v
```

---

## Step 3: Install Chrome (for Puppeteer)

```bash
# Install Chrome dependencies
apt-get update
apt-get install -y wget gnupg ca-certificates

# Add Chrome repo (modern method - not using deprecated apt-key)
wget -qO- https://dl.google.com/linux/linux_signing_key.pub | gpg --dearmor -o /usr/share/keyrings/google-chrome.gpg
echo "deb [arch=amd64 signed-by=/usr/share/keyrings/google-chrome.gpg] http://dl.google.com/linux/chrome/deb/ stable main" | tee /etc/apt/sources.list.d/google-chrome.list

# Install Chrome
apt-get update
apt-get install -y google-chrome-stable

# Verify
google-chrome --version
```

**Alternative: Install Chromium instead**
```bash
apt-get install -y chromium-browser
```

---

## Step 4: Install FFmpeg

```bash
apt-get install -y ffmpeg

# Verify
ffmpeg -version
```

---

## Step 5: Upload Project Files

**Option A: Using SCP from your local machine**
```bash
# Run this on your LOCAL machine (not VPS)
scp -r c:\xampp\htdocs\rumble root@YOUR_VPS_IP:/var/www/rumble
```

**Option B: Using Git**
```bash
# On VPS
cd /var/www
git clone YOUR_REPO_URL rumble
```

**Option C: Using aaPanel File Manager**
1. Open aaPanel → File Manager
2. Navigate to `/var/www/`
3. Create folder `rumble`
4. Upload all project files (zip and extract)

---

## Step 6: Install Dependencies

```bash
cd /var/www/rumble
npm install
```

---

## Step 7: Configure Environment Variables

Create a `.env` file in the project root:

```bash
nano .env
```

Add the following configuration:

```env
# JWT Secret (change this to a random secure string)
JWT_SECRET=your-super-secret-jwt-key-change-this-to-random-string

# Authentication Password
AUTH_PASSWORD=admin123

# API Configuration
API_BASE=https://anime-api-itzzzme.vercel.app/api

# Rumble Upload Host
RUMBLE_UPLOAD_HOST=https://web17.rumble.com

# Chrome Path (adjust based on your installation)
CHROME_PATH=/usr/bin/google-chrome-stable

# Server Port (optional, defaults to 3000)
PORT=3000

# Polling Interval for frontend (milliseconds)
POLL_INTERVAL=3000
```

**Important Security Notes:**
- **Change `JWT_SECRET`** to a random string (at least 32 characters)
- **Change `AUTH_PASSWORD`** to a strong password
- Generate secure random string for JWT_SECRET:
  ```bash
  node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
  ```

Save the file (Ctrl+X, then Y, then Enter in nano).

---

## Step 8: Set Chrome Path for Linux

The Chrome path is now configured in the `.env` file. Verify Chrome installation location:

```bash
which google-chrome-stable
# or
which chromium-browser
```

Update `CHROME_PATH` in `.env` if the path is different.

---

## Step 9: Install PM2 (Process Manager)

```bash
npm install -g pm2

# Start the app
cd /var/www/rumble
pm2 start server.js --name "rumble-pipeline"

# Make it start on boot
pm2 startup
pm2 save

# Check status
pm2 status
pm2 logs rumble-pipeline
```

**Note:** The app will automatically load environment variables from `.env` file.

---

## Step 10: Configure Firewall

```bash
# Allow port 3000 (or your chosen port)
ufw allow 3000

# Or in aaPanel: Security → Firewall → Add Rule → Port 3000
```

---

## Step 11: Access Your App

Open in browser:
```
http://YOUR_VPS_IP:3000
```

**Login Credentials:**
- Password: The value you set in `AUTH_PASSWORD` in `.env` (default: admin123)

**First Time Setup:**
1. Login with your password
2. Enter your anime URL or direct M3U8/MP4 URL
3. Add your Rumble cookies (F12 → Network → Copy cookies from rumble.com)
4. Cookies will be saved automatically in browser localStorage

---

## Step 12: Optional: Set Up Nginx Reverse Proxy (via aaPanel)

1. **aaPanel → Website → Add Site**
2. Enter your domain
3. **Site Settings → Reverse Proxy → Add**
4. Configure:
   - Target URL: `http://127.0.0.1:3000`
   - Enable proxy

Now access via: `https://yourdomain.com`

---

## Useful PM2 Commands

```bash
# View logs
pm2 logs rumble-pipeline

# Restart app
pm2 restart rumble-pipeline

# Stop app
pm2 stop rumble-pipeline

# Monitor
pm2 monit
```

---

## Troubleshooting

**Environment Variables Not Loading:**
```bash
# Check if .env file exists
ls -la /var/www/rumble/.env

# View .env content
cat /var/www/rumble/.env

# Restart PM2 after .env changes
pm2 restart rumble-pipeline
```

**Login Issues:**
```bash
# Check AUTH_PASSWORD in .env
grep AUTH_PASSWORD /var/www/rumble/.env

# Verify JWT_SECRET is set
grep JWT_SECRET /var/www/rumble/.env
```

**Chrome won't start:**
```bash
# Install missing dependencies
apt-get install -y libxss1 libappindicator1 libgconf-2-4 libnss3 libatk-bridge2.0-0 libgtk-3-0

# Check Chrome path
which google-chrome
```

**Permission errors:**
```bash
chown -R www-data:www-data /var/www/rumble
chmod -R 755 /var/www/rumble
```

**Port already in use:**
```bash
# Find what's using port 3000
lsof -i :3000

# Change port in server.js or use environment variable
PORT=3001 pm2 start server.js --name "rumble-pipeline"
```
