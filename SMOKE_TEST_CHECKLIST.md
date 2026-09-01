# Hey Frank - Smoke Test Checklist

## 🎯 Purpose

Quick validation test (30 minutes) to verify critical functionality before deeper testing.

---

## ✅ Pre-Test Setup

### Prerequisites
- [ ] Application built: `npm run tauri build`
- [ ] OpenAI API key ready
- [ ] Test environment clean (fresh install recommended)

### Launch Application
```bash
# Navigate to build output
cd src-tauri/target/release/

# Run the executable
./hey-frank.exe  # Windows
# or
./hey-frank      # macOS/Linux
```

---

## 🔥 Critical Smoke Tests (5 tests - 30 minutes)

### 1️⃣ Application Launch ✅
**Time**: 2 minutes  
**Test ID**: TC-CORE-001

**Steps**:
1. Launch Hey Frank application
2. Check system tray for icon
3. Verify no error messages

**Pass Criteria**:
- [x] Application starts without crash
- [x] System tray icon appears
- [x] No error dialogs

**Result**: ⚪ PASS / FAIL  
**Notes**: _________________

---

### 2️⃣ Window Toggle ✅  
**Time**: 3 minutes  
**Test ID**: TC-CORE-003

**Steps**:
1. Press `Shift+\` (or configured shortcut)
2. Verify window appears
3. Press `Shift+\` again
4. Verify window hides

**Pass Criteria**:
- [x] Window shows on first press
- [x] Window hides on second press
- [x] Response time < 200ms (feels instant)
- [x] Window appears always on top

**Result**: ⚪ PASS / FAIL  
**Notes**: _________________

---

### 3️⃣ AI Provider Setup ✅
**Time**: 5 minutes  
**Test ID**: TC-AI-001

**Steps**:
1. Show window (`Shift+\`)
2. Access settings/Dev Space
3. Select OpenAI as provider
4. Enter your API key
5. Select model (e.g., gpt-3.5-turbo)
6. Save settings

**Pass Criteria**:
- [x] Can access settings
- [x] Can enter API key
- [x] Can select model
- [x] Settings save without error
- [x] No crashes or freezes

**Result**: ⚪ PASS / FAIL  
**API Key Used**: _________________  
**Model**: _________________  
**Notes**: _________________

---

### 4️⃣ Send Message & Get Response ✅
**Time**: 10 minutes  
**Test ID**: TC-CONV-002

**Steps**:
1. Show window
2. Type simple message: "Hello, how are you?"
3. Press Enter or click Send
4. Wait for AI response
5. Verify response appears

**Pass Criteria**:
- [x] Message sends successfully
- [x] Loading indicator shows
- [x] AI response appears
- [x] Response streams in (if streaming enabled)
- [x] Response is readable and relevant
- [x] No error messages

**Message Sent**: _________________  
**Response Time**: _________ seconds  
**Result**: ⚪ PASS / FAIL  
**Notes**: _________________

---

### 5️⃣ Stealth Mode - Screen Recording ✅
**Time**: 10 minutes  
**Test ID**: TC-STEALTH-001

**Steps**:
1. Open OBS Studio (or similar screen recorder)
2. Start recording your screen
3. Show Hey Frank window (`Shift+\`)
4. Type and send a message
5. Get AI response
6. Hide window (`Shift+\`)
7. Stop recording
8. Review the recording

**Pass Criteria**:
- [x] Hey Frank window is NOT visible in recording
- [x] Window content is NOT readable
- [x] Area appears black/blank where window was
- [x] Other applications are visible normally

**Recording Tool**: _________________  
**Result**: ⚪ PASS / FAIL  
**Notes**: _________________

---

## 📊 Smoke Test Results Summary

### Quick Check
- **Total Tests**: 5
- **Passed**: ___
- **Failed**: ___
- **Pass Rate**: ___%

### Critical Issues Found
```
[List any critical issues that would block release]
```

### Decision
- [ ] ✅ **PASS** - Proceed to full testing
- [ ] ❌ **FAIL** - Critical issues found, fix before proceeding
- [ ] ⚠️ **CONDITIONAL** - Minor issues, proceed with caution

### Tester Sign-Off
- **Tester Name**: _________________
- **Date**: _________________
- **Time Taken**: _________ minutes
- **Recommendation**: _________________

---

## 🚨 Failure Criteria (STOP Testing)

If any of these occur, STOP and report immediately:

### Critical Failures
- [ ] Application won't launch
- [ ] Application crashes during basic operation
- [ ] Cannot configure AI provider
- [ ] Cannot send/receive messages
- [ ] Window toggle doesn't work
- [ ] Complete loss of functionality

### When to Stop
If 3 or more smoke tests FAIL, **STOP** smoke testing and:
1. Log all failures as critical defects
2. Report to development team
3. Wait for fixes before continuing
4. Re-run smoke test after fixes

---

## 🎯 Next Steps

### If Smoke Test PASSES
1. ✅ Proceed to Phase 1 (Critical) testing
2. ✅ Use full `MANUAL_TEST_EXECUTION_GUIDE.md`
3. ✅ Follow systematic test execution

### If Smoke Test FAILS
1. ❌ Log defects in `DEFECT_REPORT_TEMPLATE.md`
2. ❌ Communicate with development team
3. ❌ Wait for critical fixes
4. ❌ Re-run smoke test
5. ❌ Proceed only after smoke test passes

---

## 💡 Quick Tips

### Fast Testing
- Use keyboard shortcuts (faster than mouse)
- Keep API key handy (copy-paste ready)
- Have screen recorder already open
- Use simple test messages

### Common Issues
- **Window won't show**: Check if it's off-screen, restart app
- **Shortcut doesn't work**: Check settings, try default
- **API error**: Verify API key, check internet
- **No response**: Check API key, check model availability

### Time-Saving
- Test in order (1 → 5)
- Don't deep-dive on first pass
- Note issues, investigate later
- Take screenshots for evidence

---

## 📝 Extended Smoke Test (Optional - 1 hour)

If you have more time, add these tests:

### 6️⃣ New Conversation
- [ ] Create new conversation
- [ ] Send messages
- [ ] Verify saves

### 7️⃣ Previous Conversation Load
- [ ] Access conversation history
- [ ] Load previous conversation
- [ ] Verify messages present

### 8️⃣ Screenshot Capture
- [ ] Take screenshot
- [ ] Verify captures correctly
- [ ] Send to AI
- [ ] Get relevant response

### 9️⃣ Settings Persistence
- [ ] Change a setting
- [ ] Restart application
- [ ] Verify setting persisted

### 🔟 Exit & Relaunch
- [ ] Exit application properly
- [ ] Relaunch application
- [ ] Verify state restored
- [ ] Test basic functionality

---

## 🎓 Smoke Test Best Practices

### DO ✅
- Test on clean environment
- Follow steps exactly
- Document everything
- Take screenshots
- Note timing observations
- Test like a real user

### DON'T ❌
- Skip steps
- Test multiple things at once
- Ignore small issues
- Rush through tests
- Test on unstable environment
- Assume anything works

---

## 📞 Help & Support

### If You Get Stuck
1. Check console logs (F12 in dev mode)
2. Review `TEST_CASES.md` for details
3. Check `MANUAL_TEST_EXECUTION_GUIDE.md`
4. Restart and try again
5. Document the issue

### Reporting Issues
Use `DEFECT_REPORT_TEMPLATE.md` for:
- Clear reproduction steps
- Expected vs actual results
- Screenshots/logs
- Environment details

---

**Remember**: Smoke test is a GO/NO-GO decision. If it fails, fix critical issues before proceeding to full testing!

**Good luck! 🚀**

---

**Checklist Version**: 1.0  
**Last Updated**: December 2024  
**Estimated Time**: 30 minutes  
**Status**: Ready for Use
