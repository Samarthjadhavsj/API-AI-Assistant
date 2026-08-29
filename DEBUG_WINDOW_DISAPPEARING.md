# 🐛 CRITICAL BUG: Window Disappears When Clicking Outside

## ⚠️ PROBLEM STATEMENT

**Symptom:** 
The main application window disappears/hides when user clicks on browser or any other application, even though it should remain visible.

**Expected Behavior:**
Window should STAY VISIBLE and remain on top when user clicks outside (browser, other apps)

**Actual Behavior:**
Window immediately disappears/becomes invisible when focus is lost

---

## 🎯 What We're Trying to Fix

**Goal:** Make the toggle window persistent - it should stay visible even when user interacts with other applications.

**Use Case:**
1. User presses `Shift+\` to open AI assistant window
2. User types a question and gets an answer
3. User clicks on browser to reference the answer while browsing
4. **BUG:** Window disappears instead of staying visible
5. **WANTED:** Window should remain visible and on top

---

## 🔧 Technical Environment

### Platform
- **OS:** Windows 11
- **Framework:** Tauri 2.x (Rust + React)
- **Frontend:** React + TypeScript
- **Backend:** Rust

### Current Window Configuration
```json
// src-tauri/tauri.conf.json
{
  "title": "Pluely - AI Assistant",
  "width": 600,
  "height": 54,
  "decorations": true,         // ✅ Changed from false
  "transparent": false,        // ✅ Changed from true
  "alwaysOnTop": true,         // ✅ Changed from false
  "resizable": false,
  "visibleOnAllWorkspaces": true,
  "skipTaskbar": false,        // ✅ Changed from true
  "visible": false,
  "center": false,
  "contentProtected": true,
  "focus": true,               // ✅ Changed from false
  "acceptFirstMouse": true,
  "shadow": true               // ✅ Changed from false
}
```

---

## 📊 Complete Code Flow

### 1. Window Toggle Shortcut Handler

**File:** `src-tauri/src/shortcuts.rs`

```rust
// Line ~189
fn handle_toggle_window<R: Runtime>(app: &AppHandle<R>) {
    let Some(window) = app.get_webview_window("main") else {
        return;
    };

    #[cfg(target_os = "windows")]
    {
        let is_visible = window.is_visible().unwrap_or(false);

        if is_visible {
            println!("[TOGGLE] Hiding window (user requested)");
            if let Err(e) = window.hide() {
                eprintln!("Failed to hide window: {}", e);
            }
        } else {
            println!("[TOGGLE] Showing window (user requested)");
            if let Err(e) = window.show() {
                eprintln!("Failed to show window: {}", e);
            }
            if let Err(e) = window.set_focus() {
                eprintln!("Failed to focus window: {}", e);
            }
            if let Err(e) = window.emit("focus-text-input", json!({})) {
                eprintln!("Failed to emit focus-text-input event: {}", e);
            }
        }
        
        if let Err(e) = window.emit("toggle-window-visibility", ()) {
            eprintln!("Failed to emit toggle-window-visibility event: {}", e);
        }
        
        return;
    }

    // macOS/Linux code...
}
```

### 2. Window Setup

**File:** `src-tauri/src/lib.rs`

```rust
// Line ~118-130
.setup(|app| {
    // Setup system tray
    if let Err(e) = tray::setup_system_tray(app.handle()) {
        eprintln!("Failed to setup system tray: {}", e);
    }
    
    // Setup main window positioning and configure for persistence
    window::setup_main_window(app).expect("Failed to setup main window");
    
    // Configure window to stay visible (Windows)
    #[cfg(target_os = "windows")]
    {
        if let Some(main_window) = app.get_webview_window("main") {
            // Ensure window stays always on top
            let _ = main_window.set_always_on_top(true);
            println!("Configured window for persistent visibility (always-on-top)");
        }
    }
    
    // ... rest of setup
})
```

### 3. Frontend Event Handler

**File:** `src/hooks/useApp.ts`

```typescript
// Line ~75-102
useEffect(() => {
  const unlistenPromise = listen(
    "toggle-window-visibility",
    () => {
      const platform = navigator.platform.toLowerCase();
      if (platform.includes("win")) {
        // Close any open popovers when toggling
        const popover = document.getElementById("popover-content");
        if (popover) {
          popover.style.setProperty("display", "none", "important");
          popover.setAttribute("data-state", "closed");

          const popoverTriggers = document.querySelectorAll(
            '[data-slot="popover-trigger"]'
          );
          popoverTriggers.forEach((trigger) => {
            trigger.setAttribute("data-state", "closed");
          });
        }
      }
    }
  );

  return () => {
    unlistenPromise.then((unlisten) => unlisten());
  };
}, []);
```

### 4. App Component (NO UI-level hiding)

**File:** `src/pages/app/index.tsx`

```typescript
// Line ~38-41
<div className="w-screen h-screen flex overflow-hidden justify-center items-start">
  <Card className="w-full flex flex-row items-center gap-2 p-2">
    {/* ... content ... */}
  </Card>
</div>
```

**Note:** Previously had `isHidden ? "hidden pointer-events-none" : ""` but we removed it.

---

## 🔍 What We've Tried (All Failed)

### ❌ Attempt 1: Set `alwaysOnTop: true`
**Result:** Window still disappears

### ❌ Attempt 2: Remove transparent + Set `skipTaskbar: false`
**Result:** Window still disappears

### ❌ Attempt 3: Add window focus event handler to re-show on blur
```rust
main_window.on_window_event(move |event| {
    match event {
        tauri::WindowEvent::Focused(false) => {
            let _ = window_for_event.show();
        }
        _ => {}
    }
});
```
**Result:** Infinite loop, still disappears

### ❌ Attempt 4: Enable decorations (title bar) + shadow
**Result:** Window STILL disappears (current state)

### ❌ Attempt 5: Change `focus: true`
**Result:** Window STILL disappears

---

## 🔎 Debugging Evidence

### Terminal Output When Bug Occurs:
```
Shortcut triggered: toggle_window
[TOGGLE] Showing window (user requested)
Configured window for persistent visibility (always-on-top)
[User clicks browser - NO LOG APPEARS]
[Window disappears - NO "[TOGGLE] Hiding window" log]
```

**Key Observation:** 
- NO Rust code calls `window.hide()` when clicking browser
- NO JavaScript code hides the window
- Window disappears WITHOUT any log entry
- This suggests **Windows OS is auto-hiding it at the system level**

### All `.hide()` Calls in Codebase:
1. `src-tauri/src/shortcuts.rs:203` - Only when `is_visible == true` (manual toggle)
2. `src-tauri/src/shortcuts.rs:236` - macOS only
3. `src-tauri/src/shortcuts.rs:239` - macOS/Linux only  
4. `src-tauri/src/tray.rs:76` - Only on tray toggle when visible
5. `src-tauri/src/window.rs:113` - Dashboard only

**None of these are triggered when clicking outside the window.**

---

## 💡 Root Cause Hypothesis

**Theory:** Windows is treating this window as a special type that auto-minimizes/hides on blur, despite our configuration.

**Possible Reasons:**
1. Window style flags at Win32 API level
2. Tauri's WebView implementation has default blur behavior
3. Window manager treating frameless/tool windows specially
4. Extended window styles (WS_EX_*) not properly set

---

## 🎯 What We Need

### Question for Advanced Model:

**"How do we prevent a Tauri 2.x window on Windows from auto-hiding when it loses focus, even with these settings?"**

```json
{
  "decorations": true,
  "transparent": false,
  "alwaysOnTop": true,
  "skipTaskbar": false,
  "focus": true,
  "shadow": true
}
```

### Specific Technical Requirements:

1. **Window must remain visible** when user clicks other apps
2. **Window must stay on top** of all other windows
3. **Window must accept keyboard input** for typing
4. **No flickering or blinking**
5. **Cross-platform compatible** (or Windows-specific solution is ok)

### What Solutions to Consider:

1. **Win32 API Extended Styles**
   - Should we set `WS_EX_TOOLWINDOW`?
   - Should we set `WS_EX_NOACTIVATE`?
   - Should we set `WS_EX_LAYERED`?

2. **Tauri Window Methods**
   - Is there a `.set_skip_taskbar()` override?
   - Is there a `.set_decorations()` runtime call?
   - Is there a window event we're not handling?

3. **WebView Behavior**
   - Does WebView2 have auto-hide on blur?
   - Can we override WebView blur behavior?

4. **Window Positioning**
   - Does `Z-order` need explicit setting?
   - Should we use `SetWindowPos` with `HWND_TOPMOST`?

---

## 📁 Full File Listing

### Rust Files (Backend)
```
src-tauri/
├── Cargo.toml                 // Dependencies
├── tauri.conf.json            // Window configuration
└── src/
    ├── lib.rs                 // Main app setup + window init
    ├── window.rs              // Window creation and management
    ├── shortcuts.rs           // Keyboard shortcuts + toggle handler
    ├── tray.rs                // System tray menu
    ├── capture.rs             // Screenshot functionality
    └── api.rs                 // API handlers
```

### TypeScript Files (Frontend)
```
src/
├── hooks/
│   └── useApp.ts              // Window visibility event handler
├── pages/
│   └── app/
│       └── index.tsx          // Main app component
└── contexts/
    └── app.context.tsx        // App-level state management
```

---

## 🔧 Code to Review

### Key Areas to Investigate:

1. **Window Initialization** (`lib.rs` line 118-150)
2. **Toggle Handler** (`shortcuts.rs` line 189-223)
3. **Window Setup** (`window.rs` line 9-28)
4. **Frontend Event Handler** (`useApp.ts` line 75-102)

### Questions to Answer:

1. Why does Tauri window disappear on blur despite `alwaysOnTop: true`?
2. Is there a Tauri window event we should prevent/handle?
3. Should we use raw Win32 API through `windows-rs` crate?
4. Is WebView2 control hiding itself on blur?
5. Does Tauri have a built-in behavior we need to override?

---

## 💻 Dependencies

```toml
# Cargo.toml
[dependencies]
tauri = { version = "2", features = ["macos-private-api", "tray-icon"] }
tauri-plugin-global-shortcut = "2"
# ... other plugins
```

---

## 🚀 What We're Looking For

**The ideal solution should:**

✅ Keep window visible when clicking outside
✅ Allow keyboard input
✅ Stay on top of other windows
✅ Not flicker or blink
✅ Work with Tauri 2.x on Windows

**Acceptable solutions:**
1. Configuration-only fix (best)
2. Rust code changes using Tauri APIs
3. Windows-specific Win32 API calls (acceptable)
4. Combination of above

**Not acceptable:**
- JavaScript workarounds (doesn't solve root cause)
- Polling/checking window visibility repeatedly (performance issue)
- Disabling always-on-top (defeats purpose)

---

## 📊 Success Criteria

**Test Case:**
1. Launch app
2. Press `Shift+\` - window opens
3. Type "hello" - input works
4. Click browser window
5. ✅ **PASS:** Pluely window stays visible and on top
6. ❌ **FAIL:** Window disappears

**Current Status:** ❌ **FAIL** - Window disappears at step 4

---

## 🙋 Questions for Advanced Model

1. **What causes Tauri windows to auto-hide on Windows when focus is lost?**

2. **How do we prevent this at the Tauri configuration level?**

3. **If configuration isn't enough, what Win32 API calls do we need?**

4. **Is there a Tauri window event or method we're missing?**

5. **Has anyone solved this in Tauri 2.x? Any known workarounds?**

---

## 📝 Additional Context

- App works perfectly when window has focus
- Toggle keyboard shortcut works
- Tray icon toggle works
- ONLY issue: window disappears when clicking outside
- This is Windows-specific (macOS has different implementation using NSPanel)

---

**Please provide a detailed solution with code examples for Tauri 2.x on Windows.**
