# Deployment Script for Google Cloud Run (PowerShell)
# Pre-requisites:
# 1. Google Cloud SDK installed (gcloud CLI)
# 2. Logged in and project selected: gcloud auth login && gcloud config set project YOUR_PROJECT_ID

$ErrorActionPreference = "Stop"

Write-Host "==============================================" -ForegroundColor Cyan
Write-Host "Starting deployment of Personal Assistant..." -ForegroundColor Cyan
Write-Host "==============================================" -ForegroundColor Cyan

# 1. Build frontend
Write-Host "`n[1/3] Installing frontend dependencies and building..." -ForegroundColor Yellow
cd frontend
npm install
npm run build
cd ..

# 2. Copy build output to backend/public
Write-Host "`n[2/3] Copying build to backend/public..." -ForegroundColor Yellow
if (Test-Path backend/public) {
    Remove-Item -Recurse -Force backend/public
}
New-Item -ItemType Directory -Path backend/public -Force | Out-Null
Copy-Item -Recurse frontend/dist/* backend/public/

# 3. Deploy backend to Cloud Run
Write-Host "`n[3/3] Deploying backend to Google Cloud Run..." -ForegroundColor Yellow
cd backend
gcloud run deploy personal-assistant --source . --region us-central1 --allow-unauthenticated

Write-Host "`n==============================================" -ForegroundColor Green
Write-Host "Deployment Completed Successfully!" -ForegroundColor Green
Write-Host "==============================================" -ForegroundColor Green
