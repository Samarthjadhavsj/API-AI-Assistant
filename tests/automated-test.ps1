# Automated Testing Script for Pluly App
# Run this script to perform automated checks

Write-Host "╔════════════════════════════════════════════════════════╗" -ForegroundColor Cyan
Write-Host "║       Pluly App - Automated Test Suite               ║" -ForegroundColor Cyan
Write-Host "╚════════════════════════════════════════════════════════╝" -ForegroundColor Cyan
Write-Host ""

$testResults = @()
$passCount = 0
$failCount = 0

function Test-Case {
    param(
        [string]$TestId,
        [string]$Description,
        [scriptblock]$TestScript
    )
    
    Write-Host "Running $TestId`: $Description" -ForegroundColor Yellow
    
    try {
        $result = & $TestScript
        if ($result) {
            Write-Host "  ✓ PASS" -ForegroundColor Green
            $script:passCount++
            $script:testResults += [PSCustomObject]@{
                TestId = $TestId
                Description = $Description
                Result = "PASS"
                Error = $null
            }
        } else {
            Write-Host "  ✗ FAIL" -ForegroundColor Red
            $script:failCount++
            $script:testResults += [PSCustomObject]@{
                TestId = $TestId
                Description = $Description
                Result = "FAIL"
                Error = "Test returned false"
            }
        }
    } catch {
        Write-Host "  ✗ ERROR: $($_.Exception.Message)" -ForegroundColor Red
        $script:failCount++
        $script:testResults += [PSCustomObject]@{
            TestId = $TestId
            Description = $Description
            Result = "ERROR"
            Error = $_.Exception.Message
        }
    }
    Write-Host ""
}

# ============================================
# Test Suite: File Structure
# ============================================

Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Test Suite 1: File Structure & Dependencies" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Test-Case "TS1-001" "package.json exists" {
    Test-Path "package.json"
}

Test-Case "TS1-002" "node_modules directory exists" {
    Test-Path "node_modules"
}

Test-Case "TS1-003" "src directory exists" {
    Test-Path "src"
}

Test-Case "TS1-004" "AI providers config exists" {
    Test-Path "src/config/ai-providers.constants.ts"
}

Test-Case "TS1-005" "Shortcuts config exists" {
    Test-Path "src/config/shortcuts.ts"
}

# ============================================
# Test Suite: Configuration Files
# ============================================

Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Test Suite 2: Configuration Validity" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Test-Case "TS2-001" "package.json is valid JSON" {
    try {
        $pkg = Get-Content "package.json" -Raw | ConvertFrom-Json
        $pkg.name -eq "pluely"
    } catch {
        $false
    }
}

Test-Case "TS2-002" "AI providers config contains Gemini" {
    $content = Get-Content "src/config/ai-providers.constants.ts" -Raw
    $content -match "gemini"
}

Test-Case "TS2-003" "AI providers config contains DeepSeek" {
    $content = Get-Content "src/config/ai-providers.constants.ts" -Raw
    $content -match "deepseek"
}

# ============================================
# Test Suite: TypeScript Compilation
# ============================================

Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Test Suite 3: TypeScript Compilation" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

Test-Case "TS3-001" "TypeScript compiles without errors" {
    $output = npm run build 2>&1
    $LASTEXITCODE -eq 0
}

# ============================================
# Test Suite: Gemini API Integration
# ============================================

Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Test Suite 4: Gemini API Integration" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$apiKey = Read-Host "Enter Gemini API key for testing (or press Enter to skip API tests)"

if ($apiKey) {
    Test-Case "TS4-001" "Gemini API key is valid" {
        try {
            $response = Invoke-RestMethod -Uri "https://generativelanguage.googleapis.com/v1beta/models?key=$apiKey" -Method Get -TimeoutSec 10
            $response.models.Count -gt 0
        } catch {
            $false
        }
    }

    Test-Case "TS4-002" "gemini-3.6-flash model is available" {
        try {
            $body = '{"contents":[{"role":"user","parts":[{"text":"test"}]}]}'
            $response = Invoke-RestMethod -Uri "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=$apiKey" `
                -Method Post -Body $body -ContentType "application/json" -TimeoutSec 15
            $response.candidates.Count -gt 0
        } catch {
            $false
        }
    }

    Test-Case "TS4-003" "Gemini API responds within 10 seconds" {
        try {
            $stopwatch = [System.Diagnostics.Stopwatch]::StartNew()
            $body = '{"contents":[{"role":"user","parts":[{"text":"Hello"}]}]}'
            $response = Invoke-RestMethod -Uri "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=$apiKey" `
                -Method Post -Body $body -ContentType "application/json" -TimeoutSec 15
            $stopwatch.Stop()
            $stopwatch.ElapsedMilliseconds -lt 10000
        } catch {
            $false
        }
    }
} else {
    Write-Host "Skipping API tests (no API key provided)" -ForegroundColor Yellow
    Write-Host ""
}

# ============================================
# Test Results Summary
# ============================================

Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host "Test Results Summary" -ForegroundColor Cyan
Write-Host "═══════════════════════════════════════════════════════" -ForegroundColor Cyan
Write-Host ""

$totalTests = $passCount + $failCount
$passPercentage = if ($totalTests -gt 0) { [math]::Round(($passCount / $totalTests) * 100, 2) } else { 0 }

Write-Host "Total Tests Run:  $totalTests" -ForegroundColor White
Write-Host "Passed:           $passCount" -ForegroundColor Green
Write-Host "Failed:           $failCount" -ForegroundColor Red
Write-Host "Success Rate:     $passPercentage%" -ForegroundColor $(if ($passPercentage -ge 80) { "Green" } elseif ($passPercentage -ge 50) { "Yellow" } else { "Red" })
Write-Host ""

if ($failCount -gt 0) {
    Write-Host "Failed Tests:" -ForegroundColor Red
    Write-Host "─────────────────────────────────────────────────────" -ForegroundColor Red
    $testResults | Where-Object { $_.Result -ne "PASS" } | ForEach-Object {
        Write-Host "$($_.TestId): $($_.Description)" -ForegroundColor Red
        if ($_.Error) {
            Write-Host "  Error: $($_.Error)" -ForegroundColor Yellow
        }
    }
    Write-Host ""
}

# Save results to file
$testResults | ConvertTo-Json | Out-File "test-results.json"
Write-Host "Full test results saved to: test-results.json" -ForegroundColor Cyan
Write-Host ""

# Exit with appropriate code
if ($failCount -gt 0) {
    Write-Host "⚠️  Some tests failed. Please review the results above." -ForegroundColor Yellow
    exit 1
} else {
    Write-Host "✅ All tests passed!" -ForegroundColor Green
    exit 0
}
