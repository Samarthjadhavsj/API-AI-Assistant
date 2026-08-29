# GitHub Setup Guide

## 🎯 Quick Setup (5 Minutes)

This guide will help you push your project to GitHub and set up proper version control.

---

## 📋 Prerequisites

- [x] Git installed (already done ✅)
- [ ] GitHub account
- [ ] Git configured with your email

---

## ⚙️ Step 1: Configure Git (If Not Done Already)

```bash
# Set your name
git config --global user.name "Your Name"

# Set your email (use your GitHub email)
git config --global user.email "your-email@example.com"

# Verify configuration
git config --list
```

---

## 🌐 Step 2: Create GitHub Repository

### Option A: Via GitHub Website (Recommended)
1. Go to [https://github.com/new](https://github.com/new)
2. Fill in details:
   - **Repository name:** `api-ai-assistant` (or your preferred name)
   - **Description:** "A privacy-first AI assistant that works seamlessly during meetings, interviews, and conversations"
   - **Visibility:** 
     - ✅ **Public** (recommended for open source)
     - ⚠️ **Private** (if you want to keep it private)
   - **DO NOT** initialize with README (we already have one)
   - **DO NOT** add .gitignore (we already have one)
   - **DO NOT** add license (we already have one)
3. Click **"Create repository"**

### Option B: Via GitHub CLI (Advanced)
```bash
# Install GitHub CLI first: https://cli.github.com/
gh repo create api-ai-assistant --public --source=. --remote=origin
```

---

## 🔗 Step 3: Connect Local Repository to GitHub

After creating the repository on GitHub, you'll see a page with instructions. Use these commands:

```bash
cd API-AI-Assistant-main

# Add GitHub as remote origin
git remote add origin https://github.com/YOUR_USERNAME/api-ai-assistant.git

# Verify remote was added
git remote -v

# Push to GitHub
git push -u origin main
```

**Replace `YOUR_USERNAME` with your actual GitHub username!**

---

## 🔐 Step 4: Authentication

### If Push Fails with Authentication Error:

#### Option A: Personal Access Token (Recommended)
1. Go to GitHub Settings → Developer settings → Personal access tokens → Tokens (classic)
2. Click "Generate new token (classic)"
3. Give it a name: "API AI Assistant Development"
4. Select scopes:
   - ✅ `repo` (full control of private repositories)
5. Click "Generate token"
6. **COPY THE TOKEN** (you won't see it again!)
7. When pushing, use:
   ```bash
   # Username: your GitHub username
   # Password: paste your personal access token
   git push -u origin main
   ```

#### Option B: SSH Key (Alternative)
1. Generate SSH key:
   ```bash
   ssh-keygen -t ed25519 -C "your-email@example.com"
   ```
2. Add to GitHub: Settings → SSH and GPG keys → New SSH key
3. Use SSH remote instead:
   ```bash
   git remote set-url origin git@github.com:YOUR_USERNAME/api-ai-assistant.git
   git push -u origin main
   ```

---

## ✅ Step 5: Verify Upload

After successful push:

1. Visit: `https://github.com/YOUR_USERNAME/api-ai-assistant`
2. You should see:
   - ✅ All your files
   - ✅ README.md displayed
   - ✅ 3 commits
   - ✅ License file

---

## 📝 Step 6: Update README URLs

The README still has placeholder URLs. Let's update them:

```bash
# Edit package.json and README.md
# Replace:
# YOUR_USERNAME → your actual GitHub username

# Then commit:
git add package.json README.md
git commit -m "docs: Update repository URLs with actual GitHub username"
git push
```

---

## 🌿 Step 7: Set Up Branch Protection (Optional but Recommended)

### For Main Branch Protection:
1. Go to repository Settings → Branches
2. Add rule for `main` branch:
   - ✅ Require pull request reviews before merging
   - ✅ Require status checks to pass
   - ✅ Require branches to be up to date

This prevents direct pushes to main and enforces PR workflow.

---

## 🔄 Development Workflow with GitHub

### Creating a New Feature

```bash
# 1. Create and switch to feature branch
git checkout -b feature/conversation-tagging

# 2. Make changes, test, develop...
npm run tauri dev

# 3. Stage and commit changes
git add .
git commit -m "feat: Add conversation tagging system"

# 4. Push feature branch to GitHub
git push -u origin feature/conversation-tagging

# 5. Create Pull Request on GitHub
# Go to your repository → Pull Requests → New Pull Request
# Select: base: main ← compare: feature/conversation-tagging
# Add description and create PR

# 6. After PR is approved and merged, update local main
git checkout main
git pull origin main

# 7. Delete feature branch (optional)
git branch -d feature/conversation-tagging
git push origin --delete feature/conversation-tagging
```

---

## 📦 Step 8: Set Up GitHub Releases (For Distributing App)

### Creating Your First Release

```bash
# 1. Build production version
npm run tauri build

# 2. Installers will be in:
# src-tauri/target/release/bundle/

# 3. Create a git tag
git tag -a v0.1.8 -m "Release version 0.1.8"
git push origin v0.1.8

# 4. Create release on GitHub
# Go to: Releases → Create a new release
# - Choose tag: v0.1.8
# - Release title: "v0.1.8 - Initial Release"
# - Description: List features and changes
# - Upload installer files from bundle folder
# - Click "Publish release"
```

---

## 🤖 Step 9: Set Up GitHub Actions (Optional - CI/CD)

Create `.github/workflows/build.yml` for automatic building:

```yaml
name: Build and Test

on:
  push:
    branches: [ main ]
  pull_request:
    branches: [ main ]

jobs:
  build:
    runs-on: windows-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node.js
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Setup Rust
      uses: actions-rs/toolchain@v1
      with:
        toolchain: stable
    
    - name: Install dependencies
      run: npm install
    
    - name: Build
      run: npm run build
    
    - name: Build Tauri
      run: npm run tauri build
```

This will automatically build your app on every push!

---

## 📊 Repository Settings Checklist

Go to Settings and configure:

### General
- [ ] Add description
- [ ] Add website (optional)
- [ ] Add topics/tags: `tauri`, `ai-assistant`, `desktop-app`, `react`, `rust`

### Options
- [x] Issues (enabled - for bug reports)
- [x] Projects (enabled - for planning)
- [ ] Wiki (optional)
- [x] Discussions (optional - for community)

### Pages (Optional - for documentation site)
- [ ] Enable GitHub Pages
- [ ] Source: Deploy from main branch `/docs`

---

## 🎯 Quick Command Reference

```bash
# Check status
git status

# View commit history
git log --oneline

# See what changed
git diff

# Undo last commit (keep changes)
git reset --soft HEAD~1

# Sync with GitHub
git pull origin main

# List all branches
git branch -a

# Switch branches
git checkout branch-name

# Delete local branch
git branch -d branch-name

# Update from main
git checkout your-feature-branch
git merge main
```

---

## 🆘 Troubleshooting

### Issue: "Remote origin already exists"
```bash
git remote remove origin
git remote add origin https://github.com/YOUR_USERNAME/api-ai-assistant.git
```

### Issue: "Failed to push - rejected"
```bash
# Pull latest changes first
git pull origin main --rebase
git push origin main
```

### Issue: "Authentication failed"
- Use Personal Access Token instead of password
- Or set up SSH keys

### Issue: "Large files causing issues"
```bash
# Add to .gitignore
node_modules/
src-tauri/target/
dist/
.DS_Store

# Remove from git if already tracked
git rm -r --cached node_modules
git commit -m "Remove node_modules from git"
```

---

## 🔒 Security Best Practices

### Never Commit These:
- ❌ API keys
- ❌ Passwords
- ❌ Personal access tokens
- ❌ `.env` files with secrets
- ❌ Private keys

### Use `.gitignore`:
The project already has a good `.gitignore` file. Make sure it includes:
```
node_modules/
src-tauri/target/
dist/
.env
*.log
```

---

## 📈 GitHub Project Management (Optional)

### Use GitHub Projects for Planning:
1. Go to Projects tab
2. Create new project: "API AI Assistant Development"
3. Add columns: To Do, In Progress, Testing, Done
4. Create issues for features
5. Move cards as you work

### Use Issues for Tracking:
- Bug reports
- Feature requests
- Questions
- Documentation improvements

---

## 🎉 Success Checklist

After completing this guide, you should have:

- [x] Local git repository initialized
- [ ] GitHub repository created
- [ ] Code pushed to GitHub
- [ ] README URLs updated
- [ ] First release created (optional)
- [ ] GitHub Actions set up (optional)
- [ ] Branch protection enabled (optional)

---

## 🚀 Next Steps

1. **Push to GitHub** (follow Step 3 above)
2. **Update URLs** (Step 6)
3. **Choose a feature** from FEATURE_ROADMAP.md
4. **Start developing** following TESTING_GUIDE.md

---

## 📞 Need Help?

- GitHub Docs: https://docs.github.com
- Git Docs: https://git-scm.com/doc
- Ask in GitHub Discussions (after enabling)

---

**Ready to push?** Run these commands:

```bash
cd API-AI-Assistant-main

# Set your GitHub username (replace YOUR_USERNAME)
git remote add origin https://github.com/YOUR_USERNAME/api-ai-assistant.git

# Push everything to GitHub
git push -u origin main
```

Good luck! 🎉
