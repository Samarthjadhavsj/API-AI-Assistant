<div align="center">

# 🤖 Hey Frank - AI Assistant

### Ultra-Minimal Stealth AI Assistant for Private Use

[![License: GPL-3.0](https://img.shields.io/badge/License-GPL%203.0-blue.svg)](https://opensource.org/licenses/GPL-3.0)
[![Build Status](https://github.com/Samarthjadhavsj/API-AI-Assistant/actions/workflows/ci.yml/badge.svg)](https://github.com/Samarthjadhavsj/API-AI-Assistant/actions)
[![Version](https://img.shields.io/badge/version-0.1.8-orange.svg)]()
[![Platform](https://img.shields.io/badge/platform-Windows%20%7C%20macOS%20%7C%20Linux-lightgrey.svg)]()
[![PRs Welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)]()
[![Made with Rust](https://img.shields.io/badge/Made%20with-Rust-orange.svg)](https://www.rust-lang.org/)
[![Made with React](https://img.shields.io/badge/Made%20with-React-61dafb.svg)](https://reactjs.org/)

[Features](#-features) • [Quick Start](#-quick-start) • [Documentation](#-documentation) • [Contributing](#-contributing) • [License](#-license)

</div>

---

## 📋 Table of Contents

- [Overview](#-overview)
- [Features](#-features)
- [Demo](#-demo)
- [Quick Start](#-quick-start)
- [Architecture](#-architecture)
- [Configuration](#-configuration)
- [Privacy & Security](#-privacy--security)
- [Use Cases](#-use-cases)
- [Development](#-development)
- [Testing](#-testing)
- [Contributing](#-contributing)
- [Roadmap](#-roadmap)
- [License](#-license)
- [Acknowledgments](#-acknowledgments)

---

## 🌟 Overview

**Hey Frank** is an ultra-lightweight, privacy-first AI assistant built with Rust and React. Designed for professionals who need discreet AI assistance during meetings, interviews, and daily workflows.

### Why Hey Frank?

✅ **Privacy-First** - Zero telemetry, all data stored locally  
✅ **Ultra-Stealth** - Invisible in screen recordings and video calls  
✅ **Lightweight** - Only ~10MB total size  
✅ **Open Source** - GPL-3.0 licensed, fully transparent  
✅ **Cross-Platform** - Windows, macOS, and Linux support  

---

## ✨ Features

### 🕵️ Stealth Mode
- **Invisible in recordings** - Won't appear in Zoom/Teams/OBS
- **No taskbar icon** - Completely hidden when minimized
- **Content protected** - OS-level screen capture protection
- **Always-on-top** - Stays visible when you need it

### 🎯 Ultra-Minimal Interface
- **Single toggle shortcut** - `Shift+\` to show/hide
- **Clean UI** - Distraction-free design
- **Fast responses** - Direct API integration
- **No bloat** - Only essential features

### 💬 AI Capabilities
- **Multi-provider support** - OpenAI, Claude, Gemini, and more
- **Speech-to-text** - Voice input support
- **Markdown rendering** - Rich text formatting
- **Conversation history** - Local SQLite database
- **Custom prompts** - System prompt management

### 🔒 Privacy & Security
- **Zero telemetry** - No tracking or analytics
- **Local storage** - SQLite database on your machine
- **Direct API calls** - No middleware or proxy servers
- **Offline mode** - Use with Ollama for 100% offline AI

---

## 🎬 Demo

### Application Interface

<div align="center">

![Hey Frank Main Interface](https://via.placeholder.com/800x500/1a1a2e/16c784?text=Main+Chat+Interface)
*Main chat interface with AI assistant*

![Stealth Mode](https://via.placeholder.com/800x500/1a1a2e/e94560?text=Stealth+Mode+Active)
*Stealth mode - invisible in screen recordings*

![Settings Panel](https://via.placeholder.com/800x500/1a1a2e/0f3460?text=Dev+Space+Settings)
*Configuration and AI provider settings*

</div>

> **Note:** Replace placeholder images with actual screenshots by adding them to a `docs/images/` folder

---

## 🚀 Quick Start

### Prerequisites

- Node.js 18+ and npm
- Rust 1.70+
- Platform-specific dependencies:
  - **Windows**: WebView2 Runtime
  - **macOS**: Xcode Command Line Tools
  - **Linux**: webkit2gtk-4.0-dev, libssl-dev

### Installation

```bash
# Clone the repository
git clone https://github.com/Samarthjadhavsj/API-AI-Assistant.git
cd API-AI-Assistant

# Install dependencies
npm install

# Run in development mode
npm run tauri dev
```

### Configuration

1. Launch the application
2. Navigate to **Dev Space** (settings)
3. Add your AI provider credentials
4. Configure your preferred AI model

### Build for Production

```bash
npm run tauri build
```

📦 Binary location: `src-tauri/target/release/bundle/`

---

## 🏗️ Architecture

```
┌─────────────────────────────────────────┐
│           Frontend (React)              │
│  - UI Components (shadcn/ui)           │
│  - State Management (Context API)      │
│  - Routing (React Router)              │
└──────────────┬──────────────────────────┘
               │ Tauri API Bridge
┌──────────────┴──────────────────────────┐
│           Backend (Rust)                │
│  - Window Management                    │
│  - Keyboard Shortcuts                   │
│  - System Tray                          │
│  - Database (SQLite)                    │
└─────────────────────────────────────────┘
```

### Tech Stack

**Frontend:**
- React 19 + TypeScript
- TailwindCSS 4 + shadcn/ui
- React Router 7
- Vite 7

**Backend:**
- Rust + Tauri 2
- SQLite (via Tauri SQL plugin)
- Global shortcuts
- System tray integration

**Build Tools:**
- Vite (bundler)
- TypeScript (type safety)
- Vitest (testing)

---

## ⚙️ Configuration

### Window Settings

Edit `src-tauri/tauri.conf.json`:

```json
{
  "skipTaskbar": true,      // Hide from taskbar
  "contentProtected": true, // Prevent screen capture
  "transparent": true,      // Window transparency
  "visible": false,        // Start hidden
  "alwaysOnTop": true     // Stay on top when visible
}
```

### Keyboard Shortcuts

Edit `src/config/shortcuts.ts`:

```typescript
{
  "toggle_window": {
    "action_id": "toggle_window",
    "keys": "shift+backslash"  // Customize: Shift+\
  }
}
```

### AI Providers

Supported providers:
- OpenAI (GPT-4, GPT-3.5)
- Anthropic (Claude)
- Google (Gemini)
- Ollama (Local/Offline)
- Custom OpenAI-compatible APIs

---

## 🔒 Privacy & Security

### Data Protection

✅ **Local-First Architecture**
- All conversations stored in local SQLite database
- No cloud sync or external storage
- Data never leaves your device

✅ **Zero Telemetry**
- No analytics tracking
- No crash reporting
- No usage statistics

✅ **Direct API Communication**
- Your device → AI provider directly
- No middleware or proxy servers
- API keys encrypted locally

### Stealth Features

| Feature | Description | Status |
|---------|-------------|--------|
| Screen Capture Protection | OS-level content protection | ✅ Active |
| Taskbar Hiding | No icon when minimized | ✅ Active |
| Recording Evasion | Invisible in screen recordings | ✅ Active |
| Process Obfuscation | Rename executable | ⚙️ Manual |
| Offline Mode | Use Ollama for local AI | ✅ Supported |

---

## 💡 Use Cases

### 1. Meeting Assistant
Stay productive during virtual meetings with discreet AI support.

```
Scenario: Video conference on Zoom
Action: Press Shift+\ → Ask question → Get answer → Hide
Result: Participants see nothing
```

### 2. Interview Preparation
Quick reference during technical interviews.

```
Scenario: Coding interview with screen share
Action: Toggle for code snippets or algorithm hints
Result: Not visible in screen recordings
```

### 3. Learning Aid
Personal tutor for studying and research.

```
Scenario: Self-study session
Action: Ask questions, get explanations
Result: Local, private, no tracking
```

### 4. Offline AI (Ollama)
100% private AI with zero network traffic.

```bash
# Install Ollama
ollama run llama2

# Configure Hey Frank
Endpoint: http://localhost:11434
Model: llama2
```

---

## 👨‍💻 Development

### Project Structure

```
API-AI-Assistant/
├── src/                      # React frontend
│   ├── components/          # UI components
│   ├── pages/              # Application pages
│   ├── hooks/              # Custom React hooks
│   ├── contexts/           # Context providers
│   ├── lib/                # Utilities & helpers
│   └── config/             # Configuration files
├── src-tauri/              # Rust backend
│   ├── src/
│   │   ├── lib.rs         # Main application logic
│   │   ├── shortcuts.rs   # Keyboard shortcuts handler
│   │   ├── window.rs      # Window management
│   │   ├── tray.rs        # System tray
│   │   └── capture.rs     # Screen capture logic
│   ├── Cargo.toml         # Rust dependencies
│   └── tauri.conf.json    # Tauri configuration
├── .github/                # GitHub workflows & templates
└── docs/                   # Documentation
```

### Development Commands

```bash
# Development server
npm run dev

# Run Tauri dev mode
npm run tauri dev

# Run tests
npm test

# Run tests with coverage
npm run test:coverage

# Build production
npm run build
npm run tauri build

# Format code
cargo fmt
npm run format
```

### Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# UI mode
npm run test:ui
```

See [TEST_CASES.md](./TEST_CASES.md) for detailed test documentation.

---

## 🧪 Testing

We maintain comprehensive test coverage:

- **Unit Tests**: 225+ tests
- **Integration Tests**: Full workflow coverage
- **Manual Test Suite**: [MANUAL_TEST_EXECUTION_GUIDE.md](./MANUAL_TEST_EXECUTION_GUIDE.md)
- **Smoke Tests**: [SMOKE_TEST_CHECKLIST.md](./SMOKE_TEST_CHECKLIST.md)

### Test Reports
- [Automated Tests Report](./AUTOMATED_TESTS_FINAL_REPORT.md)
- [Physical Testing Summary](./PHYSICAL_TESTING_SUMMARY.md)
- [Test Suite Summary](./TEST_SUITE_SUMMARY.md)

---

## 🤝 Contributing

We welcome contributions! Please see our [Contributing Guide](./CONTRIBUTING.md) for details.

### Quick Contribution Guide

1. **Fork the repository**
2. **Create a feature branch**
   ```bash
   git checkout -b feature/amazing-feature
   ```
3. **Make your changes**
4. **Run tests**
   ```bash
   npm test
   ```
5. **Commit with conventional commits**
   ```bash
   git commit -m "feat: add amazing feature"
   ```
6. **Push and create PR**
   ```bash
   git push origin feature/amazing-feature
   ```

See our [Branch Strategy](./GIT_BRANCH_STRATEGY.md) and [GitHub Push Guide](./GITHUB_PUSH_GUIDE.md).

---

## 🗺️ Roadmap

### Current Version (0.1.8)
- ✅ Stealth mode with content protection
- ✅ Single toggle shortcut
- ✅ Multi-provider AI support
- ✅ Local SQLite database
- ✅ Voice input (STT)

### Planned Features
- 🔄 Plugin system
- 🔄 Custom themes
- 🔄 Mobile companion app
- 🔄 Cloud sync (optional, encrypted)
- 🔄 Team collaboration features

See [CHANGELOG.md](./CHANGELOG.md) for version history.

---

## 📄 License

This project is licensed under the **GNU General Public License v3.0** - see the [LICENSE](./LICENSE) file for details.

### What this means:
- ✅ Commercial use allowed
- ✅ Modification allowed
- ✅ Distribution allowed
- ✅ Patent use allowed
- ⚠️ Must disclose source
- ⚠️ License and copyright notice required
- ⚠️ Same license (Copyleft)

---

## ⚠️ Disclaimer

**IMPORTANT NOTICE:**

This software is provided for **educational and personal productivity purposes** only. Users are solely responsible for ensuring their use complies with:

- Academic integrity policies
- Workplace regulations
- Professional certification rules
- Local laws and regulations

**We do NOT endorse or encourage:**
- Cheating on exams
- Violating proctoring systems
- Academic dishonesty
- Circumventing security measures

**Recommended ethical uses:**
- Personal learning and research
- Meeting productivity (with consent)
- Interview preparation
- Accessibility assistance

---

## 🙏 Acknowledgments

Built with amazing open-source technologies:

- [Tauri](https://tauri.app/) - Desktop app framework
- [React](https://react.dev/) - UI library
- [Rust](https://www.rust-lang.org/) - Systems programming language
- [shadcn/ui](https://ui.shadcn.com/) - UI components
- [TailwindCSS](https://tailwindcss.com/) - CSS framework

Special thanks to all [contributors](https://github.com/Samarthjadhavsj/API-AI-Assistant/graphs/contributors)!

### Project Stats

![GitHub Stars](https://img.shields.io/github/stars/Samarthjadhavsj/API-AI-Assistant?style=social)
![GitHub Forks](https://img.shields.io/github/forks/Samarthjadhavsj/API-AI-Assistant?style=social)
![GitHub Issues](https://img.shields.io/github/issues/Samarthjadhavsj/API-AI-Assistant)
![GitHub Pull Requests](https://img.shields.io/github/issues-pr/Samarthjadhavsj/API-AI-Assistant)
![GitHub Contributors](https://img.shields.io/github/contributors/Samarthjadhavsj/API-AI-Assistant)
![Last Commit](https://img.shields.io/github/last-commit/Samarthjadhavsj/API-AI-Assistant)

---

## 📞 Support & Contact

- 📧 Email: samarthjadhavsj121@gmail.com
- 🐛 Issues: [GitHub Issues](https://github.com/Samarthjadhavsj/API-AI-Assistant/issues)
- 💬 Discussions: [GitHub Discussions](https://github.com/Samarthjadhavsj/API-AI-Assistant/discussions)

---

<div align="center">

### ⭐ Star this repo if you find it helpful!

Made with ❤️ for privacy-conscious productivity

[Report Bug](https://github.com/Samarthjadhavsj/API-AI-Assistant/issues) • [Request Feature](https://github.com/Samarthjadhavsj/API-AI-Assistant/issues) • [Documentation](./docs/)

</div>
