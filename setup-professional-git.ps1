# Professional Git Repository Setup Script
# This script creates a clean, professional Git history with feature branches

Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Professional Git Repository Setup" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""

# Confirm before proceeding
$confirm = Read-Host "This will create 33 feature branches. Continue? (yes/no)"
if ($confirm -ne "yes") {
    Write-Host "Setup cancelled." -ForegroundColor Yellow
    exit
}

Write-Host ""
Write-Host "Step 1: Checking current branch..." -ForegroundColor Green
$currentBranch = git branch --show-current
Write-Host "Current branch: $currentBranch" -ForegroundColor White

Write-Host ""
Write-Host "Step 2: Creating feature branches..." -ForegroundColor Green

# Feature branches list
$branches = @(
    # Core Infrastructure
    "feature/project-setup",
    "feature/database-sqlite",
    "feature/routing-system",
    "feature/theme-system",
    "feature/error-boundaries",
    
    # AI Integration
    "feature/ai-provider-integration",
    "feature/streaming-responses",
    "feature/conversation-management",
    "feature/system-prompts",
    "feature/context-management",
    
    # UI Components
    "feature/component-library",
    "feature/sidebar-navigation",
    "feature/chat-interface",
    "feature/markdown-renderer",
    "feature/popover-system",
    
    # Window Management
    "feature/overlay-window",
    "feature/persistent-toggle",
    "feature/window-transparency",
    "feature/toggle-settings-access",
    
    # System Integration
    "feature/keyboard-shortcuts",
    "feature/system-tray",
    "feature/auto-start",
    "feature/screen-capture",
    
    # Advanced Features
    "feature/voice-input",
    "feature/file-attachments",
    "feature/audio-settings",
    "feature/response-customization",
    "feature/conversation-export",
    
    # Testing & Quality
    "feature/unit-tests",
    "feature/integration-tests",
    "feature/manual-test-suite",
    
    # Bug Fixes
    "fix/message-history-visibility",
    "fix/conversation-persistence"
)

$branchCount = 0
foreach ($branch in $branches) {
    $branchCount++
    Write-Host "[$branchCount/$($branches.Count)] Creating: $branch" -ForegroundColor Yellow
    
    # Check if branch already exists
    $exists = git branch --list $branch
    if ($exists) {
        Write-Host "  → Branch already exists, skipping" -ForegroundColor Gray
    } else {
        git branch $branch 2>$null
        if ($LASTEXITCODE -eq 0) {
            Write-Host "  → Created successfully" -ForegroundColor Green
        } else {
            Write-Host "  → Failed to create" -ForegroundColor Red
        }
    }
}

Write-Host ""
Write-Host "Step 3: Listing all branches..." -ForegroundColor Green
git branch --list "feature/*" "fix/*"

Write-Host ""
Write-Host "Step 4: Summary" -ForegroundColor Green
$totalBranches = (git branch --list).Count
Write-Host "Total branches: $totalBranches" -ForegroundColor White
Write-Host "Feature branches: $((git branch --list 'feature/*').Count)" -ForegroundColor White
Write-Host "Fix branches: $((git branch --list 'fix/*').Count)" -ForegroundColor White

Write-Host ""
Write-Host "========================================" -ForegroundColor Cyan
Write-Host "Setup Complete!" -ForegroundColor Cyan
Write-Host "========================================" -ForegroundColor Cyan
Write-Host ""
Write-Host "Next steps:" -ForegroundColor Yellow
Write-Host "1. Review GIT_BRANCH_STRATEGY.md for workflow details" -ForegroundColor White
Write-Host "2. Push branches to GitHub: git push --all origin" -ForegroundColor White
Write-Host "3. Create Pull Requests for each feature" -ForegroundColor White
Write-Host ""
