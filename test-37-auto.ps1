# Test gemini-3.7-flash - paste your API key in the script
$apiKey = "AQ.Ab8RN6LR4tORAigMgasOy1IoV1HW8F8m4C_BpHcDgXjEfzO3KQ"  # Your key from earlier

Write-Host "`nTesting gemini-3.7-flash..." -ForegroundColor Cyan

$body = @{
    contents = @(
        @{
            role = "user"
            parts = @(
                @{ text = "Hello, test message" }
            )
        }
    )
} | ConvertTo-Json -Depth 10

try {
    Write-Host "Sending request to gemini-3.7-flash..." -ForegroundColor Yellow
    
    $response = Invoke-RestMethod -Uri "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=$apiKey" `
        -Method Post `
        -Body $body `
        -ContentType "application/json" `
        -TimeoutSec 30 `
        -ErrorAction Stop
    
    Write-Host "`n✅ SUCCESS! gemini-3.7-flash works!" -ForegroundColor Green
    Write-Host "Response: $($response.candidates[0].content.parts[0].text)" -ForegroundColor White
    
} catch {
    Write-Host "`n❌ ERROR with gemini-3.7-flash:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    if ($_.ErrorDetails.Message) {
        Write-Host "`nError Details:" -ForegroundColor Yellow
        $errorJson = $_.ErrorDetails.Message | ConvertFrom-Json
        Write-Host "Code: $($errorJson.error.code)" -ForegroundColor White
        Write-Host "Message: $($errorJson.error.message)" -ForegroundColor White
        Write-Host "Status: $($errorJson.error.status)" -ForegroundColor White
    }
}

# Now test 3.6 for comparison
Write-Host "`n`nTesting gemini-3.6-flash for comparison..." -ForegroundColor Cyan

try {
    Write-Host "Sending request to gemini-3.6-flash..." -ForegroundColor Yellow
    
    $response = Invoke-RestMethod -Uri "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=$apiKey" `
        -Method Post `
        -Body $body `
        -ContentType "application/json" `
        -TimeoutSec 30 `
        -ErrorAction Stop
    
    Write-Host "`n✅ SUCCESS! gemini-3.6-flash works!" -ForegroundColor Green
    Write-Host "Response: $($response.candidates[0].content.parts[0].text)" -ForegroundColor White
    
} catch {
    Write-Host "`n❌ ERROR with gemini-3.6-flash:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
}
