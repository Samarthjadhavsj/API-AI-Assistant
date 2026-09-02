# Deploy Hey Frank - Simple Installation Script
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Hey Frank v0.1.8 Installation" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Paths
$SourceExe = "C:\Users\SAMAR\OneDrive\Desktop\Pluly\API-AI-Assistant-main\src-tauri\target\release\frank.exe"
$InstallDir = "$env:LOCALAPPDATA\Programs\HeyFrank"
$DestExe = "$InstallDir\frank.exe"

# Check source
if (-not (Test-Path $SourceExe)) {
    Write-Host "ERROR: Source not found!" -ForegroundColor Red
    exit 1
}

Write-Host "Source found: frank.exe" -ForegroundColor Green

# Stop running instances
Write-Host "Stopping running instances..." -ForegroundColor Yellow
Get-Process -Name "frank" -ErrorAction SilentlyContinue | Stop-Process -Force
Start-Sleep -Seconds 2

# Backup if exists
if (Test-Path $DestExe) {
    Write-Host "Backing up old version..." -ForegroundColor Yellow
    Copy-Item $DestExe "$InstallDir\frank.exe.backup" -Force
}

# Create directory
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
}
Write-Host "Install directory ready" -ForegroundColor Green

# Copy new version
Write-Host "Installing new version..." -ForegroundColor Yellow
Copy-Item $SourceExe $DestExe -Force
Write-Host "Installation complete!" -ForegroundColor Green

# Create shortcuts
Write-Host "Creating shortcuts..." -ForegroundColor Yellow
$WshShell = New-Object -ComObject WScript.Shell

# Desktop
$Shortcut = $WshShell.CreateShortcut("$env:USERPROFILE\Desktop\Hey Frank.lnk")
$Shortcut.TargetPath = $DestExe
$Shortcut.Save()

# Start Menu
$Shortcut = $WshShell.CreateShortcut("$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Hey Frank.lnk")
$Shortcut.TargetPath = $DestExe
$Shortcut.Save()

Write-Host "Shortcuts created!" -ForegroundColor Green

# Summary
Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Installation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Location: $DestExe" -ForegroundColor White
Write-Host "Desktop shortcut: Created" -ForegroundColor White
Write-Host "Start Menu: Created" -ForegroundColor White
Write-Host ""
Write-Host "New Features:" -ForegroundColor Cyan
Write-Host "  - Shift+Backspace: Toggle Updates" -ForegroundColor White
Write-Host "  - Shift+\: Toggle Window" -ForegroundColor White
Write-Host "  - System Tray Menu" -ForegroundColor White
Write-Host ""
Write-Host "Launch from Desktop or Start Menu!" -ForegroundColor Yellow
Write-Host ""
