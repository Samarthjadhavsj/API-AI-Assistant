# API AI Assistant

<div align="center">

<img src="/images/app-image.png" alt="API AI Assistant" width="100%" />

### A privacy-first AI assistant that works seamlessly during meetings, interviews, and conversations.

**Lightweight • Invisible • Powerful**

[Download](#-download) • [Features](#-features) • [Documentation](#-documentation)

</div>

---

## Overview

API AI Assistant is a lightweight desktop application that provides real-time AI assistance with complete privacy and stealth. Built with Tauri and React, it delivers native performance in a ~10MB package while remaining invisible during screen shares and video calls.

**Key Highlights:**
- **Ultra-lightweight** — Only ~10MB total size
- **Privacy-first** — All data stored locally, direct API calls
- **Invisible mode** — Undetectable in screen shares and recordings
- **Cross-platform** — macOS, Windows, and Linux support
- **Flexible** — Works with any AI provider via simple configuration

---

## ✨ Features

### Stealth Mode
Translucent overlay window that sits above all applications while remaining invisible in video calls, screen shares, and screenshots. Perfect for meetings, interviews, and presentations.

### System Audio Capture
Record and transcribe system audio in real-time. Capture audio from meetings, presentations, or any sound playing on your computer with automatic voice activity detection.

**Shortcut:** `Cmd+Shift+M` (macOS) / `Ctrl+Shift+M` (Windows/Linux)

### Voice Input
Convert speech to text using advanced STT providers including OpenAI Whisper, ElevenLabs, Groq, and custom providers. Hands-free interaction with automatic voice detection.

**Shortcut:** `Cmd+Shift+A` (macOS) / `Ctrl+Shift+A` (Windows/Linux)

### Screenshot Analysis
Capture full screen or select specific areas for AI visual analysis. Choose between manual mode (capture multiple screenshots) or auto mode (instant AI analysis).

**Shortcut:** `Cmd+Shift+S` (macOS) / `Ctrl+Shift+S` (Windows/Linux)

### File Attachments
Attach multiple files to conversations for analysis, review, or context. Supports documents, images, code files, and text-based content with drag-and-drop functionality.

### Custom System Prompts
Create unlimited system prompts to control AI behavior. Define personas, writing styles, and specialized knowledge domains. Switch between prompts instantly.

### Conversation History
All conversations stored locally in SQLite. Search, continue, export as markdown, or delete anytime. Complete control over your data.

---

## 🚀 Download

<div align="center">

### Latest Release

[![macOS](https://img.shields.io/badge/macOS-Download-000000?style=for-the-badge&logo=apple&logoColor=white)](https://github.com/YOUR_USERNAME/api-AI-Assistant/releases)
[![Windows](https://img.shields.io/badge/Windows-Download-0078D4?style=for-the-badge&logo=windows&logoColor=white)](https://github.com/YOUR_USERNAME/api-AI-Assistant/releases)
[![Linux](https://img.shields.io/badge/Linux-Download-FCC624?style=for-the-badge&logo=linux&logoColor=black)](https://github.com/YOUR_USERNAME/api-AI-Assistant/releases)

**Available formats:** `.dmg` (macOS) • `.msi` `.exe` (Windows) • `.deb` `.rpm` `.AppImage` (Linux)

</div>

---

## 📋 Prerequisites

Before installation, ensure all required system dependencies are installed:

**[Tauri Prerequisites](https://v2.tauri.app/start/prerequisites/)** — Essential packages including WebKitGTK (Linux), system libraries, and other dependencies.

**Requirements:**
- Node.js v18 or higher
- Rust (latest stable)
- npm or yarn

---

## 🛠 Installation

### From Source

```bash
# Clone the repository
git clone https://github.com/YOUR_USERNAME/api-AI-Assistant.git
cd api-AI-Assistant

# Install dependencies
npm install

# Start development
npm run tauri dev
```

### Build

```bash
# Build for production
npm run tauri build
```

Installers will be created in `src-tauri/target/release/bundle/`

---

## 📖 Documentation

### Quick Start

1. **Launch** the application
2. **Configure** your AI provider in Dev Space
3. **Set** your API key
4. **Create** or select a system prompt
5. **Start** using keyboard shortcuts for instant access

### Keyboard Shortcuts

| Action | macOS | Windows/Linux |
|--------|-------|---------------|
| Toggle Dashboard | `Cmd+Shift+D` | `Ctrl+Shift+D` |
| Toggle Window | `Cmd+\` | `Ctrl+\` |
| Focus Input | `Cmd+Shift+I` | `Ctrl+Shift+I` |
| System Audio | `Cmd+Shift+M` | `Ctrl+Shift+M` |
| Voice Input | `Cmd+Shift+A` | `Ctrl+Shift+A` |
| Screenshot | `Cmd+Shift+S` | `Ctrl+Shift+S` |

All shortcuts are customizable in Settings.

### Configuration

#### AI Providers

Configure any LLM provider using curl commands in Dev Space:

**Supported providers:**
- OpenAI
- Anthropic Claude
- Google Gemini
- xAI Grok
- Mistral AI
- Cohere
- Perplexity
- Groq
- Ollama
- Custom endpoints

**Dynamic variables:**
- `{{TEXT}}` — User input
- `{{IMAGE}}` — Base64 image data
- `{{SYSTEM_PROMPT}}` — System instructions
- `{{MODEL}}` — Model name
- `{{API_KEY}}` — API key

#### STT Providers

Configure speech-to-text providers:

**Supported providers:**
- OpenAI Whisper
- ElevenLabs
- Groq Whisper
- Google Speech-to-Text
- Deepgram
- Azure Speech
- Custom endpoints

---

## 🔒 Privacy

**Local Storage** — All conversations stored in local SQLite database. No cloud sync, no external servers.

**Direct API Calls** — Requests go directly from your device to your chosen AI provider. No middleware, no proxies.

**Zero Telemetry** — No analytics, no tracking, no data collection of any kind.

**Secure Credentials** — API keys stored in encrypted secure storage, separate from application data.

**Offline Capable** — Full functionality without internet except for AI provider API calls.

---

## 🎯 Use Cases

- **Job Interviews** — Get real-time information without detection
- **Sales Calls** — Access product details instantly
- **Technical Meetings** — Reference documentation seamlessly
- **Presentations** — Learning assistance invisible to audience
- **Design Reviews** — Analyze screenshots and get suggestions
- **Live Coding** — Debug and get syntax help in stealth

---

## 🤝 Contributing

Contributions are welcome! Please follow these guidelines:

✅ **Accepted:**
- Bug fixes
- Performance improvements
- Documentation updates
- Code quality enhancements

❌ **Not Accepted:**
- New feature requests via PR
- Large UI overhauls
- New AI/STT providers (use custom configuration instead)

### How to Contribute

1. Fork the repository
2. Create a feature branch (`git checkout -b fix/bug-name`)
3. Commit your changes (`git commit -m 'Fix: description'`)
4. Push to the branch (`git push origin fix/bug-name`)
5. Open a Pull Request

---

## 📄 License

This project is licensed under the **GNU General Public License v3.0** — see the [LICENSE](LICENSE) file for details.

---

## 🙏 Acknowledgments

Built with:
- [Tauri](https://tauri.app/) — Desktop framework
- [React](https://reactjs.org/) — UI framework
- [shadcn/ui](https://ui.shadcn.com/) — UI components
- [@ricky0123/vad-react](https://github.com/ricky0123/vad) — Voice activity detection

---

<div align="center">

### Developed for Knowledge

**Created by SAM**

*A lightweight, privacy-first alternative for AI-powered assistance*

---

[![GitHub](https://img.shields.io/badge/GitHub-Repository-black?style=flat&logo=github)](https://github.com/YOUR_USERNAME/api-AI-Assistant)
[![License](https://img.shields.io/badge/License-GPL%20v3-blue.svg)](LICENSE)
[![Version](https://img.shields.io/badge/Version-0.1.8-green.svg)](package.json)

</div>
