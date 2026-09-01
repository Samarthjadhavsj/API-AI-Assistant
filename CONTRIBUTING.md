# Contributing to Hey Frank AI Assistant

Thank you for considering contributing to Hey Frank! This document provides guidelines and instructions for contributing.

## 🌟 Ways to Contribute

- 🐛 Report bugs
- 💡 Suggest new features
- 📝 Improve documentation
- 🔧 Submit bug fixes
- ✨ Add new features
- 🧪 Write tests
- 🎨 Improve UI/UX

## 📋 Before You Start

1. Check existing [Issues](https://github.com/Samarthjadhavsj/API-AI-Assistant/issues) and [Pull Requests](https://github.com/Samarthjadhavsj/API-AI-Assistant/pulls)
2. Read our [Code of Conduct](#code-of-conduct)
3. Review our [Development Workflow](#development-workflow)

## 🚀 Development Setup

### Prerequisites

- **Node.js** 18.x or higher
- **Rust** 1.70 or higher
- **pnpm** or **npm**
- **Git**

### Installation

```bash
# Clone the repository
git clone https://github.com/Samarthjadhavsj/API-AI-Assistant.git
cd API-AI-Assistant

# Install dependencies
npm install

# Run development server
npm run tauri dev
```

### Project Structure

```
API-AI-Assistant/
├── src/                    # Frontend React code
│   ├── components/        # Reusable UI components
│   ├── pages/            # Application pages
│   ├── hooks/            # Custom React hooks
│   ├── lib/              # Utility functions
│   ├── types/            # TypeScript definitions
│   └── contexts/         # React contexts
├── src-tauri/            # Rust backend
│   ├── src/              # Rust source code
│   └── Cargo.toml        # Rust dependencies
├── tests/                # Test files
└── docs/                 # Documentation
```

## 🔄 Development Workflow

### 1. Create a Feature Branch

```bash
# Update main branch
git checkout main
git pull origin main

# Create feature branch
git checkout -b feature/your-feature-name
```

### Branch Naming Convention

- `feature/` - New features
- `fix/` - Bug fixes
- `docs/` - Documentation updates
- `refactor/` - Code refactoring
- `test/` - Test improvements
- `chore/` - Maintenance tasks

**Examples:**
- `feature/voice-recognition`
- `fix/window-focus-bug`
- `docs/update-readme`

### 2. Make Your Changes

- Write clean, readable code
- Follow existing code style
- Add comments for complex logic
- Update tests if needed
- Update documentation

### 3. Commit Your Changes

We follow [Conventional Commits](https://www.conventionalcommits.org/) specification.

#### Commit Message Format

```
<type>(<scope>): <subject>

<body>

<footer>
```

#### Types

- `feat`: New feature
- `fix`: Bug fix
- `docs`: Documentation changes
- `style`: Code formatting (no functional changes)
- `refactor`: Code restructuring
- `test`: Adding or updating tests
- `chore`: Maintenance tasks
- `perf`: Performance improvements

#### Examples

```bash
git commit -m "feat(ai): add Claude AI provider support"
git commit -m "fix(window): prevent overlay from hiding on focus loss"
git commit -m "docs(readme): update installation instructions"
git commit -m "test(chat): add conversation management tests"
```

### 4. Push to Your Fork

```bash
git push origin feature/your-feature-name
```

### 5. Create a Pull Request

1. Go to [GitHub repository](https://github.com/Samarthjadhavsj/API-AI-Assistant)
2. Click "New Pull Request"
3. Select your branch
4. Fill out the PR template completely
5. Request review

## 📝 Pull Request Guidelines

### PR Title Format

```
<type>(<scope>): <description>
```

**Examples:**
- `feat(voice): add speech-to-text support`
- `fix(ui): resolve sidebar scrolling issue`
- `docs(api): document new endpoints`

### PR Description

Include:
- **Clear description** of changes
- **Motivation** for the change
- **Testing** performed
- **Screenshots** (if UI changes)
- **Breaking changes** (if any)
- **Related issues** (use "Closes #123")

### PR Checklist

Before submitting, ensure:
- [ ] Code follows project style
- [ ] All tests pass (`npm test`)
- [ ] Documentation updated
- [ ] No console errors
- [ ] Self-reviewed code
- [ ] Tested locally

## 🧪 Testing

### Running Tests

```bash
# Run all tests
npm test

# Run tests in watch mode
npm run test:watch

# Run tests with coverage
npm run test:coverage

# Run tests with UI
npm run test:ui
```

### Writing Tests

- Write tests for new features
- Update tests for bug fixes
- Test edge cases
- Use descriptive test names

**Example:**

```typescript
import { describe, it, expect } from 'vitest';

describe('Feature Name', () => {
  it('should do something specific', () => {
    // Arrange
    const input = 'test';
    
    // Act
    const result = myFunction(input);
    
    // Assert
    expect(result).toBe('expected');
  });
});
```

## 🎨 Code Style

### TypeScript/React

- Use **TypeScript** for type safety
- Follow **React best practices**
- Use **functional components** with hooks
- Keep components **small and focused**
- Use **descriptive variable names**

### Formatting

We use Prettier for formatting:

```bash
# Format code
npm run format

# Check formatting
npm run format:check
```

### Linting

```bash
# Run linter
npm run lint

# Fix linting issues
npm run lint:fix
```

## 📚 Documentation

### Code Comments

- Add comments for complex logic
- Use JSDoc for functions
- Document edge cases
- Explain "why" not "what"

**Example:**

```typescript
/**
 * Generates a unique conversation ID with timestamp
 * @param prefix - Prefix for the ID (e.g., 'chat', 'sys')
 * @returns Unique conversation ID string
 */
function generateConversationId(prefix: string): string {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}
```

### README Updates

Update README.md if your changes affect:
- Installation steps
- Usage instructions
- API documentation
- Configuration options

## 🐛 Reporting Bugs

### Before Reporting

1. Check [existing issues](https://github.com/Samarthjadhavsj/API-AI-Assistant/issues)
2. Ensure you're using the latest version
3. Collect relevant information

### Bug Report Template

```markdown
## Bug Description
Clear description of the bug

## Steps to Reproduce
1. Step one
2. Step two
3. Step three

## Expected Behavior
What should happen

## Actual Behavior
What actually happens

## Environment
- OS: [Windows 11 / macOS 14 / Ubuntu 22.04]
- Version: [0.1.8]
- Node: [18.x]
- Browser: [If applicable]

## Screenshots
Add screenshots if applicable

## Additional Context
Any other relevant information
```

## 💡 Feature Requests

### Before Requesting

1. Check [existing feature requests](https://github.com/Samarthjadhavsj/API-AI-Assistant/issues?q=is%3Aissue+is%3Aopen+label%3Aenhancement)
2. Consider if it aligns with project goals
3. Think about implementation

### Feature Request Template

```markdown
## Feature Description
Clear description of the feature

## Use Case
Why is this feature needed?

## Proposed Solution
How could this be implemented?

## Alternatives Considered
Other approaches you've thought about

## Additional Context
Any other relevant information
```

## 🔍 Code Review Process

### For Contributors

- Be open to feedback
- Respond to comments promptly
- Make requested changes
- Keep PR scope focused

### For Reviewers

- Be constructive and respectful
- Explain reasoning for feedback
- Approve when ready
- Test changes locally if possible

## 🏆 Recognition

Contributors are recognized in:
- GitHub contributors list
- CHANGELOG.md for significant contributions
- README.md acknowledgments

## 📞 Getting Help

- **Documentation**: Check the docs/ folder
- **Issues**: Search existing issues or create new one
- **Discussions**: Use GitHub Discussions for questions
- **Email**: samarthjadhavsj121@gmail.com

## 📜 Code of Conduct

### Our Standards

- Be respectful and inclusive
- Welcome newcomers
- Accept constructive criticism
- Focus on what's best for the community
- Show empathy

### Unacceptable Behavior

- Harassment or discrimination
- Trolling or insulting comments
- Public or private harassment
- Publishing private information
- Unprofessional conduct

### Enforcement

Violations will result in:
1. Warning
2. Temporary ban
3. Permanent ban

## 📄 License

By contributing, you agree that your contributions will be licensed under the GPL-3.0 License.

---

**Thank you for contributing to Hey Frank! 🎉**
