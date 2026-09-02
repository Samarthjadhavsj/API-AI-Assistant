# Pre-Build Verification Script
# Run this BEFORE building to catch potential issues

Write-Host "🔍 PRE-BUILD VERIFICATION" -ForegroundColor Cyan
Write-Host "========================" -ForegroundColor Cyan
Write-Host ""

$allGood = $true

# 1. Check Node.js
Write-Host "Checking Node.js..." -NoNewline
try {
    $nodeVersion = node --version
    $nodeMajor = [int]($nodeVersion -replace 'v(\d+).*', '$1')
    if ($nodeMajor -ge 18) {
        Write-Host " ✅ $nodeVersion" -ForegroundColor Green
    } else {
        Write-Host " ❌ Too old ($nodeVersion). Need v18+" -ForegroundColor Red
        $allGood = $false
    }
} catch {
    Write-Host " ❌ Not installed" -ForegroundColor Red
    $allGood = $false
}

# 2. Check Rust
Write-Host "Checking Rust..." -NoNewline
try {
    $rustVersion = rustc --version
    Write-Host " ✅ $rustVersion" -ForegroundColor Green
} catch {
    Write-Host " ❌ Not installed" -ForegroundColor Red
    Write-Host "  Install from: https://rustup.rs/" -ForegroundColor Yellow
    $allGood = $false
}

# 3. Check package.json
Write-Host "Checking package.json..." -NoNewline
if (Test-Path "package.json") {
    Write-Host " ✅" -ForegroundColor Green
} else {
    Write-Host " ❌ Not found" -ForegroundColor Red
    $allGood = $false
}

# 4. Check Cargo.toml
Write-Host "Checking Cargo.toml..." -NoNewline
if (Test-Path "src-tauri\Cargo.toml") {
    Write-Host " ✅" -ForegroundColor Green
} else {
    Write-Host " ❌ Not found" -ForegroundColor Red
    $allGood = $false
}

# 5. Check tauri.conf.json
Write-Host "Checking tauri.conf.json..." -NoNewline
if (Test-Path "src-tauri\tauri.conf.json") {
    Write-Host " ✅" -ForegroundColor Green
} else {
    Write-Host " ❌ Not found" -ForegroundColor Red
    $allGood = $false
}

# 6. Check icon files
Write-Host "Checking icon files..." -NoNewline
$iconFiles = @("src-tauri\icons\icon.ico", "src-tauri\icons\icon.png")
$iconsOk = $true
foreach ($icon in $iconFiles) {
    if (!(Test-Path $icon)) {
        $iconsOk = $false
    }
}
if ($iconsOk) {
    Write-Host " ✅" -ForegroundColor Green
} else {
    Write-Host " ❌ Missing icon files" -ForegroundColor Red
    $allGood = $false
}

# 7. Check node_modules
Write-Host "Checking node_modules..." -NoNewline
if (Test-Path "node_modules") {
    Write-Host " ✅" -ForegroundColor Green
} else {
    Write-Host " ⚠️  Not installed (will install during build)" -ForegroundColor Yellow
}

Write-Host ""

if ($allGood) {
    Write-Host "✅ ALL CHECKS PASSED!" -ForegroundColor Green
    Write-Host ""
    Write-Host "You're ready to build! Run:" -ForegroundColor Cyan
    Write-Host "  .\build-ultimate.ps1" -ForegroundColor White
    Write-Host ""
    exit 0
} else {
    Write-Host "❌ SOME CHECKS FAILED" -ForegroundColor Red
    Write-Host ""
    Write-Host "Fix the issues above before building." -ForegroundColor Yellow
    Write-Host ""
    exit 1
}
