# Shift+Backspace Window Visibility Bug Fix Verification

## Bug Summary
- **Symptom**: Shift+Backspace toggle reported window as visible (is_visible=true, correct position/size, no z-order blockers) but window never actually appeared on screen
- **Root cause**: tauri.conf.json had "decorations" and/or "transparent"/"contentProtected" settings drift from their correct values during debugging, causing the native window styling to mismatch what the overlay design expects
- **Fix**: Restored decorations: false, transparent: true, contentProtected: true in tauri.conf.json

## Verified working config (src-tauri/tauri.conf.json)
- decorations: false
- transparent: true
- contentProtected: true

## Verification log (toggle cycle)
```
[TOGGLE] handle_toggle_window() entered
[TOGGLE] BEFORE: user_hidden=true, is_visible=false
[TOGGLE] Setting user_hidden to false, now: false
[DEBUG] Style BEFORE show(): 0x4CB0000, ExStyle BEFORE show(): 0x40118
[TOGGLE] Called window.show(), result: Ok(()), is_visible after: true
[DEBUG] Position: Ok(PhysicalPosition { x: 493, y: 36 }), Size: Ok(PhysicalSize { width: 900, height: 81 })
[DEBUG] Available monitors: Ok([Monitor { name: Some("\\\\.\\DISPLAY1"), size: PhysicalSize { width: 1920, height: 1080 }, position: PhysicalPosition { x: 0, y: 0 }, work_area: PhysicalRect { position: PhysicalPosition { x: 0, y: 0 }, size: PhysicalSize { width: 1920, height: 1008 } }, scale_factor: 1.5 }])
[DEBUG] Current monitor: Ok(Some(Monitor { name: Some("\\\\.\\DISPLAY1"), size: PhysicalSize { width: 1920, height: 1080 }, position: PhysicalPosition { x: 0, y: 0 }, work_area: PhysicalRect { position: PhysicalPosition { x: 0, y: 0 }, size: PhysicalSize { width: 1920, height: 1008 } }, scale_factor: 1.5 }])
[DEBUG] Style: 0x14CB0000, ExStyle: 0x40118
[DEBUG] Window above in z-order: HWND(Ok(HWND(0x70496)))
[DEBUG] Covering window title: "Default IME", class: "IME"
[TOGGLE] Called set_always_on_top(true), result: Ok(()), is_visible after: true
[TOGGLE] AFTER: user_hidden=false, is_visible=true

[HOTKEY] WM_HOTKEY received (Shift+Backspace) on hidden HWND, about to toggle window
[HOTKEY] Spawning async task to call handle_toggle_window
[TOGGLE] handle_toggle_window() entered
[TOGGLE] BEFORE: user_hidden=false, is_visible=true
[TOGGLE] Window is visible, attempting to hide it
[TOGGLE] Set user_hidden to true, now: true
[TOGGLE] Called window.hide(), result: Ok(()), is_visible after: false
[TOGGLE] AFTER: user_hidden=true, is_visible=false

[FOCUS LOST] Event fired. user_hidden=true, is_visible=false
[FOCUS LOST] User hid window (user_hidden=true), NOT restoring

[HOTKEY] WM_HOTKEY received (Shift+Backspace) on hidden HWND, about to toggle window
[HOTKEY] Spawning async task to call handle_toggle_window
[TOGGLE] handle_toggle_window() entered
[TOGGLE] BEFORE: user_hidden=true, is_visible=false
[TOGGLE] Setting user_hidden to false, now: false
[DEBUG] Style BEFORE show(): 0x4CB0000, ExStyle BEFORE show(): 0x40118
[TOGGLE] Called window.show(), result: Ok(()), is_visible after: true
[DEBUG] Position: Ok(PhysicalPosition { x: 493, y: 36 }), Size: Ok(PhysicalSize { width: 900, height: 81 })
[DEBUG] Available monitors: Ok([Monitor { name: Some("\\\\.\\DISPLAY1"), size: PhysicalSize { width: 1920, height: 1080 }, position: PhysicalPosition { x: 0, y: 0 }, work_area: PhysicalRect { position: PhysicalPosition { x: 0, y: 0 }, size: PhysicalSize { width: 1920, height: 1008 } }, scale_factor: 1.5 }])
[DEBUG] Current monitor: Ok(Some(Monitor { name: Some("\\\\.\\DISPLAY1"), size: PhysicalSize { width: 1920, height: 1080 }, position: PhysicalPosition { x: 0, y: 0 }, work_area: PhysicalRect { position: PhysicalPosition { x: 0, y: 0 }, size: PhysicalSize { width: 1920, height: 1008 } }, scale_factor: 1.5 }])
[DEBUG] Style: 0x14CB0000, ExStyle: 0x40118
[DEBUG] Window above in z-order: HWND(Ok(HWND(0x70496)))
[DEBUG] Covering window title: "Default IME", class: "IME"
[TOGGLE] Called set_always_on_top(true), result: Ok(()), is_visible after: true
[TOGGLE] AFTER: user_hidden=false, is_visible=true
```

## Debugging approach that found it
- Added temporary eprintln! logging at every show/hide call site, window event handler, and Win32 style read (GetWindowLongW/GWL_STYLE/GWL_EXSTYLE)
- Confirmed toggle logic (user_hidden state, hide()/show() calls) was correct throughout
- Ruled out: race conditions, focus-loss auto-restore conflicts, z-order blocking, layered window alpha issues, dev-vs-production build differences
- Isolated the actual cause by comparing config against tauri.conf.json's committed values after diagnostic changes had accumulated

## Note for future debugging
If this bug recurs, check tauri.conf.json's decorations/transparent/contentProtected values FIRST before assuming it's a Rust-side logic bug — this cost significant time because the Rust toggle logic was actually correct the whole time.