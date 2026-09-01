# Security Policy

## 🔒 Security Overview

Hey Frank takes security and privacy seriously. This document outlines our security practices and how to report vulnerabilities.

## 🛡️ Supported Versions

We provide security updates for the following versions:

| Version | Supported          | Status |
| ------- | ------------------ | ------ |
| 0.1.x   | ✅ Yes            | Current stable release |
| < 0.1.0 | ❌ No             | Legacy, not maintained |

## 🚨 Reporting a Vulnerability

### How to Report

If you discover a security vulnerability, please **DO NOT** open a public issue.

Instead, report it privately using one of these methods:

1. **GitHub Security Advisories** (Preferred)
   - Go to [Security Advisories](https://github.com/Samarthjadhavsj/API-AI-Assistant/security/advisories)
   - Click "Report a vulnerability"
   - Fill in the details

2. **Email**
   - Send to: samarthjadhavsj121@gmail.com
   - Subject: `[SECURITY] Brief description`
   - Include:
     - Description of the vulnerability
     - Steps to reproduce
     - Potential impact
     - Suggested fix (if any)

### What to Include

Please provide as much information as possible:

- **Type of vulnerability** (e.g., XSS, SQL injection, credential exposure)
- **Affected version(s)**
- **Steps to reproduce** with detailed instructions
- **Potential impact** and severity assessment
- **Proof of concept** code or screenshots
- **Possible mitigations** or workarounds
- **Your contact information** for follow-up

### Response Timeline

We take security seriously and will respond promptly:

- **Initial response**: Within 48 hours
- **Confirmation**: Within 7 days (acknowledge if it's a valid issue)
- **Status updates**: Weekly until resolved
- **Fix timeline**: Depends on severity
  - Critical: 1-7 days
  - High: 7-30 days
  - Medium: 30-90 days
  - Low: Best effort

### Disclosure Policy

- We follow **coordinated disclosure** practices
- We'll work with you to understand and fix the issue
- We'll credit you in the release notes (if desired)
- Please **do not publicly disclose** until we've released a fix
- We'll coordinate with you on the disclosure timeline

## 🔐 Security Measures

### Application Security

**Data Protection:**
- ✅ All data stored locally in SQLite database
- ✅ API keys encrypted using system keychain
- ✅ No telemetry or external data transmission
- ✅ Direct API communication (no middleware)

**System Security:**
- ✅ Content protection against screen recording
- ✅ Secure WebView2 implementation
- ✅ Sandboxed runtime environment
- ✅ Minimal system permissions

**Code Security:**
- ✅ Dependencies audited regularly
- ✅ No eval() or unsafe code execution
- ✅ Input sanitization and validation
- ✅ XSS protection in markdown rendering

### Build Security

- Code signing (planned for v1.0)
- Reproducible builds
- Dependency pinning
- Supply chain security

## 🔍 Security Best Practices for Users

### Installation Security

1. **Download from trusted sources only:**
   - GitHub Releases (official)
   - Official website (when available)
   - ❌ Avoid third-party download sites

2. **Verify signatures:**
   ```bash
   # Check file integrity (coming soon)
   shasum -a 256 hey-frank-setup.exe
   ```

3. **Review permissions:**
   - Check what the app requests access to
   - Only grant necessary permissions

### API Key Security

1. **Never share your API keys**
2. **Use environment variables** for development
3. **Rotate keys regularly**
4. **Use read-only keys** when possible
5. **Monitor API usage** for anomalies

### Privacy Protection

1. **Review conversation history** regularly
2. **Clear sensitive chats** after use
3. **Use local AI** (Ollama) for sensitive topics
4. **Backup database** with encryption
5. **Keep software updated**

## 🛠️ Security Features

### Current Features

| Feature | Status | Description |
|---------|--------|-------------|
| Local Data Storage | ✅ Active | SQLite database on user's machine |
| API Key Encryption | ✅ Active | System keychain storage |
| Screen Capture Protection | ✅ Active | OS-level content protection |
| Zero Telemetry | ✅ Active | No data collection |
| Secure Updates | 🔄 Planned | Signed update packages |
| Two-Factor Auth | ❌ N/A | Not applicable for local app |

### Planned Security Enhancements

- [ ] Code signing for executables
- [ ] Auto-update with signature verification
- [ ] Database encryption at rest
- [ ] Secure backup and restore
- [ ] Permission management UI
- [ ] Security audit logs

## 📋 Security Checklist

### For Developers

- [ ] Run `npm audit` before each release
- [ ] Review dependency updates for security patches
- [ ] Scan code with static analysis tools
- [ ] Test security features thoroughly
- [ ] Document security implications of changes
- [ ] Follow secure coding practices

### For Users

- [ ] Download from official sources only
- [ ] Keep the application updated
- [ ] Use strong, unique API keys
- [ ] Review permissions regularly
- [ ] Enable screen capture protection
- [ ] Backup data securely

## 🔄 Security Update Process

### How Updates Are Handled

1. **Vulnerability Discovery**
   - Internal testing
   - External security reports
   - Dependency audits

2. **Assessment & Prioritization**
   - Severity classification (Critical/High/Medium/Low)
   - Impact analysis
   - Exploitation likelihood

3. **Fix Development**
   - Secure coding practices
   - Code review
   - Security testing

4. **Release & Notification**
   - Patch release
   - Security advisory
   - User notification

### Severity Classification

**Critical (CVSS 9.0-10.0)**
- Immediate remote code execution
- Full system compromise
- Mass data exfiltration

**High (CVSS 7.0-8.9)**
- Privilege escalation
- Sensitive data exposure
- Authentication bypass

**Medium (CVSS 4.0-6.9)**
- Limited data disclosure
- Denial of service
- Cross-site scripting

**Low (CVSS 0.1-3.9)**
- Minor information disclosure
- Non-exploitable bugs
- Best practice violations

## 📚 Security Resources

### External Resources

- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [Tauri Security Guide](https://tauri.app/v1/references/architecture/security)
- [Electron Security Checklist](https://github.com/electron/electron/blob/main/docs/tutorial/security.md)

### Security Tools Used

- `npm audit` - Dependency vulnerability scanning
- `cargo audit` - Rust dependency security
- GitHub Dependabot - Automated security updates
- CodeQL (planned) - Static code analysis

## ⚖️ Legal

### Responsible Disclosure

We appreciate security researchers who:
- Report vulnerabilities responsibly
- Follow coordinated disclosure practices
- Give us reasonable time to fix issues
- Don't exploit vulnerabilities

### Bug Bounty Program

Currently, we do not have a formal bug bounty program. However:
- We acknowledge all valid security reports
- We credit researchers in release notes
- We may offer recognition rewards for critical findings

### Safe Harbor

We consider security research conducted in good faith:
- Authorized and lawful
- Exempt from legal action
- Eligible for safe harbor protections

Provided the researcher:
- Makes a good faith effort to avoid privacy violations
- Does not access, modify, or delete data without permission
- Does not disrupt or degrade services
- Reports findings promptly

## 🙏 Acknowledgments

We thank the following security researchers for their responsible disclosures:

<!-- Add security researchers here as they report issues -->
- *Be the first to contribute!*

## 📞 Contact

For security-related inquiries:

- **Email**: samarthjadhavsj121@gmail.com
- **Subject Line**: `[SECURITY] Your concern`
- **PGP Key**: Coming soon

For general support, use regular [GitHub Issues](https://github.com/Samarthjadhavsj/API-AI-Assistant/issues).

---

**Last Updated**: January 2025

*This security policy is subject to change. Check back regularly for updates.*
