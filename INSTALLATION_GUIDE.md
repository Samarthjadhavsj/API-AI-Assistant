# Installation Guide - Fixed Pluely with Direct Gemini API

## Step 1: Uninstall Old Pluely

### On Windows:
1. **Find Pluely in Apps**:
   - Press `Win + I` to open Settings
   - Go to **Apps** > **Installed apps**
   - Search for "Pluely"
   - Click the three dots (...) next to Pluely
   - Click **Uninstall**
   - Confirm the uninstallation

2. **Alternative Method** (Control Panel):
   - Press `Win + R`
   - Type `appwiz.cpl` and press Enter
   - Find "Pluely" in the list
   - Right-click and select **Uninstall**

3. **Clean Up Data** (Optional - if you want fresh start):
   - Press `Win + R`
   - Type `%APPDATA%` and press Enter
   - Delete the `pluely` folder if it exists
   - Press `Win + R` again
   - Type `%LOCALAPPDATA%` and press Enter
   - Delete the `pluely` folder if it exists

## Step 2: Build the Fixed Version

Open PowerShell or Command Prompt in the `pluely-master` folder:

```bash
# Navigate to pluely-master folder
cd pluely-master

# Install dependencies (if not already done)
npm install

# Build the application
npm run tauri build
```

**Build Time**: This will take 5-15 minutes depending on your computer.

## Step 3: Find the Installer

After the build completes, the installer will be located at:

```
pluely-master\src-tauri\target\release\bundle\nsis\
```

Look for a file named something like:
- `Pluely_0.1.8_x64-setup.exe` (or similar version number)

## Step 4: Install the Fixed Version

1. Navigate to the installer location
2. Double-click the `.exe` file
3. Follow the installation wizard
4. Launch Pluely

## Step 5: Configure Gemini

1. Open Pluely
2. Go to Settings (gear icon)
3. Under AI Provider:
   - **Provider**: Select "Gemini"
   - **API Key**: Paste your Gemini API key from https://aistudio.google.com/app/apikey
   - **Model**: Enter `gemini-2.0-flash-exp` (or `gemini-1.5-flash`, `gemini-1.5-pro`)
4. Save settings
5. Start chatting!

## Quick Build Commands

If you just want to build and run without installing:

```bash
# Development mode (faster, for testing)
npm run tauri dev

# Production build (creates installer)
npm run tauri build
```

## Troubleshooting

### Build Fails
- Make sure you have Node.js installed: https://nodejs.org/
- Make sure you have Rust installed: https://rustup.rs/
- Run `npm install` again

### Can't Find Installer
- Check: `pluely-master\src-tauri\target\release\bundle\nsis\`
- If not there, check: `pluely-master\src-tauri\target\release\bundle\msi\`

### Old Version Still Appears
- Restart your computer after uninstalling
- Check both Program Files and AppData folders

## What's Different in This Version?

✅ Direct API access to Gemini (no backend)
✅ No license required
✅ All features work with your own API key
✅ Better performance
✅ More reliable

## Need Help?

- Check `QUICK_START.md` for basic setup
- Check `GEMINI_DIRECT_API_FIX.md` for technical details
