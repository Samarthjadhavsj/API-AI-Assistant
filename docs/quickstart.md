# Quick Start Guide

Get up and running with Hey Frank in 5 minutes!

## 📦 Step 1: Install

Choose your platform:

**Windows:**
```powershell
# Download and run the installer
hey-frank_0.1.8_x64.msi
```

**macOS:**
```bash
# Download and install
open hey-frank_0.1.8_universal.dmg
# Drag to Applications folder
```

**Linux:**
```bash
# Ubuntu/Debian
sudo dpkg -i hey-frank_0.1.8_amd64.deb

# Or use AppImage
chmod +x hey-frank_0.1.8_amd64.AppImage
./hey-frank_0.1.8_amd64.AppImage
```

## 🔑 Step 2: Configure AI Provider

1. **Launch Hey Frank**
   - Find it in Start Menu (Windows) or Applications (macOS/Linux)
   - Or launch from terminal: `hey-frank`

2. **Open Dev Space (Settings)**
   - Click the settings icon in the sidebar
   - Or navigate to the Dev Space tab

3. **Add Your AI Provider**
   
   **For OpenAI:**
   - Select "OpenAI" from providers
   - Enter your API key from [platform.openai.com/api-keys](https://platform.openai.com/api-keys)
   - Choose model: `gpt-4`, `gpt-3.5-turbo`, etc.
   - Click "Save"

   **For Claude (Anthropic):**
   - Select "Anthropic" from providers
   - Enter your API key from [console.anthropic.com](https://console.anthropic.com)
   - Choose model: `claude-3-opus`, `claude-3-sonnet`, etc.
   - Click "Save"

   **For Gemini (Google):**
   - Select "Google" from providers
   - Enter your API key from [makersuite.google.com](https://makersuite.google.com)
   - Choose model: `gemini-pro`, `gemini-pro-vision`, etc.
   - Click "Save"

   **For Ollama (Local/Offline):**
   - Install Ollama: [ollama.ai](https://ollama.ai)
   - Pull a model: `ollama pull llama2`
   - Select "Ollama" from providers
   - Endpoint: `http://localhost:11434`
   - Model name: `llama2` (or your chosen model)
   - Click "Save"

4. **Test Connection**
   - Click "Test Connection" button
   - You should see a success message

## 💬 Step 3: Start Chatting

1. **Navigate to Chat Interface**
   - Click on "Chat" in the sidebar
   - Or press `Shift + \` to toggle the window

2. **Send Your First Message**
   - Type your question in the text box
   - Press Enter or click Send
   - Wait for the AI response

3. **Try Voice Input (Optional)**
   - Click the microphone icon
   - Speak your question
   - Click stop when done

## 🕵️ Step 4: Enable Stealth Mode

1. **Open Settings/Dev Space**

2. **Configure Stealth Features:**
   - ✅ **Always on top**: Keep window visible
   - ✅ **Hide from taskbar**: No taskbar icon when minimized
   - ✅ **Content protection**: Prevent screen capture
   - ✅ **Transparent overlay**: See-through background

3. **Set Global Shortcut**
   - Default: `Shift + \`
   - Customize in Keyboard Shortcuts section

4. **Test Stealth Mode**
   - Press your toggle shortcut
   - Window should appear/disappear
   - Try recording your screen - window won't appear in recording

## ⌨️ Step 5: Learn Key Shortcuts

| Action | Shortcut | Description |
|--------|----------|-------------|
| Toggle Window | `Shift + \` | Show/hide main window |
| New Chat | `Ctrl + N` | Start new conversation |
| Clear Chat | `Ctrl + L` | Clear current chat |
| Settings | `Ctrl + ,` | Open settings |
| Voice Input | `Ctrl + M` | Start/stop microphone |
| Send Message | `Enter` | Send chat message |
| Multi-line | `Shift + Enter` | New line in message |

## 🎯 Common Use Cases

### During a Meeting
```
1. Press Shift + \ to show window
2. Type quick question
3. Get instant answer
4. Press Shift + \ to hide
5. Participants see nothing!
```

### For Coding Help
```
1. Open Hey Frank
2. Paste your code or error
3. Ask: "What's wrong with this code?"
4. Get explanation and solution
```

### Learning New Topics
```
1. Start new chat (Ctrl + N)
2. Ask: "Explain [topic] in simple terms"
3. Follow up with questions
4. Conversation history saved locally
```

### Offline AI (Ollama)
```
1. Install Ollama
2. Pull model: ollama pull llama2
3. Configure in Hey Frank
4. 100% private, no internet needed!
```

## 🔒 Privacy Tips

- **API Keys**: Stored encrypted in system keychain
- **Conversations**: Saved locally in SQLite database
- **No Tracking**: Zero telemetry, no data sent to us
- **Direct Communication**: Your device → AI provider directly

## 🛠️ Troubleshooting Quick Fixes

**Window won't appear:**
- Check if it's hidden behind other windows
- Try double-pressing the toggle shortcut
- Restart the app

**Shortcut not working:**
- Check if another app uses the same shortcut
- Try a different shortcut combination
- Grant Accessibility permissions (macOS/Linux)

**AI not responding:**
- Check your internet connection
- Verify API key is correct
- Check API provider status page
- Try a different model

**Can't install on macOS:**
```bash
# Remove quarantine attribute
xattr -cr /Applications/Hey\ Frank.app
```

## ⚙️ Optional Configuration

### Auto-start on Boot
- Go to Dev Space → Auto-start
- Toggle "Start on system boot"

### Custom System Prompts
- Navigate to System Prompts
- Create custom prompts for specific tasks
- Save and reuse

### Conversation Management
- Export conversations for backup
- Delete old conversations
- Search conversation history

## 📚 Next Steps

Now that you're set up, explore more features:

- [User Manual](./user-guide.md) - Complete feature guide
- [AI Providers Guide](./ai-providers.md) - Detailed provider setup
- [Stealth Mode Guide](./stealth-mode.md) - Advanced stealth features
- [Keyboard Shortcuts](./keyboard-shortcuts.md) - All shortcuts

## 🆘 Need Help?

- **Documentation**: Check the [docs folder](../docs/)
- **Issues**: [GitHub Issues](https://github.com/Samarthjadhavsj/API-AI-Assistant/issues)
- **Discussions**: [GitHub Discussions](https://github.com/Samarthjadhavsj/API-AI-Assistant/discussions)
- **Email**: samarthjadhavsj121@gmail.com

## 🎉 You're Ready!

Congratulations! You're now ready to use Hey Frank.

Press `Shift + \` and start asking questions!

---

**Pro Tip**: Set up multiple AI providers for redundancy. If one is down, switch to another instantly!
