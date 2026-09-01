# Branch Protection Configuration

This document outlines the recommended branch protection rules for the Hey Frank repository.

## 🔒 Protected Branches

### Main Branch (`main`)

The `main` branch should have the following protection rules enabled:

#### Required Status Checks

- ✅ **Require status checks to pass before merging**
  - `CI / Test on ubuntu-latest (18.x)`
  - `CI / Test on ubuntu-latest (20.x)`
  - `CI / Test on windows-latest (18.x)`
  - `CI / Test on windows-latest (20.x)`
  - `CI / Test on macos-latest (18.x)`
  - `CI / Test on macos-latest (20.x)`
  - `CI / Build on ubuntu-latest`
  - `CI / Build on windows-latest`
  - `CI / Build on macos-latest`
  - `CI / Security Audit`
  - `CI / Code Quality`

- ✅ **Require branches to be up to date before merging**

#### Pull Request Requirements

- ✅ **Require a pull request before merging**
  - Required approvals: **1** (increase to 2 for critical projects)
  - Dismiss stale pull request approvals when new commits are pushed
  - Require review from Code Owners (if CODEOWNERS file exists)

#### Commit Restrictions

- ✅ **Require signed commits** (recommended)
- ✅ **Require linear history** (optional, enforces squash or rebase)
- ✅ **Include administrators** (admins must follow rules)

#### Additional Protections

- ✅ **Restrict who can push to matching branches**
  - Only maintainers can push directly
  - Require pull requests from everyone else

- ✅ **Allow force pushes**: ❌ Disabled
- ✅ **Allow deletions**: ❌ Disabled

### Develop Branch (`develop`)

The `develop` branch should have lighter protection:

#### Required Status Checks

- ✅ **Require status checks to pass before merging**
  - `CI / Test on ubuntu-latest (20.x)` (at minimum)
  - `CI / Build on ubuntu-latest` (at minimum)

#### Pull Request Requirements

- ✅ **Require a pull request before merging**
  - Required approvals: **1**
  - Allow PR creators to approve their own PRs

#### Commit Restrictions

- ⚠️ **Require linear history**: Optional
- ⚠️ **Include administrators**: Optional

## 🌿 Branch Strategy

### Branch Types

```
main
├── develop
    ├── feature/feature-name
    ├── fix/bug-name
    ├── docs/doc-update
    └── refactor/refactor-name
```

### Branch Naming Convention

- `main` - Production-ready code
- `develop` - Integration branch for features
- `feature/*` - New features
- `fix/*` - Bug fixes
- `hotfix/*` - Emergency fixes for production
- `docs/*` - Documentation updates
- `refactor/*` - Code refactoring
- `test/*` - Test improvements
- `chore/*` - Maintenance tasks

### Workflow

1. **Feature Development**
   ```bash
   # Create feature branch from develop
   git checkout develop
   git pull origin develop
   git checkout -b feature/my-feature
   
   # Make changes and commit
   git add .
   git commit -m "feat: add my feature"
   
   # Push and create PR to develop
   git push origin feature/my-feature
   ```

2. **Bug Fixes**
   ```bash
   # Create fix branch from develop
   git checkout develop
   git pull origin develop
   git checkout -b fix/my-fix
   
   # Make changes and commit
   git add .
   git commit -m "fix: resolve bug"
   
   # Push and create PR to develop
   git push origin fix/my-fix
   ```

3. **Hotfixes**
   ```bash
   # Create hotfix branch from main
   git checkout main
   git pull origin main
   git checkout -b hotfix/critical-fix
   
   # Make changes and commit
   git add .
   git commit -m "fix: critical security issue"
   
   # Push and create PR to main AND develop
   git push origin hotfix/critical-fix
   ```

4. **Release to Production**
   ```bash
   # Create PR from develop to main
   # After approval and merge, tag the release
   git checkout main
   git pull origin main
   git tag -a v0.1.9 -m "Release version 0.1.9"
   git push origin v0.1.9
   ```

## 🛠️ Setting Up Branch Protection

### Via GitHub Web Interface

1. Go to repository **Settings**
2. Click **Branches** in the sidebar
3. Under "Branch protection rules", click **Add rule**
4. Set branch name pattern (e.g., `main`)
5. Configure protection settings as outlined above
6. Click **Create** or **Save changes**

### Via GitHub CLI

```bash
# Protect main branch
gh api repos/Samarthjadhavsj/API-AI-Assistant/branches/main/protection \
  --method PUT \
  --field required_status_checks[strict]=true \
  --field required_status_checks[contexts][]=CI \
  --field required_pull_request_reviews[required_approving_review_count]=1 \
  --field required_pull_request_reviews[dismiss_stale_reviews]=true \
  --field enforce_admins=true \
  --field restrictions=null

# Protect develop branch
gh api repos/Samarthjadhavsj/API-AI-Assistant/branches/develop/protection \
  --method PUT \
  --field required_status_checks[strict]=true \
  --field required_status_checks[contexts][]=CI \
  --field required_pull_request_reviews[required_approving_review_count]=1 \
  --field enforce_admins=false \
  --field restrictions=null
```

## 📋 CODEOWNERS File

Create a `.github/CODEOWNERS` file to automatically request reviews:

```
# Global owners
* @Samarthjadhavsj

# Frontend
/src/** @Samarthjadhavsj
/src/components/** @Samarthjadhavsj

# Backend
/src-tauri/** @Samarthjadhavsj

# Documentation
/docs/** @Samarthjadhavsj
*.md @Samarthjadhavsj

# CI/CD
/.github/workflows/** @Samarthjadhavsj

# Configuration
/src-tauri/tauri.conf.json @Samarthjadhavsj
package.json @Samarthjadhavsj
```

## 🚀 Deployment Protection

### Environment Protection Rules

**Production Environment:**
- ✅ Required reviewers: 1+ maintainers
- ✅ Wait timer: 10 minutes (optional)
- ✅ Deployment branches: `main` only

**Staging Environment:**
- ✅ Required reviewers: 1 team member
- ✅ Deployment branches: `main` and `develop`

### Setting Up Environments

1. Go to repository **Settings**
2. Click **Environments**
3. Click **New environment**
4. Name it `production` or `staging`
5. Configure protection rules
6. Add environment secrets (API keys, etc.)

## 🔐 Required Checks Explained

### CI Pipeline

- **Test on multiple platforms**: Ensures cross-platform compatibility
- **Test on multiple Node versions**: Ensures compatibility with different Node.js versions
- **Build verification**: Ensures the app builds successfully
- **Security audit**: Checks for vulnerable dependencies
- **Code quality**: Ensures code meets quality standards

### Pull Request Review

- **Approval required**: At least one team member must review
- **Dismiss stale reviews**: New commits invalidate old approvals
- **Code owners**: Relevant experts must approve changes

## 📊 Branch Health Monitoring

### Recommended GitHub Actions

Add these status checks to monitor branch health:

```yaml
# .github/workflows/branch-health.yml
name: Branch Health

on:
  schedule:
    - cron: '0 0 * * *'  # Daily
  workflow_dispatch:

jobs:
  check-stale-branches:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/stale@v9
        with:
          repo-token: ${{ secrets.GITHUB_TOKEN }}
          days-before-stale: 30
          days-before-close: 7
          stale-branch-message: 'This branch is stale'
```

## 🗑️ Branch Cleanup Policy

### Automatic Cleanup

- **Delete branch on merge**: Enable in repository settings
- **Stale branches**: Auto-close after 30 days of inactivity
- **Failed branches**: Delete after PR is closed without merge

### Manual Cleanup

```bash
# List merged branches
git branch --merged main

# Delete local merged branches
git branch --merged main | grep -v "main\|develop" | xargs git branch -d

# Delete remote merged branches
git branch -r --merged main | grep -v "main\|develop" | sed 's/origin\///' | xargs -I {} git push origin --delete {}
```

## 📝 Checklist for Repository Administrators

- [ ] Enable branch protection for `main`
- [ ] Enable branch protection for `develop`
- [ ] Create CODEOWNERS file
- [ ] Set up required status checks
- [ ] Configure PR review requirements
- [ ] Enable "Delete branch on merge"
- [ ] Set up deployment environments
- [ ] Configure environment secrets
- [ ] Enable Dependabot alerts
- [ ] Enable Dependabot security updates
- [ ] Enable GitHub Advanced Security (if available)
- [ ] Document branch strategy in README
- [ ] Train team on workflow

## 🔄 Updating Protection Rules

Branch protection rules should be reviewed and updated:

- **Monthly**: Review status check requirements
- **Quarterly**: Review team access and permissions
- **After major incidents**: Update rules to prevent similar issues
- **When team grows**: Adjust review requirements

## 📚 Resources

- [GitHub Branch Protection Documentation](https://docs.github.com/en/repositories/configuring-branches-and-merges-in-your-repository/defining-the-mergeability-of-pull-requests/about-protected-branches)
- [GitHub Environments Documentation](https://docs.github.com/en/actions/deployment/targeting-different-environments/using-environments-for-deployment)
- [Git Flow Workflow](https://www.atlassian.com/git/tutorials/comparing-workflows/gitflow-workflow)

---

**Last Updated**: January 2025
