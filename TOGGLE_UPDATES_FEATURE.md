# Toggle Updates Feature - Implementation Summary

## Overview
Added a new global shortcut **Shift+Backspace** that toggles update notifications on/off.

## Changes Made

### 1. Frontend Configuration (`src/config/shortcuts.ts`)
- Added new shortcut action `toggle_updates` with default key `shift+backspace` for all platforms (macOS, Windows, Linux)
- This registers the shortcut in the default shortcuts configuration

### 2. Backend Handler (`src-tauri/src/shortcuts.rs`)
- Added `handle_toggle_updates()` function that:
  - Gets the main window
  - Emits a `toggle-updates` event to the frontend
  - Includes debug logging
- Updated `handle_shortcut_action()` to route "toggle_updates" actions to the new handler

### 3. Frontend Hook (`src/hooks/useApp.ts`)
- Added `updatesEnabled` state that:
  - Initializes from localStorage (defaults to `true`)
  - Persists state changes to localStorage
- Added event listener for `toggle-updates` event from Rust backend
- Returns `updatesEnabled` and `setUpdatesEnabled` for use in components
- Includes console logging for debugging

## How It Works

1. **User presses Shift+Backspace** → Global shortcut is captured by Tauri
2. **Rust backend** (`shortcuts.rs`) → Handles the shortcut and emits `toggle-updates` event
3. **Frontend** (`useApp.ts`) → Listens for the event and toggles the state
4. **State persisted** → Saved to localStorage as `updates_enabled`
5. **Console feedback** → Logs whether updates are enabled or disabled

## Usage

### In Components
```typescript
import { useApp } from "@/hooks/useApp";

function YourComponent() {
  const { updatesEnabled, setUpdatesEnabled } = useApp();
  
  // Use updatesEnabled to control update notifications
  if (updatesEnabled) {
    // Show updates
  }
  
  // Or manually toggle
  setUpdatesEnabled(!updatesEnabled);
}
```

### Keyboard Shortcut
- Press **Shift+Backspace** to toggle updates on/off
- State is automatically saved and persists across app restarts

## Testing

1. Build the application
2. Press **Shift+Backspace**
3. Check the console for: `[TOGGLE] Updates enabled` or `[TOGGLE] Updates disabled`
4. Verify localStorage has `updates_enabled` set to `"true"` or `"false"`
5. Restart the app and verify the state persists

## Future Enhancements

- Add visual toast notification when toggling (currently only console logs)
- Add UI indicator showing current update status
- Add settings panel option to toggle updates manually
- Implement actual update checking logic that respects this flag

## Files Modified

1. `src/config/shortcuts.ts` - Added shortcut configuration
2. `src-tauri/src/shortcuts.rs` - Added backend handler
3. `src/hooks/useApp.ts` - Added state management and event listener
