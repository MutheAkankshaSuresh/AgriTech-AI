@echo off
echo ========================================
echo AgriTech AI Platform - Quick Deploy
echo ========================================
echo.

echo Step 1: Initializing Git Repository...
git init
if errorlevel 1 (
    echo ERROR: Git initialization failed. Make sure Git is installed.
    pause
    exit /b 1
)

echo.
echo Step 2: Adding files to Git...
git add .
git commit -m "Initial commit: AgriTech AI Platform"

echo.
echo Step 3: GitHub Setup
echo.
echo Please follow these steps:
echo 1. Go to https://github.com
echo 2. Click "New Repository"
echo 3. Name it: agritech-ai-platform
echo 4. DO NOT initialize with README
echo 5. Click "Create Repository"
echo.
set /p GITHUB_URL="Enter your GitHub repository URL (e.g., https://github.com/username/agritech-ai-platform.git): "

echo.
echo Step 4: Pushing to GitHub...
git remote add origin %GITHUB_URL%
git branch -M main
git push -u origin main

if errorlevel 1 (
    echo.
    echo ERROR: Push failed. Please check:
    echo - GitHub URL is correct
    echo - You have access to the repository
    echo - Git credentials are configured
    pause
    exit /b 1
)

echo.
echo ========================================
echo SUCCESS! Project pushed to GitHub
echo ========================================
echo.
echo Your project is now on GitHub: %GITHUB_URL%
echo.
echo To deploy anywhere:
echo 1. Clone: git clone %GITHUB_URL%
echo 2. Run: docker-compose up -d
echo.
echo Access your app at:
echo - Frontend: http://localhost:3000
echo - Backend: http://localhost:8000/docs
echo.
pause
