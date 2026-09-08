#!/usr/bin/env pwsh
# Clean and Rebuild Script for Hey Frank
# This script removes all build artifacts and creates a fresh production build

Write-Host "Starting Clean and Rebuild Process..." -ForegroundColor Cyan
Write-Host ""

# Step 1: Stop any running processes
Write-Host "Step 1: Stopping any running processes..." -ForegroundColor Yellow
try {
    Get-Process -Name "frank" -ErrorAction SilentlyContinue | Stop-Process -Force
    Get-Process -Name "Hey Frank" -ErrorAction SilentlyContinue | Stop-Process -Force
} catch {
    # Process not running, continue
}
Write-Host "   Processes stopped" -ForegroundColor Green
Write-Host ""

# Step 2: Clean node_modules and package-lock
Write-Host "Step 2: Cleaning Node.js build artifacts..." -ForegroundColor Yellow
if (Test-Path "node_modules") {
    Write-Host "   Removing node_modules..." -ForegroundColor Gray
    Remove-Item -Recurse -Force "node_modules"
}
if (Test-Path "package-lock.json") {
    Write-Host "   Removing package-lock.json..." -ForegroundColor Gray
    Remove-Item -Force "package-lock.json"
}
if (Test-Path "dist") {
    Write-Host "   Removing dist..." -ForegroundColor Gray
    Remove-Item -Recurse -Force "dist"
}
Write-Host "   Node.js artifacts cleaned" -ForegroundColor Green
Write-Host ""

# Step 3: Clean Rust/Tauri build artifacts
Write-Host "Step 3: Cleaning Rust/Tauri build artifacts..." -ForegroundColor Yellow
if (Test-Path "src-tauri/target") {
    Write-Host "   Removing src-tauri/target..." -ForegroundColor Gray
    Remove-Item -Recurse -Force "src-tauri/target"
}
if (Test-Path "src-tauri/Cargo.lock") {
    Write-Host "   Removing Cargo.lock..." -ForegroundColor Gray
    Remove-Item -Force "src-tauri/Cargo.lock"
}
Write-Host "   Rust artifacts cleaned" -ForegroundColor Green
Write-Host ""

# Step 4: Clean old builds
Write-Host "Step 4: Cleaning old executable builds..." -ForegroundColor Yellow
if (Test-Path "*.exe") {
    Write-Host "   Removing exe files..." -ForegroundColor Gray
    Remove-Item -Force "*.exe" -ErrorAction SilentlyContinue
}
Write-Host "   Old builds removed" -ForegroundColor Green
Write-Host ""

# Step 5: Fresh npm install
Write-Host "Step 5: Installing fresh dependencies..." -ForegroundColor Yellow
Write-Host "   Running: npm install" -ForegroundColor Gray
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "   npm install failed!" -ForegroundColor Red
    exit 1
}
Write-Host "   Dependencies installed" -ForegroundColor Green
Write-Host ""

# Step 6: Build frontend
Write-Host "Step 6: Building frontend (Vite)..." -ForegroundColor Yellow
Write-Host "   Running: npm run build" -ForegroundColor Gray
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "   Frontend build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "   Frontend built successfully" -ForegroundColor Green
Write-Host ""

# Step 7: Build Tauri production executable
Write-Host "Step 7: Building Tauri production executable..." -ForegroundColor Yellow
Write-Host "   Running: npm run tauri build" -ForegroundColor Gray
Write-Host "   This may take 5-10 minutes..." -ForegroundColor Cyan
npm run tauri build
if ($LASTEXITCODE -ne 0) {
    Write-Host "   Tauri build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "   Production build complete!" -ForegroundColor Green
Write-Host ""

# Step 8: Locate the built executable
Write-Host "Step 8: Locating built executable..." -ForegroundColor Yellow
$exePath = "src-tauri\target\release\frank.exe"
if (Test-Path $exePath) {
    $exeSize = (Get-Item $exePath).Length / 1MB
    Write-Host "   frank.exe found!" -ForegroundColor Green
    Write-Host "   Location: $exePath" -ForegroundColor Cyan
    Write-Host "   Size: $($exeSize.ToString('F2')) MB" -ForegroundColor Cyan
    Write-Host ""
    
    # Copy to root for easy access
    Copy-Item $exePath "frank.exe" -Force
    Write-Host "   Copied to root directory: frank.exe" -ForegroundColor Green
} else {
    Write-Host "   frank.exe not found in expected location" -ForegroundColor Yellow
}
Write-Host ""

# Summary
Write-Host "============================================" -ForegroundColor Cyan
Write-Host "BUILD COMPLETE!" -ForegroundColor Green
Write-Host "============================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Your executable is at:" -ForegroundColor Yellow
Write-Host "  frank.exe (root directory)" -ForegroundColor White
Write-Host "  src-tauri\target\release\frank.exe (original)" -ForegroundColor White
Write-Host ""
Write-Host "To run the application:" -ForegroundColor Yellow
Write-Host "  .\frank.exe" -ForegroundColor White
Write-Host ""
