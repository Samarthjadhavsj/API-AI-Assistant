# Hey Frank - Comprehensive Test Cases Documentation

**Application**: Hey Frank - Ultra-Minimal Stealth AI Assistant  
**Version**: 0.1.8  
**Date**: December 2024  
**Document Type**: Functional & Non-Functional Test Cases

---

## Table of Contents

1. [Introduction](#introduction)
2. [Test Environment](#test-environment)
3. [Core Functionality Test Cases](#core-functionality-test-cases)
4. [Window Management Test Cases](#window-management-test-cases)
5. [AI Provider Test Cases](#ai-provider-test-cases)
6. [Screenshot & Capture Test Cases](#screenshot--capture-test-cases)
7. [Audio & Speech-to-Text Test Cases](#audio--speech-to-text-test-cases)
8. [Stealth Mode Test Cases](#stealth-mode-test-cases)
9. [Conversation Management Test Cases](#conversation-management-test-cases)
10. [Settings & Configuration Test Cases](#settings--configuration-test-cases)
11. [Security & Privacy Test Cases](#security--privacy-test-cases)
12. [Performance Test Cases](#performance-test-cases)
13. [Cross-Platform Test Cases](#cross-platform-test-cases)
14. [Error Handling Test Cases](#error-handling-test-cases)
15. [Integration Test Cases](#integration-test-cases)

---

## Introduction

This document contains comprehensive test cases for the Hey Frank AI Assistant application. Test cases are organized by feature area and include:

- **Test Case ID**: Unique identifier
- **Test Scenario**: What is being tested
- **Pre-conditions**: Requirements before test execution
- **Test Steps**: Detailed steps to execute
- **Expected Result**: What should happen
- **Priority**: Critical/High/Medium/Low
- **Category**: Functional/Non-Functional

---

## Test Environment

### Supported Platforms
- Windows 10/11 (Primary)
- macOS 10.13+ (Secondary)
- Linux (Secondary)

### Required Dependencies
- Node.js (Latest LTS)
- Rust & Cargo
- Tauri CLI
- SQLite

### Test Data Requirements
- Valid API keys for AI providers (OpenAI, Claude, etc.)
- Test images (PNG, JPG formats)
- Test audio files
- Sample conversation data

---

## Core Functionality Test Cases

### TC-CORE-001: Application Launch
**Priority**: Critical  
**Category**: Functional

**Pre-conditions**:
- Application is installed
- No previous instance running

**Test Steps**:
1. Launch Hey Frank application
2. Verify application starts successfully
3. Check that main window is hidden by default
4. Verify system tray icon appears

**Expected Result**:
- Application launches without errors
- Main window is hidden (visible: false)
- System tray icon is visible
- No error messages displayed

---

### TC-CORE-002: First Time Setup
**Priority**: Critical  
**Category**: Functional

**Pre-conditions**:
- Fresh installation
- No existing configuration

**Test Steps**:
1. Launch application for the first time
2. Access Dev Space/Settings
3. Configure AI provider (OpenAI)
4. Enter valid API key
5. Select a model
6. Save configuration

**Expected Result**:
- Settings screen is accessible
- API key can be entered and saved securely
- Model selection works correctly
- Configuration persists after restart

---

### TC-CORE-003: Toggle Window Shortcut (Shift+\)
**Priority**: Critical  
**Category**: Functional

**Pre-conditions**:
- Application is running
- Default shortcut is set to Shift+\

**Test Steps**:
1. Press Shift+\ when window is hidden
2. Verify window appears
3. Press Shift+\ again
4. Verify window hides

**Expected Result**:
- Window shows on first press
- Window hides on second press
- Toggle is smooth without lag
- Window maintains position

---

### TC-CORE-004: Window Focus After Toggle
**Priority**: High  
**Category**: Functional

**Pre-conditions**:
- Application is running
- Window is hidden

**Test Steps**:
1. Press Shift+\ to show window
2. Verify text input field receives focus automatically
3. Type text immediately without clicking

**Expected Result**:
- Text input field is auto-focused
- User can type immediately
- Cursor is visible in input field

---

### TC-CORE-005: Close Window via X Button
**Priority**: High  
**Category**: Functional

**Pre-conditions**:
- Window is visible

**Test Steps**:
1. Click the X button in window header
2. Verify window hides (not exits)
3. Press Shift+\ to show window again

**Expected Result**:
- Window hides but application continues running
- No application exit
- Window can be shown again with shortcut

---

### TC-CORE-006: Exit Application
**Priority**: Critical  
**Category**: Functional

**Pre-conditions**:
- Application is running

**Test Steps**:
1. Right-click system tray icon
2. Select "Quit" or "Exit"
3. Verify application closes completely

**Expected Result**:
- Application terminates
- All windows close
- Process ends in Task Manager
- No orphan processes remain

---

### TC-CORE-007: Auto-start on System Boot
**Priority**: Medium  
**Category**: Functional

**Pre-conditions**:
- Auto-start is enabled in settings

**Test Steps**:
1. Enable auto-start in settings
2. Restart computer
3. Check if application starts automatically

**Expected Result**:
- Application starts on system boot
- Runs in hidden state
- System tray icon appears

---

### TC-CORE-008: Database Initialization
**Priority**: Critical  
**Category**: Functional

**Pre-conditions**:
- Fresh installation

**Test Steps**:
1. Launch application
2. Check for SQLite database creation (pluely.db)
3. Verify database schema is created

**Expected Result**:
- Database file is created
- All required tables exist
- No database errors in logs

---

### TC-CORE-009: Migration from localStorage to SQLite
**Priority**: High  
**Category**: Functional

**Pre-conditions**:
- Old version with localStorage data exists

**Test Steps**:
1. Launch new version
2. Check migration process in console
3. Verify old conversations are migrated
4. Check localStorage is cleared

**Expected Result**:
- Migration completes successfully
- All conversations are preserved
- No data loss
- Migration flag is set

---

### TC-CORE-010: Application Update Check
**Priority**: Medium  
**Category**: Functional

**Pre-conditions**:
- Internet connection available
- Update server is reachable

**Test Steps**:
1. Launch application
2. Check for updates (manual or auto)
3. If update available, verify notification

**Expected Result**:
- Update check completes
- Notification shown if update exists
- No errors if no internet connection

---

## Window Management Test Cases

### TC-WIN-001: Window Always on Top
**Priority**: Critical  
**Category**: Functional

**Pre-conditions**:
- Window is visible
- Always on top is enabled (default)

**Test Steps**:
1. Show the main window
2. Click on another application window
3. Verify Hey Frank window stays on top

**Expected Result**:
- Hey Frank remains visible above other windows
- Window doesn't get hidden by other applications
- Z-order is maintained

---

### TC-WIN-002: Window Transparency
**Priority**: High  
**Category**: Visual

**Pre-conditions**:
- Transparency enabled in config

**Test Steps**:
1. Show main window
2. Position window over different backgrounds
3. Verify transparency effect

**Expected Result**:
- Window background is transparent
- Content is clearly visible
- No rendering artifacts

---

### TC-WIN-003: Window Resizing (Height Adjustment)
**Priority**: Medium  
**Category**: Functional

**Pre-conditions**:
- Window is visible

**Test Steps**:
1. Open window
2. Type multi-line text in input
3. Verify window height adjusts automatically

**Expected Result**:
- Window height increases with content
- Maximum height is respected
- Smooth resize animation

---

### TC-WIN-004: Window Positioning Persistence
**Priority**: Medium  
**Category**: Functional

**Pre-conditions**:
- Window has been moved to custom position

**Test Steps**:
1. Show window and move to specific position
2. Hide window
3. Show window again
4. Verify position is maintained

**Expected Result**:
- Window appears at last position
- Position persists across sessions
- No position reset on restart

---

### TC-WIN-005: Move Window with Keyboard
**Priority**: Low  
**Category**: Functional

**Pre-conditions**:
- Move window shortcut is configured (e.g., Ctrl+Alt+Arrow)

**Test Steps**:
1. Show window
2. Hold Ctrl+Alt and press arrow keys
3. Verify window moves in the pressed direction

**Expected Result**:
- Window moves smoothly
- Movement is continuous while key is held
- Stops when key is released

---

### TC-WIN-006: Window Skip Taskbar
**Priority**: Critical  
**Category**: Stealth

**Pre-conditions**:
- skipTaskbar is true in config

**Test Steps**:
1. Launch application
2. Show main window
3. Check Windows taskbar

**Expected Result**:
- No taskbar icon visible when window is shown
- Application only appears in system tray
- Alt+Tab doesn't show the window

---

### TC-WIN-007: Window Content Protection
**Priority**: Critical  
**Category**: Security/Stealth

**Pre-conditions**:
- contentProtected is true in config

**Test Steps**:
1. Show main window with content
2. Attempt screenshot using Snipping Tool
3. Attempt screen recording using OBS

**Expected Result**:
- Window appears black/hidden in screenshots
- Screen recordings don't capture window content
- OS-level protection is active

---

### TC-WIN-008: Window on Multiple Monitors
**Priority**: Medium  
**Category**: Functional

**Pre-conditions**:
- Multiple monitors connected

**Test Steps**:
1. Move window to secondary monitor
2. Hide and show window
3. Disconnect secondary monitor
4. Show window again

**Expected Result**:
- Window works on all monitors
- Gracefully handles monitor disconnect
- Moves to primary monitor if last position unavailable

---

### TC-WIN-009: Window Visible on All Workspaces
**Priority**: Low  
**Category**: Functional

**Pre-conditions**:
- OS supports virtual desktops/workspaces

**Test Steps**:
1. Show window on workspace 1
2. Switch to workspace 2
3. Verify window is still visible

**Expected Result**:
- Window appears on all workspaces
- Follows user across virtual desktops
- Setting visibleOnAllWorkspaces works

---

### TC-WIN-010: Window Focus Loss Recovery
**Priority**: High  
**Category**: Functional

**Pre-conditions**:
- Window is visible

**Test Steps**:
1. Show window
2. Click on another application
3. Verify Hey Frank stays on top but loses focus
4. Click back on Hey Frank

**Expected Result**:
- Window stays visible when losing focus
- Re-gaining focus works correctly
- HWND_TOPMOST is maintained on Windows

---

## AI Provider Test Cases

### TC-AI-001: OpenAI Provider Configuration
**Priority**: Critical  
**Category**: Functional

**Pre-conditions**:
- Valid OpenAI API key available

**Test Steps**:
1. Open Dev Space settings
2. Select OpenAI as provider
3. Enter API key
4. Select model (e.g., gpt-4)
5. Save configuration
6. Send test message

**Expected Result**:
- Configuration saves successfully
- API key is stored securely
- Test message receives response
- No API errors

---

### TC-AI-002: Claude (Anthropic) Provider Configuration
**Priority**: Critical  
**Category**: Functional

**Pre-conditions**:
- Valid Anthropic API key available

**Test Steps**:
1. Select Claude as provider
2. Enter API key
3. Select model (e.g., claude-3-opus)
4. Test with message

**Expected Result**:
- Provider works correctly
- Streaming responses work
- Proper header handling (anthropic-version, etc.)

---

### TC-AI-003: Multiple Provider Switching
**Priority**: High  
**Category**: Functional

**Pre-conditions**:
- Multiple providers configured

**Test Steps**:
1. Configure OpenAI and Claude
2. Send message with OpenAI
3. Switch to Claude
4. Send another message
5. Switch back to OpenAI

**Expected Result**:
- Smooth switching between providers
- No configuration loss
- Each provider works independently

---

### TC-AI-004: Custom Provider (cURL) Configuration
**Priority**: High  
**Category**: Functional

**Pre-conditions**:
- Understanding of cURL format

**Test Steps**:
1. Add custom provider
2. Enter cURL template with placeholders
3. Configure API key and model
4. Test with message

**Expected Result**:
- Custom provider can be added
- cURL template is parsed correctly
- API calls work with custom endpoints

---

### TC-AI-005: Ollama Local Provider
**Priority**: High  
**Category**: Functional

**Pre-conditions**:
- Ollama installed locally
- Model downloaded (e.g., llama2)

**Test Steps**:
1. Configure Ollama provider
2. Set endpoint to localhost:11434
3. Select local model
4. Send test message

**Expected Result**:
- Connects to local Ollama instance
- No API key required
- Completely offline operation
- Responses work correctly

---

### TC-AI-006: Streaming Response
**Priority**: Critical  
**Category**: Functional

**Pre-conditions**:
- Provider supports streaming (OpenAI, Claude, etc.)

**Test Steps**:
1. Send a message that generates long response
2. Observe response as it streams in
3. Verify real-time display

**Expected Result**:
- Response appears word-by-word
- No delay until complete response
- Smooth streaming without stuttering
- Auto-scroll follows content

---

### TC-AI-007: Non-Streaming Provider (Gemini)
**Priority**: Medium  
**Category**: Functional

**Pre-conditions**:
- Gemini provider configured

**Test Steps**:
1. Configure Google Gemini
2. Send message
3. Verify response handling

**Expected Result**:
- Loading indicator shows
- Complete response appears at once
- No streaming chunks
- Response path parsing works

---

### TC-AI-008: API Key Validation
**Priority**: High  
**Category**: Functional

**Pre-conditions**:
- Invalid API key

**Test Steps**:
1. Enter invalid API key
2. Attempt to send message
3. Observe error handling

**Expected Result**:
- Clear error message (401/403)
- User prompted to check API key
- No application crash

---

### TC-AI-009: API Rate Limiting
**Priority**: Medium  
**Category**: Functional

**Pre-conditions**:
- API key with rate limits

**Test Steps**:
1. Send multiple messages rapidly
2. Trigger rate limit
3. Observe error handling

**Expected Result**:
- Rate limit error is caught
- Clear error message to user
- Application remains functional

---

### TC-AI-010: Model Selection Persistence
**Priority**: Medium  
**Category**: Functional

**Pre-conditions**:
- Provider configured with specific model

**Test Steps**:
1. Select specific model (e.g., gpt-4-turbo)
2. Restart application
3. Verify model selection persists

**Expected Result**:
- Model selection is saved
- Persists across restarts
- Used in API calls correctly

---

### TC-AI-011: System Prompt Configuration
**Priority**: High  
**Category**: Functional

**Pre-conditions**:
- AI provider configured

**Test Steps**:
1. Set custom system prompt
2. Send user message
3. Verify AI follows system prompt
4. Clear system prompt
5. Test default behavior

**Expected Result**:
- System prompt is included in API calls
- AI behavior changes accordingly
- Can be cleared/modified
- Persists across sessions

---

### TC-AI-012: All Supported Providers
**Priority**: High  
**Category**: Functional

**Pre-conditions**:
- API keys for all providers

**Test Steps**:
Test each provider individually:
1. OpenAI
2. Claude (Anthropic)
3. Grok (X.AI)
4. Google Gemini
5. Mistral
6. Cohere
7. Groq
8. Perplexity
9. OpenRouter
10. Ollama
11. DeepSeek

**Expected Result**:
- All providers work correctly
- Each has proper API format
- Response parsing works
- No provider-specific errors

---

## Screenshot & Capture Test Cases

### TC-SCREEN-001: Full Screen Capture
**Priority**: High  
**Category**: Functional

**Pre-conditions**:
- Screenshot feature enabled
- Screen capture permissions granted (macOS)

**Test Steps**:
1. Configure screenshot mode to "Auto" with full screen
2. Trigger screenshot
3. Verify image is captured
4. Check if attached to message

**Expected Result**:
- Full screen is captured
- Image is in base64 format
- Attached to conversation
- Quality is acceptable

---

### TC-SCREEN-002: Area Selection Capture
**Priority**: High  
**Category**: Functional

**Pre-conditions**:
- Screenshot in selection mode

**Test Steps**:
1. Trigger screenshot
2. Overlay window appears
3. Click and drag to select area
4. Release to capture
5. Verify selected area is captured

**Expected Result**:
- Overlay window shows
- Selection rectangle is visible
- Only selected area is captured
- Overlay closes after capture

---

### TC-SCREEN-003: Screenshot Auto Mode with Prompt
**Priority**: High  
**Category**: Functional

**Pre-conditions**:
- Auto mode enabled
- Auto prompt configured (e.g., "Explain this image")

**Test Steps**:
1. Configure auto prompt
2. Take screenshot
3. Verify message is sent automatically

**Expected Result**:
- Screenshot is captured
- Prompt is added automatically
- Message is sent to AI
- Response is received

---

### TC-SCREEN-004: Screenshot Manual Mode
**Priority**: High  
**Category**: Functional

**Pre-conditions**:
- Manual mode enabled

**Test Steps**:
1. Take screenshot
2. Verify image is attached but not sent
3. Type additional message
4. Send message manually

**Expected Result**:
- Screenshot attaches to input
- Message is not auto-sent
- User can add text
- Manual send works with image

---

### TC-SCREEN-005: Multiple Screenshots
**Priority**: Medium  
**Category**: Functional

**Pre-conditions**:
- MAX_FILES limit not reached

**Test Steps**:
1. Take first screenshot (attaches)
2. Take second screenshot
3. Verify both are attached
4. Send message with both images

**Expected Result**:
- Multiple images can be attached
- Respects MAX_FILES limit
- All images sent to AI
- AI processes multiple images

---

### TC-SCREEN-006: Screenshot Permission Denied (macOS)
**Priority**: High  
**Category**: Error Handling

**Pre-conditions**:
- macOS system
- Screen recording permission not granted

**Test Steps**:
1. Attempt screenshot without permission
2. Observe error handling
3. Verify user guidance

**Expected Result**:
- Clear error message shown
- Instructions to grant permission
- Link to System Settings
- Application doesn't crash

---

### TC-SCREEN-007: Cancel Screenshot Selection
**Priority**: Medium  
**Category**: Functional

**Pre-conditions**:
- In screenshot selection mode

**Test Steps**:
1. Trigger screenshot
2. Overlay appears
3. Press Escape or close overlay
4. Verify capture is cancelled

**Expected Result**:
- Overlay closes
- No screenshot taken
- No error shown
- Can retry screenshot

---

### TC-SCREEN-008: Screenshot Quality
**Priority**: Medium  
**Category**: Quality

**Pre-conditions**:
- High resolution display

**Test Steps**:
1. Capture screenshot with text and images
2. Zoom in to check quality
3. Verify readability

**Expected Result**:
- Text is readable
- Colors are accurate
- No significant compression artifacts
- Appropriate file size

---

### TC-SCREEN-009: Screenshot on Multiple Monitors
**Priority**: Medium  
**Category**: Functional

**Pre-conditions**:
- Multiple monitors setup

**Test Steps**:
1. Take screenshot on primary monitor
2. Take screenshot on secondary monitor
3. Verify both work correctly

**Expected Result**:
- Captures correct monitor
- Selection mode works on all monitors
- No position offset issues

---

### TC-SCREEN-010: Close Overlay Window
**Priority**: Medium  
**Category**: Functional

**Pre-conditions**:
- Overlay window is open

**Test Steps**:
1. Open screenshot overlay
2. Click close button or press Escape
3. Verify overlay closes cleanly

**Expected Result**:
- Overlay window closes immediately
- No memory leaks
- Event listeners cleaned up
- Can open overlay again

---

## Audio & Speech-to-Text Test Cases

### TC-AUDIO-001: Microphone Voice Input
**Priority**: High  
**Category**: Functional

**Pre-conditions**:
- Microphone connected and working
- VAD (Voice Activity Detection) enabled

**Test Steps**:
1. Click microphone button
2. Speak clearly into microphone
3. Stop recording
4. Verify speech is transcribed

**Expected Result**:
- Recording indicator shows
- Audio is captured clearly
- Transcription appears in input field
- Accuracy is acceptable

---

### TC-AUDIO-002: VAD (Voice Activity Detection)
**Priority**: High  
**Category**: Functional

**Pre-conditions**:
- VAD enabled
- Microphone active

**Test Steps**:
1. Start voice input
2. Speak with natural pauses
3. Verify VAD detects speech start/end
4. Stop when silence detected

**Expected Result**:
- VAD detects when user speaks
- Ignores background noise
- Stops on silence automatically
- Proper silence threshold

---

### TC-AUDIO-003: System Audio Capture
**Priority**: High  
**Category**: Functional

**Pre-conditions**:
- System audio permission granted
- Audio output device selected

**Test Steps**:
1. Enable system audio capture
2. Play audio/video on computer
3. Verify system audio is captured
4. Stop capture

**Expected Result**:
- System audio is captured
- No feedback loop
- Audio quality is good
- Can be transcribed

---

### TC-AUDIO-004: Gemini Transcription
**Priority**: Critical  
**Category**: Functional

**Pre-conditions**:
- Gemini API key configured
- Valid audio file

**Test Steps**:
1. Record voice input
2. Send to Gemini transcription API
3. Verify transcription result
4. Check accuracy

**Expected Result**:
- Audio is transcribed correctly
- API call succeeds
- Transcription appears in input
- Reasonable accuracy

---

### TC-AUDIO-005: Audio Device Selection
**Priority**: Medium  
**Category**: Functional

**Pre-conditions**:
- Multiple audio devices available

**Test Steps**:
1. Open audio settings
2. View available input devices
3. Select different microphone
4. Test recording with selected device

**Expected Result**:
- All devices are listed
- Selection persists
- Selected device is used
- Switch works correctly

---

### TC-AUDIO-006: Audio Permission Request (macOS)
**Priority**: High  
**Category**: Functional

**Pre-conditions**:
- macOS system
- Audio permission not granted

**Test Steps**:
1. Attempt to use microphone
2. Verify permission request appears
3. Grant permission
4. Retry audio input

**Expected Result**:
- Permission dialog shows
- Clear explanation provided
- Works after permission granted
- No crash on denial

---

### TC-AUDIO-007: Continuous Recording Mode
**Priority**: Medium  
**Category**: Functional

**Pre-conditions**:
- Continuous mode enabled

**Test Steps**:
1. Start continuous recording
2. Speak multiple sentences
3. Verify continuous capture
4. Stop manually

**Expected Result**:
- Records until manually stopped
- No automatic cutoff
- All audio captured
- Can be stopped anytime

---

### TC-AUDIO-008: Background Noise Filtering
**Priority**: Medium  
**Category**: Quality

**Pre-conditions**:
- Background noise present
- VAD configured

**Test Steps**:
1. Start recording in noisy environment
2. Speak clearly
3. Verify VAD filters noise
4. Check transcription quality

**Expected Result**:
- VAD ignores background noise
- Only captures speech
- Transcription not affected by noise
- Adjustable sensitivity

---

### TC-AUDIO-009: Audio Sample Rate Configuration
**Priority**: Low  
**Category**: Functional

**Pre-conditions**:
- Audio settings accessible

**Test Steps**:
1. Check current sample rate
2. Adjust if configurable
3. Test recording quality

**Expected Result**:
- Sample rate is appropriate (16kHz+)
- Quality is sufficient for transcription
- No audio distortion

---

### TC-AUDIO-010: Stop Audio Capture
**Priority**: High  
**Category**: Functional

**Pre-conditions**:
- Audio capture in progress

**Test Steps**:
1. Start audio capture
2. Click stop button
3. Verify capture stops immediately
4. Check resources are released

**Expected Result**:
- Capture stops instantly
- Audio stream is closed
- Microphone indicator turns off
- No lingering processes

---

### TC-AUDIO-011: VAD Configuration
**Priority**: Medium  
**Category**: Functional

**Pre-conditions**:
- VAD settings accessible

**Test Steps**:
1. Access VAD configuration
2. Adjust sensitivity threshold
3. Test with different values
4. Save configuration

**Expected Result**:
- VAD settings are adjustable
- Changes take effect immediately
- Configuration persists
- Optimal for user environment

---

### TC-AUDIO-012: Audio Transcription Error Handling
**Priority**: High  
**Category**: Error Handling

**Pre-conditions**:
- Invalid or unclear audio

**Test Steps**:
1. Record very quiet or garbled audio
2. Attempt transcription
3. Observe error handling

**Expected Result**:
- Graceful error message
- User can retry
- No application crash
- Helpful guidance provided

---

## Stealth Mode Test Cases

### TC-STEALTH-001: Screen Recording Protection
**Priority**: Critical  
**Category**: Stealth/Security

**Pre-conditions**:
- contentProtected: true in config
- OBS Studio or similar installed

**Test Steps**:
1. Start OBS screen recording
2. Show Hey Frank window with content
3. Record for 30 seconds
4. Stop and review recording

**Expected Result**:
- Hey Frank window appears black/blank in recording
- Content is not visible
- Other applications are recorded normally
- OS-level protection active

---

### TC-STEALTH-002: Screenshot Protection
**Priority**: Critical  
**Category**: Stealth/Security

**Pre-conditions**:
- contentProtected: true

**Test Steps**:
1. Show Hey Frank with conversation
2. Use Windows Snipping Tool
3. Capture area including Hey Frank
4. Verify screenshot result

**Expected Result**:
- Hey Frank area is black/blank
- Content is not captured
- Other screen areas captured normally
- Protection works system-wide

---

### TC-STEALTH-003: Zoom/Teams Screen Share
**Priority**: Critical  
**Category**: Stealth

**Pre-conditions**:
- Zoom or Teams installed
- Screen share active

**Test Steps**:
1. Start Zoom meeting
2. Share screen
3. Show Hey Frank window
4. Verify what participants see

**Expected Result**:
- Hey Frank not visible to participants
- Screen share continues normally
- No visual glitches
- Protection works in real-time

---

### TC-STEALTH-004: No Taskbar Icon
**Priority**: Critical  
**Category**: Stealth

**Pre-conditions**:
- skipTaskbar: true

**Test Steps**:
1. Launch application
2. Show main window
3. Check Windows taskbar
4. Check Alt+Tab switcher

**Expected Result**:
- No taskbar icon appears
- Not visible in Alt+Tab
- Only system tray icon visible
- Hidden from task switcher

---

### TC-STEALTH-005: Process Name in Task Manager
**Priority**: High  
**Category**: Stealth Limitation

**Pre-conditions**:
- Application running

**Test Steps**:
1. Open Task Manager
2. Search for "hey-frank" or "Hey Frank"
3. Verify process is visible

**Expected Result**:
- Process is visible (expected limitation)
- Shows actual process name
- Memory/CPU usage visible
- User is aware of this limitation

---

### TC-STEALTH-006: Network Traffic Inspection
**Priority**: High  
**Category**: Stealth Limitation

**Pre-conditions**:
- AI provider configured
- Network monitoring tool active

**Test Steps**:
1. Use Wireshark or similar
2. Send message to AI
3. Inspect network traffic
4. Verify API calls are visible

**Expected Result**:
- API calls are visible (expected limitation)
- Endpoint and requests logged
- Ollama offline mode bypasses this
- User is aware of limitation

---

### TC-STEALTH-007: Ollama Offline Mode
**Priority**: High  
**Category**: Stealth/Privacy

**Pre-conditions**:
- Ollama installed locally
- No internet connection (optional)

**Test Steps**:
1. Configure Ollama provider
2. Disconnect from internet
3. Send messages to AI
4. Verify offline operation

**Expected Result**:
- Fully functional offline
- No network requests
- Complete stealth
- No detection possible via network

---

### TC-STEALTH-008: Rename Executable
**Priority**: Medium  
**Category**: Stealth

**Pre-conditions**:
- Application binary

**Test Steps**:
1. Rename hey-frank.exe to innocuous name
2. Launch renamed executable
3. Verify functionality

**Expected Result**:
- Application works with renamed exe
- Process shows new name
- All features functional
- Helps avoid process detection

---

### TC-STEALTH-009: Transparent Window Visibility
**Priority**: High  
**Category**: Stealth

**Pre-conditions**:
- Transparent: true
- Window visible

**Test Steps**:
1. Show window
2. Position over various backgrounds
3. Verify visibility vs stealth balance

**Expected Result**:
- Window is usable but subtle
- Background shows through
- Content is readable
- Not immediately obvious

---

### TC-STEALTH-010: System Tray Icon Visibility
**Priority**: Medium  
**Category**: Stealth

**Pre-conditions**:
- Application running

**Test Steps**:
1. Check system tray
2. Verify icon presence
3. Test if icon can be hidden (optional setting)

**Expected Result**:
- Icon is present by default
- Can be configured to hide
- Right-click menu works
- Provides access to app

---

### TC-STEALTH-011: Proctoring Software Detection
**Priority**: High  
**Category**: Stealth Limitation

**Pre-conditions**:
- Proctoring software (Proctorio, ProctorU) active (if available)

**Test Steps**:
1. Run with proctoring software
2. Attempt to use Hey Frank
3. Check if detected

**Expected Result**:
- May be detected by process monitoring
- User is warned in documentation
- Not recommended for proctored exams
- Clear disclaimer provided

---

### TC-STEALTH-012: Focus Stealing Prevention
**Priority**: High  
**Category**: Stealth

**Pre-conditions**:
- Window shown during meeting/presentation

**Test Steps**:
1. Open PowerPoint presentation
2. Toggle Hey Frank window
3. Verify no focus stealing
4. Check presentation continues

**Expected Result**:
- Toggle doesn't steal focus from other apps
- Presentation/meeting not interrupted
- Smooth show/hide
- No visual disruption

---

## Conversation Management Test Cases

### TC-CONV-001: Start New Conversation
**Priority**: Critical  
**Category**: Functional

**Pre-conditions**:
- Application running
- AI provider configured

**Test Steps**:
1. Click "New Conversation" button
2. Verify fresh conversation starts
3. Send first message
4. Verify conversation is created

**Expected Result**:
- New conversation starts
- No previous messages shown
- Conversation gets unique ID
- Saved to database

---

### TC-CONV-002: Send Message
**Priority**: Critical  
**Category**: Functional

**Pre-conditions**:
- Conversation active

**Test Steps**:
1. Type message in input field
2. Press Enter or click Send
3. Verify message appears
4. Wait for AI response

**Expected Result**:
- User message displays immediately
- Loading indicator shows
- AI response streams in
- Both messages saved

---

### TC-CONV-003: Multi-line Message Input
**Priority**: Medium  
**Category**: Functional

**Pre-conditions**:
- Input field focused

**Test Steps**:
1. Type message
2. Press Shift+Enter for new line
3. Add multiple lines
4. Press Enter to send

**Expected Result**:
- Shift+Enter creates new line
- Enter sends message
- Multi-line formatting preserved
- Display is correct

---

### TC-CONV-004: View Conversation History
**Priority**: High  
**Category**: Functional

**Pre-conditions**:
- Multiple conversations saved

**Test Steps**:
1. Open conversation list/sidebar
2. Verify all conversations listed
3. Check timestamps and titles
4. Verify sorting (newest first)

**Expected Result**:
- All conversations shown
- Correct titles displayed
- Proper chronological order
- Timestamps are accurate

---

### TC-CONV-005: Load Previous Conversation
**Priority**: High  
**Category**: Functional

**Pre-conditions**:
- Existing conversations in database

**Test Steps**:
1. Open conversation list
2. Click on previous conversation
3. Verify messages load correctly
4. Scroll through history

**Expected Result**:
- Conversation loads from database
- All messages appear
- Scroll position maintained
- Can continue conversation

---

### TC-CONV-006: Auto-Generate Conversation Title
**Priority**: Medium  
**Category**: Functional

**Pre-conditions**:
- New conversation

**Test Steps**:
1. Start new conversation
2. Send first message
3. Verify title is generated from message
4. Check title in conversation list

**Expected Result**:
- Title generated from first message
- Reasonable length (truncated if needed)
- Descriptive and relevant
- Displayed in list

---

### TC-CONV-007: Edit Conversation Title
**Priority**: Low  
**Category**: Functional

**Pre-conditions**:
- Existing conversation

**Test Steps**:
1. Select conversation
2. Click to edit title
3. Enter new title
4. Save changes

**Expected Result**:
- Title can be edited
- Changes persist
- Updated in database
- Shown in list immediately

---

### TC-CONV-008: Delete Conversation
**Priority**: High  
**Category**: Functional

**Pre-conditions**:
- Conversation exists

**Test Steps**:
1. Right-click or select conversation
2. Choose "Delete" option
3. Confirm deletion
4. Verify conversation removed

**Expected Result**:
- Confirmation dialog appears
- Conversation deleted from database
- Removed from list
- Cannot be recovered (or undo option)

---

### TC-CONV-009: Search Conversations
**Priority**: Medium  
**Category**: Functional

**Pre-conditions**:
- Multiple conversations exist

**Test Steps**:
1. Open conversation list
2. Use search/filter function
3. Enter search term
4. Verify filtered results

**Expected Result**:
- Search works by title and content
- Results update in real-time
- Relevant conversations shown
- Can clear search

---

### TC-CONV-010: Conversation Persistence
**Priority**: Critical  
**Category**: Functional

**Pre-conditions**:
- Active conversation with messages

**Test Steps**:
1. Send several messages
2. Close application
3. Restart application
4. Open same conversation

**Expected Result**:
- All messages preserved
- Conversation state maintained
- No data loss
- SQLite database intact

---

### TC-CONV-011: Continue Existing Conversation
**Priority**: High  
**Category**: Functional

**Pre-conditions**:
- Loaded previous conversation

**Test Steps**:
1. Open existing conversation
2. Send new message
3. Verify context is maintained
4. Check AI remembers previous messages

**Expected Result**:
- AI has full context
- New messages append to existing
- Conversation flows naturally
- History is considered

---

### TC-CONV-012: Export Conversation
**Priority**: Low  
**Category**: Functional

**Pre-conditions**:
- Conversation with messages (if feature exists)

**Test Steps**:
1. Select conversation
2. Choose export option
3. Select format (TXT, JSON, MD)
4. Save file

**Expected Result**:
- Conversation exports successfully
- All messages included
- Formatting preserved
- File is readable

---

### TC-CONV-013: Message Timestamps
**Priority**: Low  
**Category**: Functional

**Pre-conditions**:
- Messages in conversation

**Test Steps**:
1. Send multiple messages
2. Verify timestamps on each
3. Check time format
4. Verify accuracy

**Expected Result**:
- Each message has timestamp
- Format is readable (e.g., "2 minutes ago")
- Chronologically correct
- Updates appropriately

---

### TC-CONV-014: Scroll to Latest Message
**Priority**: Medium  
**Category**: UX

**Pre-conditions**:
- Long conversation

**Test Steps**:
1. Open conversation with many messages
2. Scroll to top
3. Send new message
4. Verify auto-scroll to bottom

**Expected Result**:
- Auto-scrolls to new message
- Smooth animation
- Shows latest AI response
- User can disable auto-scroll if desired

---

### TC-CONV-015: Cancel AI Response
**Priority**: High  
**Category**: Functional

**Pre-conditions**:
- AI response streaming

**Test Steps**:
1. Send message that generates long response
2. Click "Stop" or "Cancel" button
3. Verify response stops

**Expected Result**:
- Streaming stops immediately
- Partial response is shown
- Can send new message
- No errors occur

---

## Settings & Configuration Test Cases

### TC-SET-001: Access Settings/Dev Space
**Priority**: High  
**Category**: Functional

**Pre-conditions**:
- Application running

**Test Steps**:
1. Click settings icon or menu
2. Verify settings panel opens
3. Navigate through tabs/sections

**Expected Result**:
- Settings accessible
- All sections visible
- UI is responsive
- Can navigate easily

---

### TC-SET-002: Configure Keyboard Shortcuts
**Priority**: High  
**Category**: Functional

**Pre-conditions**:
- Settings open

**Test Steps**:
1. Navigate to shortcuts section
2. View current shortcuts
3. Click to edit shortcut
4. Press new key combination
5. Save changes

**Expected Result**:
- Can view all shortcuts
- Edit mode works
- New shortcut is registered
- Conflicts are detected

---

### TC-SET-003: Shortcut Conflict Detection
**Priority**: Medium  
**Category**: Functional

**Pre-conditions**:
- Editing shortcut

**Test Steps**:
1. Attempt to set shortcut already in use
2. Verify conflict warning
3. Choose different shortcut

**Expected Result**:
- Conflict is detected
- Warning message shown
- Cannot save conflicting shortcut
- Suggestions provided (optional)

---

### TC-SET-004: Invalid Shortcut Key
**Priority**: Medium  
**Category**: Validation

**Pre-conditions**:
- Editing shortcut

**Test Steps**:
1. Try to set invalid key combination
2. Verify validation
3. Check error message

**Expected Result**:
- Invalid keys rejected
- Clear error message
- Validation prevents registration
- User can retry

---

### TC-SET-005: Disable Shortcut
**Priority**: Medium  
**Category**: Functional

**Pre-conditions**:
- Shortcut exists

**Test Steps**:
1. Toggle shortcut to disabled
2. Save settings
3. Attempt to use disabled shortcut

**Expected Result**:
- Shortcut can be disabled
- Disabled shortcut doesn't trigger
- Can be re-enabled
- Status persists

---

### TC-SET-006: Always On Top Setting
**Priority**: High  
**Category**: Functional

**Pre-conditions**:
- Settings accessible

**Test Steps**:
1. Toggle "Always On Top" setting
2. Apply changes
3. Test window behavior with other apps

**Expected Result**:
- Setting toggles correctly
- Takes effect immediately
- Persists across sessions
- Window behavior changes accordingly

---

### TC-SET-007: Auto-Start Setting
**Priority**: Medium  
**Category**: Functional

**Pre-conditions**:
- Settings open

**Test Steps**:
1. Enable auto-start on boot
2. Restart computer
3. Verify application starts
4. Disable and test again

**Expected Result**:
- Auto-start can be enabled
- Works on system boot
- Can be disabled
- Changes persist

---

### TC-SET-008: Theme/Appearance Settings
**Priority**: Low  
**Category**: UI/UX

**Pre-conditions**:
- Theme settings available

**Test Steps**:
1. Switch between light/dark themes
2. Adjust transparency
3. Change window size
4. Save preferences

**Expected Result**:
- Theme changes apply immediately
- All UI elements update
- Settings persist
- No visual glitches

---

### TC-SET-009: Reset to Default Settings
**Priority**: Medium  
**Category**: Functional

**Pre-conditions**:
- Custom settings applied

**Test Steps**:
1. Access "Reset to Defaults" option
2. Confirm reset
3. Verify all settings revert

**Expected Result**:
- Confirmation dialog appears
- All settings reset to defaults
- Application remains functional
- Can reconfigure

---

### TC-SET-010: Export/Import Settings
**Priority**: Low  
**Category**: Functional

**Pre-conditions**:
- Settings configured (if feature exists)

**Test Steps**:
1. Export current settings to file
2. Change some settings
3. Import previous settings file
4. Verify restoration

**Expected Result**:
- Settings export successfully
- Import restores configuration
- No data corruption
- Useful for backup/transfer

---

### TC-SET-011: Settings Validation
**Priority**: High  
**Category**: Validation

**Pre-conditions**:
- Settings form open

**Test Steps**:
1. Enter invalid values (empty API key, etc.)
2. Attempt to save
3. Verify validation errors

**Expected Result**:
- Invalid inputs are caught
- Clear error messages
- Cannot save invalid config
- Field-specific validation

---

### TC-SET-012: Settings Persistence
**Priority**: Critical  
**Category**: Functional

**Pre-conditions**:
- Settings configured

**Test Steps**:
1. Configure various settings
2. Close application
3. Restart application
4. Verify all settings preserved

**Expected Result**:
- All settings persist
- Loaded on startup
- No reset to defaults
- Database/storage works

---

### TC-SET-013: API Key Security
**Priority**: Critical  
**Category**: Security

**Pre-conditions**:
- API key entered

**Test Steps**:
1. Enter API key
2. Save settings
3. Check storage (keychain/encrypted)
4. Verify key is not plaintext

**Expected Result**:
- API key stored securely
- Not visible in plaintext files
- Uses keychain/secure storage
- Encrypted at rest

---

### TC-SET-014: Screenshot Configuration
**Priority**: High  
**Category**: Functional

**Pre-conditions**:
- Screenshot settings accessible

**Test Steps**:
1. Toggle screenshot mode (auto/manual/selection)
2. Set auto prompt
3. Save configuration
4. Test screenshot with settings

**Expected Result**:
- All modes configurable
- Auto prompt is saved
- Settings affect behavior
- Persists across sessions

---

### TC-SET-015: Audio Device Configuration
**Priority**: Medium  
**Category**: Functional

**Pre-conditions**:
- Audio settings accessible

**Test Steps**:
1. View available audio devices
2. Select microphone
3. Select speaker (if applicable)
4. Save and test

**Expected Result**:
- All devices listed
- Selection works
- Persists across sessions
- Selected device is used

---

## Security & Privacy Test Cases

### TC-SEC-001: API Key Storage Security
**Priority**: Critical  
**Category**: Security

**Pre-conditions**:
- API key configured

**Test Steps**:
1. Configure API key
2. Check file system for plaintext storage
3. Inspect database
4. Verify encryption/keychain usage

**Expected Result**:
- API key not in plaintext
- Uses system keychain (macOS) or credential manager (Windows)
- Database doesn't contain raw keys
- Proper encryption applied

---

### TC-SEC-002: Local Data Storage Only
**Priority**: Critical  
**Category**: Privacy

**Pre-conditions**:
- Application running
- Network monitoring active

**Test Steps**:
1. Use application normally
2. Monitor network traffic
3. Verify no telemetry or analytics
4. Check for unexpected connections

**Expected Result**:
- Only AI API calls made
- No telemetry endpoints
- No analytics tracking
- Zero data sent to app servers

---

### TC-SEC-003: Conversation Data Privacy
**Priority**: Critical  
**Category**: Privacy

**Pre-conditions**:
- Conversations saved

**Test Steps**:
1. Locate SQLite database file
2. Verify local storage only
3. Check for encryption (if applicable)
4. Confirm no cloud sync

**Expected Result**:
- Data stored locally only
- No cloud synchronization
- Database is on user's machine
- User has full control

---

### TC-SEC-004: HTTPS for API Calls
**Priority**: High  
**Category**: Security

**Pre-conditions**:
- AI provider configured

**Test Steps**:
1. Monitor network traffic with Wireshark
2. Send message to AI
3. Verify HTTPS is used
4. Check for certificate validation

**Expected Result**:
- All API calls use HTTPS
- No plaintext transmission
- Certificates are validated
- Secure communication

---

### TC-SEC-005: No Data Leakage in Logs
**Priority**: High  
**Category**: Security

**Pre-conditions**:
- Application running with debug logs

**Test Steps**:
1. Enable verbose logging
2. Use application normally
3. Review log files
4. Check for sensitive data

**Expected Result**:
- No API keys in logs
- No conversation content logged
- Personal data is redacted
- Logs are safe to share

---

### TC-SEC-006: Secure API Key Input
**Priority**: High  
**Category**: Security

**Pre-conditions**:
- Settings open

**Test Steps**:
1. Navigate to API key input
2. Start typing API key
3. Verify input is masked/hidden
4. Check if copy-paste works

**Expected Result**:
- API key input is password-masked
- Characters hidden as typed
- Copy-paste allowed for convenience
- No shoulder-surfing risk

---

### TC-SEC-007: Database File Permissions
**Priority**: Medium  
**Category**: Security

**Pre-conditions**:
- Database created

**Test Steps**:
1. Locate pluely.db file
2. Check file permissions
3. Verify only user has access
4. Test access from other accounts

**Expected Result**:
- File permissions restrict access
- Only user account can read/write
- Not accessible to other users
- OS-level protection

---

### TC-SEC-008: Memory Security
**Priority**: Medium  
**Category**: Security

**Pre-conditions**:
- Application running with sensitive data

**Test Steps**:
1. Use memory inspection tool
2. Search for API keys in memory
3. Check for conversation content
4. Verify data handling

**Expected Result**:
- Sensitive data minimized in memory
- Cleared after use (if possible)
- No unnecessary persistence
- Memory is secure

---

### TC-SEC-009: Clipboard Data Handling
**Priority**: Medium  
**Category**: Privacy

**Pre-conditions**:
- Copy feature used

**Test Steps**:
1. Copy text from conversation
2. Check clipboard content
3. Verify no unexpected data
4. Test with sensitive information

**Expected Result**:
- Only intended text copied
- No metadata or extra info
- Clipboard cleared if configured
- User controls clipboard

---

### TC-SEC-010: Update Mechanism Security
**Priority**: High  
**Category**: Security

**Pre-conditions**:
- Update available

**Test Steps**:
1. Check for updates
2. Verify update source (HTTPS)
3. Check for signature verification
4. Install update

**Expected Result**:
- Updates from trusted source only
- HTTPS for downloads
- Digital signature verified
- No man-in-the-middle risk

---

### TC-SEC-011: SQL Injection Prevention
**Priority**: High  
**Category**: Security

**Pre-conditions**:
- Database operations active

**Test Steps**:
1. Attempt SQL injection in inputs
2. Use malicious conversation titles
3. Test search with SQL keywords
4. Verify inputs are sanitized

**Expected Result**:
- All inputs are parameterized
- No SQL injection possible
- Database is protected
- Proper ORM/prepared statements used

---

### TC-SEC-012: XSS Prevention in Messages
**Priority**: High  
**Category**: Security

**Pre-conditions**:
- Markdown rendering active

**Test Steps**:
1. Send message with HTML/script tags
2. Verify rendering is safe
3. Check for script execution
4. Test various XSS payloads

**Expected Result**:
- HTML is sanitized
- Scripts don't execute
- Markdown rendering is safe
- No XSS vulnerability

---

### TC-SEC-013: File Upload Validation
**Priority**: High  
**Category**: Security

**Pre-conditions**:
- File attachment feature active

**Test Steps**:
1. Attempt to upload non-image file
2. Try uploading oversized file
3. Test with malicious filename
4. Verify validation

**Expected Result**:
- Only allowed file types accepted
- Size limits enforced
- Filenames sanitized
- No arbitrary file execution

---

### TC-SEC-014: Offline Mode Privacy (Ollama)
**Priority**: High  
**Category**: Privacy

**Pre-conditions**:
- Ollama configured and running

**Test Steps**:
1. Disconnect from internet
2. Send messages using Ollama
3. Monitor network (should be none)
4. Verify complete offline operation

**Expected Result**:
- Works completely offline
- Zero network activity
- All processing local
- Maximum privacy achieved

---

### TC-SEC-015: Data Deletion
**Priority**: High  
**Category**: Privacy

**Pre-conditions**:
- Conversations exist

**Test Steps**:
1. Delete conversation
2. Check database for removal
3. Verify data is actually deleted
4. Check for file remnants

**Expected Result**:
- Data deleted from database
- No soft-delete (unless intentional)
- Unrecoverable (or clear recovery process)
- User controls their data

---

## Performance Test Cases

### TC-PERF-001: Application Startup Time
**Priority**: High  
**Category**: Performance

**Pre-conditions**:
- Application closed

**Test Steps**:
1. Measure time from launch to ready state
2. Repeat 5 times
3. Calculate average
4. Compare to benchmark (<3 seconds)

**Expected Result**:
- Starts in under 3 seconds
- Consistent startup time
- No significant delays
- Ready to use quickly

---

### TC-PERF-002: Window Toggle Response Time
**Priority**: High  
**Category**: Performance

**Pre-conditions**:
- Application running

**Test Steps**:
1. Press Shift+\ to show window
2. Measure appearance time
3. Hide and repeat
4. Verify responsiveness (<200ms)

**Expected Result**:
- Window appears instantly (<200ms)
- No lag or stutter
- Smooth animation
- Consistent performance

---

### TC-PERF-003: Message Send Latency
**Priority**: Medium  
**Category**: Performance

**Pre-conditions**:
- AI provider configured

**Test Steps**:
1. Type short message
2. Press Enter
3. Measure time until first response chunk
4. Depends on AI provider

**Expected Result**:
- Message sent immediately
- First chunk appears within provider latency
- No client-side delays
- Streaming starts promptly

---

### TC-PERF-004: Conversation Load Time
**Priority**: Medium  
**Category**: Performance

**Pre-conditions**:
- Large conversation (100+ messages)

**Test Steps**:
1. Select conversation with many messages
2. Measure load time
3. Verify UI responsiveness
4. Test scrolling performance

**Expected Result**:
- Loads in under 1 second
- UI remains responsive
- Smooth scrolling
- No freezing

---

### TC-PERF-005: Database Query Performance
**Priority**: Medium  
**Category**: Performance

**Pre-conditions**:
- Multiple conversations in database

**Test Steps**:
1. Load conversation list
2. Search conversations
3. Load specific conversation
4. Monitor query times

**Expected Result**:
- Queries complete quickly (<100ms)
- No noticeable lag
- Indexed properly
- Scales well

---

### TC-PERF-006: Memory Usage
**Priority**: High  
**Category**: Performance

**Pre-conditions**:
- Application running

**Test Steps**:
1. Monitor RAM usage at idle
2. Use application heavily for 30 minutes
3. Check memory growth
4. Verify no memory leaks

**Expected Result**:
- Reasonable base memory (<200MB)
- No unbounded growth
- Memory stabilizes
- No leaks detected

---

### TC-PERF-007: CPU Usage at Idle
**Priority**: Medium  
**Category**: Performance

**Pre-conditions**:
- Application running, no activity

**Test Steps**:
1. Let application idle
2. Monitor CPU usage
3. Should be near 0%

**Expected Result**:
- Minimal CPU at idle (<1%)
- No background processing
- Efficient resource usage
- No unnecessary cycles

---

### TC-PERF-008: CPU Usage During AI Response
**Priority**: Medium  
**Category**: Performance

**Pre-conditions**:
- Streaming AI response

**Test Steps**:
1. Send message generating long response
2. Monitor CPU during streaming
3. Verify reasonable usage

**Expected Result**:
- CPU usage acceptable (<30%)
- UI remains responsive
- No system slowdown
- Efficient processing

---

### TC-PERF-009: Screenshot Capture Performance
**Priority**: Medium  
**Category**: Performance

**Pre-conditions**:
- Screenshot feature ready

**Test Steps**:
1. Trigger full screen capture
2. Measure capture time
3. Verify processing speed
4. Test on high-res displays

**Expected Result**:
- Capture completes quickly (<1s)
- No system freeze
- Works on 4K displays
- Efficient compression

---

### TC-PERF-010: Large Message Handling
**Priority**: Medium  
**Category**: Performance

**Pre-conditions**:
- AI provider configured

**Test Steps**:
1. Send very long message (1000+ words)
2. Receive long AI response
3. Verify UI performance
4. Check rendering speed

**Expected Result**:
- Handles large messages
- UI doesn't freeze
- Scrolling remains smooth
- Text renders properly

---

### TC-PERF-011: Concurrent Operations
**Priority**: Medium  
**Category**: Performance

**Pre-conditions**:
- Multiple features active

**Test Steps**:
1. Stream AI response
2. Simultaneously capture screenshot
3. Record audio input
4. Verify no conflicts

**Expected Result**:
- Operations don't block each other
- All complete successfully
- No race conditions
- Proper async handling

---

### TC-PERF-012: Database Size Growth
**Priority**: Low  
**Category**: Performance

**Pre-conditions**:
- Extended use over time

**Test Steps**:
1. Monitor database file size
2. Create many conversations
3. Check for bloat
4. Verify cleanup mechanisms

**Expected Result**:
- Database grows reasonably
- Old data can be purged
- No unbounded growth
- Optimization available

---

### TC-PERF-013: Audio Recording Latency
**Priority**: Medium  
**Category**: Performance

**Pre-conditions**:
- Microphone configured

**Test Steps**:
1. Start voice recording
2. Speak immediately
3. Verify audio capture starts instantly
4. Check for delay

**Expected Result**:
- No perceptible delay
- Audio captured from start
- Real-time processing
- Low latency (<50ms)

---

### TC-PERF-014: Rendering Performance with Code Blocks
**Priority**: Medium  
**Category**: Performance

**Pre-conditions**:
- AI response with code

**Test Steps**:
1. Request code from AI
2. Receive response with multiple code blocks
3. Verify syntax highlighting performance
4. Test scrolling

**Expected Result**:
- Code renders quickly
- Syntax highlighting doesn't lag
- Smooth scrolling
- No stuttering

---

### TC-PERF-015: Startup Performance with Large Database
**Priority**: Medium  
**Category**: Performance

**Pre-conditions**:
- Database with 100+ conversations

**Test Steps**:
1. Close application
2. Restart with large database
3. Measure startup time
4. Verify responsiveness

**Expected Result**:
- Startup time doesn't degrade significantly
- Lazy loading implemented
- UI responsive immediately
- Background loading if needed

---

## Cross-Platform Test Cases

### TC-PLATFORM-001: Windows 10 Compatibility
**Priority**: Critical  
**Category**: Cross-Platform

**Pre-conditions**:
- Windows 10 system

**Test Steps**:
1. Install application on Windows 10
2. Test all core features
3. Verify UI rendering
4. Check shortcuts work

**Expected Result**:
- Full functionality on Windows 10
- No compatibility issues
- All features work
- Proper rendering

---

### TC-PLATFORM-002: Windows 11 Compatibility
**Priority**: Critical  
**Category**: Cross-Platform

**Pre-conditions**:
- Windows 11 system

**Test Steps**:
1. Install on Windows 11
2. Test all features
3. Verify modern UI compatibility
4. Check taskbar behavior

**Expected Result**:
- Works perfectly on Windows 11
- Proper integration
- All features functional
- No Win11-specific issues

---

### TC-PLATFORM-003: macOS Compatibility
**Priority**: High  
**Category**: Cross-Platform

**Pre-conditions**:
- macOS 10.13+ system

**Test Steps**:
1. Install on macOS
2. Test NSPanel implementation
3. Verify shortcuts (Cmd key variants)
4. Check permissions (screen recording, mic)

**Expected Result**:
- Full macOS support
- Native look and feel
- Panel behavior correct
- Permission system works

---

### TC-PLATFORM-004: Linux Compatibility
**Priority**: Medium  
**Category**: Cross-Platform

**Pre-conditions**:
- Linux system (Ubuntu/Fedora)

**Test Steps**:
1. Install on Linux
2. Test core functionality
3. Check window management
4. Verify shortcuts

**Expected Result**:
- Works on major Linux distros
- Basic functionality operational
- May have limitations
- Documented issues

---

### TC-PLATFORM-005: High DPI Display Support
**Priority**: High  
**Category**: Cross-Platform

**Pre-conditions**:
- High DPI/4K display

**Test Steps**:
1. Run on high DPI screen
2. Verify UI scaling
3. Check text readability
4. Test screenshot quality

**Expected Result**:
- UI scales properly
- Text is sharp and clear
- No blurry elements
- Screenshots at correct resolution

---

### TC-PLATFORM-006: Multiple Monitor Setup
**Priority**: Medium  
**Category**: Cross-Platform

**Pre-conditions**:
- Multiple monitors (different resolutions)

**Test Steps**:
1. Test on each monitor
2. Move window between monitors
3. Disconnect/reconnect monitors
4. Verify positioning

**Expected Result**:
- Works on all monitors
- Handles resolution differences
- Graceful monitor disconnect handling
- Position memory works

---

### TC-PLATFORM-007: Touch Screen Support
**Priority**: Low  
**Category**: Cross-Platform

**Pre-conditions**:
- Touch-enabled device

**Test Steps**:
1. Test touch interactions
2. Verify buttons work
3. Test scrolling
4. Check text input

**Expected Result**:
- Touch inputs work
- Buttons are accessible
- Scrolling is smooth
- Virtual keyboard appears

---

### TC-PLATFORM-008: macOS Permission System
**Priority**: High  
**Category**: Cross-Platform

**Pre-conditions**:
- macOS system

**Test Steps**:
1. Test screen recording permission
2. Test microphone permission
3. Test accessibility permission (if needed)
4. Verify permission prompts

**Expected Result**:
- Permission requests appear
- Clear instructions provided
- Works after granting permission
- Graceful handling of denial

---

### TC-PLATFORM-009: Windows Security Features
**Priority**: High  
**Category**: Cross-Platform

**Pre-conditions**:
- Windows with security features enabled

**Test Steps**:
1. Test with Windows Defender active
2. Verify SmartScreen handling
3. Check UAC interactions
4. Test in protected environments

**Expected Result**:
- No false positive malware detection
- SmartScreen can be bypassed
- UAC prompts appropriate
- Works with security software

---

### TC-PLATFORM-010: macOS Dock Icon Behavior
**Priority**: Medium  
**Category**: Cross-Platform

**Pre-conditions**:
- macOS system

**Test Steps**:
1. Check dock icon visibility setting
2. Test with icon shown
3. Test with icon hidden (accessory mode)
4. Verify activation policy

**Expected Result**:
- Can hide from dock
- Activation policy works
- Still accessible
- System tray/menu bar works

---

### TC-PLATFORM-011: Windows Taskbar Behavior
**Priority**: Critical  
**Category**: Cross-Platform

**Pre-conditions**:
- Windows system

**Test Steps**:
1. Verify no taskbar icon (skipTaskbar)
2. Test with window shown
3. Check Alt+Tab behavior
4. Verify system tray icon

**Expected Result**:
- No taskbar icon shown
- Not in Alt+Tab
- System tray works
- Hidden from task switcher

---

### TC-PLATFORM-012: Keyboard Layout Support
**Priority**: Medium  
**Category**: Cross-Platform

**Pre-conditions**:
- Non-US keyboard layout

**Test Steps**:
1. Test with different keyboard layouts
2. Verify shortcuts work
3. Check special character input
4. Test international keyboards

**Expected Result**:
- Works with all layouts
- Shortcuts adapt if possible
- Special characters input correctly
- Unicode support

---

### TC-PLATFORM-013: RTL Language Support
**Priority**: Low  
**Category**: Cross-Platform

**Pre-conditions**:
- RTL language (Arabic, Hebrew)

**Test Steps**:
1. Input RTL text
2. Verify rendering
3. Check text direction
4. Test mixed LTR/RTL

**Expected Result**:
- RTL text displays correctly
- Proper text direction
- Mixed content handles well
- No UI breaking

---

### TC-PLATFORM-014: Accessibility Features
**Priority**: Medium  
**Category**: Cross-Platform

**Pre-conditions**:
- Screen reader enabled

**Test Steps**:
1. Enable screen reader (NVDA/JAWS/VoiceOver)
2. Navigate UI with keyboard
3. Verify announcements
4. Test all controls

**Expected Result**:
- Screen reader compatible
- Proper ARIA labels
- Keyboard navigation works
- Accessible to all users

---

### TC-PLATFORM-015: System Theme Integration
**Priority**: Low  
**Category**: Cross-Platform

**Pre-conditions**:
- OS theme settings

**Test Steps**:
1. Set OS to dark mode
2. Verify app respects theme
3. Switch to light mode
4. Check app adaptation

**Expected Result**:
- Respects system theme
- Smooth theme switching
- Consistent with OS
- Override option available

---

## Error Handling Test Cases

### TC-ERROR-001: Network Connection Loss
**Priority**: High  
**Category**: Error Handling

**Pre-conditions**:
- Active AI conversation

**Test Steps**:
1. Send message to AI
2. Disconnect internet during request
3. Observe error handling
4. Reconnect and retry

**Expected Result**:
- Clear network error message
- Request can be cancelled
- User can retry after reconnection
- No application crash

---

### TC-ERROR-002: API Key Expired/Invalid
**Priority**: High  
**Category**: Error Handling

**Pre-conditions**:
- Invalid or expired API key configured

**Test Steps**:
1. Send message with invalid key
2. Observe error response
3. Verify error message clarity

**Expected Result**:
- 401/403 error caught
- Clear message about API key issue
- Prompts user to check configuration
- Can access settings to fix

---

### TC-ERROR-003: Rate Limit Exceeded
**Priority**: Medium  
**Category**: Error Handling

**Pre-conditions**:
- API key with rate limits

**Test Steps**:
1. Send multiple requests rapidly
2. Trigger rate limit
3. Observe error handling
4. Wait and retry

**Expected Result**:
- Rate limit error detected
- Clear message with wait time
- Can retry after cooldown
- No permanent failure

---

### TC-ERROR-004: Database Corruption
**Priority**: High  
**Category**: Error Handling

**Pre-conditions**:
- Database file exists

**Test Steps**:
1. Corrupt database file (for testing)
2. Launch application
3. Observe error handling
4. Verify recovery options

**Expected Result**:
- Corruption detected
- Clear error message
- Recovery options offered (rebuild/restore)
- User data protected if possible

---

### TC-ERROR-005: Disk Space Full
**Priority**: Medium  
**Category**: Error Handling

**Pre-conditions**:
- Very low disk space

**Test Steps**:
1. Fill disk to near capacity
2. Attempt to save conversation
3. Attempt database write
4. Observe error handling

**Expected Result**:
- Disk space error detected
- Clear warning message
- No data corruption
- Graceful degradation

---

### TC-ERROR-006: Permission Denied (File Access)
**Priority**: Medium  
**Category**: Error Handling

**Pre-conditions**:
- Restricted file permissions

**Test Steps**:
1. Restrict database file permissions
2. Attempt to access
3. Observe error
4. Verify guidance

**Expected Result**:
- Permission error caught
- Clear message about permissions
- Instructions to fix
- No crash

---

### TC-ERROR-007: Invalid JSON Response from AI
**Priority**: Medium  
**Category**: Error Handling

**Pre-conditions**:
- AI provider may return malformed response

**Test Steps**:
1. Send message
2. Simulate/encounter malformed JSON
3. Verify parsing error handling

**Expected Result**:
- Parse error caught
- Graceful fallback
- User informed of issue
- Can retry

---

### TC-ERROR-008: Extremely Long AI Response
**Priority**: Medium  
**Category**: Error Handling

**Pre-conditions**:
- AI provider may generate very long response

**Test Steps**:
1. Request very long response
2. Verify handling of large text
3. Check UI performance
4. Test memory usage

**Expected Result**:
- Long responses handled
- No UI freeze
- Proper rendering
- Truncation if necessary

---

### TC-ERROR-009: Screenshot Capture Failure
**Priority**: Medium  
**Category**: Error Handling

**Pre-conditions**:
- Screenshot feature active

**Test Steps**:
1. Trigger screenshot on unavailable display
2. Deny screen recording permission
3. Observe error handling

**Expected Result**:
- Capture failure detected
- Clear error message
- Guidance provided
- Can retry

---

### TC-ERROR-010: Microphone Access Denied
**Priority**: High  
**Category**: Error Handling

**Pre-conditions**:
- Microphone permission not granted

**Test Steps**:
1. Attempt voice input without permission
2. Deny permission when prompted
3. Observe error handling

**Expected Result**:
- Permission denial caught
- Clear instructions to grant permission
- Link to system settings
- Feature disabled gracefully

---

### TC-ERROR-011: Invalid File Upload
**Priority**: Medium  
**Category**: Error Handling

**Pre-conditions**:
- File attachment feature

**Test Steps**:
1. Attempt to upload unsupported file type
2. Upload file exceeding size limit
3. Upload corrupted image file

**Expected Result**:
- File type validation works
- Size limits enforced
- Corrupted files rejected
- Clear error messages for each case

---

### TC-ERROR-012: Concurrent Request Conflict
**Priority**: Medium  
**Category**: Error Handling

**Pre-conditions**:
- AI request in progress

**Test Steps**:
1. Send first message
2. Immediately send second message
3. Verify conflict handling

**Expected Result**:
- First request cancelled or queued
- No race conditions
- Proper request management
- Clear indication of state

---

### TC-ERROR-013: System Audio Capture Failure
**Priority**: Medium  
**Category**: Error Handling

**Pre-conditions**:
- System audio feature

**Test Steps**:
1. Attempt system audio capture on unsupported system
2. Capture without proper permissions
3. Observe error handling

**Expected Result**:
- Failure detected
- Clear error message
- Fallback to microphone
- Feature disabled gracefully

---

### TC-ERROR-014: Database Migration Failure
**Priority**: High  
**Category**: Error Handling

**Pre-conditions**:
- Old version with localStorage data

**Test Steps**:
1. Simulate migration failure
2. Observe rollback
3. Verify data preservation

**Expected Result**:
- Migration failure caught
- Original data not lost
- Clear error message
- Can retry or skip migration

---

### TC-ERROR-015: Unexpected Application Crash
**Priority**: Critical  
**Category**: Error Handling

**Pre-conditions**:
- Application running

**Test Steps**:
1. Trigger crash scenario (if known)
2. Restart application
3. Verify crash recovery
4. Check data integrity

**Expected Result**:
- Crash report generated (if implemented)
- Data not corrupted
- Graceful restart
- User can continue work

---

### TC-ERROR-016: Shortcut Registration Failure
**Priority**: Medium  
**Category**: Error Handling

**Pre-conditions**:
- Attempting to register shortcut

**Test Steps**:
1. Try to register already-used system shortcut
2. Attempt invalid shortcut
3. Observe error handling

**Expected Result**:
- Registration failure detected
- Clear error message
- Alternative suggestions
- Can choose different shortcut

---

### TC-ERROR-017: Empty or Whitespace-Only Input
**Priority**: Low  
**Category**: Validation

**Pre-conditions**:
- Input field

**Test Steps**:
1. Attempt to send empty message
2. Send only whitespace
3. Verify validation

**Expected Result**:
- Empty input rejected
- Send button disabled
- No API call made
- User feedback provided

---

### TC-ERROR-018: AI Provider Timeout
**Priority**: Medium  
**Category**: Error Handling

**Pre-conditions**:
- Slow/unresponsive AI provider

**Test Steps**:
1. Send request that times out
2. Observe timeout handling
3. Verify user can cancel/retry

**Expected Result**:
- Timeout detected after reasonable period
- Clear timeout message
- Request can be cancelled
- Can retry

---

### TC-ERROR-019: Image Processing Error
**Priority**: Medium  
**Category**: Error Handling

**Pre-conditions**:
- Image attachment feature

**Test Steps**:
1. Attach extremely large image
2. Attach corrupted image file
3. Verify error handling

**Expected Result**:
- Size limits enforced
- Corrupted images rejected
- Clear error messages
- No crash

---

### TC-ERROR-020: Configuration File Corruption
**Priority**: High  
**Category**: Error Handling

**Pre-conditions**:
- Configuration file exists

**Test Steps**:
1. Corrupt settings/config file
2. Launch application
3. Observe recovery
4. Verify defaults restored

**Expected Result**:
- Corruption detected
- Falls back to defaults
- User informed
- Can reconfigure

---

## Integration Test Cases

### TC-INT-001: OpenAI API Integration
**Priority**: Critical  
**Category**: Integration

**Pre-conditions**:
- Valid OpenAI API key

**Test Steps**:
1. Configure OpenAI provider
2. Test with gpt-3.5-turbo
3. Test with gpt-4
4. Test with gpt-4-turbo
5. Verify streaming works
6. Test image input (vision models)

**Expected Result**:
- All OpenAI models work
- Streaming responses correct
- Image analysis works
- API format matches OpenAI spec

---

### TC-INT-002: Claude (Anthropic) API Integration
**Priority**: Critical  
**Category**: Integration

**Pre-conditions**:
- Valid Anthropic API key

**Test Steps**:
1. Configure Claude provider
2. Test Claude 3 models (Opus, Sonnet, Haiku)
3. Verify custom headers
4. Test streaming
5. Test image input

**Expected Result**:
- Claude API works correctly
- All models accessible
- Proper header handling
- Streaming functional

---

### TC-INT-003: Google Gemini API Integration
**Priority**: High  
**Category**: Integration

**Pre-conditions**:
- Valid Google API key

**Test Steps**:
1. Configure Gemini provider
2. Test text generation
3. Test image analysis
4. Test transcription API
5. Verify non-streaming response

**Expected Result**:
- Gemini API works
- Both text and vision work
- Transcription API functional
- Response path parsing correct

---

### TC-INT-004: Ollama Local Integration
**Priority**: High  
**Category**: Integration

**Pre-conditions**:
- Ollama installed and running
- Model downloaded

**Test Steps**:
1. Configure Ollama endpoint
2. Test with llama2
3. Test with other models
4. Verify completely offline
5. Test streaming

**Expected Result**:
- Connects to local Ollama
- No network requests
- All models work
- Streaming functional

---

### TC-INT-005: Multiple AI Providers Sequential
**Priority**: High  
**Category**: Integration

**Pre-conditions**:
- Multiple providers configured

**Test Steps**:
1. Send message with Provider A
2. Switch to Provider B
3. Send another message
4. Switch back to Provider A
5. Verify context separation

**Expected Result**:
- Can switch between providers
- Each works independently
- No state mixing
- Conversations stay separate

---

### TC-INT-006: Image + Text to AI
**Priority**: High  
**Category**: Integration

**Pre-conditions**:
- Vision-capable AI model (GPT-4V, Claude 3, Gemini)

**Test Steps**:
1. Attach image
2. Add text prompt
3. Send to AI
4. Verify both are processed

**Expected Result**:
- Image and text sent together
- AI analyzes both
- Response references image
- Proper API format

---

### TC-INT-007: Voice to Text to AI Pipeline
**Priority**: High  
**Category**: Integration

**Pre-conditions**:
- Microphone working
- Gemini transcription configured
- AI provider ready

**Test Steps**:
1. Record voice input
2. Verify transcription
3. Auto-send to AI
4. Receive response

**Expected Result**:
- Full pipeline works
- Voice → Text → AI → Response
- No manual intervention needed
- All steps complete successfully

---

### TC-INT-008: Screenshot to AI Pipeline
**Priority**: High  
**Category**: Integration

**Pre-conditions**:
- Screenshot auto mode configured
- Vision AI model selected

**Test Steps**:
1. Capture screenshot
2. Verify auto-prompt added
3. Auto-send to AI
4. Receive analysis

**Expected Result**:
- Screenshot → Prompt → AI → Response
- Full automation works
- Image properly encoded
- AI analyzes screenshot

---

### TC-INT-009: System Tray Menu Interaction
**Priority**: Medium  
**Category**: Integration

**Pre-conditions**:
- Application running

**Test Steps**:
1. Right-click system tray icon
2. Test "Show/Hide" option
3. Test "Settings" option
4. Test "Quit" option
5. Verify all menu items

**Expected Result**:
- All menu items work
- Show/Hide toggles window
- Settings opens correctly
- Quit exits application

---

### TC-INT-010: Database + UI Sync
**Priority**: Critical  
**Category**: Integration

**Pre-conditions**:
- Active conversation

**Test Steps**:
1. Send messages
2. Verify immediate UI update
3. Check database write
4. Reload conversation
5. Verify consistency

**Expected Result**:
- UI updates in real-time
- Database writes complete
- No data discrepancy
- Perfect sync

---

### TC-INT-011: Keyboard Shortcuts + Window Management
**Priority**: High  
**Category**: Integration

**Pre-conditions**:
- Multiple shortcuts configured

**Test Steps**:
1. Test toggle window shortcut
2. Test move window shortcuts
3. Test screenshot shortcut
4. Verify all work together

**Expected Result**:
- No shortcut conflicts
- All work simultaneously
- Proper event handling
- No interference

---

### TC-INT-012: Multi-Provider with Same Conversation
**Priority**: Medium  
**Category**: Integration

**Pre-conditions**:
- Conversation started with Provider A

**Test Steps**:
1. Send messages with Provider A
2. Switch to Provider B in same conversation
3. Continue conversation
4. Verify context handling

**Expected Result**:
- Provider switch works
- Conversation continues
- Context maintained
- No errors

---

### TC-INT-013: Concurrent Features Test
**Priority**: High  
**Category**: Integration

**Pre-conditions**:
- All features enabled

**Test Steps**:
1. Start AI response streaming
2. Trigger screenshot capture
3. Record voice simultaneously
4. Verify no conflicts

**Expected Result**:
- All features work together
- No blocking
- No race conditions
- Proper async handling

---

### TC-INT-014: Settings Change + Active Session
**Priority**: Medium  
**Category**: Integration

**Pre-conditions**:
- Active conversation

**Test Steps**:
1. During active conversation
2. Change AI provider settings
3. Change model
4. Continue conversation

**Expected Result**:
- Settings update live
- Current request not affected
- Next request uses new settings
- No crash

---

### TC-INT-015: Database Migration + Active Use
**Priority**: High  
**Category**: Integration

**Pre-conditions**:
- First launch with old data

**Test Steps**:
1. Launch app with localStorage data
2. Migration starts
3. Verify app usability during migration
4. Confirm migration completes

**Expected Result**:
- Migration runs in background
- App remains usable
- No data loss
- Smooth completion

---

### TC-INT-016: Streaming Response + Cancel + New Request
**Priority**: High  
**Category**: Integration

**Pre-conditions**:
- AI response streaming

**Test Steps**:
1. Send message, response streams
2. Cancel mid-stream
3. Immediately send new message
4. Verify clean transition

**Expected Result**:
- Cancel works immediately
- Abort controller stops request
- New request starts fresh
- No state pollution

---

### TC-INT-017: File Attachment + Multi-Provider
**Priority**: Medium  
**Category**: Integration

**Pre-conditions**:
- Image attached

**Test Steps**:
1. Attach image
2. Send to Provider A (vision capable)
3. Same image, switch to Provider B
4. Verify both process correctly

**Expected Result**:
- Image works with multiple providers
- Each uses correct API format
- No base64 corruption
- Both analyze successfully

---

### TC-INT-018: Keyboard Shortcuts + Focus States
**Priority**: Medium  
**Category**: Integration

**Pre-conditions**:
- Window visible and focused

**Test Steps**:
1. Input field focused
2. Use shortcut (should work)
3. Settings dialog open
4. Use shortcut (behavior defined)
5. Test focus interactions

**Expected Result**:
- Shortcuts respect focus
- Don't interfere with typing
- Proper scope handling
- Context-aware behavior

---

### TC-INT-019: Auto-Start + First Launch
**Priority**: Medium  
**Category**: Integration

**Pre-conditions**:
- Auto-start enabled

**Test Steps**:
1. Enable auto-start
2. Restart system
3. Verify app starts hidden
4. Toggle to show window
5. Test full functionality

**Expected Result**:
- Starts on boot correctly
- Begins in hidden state
- All features work
- No initialization errors

---

### TC-INT-020: Update Check + Active Session
**Priority**: Low  
**Category**: Integration

**Pre-conditions**:
- Update available

**Test Steps**:
1. During active conversation
2. Check for updates
3. Receive update notification
4. Verify session not interrupted

**Expected Result**:
- Update check is non-blocking
- Notification appears
- Session continues
- Can update later

---

## Summary and Test Execution Guidelines

### Test Priority Levels

**Critical**: Must pass before release
- Core functionality (window toggle, AI communication)
- Data integrity (database, conversations)
- Security (API keys, content protection)

**High**: Should pass before release
- Major features (screenshot, voice input)
- Cross-platform compatibility
- Error handling for common scenarios

**Medium**: Important but can be addressed in updates
- UI/UX enhancements
- Performance optimizations
- Edge cases

**Low**: Nice to have, low impact
- Minor features
- Cosmetic issues
- Rare edge cases

---

### Test Execution Order

1. **Phase 1: Core Functionality** (TC-CORE-*, TC-WIN-*)
2. **Phase 2: AI Integration** (TC-AI-*, TC-INT-*)
3. **Phase 3: Features** (TC-SCREEN-*, TC-AUDIO-*, TC-CONV-*)
4. **Phase 4: Security & Privacy** (TC-SEC-*, TC-STEALTH-*)
5. **Phase 5: Performance & Cross-Platform** (TC-PERF-*, TC-PLATFORM-*)
6. **Phase 6: Error Handling** (TC-ERROR-*)

---

### Test Environment Setup

**Required Tools**:
- Windows 10/11, macOS 10.13+, Linux test machines
- Network monitoring tools (Wireshark)
- Screen recording software (OBS Studio)
- API keys for all supported providers
- Audio testing equipment
- Multiple monitors (for multi-display tests)

**Test Data**:
- Sample images (various formats and sizes)
- Test audio files
- Mock API responses
- Database with test conversations

---

### Defect Severity Levels

**Critical**: Application unusable, data loss, security breach
**High**: Major feature broken, workaround exists
**Medium**: Feature partially works, minor impact
**Low**: Cosmetic issue, minimal impact

---

### Sign-off Criteria

✅ All Critical tests pass  
✅ >95% High priority tests pass  
✅ No critical or high severity open defects  
✅ Performance benchmarks met  
✅ Security audit complete  
✅ Cross-platform testing complete  
✅ Documentation updated  

---

## Document Information

**Total Test Cases**: 206+  
**Categories**: 15  
**Last Updated**: December 2024  
**Version**: 1.0  
**Status**: Comprehensive test suite ready for execution

---

**End of Test Cases Document**

*Note: This is a living document and should be updated as new features are added or existing features are modified.*
