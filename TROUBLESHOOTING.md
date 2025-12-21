# Troubleshooting - Pluely Won't Open

## Problem: Pluely installs but doesn't open

This is usually caused by missing WebView2 runtime, which Tauri apps need to display their UI.

## Solution: Install WebView2 Runtime

### Option 1: Automatic Install (Recommended)
1. Download: https://go.microsoft.com/fwlink/p/?LinkId=2124703
2. Run the installer
3. Restart your computer
4. Try opening Pluely again

### Option 2: Check if WebView2 is Already Installed
1. Press `Win + R`
2. Type: `msedge://settings/help`
3. Press Enter
4. If Edge opens, WebView2 is installed
5. If not, use Option 1

## Alternative: Use Development Mode

If you don't want to install WebView2, you can run Pluely in development mode:

```bash
cd pluely-master
npm run tauri dev
```

This will:
- Take 5-10 minutes to compile
- Open Pluely automatically
- Work without WebView2 runtime
- Let you test all features

## Alternative: Use the Simple Gemini Chat

We already created a working Gemini chat app that doesn't need installation:

1. Navigate to: `gemini-chat` folder
2. Open `index.html` in your browser
3. Enter your Gemini API key
4. Start chatting!

This works immediately, no installation needed.

## How to Know if Pluely is Running

Pluely runs in the **system tray** (near the clock in the taskbar), not as a regular window.

Look for the Pluely icon near your clock. If you don't see it:
1. Click the up arrow (^) in the system tray
2. Look for Pluely there
3. Click it to open

## Still Not Working?

Try these steps:

### 1. Check Windows Defender
Windows might be blocking it:
1. Open Windows Security
2. Go to Virus & threat protection
3. Check Protection history
4. If Pluely is blocked, allow it

### 2. Run as Administrator
1. Right-click Pluely shortcut
2. Select "Run as administrator"

### 3. Check Event Viewer
1. Press `Win + X`
2. Select "Event Viewer"
3. Go to Windows Logs → Application
4. Look for errors related to Pluely

### 4. Use the Gemini Chat App Instead
The `gemini-chat` app we created works perfectly and requires no installation:
- Open `gemini-chat/index.html`
- Works in any browser
- Direct Gemini API access
- No dependencies

## Quick Test

To test if the build works at all, run this in PowerShell:

```powershell
cd "C:\Users\SAMAR\OneDrive\Desktop\pluly- project\pluely-master"
npm run tauri dev
```

Wait 5-10 minutes for compilation. If it opens, the build is fine and you just need WebView2.

## Summary

**Most likely cause**: Missing WebView2 runtime
**Quick fix**: Install from https://go.microsoft.com/fwlink/p/?LinkId=2124703
**Alternative**: Use `gemini-chat/index.html` (works immediately!)
