# Defect Report Template

## Bug Report Format

Copy this template for each defect found during testing.

---

## DEFECT #001

### Basic Information
- **Defect ID**: BUG-001
- **Test Case ID**: TC-___-___
- **Reported By**: [Tester Name]
- **Date Reported**: [Date]
- **Environment**: [Windows 11 / macOS / Linux]
- **App Version**: 0.1.8

### Classification
- **Severity**: 
  - [ ] Critical - Application crash, data loss, security breach
  - [ ] High - Major feature broken, no workaround
  - [ ] Medium - Feature partially works, workaround exists
  - [ ] Low - Minor issue, cosmetic problem

- **Priority**:
  - [ ] P1 - Fix immediately
  - [ ] P2 - Fix before release
  - [ ] P3 - Fix in next release
  - [ ] P4 - Nice to have

- **Category**:
  - [ ] Functional
  - [ ] UI/UX
  - [ ] Performance
  - [ ] Security
  - [ ] Compatibility

### Issue Description
**Title**: [Brief one-line summary]

**Description**:
[Detailed description of what went wrong]

### Reproduction Steps
1. [First step]
2. [Second step]
3. [Third step]
4. ...

**Frequency**: 
- [ ] Always (100%)
- [ ] Often (>75%)
- [ ] Sometimes (25-75%)
- [ ] Rare (<25%)

### Expected vs Actual

**Expected Result**:
[What should happen according to requirements/design]

**Actual Result**:
[What actually happened]

### Evidence
**Screenshots**:
- [ ] Screenshot 1: [Description]
- [ ] Screenshot 2: [Description]

**Console Logs**:
```
[Paste relevant logs here]
```

**Video**: [If applicable]

### Environment Details
- **Operating System**: [Windows 11 Pro 22H2]
- **Node Version**: [v18.x.x]
- **AI Provider**: [OpenAI / Claude / etc.]
- **API Model**: [gpt-4 / claude-3-opus / etc.]
- **Other**: [Any other relevant info]

### Additional Information
**Impact**:
[How does this affect users?]

**Workaround**:
[Is there a temporary workaround?]

**Related Defects**:
[Links to related bugs, if any]

**Notes**:
[Any other relevant information]

---

## DEFECT #002

[Repeat template for next defect]

---

## Defect Summary Log

| ID | Test Case | Severity | Priority | Status | Assigned To | Target Fix |
|----|-----------|----------|----------|--------|-------------|------------|
| BUG-001 | TC-XXX-XXX | High | P2 | Open | - | - |
| BUG-002 | TC-XXX-XXX | Medium | P3 | Open | - | - |
| BUG-003 | TC-XXX-XXX | Low | P4 | Open | - | - |

---

## Severity Definitions

### Critical
- Application crashes or becomes unusable
- Data loss or corruption
- Security vulnerability
- Core functionality completely broken
- **Example**: App won't launch, all conversations deleted

### High  
- Major feature doesn't work
- Significant impact on usability
- No reasonable workaround
- Affects most users
- **Example**: AI provider doesn't connect, window won't toggle

### Medium
- Feature works but with issues
- Workaround exists
- Affects some users
- Minor usability impact
- **Example**: Slow response, occasional error, UI glitch

### Low
- Cosmetic issues
- Minor inconvenience
- Rare occurrence
- Minimal impact
- **Example**: Typo, alignment issue, color inconsistency

---

## Priority Definitions

### P1 - Immediate
- Blocks testing or release
- Must fix before any further testing
- **Timeline**: Fix immediately

### P2 - High
- Must fix before release
- Critical for user experience
- **Timeline**: Fix within current sprint

### P3 - Medium
- Should fix before release if possible
- Can be scheduled for next release if needed
- **Timeline**: Fix in current or next release

### P4 - Low
- Nice to have
- Can be backlogged
- **Timeline**: Fix when convenient

---

## Defect Workflow

```
[Open] → [In Progress] → [Fixed] → [Ready for Retest] → [Closed]
                ↓
           [Won't Fix] / [Duplicate] / [Cannot Reproduce]
```

### Status Definitions
- **Open**: Newly reported, not yet triaged
- **In Progress**: Developer is working on fix
- **Fixed**: Fix implemented, ready for retest
- **Ready for Retest**: Ready for tester to verify
- **Closed**: Fix verified by tester, issue resolved
- **Won't Fix**: Issue acknowledged but won't be fixed
- **Duplicate**: Same as another defect
- **Cannot Reproduce**: Unable to replicate the issue

---

## Quick Defect Logging (Simplified Format)

For quick logging during testing:

```
BUG-XXX | TC-YYY-ZZZ | [Severity] | [Title]
Steps: 1, 2, 3
Expected: X | Actual: Y
```

**Example**:
```
BUG-005 | TC-AI-001 | High | OpenAI connection fails
Steps: 1. Enter API key, 2. Select gpt-4, 3. Send message
Expected: Get AI response | Actual: "API Error 401"
```

---

## Retesting Checklist

When retesting a fixed defect:

- [ ] Review original bug report
- [ ] Follow exact reproduction steps
- [ ] Verify fix works as described
- [ ] Test related functionality (regression)
- [ ] Test on same environment as original
- [ ] Check for new issues introduced
- [ ] Update defect status
- [ ] Add retest notes

---

## Common Issues Reference

### Network/API Issues
- Invalid API key → Check settings
- Connection timeout → Check internet
- Rate limit exceeded → Wait or check limits

### UI Issues
- Window not appearing → Check if hidden
- Shortcut not working → Check configuration
- Lag/slow response → Check system resources

### Data Issues
- Conversations not saving → Check database
- Settings not persisting → Check localStorage
- Lost data → Check backup/export

---

**Remember**: Good defect reports help developers fix issues faster!

Include:
1. Clear title
2. Exact reproduction steps
3. Expected vs actual
4. Evidence (screenshots/logs)
5. Environment details

