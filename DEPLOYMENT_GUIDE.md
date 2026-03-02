# 🚀 AgriTech AI - Docker Deployment Guide

## 📋 Prerequisites
- Git installed
- Docker Desktop installed and running
- GitHub account

---

## 🔧 Step 1: Prepare Project for GitHub

### Create .gitignore file
Create a file named `.gitignore` in the root directory:

```
# Python
__pycache__/
*.py[cod]
*$py.class
*.so
.Python
env/
venv/
*.egg-info/
.pytest_cache/

# Node
node_modules/
npm-debug.log*
yarn-debug.log*
yarn-error.log*
.pnpm-debug.log*
build/
dist/

# Docker
*.log

# IDE
.vscode/
.idea/
*.swp
*.swo

# OS
.DS_Store
Thumbs.db

# Environment
.env
.env.local

# ML Models (optional - if models are large)
# ml/models/*.pth
# ml/models/*.pkl
# backend/ml_models/*.pt

# Data
ml/data/seed_images/
ml/dataset/
ml/runs/
*.zip
*.csv

# Temp files
backend/temp_seed.jpg
```

---

## 📤 Step 2: Push to GitHub

### Initialize Git Repository
```bash
cd c:\Users\Admin\Downloads\files (1)\agritech_fullstack_project\agritech
git init
git add .
git commit -m "Initial commit: AgriTech AI Platform"
```

### Create GitHub Repository
1. Go to https://github.com
2. Click "New Repository"
3. Name: `agritech-ai-platform`
4. Description: `AI-powered Seed Quality Intelligence Platform`
5. Keep it **Public** or **Private**
6. **DO NOT** initialize with README (we already have one)
7. Click "Create Repository"

### Push to GitHub
```bash
git remote add origin https://github.com/YOUR_USERNAME/agritech-ai-platform.git
git branch -M main
git push -u origin main
```

---

## 🐳 Step 3: Deploy on Any Server

### Option A: Deploy on Local Machine

```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/agritech-ai-platform.git
cd agritech-ai-platform

# Start services
docker-compose up -d

# Check status
docker-compose ps

# View logs
docker-compose logs -f
```

### Option B: Deploy on Cloud Server (AWS/Azure/GCP)

#### 1. Connect to Server
```bash
ssh user@your-server-ip
```

#### 2. Install Docker
```bash
# Update system
sudo apt update && sudo apt upgrade -y

# Install Docker
curl -fsSL https://get.docker.com -o get-docker.sh
sudo sh get-docker.sh

# Install Docker Compose
sudo curl -L "https://github.com/docker/compose/releases/latest/download/docker-compose-$(uname -s)-$(uname -m)" -o /usr/local/bin/docker-compose
sudo chmod +x /usr/local/bin/docker-compose

# Add user to docker group
sudo usermod -aG docker $USER
newgrp docker
```

#### 3. Clone and Deploy
```bash
# Clone repository
git clone https://github.com/YOUR_USERNAME/agritech-ai-platform.git
cd agritech-ai-platform

# Start services
docker-compose up -d

# Check status
docker-compose ps
```

#### 4. Configure Firewall
```bash
# Allow ports
sudo ufw allow 3000/tcp  # Frontend
sudo ufw allow 8000/tcp  # Backend
sudo ufw allow 27017/tcp # MongoDB (optional, for external access)
sudo ufw enable
```

---

## 🌐 Step 4: Access Application

### Local Deployment
- Frontend: http://localhost:3000
- Backend API: http://localhost:8000/docs
- MongoDB: localhost:27017

### Cloud Deployment
- Frontend: http://YOUR_SERVER_IP:3000
- Backend API: http://YOUR_SERVER_IP:8000/docs
- MongoDB: YOUR_SERVER_IP:27017

### Demo Credentials
| Role | Email | Password |
|------|-------|----------|
| Admin | admin@agritech.com | Admin@123 |
| QC Analyst | qc@agritech.com | QC@123 |

---

## 🔄 Step 5: Update Deployment

### Pull Latest Changes
```bash
cd agritech-ai-platform
git pull origin main
docker-compose down
docker-compose build --no-cache
docker-compose up -d
```

---

## 🛠️ Useful Docker Commands

### View Logs
```bash
# All services
docker-compose logs -f

# Specific service
docker-compose logs -f backend
docker-compose logs -f frontend
docker-compose logs -f mongodb
```

### Restart Services
```bash
# All services
docker-compose restart

# Specific service
docker-compose restart backend
```

### Stop Services
```bash
docker-compose down
```

### Remove Everything (including volumes)
```bash
docker-compose down -v
```

### Check Container Status
```bash
docker-compose ps
```

### Execute Commands in Container
```bash
# Backend shell
docker-compose exec backend bash

# Frontend shell
docker-compose exec frontend sh

# MongoDB shell
docker-compose exec mongodb mongosh
```

---

## 🔐 Production Security (Important!)

### 1. Change Default Passwords
Edit `docker-compose.yml`:
```yaml
environment:
  MONGO_INITDB_ROOT_PASSWORD: YOUR_STRONG_PASSWORD
  SECRET_KEY: YOUR_RANDOM_SECRET_KEY
```

### 2. Use Environment Variables
Create `.env` file:
```env
MONGO_PASSWORD=your_secure_password
JWT_SECRET=your_jwt_secret_key
```

Update `docker-compose.yml`:
```yaml
environment:
  MONGO_INITDB_ROOT_PASSWORD: ${MONGO_PASSWORD}
  SECRET_KEY: ${JWT_SECRET}
```

### 3. Enable HTTPS (Production)
Use Nginx reverse proxy with SSL certificate.

---

## 📊 Monitoring

### Check Resource Usage
```bash
docker stats
```

### Check Disk Space
```bash
docker system df
```

### Clean Up Unused Resources
```bash
docker system prune -a
```

---

## 🐛 Troubleshooting

### Port Already in Use
```bash
# Find process using port
netstat -ano | findstr :3000
netstat -ano | findstr :8000

# Kill process (Windows)
taskkill /PID <PID> /F
```

### Container Won't Start
```bash
# Check logs
docker-compose logs backend

# Rebuild without cache
docker-compose build --no-cache backend
docker-compose up -d
```

### Database Connection Issues
```bash
# Check MongoDB is running
docker-compose ps mongodb

# Check MongoDB logs
docker-compose logs mongodb

# Restart MongoDB
docker-compose restart mongodb
```

---

## 📦 Backup & Restore

### Backup MongoDB
```bash
docker-compose exec mongodb mongodump --out /data/backup
docker cp agritech_mongodb:/data/backup ./mongodb_backup
```

### Restore MongoDB
```bash
docker cp ./mongodb_backup agritech_mongodb:/data/backup
docker-compose exec mongodb mongorestore /data/backup
```

---

## 🎯 Quick Start Commands

```bash
# Clone and start
git clone https://github.com/YOUR_USERNAME/agritech-ai-platform.git
cd agritech-ai-platform
docker-compose up -d

# Stop
docker-compose down

# Update
git pull && docker-compose up -d --build

# View logs
docker-compose logs -f

# Restart
docker-compose restart
```

---

## 📞 Support

For issues or questions:
1. Check logs: `docker-compose logs -f`
2. Review README.md
3. Check GitHub Issues
4. Contact development team

---

## 🎉 Success!

Your AgriTech AI Platform is now deployed and accessible!

Visit: http://localhost:3000 (or your server IP)
