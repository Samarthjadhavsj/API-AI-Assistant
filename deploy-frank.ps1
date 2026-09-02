# Deploy Hey Frank - Replace Old with New Version
# This script will install/update Hey Frank to a standard location

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Hey Frank Deployment Script v0.1.8" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Define paths
$SourceExe = "C:\Users\SAMAR\OneDrive\Desktop\Pluly\API-AI-Assistant-main\src-tauri\target\release\frank.exe"
$InstallDir = "$env:LOCALAPPDATA\Programs\HeyFrank"
$DestExe = "$InstallDir\frank.exe"
$DesktopShortcut = "$env:USERPROFILE\Desktop\Hey Frank.lnk"
$StartMenuShortcut = "$env:APPDATA\Microsoft\Windows\Start Menu\Programs\Hey Frank.lnk"

# Check if source exists
if (-not (Test-Path $SourceExe)) {
    Write-Host "ERROR: Source file not found!" -ForegroundColor Red
    Write-Host "Expected: $SourceExe" -ForegroundColor Yellow
    Write-Host "Please build the application first." -ForegroundColor Yellow
    exit 1
}

Write-Host "✓ Source file found: frank.exe" -ForegroundColor Green
$fileSize = (Get-Item $SourceExe).Length / 1MB
Write-Host "  Size: $([math]::Round($fileSize, 2)) MB" -ForegroundColor Gray

# Stop running instance if exists
Write-Host "`nStopping any running instances..." -ForegroundColor Yellow
$processes = Get-Process -Name "frank" -ErrorAction SilentlyContinue
if ($processes) {
    $processes | Stop-Process -Force
    Write-Host "✓ Stopped running instances" -ForegroundColor Green
    Start-Sleep -Seconds 2
} else {
    Write-Host "✓ No running instances" -ForegroundColor Green
}

# Backup old version if exists
if (Test-Path $DestExe) {
    Write-Host "`nBacking up old version..." -ForegroundColor Yellow
    $BackupPath = "$InstallDir\frank.exe.backup"
    Copy-Item $DestExe $BackupPath -Force
    Write-Host "✓ Backup created: frank.exe.backup" -ForegroundColor Green
}

# Create installation directory
Write-Host "`nCreating installation directory..." -ForegroundColor Yellow
if (-not (Test-Path $InstallDir)) {
    New-Item -ItemType Directory -Path $InstallDir -Force | Out-Null
    Write-Host "✓ Created: $InstallDir" -ForegroundColor Green
} else {
    Write-Host "✓ Directory exists: $InstallDir" -ForegroundColor Green
}

# Copy new version
Write-Host "`nInstalling new version..." -ForegroundColor Yellow
try {
    Copy-Item $SourceExe $DestExe -Force
    Write-Host "✓ Installed: frank.exe" -ForegroundColor Green
} catch {
    Write-Host "ERROR: Failed to copy file!" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    exit 1
}

# Create Desktop Shortcut
Write-Host "`nCreating shortcuts..." -ForegroundColor Yellow
try {
    $WshShell = New-Object -ComObject WScript.Shell
    
    # Desktop shortcut
    $Shortcut = $WshShell.CreateShortcut($DesktopShortcut)
    $Shortcut.TargetPath = $DestExe
    $Shortcut.WorkingDirectory = $InstallDir
    $Shortcut.Description = "Hey Frank - AI Assistant"
    $Shortcut.Save()
    Write-Host "✓ Desktop shortcut created" -ForegroundColor Green
    
    # Start Menu shortcut
    $Shortcut = $WshShell.CreateShortcut($StartMenuShortcut)
    $Shortcut.TargetPath = $DestExe
    $Shortcut.WorkingDirectory = $InstallDir
    $Shortcut.Description = "Hey Frank - AI Assistant"
    $Shortcut.Save()
    Write-Host "✓ Start Menu shortcut created" -ForegroundColor Green
    
} catch {
    Write-Host "WARNING: Failed to create shortcuts" -ForegroundColor Yellow
    Write-Host $_.Exception.Message -ForegroundColor Yellow
}

# Add to PATH (optional)
Write-Host "`nAdding to user PATH..." -ForegroundColor Yellow
$currentPath = [Environment]::GetEnvironmentVariable("Path", "User")
if ($currentPath -notlike "*$InstallDir*") {
    try {
        [Environment]::SetEnvironmentVariable("Path", "$currentPath;$InstallDir", "User")
        Write-Host "✓ Added to PATH" -ForegroundColor Green
    } catch {
        Write-Host "WARNING: Could not add to PATH" -ForegroundColor Yellow
    }
} else {
    Write-Host "✓ Already in PATH" -ForegroundColor Green
}

# Verify installation
Write-Host "`n========================================" -ForegroundColor Cyan
Write-Host "  Installation Complete!" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Installation Details:" -ForegroundColor White
Write-Host "  Location: $DestExe" -ForegroundColor Gray
Write-Host "  Desktop Shortcut: $DesktopShortcut" -ForegroundColor Gray
Write-Host "  Start Menu: $StartMenuShortcut" -ForegroundColor Gray
Write-Host ""

# Display new features
Write-Host "New Features in v0.1.8:" -ForegroundColor Cyan
Write-Host "  ⭐ Shift+Backspace: Toggle Updates" -ForegroundColor White
Write-Host "  🎯 Shift+\: Toggle Window" -ForegroundColor White
Write-Host "  🎨 System Tray Integration" -ForegroundColor White
Write-Host "  ⚙️  Settings Page" -ForegroundColor White
Write-Host ""

# Ask to launch
Write-Host "Would you like to launch Hey Frank now? (Y/N): " -ForegroundColor Yellow -NoNewline
$launch = Read-Host

if ($launch -eq 'Y' -or $launch -eq 'y') {
    Write-Host "`nLaunching Hey Frank..." -ForegroundColor Green
    Start-Process $DestExe
    Write-Host "✓ Launched!" -ForegroundColor Green
    Write-Host ""
    Write-Host "Tips:" -ForegroundColor Cyan
    Write-Host "  • Press F12 to open console" -ForegroundColor Gray
    Write-Host "  • Press Shift+Backspace to test new toggle feature" -ForegroundColor Gray
    Write-Host "  • Right-click system tray icon for options" -ForegroundColor Gray
} else {
    Write-Host "`nYou can launch Hey Frank from:" -ForegroundColor Cyan
    Write-Host "  • Desktop shortcut" -ForegroundColor Gray
    Write-Host "  • Start Menu" -ForegroundColor Gray
    Write-Host "  • Run: frank.exe (from any terminal)" -ForegroundColor Gray
}

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "  Deployment Complete! 🚀" -ForegroundColor Green
Write-Host "========================================" -ForegroundColor Cyan
