# Pull Request Checklist

Use this checklist to ensure your PR is ready for review.

## Before Submitting

- [ ] I have read the [Contributing Guidelines](../CONTRIBUTING.md)
- [ ] My code follows the project's code style
- [ ] I have performed a self-review of my code
- [ ] I have commented my code where necessary
- [ ] I have updated the documentation accordingly
- [ ] My changes generate no new warnings
- [ ] I have added tests that prove my fix/feature works
- [ ] New and existing unit tests pass locally
- [ ] Any dependent changes have been merged

## Code Quality

- [ ] All tests pass (`npm test`)
- [ ] No linting errors (`npm run lint`)
- [ ] Code is formatted (`npm run format`)
- [ ] TypeScript compilation successful (`tsc --noEmit`)
- [ ] Rust code compiles (`cargo build`)
- [ ] No new security vulnerabilities (`npm audit`)

## Testing

- [ ] Tested on Windows
- [ ] Tested on macOS (if applicable)
- [ ] Tested on Linux (if applicable)
- [ ] Manual testing completed
- [ ] Edge cases considered and tested
- [ ] Performance impact assessed

## Documentation

- [ ] README updated (if needed)
- [ ] API documentation updated (if needed)
- [ ] CHANGELOG.md updated
- [ ] Code comments added for complex logic
- [ ] User-facing changes documented

## Breaking Changes

- [ ] No breaking changes
- [ ] OR: Breaking changes documented
- [ ] OR: Migration guide provided

## Security

- [ ] No sensitive data exposed
- [ ] API keys/secrets handled properly
- [ ] Input validation implemented
- [ ] XSS prevention measures in place

## UI/UX (if applicable)

- [ ] UI changes match design system
- [ ] Responsive design verified
- [ ] Accessibility considered (WCAG)
- [ ] Dark mode compatible
- [ ] Screenshots added to PR

## Performance

- [ ] No memory leaks introduced
- [ ] Bundle size impact acceptable
- [ ] Database queries optimized
- [ ] No performance regressions

## Git Hygiene

- [ ] Meaningful commit messages
- [ ] Commits are logical units
- [ ] Branch is up to date with base
- [ ] No merge conflicts
- [ ] PR description is clear and complete

---

**By submitting this PR, I confirm that:**
- My contribution is my own original work
- I have the right to submit it under the project license
- I understand and accept the project's Code of Conduct
