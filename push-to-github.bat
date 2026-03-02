@echo off
echo ========================================
echo Pushing AgriTech AI to GitHub
echo ========================================
echo.

REM Remove any lock files
if exist ".git\index.lock" (
    echo Removing Git lock file...
    del /F /Q ".git\index.lock"
    timeout /t 2 /nobreak >nul
)

echo Step 1: Adding all files...
git add .
if errorlevel 1 (
    echo ERROR: Failed to add files
    pause
    exit /b 1
)

echo.
echo Step 2: Committing changes...
git commit -m "AgriTech AI Platform - Full Docker Deployment"
if errorlevel 1 (
    echo Note: No changes to commit or commit failed
)

echo.
echo Step 3: Setting up remote repository...
git remote remove origin 2>nul
git remote add origin https://github.com/MutheAkankshaSuresh/AgriTech-AI.git

echo.
echo Step 4: Pushing to GitHub...
git branch -M main
git push -u origin main --force

if errorlevel 1 (
    echo.
    echo ERROR: Push failed. Please check:
    echo - You are logged into GitHub
    echo - Repository exists: https://github.com/MutheAkankshaSuresh/AgriTech-AI
    echo - You have write access to the repository
    echo.
    echo Try running: git push -u origin main --force
    pause
    exit /b 1
)

echo.
echo ========================================
echo SUCCESS! Project pushed to GitHub
echo ========================================
echo.
echo Repository: https://github.com/MutheAkankshaSuresh/AgriTech-AI
echo.
echo To deploy anywhere, run:
echo   git clone https://github.com/MutheAkankshaSuresh/AgriTech-AI.git
echo   cd AgriTech-AI
echo   docker-compose up -d
echo.
echo Access at:
echo   Frontend: http://localhost:3000
echo   Backend:  http://localhost:8000/docs
echo.
pause
