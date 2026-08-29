# Testing Guide for Pluly AI Assistant

Welcome to the testing branch! This guide will help you test every feature of the app.

---

## 🚀 Quick Start

### Run Automated Tests
```powershell
# From project root
powershell -ExecutionPolicy Bypass -File tests/run-tests.ps1
```

**Current Results**: ✅ 11/11 tests passing (100%)

---

## 📋 Testing Resources

### 1. **TESTING.md**
Complete test plan with 99 test cases across 7 categories:
- Core Functionality (18 tests)
- AI Providers (19 tests)
- Keyboard Shortcuts (10 tests)
- UI/UX (14 tests)
- Settings & Configuration (13 tests)
- Performance (11 tests)
- Error Handling (14 tests)

### 2. **tests/MANUAL_TEST_CHECKLIST.md**
Step-by-step manual testing checklist with checkboxes.
Perfect for thorough feature testing.

### 3. **tests/TEST_REPORT_TEMPLATE.md**
Template for documenting test results.
Use this to create your final test report.

### 4. **tests/run-tests.ps1**
Automated test script for quick validation.
Tests file structure, configuration, and dependencies.

---

## 🧪 How to Test

### Step 1: Run Automated Tests
```powershell
cd API-AI-Assistant-main
powershell -ExecutionPolicy Bypass -File tests/run-tests.ps1
```

### Step 2: Start the App
```powershell
npm run tauri dev
```

### Step 3: Follow Manual Checklist
Open `tests/MANUAL_TEST_CHECKLIST.md` and test each feature:
- [ ] Basic chat functionality
- [ ] Keyboard shortcuts
- [ ] AI provider configuration
- [ ] Settings persistence
- [ ] Error handling
- [ ] Performance metrics

### Step 4: Document Results
Use `tests/TEST_REPORT_TEMPLATE.md` to create your test report.

---

## 📊 Test Categories

### ✅ Core Functionality (Priority: High)
- Send/receive messages
- Image upload and analysis
- Voice/audio recording
- Screenshot capability
- Chat history

### ⚙️ AI Providers (Priority: High)
- Gemini (gemini-3.6-flash)
- DeepSeek
- OpenAI, Claude, Groq, etc.
- Provider switching
- Rate limiting

### ⌨️ Keyboard Shortcuts (Priority: Medium)
- Shift+D: Toggle dashboard
- Shift+\\: Toggle window
- Shift+I: Focus input
- Shift+S: Screenshot
- Shift+A: Audio recording
- Shift+M: System audio

### 🎨 UI/UX (Priority: Medium)
- Message rendering
- Code syntax highlighting
- Markdown support
- Theme support
- Responsive design

### 📈 Performance (Priority: High)
- Launch time < 5 seconds
- Response time < 10 seconds
- Memory usage < 500MB
- No memory leaks
- Smooth scrolling

### ⚠️ Error Handling (Priority: High)
- Network errors
- API errors (400, 401, 403, 404, 429, 500)
- Invalid input handling
- Graceful degradation

---

## 🎯 Testing Priorities

### Must Test (P0 - Critical)
1. Basic chat works
2. Gemini API responds
3. App doesn't crash
4. Settings persist

### Should Test (P1 - High)
1. All keyboard shortcuts
2. Image upload
3. Error messages display
4. Performance metrics

### Nice to Test (P2 - Medium)
1. Theme switching
2. Multiple providers
3. Long conversations
4. Edge cases

---

## 📝 Creating a Bug Report

When you find a bug, document it:

```markdown
**Bug ID**: BUG-XXX
**Title**: [Short description]
**Severity**: Critical / High / Medium / Low

**Steps to Reproduce**:
1. Step 1
2. Step 2
3. Step 3

**Expected**: [What should happen]
**Actual**: [What actually happened]

**Environment**:
- Branch: feature/comprehensive-testing
- OS: Windows
- Model: gemini-3.6-flash

**Screenshots**: [Attach if applicable]
**Console Errors**: [From DevTools]
```

---

## ✅ Definition of Done

A feature is "tested" when:
- [ ] Automated tests pass
- [ ] Manual test checklist completed
- [ ] No critical bugs found
- [ ] Performance metrics met
- [ ] Test report created
- [ ] All issues documented

---

## 🔧 Useful Commands

### Testing
```powershell
# Run automated tests
powershell -ExecutionPolicy Bypass -File tests/run-tests.ps1

# Test Gemini API directly
powershell -ExecutionPolicy Bypass -File test-gemini.ps1

# Check TypeScript compilation
npm run build
```

### Development
```powershell
# Start dev server
npm run tauri dev

# Build production
npm run tauri build

# Check for errors
npm run lint
```

### Git
```powershell
# Check current branch
git branch

# See commit history
git log --oneline -10

# Create test report commit
git add tests/
git commit -m "Test report: [Your findings]"
```

---

## 📈 Test Coverage Goals

Current Coverage:
```
Automated Tests:    [██████████] 100% (11/11)
Manual Tests:       [░░░░░░░░░░]   0% (0/99)
Overall Coverage:   [█░░░░░░░░░]  10%
```

Target Coverage:
```
Automated Tests:    100% ✅
Manual Tests:        85% 🎯
Overall Coverage:    90% 🎯
```

---

## 🐛 Known Issues

### Fixed
- ✅ Gemini API 403 error (fixed - URL parameter handling)
- ✅ Model name format error (fixed - using native API)
- ✅ URL encoding issue (fixed - decodeURIComponent)

### To Investigate
- gemini-3.7-flash timeout (not production-ready)
- Package name discrepancy (api-AI-Assistant vs pluely)

---

## 📞 Need Help?

1. Check `TESTING.md` for detailed test cases
2. Review `tests/MANUAL_TEST_CHECKLIST.md` for step-by-step guides
3. Use `tests/TEST_REPORT_TEMPLATE.md` for reporting

---

## 🎉 Ready to Test!

1. ✅ Testing branch created: `feature/comprehensive-testing`
2. ✅ 99 test cases defined
3. ✅ Automated test script created
4. ✅ Manual checklist provided
5. ✅ Test report template ready

**Start testing now!**
```powershell
powershell -ExecutionPolicy Bypass -File tests/run-tests.ps1
npm run tauri dev
```

Happy Testing! 🧪
