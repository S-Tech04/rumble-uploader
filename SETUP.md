# Quick Setup Guide

This guide will help you set up the Rumble Video Uploader on your VPS or local machine with a single command.

## Prerequisites

- **Linux**: Ubuntu 18.04+, Debian 9+, CentOS 7+, RHEL 7+, or Fedora
- **Windows**: Windows 10+ or Windows Server 2016+
- **Internet connection** for downloading dependencies

## Setup Instructions

### Linux/Mac

1. **Clone the repository** (or download and extract the code):
   ```bash
   git clone <your-repo-url>
   cd rumble
   ```

2. **Make the setup script executable**:
   ```bash
   chmod +x setup.sh
   ```

3. **Run the setup script**:
   ```bash
   ./setup.sh
   ```

   Or with sudo if needed:
   ```bash
   sudo ./setup.sh
   ```

### Windows

1. **Clone the repository** (or download and extract the code):
   ```powershell
   git clone <your-repo-url>
   cd rumble
   ```

2. **Run PowerShell as Administrator** (right-click PowerShell and select "Run as Administrator")

3. **Run the setup script**:
   ```powershell
   powershell -ExecutionPolicy Bypass -File setup.ps1
   ```

## What the Setup Script Does

1. **Checks and installs Node.js 24** if not already installed
2. **Installs PM2** process manager globally
3. **Prompts for configuration**:
   - API Base URL (default: `https://anime-api-itzzzme.vercel.app/api`)
   - Rumble Upload Host (default: `https://web17.rumble.com`)
   - Authentication Password (default: `admin123`)
   - JWT secrets (auto-generated)
4. **Creates .env file** with your configuration
5. **Installs all dependencies** (backend and frontend)
6. **Builds the frontend** application
7. **Sets up PM2** to manage the application
8. **Starts the application** automatically
9. **Configures PM2** to start on system boot

## Configuration During Setup

When you run the setup script, you'll be prompted for:

### API Base URL
The base URL for the anime API.
- **Default**: `https://anime-api-itzzzme.vercel.app/api`
- Press Enter to use default or enter your custom URL

### Rumble Upload Host
The Rumble upload server URL.
- **Default**: `https://web17.rumble.com`
- Press Enter to use default or enter your custom URL

### Authentication Password
The password to access the application.
- **Default**: `admin123`
- **Recommended**: Set a strong custom password for production

### JWT Secrets
Automatically generated secure random strings for JWT token signing.
- No input required - generated automatically

## After Setup

Once the setup is complete, the application will be running on:
```
http://localhost:3000
```

Access it from your browser to start uploading videos to Rumble.

## Managing the Application

The application runs under PM2 process manager. Here are useful commands:

### Check Status
```bash
pm2 status
```

### View Logs
```bash
pm2 logs rumble
```

### Restart Application
```bash
pm2 restart rumble
```

### Stop Application
```bash
pm2 stop rumble
```

### Start Application
```bash
pm2 start rumble
```

### Remove from PM2
```bash
pm2 delete rumble
```

### Save PM2 Configuration
```bash
pm2 save
```

## VPS Deployment

When deploying on a VPS:

1. **SSH into your VPS**:
   ```bash
   ssh user@your-vps-ip
   ```

2. **Clone the repository**:
   ```bash
   git clone <your-repo-url>
   cd rumble
   ```

3. **Run the setup script**:
   ```bash
   chmod +x setup.sh
   sudo ./setup.sh
   ```

4. **Configure firewall** to allow port 3000:
   ```bash
   # Ubuntu/Debian
   sudo ufw allow 3000
   
   # CentOS/RHEL
   sudo firewall-cmd --permanent --add-port=3000/tcp
   sudo firewall-cmd --reload
   ```

5. **Access your application**:
   ```
   http://your-vps-ip:3000
   ```

## Using Custom Domain

To use a custom domain with your VPS:

1. **Point your domain to your VPS IP** (A record in DNS)

2. **Install and configure Nginx**:
   ```bash
   sudo apt install nginx  # Ubuntu/Debian
   sudo yum install nginx  # CentOS/RHEL
   ```

3. **Create Nginx configuration**:
   ```bash
   sudo nano /etc/nginx/sites-available/rumble
   ```

   Add:
   ```nginx
   server {
       listen 80;
       server_name your-domain.com;

       location / {
           proxy_pass http://localhost:3000;
           proxy_http_version 1.1;
           proxy_set_header Upgrade $http_upgrade;
           proxy_set_header Connection 'upgrade';
           proxy_set_header Host $host;
           proxy_cache_bypass $http_upgrade;
       }
   }
   ```

4. **Enable the site**:
   ```bash
   sudo ln -s /etc/nginx/sites-available/rumble /etc/nginx/sites-enabled/
   sudo nginx -t
   sudo systemctl reload nginx
   ```

5. **Install SSL certificate** (optional but recommended):
   ```bash
   sudo apt install certbot python3-certbot-nginx
   sudo certbot --nginx -d your-domain.com
   ```

## Troubleshooting

### Node.js Installation Fails
- Linux: Make sure curl is installed: `sudo apt install curl` or `sudo yum install curl`
- Windows: Download Node.js manually from https://nodejs.org/

### Permission Denied
- Linux: Run the script with sudo: `sudo ./setup.sh`
- Windows: Run PowerShell as Administrator

### PM2 Command Not Found
- Run: `npm install -g pm2`
- Windows: Also run `npm install -g pm2-windows-startup`

### Port 3000 Already in Use
- Stop the conflicting process or change the port in `server.js`

### Application Not Starting
- Check logs: `pm2 logs rumble`
- Verify .env file exists: `cat .env`
- Check Node.js version: `node --version` (should be 18+)

## Manual Configuration

If you prefer to configure manually instead of using the setup script, see [DEPLOYMENT.md](DEPLOYMENT.md) for detailed instructions.

## Updating the Application

To update the application after initial setup:

1. **Pull latest changes**:
   ```bash
   git pull
   ```

2. **Install new dependencies** (if any):
   ```bash
   npm install
   cd frontend && npm install && cd ..
   ```

3. **Rebuild frontend**:
   ```bash
   cd frontend && npm run build && cd ..
   cp -r frontend/dist/* public/
   ```

4. **Restart application**:
   ```bash
   pm2 restart rumble
   ```

## Security Recommendations

1. **Change default password** during setup
2. **Use strong JWT secrets** (auto-generated by script)
3. **Enable firewall** on your VPS
4. **Use HTTPS** with SSL certificate
5. **Keep Node.js and dependencies updated**
6. **Limit SSH access** to specific IPs
7. **Use non-root user** for running the application

## Support

For issues or questions:
1. Check [TROUBLESHOOTING.md](TROUBLESHOOTING.md)
2. Review [DEPLOYMENT.md](DEPLOYMENT.md) for detailed setup
3. Check application logs: `pm2 logs rumble`
