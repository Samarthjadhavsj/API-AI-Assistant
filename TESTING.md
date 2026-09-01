# Testing Documentation

## Overview

This document describes the automated test suite for the Hey Frank AI Assistant application.

## Test Framework

- **Test Runner**: Vitest
- **Component Testing**: React Testing Library
- **Assertions**: Vitest + @testing-library/jest-dom matchers
- **Coverage**: V8 provider

## Running Tests

### Run All Tests
```bash
npm test
```

### Run Tests in Watch Mode
```bash
npm run test:watch
```

### Run Tests with Coverage
```bash
npm run test:coverage
```

### Run Specific Test File
```bash
npm test -- src/lib/utils.test.ts
```

### Run Tests Matching Pattern
```bash
npm test -- --grep="validation"
```

## Test Structure

```
src/
├── lib/
│   ├── curl-validator.test.ts      # cURL validation tests
│   ├── utils.test.ts                # Utility function tests
│   ├── chat-constants.test.ts      # Chat constants tests
│   └── storage/
│       └── helper.test.ts          # Storage helper tests
├── components/
│   └── TextInput/
│       └── TextInput.test.tsx      # Component tests
├── hooks/
│   └── useCopyToClipboard.test.ts  # Hook tests
├── config/
│   └── ai-providers.test.ts        # Provider config tests
└── test/
    └── setup.ts                    # Test setup and mocks
```

## Test Categories

### 1. Unit Tests
**Location**: `src/lib/**/*.test.ts`

Tests for pure functions and utilities:
- curl-validator: cURL command validation logic
- utils: Utility functions (cn, floatArrayToWav)
- chat-constants: ID generation and validation
- storage/helper: Safe localStorage wrapper

**Coverage**: ~95%+ for utility functions

### 2. Component Tests
**Location**: `src/components/**/*.test.tsx`

Tests for React components:
- TextInput: Input field behavior and interactions
- More components can be added

**Coverage**: Key user interactions and edge cases

### 3. Hook Tests
**Location**: `src/hooks/**/*.test.ts`

Tests for custom React hooks:
- useCopyToClipboard: Clipboard operations
- More hooks can be added

**Coverage**: Hook logic and state management

### 4. Configuration Tests
**Location**: `src/config/**/*.test.ts`

Tests for configuration validation:
- ai-providers: All 11 AI provider configurations
- Validates structure, URLs, placeholders

**Coverage**: 100% of provider configs

## Test Coverage Goals

| Category | Target Coverage | Current Status |
|----------|----------------|----------------|
| Utility Functions | >95% | ✅ Achieved |
| Components | >80% | 🟡 In Progress |
| Hooks | >85% | 🟡 In Progress |
| Configurations | 100% | ✅ Achieved |
| Integration | >70% | ⚪ Planned |

## Writing New Tests

### Unit Test Example
```typescript
import { describe, it, expect } from 'vitest';
import { myFunction } from './myModule';

describe('myFunction', () => {
  it('should do something', () => {
    const result = myFunction('input');
    expect(result).toBe('expected output');
  });
});
```

### Component Test Example
```typescript
import { render, screen, fireEvent } from '@testing-library/react';
import { MyComponent } from './MyComponent';

it('should render and handle click', () => {
  render(<MyComponent />);
  const button = screen.getByRole('button');
  fireEvent.click(button);
  expect(button).toHaveClass('active');
});
```

### Hook Test Example
```typescript
import { renderHook, act } from '@testing-library/react';
import { useMyHook } from './useMyHook';

it('should update state', () => {
  const { result } = renderHook(() => useMyHook());
  act(() => {
    result.current.updateValue('new');
  });
  expect(result.current.value).toBe('new');
});
```

## Test Mocks

### Tauri API Mocks
Located in `src/test/setup.ts`:
- `@tauri-apps/api/core` (invoke)
- `@tauri-apps/api/event` (listen, emit)

### Browser API Mocks
- localStorage
- window.matchMedia
- navigator.clipboard

## CI/CD Integration

### GitHub Actions (Example)
```yaml
- name: Run Tests
  run: npm test

- name: Upload Coverage
  run: npm run test:coverage
```

## Troubleshooting

### Tests Fail with "Cannot find module"
- Run `npm install` to ensure all dependencies are installed
- Check `vitest.config.ts` path aliases

### Component Tests Fail
- Ensure `@testing-library/react` is installed
- Check test setup in `src/test/setup.ts`

### Mock Not Working
- Clear mocks with `vi.clearAllMocks()` in `beforeEach`
- Check mock implementation in setup file

## Best Practices

1. **Test Behavior, Not Implementation**
   - Focus on what the component/function does, not how

2. **Arrange-Act-Assert Pattern**
   ```typescript
   // Arrange: Set up test data
   const input = 'test';
   
   // Act: Execute the code
   const result = myFunction(input);
   
   // Assert: Verify the result
   expect(result).toBe('expected');
   ```

3. **Descriptive Test Names**
   - ✅ `it('should validate correct curl command')`
   - ❌ `it('test 1')`

4. **Test Edge Cases**
   - Empty inputs
   - Null/undefined
   - Very large inputs
   - Special characters
   - Error conditions

5. **Keep Tests Fast**
   - Mock external dependencies
   - Avoid real API calls
   - Use fake timers when needed

6. **Isolate Tests**
   - Each test should be independent
   - Clean up after each test
   - Don't rely on test execution order

## Test Data

### Mock Data Location
Create mock data in `src/test/mockData/`:
```
src/test/mockData/
├── conversations.ts
├── messages.ts
└── providers.ts
```

## Performance

- All tests should complete in < 30 seconds
- Individual test files should run in < 5 seconds
- Use `--run` flag for CI to avoid watch mode

## Future Test Plans

### Phase 1 (Current) ✅
- [x] Unit tests for utilities
- [x] Configuration validation tests
- [x] Basic component tests
- [x] Hook tests

### Phase 2 (Next) 🔄
- [ ] Integration tests for AI providers
- [ ] Database operation tests
- [ ] More component tests
- [ ] E2E critical path tests

### Phase 3 (Future) 📋
- [ ] Visual regression tests
- [ ] Performance benchmarks
- [ ] Accessibility tests
- [ ] Security tests

## Resources

- [Vitest Documentation](https://vitest.dev/)
- [React Testing Library](https://testing-library.com/react)
- [Testing Best Practices](https://kentcdodds.com/blog/common-mistakes-with-react-testing-library)

## Support

For questions or issues with tests:
1. Check this documentation
2. Review existing test examples
3. Check Vitest documentation
4. Open an issue on GitHub

---

**Last Updated**: December 2024  
**Test Suite Version**: 1.0.0
