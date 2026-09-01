# Hey Frank - Production Build Script
# This script builds your application with all optimizations

param(
    [switch]$Release = $true,
    [switch]$Sign = $false,
    [switch]$Clean = $false,
    [string]$Target = "msi"
)

Write-Host "🚀 Hey Frank - Production Build" -ForegroundColor Cyan
Write-Host "================================" -ForegroundColor Cyan
Write-Host ""

# Step 1: Clean (optional)
if ($Clean) {
    Write-Host "🧹 Cleaning previous builds..." -ForegroundColor Yellow
    Remove-Item -Recurse -Force "src-tauri\target\release" -ErrorAction SilentlyContinue
    Remove-Item -Recurse -Force "dist" -ErrorAction SilentlyContinue
    Write-Host "✅ Clean complete" -ForegroundColor Green
    Write-Host ""
}

# Step 2: Install dependencies
Write-Host "📦 Installing dependencies..." -ForegroundColor Yellow
npm install
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Dependency installation failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Dependencies installed" -ForegroundColor Green
Write-Host ""

# Step 3: Run tests
Write-Host "🧪 Running tests..." -ForegroundColor Yellow
npm test
if ($LASTEXITCODE -ne 0) {
    Write-Host "⚠️  Tests failed, but continuing..." -ForegroundColor Yellow
}
Write-Host ""

# Step 4: Build frontend
Write-Host "⚛️  Building React frontend..." -ForegroundColor Yellow
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Frontend build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Frontend built" -ForegroundColor Green
Write-Host ""

# Step 5: Build Tauri app
Write-Host "🦀 Building Rust backend and packaging..." -ForegroundColor Yellow
Write-Host "   This may take 5-10 minutes..." -ForegroundColor Gray

$buildArgs = @()
if ($Release) {
    $buildArgs += "--release"
}

# Build
npm run tauri build -- $buildArgs

if ($LASTEXITCODE -ne 0) {
    Write-Host "❌ Tauri build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "✅ Application built successfully!" -ForegroundColor Green
Write-Host ""

# Step 6: Show output location
Write-Host "📁 Build Output:" -ForegroundColor Cyan
Write-Host "   MSI Installer: src-tauri\target\release\bundle\msi\" -ForegroundColor White
Write-Host "   Executable:    src-tauri\target\release\hey-frank.exe" -ForegroundColor White
Write-Host ""

# Step 7: Get file sizes
$msiPath = Get-ChildItem "src-tauri\target\release\bundle\msi\*.msi" -ErrorAction SilentlyContinue | Select-Object -First 1
$exePath = "src-tauri\target\release\Frank.exe"

if ($msiPath) {
    $msiSize = [math]::Round($msiPath.Length / 1MB, 2)
    Write-Host "   MSI Size: $msiSize MB" -ForegroundColor Green
}

if (Test-Path $exePath) {
    $exeSize = [math]::Round((Get-Item $exePath).Length / 1MB, 2)
    Write-Host "   EXE Size: $exeSize MB" -ForegroundColor Green
}
Write-Host ""

# Step 8: Code signing (optional)
if ($Sign) {
    Write-Host "🔐 Code signing..." -ForegroundColor Yellow
    Write-Host "   ⚠️  Not implemented - requires certificate" -ForegroundColor Yellow
    Write-Host ""
}

# Step 9: Success!
Write-Host "🎉 Build Complete!" -ForegroundColor Green
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Cyan
Write-Host "1. Test the installer: src-tauri\target\release\bundle\msi\*.msi" -ForegroundColor White
Write-Host "2. Or run portable: src-tauri\target\release\Frank.exe" -ForegroundColor White
Write-Host "3. Press Shift+\ to toggle the window" -ForegroundColor White
Write-Host ""
Write-Host "Happy testing! 🚀" -ForegroundColor Cyan
