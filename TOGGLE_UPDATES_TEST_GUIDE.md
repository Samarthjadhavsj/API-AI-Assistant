# Toggle Updates Feature - Test Guide

## Quick Test Steps

### 1. Build the Application
```powershell
# Run one of these build scripts
.\build-quick.ps1
# or
.\build-production.ps1
```

### 2. Test the Shortcut

#### Basic Functionality Test
1. Launch the built application
2. Open the browser console (F12) or check the app logs
3. Press **Shift+Backspace**
4. You should see in the console:
   - `[TOGGLE_UPDATES] Toggle updates triggered`
   - `[TOGGLE_UPDATES] Event emitted successfully`
   - `[TOGGLE] Updates enabled` or `[TOGGLE] Updates disabled`

#### State Persistence Test
1. Press **Shift+Backspace** to disable updates
2. Check localStorage in browser console:
   ```javascript
   localStorage.getItem('updates_enabled')
   // Should return "false"
   ```
3. Close and restart the application
4. Check localStorage again - should still be `"false"`
5. Press **Shift+Backspace** again to enable
6. Verify localStorage is now `"true"`

#### Rapid Toggle Test
1. Press **Shift+Backspace** multiple times rapidly
2. Each press should toggle the state
3. Console should show alternating enable/disable messages
4. No errors should appear

### 3. Integration Test

#### Test with Settings (if you have a settings UI)
```typescript
// In your settings component:
const { updatesEnabled, setUpdatesEnabled } = useApp();

console.log('Current update status:', updatesEnabled);
// Should reflect the actual state
```

#### Test Manual Toggle
```typescript
// In any component:
const { updatesEnabled, setUpdatesEnabled } = useApp();

// Manually set to false
setUpdatesEnabled(false);
// Check localStorage - should be "false"

// Manually set to true
setUpdatesEnabled(true);
// Check localStorage - should be "true"
```

### 4. Cross-Platform Test (if applicable)

- **Windows**: Press Shift+Backspace
- **macOS**: Press Shift+Backspace (same key)
- **Linux**: Press Shift+Backspace (same key)

All should work identically.

### 5. Edge Cases to Test

#### Conflicting Shortcuts
1. Try using Shift+Backspace in a text input field
2. The global shortcut should still trigger
3. (Note: You may want to add logic to prevent trigger while typing)

#### Window Focus
1. With app window hidden, press Shift+Backspace
2. Shortcut should still work (it's global)
3. Check logs to verify

#### Rapid App Restart
1. Launch app
2. Press Shift+Backspace
3. Close app immediately
4. Reopen app
5. Verify state was saved correctly

## Expected Console Output

### When Enabled (first toggle from disabled state):
```
[TOGGLE_UPDATES] Toggle updates triggered
[TOGGLE_UPDATES] Event emitted successfully
Updates enabled
[TOGGLE] Updates enabled
```

### When Disabled (toggling from enabled state):
```
[TOGGLE_UPDATES] Toggle updates triggered
[TOGGLE_UPDATES] Event emitted successfully
Updates disabled
[TOGGLE] Updates disabled
```

## Troubleshooting

### Shortcut Not Working
1. Check if shortcut was registered:
   - Look for "Registered shortcut: toggle_updates -> shift+backspace" in logs
2. Check for conflicts:
   - Look for "Failed to register toggle_updates shortcut" errors
3. Verify Tauri is capturing the shortcut:
   - Check Rust logs for "Shortcut triggered: toggle_updates"

### State Not Persisting
1. Check localStorage permissions
2. Verify `safeLocalStorage.setItem` is being called
3. Check browser console for localStorage errors

### Event Not Reaching Frontend
1. Check if event listener is registered (add console.log in useEffect)
2. Verify Tauri event emission is successful
3. Check for event name typos (must be exactly "toggle-updates")

## Success Criteria

✅ Pressing Shift+Backspace toggles the update state
✅ Console logs show clear enable/disable messages  
✅ State persists in localStorage
✅ State survives app restart
✅ No errors in console or Rust logs
✅ Multiple rapid toggles work correctly

## Next Steps After Testing

Once basic toggle works, you can:
1. Add a visual toast notification
2. Create a settings UI toggle
3. Implement actual update checking logic
4. Add update status indicator to the UI
5. Add keyboard shortcut help/hints in the app
