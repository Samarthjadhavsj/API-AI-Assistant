# Pluly App - Comprehensive Testing Plan

## Test Branch: `feature/comprehensive-testing`

This document outlines all test cases for the Pluly AI Assistant app.

---

## 🎯 Test Categories

1. [Core Functionality](#1-core-functionality)
2. [AI Providers](#2-ai-providers)
3. [Keyboard Shortcuts](#3-keyboard-shortcuts)
4. [UI/UX](#4-uiux)
5. [Settings & Configuration](#5-settings--configuration)
6. [Performance](#6-performance)
7. [Error Handling](#7-error-handling)

---

## 1. Core Functionality

### 1.1 Chat/Messaging
- [ ] **TC-001**: Send a simple text message and receive response
- [ ] **TC-002**: Send multiple messages in sequence
- [ ] **TC-003**: Send long messages (>1000 characters)
- [ ] **TC-004**: Send special characters and emojis
- [ ] **TC-005**: Send code snippets (markdown formatted)
- [ ] **TC-006**: Clear chat history
- [ ] **TC-007**: View previous chat history after app restart

### 1.2 Image Support
- [ ] **TC-008**: Upload and send image
- [ ] **TC-009**: Send multiple images at once
- [ ] **TC-010**: Copy/paste image from clipboard
- [ ] **TC-011**: Drag and drop image into chat

### 1.3 Voice/Audio
- [ ] **TC-012**: Record audio message
- [ ] **TC-013**: Stop audio recording mid-way
- [ ] **TC-014**: System audio recording
- [ ] **TC-015**: Audio playback of responses (if supported)

### 1.4 Screenshot
- [ ] **TC-016**: Take screenshot of entire screen
- [ ] **TC-017**: Take screenshot of selected area
- [ ] **TC-018**: Send screenshot directly to chat

---

## 2. AI Providers

### 2.1 Gemini Configuration
- [ ] **TC-019**: Configure Gemini with API key
- [ ] **TC-020**: Test with `gemini-3.6-flash` model
- [ ] **TC-021**: Test with `gemini-flash-latest` model
- [ ] **TC-022**: Test response streaming
- [ ] **TC-023**: Test with system prompt customization
- [ ] **TC-024**: Test rate limiting (send 30+ requests quickly)
- [ ] **TC-025**: Test with invalid API key (should show error)
- [ ] **TC-026**: Test with empty model name (should show error)

### 2.2 Other Providers
- [ ] **TC-027**: Configure and test OpenAI
- [ ] **TC-028**: Configure and test Claude
- [ ] **TC-029**: Configure and test DeepSeek
- [ ] **TC-030**: Configure and test Groq
- [ ] **TC-031**: Configure and test Ollama (local)
- [ ] **TC-032**: Switch between providers mid-conversation

### 2.3 Provider Features
- [ ] **TC-033**: Test image understanding (Gemini)
- [ ] **TC-034**: Test code generation
- [ ] **TC-035**: Test long context (1000+ words)
- [ ] **TC-036**: Test multi-turn conversation
- [ ] **TC-037**: Test function calling (if supported)

---

## 3. Keyboard Shortcuts

### 3.1 Basic Shortcuts
- [ ] **TC-038**: `Shift+D` - Toggle dashboard
- [ ] **TC-039**: `Shift+\` - Toggle window visibility
- [ ] **TC-040**: `Shift+I` - Focus input field
- [ ] **TC-041**: `Shift+S` - Take screenshot
- [ ] **TC-042**: `Shift+A` - Start audio recording
- [ ] **TC-043**: `Shift+M` - System audio recording

### 3.2 Shortcut Conflicts
- [ ] **TC-044**: Test shortcuts while typing in input field
- [ ] **TC-045**: Test shortcuts in Dev Space settings
- [ ] **TC-046**: Test shortcuts when app is minimized
- [ ] **TC-047**: Test shortcuts when another app is focused

---

## 4. UI/UX

### 4.1 Interface Elements
- [ ] **TC-048**: Dashboard displays correctly
- [ ] **TC-049**: Chat messages render properly (markdown)
- [ ] **TC-050**: Code blocks display with syntax highlighting
- [ ] **TC-051**: Links are clickable
- [ ] **TC-052**: Images display inline
- [ ] **TC-053**: Scroll behavior works smoothly
- [ ] **TC-054**: Copy button works on code blocks

### 4.2 Responsiveness
- [ ] **TC-055**: Window resizing works correctly
- [ ] **TC-056**: Minimum window size is enforced
- [ ] **TC-057**: UI adapts to different screen sizes
- [ ] **TC-058**: Text wrapping works properly

### 4.3 Dark/Light Theme
- [ ] **TC-059**: Switch to dark theme
- [ ] **TC-060**: Switch to light theme
- [ ] **TC-061**: Theme persists after restart

---

## 5. Settings & Configuration

### 5.1 Dev Space
- [ ] **TC-062**: Open Dev Space settings
- [ ] **TC-063**: Add new AI provider
- [ ] **TC-064**: Edit existing provider
- [ ] **TC-065**: Delete custom provider
- [ ] **TC-066**: Save configuration
- [ ] **TC-067**: Configuration persists after restart

### 5.2 System Prompt
- [ ] **TC-068**: Set custom system prompt
- [ ] **TC-069**: Clear system prompt
- [ ] **TC-070**: System prompt affects responses
- [ ] **TC-071**: Change system prompt mid-conversation

### 5.3 Response Settings
- [ ] **TC-072**: Change response length setting
- [ ] **TC-073**: Change language setting
- [ ] **TC-074**: Settings apply to new messages

---

## 6. Performance

### 6.1 Speed & Responsiveness
- [ ] **TC-075**: App launches in <5 seconds
- [ ] **TC-076**: Messages send without delay
- [ ] **TC-077**: Streaming responses appear smoothly
- [ ] **TC-078**: No lag when typing in input field
- [ ] **TC-079**: No lag when scrolling chat history

### 6.2 Resource Usage
- [ ] **TC-080**: Memory usage stays under 500MB
- [ ] **TC-081**: CPU usage is reasonable (<20% idle)
- [ ] **TC-082**: No memory leaks after extended use

### 6.3 Stability
- [ ] **TC-083**: App doesn't crash during normal use
- [ ] **TC-084**: App handles network errors gracefully
- [ ] **TC-085**: App recovers from API errors

---

## 7. Error Handling

### 7.1 Network Errors
- [ ] **TC-086**: Handle no internet connection
- [ ] **TC-087**: Handle API timeout
- [ ] **TC-088**: Handle API rate limit exceeded
- [ ] **TC-089**: Show user-friendly error messages

### 7.2 API Errors
- [ ] **TC-090**: Handle 400 Bad Request
- [ ] **TC-091**: Handle 401 Unauthorized
- [ ] **TC-092**: Handle 403 Forbidden
- [ ] **TC-093**: Handle 404 Not Found
- [ ] **TC-094**: Handle 429 Rate Limit
- [ ] **TC-095**: Handle 500 Server Error

### 7.3 Input Validation
- [ ] **TC-096**: Handle empty message submission
- [ ] **TC-097**: Handle very long messages (>10k chars)
- [ ] **TC-098**: Handle invalid file uploads
- [ ] **TC-099**: Handle corrupted images

---

## 📋 Test Execution Checklist

### Before Testing
- [ ] Clean install of the app
- [ ] Fresh API key configured
- [ ] No existing chat history
- [ ] Stable internet connection

### During Testing
- [ ] Record any bugs or issues found
- [ ] Note response times for performance tests
- [ ] Take screenshots of UI issues
- [ ] Check console for errors

### After Testing
- [ ] Document all failed test cases
- [ ] Create GitHub issues for bugs
- [ ] Update this document with results
- [ ] Create test report summary

---

## 🐛 Bug Report Template

When you find a bug, document it like this:

```
**Test Case**: TC-XXX
**Expected**: [What should happen]
**Actual**: [What actually happened]
**Steps to Reproduce**:
1. Step 1
2. Step 2
3. Step 3
**Screenshots**: [If applicable]
**Console Errors**: [If any]
**Severity**: Critical / High / Medium / Low
```

---

## ✅ Test Results Summary

Total Test Cases: 99
- ✅ Passed: 0
- ❌ Failed: 0
- ⏭️ Skipped: 0
- ⏸️ Pending: 99

**Test Coverage**: 0%

---

## 📝 Notes

- All tests should be performed on Windows (as per project setup)
- Test with gemini-3.6-flash as the primary model
- Check DevTools console for any JavaScript errors
- Monitor network tab for API calls

---

**Created**: January 2025
**Last Updated**: January 2025
**Branch**: `feature/comprehensive-testing`
