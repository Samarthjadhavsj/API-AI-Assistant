# Installation Guide

This guide covers installing Hey Frank on Windows, macOS, and Linux.

## Table of Contents

- [System Requirements](#system-requirements)
- [Windows Installation](#windows-installation)
- [macOS Installation](#macos-installation)
- [Linux Installation](#linux-installation)
- [Building from Source](#building-from-source)
- [Verification](#verification)
- [Troubleshooting](#troubleshooting)

## System Requirements

### Minimum Requirements

- **OS**: Windows 10 (1803+), macOS 10.15+, or Linux (recent distribution)
- **RAM**: 2GB
- **Disk Space**: 50MB
- **Internet**: Required for AI API calls (unless using Ollama)

### Recommended Requirements

- **OS**: Windows 11, macOS 13+, or Ubuntu 22.04+
- **RAM**: 4GB+
- **Disk Space**: 100MB
- **Internet**: Stable connection for best experience

## Windows Installation

### Method 1: Using Installer (Recommended)

1. **Download the installer**
   ```
   Download hey-frank_0.1.8_x64.msi from GitHub Releases
   ```

2. **Run the installer**
   - Double-click the downloaded `.msi` file
   - Follow the installation wizard
   - Accept the license agreement
   - Choose installation location (default: `C:\Program Files\Hey Frank`)

3. **Complete installation**
   - Click "Install"
   - Allow admin permissions if prompted
   - Click "Finish" when done

4. **First launch**
   - Find "Hey Frank" in Start Menu
   - Or use desktop shortcut if created

### Method 2: Portable Version

1. **Download portable zip**
   ```
   Download hey-frank_0.1.8_x64_portable.zip
   ```

2. **Extract and run**
   - Extract to desired location
   - Run `hey-frank.exe`
   - No installation required

### Dependencies

Windows 10/11 usually includes these by default:

- **WebView2 Runtime** (automatically installed if missing)

If you encounter issues:
```powershell
# Download WebView2 from Microsoft
https://developer.microsoft.com/en-us/microsoft-edge/webview2/
```

## macOS Installation

### Method 1: Using DMG (Recommended)

1. **Download the DMG**
   ```
   Download hey-frank_0.1.8_universal.dmg from GitHub Releases
   ```

2. **Mount and install**
   - Double-click the `.dmg` file
   - Drag "Hey Frank" to Applications folder
   - Eject the DMG

3. **First launch**
   - Open from Applications folder
   - Right-click → "Open" on first run (due to Gatekeeper)
   - Click "Open" in the security dialog

### Method 2: Using Homebrew

```bash
# Add tap (coming soon)
brew tap samarthjadhavsj/hey-frank

# Install
brew install hey-frank
```

### Grant Permissions

On first launch, macOS will ask for permissions:

1. **Accessibility** - For global shortcuts
   - System Preferences → Security & Privacy → Accessibility
   - Enable "Hey Frank"

2. **Screen Recording** (optional)
   - System Preferences → Security & Privacy → Screen Recording
   - Enable if using screen capture features

## Linux Installation

### Ubuntu/Debian

#### Method 1: Using DEB package

```bash
# Download the deb file
wget https://github.com/Samarthjadhavsj/API-AI-Assistant/releases/download/v0.1.8/hey-frank_0.1.8_amd64.deb

# Install
sudo dpkg -i hey-frank_0.1.8_amd64.deb

# Install dependencies if needed
sudo apt-get install -f
```

#### Method 2: Using AppImage

```bash
# Download AppImage
wget https://github.com/Samarthjadhavsj/API-AI-Assistant/releases/download/v0.1.8/hey-frank_0.1.8_amd64.AppImage

# Make executable
chmod +x hey-frank_0.1.8_amd64.AppImage

# Run
./hey-frank_0.1.8_amd64.AppImage
```

### Arch Linux

```bash
# Using AUR (coming soon)
yay -S hey-frank
```

### Fedora/RHEL

```bash
# Using RPM (coming soon)
sudo dnf install hey-frank-0.1.8.x86_64.rpm
```

### Dependencies

Install required libraries:

**Ubuntu/Debian:**
```bash
sudo apt-get install \
  libwebkit2gtk-4.0-dev \
  libgtk-3-dev \
  libappindicator3-dev \
  librsvg2-dev \
  patchelf
```

**Fedora:**
```bash
sudo dnf install \
  webkit2gtk3-devel \
  gtk3-devel \
  libappindicator-gtk3-devel \
  librsvg2-devel
```

**Arch:**
```bash
sudo pacman -S \
  webkit2gtk \
  gtk3 \
  libappindicator-gtk3 \
  librsvg
```

## Building from Source

### Prerequisites

1. **Node.js 18+**
   ```bash
   # Install Node.js from https://nodejs.org/
   node --version  # Should be 18.x or higher
   ```

2. **Rust 1.70+**
   ```bash
   # Install Rust from https://rustup.rs/
   curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh
   rustc --version  # Should be 1.70 or higher
   ```

3. **Platform-specific tools**
   - See dependencies section for your platform above

### Build Steps

```bash
# Clone repository
git clone https://github.com/Samarthjadhavsj/API-AI-Assistant.git
cd API-AI-Assistant

# Install dependencies
npm install

# Development build
npm run tauri dev

# Production build
npm run tauri build
```

Build artifacts location:
- **Windows**: `src-tauri/target/release/bundle/msi/`
- **macOS**: `src-tauri/target/release/bundle/dmg/`
- **Linux**: `src-tauri/target/release/bundle/deb/` or `appimage/`

## Verification

### Verify Installation

```bash
# Check version
hey-frank --version

# Expected output:
# Hey Frank v0.1.8
```

### Verify Functionality

1. **Launch app**
   - Use Start Menu/Applications/Desktop icon

2. **Test toggle shortcut**
   - Press `Shift + \`
   - Window should appear/disappear

3. **Test settings**
   - Navigate to Dev Space
   - Verify settings panel opens

## Post-Installation

### First-Time Setup

1. **Configure AI Provider**
   - Open Dev Space (settings)
   - Select AI provider
   - Enter API key
   - Test connection

2. **Set up shortcuts** (optional)
   - Review default shortcuts
   - Customize if needed

3. **Enable auto-start** (optional)
   - Dev Space → Auto-start on system boot

### Recommended Settings

- **Always on top**: Enabled (default)
- **Hide from taskbar**: Enabled (default)
- **Content protection**: Enabled (default)
- **Auto-save conversations**: Enabled (default)

## Troubleshooting

### Windows Issues

**WebView2 not found:**
```powershell
# Download and install WebView2 Runtime
https://go.microsoft.com/fwlink/p/?LinkId=2124703
```

**App won't start:**
- Check antivirus/firewall settings
- Run as administrator
- Check Event Viewer for errors

### macOS Issues

**"App is damaged":**
```bash
# Remove quarantine attribute
xattr -cr /Applications/Hey\ Frank.app
```

**Shortcuts not working:**
- Grant Accessibility permissions
- System Preferences → Security & Privacy → Accessibility

### Linux Issues

**Missing libraries:**
```bash
# Check missing dependencies
ldd /path/to/hey-frank | grep "not found"

# Install missing libraries
sudo apt-get install <library-name>
```

**AppImage won't run:**
```bash
# Enable FUSE
sudo apt-get install fuse libfuse2

# Or extract and run
./hey-frank.AppImage --appimage-extract
./squashfs-root/hey-frank
```

## Uninstallation

### Windows

1. **Using Settings:**
   - Settings → Apps → Apps & features
   - Find "Hey Frank"
   - Click Uninstall

2. **Using Control Panel:**
   - Control Panel → Programs → Uninstall a program
   - Select "Hey Frank"
   - Click Uninstall

3. **Clean up data** (optional):
   ```powershell
   Remove-Item "$env:APPDATA\com.hey-frank.app" -Recurse
   ```

### macOS

1. **Remove app:**
   ```bash
   rm -rf /Applications/Hey\ Frank.app
   ```

2. **Clean up data** (optional):
   ```bash
   rm -rf ~/Library/Application\ Support/com.hey-frank.app
   rm -rf ~/Library/Caches/com.hey-frank.app
   rm -rf ~/Library/Logs/com.hey-frank.app
   ```

### Linux

```bash
# Uninstall DEB
sudo apt-get remove hey-frank

# Or delete AppImage
rm hey-frank.AppImage

# Clean up data (optional)
rm -rf ~/.local/share/com.hey-frank.app
rm -rf ~/.config/com.hey-frank.app
```

## Next Steps

- [Quick Start Guide](./quickstart.md)
- [Configuration Reference](./configuration.md)
- [User Manual](./user-guide.md)

## Support

If you encounter issues not covered here:

- **Check**: [Troubleshooting Guide](./troubleshooting.md)
- **Search**: [GitHub Issues](https://github.com/Samarthjadhavsj/API-AI-Assistant/issues)
- **Ask**: [GitHub Discussions](https://github.com/Samarthjadhavsj/API-AI-Assistant/discussions)
- **Email**: samarthjadhavsj121@gmail.com

---

**Last Updated**: January 2025
