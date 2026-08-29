# Testing Guide for API AI Assistant

## 📋 Overview
This guide explains how to test the app and every new feature you add.

---

## 🧪 Testing Strategy

### 1. **Local Development Testing** (Every Code Change)
Test changes immediately during development.

```bash
# Start development mode with hot-reload
npm run tauri dev
```

**What this does:**
- Compiles React frontend + Rust backend
- Opens the desktop app
- Auto-reloads on file changes
- Shows console logs and errors

**When to use:** Testing UI changes, new React components, API integrations

---

### 2. **Production Build Testing** (Before Push/Release)
Test the actual compiled app that users will download.

```bash
# Build production version
npm run tauri build
```

**Output locations:**
- **Windows:** `src-tauri/target/release/bundle/msi/` or `nsis/`
- **Installer:** `.msi` or `.exe` files

**When to use:** Before pushing to GitHub, before creating releases

**What to test:**
- Install the `.msi` file
- Run the installed app
- Test all features work in production mode
- Check performance (production is faster than dev)

---

### 3. **Feature-Specific Testing Checklist**

#### Testing UI Components
```bash
npm run tauri dev
```

**Check:**
- ✅ Component renders correctly
- ✅ Responsive design (resize window)
- ✅ Dark/light theme support
- ✅ Keyboard shortcuts work
- ✅ Mouse interactions work
- ✅ No console errors

#### Testing Rust Backend Features
```bash
# Run Rust tests
cd src-tauri
cargo test
```

**Check:**
- ✅ All tests pass
- ✅ No compilation warnings
- ✅ Functions return expected values

#### Testing AI Provider Integration
**Manual Testing:**
1. Start dev mode: `npm run tauri dev`
2. Go to "Dev Space" in app
3. Configure test API key
4. Send test message
5. Verify response

**Check:**
- ✅ API key stored securely
- ✅ Requests sent correctly
- ✅ Responses displayed properly
- ✅ Error handling works

#### Testing Shortcuts & System Integration
**Manual Testing:**
1. Build and install production app
2. Test global shortcuts (Ctrl+Shift+D, etc.)
3. Test stealth mode
4. Test system audio capture
5. Test screenshot functionality

**Check:**
- ✅ Shortcuts work system-wide
- ✅ App appears/disappears correctly
- ✅ Transparent overlay works
- ✅ Permissions requested properly

---

## 🔄 Testing Workflow for New Features

### **Step-by-Step Process:**

#### **1. Create Feature Branch**
```bash
git checkout -b feature/feature-name
```

#### **2. Develop & Test Locally**
```bash
# Start development
npm run tauri dev

# Keep this running, make changes, test immediately
```

**Test checklist:**
- [ ] Feature works as expected
- [ ] No errors in browser console (F12)
- [ ] No errors in Rust console
- [ ] UI looks good
- [ ] Edge cases handled

#### **3. Type Check (TypeScript)**
```bash
# Check for TypeScript errors
npm run build
```

**If errors:** Fix them before committing

#### **4. Build Production Version**
```bash
npm run tauri build
```

**If build fails:** Fix compilation errors

**If build succeeds:** Test the installer

#### **5. Test Production Build**
```bash
# Install the built app from:
# src-tauri/target/release/bundle/msi/

# Run installed app and test:
```
- [ ] Feature works in production
- [ ] Performance is good
- [ ] No crashes or freezes

#### **6. Commit Changes**
```bash
git add .
git commit -m "feat: Add [feature name]"
```

#### **7. Push to GitHub**
```bash
git push -u origin feature/feature-name
```

#### **8. Create Pull Request**
On GitHub, create PR from your feature branch to `main`

---

## 🧩 Testing Different Types of Features

### **Frontend (React/TypeScript) Features**

**Example:** Adding a new settings toggle

```bash
npm run tauri dev
```

**Test:**
1. Toggle the switch
2. Check if state updates
3. Check if setting persists (close/reopen app)
4. Check console for errors

### **Backend (Rust) Features**

**Example:** Adding a new Tauri command

```bash
cd src-tauri
cargo test  # Run tests

# Then test in dev mode
cd ..
npm run tauri dev
```

**Test:**
1. Call the command from frontend
2. Verify return value
3. Check error handling
4. Check performance

### **Database Features**

**Example:** Adding a new table/query

```bash
npm run tauri dev
```

**Test:**
1. Check if migrations run
2. Test CRUD operations (Create, Read, Update, Delete)
3. Check data persistence
4. Test with large datasets

**Database location:**
- Development: Check console for path
- Production: `%APPDATA%/[app-name]/`

### **Integration Features**

**Example:** New AI provider or STT service

**Manual Testing Required:**
1. Get API key from provider
2. Configure in Dev Space
3. Test with various inputs
4. Test error scenarios (invalid key, network issues)
5. Test rate limiting
6. Test large responses

---

## 🐛 Debugging Guide

### **Frontend Debugging**

```bash
npm run tauri dev
# Then press F12 in the app window
```

**Check:**
- Console tab: JavaScript errors
- Network tab: API calls
- React DevTools: Component state

### **Backend Debugging**

```bash
# Add debug prints in Rust code
println!("Debug: {:?}", variable);

# Then run
npm run tauri dev
# Check terminal output
```

### **Database Debugging**

**View database:**
- Install SQLite browser
- Open database file from app data folder
- Inspect tables and data

---

## ✅ Pre-Push Checklist

Before pushing ANY code to GitHub:

- [ ] `npm run tauri dev` works without errors
- [ ] `npm run build` completes successfully
- [ ] `npm run tauri build` creates installer
- [ ] Installed app runs correctly
- [ ] All features work in production build
- [ ] No console errors
- [ ] Code is formatted properly
- [ ] Commit message is clear

---

## 🚀 Testing for Different Environments

### **Windows Testing** (Your Current OS)
```bash
npm run tauri build
```
Test the `.msi` installer

### **Cross-Platform Testing** (Future)
**Note:** Building for Mac/Linux from Windows requires:
- GitHub Actions CI/CD
- Or virtual machines
- Or separate hardware

**For now:** Test only on Windows

---

## 📊 Performance Testing

### **Check App Size**
```bash
npm run tauri build

# Check installer size in:
# src-tauri/target/release/bundle/msi/
```

**Target:** Keep under 15MB

### **Check Startup Time**
1. Close app completely
2. Launch app
3. Time until UI is interactive

**Target:** Under 2 seconds

### **Check Memory Usage**
1. Open Task Manager
2. Find your app
3. Monitor memory usage

**Target:** Under 200MB idle

---

## 🎯 Test Coverage Goals

**Must Test:**
- ✅ All user-facing features
- ✅ Error scenarios
- ✅ Edge cases

**Optional (Advanced):**
- Automated unit tests (Jest/Vitest)
- Integration tests
- E2E tests (Playwright/Cypress)

---

## 📝 Testing Template

Create a test log for each feature:

```markdown
## Feature: [Name]
**Branch:** feature/[name]
**Date:** [Date]

### Development Testing
- [ ] npm run tauri dev works
- [ ] Feature renders correctly
- [ ] No console errors
- [ ] State management works

### Production Testing
- [ ] npm run tauri build succeeds
- [ ] Installer installs correctly
- [ ] Feature works in production
- [ ] Performance acceptable

### Edge Cases Tested
- [ ] Empty inputs
- [ ] Very long inputs
- [ ] Network failures
- [ ] Invalid API keys

### Bugs Found
1. [Bug description] - Fixed in commit [hash]

### Final Status
✅ Ready to merge / ❌ Needs work
```

---

## 🔧 Quick Command Reference

```bash
# Development (hot-reload)
npm run tauri dev

# Type check
npm run build

# Production build
npm run tauri build

# Rust tests
cd src-tauri && cargo test

# Clean build
cd src-tauri && cargo clean
npm run tauri build
```

---

## 💡 Best Practices

1. **Test Early, Test Often** - Don't wait until feature is complete
2. **Test in Both Modes** - Dev mode ≠ Production mode
3. **Keep Dev Mode Running** - Faster iteration cycles
4. **Check Console Always** - Errors might be silent in UI
5. **Test Edge Cases** - Empty inputs, very long inputs, errors
6. **Test on Fresh Install** - Don't rely on cached data

---

## 🆘 Common Issues & Solutions

### Issue: "npm run tauri dev" fails
**Solution:**
```bash
# Reinstall dependencies
rm -rf node_modules
npm install

# Update Rust
rustup update
```

### Issue: Build works but installer doesn't run
**Solution:**
- Check Windows Defender isn't blocking it
- Run installer as administrator
- Check antivirus settings

### Issue: Changes not reflecting in dev mode
**Solution:**
- Restart dev server
- Hard refresh (Ctrl+Shift+R)
- Clear app data

---

## 📚 Additional Resources

- [Tauri Testing Docs](https://tauri.app/v1/guides/testing/)
- [React Testing Library](https://testing-library.com/react)
- [Rust Testing](https://doc.rust-lang.org/book/ch11-00-testing.html)

---

**Remember:** Good testing = Confident releases = Happy users! 🎉
