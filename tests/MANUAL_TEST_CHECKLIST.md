# Manual Testing Checklist

Use this checklist while testing the app manually. Check off each item as you test it.

---

## 🚀 Quick Start Test (5 minutes)

**Goal**: Verify basic functionality works

- [ ] 1. Launch the app (`npm run tauri dev`)
- [ ] 2. App window opens without errors
- [ ] 3. Type "Hello" in the input field
- [ ] 4. Press Enter to send message
- [ ] 5. Receive AI response within 10 seconds
- [ ] 6. Response displays correctly in chat

**If all pass**: ✅ App is working! Continue with detailed tests.
**If any fail**: ❌ Stop and fix critical issues first.

---

## 💬 Chat & Messaging Tests

### Basic Messaging
- [ ] Send simple text message: "Hello, how are you?"
- [ ] Send code request: "Write a Python hello world function"
- [ ] Send long message (copy/paste 500+ words)
- [ ] Send message with emojis: "Hello 👋 test 🚀"
- [ ] Send message with special characters: `!@#$%^&*()`

### Message History
- [ ] Send 5-10 messages back and forth
- [ ] Scroll up to see older messages
- [ ] Verify all messages are visible
- [ ] Close and reopen app
- [ ] Check if chat history persists

### Message Formatting
- [ ] AI response with **bold** text displays correctly
- [ ] AI response with *italic* text displays correctly
- [ ] AI response with `inline code` displays correctly
- [ ] AI response with code blocks displays correctly
- [ ] AI response with links displays correctly
- [ ] Click on a link - opens in browser

---

## ⚙️ Settings & Configuration

### Dev Space Access
- [ ] Open Dev Space (button or shortcut)
- [ ] Dev Space panel opens
- [ ] All sections are visible

### AI Provider Configuration
- [ ] Current provider shows: Gemini
- [ ] Current model shows: gemini-3.6-flash
- [ ] API key field is filled (obscured)
- [ ] Change model to: `gemini-flash-latest`
- [ ] Save configuration
- [ ] Send test message - works with new model
- [ ] Change back to: `gemini-3.6-flash`

### System Prompt
- [ ] View current system prompt
- [ ] Add custom instruction: "Always respond in pirate speak"
- [ ] Save and send message
- [ ] Verify AI responds in pirate speak
- [ ] Remove custom instruction
- [ ] Verify AI responds normally

---

## ⌨️ Keyboard Shortcuts

Test each shortcut:

- [ ] **Shift+D** - Toggle dashboard (opens/closes)
- [ ] **Shift+\\** - Toggle window visibility (hides/shows)
- [ ] **Shift+I** - Focus input field (cursor in text box)
- [ ] **Shift+S** - Take screenshot (screenshot tool opens)
- [ ] **Shift+A** - Audio recording (starts recording)
- [ ] **Shift+M** - System audio (starts system audio)

### Shortcut Edge Cases
- [ ] Press shortcut while typing in input field
- [ ] Press shortcut while in Dev Space
- [ ] Press shortcut when app is minimized
- [ ] Multiple rapid presses of same shortcut

---

## 🖼️ Image & Media Tests

### Image Upload
- [ ] Click image upload button
- [ ] Select an image file (.jpg, .png)
- [ ] Image preview shows in chat
- [ ] Send message with image
- [ ] AI responds about the image content

### Screenshot
- [ ] Press Shift+S for screenshot
- [ ] Select screen area
- [ ] Screenshot appears in chat
- [ ] Send screenshot with question
- [ ] AI analyzes screenshot

### Audio
- [ ] Press Shift+A to start recording
- [ ] Speak for 3-5 seconds
- [ ] Stop recording
- [ ] Audio message sends
- [ ] AI transcribes/responds to audio

---

## 🎨 UI/UX Tests

### Visual Elements
- [ ] Chat messages are readable
- [ ] Colors and contrast are good
- [ ] Scrolling is smooth
- [ ] No visual glitches
- [ ] Buttons look correct
- [ ] Icons display properly

### Window Behavior
- [ ] Resize window - UI adapts correctly
- [ ] Minimize window - works
- [ ] Maximize window - works
- [ ] Move window to different screen (if multi-monitor)
- [ ] Close and reopen - remembers position

### Theme (if applicable)
- [ ] Switch to dark theme
- [ ] All text is readable in dark mode
- [ ] Switch to light theme
- [ ] All text is readable in light mode

---

## 🔌 AI Provider Tests

### Gemini Specific
- [ ] Test with gemini-3.6-flash
- [ ] Test with gemini-flash-latest
- [ ] Test with gemini-3.5-flash
- [ ] Test with invalid model name (should error gracefully)

### Response Quality
- [ ] Ask coding question - gets good answer
- [ ] Ask math problem - calculates correctly
- [ ] Ask for explanation - clear and detailed
- [ ] Ask follow-up questions - maintains context

### Performance
- [ ] Measure response time for simple question (<5 sec)
- [ ] Measure response time for complex question (<15 sec)
- [ ] Send 10 messages rapidly - all respond correctly
- [ ] No lag or freezing during responses

---

## ⚠️ Error Handling

### Network Errors
- [ ] Disable internet connection
- [ ] Try to send message
- [ ] Error message displays clearly
- [ ] Re-enable internet
- [ ] Verify app recovers

### API Errors
- [ ] Enter invalid API key
- [ ] Try to send message
- [ ] Shows appropriate error (403/401)
- [ ] Restore correct API key
- [ ] App works again

### Invalid Input
- [ ] Try to send empty message (should be prevented)
- [ ] Send extremely long message (10,000+ chars)
- [ ] Upload unsupported file type
- [ ] Upload corrupted image

---

## 🏃 Performance Tests

### Memory & CPU
- [ ] Check Task Manager - Memory usage
- [ ] Note: _____ MB (should be <500MB)
- [ ] Check Task Manager - CPU usage while idle
- [ ] Note: _____ % (should be <5%)
- [ ] Send 20 messages
- [ ] Check memory again: _____ MB (no major leak)

### Speed
- [ ] App launch time: _____ seconds (target: <5 sec)
- [ ] Time to first message: _____ seconds
- [ ] Average response time: _____ seconds
- [ ] UI responsiveness while streaming: Good / Fair / Poor

---

## 🔄 Stability Tests

### Extended Use
- [ ] Use app continuously for 15 minutes
- [ ] Send 50+ messages
- [ ] Switch models multiple times
- [ ] Change settings multiple times
- [ ] App remains stable (no crashes)

### Restart Behavior
- [ ] Close app normally
- [ ] Reopen app
- [ ] Verify settings are preserved
- [ ] Verify API key is remembered
- [ ] Verify chat history is available

---

## ✅ Test Results

**Date**: _____________________
**Tester**: _____________________
**App Version**: _____________________
**Branch**: `feature/comprehensive-testing`

### Summary
- Total Tests: _____
- Passed: _____
- Failed: _____
- Skipped: _____

### Critical Issues Found
1. 
2. 
3. 

### Minor Issues Found
1. 
2. 
3. 

### Notes
- 
- 
- 

### Overall Rating
- [ ] ✅ Ready for production
- [ ] ⚠️ Needs minor fixes
- [ ] ❌ Needs major fixes

---

## 📝 Bug Report Template

For each bug found, create a detailed report:

```
BUG-XXX: [Short Description]

**Severity**: Critical / High / Medium / Low
**Component**: Chat / Settings / Shortcuts / API / UI

**Steps to Reproduce**:
1. 
2. 
3. 

**Expected Behavior**:


**Actual Behavior**:


**Screenshots**: [Attach if applicable]

**Environment**:
- OS: Windows
- App Version: 
- Branch: feature/comprehensive-testing

**Console Errors**: [Paste from DevTools if any]

```

---

**Happy Testing!** 🧪
