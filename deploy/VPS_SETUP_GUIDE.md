# VPS Production Deployment Guide
This guide is designed for deploying the Video Processor application to a Linux VPS (Ubuntu/Debian) with 2 vCPU cores, 8 GB RAM, and 100 GB NVMe disk space.

## 1. Initial Server Setup & Firewall (UFW)
First, ensure your server is up to date and secure it by only allowing necessary ports.

```bash
sudo apt update && sudo apt upgrade -y
sudo apt install ufw -y

# Allow SSH, HTTP, and HTTPS
sudo ufw allow 22/tcp
sudo ufw allow 80/tcp
sudo ufw allow 443/tcp

# Enable Firewall (This will block everything else, including port 6379 for Redis)
sudo ufw enable
```

## 2. Install Dependencies (Docker & Nginx)
Install Docker (for the backend and Redis) and Nginx (as the reverse proxy).

```bash
# Install Docker and Docker Compose
sudo apt install docker.io docker-compose -y
sudo systemctl enable docker
sudo systemctl start docker

# Install Nginx and Certbot
sudo apt install nginx certbot python3-certbot-nginx -y
```

## 3. Set Up the Backend
Clone your repository or upload your files to the VPS (e.g., `/vt.matamandir.com/video-processor-backend`).

```bash
cd /vt.matamandir.com/video-processor-backend

# Ensure your .env has the correct FRONTEND_URL
echo "FRONTEND_URL=https://vt.matamandir.com" > .env

# Start the application (Docker handles restart on reboot automatically)
sudo docker-compose up -d --build
```

## 4. Configure Nginx & SSL
Copy the provided Nginx configuration to your server.

```bash
# Copy the config
sudo cp deploy/nginx.conf /etc/nginx/sites-available/vt.matamandir.com

# Enable the site and remove the default
sudo ln -s /etc/nginx/sites-available/vt.matamandir.com /etc/nginx/sites-enabled/
sudo rm /etc/nginx/sites-enabled/default

# Test Nginx configuration
sudo nginx -t

# Restart Nginx
sudo systemctl restart nginx
```

Now, obtain your free SSL certificate using Certbot.

```bash
# Obtain SSL and let Certbot automatically update the Nginx config
sudo certbot --nginx -d vt.matamandir.com
```

## 5. Verify Setup
- Check that the API is running: `https://vt.matamandir.com/api`
- Test uploading a file from the frontend to ensure CORS allows the request and the `500M` upload limit is respected.
- Background tasks (like `node-cron` cleaning up `disk_tmp`) are already running inside the Docker container automatically.
