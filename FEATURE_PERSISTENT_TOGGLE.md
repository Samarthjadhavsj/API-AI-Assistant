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

### Option 1: Always-On-Top Mode (Recommended)
Make the window stay on top of other windows, so it's always visible.

**Pros**:
- Window always visible
- Easy to reference AI responses while working
- Works perfectly with your workflow

**Cons**:
- Might cover parts of the browser
- User needs to manually close with `Shift+\` when done

### Option 2: Manual Close Only
Window stays visible until user explicitly closes it with `Shift+\`.

**Pros**:
- Window doesn't hide automatically
- User has full control

**Cons**:
- Window might get lost behind other windows
- Need to use `Alt+Tab` to find it

### Option 3: Toggle Always-On-Top Setting
Add a user setting to choose the behavior.

---

## 🔧 Implementation

I'll implement **Option 1** (Always-On-Top) as the default, with the existing toggle in Settings to turn it off if needed.

### Changes Needed:

1. **Set `alwaysOnTop: true` by default** in `tauri.conf.json`
2. **Remove auto-hide on focus loss** (Windows behavior)
3. **Keep manual toggle working** (`Shift+\` to show/hide)

This way:
- Window stays visible when clicking browser ✅
- User can still hide it manually with `Shift+\` ✅
- User can disable always-on-top in Settings if they want ✅

---

## 📝 Files to Modify

1. `src-tauri/tauri.conf.json` - Set `alwaysOnTop: true`
2. `src-tauri/src/shortcuts.rs` - Remove auto-hide on focus loss (if any)

---

Ready to implement?
