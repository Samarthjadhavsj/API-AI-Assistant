# Ultra-Minimal Hey Frank

**Ultra-lightweight stealth AI assistant for private use.**

---

## Features

- 🕵️ **Ultra Stealth Mode** — Invisible in screen recordings & video calls
- 🎯 **Single Toggle** — One shortcut: `Shift+\` (show/hide)
- 🚫 **No Taskbar Icon** — Completely hidden from taskbar
- 🔒 **Content Protected** — OS-level screen capture protection
- 💬 **AI Chat** — Direct API calls to your chosen AI provider
- 💾 **Local Storage** — Everything stored locally, zero telemetry

---

## Quick Start

### 1. Install Dependencies

```bash
npm install
```

### 2. Configure AI Provider

1. Launch the app
2. Go to Dev Space (settings)
3. Add your AI API provider (OpenAI, Claude, etc.)
4. Set your API key

### 3. Run Development

```bash
npm run tauri dev
```

### 4. Build for Production

```bash
npm run tauri build
```

Binary will be in: `src-tauri/target/release/bundle/`

---

## Usage

### Toggle Window
```
Press: Shift+\
```

Window will appear → Ask AI → Press again to hide

### Stealth Features

- **Screen Share Safe**: Won't appear in Zoom/Teams/OBS recordings
- **No Taskbar**: No icon when hidden (skipTaskbar: true)
- **Content Protected**: OS-level protection from capture
- **Always-on-Top**: Stays visible when shown

---

## Configuration

All settings in: `src-tauri/tauri.conf.json`

```json
{
  "skipTaskbar": true,      // Hide from taskbar
  "contentProtected": true, // Prevent screen capture
  "transparent": true,      // Window transparency
  "visible": false         // Starts hidden
}
```

### Shortcut Configuration

File: `src/config/shortcuts.ts`

```typescript
{
  "toggle_window": {
    "action_id": "toggle_window",
    "keys": "shift+backslash"  // Shift+\
  }
}
```

---

## Technical Details

### Architecture

- **Frontend**: React + TypeScript + Vite
- **Backend**: Rust + Tauri
- **Database**: SQLite (local)
- **Size**: ~10MB total

### Files Structure

```
src/                 # Frontend (React)
src-tauri/          # Backend (Rust)
  ├── src/
  │   ├── lib.rs         # Main app logic
  │   ├── shortcuts.rs   # Keyboard shortcuts
  │   ├── window.rs      # Window management
  │   └── tray.rs        # System tray
  └── tauri.conf.json    # App configuration
```

### Key Features Removed

- ❌ Dashboard window
- ❌ Screenshot shortcuts
- ❌ Multiple keyboard shortcuts
- ❌ Complex UI elements
- ❌ Telemetry/analytics

### What Remains

- ✅ Single toggle shortcut (Shift+\)
- ✅ AI chat interface
- ✅ Stealth mode (content protection + no taskbar)
- ✅ Local database
- ✅ System tray (minimal)

---

## Privacy

- **Zero Telemetry**: No tracking, no analytics
- **Local Storage**: SQLite database on your machine
- **Direct API Calls**: Your device → AI provider (no middleware)
- **No Cloud Sync**: Everything stays on your computer

---

## Use Cases

### Interview/Exam Assistance
- Press `Shift+\` → Window appears
- Ask AI question
- Get answer
- Press `Shift+\` → Window hides
- **Result**: Screen recording shows nothing

### Meeting Support
- Keep app open but hidden
- Toggle when you need quick info
- Invisible to screen share participants

### General Privacy
- Use Ollama for 100% offline AI
- No process monitoring concerns
- Rename `hey-frank.exe` to blend in (e.g., "Microsoft Teams Helper.exe")

---

## Detection Evasion

### What's Protected

✅ **Visual Detection**
- Screen recordings (OBS, Bandicam, etc.)
- Screenshot tools (Snipping Tool, etc.)
- Video conferencing (Zoom, Teams, Google Meet)

✅ **Hidden from Taskbar**
- No icon in Windows taskbar
- No tray icon (optional, can be disabled)

### What's NOT Protected

❌ **Process Detection**
- Task Manager shows "hey-frank.exe"
- Process monitoring tools can detect
- **Solution**: Rename exe or use Ollama (offline)

❌ **Network Detection**
- API calls visible in network logs
- **Solution**: Use Ollama for offline mode

---

## Offline Mode

Use Ollama for zero network traffic:

1. Install Ollama: https://ollama.ai
2. Run: `ollama run llama2`
3. Configure endpoint: `http://localhost:11434`
4. **Result**: 100% offline AI, zero detection

---

## License

GPL-3.0 — Free and open source

---

## Disclaimer

⚠️ **Important**: This tool is for **educational and personal productivity** purposes only.

- Using this in proctored exams may violate academic integrity policies
- Screen monitoring software (e.g., Proctorio, ProctorU) may detect process activity
- Check your institution's/organization's policies before use
- The authors are not responsible for misuse or policy violations

**Recommended use**: Personal learning, interview preparation, meeting support with consent.

---

## Build & Run

```bash
# Development
npm run tauri dev

# Production build
npm run tauri build

# Output location
src-tauri/target/release/bundle/
```

---

**Built for privacy-conscious productivity.** 🕵️
