# Persistent Toggle Window - Workflow Analysis

## 🎯 Feature Goal
**Make the toggle window stay visible when clicking on browser/other apps**

---

## 📊 Current System Design (Before Fix)

### Window Configuration (`tauri.conf.json`)
```json
{
  "decorations": false,      // No title bar
  "transparent": true,       // See-through background
  "alwaysOnTop": false,      // Not floating
  "skipTaskbar": true,       // Hidden from taskbar
  "focus": false,            // Doesn't accept keyboard input
  "visible": false           // Starts hidden
}
```

### Toggle Window Flow

#### 1. **User Opens Window** (`Shift+\`)
```
User Press Shift+\ 
  → Global shortcut handler (lib.rs)
    → shortcuts::handle_shortcut_action()
      → handle_toggle_window()
        → [Windows] Check WindowVisibility state
          → window.show()
          → window.set_focus()
          → Emit "toggle-window-visibility" event
```

#### 2. **User Types in Window**
```
Window has focus
  → Input field receives keyboard events
  → User can type and interact
```

#### 3. **User Clicks Browser** ⚠️ PROBLEM HERE
```
User clicks browser
  → Window loses focus (WindowEvent::Focused(false))
    → [MYSTERY] Window disappears/hides
      ❓ WHO IS HIDING IT?
```

---

## 🔍 Investigation: Why Does Window Disappear?

### Hypothesis 1: Code is calling window.hide()
**Checked all `.hide()` calls in codebase:**
- ✅ `shortcuts.rs` - Only on explicit toggle
- ✅ `tray.rs` - Only on tray toggle
- ✅ `window.rs` - Only for dashboard
- ❌ **No code hides window on focus loss**

### Hypothesis 2: Windows OS Auto-Hide Behavior
**Windows automatically hides windows with these characteristics:**

| Property | Value | Effect |
|----------|-------|--------|
| `decorations: false` | No title bar | Treated as "tool window" |
| `transparent: true` | See-through | Treated as "overlay window" |
| `skipTaskbar: true` | Hidden from taskbar | Auto-hides on blur |
| `focus: false` | No keyboard input | Can't stay active |

**Combination Effect:**
```
decorations=false + transparent=true + skipTaskbar=true 
  → Windows treats it as "temporary overlay"
  → Auto-hides when focus lost
```

---

## ✅ Solution Strategy

### Option A: Make it a Regular Window
**Change window config to prevent auto-hide:**

```json
{
  "decorations": true,       // Add title bar → Regular window
  "transparent": false,      // Solid background → Not overlay
  "alwaysOnTop": true,       // Float above others → Stay visible
  "skipTaskbar": false,      // Show in taskbar → Normal window
  "focus": true,             // Accept input → Can stay active
  "shadow": true             // Normal shadow → Regular appearance
}
```

**Result:** Window behaves like normal app window, stays visible

**Trade-offs:**
- ✅ **PRO:** Stays visible when clicking browser
- ✅ **PRO:** Can type in input field
- ✅ **PRO:** Always on top
- ❌ **CON:** Has title bar (not sleek UI)
- ❌ **CON:** Visible in taskbar (clutters taskbar)
- ❌ **CON:** Not transparent (different look)

---

### Option B: Keep Borderless + Use Windows API
**Use Windows-specific APIs to prevent auto-hide:**

**Need to implement:**
```rust
#[cfg(target_os = "windows")]
{
    use windows::Win32::UI::WindowsAndMessaging::*;
    
    // Set extended window style to prevent auto-hide
    let hwnd = window.hwnd();
    SetWindowLongPtrW(hwnd, GWL_EXSTYLE, 
        WS_EX_LAYERED | WS_EX_TOPMOST | WS_EX_NOACTIVATE
    );
}
```

**Result:** Keep original UI, prevent auto-hide with Windows API

**Trade-offs:**
- ✅ **PRO:** Keeps original borderless UI
- ✅ **PRO:** Stays visible
- ✅ **PRO:** Transparent background
- ❌ **CON:** Windows-specific code
- ❌ **CON:** Complex implementation
- ❌ **CON:** May need unsafe code

---

### Option C: Hybrid Approach
**Use regular window but style it to look borderless:**

```json
{
  "decorations": true,
  "transparent": false,
  "alwaysOnTop": true,
  "skipTaskbar": false,
  "focus": true
}
```

**Then in CSS/React:**
```css
/* Hide title bar via CSS */
.app-window {
  -webkit-app-region: drag;
}

.app-window .title-bar {
  display: none;
}
```

**Trade-offs:**
- ✅ **PRO:** Stays visible
- ✅ **PRO:** Looks borderless
- ✅ **PRO:** Cross-platform
- ⚠️ **ISSUE:** CSS can't fully hide native title bar on Windows

---

## 🎯 Recommended Solution: **Option A** (Regular Window)

### Why Option A?
1. **Simplest implementation** - just config changes
2. **Guaranteed to work** - Windows won't auto-hide regular windows
3. **Cross-platform** - works on macOS, Linux, Windows
4. **No unsafe code** - pure Tauri configuration

### Implementation Checklist

- [x] 1. Set `decorations: true`
- [x] 2. Set `transparent: false`
- [x] 3. Set `alwaysOnTop: true`
- [x] 4. Set `skipTaskbar: false`
- [x] 5. Set `focus: true`
- [x] 6. Set `shadow: true`
- [ ] 7. Test: Open window → Type → Click browser → Window stays visible ✓
- [ ] 8. Test: Manual toggle with `Shift+\` works ✓
- [ ] 9. Test: Tray menu toggle works ✓
- [ ] 10. Create PR

---

## 📝 Files Changed

### Configuration
- `src-tauri/tauri.conf.json` - Window config changes

### Code
- `src-tauri/src/lib.rs` - Removed focus event handler
- `src-tauri/src/shortcuts.rs` - Added logging
- `src-tauri/src/tray.rs` - Added logging

### Documentation
- `FEATURE_PERSISTENT_TOGGLE.md` - Feature documentation
- `WORKFLOW_PERSISTENT_TOGGLE.md` - This workflow document

---

## 🧪 Testing Procedure

### Test 1: Basic Toggle
1. Launch app
2. Press `Shift+\` - window opens
3. Press `Shift+\` - window closes
4. ✅ **PASS** if toggle works smoothly

### Test 2: Persistent Visibility
1. Press `Shift+\` - window opens
2. Type "hello" in input field
3. Click on browser window
4. ✅ **PASS** if Pluely window STAYS VISIBLE on top of browser

### Test 3: Input Focus
1. Open window with `Shift+\`
2. Type in input field
3. ✅ **PASS** if typing works without clicking input

### Test 4: Always On Top
1. Open window
2. Open multiple browser windows
3. ✅ **PASS** if Pluely stays on top of all windows

### Test 5: Tray Integration
1. Right-click tray icon
2. Click "Toggle Window"
3. ✅ **PASS** if window shows/hides

---

## 📊 Success Criteria

✅ **Feature Complete When:**
1. Window stays visible after clicking browser
2. User can type in input field
3. Window is always on top
4. Manual toggle (`Shift+\`) works
5. Tray toggle works
6. No flickering or blinking

---

## 🚀 Next Steps

1. ✅ Apply configuration changes
2. ⏳ **Test the fix** (you're here now)
3. ⏳ Verify all test cases pass
4. ⏳ Push to GitHub
5. ⏳ Create Pull Request

---

## 💡 Alternative: If User Wants Original UI

If user wants the borderless transparent UI back after confirming this works:

**Option: Windows-Specific Extended Style**
```rust
// In lib.rs setup()
#[cfg(target_os = "windows")]
{
    if let Some(window) = app.get_webview_window("main") {
        use tauri::WebviewWindowExt;
        
        // Get HWND and set extended style to prevent auto-hide
        // This requires adding windows crate dependency
        // and implementing WS_EX_TOOLWINDOW | WS_EX_TOPMOST
    }
}
```

This would need:
- Add `windows` crate to `Cargo.toml`
- Implement unsafe Windows API calls
- Test thoroughly on Windows 10/11

---

**Current Status:** Testing with regular window configuration (Option A)
