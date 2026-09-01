# Git Branch Strategy - Professional Development Workflow

## Branch Structure

This project follows a professional Git workflow with feature branches, proper PR reviews, and semantic commit messages.

### Main Branches
- `main` - Production-ready code
- `develop` - Integration branch for features
- `staging` - Pre-production testing

### Feature Branches (25+)

#### Core Infrastructure (5 branches)
1. `feature/project-setup` - Initial Tauri + React + TypeScript setup
2. `feature/database-sqlite` - SQLite database integration with Tauri plugin
3. `feature/routing-system` - React Router v7 implementation
4. `feature/theme-system` - Dark/Light theme with Tailwind CSS
5. `feature/error-boundaries` - Error handling and boundaries

#### AI Integration (5 branches)
6. `feature/ai-provider-integration` - Multi-provider AI support (OpenAI, Claude, etc.)
7. `feature/streaming-responses` - Real-time AI response streaming
8. `feature/conversation-management` - Chat history and conversation handling
9. `feature/system-prompts` - Custom system prompt management
10. `feature/context-management` - AI context and memory handling

#### UI Components (5 branches)
11. `feature/component-library` - Radix UI + shadcn/ui components
12. `feature/sidebar-navigation` - Application sidebar and navigation
13. `feature/chat-interface` - Main chat UI components
14. `feature/markdown-renderer` - Code highlighting and markdown support
15. `feature/popover-system` - Transparent popover components

#### Window Management (4 branches)
16. `feature/overlay-window` - Transparent overlay window system
17. `feature/persistent-toggle` - Window toggle persistence on focus loss
18. `feature/window-transparency` - WebView2 true transparency
19. `feature/toggle-settings-access` - Compact settings interface

#### System Integration (4 branches)
20. `feature/keyboard-shortcuts` - Global shortcut management
21. `feature/system-tray` - System tray icon and menu
22. `feature/auto-start` - Application auto-start on boot
23. `feature/screen-capture` - Screenshot functionality

#### Advanced Features (5 branches)
24. `feature/voice-input` - Speech-to-text integration
25. `feature/file-attachments` - Image and file upload support
26. `feature/audio-settings` - System audio configuration
27. `feature/response-customization` - AI response length and formatting
28. `feature/conversation-export` - Export conversations to markdown

#### Testing & Quality (3 branches)
29. `feature/unit-tests` - Unit test suite with Vitest
30. `feature/integration-tests` - Integration testing
31. `feature/manual-test-suite` - Manual testing documentation

#### Bug Fixes & Improvements (2 branches)
32. `fix/message-history-visibility` - Fix conversation history icon bug
33. `fix/conversation-persistence` - Fix conversation save on errors

### Branch Naming Convention

```
feature/   - New features
fix/       - Bug fixes
refactor/  - Code refactoring
docs/      - Documentation
test/      - Testing improvements
chore/     - Maintenance tasks
perf/      - Performance improvements
```

### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

**Types:**
- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation
- `style`: Formatting
- `refactor`: Code restructuring
- `test`: Testing
- `chore`: Maintenance

**Examples:**
```
feat(ai): add Claude AI provider support
fix(window): prevent overlay from hiding on focus loss
docs(readme): update installation instructions
test(chat): add conversation management tests
```

### Pull Request Template

```markdown
## Description
Brief description of changes

## Type of Change
- [ ] New feature
- [ ] Bug fix
- [ ] Breaking change
- [ ] Documentation update

## Testing
- [ ] Unit tests pass
- [ ] Manual testing completed
- [ ] No regression issues

## Screenshots
(if applicable)

## Related Issues
Closes #123
```

### Development Workflow

1. **Create Feature Branch**
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. **Develop & Commit**
   ```bash
   git add .
   git commit -m "feat(scope): description"
   ```

3. **Push to Remote**
   ```bash
   git push origin feature/your-feature-name
   ```

4. **Create Pull Request**
   - Target branch: `develop` (or `main`)
   - Add description and testing notes
   - Request review

5. **Merge After Approval**
   - Squash and merge (for clean history)
   - Delete feature branch after merge

### Branch Protection Rules

**Main Branch:**
- Require PR reviews (1+ approvals)
- Require status checks to pass
- No force push
- No direct commits

**Develop Branch:**
- Require status checks
- Allow force push (with caution)

### Release Process

1. Create `release/v0.x.x` branch from `develop`
2. Perform final testing
3. Merge to `main`
4. Tag with version number
5. Create GitHub release with changelog

---

**Current Status:** Ready to implement this structure
**Next Steps:** Create and push all feature branches
