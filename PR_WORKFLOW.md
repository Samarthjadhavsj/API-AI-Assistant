# Pull Request (PR) Workflow Guide

## 🎯 What is a Pull Request?

A Pull Request (PR) is a way to propose changes to your codebase. It allows you to:
- Review code before merging to main
- Track what changed and why
- Collaborate with others
- Maintain clean commit history
- Test features in isolation

---

## 🌟 Why Use PRs (Even for Solo Projects)?

### Benefits:
1. **Better code review** - See all changes before merging
2. **Clean history** - Organized, documented changes
3. **Easy rollback** - Revert features if needed
4. **CI/CD integration** - Automatic tests on PRs
5. **Professional workflow** - Industry best practice

---

## 🔄 Complete PR Workflow

### Step 1: Create Feature Branch

```bash
# Always start from main
git checkout main
git pull origin main

# Create descriptive branch
git checkout -b feature/feature-name
# Or for docs: docs/document-name
# Or for fixes: fix/bug-description
```

**Branch naming conventions:**
- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation
- `refactor/` - Code improvements
- `test/` - Adding tests

---

### Step 2: Make Changes and Commit

```bash
# Make your code changes
# Test thoroughly

# Stage changes
git add .

# Commit with clear message
git commit -m "feat: Add conversation tagging system"
```

**Commit message format:**
- `feat:` - New feature
- `fix:` - Bug fix
- `docs:` - Documentation
- `refactor:` - Code refactoring
- `test:` - Adding tests
- `chore:` - Maintenance tasks

---

### Step 3: Push Branch to GitHub

```bash
# Push your feature branch
git push -u origin feature/feature-name
```

---

### Step 4: Create Pull Request on GitHub

#### Method A: Via GitHub Website

1. Go to: https://github.com/Samarthjadhavsj/API-AI-Assistant
2. You'll see banner: **"Compare & pull request"**
3. Click the button

**OR**

1. Go to "Pull requests" tab
2. Click **"New pull request"**
3. Select:
   - **base:** `main` ← **compare:** `feature/your-branch`
4. Click **"Create pull request"**

#### Fill in PR Details:

**Title:** Short, descriptive
```
Add conversation tagging system
```

**Description:**
```markdown
## What Changed
- Added tags table to database
- Created tag management UI
- Implemented tag filtering

## Why
Users need to organize conversations by topic

## How to Test
1. Run `npm run tauri dev`
2. Go to Chat History
3. Click "Add Tag" button
4. Create and assign tags

## Screenshots
[Add screenshots if UI changes]

## Checklist
- [x] Code works in dev mode
- [x] Production build successful
- [x] No console errors
- [x] Documentation updated
```

5. Click **"Create pull request"**

---

#### Method B: Via GitHub CLI (Optional)

```bash
# Install GitHub CLI: https://cli.github.com/

# Create PR from command line
gh pr create --title "Add conversation tagging" --body "Description here"

# Or interactive mode
gh pr create
```

---

### Step 5: Review and Merge

#### Self Review (Solo Projects):
1. Review the **"Files changed"** tab
2. Check all changes are correct
3. Add comments if needed
4. Click **"Merge pull request"**
5. Choose merge type:
   - **Merge commit** (default, keeps all commits)
   - **Squash and merge** (combines into one commit)
   - **Rebase and merge** (linear history)
6. Click **"Confirm merge"**
7. Delete branch (optional but recommended)

---

### Step 6: Update Local Repository

```bash
# Switch back to main
git checkout main

# Pull latest changes
git pull origin main

# Delete local feature branch (optional)
git branch -d feature/feature-name
```

---

## 🎨 PR Workflow Diagram

```
main branch
    │
    ├── Create feature branch
    │   └── feature/new-feature
    │       ├── Commit 1: Add database migration
    │       ├── Commit 2: Add backend API
    │       ├── Commit 3: Add UI components
    │       └── Push to GitHub
    │
    ├── Create Pull Request on GitHub
    │   ├── Review changes
    │   ├── Run tests (optional CI/CD)
    │   └── Approve
    │
    ├── Merge PR to main
    │   └── feature/new-feature → main
    │
    └── Continue with next feature
```

---

## 📝 Example: Complete PR Workflow

### Scenario: Adding Dark Theme

```bash
# 1. Start from main
git checkout main
git pull origin main

# 2. Create feature branch
git checkout -b feature/dark-theme

# 3. Make changes
# - Edit theme files
# - Update CSS
# - Test in app

# 4. Commit changes
git add .
git commit -m "feat: Add dark theme support with toggle"

# 5. Push to GitHub
git push -u origin feature/dark-theme

# 6. Create PR on GitHub
# Visit: https://github.com/Samarthjadhavsj/API-AI-Assistant/compare/feature/dark-theme
# Fill in title and description
# Click "Create pull request"

# 7. Review and merge on GitHub
# Click "Merge pull request"
# Click "Confirm merge"
# Click "Delete branch"

# 8. Update local main
git checkout main
git pull origin main
git branch -d feature/dark-theme

# Done! Feature is now in main branch
```

---

## 🔍 PR Best Practices

### Do's ✅

1. **Keep PRs small** - One feature per PR
2. **Write clear descriptions** - Explain what and why
3. **Test before creating PR** - Ensure it works
4. **Update documentation** - If code changes affect docs
5. **Review your own changes** - Check the diff before merging
6. **Use meaningful titles** - "Add user authentication" not "Updates"
7. **Link issues** - Reference related issues: "Fixes #123"

### Don'ts ❌

1. **Don't commit directly to main** - Always use branches
2. **Don't create huge PRs** - Break into smaller ones
3. **Don't skip testing** - Test before pushing
4. **Don't merge without review** - Even quick self-review helps
5. **Don't leave PRs open indefinitely** - Merge or close

---

## 🚀 GitHub PR Features

### Labels
Add labels to categorize PRs:
- `enhancement` - New feature
- `bug` - Bug fix
- `documentation` - Docs update
- `good first issue` - Easy for beginners

### Assignees
Assign PR to yourself or team members

### Reviewers
Request reviews from collaborators

### Projects
Link PR to project board

### Milestones
Group PRs into releases

---

## 🤖 Automated Workflows (GitHub Actions)

Example: Auto-test on PR

Create `.github/workflows/pr-check.yml`:

```yaml
name: PR Checks

on:
  pull_request:
    branches: [ main ]

jobs:
  test:
    runs-on: windows-latest
    
    steps:
    - uses: actions/checkout@v3
    
    - name: Setup Node
      uses: actions/setup-node@v3
      with:
        node-version: '18'
    
    - name: Install dependencies
      run: npm install
    
    - name: Type check
      run: npm run build
    
    - name: Test build
      run: npm run tauri build
```

This automatically tests every PR!

---

## 📊 PR Templates

Create `.github/pull_request_template.md`:

```markdown
## Description
[Describe your changes]

## Type of Change
- [ ] Bug fix
- [ ] New feature
- [ ] Documentation update
- [ ] Code refactoring

## How to Test
1. Step 1
2. Step 2
3. Expected result

## Checklist
- [ ] Code builds successfully
- [ ] Tested in dev mode
- [ ] Tested production build
- [ ] Documentation updated
- [ ] No breaking changes

## Screenshots (if applicable)
[Add screenshots]

## Related Issues
Fixes #[issue number]
```

---

## 🎯 Quick Reference

| Task | Command |
|------|---------|
| Create branch | `git checkout -b feature/name` |
| Commit changes | `git commit -m "feat: description"` |
| Push branch | `git push -u origin feature/name` |
| Update main | `git checkout main && git pull` |
| Delete branch | `git branch -d feature/name` |
| View branches | `git branch -a` |

---

## 🔄 Keeping Feature Branch Updated

If main changes while working on feature:

```bash
# On your feature branch
git checkout feature/your-feature

# Get latest main
git fetch origin main

# Merge main into your branch
git merge origin/main

# Or rebase (cleaner history)
git rebase origin/main

# Push updated branch
git push origin feature/your-feature --force-with-lease
```

---

## 🐛 Troubleshooting

### Issue: Can't push branch
```bash
# Make sure you're on the right branch
git branch

# If on main, create feature branch
git checkout -b feature/name
```

### Issue: Merge conflicts
```bash
# Update from main
git fetch origin main
git merge origin/main

# Resolve conflicts in files
# Then commit
git add .
git commit -m "Merge: Resolve conflicts with main"
git push
```

### Issue: Want to undo changes
```bash
# Undo last commit (keep changes)
git reset --soft HEAD~1

# Discard all changes
git reset --hard HEAD

# Discard specific file
git checkout -- filename
```

---

## 📱 GitHub Mobile App

You can review and merge PRs on mobile:
- **GitHub Mobile** (iOS/Android)
- Review code
- Approve/request changes
- Merge PRs
- Comment on discussions

---

## 🎉 Success Metrics

Your PR workflow is successful when:
- ✅ All features go through PRs
- ✅ No direct commits to main
- ✅ Clean, readable history
- ✅ Easy to find and review changes
- ✅ Can rollback features easily

---

## 📚 Next Steps

1. **Practice:** Create a small PR for practice
2. **Automate:** Set up GitHub Actions
3. **Template:** Create PR template
4. **Branch protection:** Enable on main branch
5. **Collaborate:** Invite others to review

---

## 🔗 Useful Links

- [GitHub PR Documentation](https://docs.github.com/en/pull-requests)
- [GitHub Flow Guide](https://guides.github.com/introduction/flow/)
- [Conventional Commits](https://www.conventionalcommits.org/)

---

**Your Repository:** https://github.com/Samarthjadhavsj/API-AI-Assistant

**Current Status:** ✅ Main branch pushed, ready for PR workflow!

---

## 🎯 Quick Start: Your First PR

```bash
# 1. Create feature branch
git checkout -b feature/my-first-pr

# 2. Make a small change (edit README, add comment, etc.)

# 3. Commit
git add .
git commit -m "docs: Update README with setup instructions"

# 4. Push
git push -u origin feature/my-first-pr

# 5. Go to GitHub and create PR

# 6. Review and merge

# 7. Delete branch and update local
git checkout main
git pull origin main
git branch -d feature/my-first-pr
```

**You're now a PR pro!** 🚀
