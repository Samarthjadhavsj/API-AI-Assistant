# Hey Frank - Manual Test Execution Guide

## 📋 Purpose

This guide helps you execute the physical/manual test cases defined in `TEST_CASES.md`. Use this document to track your testing progress and record results.

---

## 🎯 Testing Objectives

1. Verify all features work as expected in real environment
2. Test on actual operating systems (Windows, macOS, Linux)
3. Validate user experience and UI/UX
4. Identify bugs and issues not caught by automated tests
5. Ensure application meets requirements

---

## 🛠️ Test Environment Setup

### Prerequisites

#### Software Requirements
- [ ] Windows 10/11 or macOS 10.13+ or Linux
- [ ] Node.js (Latest LTS)
- [ ] Valid API keys for testing:
  - [ ] OpenAI API key
  - [ ] Claude API key (optional)
  - [ ] Gemini API key (optional)
  - [ ] Other providers as needed

#### Test Data
- [ ] Sample images (PNG, JPG) for screenshot testing
- [ ] Test audio device (microphone)
- [ ] Screen recording software (OBS Studio) for stealth testing
- [ ] Video conferencing app (Zoom/Teams) for stealth testing

#### Build the Application
```bash
# Navigate to project directory
cd "c:\Users\SAMAR\OneDrive\Desktop\Pluly\API-AI-Assistant-main"

# Install dependencies
npm install

# Development mode
npm run tauri dev

# Production build (for full testing)
npm run tauri build
```

---

## 📊 Test Execution Tracking

### Test Status Legend
- ⚪ **Not Started** - Test not yet executed
- 🔵 **In Progress** - Currently testing
- ✅ **Pass** - Test passed
- ❌ **Fail** - Test failed (log defect)
- ⚠️ **Blocked** - Cannot test (dependency issue)
- ⏭️ **Skip** - Intentionally skipped

---

## 🧪 Test Execution Checklist

## Phase 1: Critical Functionality (Priority: Critical)

### Application Launch & Setup
- [ ] **TC-CORE-001**: Application Launch
  - Status: ⚪
  - Result: ___________
  - Notes: ___________
  - Defects: ___________

- [ ] **TC-CORE-002**: First Time Setup
  - Status: ⚪
  - Result: ___________
  - Notes: ___________
  - Defects: ___________

### Window Management
- [ ] **TC-CORE-003**: Toggle Window Shortcut (Shift+\)
  - Status: ⚪
  - Result: ___________
  - Notes: ___________
  - Defects: ___________

- [ ] **TC-WIN-001**: Window Always on Top
  - Status: ⚪
  - Result: ___________
  - Notes: ___________
  - Defects: ___________

- [ ] **TC-WIN-006**: Window Skip Taskbar
  - Status: ⚪
  - Result: ___________
  - Notes: ___________
  - Defects: ___________

### AI Communication
- [ ] **TC-AI-001**: OpenAI Provider Configuration
  - Status: ⚪
  - Result: ___________
  - API Key Used: ___________
  - Model Tested: ___________
  - Notes: ___________
  - Defects: ___________

- [ ] **TC-AI-006**: Streaming Response
  - Status: ⚪
  - Result: ___________
  - Notes: ___________
  - Defects: ___________

- [ ] **TC-CONV-002**: Send Message
  - Status: ⚪
  - Result: ___________
  - Notes: ___________
  - Defects: ___________

### Stealth Features
- [ ] **TC-STEALTH-001**: Screen Recording Protection
  - Status: ⚪
  - Tool Used: ___________
  - Result: ___________
  - Notes: ___________
  - Defects: ___________

- [ ] **TC-STEALTH-002**: Screenshot Protection
  - Status: ⚪
  - Tool Used: ___________
  - Result: ___________
  - Notes: ___________
  - Defects: ___________

---

## Phase 2: Core Features (Priority: High)

### Conversation Management
- [ ] **TC-CONV-001**: Start New Conversation
  - Status: ⚪
  - Result: ___________
  - Notes: ___________

- [ ] **TC-CONV-005**: Load Previous Conversation
  - Status: ⚪
  - Result: ___________
  - Notes: ___________

- [ ] **TC-CONV-010**: Conversation Persistence
  - Status: ⚪
  - Result: ___________
  - Notes: ___________

### Screenshot Features
- [ ] **TC-SCREEN-001**: Full Screen Capture
  - Status: ⚪
  - Result: ___________
  - Notes: ___________

- [ ] **TC-SCREEN-002**: Area Selection Capture
  - Status: ⚪
  - Result: ___________
  - Notes: ___________

- [ ] **TC-SCREEN-003**: Screenshot Auto Mode with Prompt
  - Status: ⚪
  - Result: ___________
  - Notes: ___________

### Audio & Voice
- [ ] **TC-AUDIO-001**: Microphone Voice Input
  - Status: ⚪
  - Result: ___________
  - Notes: ___________

- [ ] **TC-AUDIO-004**: Gemini Transcription
  - Status: ⚪
  - Result: ___________
  - Notes: ___________

### Settings
- [ ] **TC-SET-002**: Configure Keyboard Shortcuts
  - Status: ⚪
  - Result: ___________
  - Notes: ___________

- [ ] **TC-SET-012**: Settings Persistence
  - Status: ⚪
  - Result: ___________
  - Notes: ___________

---

## Phase 3: Extended Testing (Priority: Medium)

### Multiple AI Providers
- [ ] **TC-AI-002**: Claude Provider
  - Status: ⚪
  - Result: ___________

- [ ] **TC-AI-005**: Ollama Local Provider
  - Status: ⚪
  - Result: ___________

- [ ] **TC-AI-012**: All Supported Providers (11 total)
  - OpenAI: ⚪
  - Claude: ⚪
  - Grok: ⚪
  - Gemini: ⚪
  - Mistral: ⚪
  - Cohere: ⚪
  - Groq: ⚪
  - Perplexity: ⚪
  - OpenRouter: ⚪
  - Ollama: ⚪
  - DeepSeek: ⚪

### Security & Privacy
- [ ] **TC-SEC-001**: API Key Storage Security
  - Status: ⚪
  - Result: ___________

- [ ] **TC-SEC-002**: Local Data Storage Only
  - Status: ⚪
  - Result: ___________

### Performance
- [ ] **TC-PERF-001**: Application Startup Time
  - Status: ⚪
  - Measured Time: ___________
  - Target: <3 seconds
  - Result: ___________

- [ ] **TC-PERF-002**: Window Toggle Response Time
  - Status: ⚪
  - Measured Time: ___________
  - Target: <200ms
  - Result: ___________

### Cross-Platform (If Available)
- [ ] **TC-PLATFORM-001**: Windows 10 Compatibility
  - Status: ⚪
  - Result: ___________

- [ ] **TC-PLATFORM-002**: Windows 11 Compatibility
  - Status: ⚪
  - Result: ___________

- [ ] **TC-PLATFORM-003**: macOS Compatibility
  - Status: ⚪
  - Result: ___________

---

## Phase 4: Error Handling (Priority: Medium)

### Network Issues
- [ ] **TC-ERROR-001**: Network Connection Loss
  - Status: ⚪
  - Result: ___________

- [ ] **TC-ERROR-002**: API Key Expired/Invalid
  - Status: ⚪
  - Result: ___________

### User Input Validation
- [ ] **TC-ERROR-017**: Empty or Whitespace-Only Input
  - Status: ⚪
  - Result: ___________

### File Operations
- [ ] **TC-ERROR-011**: Invalid File Upload
  - Status: ⚪
  - Result: ___________

---

## 🐛 Defect Tracking Template

### Defect Report Format

```
Defect ID: BUG-001
Test Case: TC-CORE-003
Severity: [Critical/High/Medium/Low]
Priority: [P1/P2/P3/P4]

Title: Brief description

Description:
Detailed description of the issue

Steps to Reproduce:
1. Step 1
2. Step 2
3. Step 3

Expected Result:
What should happen

Actual Result:
What actually happened

Environment:
- OS: Windows 11
- Version: 0.1.8
- AI Provider: OpenAI

Screenshots/Logs:
[Attach if available]

Additional Notes:
Any other relevant information
```

---

## 📝 Defect Log

### Defect 1
- **ID**: BUG-___
- **Test Case**: ___________
- **Severity**: ___________
- **Status**: ___________
- **Description**: ___________

### Defect 2
- **ID**: BUG-___
- **Test Case**: ___________
- **Severity**: ___________
- **Status**: ___________
- **Description**: ___________

### Defect 3
- **ID**: BUG-___
- **Test Case**: ___________
- **Severity**: ___________
- **Status**: ___________
- **Description**: ___________

---

## 📊 Test Execution Summary

### Overall Statistics
- **Total Test Cases**: 206
- **Executed**: ___
- **Passed**: ___
- **Failed**: ___
- **Blocked**: ___
- **Skipped**: ___
- **Pass Rate**: ___%

### By Priority
- **Critical**: ___ / ___ passed
- **High**: ___ / ___ passed
- **Medium**: ___ / ___ passed
- **Low**: ___ / ___ passed

### By Category
- **Core Functionality**: ___ / ___ passed
- **Window Management**: ___ / ___ passed
- **AI Providers**: ___ / ___ passed
- **Stealth Mode**: ___ / ___ passed
- **Security**: ___ / ___ passed
- **Performance**: ___ / ___ passed

### Defects Summary
- **Total Defects Found**: ___
- **Critical**: ___
- **High**: ___
- **Medium**: ___
- **Low**: ___

---

## 🎯 Test Execution Tips

### Best Practices
1. **Test in Order**: Follow the phase order (Critical → High → Medium → Low)
2. **Fresh Environment**: Start each test session with a fresh application state
3. **Document Everything**: Record all observations, even if test passes
4. **Take Screenshots**: Capture evidence for both passes and failures
5. **Test Realistically**: Use the application as a real user would
6. **Edge Cases**: Don't just test happy paths

### Time Estimates
- **Phase 1 (Critical)**: ~2 hours
- **Phase 2 (High)**: ~3 hours
- **Phase 3 (Medium)**: ~4 hours
- **Phase 4 (Error Handling)**: ~2 hours
- **Total Estimated Time**: ~11 hours

### Quick Tests (Smoke Test)
For rapid validation, execute these critical tests:
1. TC-CORE-001 (App Launch)
2. TC-CORE-003 (Window Toggle)
3. TC-AI-001 (OpenAI Connection)
4. TC-CONV-002 (Send Message)
5. TC-STEALTH-001 (Screen Recording)

Time: ~30 minutes

---

## 🔍 Detailed Test Scenarios

### Scenario 1: First-Time User Experience
```
1. Fresh install
2. Launch application
3. Configure AI provider
4. Send first message
5. Hide and show window
6. Exit and relaunch

Expected: Smooth onboarding, settings persist
```

### Scenario 2: Power User Workflow
```
1. Rapid window toggles (Shift+\)
2. Multiple consecutive messages
3. Switch between conversations
4. Screenshot + send to AI
5. Voice input + send to AI
6. Export conversation

Expected: Fast, responsive, no crashes
```

### Scenario 3: Stealth Mode Validation
```
1. Start screen recording (OBS)
2. Show Hey Frank window
3. Interact with AI
4. Hide window
5. Stop recording
6. Review recording

Expected: Hey Frank not visible in recording
```

### Scenario 4: Error Recovery
```
1. Disconnect internet
2. Send message (should fail gracefully)
3. Reconnect internet
4. Retry message (should work)
5. Invalid API key (should show clear error)
6. Fix API key (should work)

Expected: Graceful error handling, clear messages
```

---

## 📱 Platform-Specific Testing

### Windows-Specific Tests
- [ ] Taskbar behavior (should be hidden)
- [ ] Alt+Tab behavior
- [ ] Window transparency
- [ ] Shift+\ shortcut works
- [ ] System tray icon
- [ ] Content protection (screen capture)

### macOS-Specific Tests
- [ ] Dock behavior (can be hidden)
- [ ] Cmd+\ or configured shortcut
- [ ] Screen recording permission
- [ ] Microphone permission
- [ ] Panel behavior
- [ ] All workspaces visibility

### Linux-Specific Tests (If applicable)
- [ ] Window manager compatibility
- [ ] Shortcut functionality
- [ ] System tray support
- [ ] Basic feature functionality

---

## ✅ Test Completion Criteria

### Exit Criteria
- [ ] All Critical tests executed and passed (or known issues documented)
- [ ] All High-priority tests executed
- [ ] >95% pass rate for Critical + High tests
- [ ] All Critical defects fixed or have workarounds
- [ ] No blocking defects remain
- [ ] Test summary report completed

### Sign-Off Checklist
- [ ] Test execution completed
- [ ] Defects logged and prioritized
- [ ] Test evidence collected (screenshots, logs)
- [ ] Test summary created
- [ ] Stakeholders informed
- [ ] Release recommendation provided

---

## 📄 Test Report Template

### Test Execution Report

**Project**: Hey Frank AI Assistant  
**Version**: 0.1.8  
**Test Cycle**: Manual Testing Phase 1  
**Test Date**: ___________  
**Tester**: ___________  
**Environment**: ___________

#### Executive Summary
[Brief overview of testing and results]

#### Test Coverage
- Total Tests Planned: 206
- Total Tests Executed: ___
- Pass Rate: ___%

#### Defects Summary
- Total Defects: ___
- Critical: ___
- High: ___
- Medium: ___
- Low: ___

#### Risk Assessment
[Any risks identified during testing]

#### Recommendations
[Release recommendation and next steps]

#### Detailed Results
[Link to detailed test logs]

---

## 🚀 Getting Started

### Quick Start
1. Build the application: `npm run tauri build`
2. Review test prerequisites above
3. Start with Phase 1 (Critical tests)
4. Document results in this guide
5. Log defects as you find them
6. Complete test summary

### Need Help?
- See `TEST_CASES.md` for detailed test steps
- See `TESTING.md` for automated test info
- Check application logs for debugging

---

## 📞 Support

For questions during testing:
1. Check the test case details in `TEST_CASES.md`
2. Review application documentation
3. Check console logs for errors
4. Take screenshots for evidence

---

**Happy Testing! 🧪**

*Remember: The goal is to find bugs BEFORE users do. Be thorough, be creative, and test like you're trying to break the application!*

---

**Document Version**: 1.0  
**Last Updated**: December 2024  
**Status**: Ready for Test Execution
