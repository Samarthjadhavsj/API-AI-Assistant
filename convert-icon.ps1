# Icon Conversion Script for Hey Frank
# This script converts your custom image to all required icon formats

Write-Host "Converting icon to required formats..." -ForegroundColor Cyan

# Source image - update this path if needed
$sourceImage = "C:\Users\SAMAR\Downloads\image-portfolio (1) (1).png"
$iconsDir = "src-tauri\icons"

# Check if source exists
if (-not (Test-Path $sourceImage)) {
    Write-Host "Error: Source image not found at $sourceImage" -ForegroundColor Red
    exit 1
}

Write-Host "Source image found: $sourceImage" -ForegroundColor Green

# For now, just copy the image as a base
# You'll need to manually resize or use an online tool like:
# - https://redketchup.io/icon-converter
# - https://cloudconvert.com/
# - https://favicon.io/

Write-Host "`nNext steps:" -ForegroundColor Yellow
Write-Host "1. Go to https://icon.kitchen/ or https://redketchup.io/icon-converter"
Write-Host "2. Upload your image: $sourceImage"
Write-Host "3. Generate icons for:"
Write-Host "   - Windows (.ico)"
Write-Host "   - macOS (.icns)"
Write-Host "   - PNG sizes: 32x32, 128x128, 256x256, 512x512"
Write-Host "4. Download and replace files in: $iconsDir"
Write-Host ""
Write-Host "Or copy your image to icons directory and we'll use it:" -ForegroundColor Cyan
Copy-Item $sourceImage "$iconsDir\icon-source.png" -Force
Write-Host "Copied to: $iconsDir\icon-source.png" -ForegroundColor Green

Write-Host "`nQuick online converters:" -ForegroundColor Cyan
Write-Host "- https://icon.kitchen/ (Best for app icons)"
Write-Host "- https://redketchup.io/icon-converter (All formats)"
Write-Host "- https://cloudconvert.com/ (Batch conversion)"
