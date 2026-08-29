# Test gemini-3.7-flash specifically
$apiKey = Read-Host "Enter your Gemini API key"

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
    Write-Host "Sending request..." -ForegroundColor Yellow
    
    $response = Invoke-RestMethod -Uri "https://generativelanguage.googleapis.com/v1beta/models/gemini-3.7-flash:generateContent?key=$apiKey" `
        -Method Post `
        -Body $body `
        -ContentType "application/json" `
        -TimeoutSec 30
    
    Write-Host "`n✅ SUCCESS! gemini-3.7-flash is working!" -ForegroundColor Green
    Write-Host "Response:" -ForegroundColor Cyan
    Write-Host $response.candidates[0].content.parts[0].text -ForegroundColor White
    
} catch {
    Write-Host "`n❌ ERROR with gemini-3.7-flash:" -ForegroundColor Red
    Write-Host $_.Exception.Message -ForegroundColor Red
    
    if ($_.ErrorDetails.Message) {
        Write-Host "`nDetails:" -ForegroundColor Yellow
        Write-Host $_.ErrorDetails.Message -ForegroundColor White
    }
}

Write-Host "`nPress any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
