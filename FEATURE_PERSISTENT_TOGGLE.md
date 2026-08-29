# Persistent Toggle Window Feature

## Branch: `feature/persistent-toggle-window`

This feature prevents the toggle window from auto-hiding when you click outside (e.g., clicking on a browser).

---

## 🎯 Problem

**Current Behavior** ❌:
1. User opens toggle with `Shift+\`
2. User types a question and gets an answer
3. User clicks on browser/webpage
4. **Toggle window disappears** (auto-hides)

**Desired Behavior** ✅:
1. User opens toggle with `Shift+\`
2. User types a question and gets an answer
3. User clicks on browser/webpage  
4. **Toggle window stays visible** (remains on screen)

---

## 📋 Solution

**Approach**: Set window to always-on-top + ensure window only hides on explicit `Shift+\` press, not on focus loss.

### Changes Made:

1. **`tauri.conf.json`**:
   - Set `alwaysOnTop: true` (window stays on top of other apps)

2. **`shortcuts.rs`** (Windows-specific):
   - Added explicit `window.hide()` call when user presses `Shift+\` to hide
   - Window only hides when explicitly toggled, not when losing focus

---

## 🔧 Technical Details

### Before:
- Window had `alwaysOnTop: false`
- On Windows, when toggle pressed, it would emit event but not explicitly hide
- Window would disappear when clicking outside (auto-hide behavior)

### After:
- Window has `alwaysOnTop: true`
- On Windows, when toggle pressed to hide, explicitly calls `window.hide()`
- Window stays visible when clicking other apps
- Only hides when user presses `Shift+\` again

---

## 🧪 Testing Plan

### Build & Test:
1. Stop current dev server
2. Build the app: `npm run tauri dev`
3. Test the feature:
   - Press `Shift+\` - window should open
   - Type "hello" and get response
   - Click on browser window
   - ✅ **Pluely window should stay visible on top!**
   - Press `Shift+\` again - window should hide
   - Press `Shift+\` again - window should show

### Push to GitHub:
1. `git add -A`
2. `git commit -m "feat: persistent toggle window"`
3. `git push origin feature/persistent-toggle-window`
4. Create PR on GitHub

---

##  Files Modified

1. `src-tauri/tauri.conf.json` - Set always-on-top to true
2. `src-tauri/src/shortcuts.rs` - Added explicit hide() call for Windows
3. `FEATURE_PERSISTENT_TOGGLE.md` - This documentation

---

Ready to build and test! 🚀
