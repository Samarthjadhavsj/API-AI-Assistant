# Fix: Persistent Toggle Window on Windows

## Problem
Window disappeared when user clicked outside (browser/other apps), despite `alwaysOnTop: true` configuration.

## Root Cause
Windows activation model race condition: `window.show()` + `window.set_focus()` triggered rapid focus events causing window to be demoted in z-order when user clicked outside.

## Solution
Implemented Win32 overlay window style using `WS_EX_NOACTIVATE` and `WS_EX_TOOLWINDOW`:

1. **WS_EX_NOACTIVATE** - Window doesn't participate in OS activation lifecycle
2. **WS_EX_TOOLWINDOW** - Removes from Alt+Tab list  
3. **OverlayState** - Tracks user-intentional hide to prevent safety net conflicts
4. **Delayed focus** - 30ms delay prevents race condition
5. **Safety net handler** - Re-shows window on unexpected focus loss

## Changes

### New Dependencies
- `windows = "0.58"` with Win32 API features

### Modified Files
- `src-tauri/Cargo.toml` - Added windows crate
- `src-tauri/src/lib.rs` - Win32 overlay style application + focus event handler
- `src-tauri/src/shortcuts.rs` - OverlayState + delayed focus in toggle handler

### Key Code
```rust
#[cfg(target_os = "windows")]
fn apply_overlay_style(hwnd: HWND) {
    unsafe {
        let ex_style = GetWindowLongPtrW(hwnd, GWL_EXSTYLE);
        let new_style = ex_style
            | WS_EX_NOACTIVATE.0 as isize
            | WS_EX_TOOLWINDOW.0 as isize;
        SetWindowLongPtrW(hwnd, GWL_EXSTYLE, new_style);
        SetWindowPos(hwnd, HWND_TOPMOST, 0, 0, 0, 0, 
            SWP_NOMOVE | SWP_NOSIZE | SWP_SHOWWINDOW);
    }
}
```

## Testing

✅ **Before Fix:**
1. Press `Shift+\` → Window opens
2. Click browser → Window disappears ❌

✅ **After Fix:**
1. Press `Shift+\` → Window opens
2. Click browser → Window stays visible ✅
3. Window remains on top of all apps ✅
4. Typing works correctly ✅
5. Manual toggle with `Shift+\` works ✅

## Platform
- Windows 11
- Tauri 2.x
- Cross-platform compatible (Windows-specific fix)

## Related Issues
Fixes window disappearing on focus loss for overlay/launcher-style applications.
