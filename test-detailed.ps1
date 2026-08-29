# Detailed test to find exact reason for 3.7-flash failure
$apiKey = "AQ.Ab8RN6LR4tORAigMgasOy1IoV1HW8F8m4C_BpHcDgXjEfzO3KQ"

Write-Host "=== Testing gemini-3.7-flash with detailed diagnostics ===" -ForegroundColor Cyan
Write-Host ""

$body = '{"contents":[{"role":"user","parts":[{"text":"test"}]}]}'

Write-Host "1. Testing basic connectivity..." -ForegroundColor Yellow
try {
    $testUrl = "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash"
    $headers = @{
        "x-goog-api-key" = $apiKey
    }
    
    Write-Host "2. Checking if model exists..." -ForegroundColor Yellow
    $modelCheck = Invoke-WebRequest -Uri "$testUrl`?key=$apiKey" -Method Get -TimeoutSec 10 -UseBasicParsing -ErrorAction SilentlyContinue
    Write-Host "   Model metadata retrieved: $($modelCheck.StatusCode)" -ForegroundColor Green
} catch {
    Write-Host "   Model check failed: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host ""
Write-Host "3. Testing generateContent endpoint..." -ForegroundColor Yellow
Write-Host "   URL: https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent" -ForegroundColor Gray
Write-Host "   Timeout: 15 seconds" -ForegroundColor Gray
Write-Host ""

$stopwatch = [System.Diagnostics.Stopwatch]::StartNew()

try {
    $response = Invoke-RestMethod `
        -Uri "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=$apiKey" `
        -Method Post `
        -Body $body `
        -ContentType "application/json" `
        -TimeoutSec 15 `
        -Verbose
    
    $stopwatch.Stop()
    
    Write-Host "✅ SUCCESS!" -ForegroundColor Green
    Write-Host "   Response time: $($stopwatch.ElapsedMilliseconds)ms" -ForegroundColor Cyan
    Write-Host "   Response: $($response.candidates[0].content.parts[0].text)" -ForegroundColor White
    
} catch [System.Net.WebException] {
    $stopwatch.Stop()
    Write-Host "❌ NETWORK ERROR after $($stopwatch.ElapsedMilliseconds)ms" -ForegroundColor Red
    
    $statusCode = $_.Exception.Response.StatusCode.value__
    $statusDesc = $_.Exception.Response.StatusDescription
    
    Write-Host "   HTTP Status: $statusCode - $statusDesc" -ForegroundColor Yellow
    
    if ($_.ErrorDetails.Message) {
        $errorObj = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host ""
        Write-Host "   Error Code: $($errorObj.error.code)" -ForegroundColor Red
        Write-Host "   Error Message: $($errorObj.error.message)" -ForegroundColor Red
        Write-Host "   Error Status: $($errorObj.error.status)" -ForegroundColor Red
    }
} catch {
    $stopwatch.Stop()
    Write-Host "❌ TIMEOUT/ERROR after $($stopwatch.ElapsedMilliseconds)ms" -ForegroundColor Red
    Write-Host "   Exception: $($_.Exception.GetType().Name)" -ForegroundColor Yellow
    Write-Host "   Message: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== Now testing gemini-3.6-flash for comparison ===" -ForegroundColor Cyan
Write-Host ""

$stopwatch2 = [System.Diagnostics.Stopwatch]::StartNew()

try {
    $response2 = Invoke-RestMethod `
        -Uri "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=$apiKey" `
        -Method Post `
        -Body $body `
        -ContentType "application/json" `
        -TimeoutSec 15
    
    $stopwatch2.Stop()
    
    Write-Host "✅ SUCCESS!" -ForegroundColor Green
    Write-Host "   Response time: $($stopwatch2.ElapsedMilliseconds)ms" -ForegroundColor Cyan
    Write-Host "   Response: $($response2.candidates[0].content.parts[0].text)" -ForegroundColor White
    
} catch {
    $stopwatch2.Stop()
    Write-Host "❌ ERROR after $($stopwatch2.ElapsedMilliseconds)ms" -ForegroundColor Red
    Write-Host "   Message: $($_.Exception.Message)" -ForegroundColor Yellow
}

Write-Host ""
Write-Host "=== CONCLUSION ===" -ForegroundColor Cyan
Write-Host "Press any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
