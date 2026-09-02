# Comprehensive Feature Test Plan

## Features to Test

1. **System Tray - Toggle Window** (via tray menu)
2. **System Tray - Settings** (via tray menu)
3. **System Tray - Quit** (via tray menu)
4. **Toggle Updates** (Shift+Backspace shortcut)

---

## Test Environment Setup

### Prerequisites
- [ ] Application built successfully
- [ ] No compilation errors
- [ ] Application is running
- [ ] Browser console accessible (F12)

### Build Command
```powershell
# Quick build for testing
.\build-quick.ps1

# OR full production build
.\build-production.ps1
```

---

## Test 1: System Tray - Toggle Window

### Test Steps
1. Launch the application
2. Verify system tray icon appears in Windows taskbar notification area
3. Right-click the tray icon
4. Click "Toggle Window" menu item
5. If window is hidden, it should show
6. Right-click tray icon again
7. Click "Toggle Window" again
8. If window is shown, it should hide

### Expected Results
- ✅ Tray icon visible in system tray
- ✅ Right-click shows menu with "Toggle Window" option
- ✅ Clicking toggles window visibility
- ✅ Window shows and gains focus when toggled from hidden
- ✅ Window hides when toggled from visible
- ✅ Console logs show `[TRAY] Showing window via tray toggle` or `[TRAY] Hiding window via tray toggle`

### Test Status
- [ ] PASS
- [ ] FAIL - Reason: _______________

---

## Test 2: System Tray - Left Click Toggle

### Test Steps
1. With application running
2. Left-click (single click) on the system tray icon
3. Observe window behavior
4. Left-click again
5. Observe window behavior

### Expected Results
- ✅ Left-click on tray icon toggles window (same as menu item)
- ✅ First click shows window if hidden
- ✅ Second click hides window if shown
- ✅ Console logs match toggle behavior

### Test Status
- [ ] PASS
- [ ] FAIL - Reason: _______________

---

## Test 3: System Tray - Settings

### Test Steps
1. Right-click system tray icon
2. Click "Settings" menu item
3. Observe what happens
4. Verify settings page opens
5. Check window size changes to settings view
6. Try navigating back

### Expected Results
- ✅ Window shows if hidden
- ✅ Window gains focus
- ✅ Browser navigates to `/toggle/settings` route
- ✅ Settings page renders correctly
- ✅ Window may resize for settings view (600x560)
- ✅ No console errors
- ✅ Back button returns to compact view

### Test Status
- [ ] PASS
- [ ] FAIL - Reason: _______________

---

## Test 4: System Tray - Quit

### Test Steps
1. Right-click system tray icon
2. Click "Quit" menu item
3. Observe application behavior

### Expected Results
- ✅ Application closes immediately
- ✅ All windows close
- ✅ System tray icon disappears
- ✅ Application process terminates
- ✅ No error dialogs appear

### Test Status
- [ ] PASS
- [ ] FAIL - Reason: _______________

---

## Test 5: Toggle Updates - Keyboard Shortcut

### Test Steps
1. Launch application
2. Open browser console (F12 or right-click → Inspect)
3. Press **Shift+Backspace**
4. Check console output
5. Press **Shift+Backspace** again
6. Check console output again

### Expected Results
- ✅ First press logs: `[TOGGLE_UPDATES] Toggle updates triggered`
- ✅ First press logs: `[TOGGLE_UPDATES] Event emitted successfully`
- ✅ First press logs: `Updates disabled` (or enabled, depending on initial state)
- ✅ First press logs: `[TOGGLE] Updates disabled`
- ✅ Second press toggles to opposite state
- ✅ Second press logs: `[TOGGLE] Updates enabled`
- ✅ No errors in console

### Test Status
- [ ] PASS
- [ ] FAIL - Reason: _______________

---

## Test 6: Toggle Updates - State Persistence

### Test Steps
1. Open browser console
2. Press **Shift+Backspace** to disable updates
3. In console, run: `localStorage.getItem('updates_enabled')`
4. Verify it returns `"false"`
5. Close application completely
6. Relaunch application
7. Open console
8. Run: `localStorage.getItem('updates_enabled')`
9. Verify it still returns `"false"`
10. Press **Shift+Backspace** to enable
11. Verify localStorage shows `"true"`

### Expected Results
- ✅ State saves to localStorage immediately
- ✅ localStorage key is `updates_enabled`
- ✅ Value is string `"true"` or `"false"`
- ✅ State persists after app restart
- ✅ Toggle continues to work after restart

### Test Status
- [ ] PASS
- [ ] FAIL - Reason: _______________

---

## Test 7: Toggle Updates - Rapid Toggle

### Test Steps
1. Press **Shift+Backspace** 10 times rapidly
2. Observe console logs
3. Check for any errors
4. Verify final state in localStorage

### Expected Results
- ✅ Each press logs toggle event
- ✅ State alternates with each press
- ✅ No race conditions or errors
- ✅ Final state is consistent
- ✅ localStorage updates correctly

### Test Status
- [ ] PASS
- [ ] FAIL - Reason: _______________

---

## Test 8: Toggle Updates - While Window Hidden

### Test Steps
1. Hide the main window (Shift+\ or tray toggle)
2. Press **Shift+Backspace**
3. Show window again
4. Check console for logs
5. Verify localStorage was updated

### Expected Results
- ✅ Shortcut works even when window hidden (global shortcut)
- ✅ State toggles correctly
- ✅ Logs appear in console when window shown again
- ✅ localStorage updated correctly

### Test Status
- [ ] PASS
- [ ] FAIL - Reason: _______________

---

## Test 9: Shortcut Registration

### Test Steps
1. Launch application
2. Open console
3. Check for shortcut registration logs
4. Look for: `Registered shortcut: toggle_updates -> shift+backspace`
5. Verify no registration errors

### Expected Results
- ✅ Console shows successful shortcut registration
- ✅ No error: `Failed to register toggle_updates shortcut`
- ✅ No conflicts with other shortcuts
- ✅ Both `toggle_window` and `toggle_updates` registered successfully

### Test Status
- [ ] PASS
- [ ] FAIL - Reason: _______________

---

## Test 10: Integration Test - All Features Together

### Test Steps
1. Launch application
2. Press **Shift+Backspace** (toggle updates)
3. Right-click tray → Click "Settings"
4. Verify settings opens
5. Press **Shift+\** (toggle window to hide)
6. Press **Shift+\** (toggle window to show)
7. Press **Shift+Backspace** again
8. Right-click tray → Click "Toggle Window"
9. Right-click tray → Click "Quit"

### Expected Results
- ✅ All shortcuts work independently
- ✅ Tray menu functions work
- ✅ No interference between features
- ✅ Application quits cleanly at end

### Test Status
- [ ] PASS
- [ ] FAIL - Reason: _______________

---

## Console Commands for Testing

### Check Updates State
```javascript
localStorage.getItem('updates_enabled')
```

### Manually Toggle Updates
```javascript
localStorage.setItem('updates_enabled', 'false')
localStorage.setItem('updates_enabled', 'true')
```

### Clear Updates State
```javascript
localStorage.removeItem('updates_enabled')
```

### Check All Shortcuts
```javascript
// In console, check window object for any exposed shortcut info
console.log('Testing shortcuts...')
```

---

## Known Issues to Watch For

### Potential Issues
1. **Shortcut Conflict**: Shift+Backspace may conflict with browser/system shortcuts
2. **State Race Condition**: Rapid toggles might cause state sync issues
3. **Tray Icon Missing**: May not appear on some Windows configurations
4. **Settings Navigation**: Route might not exist if not implemented
5. **Focus Issues**: Window might not gain focus properly on toggle

### Workarounds
- If shortcut doesn't work, check Windows shortcut settings
- If tray icon missing, check Windows taskbar settings for hidden icons
- If settings route missing, skip Test 3 (feature not yet implemented)

---

## Test Summary Report

### Test Results
| Test # | Feature | Status | Notes |
|--------|---------|--------|-------|
| 1 | Tray - Toggle Window | ⬜ | |
| 2 | Tray - Left Click | ⬜ | |
| 3 | Tray - Settings | ⬜ | |
| 4 | Tray - Quit | ⬜ | |
| 5 | Updates - Shortcut | ⬜ | |
| 6 | Updates - Persistence | ⬜ | |
| 7 | Updates - Rapid Toggle | ⬜ | |
| 8 | Updates - Hidden Window | ⬜ | |
| 9 | Shortcut Registration | ⬜ | |
| 10 | Integration Test | ⬜ | |

### Overall Status
- **Total Tests**: 10
- **Passed**: 0
- **Failed**: 0
- **Blocked**: 0
- **Not Run**: 10

### Recommendations
_Fill in after testing_

---

## Next Steps

After completing all tests:

1. Document any failures with detailed error messages
2. Take screenshots of issues
3. Check console logs and Rust logs for errors
4. Create bug reports for any failures
5. Update this document with test results
6. Share results with the team

---

## Build and Run Instructions

### Build
```powershell
# Navigate to project directory
cd "c:\Users\SAMAR\OneDrive\Desktop\Pluly\API-AI-Assistant-main"

# Run quick build
.\build-quick.ps1
```

### Run
```powershell
# After successful build, run:
.\src-tauri\target\release\Frank.exe

# Or find it in:
# src-tauri\target\release\Frank.exe
```

### Check Logs
- **Rust logs**: Check terminal where you ran the build/app
- **Frontend logs**: F12 in app → Console tab
- **Tauri logs**: Check debug output in terminal

---

**Test Date**: _________________  
**Tester**: _________________  
**Build Version**: _________________  
**Platform**: Windows 11  
**Test Duration**: _________________
