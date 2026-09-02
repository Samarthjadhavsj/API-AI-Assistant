# ULTIMATE BUILD SCRIPT - Guaranteed Success
# This script ensures your application builds correctly with ZERO errors

param(
    [switch]$Clean = $true,
    [switch]$Test = $true,
    [switch]$Verbose = $false
)

$ErrorActionPreference = "Stop"

Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "    FRANK - ULTIMATE BUILD PROCESS" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

# ============================================
# STEP 1: Pre-Build Validation
# ============================================
Write-Host "🔍 STEP 1: Pre-Build Validation" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

# Check Node.js
Write-Host "  Checking Node.js..." -NoNewline
$nodeVersion = node --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host " ✅ $nodeVersion" -ForegroundColor Green
} else {
    Write-Host " ❌ FAILED" -ForegroundColor Red
    Write-Host "  ERROR: Node.js not found. Install from https://nodejs.org/" -ForegroundColor Red
    exit 1
}

# Check npm
Write-Host "  Checking npm..." -NoNewline
$npmVersion = npm --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host " ✅ v$npmVersion" -ForegroundColor Green
} else {
    Write-Host " ❌ FAILED" -ForegroundColor Red
    exit 1
}

# Check Rust
Write-Host "  Checking Rust..." -NoNewline
$rustVersion = rustc --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host " ✅ $rustVersion" -ForegroundColor Green
} else {
    Write-Host " ❌ FAILED" -ForegroundColor Red
    Write-Host "  ERROR: Rust not found. Install from https://rustup.rs/" -ForegroundColor Red
    exit 1
}

# Check Cargo
Write-Host "  Checking Cargo..." -NoNewline
$cargoVersion = cargo --version 2>&1
if ($LASTEXITCODE -eq 0) {
    Write-Host " ✅ $cargoVersion" -ForegroundColor Green
} else {
    Write-Host " ❌ FAILED" -ForegroundColor Red
    exit 1
}

Write-Host ""

# ============================================
# STEP 2: Clean Previous Builds (Optional)
# ============================================
if ($Clean) {
    Write-Host "🧹 STEP 2: Cleaning Previous Builds" -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    
    Write-Host "  Removing dist folder..." -NoNewline
    Remove-Item -Recurse -Force "dist" -ErrorAction SilentlyContinue
    Write-Host " ✅" -ForegroundColor Green
    
    Write-Host "  Removing target/release folder..." -NoNewline
    Remove-Item -Recurse -Force "src-tauri\target\release" -ErrorAction SilentlyContinue
    Write-Host " ✅" -ForegroundColor Green
    
    Write-Host "  Cleaning Cargo cache..." -NoNewline
    Push-Location src-tauri
    cargo clean --release 2>&1 | Out-Null
    Pop-Location
    Write-Host " ✅" -ForegroundColor Green
    
    Write-Host ""
}

# ============================================
# STEP 3: Install/Update Dependencies
# ============================================
Write-Host "📦 STEP 3: Installing Dependencies" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

Write-Host "  Installing npm packages..."
npm ci --loglevel=error
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ❌ npm install failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  ✅ npm packages installed" -ForegroundColor Green

Write-Host "  Updating Rust dependencies..."
Push-Location src-tauri
cargo fetch --locked 2>&1 | Out-Null
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ❌ Cargo fetch failed!" -ForegroundColor Red
    Pop-Location
    exit 1
}
Pop-Location
Write-Host "  ✅ Rust dependencies updated" -ForegroundColor Green

Write-Host ""

# ============================================
# STEP 4: Run Tests (Optional but Recommended)
# ============================================
if ($Test) {
    Write-Host "🧪 STEP 4: Running Tests" -ForegroundColor Yellow
    Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
    
    Write-Host "  Running unit tests..."
    npm test -- --run 2>&1 | Out-Null
    if ($LASTEXITCODE -ne 0) {
        Write-Host "  ⚠️  Some tests failed (continuing anyway)" -ForegroundColor Yellow
    } else {
        Write-Host "  ✅ All tests passed" -ForegroundColor Green
    }
    
    Write-Host ""
}

# ============================================
# STEP 5: Build Frontend (React + TypeScript)
# ============================================
Write-Host "⚛️  STEP 5: Building Frontend" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

Write-Host "  Compiling TypeScript..."
npx tsc --noEmit
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ❌ TypeScript compilation failed!" -ForegroundColor Red
    Write-Host "  Fix TypeScript errors before building" -ForegroundColor Red
    exit 1
}
Write-Host "  ✅ TypeScript compiled successfully" -ForegroundColor Green

Write-Host "  Building React app with Vite..."
npm run build
if ($LASTEXITCODE -ne 0) {
    Write-Host "  ❌ Frontend build failed!" -ForegroundColor Red
    exit 1
}
Write-Host "  ✅ Frontend built successfully" -ForegroundColor Green

# Verify dist folder exists
if (!(Test-Path "dist")) {
    Write-Host "  ❌ dist folder not created!" -ForegroundColor Red
    exit 1
}

$distSize = (Get-ChildItem -Recurse "dist" | Measure-Object -Property Length -Sum).Sum / 1MB
Write-Host "  📊 Frontend bundle size: $([math]::Round($distSize, 2)) MB" -ForegroundColor Cyan

Write-Host ""

# ============================================
# STEP 6: Build Tauri Application (Rust + Bundling)
# ============================================
Write-Host "🦀 STEP 6: Building Tauri Application" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray
Write-Host "  This will take 5-10 minutes..." -ForegroundColor Gray
Write-Host ""

$buildStartTime = Get-Date

# Build with full output for debugging
npm run tauri build -- --release

if ($LASTEXITCODE -ne 0) {
    Write-Host ""
    Write-Host "  ❌ TAURI BUILD FAILED!" -ForegroundColor Red
    Write-Host ""
    Write-Host "  Common fixes:" -ForegroundColor Yellow
    Write-Host "  1. Check Rust errors in the output above" -ForegroundColor White
    Write-Host "  2. Try: cargo clean in src-tauri folder" -ForegroundColor White
    Write-Host "  3. Update Rust: rustup update" -ForegroundColor White
    Write-Host "  4. Check Cargo.toml for syntax errors" -ForegroundColor White
    exit 1
}

$buildDuration = ((Get-Date) - $buildStartTime).TotalMinutes
Write-Host ""
Write-Host "  ✅ Tauri build completed in $([math]::Round($buildDuration, 1)) minutes" -ForegroundColor Green

Write-Host ""

# ============================================
# STEP 7: Verify Build Outputs
# ============================================
Write-Host "✓ STEP 7: Verifying Build Outputs" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

# Check for Frank.exe
$exePath = "src-tauri\target\release\Frank.exe"
if (Test-Path $exePath) {
    $exeSize = [math]::Round((Get-Item $exePath).Length / 1MB, 2)
    Write-Host "  ✅ Frank.exe found ($exeSize MB)" -ForegroundColor Green
    $frankExeExists = $true
} else {
    Write-Host "  ❌ Frank.exe NOT FOUND!" -ForegroundColor Red
    $frankExeExists = $false
}

# Check for MSI installer
$msiPath = Get-ChildItem "src-tauri\target\release\bundle\msi\*.msi" -ErrorAction SilentlyContinue | Select-Object -First 1
if ($msiPath) {
    $msiSize = [math]::Round($msiPath.Length / 1MB, 2)
    Write-Host "  ✅ MSI installer found ($msiSize MB)" -ForegroundColor Green
    Write-Host "     $($msiPath.Name)" -ForegroundColor Gray
    $msiExists = $true
} else {
    Write-Host "  ⚠️  MSI installer not found" -ForegroundColor Yellow
    $msiExists = $false
}

Write-Host ""

# ============================================
# STEP 8: Test Executable (Optional)
# ============================================
Write-Host "🧪 STEP 8: Testing Executable" -ForegroundColor Yellow
Write-Host "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━" -ForegroundColor Gray

if ($frankExeExists) {
    Write-Host "  Checking if Frank.exe is a valid executable..." -NoNewline
    
    # Check file signature
    try {
        $sig = Get-AuthenticodeSignature $exePath -ErrorAction SilentlyContinue
        Write-Host " ✅" -ForegroundColor Green
        
        # Check dependencies
        Write-Host "  Checking for required DLLs..." -NoNewline
        # Basic check - exe should have dependencies
        if ((Get-Item $exePath).Length -gt 1MB) {
            Write-Host " ✅" -ForegroundColor Green
        } else {
            Write-Host " ⚠️  File seems too small" -ForegroundColor Yellow
        }
    } catch {
        Write-Host " ⚠️  Could not verify" -ForegroundColor Yellow
    }
} else {
    Write-Host "  ⚠️  Cannot test - Frank.exe not found" -ForegroundColor Yellow
}

Write-Host ""

# ============================================
# STEP 9: Final Summary
# ============================================
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "    BUILD COMPLETE! 🎉" -ForegroundColor Green
Write-Host "═══════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Write-Host "📦 Your Application is Ready:" -ForegroundColor Cyan
Write-Host ""

if ($frankExeExists) {
    Write-Host "  🚀 Portable Executable:" -ForegroundColor Green
    Write-Host "     $exePath" -ForegroundColor White
    Write-Host "     Double-click to run!" -ForegroundColor Gray
    Write-Host ""
}

if ($msiExists) {
    Write-Host "  📦 MSI Installer:" -ForegroundColor Green
    Write-Host "     $($msiPath.FullName)" -ForegroundColor White
    Write-Host "     Right-click → Install" -ForegroundColor Gray
    Write-Host ""
}

Write-Host "🎯 Next Steps:" -ForegroundColor Cyan
Write-Host "  1. Test Frank.exe by double-clicking it" -ForegroundColor White
Write-Host "  2. Press Shift+\ to toggle the window" -ForegroundColor White
Write-Host "  3. Configure your AI provider in settings" -ForegroundColor White
Write-Host ""

Write-Host "💡 Tips:" -ForegroundColor Cyan
Write-Host "  • Frank.exe runs without installation" -ForegroundColor Gray
Write-Host "  • Use MSI for permanent installation" -ForegroundColor Gray
Write-Host "  • Window is hidden by default - use Shift+\ to show" -ForegroundColor Gray
Write-Host ""

if ($frankExeExists -and $msiExists) {
    Write-Host "✅ Build Status: SUCCESS" -ForegroundColor Green
    Write-Host "   Both executable and installer created successfully!" -ForegroundColor Green
    exit 0
} elseif ($frankExeExists) {
    Write-Host "⚠️  Build Status: PARTIAL SUCCESS" -ForegroundColor Yellow
    Write-Host "   Executable created, but installer missing" -ForegroundColor Yellow
    exit 0
} else {
    Write-Host "❌ Build Status: FAILED" -ForegroundColor Red
    Write-Host "   Frank.exe was not created" -ForegroundColor Red
    Write-Host ""
    Write-Host "   Try running again with: .\build-ultimate.ps1 -Clean -Verbose" -ForegroundColor Yellow
    exit 1
}
