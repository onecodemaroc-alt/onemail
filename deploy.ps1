# OneMail Deployment Script
# Usage: .\deploy.ps1 -Token "YOUR_FIREBASE_TOKEN"

param(
    [string]$Token = ""
)

$ErrorActionPreference = "Stop"
$ROOT = $PSScriptRoot

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  OneMail - Deployment Script" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# 1. Check prerequisites
Write-Host "[1/5] Checking prerequisites..." -ForegroundColor Yellow
$nodeVer = node --version
Write-Host "  Node.js: $nodeVer"
$npmVer = npm --version
Write-Host "  npm: $npmVer"

# 2. Install frontend dependencies & build
Write-Host "[2/5] Building frontend..." -ForegroundColor Yellow
Set-Location "$ROOT\frontend"
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install failed (frontend)" }
npm run build
if ($LASTEXITCODE -ne 0) { throw "Build failed" }
Write-Host "  Frontend built successfully!" -ForegroundColor Green

# 3. Install backend dependencies
Write-Host "[3/5] Installing backend dependencies..." -ForegroundColor Yellow
Set-Location "$ROOT\backend"
npm install
if ($LASTEXITCODE -ne 0) { throw "npm install failed (backend)" }
Write-Host "  Backend dependencies installed!" -ForegroundColor Green

# 4. Deploy Firebase Hosting
Write-Host "[4/5] Deploying to Firebase Hosting..." -ForegroundColor Yellow
Set-Location $ROOT
if ($Token -ne "") {
    firebase deploy --only hosting --token "$Token"
} else {
    Write-Host "  Skipping Firebase deploy (no token provided)" -ForegroundColor Yellow
    Write-Host "  To deploy manually:" -ForegroundColor Gray
    Write-Host "    firebase deploy --only hosting" -ForegroundColor Gray
}

# 5. Deploy Firestore rules
Write-Host "[5/5] Deploying Firestore rules..." -ForegroundColor Yellow
if ($Token -ne "") {
    firebase deploy --only firestore:rules --token "$Token"
} else {
    Write-Host "  Skipping (no token)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Deployment summary" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan

Write-Host ""
Write-Host "Frontend:" -ForegroundColor Green
Write-Host "  Local:     http://localhost:5173"
Write-Host "  Live:      https://onemail-onecode.web.app"
Write-Host ""
Write-Host "Backend:" -ForegroundColor Green
Write-Host "  Local:     http://localhost:3001"
Write-Host "  Deploy to: Render / Railway / Cloud Run"
Write-Host ""
Write-Host "Setup .env files:" -ForegroundColor Yellow
Write-Host "  frontend/.env  - Already configured"
Write-Host "  backend/.env   - Add your service account path & Claude API key"
