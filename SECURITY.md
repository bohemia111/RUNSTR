# Security Policy

## Reporting a Vulnerability

RUNSTR takes security seriously, especially given our integration with Bitcoin Lightning payments. If you discover a security vulnerability, please report it responsibly.

### How to Report

**DO NOT** create a public GitHub issue for security vulnerabilities.

Instead, please report security issues via:

1. **Email**: security@runstr.club (if available)
2. **Nostr DM**: Send a direct message to `npub1vygzr642y6f8gxcjx6auaf2vd25lyzarpjkwx9kr4y752zy6058s8jvy4e`
3. **GitHub Security Advisory**: Use GitHub's private vulnerability reporting feature

### What to Include

When reporting a vulnerability, please include:

- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix (if you have one)

### Response Timeline

- **Acknowledgment**: Within 48 hours
- **Initial Assessment**: Within 1 week
- **Resolution Timeline**: Depends on severity

## Security Considerations

### Nostr Private Keys

- Private keys (nsec) are stored locally using React Native's secure storage
- Keys are never transmitted to RUNSTR servers (we don't have servers)
- Keys are never logged or included in crash reports
- Users are responsible for backing up their own keys

### Lightning Payments

- RUNSTR uses Nostr Wallet Connect (NWC) for Lightning integration
- Teams control their own wallets—RUNSTR never has custody of funds
- Payment requests use standard Lightning invoices
- Users should verify payment amounts before confirming

### Data Privacy

- All workout data is stored locally by default
- Publishing to Nostr is opt-in and user-controlled
- No analytics or tracking without explicit consent
- No personal data is collected (no email, phone, etc.)

## Supported Versions

| Version | Supported          |
| ------- | ------------------ |
| 0.9.x   | :white_check_mark: |
| < 0.9   | :x:                |

## Security Best Practices for Users

1. **Back up your nsec** - Store it securely offline
2. **Verify NWC connections** - Only connect to wallets you trust
3. **Review payment amounts** - Always check before confirming Lightning payments
4. **Keep the app updated** - Install updates for security patches

## Acknowledgments

We appreciate responsible disclosure and will acknowledge security researchers who help improve RUNSTR's security (with their permission).
