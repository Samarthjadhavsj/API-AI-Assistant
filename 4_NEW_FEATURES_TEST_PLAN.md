# Test Plan for 4 New Features

## Features to Test

1. ✅ **Toggle Search Response Background** - Visual toggle for response backgrounds
2. ✅ **Settings Page** - New settings interface
3. ✅ **Shift+Backspace Shortcut** - Toggle updates feature
4. ✅ **Automatic Application Running Issue** - Auto-start functionality
5. ✅ **Screenshot without Text** - Clean screenshot capture (no text overlay)

---

## Prerequisites

### Before Testing
- [ ] Build completed successfully
- [ ] Application is running
- [ ] Browser DevTools open (F12) for console logs
- [ ] System tray icon visible

### Build Application
```powershell
cd "c:\Users\SAMAR\OneDrive\Desktop\Pluly\API-AI-Assistant-main"
.\build-quick.ps1
```

---

## Feature 1: Toggle Search Response Background

### Description
A toggle that changes the visual background of search/AI responses.

### Test Steps
1. Launch the application
2. Open settings or look for background toggle option
3. Send a test message/query to get a response
4. Observe the response background
5. Toggle the background setting
6. Send another message
7. Verify background changes

### Expected Results
- ✅ Background toggle is accessible
- ✅ Responses display with correct background initially
- ✅ Toggling changes the background appearance
- ✅ Setting persists after app restart
- ✅ No visual glitches or rendering issues

### How to Test
```
1. Find the background toggle in settings
2. Note current response appearance
3. Toggle the setting
4. Compare before/after appearance
```

### Test Status
- [ ] PASS - Background toggles correctly
- [ ] FAIL - Issue: _________________
- [ ] BLOCKED - Reason: _________________

---

## Feature 2: Settings Page

### Description
New or updated settings interface for configuring the application.

### Test Steps
1. Launch the application
2. Access settings via:
   - Right-click system tray → "Settings"
   - OR keyboard shortcut (if any)
   - OR in-app settings button
3. Verify settings page loads
4. Check all settings sections are visible
5. Test changing a setting
6. Save changes
7. Verify settings persist after restart

### Expected Results
- ✅ Settings page loads without errors
- ✅ All setting categories are accessible
- ✅ Settings can be modified
- ✅ Changes are saved properly
- ✅ Window resizes appropriately for settings (600x560)
- ✅ Navigation back to main view works
- ✅ No console errors

### Settings to Check
- [ ] Shortcuts configuration
- [ ] Update preferences
- [ ] Auto-start settings
- [ ] Theme/appearance
- [ ] Background toggle
- [ ] Any other visible settings

### Test Status
- [ ] PASS - Settings fully functional
- [ ] FAIL - Issue: _________________
- [ ] BLOCKED - Reason: _________________

---

## Feature 3: Shift+Backspace Shortcut (Toggle Updates)

### Description
Global keyboard shortcut that toggles update notifications on/off.

### Test Steps

#### Basic Functionality
1. Launch application
2. Open browser console (F12)
3. Press **Shift+Backspace**
4. Check console output for:
   - `[TOGGLE_UPDATES] Toggle updates triggered`
   - `[TOGGLE_UPDATES] Event emitted successfully`
   - `Updates enabled` or `Updates disabled`
5. Press **Shift+Backspace** again
6. Verify state toggles to opposite

#### State Persistence
1. Press **Shift+Backspace** to set a state
2. In console: `localStorage.getItem('updates_enabled')`
3. Note the value ("true" or "false")
4. Close application completely
5. Relaunch application
6. Check localStorage again - should be same value
7. Toggle should continue working

#### Edge Cases
1. **While window hidden**: Hide window, press shortcut, verify it works
2. **Rapid toggling**: Press 5 times rapidly, check for errors
3. **During app startup**: Press immediately after launch
4. **In text input**: While typing, press shortcut (should still work globally)

### Expected Results
- ✅ Shortcut registered: `Registered shortcut: toggle_updates -> shift+backspace`
- ✅ Console shows correct toggle messages
- ✅ State persists in localStorage as `updates_enabled`
- ✅ Works when window is hidden (global shortcut)
- ✅ No conflicts with other shortcuts
- ✅ Rapid toggles work without errors

### Console Commands for Testing
```javascript
// Check current state
localStorage.getItem('updates_enabled')

// Manually set state
localStorage.setItem('updates_enabled', 'false')
localStorage.setItem('updates_enabled', 'true')

// Clear state (reset to default)
localStorage.removeItem('updates_enabled')
```

### Test Status
- [ ] PASS - Shortcut works perfectly
- [ ] FAIL - Issue: _________________
- [ ] BLOCKED - Reason: _________________

---

## Feature 4: Automatic Application Running Issue

### Description
Auto-start functionality that should launch the app on system boot.

### Issue Description
Describe the issue: _________________________________________________

### Test Steps

#### Enable Auto-Start
1. Open Settings
2. Find "Auto-start" or "Launch at startup" option
3. Enable the setting
4. Save and close application
5. Restart computer
6. Check if application launched automatically
7. Verify it launches in correct state (hidden/shown)

#### Disable Auto-Start
1. Open Settings
2. Disable auto-start
3. Save and close
4. Restart computer
5. Verify application does NOT start automatically

#### Verify Auto-Start Registration
**On Windows:**
```powershell
# Check Task Scheduler
Get-ScheduledTask | Where-Object {$_.TaskName -like "*Frank*"}

# Or check Registry
reg query "HKCU\Software\Microsoft\Windows\CurrentVersion\Run"
```

### Expected Results
- ✅ Auto-start setting is visible in settings
- ✅ When enabled, app launches on system boot
- ✅ When disabled, app does not auto-launch
- ✅ Auto-start respects window visibility settings
- ✅ No errors in console during auto-start
- ✅ Application state is correct after auto-start

### Common Issues to Check
- [ ] App launches but crashes immediately
- [ ] App launches but window doesn't show
- [ ] App launches multiple instances
- [ ] Auto-start setting doesn't persist
- [ ] Permission errors preventing auto-start

### Test Status
- [ ] PASS - Auto-start works correctly
- [ ] FAIL - Issue: _________________
- [ ] BLOCKED - Reason: _________________

---

## Feature 5: Screenshot without Text

### Description
Clean screenshot capture that doesn't show text overlay/instructions.

### Test Steps

#### Basic Screenshot Test
1. Press **Shift+S** (or screenshot shortcut)
2. Overlay window should appear
3. **Observe the overlay** - Check for:
   - Instructions text visible: "Screen Capture: Click and drag..."
   - Cancel button visible
   - Any other text or UI elements
4. Click and drag to select an area
5. Release mouse
6. Check captured screenshot
7. Verify screenshot is clean (no UI elements captured)

#### Settings Check
1. Open Settings
2. Look for "Show screenshot instructions" or similar toggle
3. If toggle exists, disable it
4. Try screenshot again
5. Verify no text appears

#### Visual Verification
The overlay should show:
- ✅ Transparent background
- ✅ Selection rectangle while dragging
- ✅ Custom cursor
- ❌ NO instructions text (if feature working)
- ❌ NO cancel button (or hidden from screenshot)

### Code to Check
Look in `src/components/Overlay.tsx`:
- Instructions text element
- Cancel button element
- Check if they have conditional rendering
- Check if there's a setting to hide them

### Expected Results
- ✅ Screenshot overlay is transparent
- ✅ Background content is visible through overlay
- ✅ Selection rectangle appears while dragging
- ✅ Captured screenshot doesn't include overlay UI
- ✅ Instructions/button don't appear in final screenshot
- ✅ Clean screenshot saved to clipboard or file

### Test Status
- [ ] PASS - Screenshots are clean
- [ ] FAIL - Issue: _________________
- [ ] BLOCKED - Reason: _________________

---

## Integration Test - All Features Together

### Test Scenario
Test all features work together without conflicts.

### Steps
1. Launch app with auto-start enabled
2. Verify app starts correctly
3. Open settings
4. Toggle response background
5. Save and close settings
6. Press **Shift+Backspace** to toggle updates
7. Take a screenshot (Shift+S)
8. Verify screenshot is clean
9. Check all features still work
10. Restart app
11. Verify all settings persisted

### Expected Results
- ✅ No feature conflicts
- ✅ All features work independently
- ✅ Settings persist across restarts
- ✅ No errors in console
- ✅ Application performance is good

### Test Status
- [ ] PASS
- [ ] FAIL - Issue: _________________

---

## Bug Reporting Template

If any test fails, use this template:

### Bug Report: [Feature Name]
**Severity**: Critical / High / Medium / Low

**Description**:
Clear description of the issue...

**Steps to Reproduce**:
1. 
2. 
3. 

**Expected Behavior**:
What should happen...

**Actual Behavior**:
What actually happens...

**Console Errors** (if any):
```
Paste console errors here
```

**Screenshots**:
Attach screenshots if relevant

**Environment**:
- OS: Windows 11
- App Version: 0.1.8
- Build: [Quick/Production]

---

## Test Summary

### Results Overview
| # | Feature | Status | Notes |
|---|---------|--------|-------|
| 1 | Toggle Response Background | ⬜ | |
| 2 | Settings Page | ⬜ | |
| 3 | Shift+Backspace Shortcut | ⬜ | |
| 4 | Auto-Start Issue | ⬜ | |
| 5 | Screenshot without Text | ⬜ | |

### Statistics
- **Total Features**: 5
- **Passed**: 0
- **Failed**: 0
- **Blocked**: 0
- **Not Tested**: 5

### Overall Status
⬜ All tests pending

### Next Steps
1. Complete build
2. Run all tests systematically
3. Document results
4. Report any bugs found
5. Retest after fixes

---

## Quick Test Checklist

Use this for rapid testing:

- [ ] App launches successfully
- [ ] Settings page opens
- [ ] Response background toggles
- [ ] Shift+Backspace works
- [ ] Updates state persists
- [ ] Auto-start setting visible
- [ ] Auto-start works after reboot
- [ ] Screenshot overlay appears
- [ ] Screenshot has no text/UI
- [ ] All settings persist
- [ ] No console errors
- [ ] System tray works

---

**Tester**: _________________  
**Date**: _________________  
**Build**: _________________  
**Duration**: _________________
