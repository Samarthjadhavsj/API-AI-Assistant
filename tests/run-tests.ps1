# Simple Test Runner for Pluly App

Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "       Pluly App - Test Suite                       " -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

$passed = 0
$failed = 0

function Test-Item {
    param(
        [string]$Name,
        [bool]$Result
    )
    
    if ($Result) {
        Write-Host "[PASS] $Name" -ForegroundColor Green
        $script:passed++
    } else {
        Write-Host "[FAIL] $Name" -ForegroundColor Red
        $script:failed++
    }
}

# Test 1: File Structure
Write-Host "Test Suite: File Structure" -ForegroundColor Yellow
Write-Host "-----------------------------------------------------" -ForegroundColor Yellow

Test-Item "package.json exists" (Test-Path "package.json")
Test-Item "src directory exists" (Test-Path "src")
Test-Item "node_modules exists" (Test-Path "node_modules")
Test-Item "AI providers config exists" (Test-Path "src/config/ai-providers.constants.ts")
Test-Item "Shortcuts config exists" (Test-Path "src/config/shortcuts.ts")

Write-Host ""

# Test 2: Configuration Files
Write-Host "Test Suite: Configuration" -ForegroundColor Yellow
Write-Host "-----------------------------------------------------" -ForegroundColor Yellow

try {
    $pkg = Get-Content "package.json" -Raw | ConvertFrom-Json
    Test-Item "package.json is valid JSON" ($pkg.name -like "*AI-Assistant*")
} catch {
    Test-Item "package.json is valid JSON" $false
}

$aiConfig = Get-Content "src/config/ai-providers.constants.ts" -Raw
Test-Item "Gemini provider exists" ($aiConfig -match "gemini")
Test-Item "DeepSeek provider exists" ($aiConfig -match "deepseek")

Write-Host ""

# Test 3: Dependencies
Write-Host "Test Suite: Dependencies" -ForegroundColor Yellow
Write-Host "-----------------------------------------------------" -ForegroundColor Yellow

Test-Item "Node modules installed" (Test-Path "node_modules/@tauri-apps")
Test-Item "React installed" (Test-Path "node_modules/react")
Test-Item "TypeScript installed" (Test-Path "node_modules/typescript")

Write-Host ""

# Summary
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host "Test Results Summary" -ForegroundColor Cyan
Write-Host "=====================================================" -ForegroundColor Cyan
Write-Host ""

$total = $passed + $failed
$percentage = if ($total -gt 0) { [math]::Round(($passed / $total) * 100, 2) } else { 0 }

Write-Host "Total Tests:   $total" -ForegroundColor White
Write-Host "Passed:        $passed" -ForegroundColor Green
Write-Host "Failed:        $failed" -ForegroundColor Red
Write-Host "Success Rate:  $percentage%" -ForegroundColor $(if ($percentage -ge 80) { "Green" } else { "Yellow" })
Write-Host ""

if ($failed -eq 0) {
    Write-Host "[SUCCESS] All tests passed!" -ForegroundColor Green
    exit 0
} else {
    Write-Host "[WARNING] Some tests failed." -ForegroundColor Yellow
    exit 1
}
