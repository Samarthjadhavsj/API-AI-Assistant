# Test Gemini API - List available models
$apiKey = Read-Host "Enter your Gemini API key"

Write-Host "`nFetching available models..." -ForegroundColor Cyan

try {
    $response = Invoke-RestMethod -Uri "https://generativelanguage.googleapis.com/v1beta/models?key=$apiKey" -Method Get
    
    Write-Host "`n✅ Available Gemini Models:" -ForegroundColor Green
    Write-Host "================================" -ForegroundColor Green
    
    foreach ($model in $response.models) {
        if ($model.name -like "*gemini*" -and $model.supportedGenerationMethods -contains "generateContent") {
            $modelName = $model.name -replace "^models/", ""
            Write-Host "  • $modelName" -ForegroundColor Yellow
        }
    }
    
    Write-Host "`n" -ForegroundColor Green
    Write-Host "Copy one of these model names and use it in the app!" -ForegroundColor Cyan
    
} catch {
    Write-Host "`n❌ Error: $($_.Exception.Message)" -ForegroundColor Red
}

Write-Host "`nPress any key to exit..."
$null = $Host.UI.RawUI.ReadKey("NoEcho,IncludeKeyDown")
