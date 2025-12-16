# Contributing to RUNSTR

Thank you for your interest in contributing to RUNSTR! This document provides guidelines for contributing to the project.

## Getting Started

1. **Fork the repository** and clone it locally
2. **Install dependencies**: `npm install`
3. **Run the app**: `npm run ios` or `npm run android`
4. **Create a branch** for your changes: `git checkout -b feature/your-feature-name`

## Development Guidelines

### Code Style

- **Maximum 500 lines per file** - This is strictly enforced for maintainability
- **TypeScript required** - All code must be TypeScript with proper types
- **No mock data** - All features must use live Nostr data
- **Nostr-first architecture** - Use Nostr for data storage, not traditional backends

### File Organization

```
src/
├── components/     # Reusable UI components
├── screens/        # Full screen components
├── services/       # Business logic and API integrations
├── store/          # Zustand state management
├── types/          # TypeScript type definitions
└── utils/          # Helper functions
```

### Before Submitting

1. **Run TypeScript check**: `npm run typecheck`
2. **Run linter**: `npm run lint`
3. **Format code**: `npx prettier --write "src/**/*.{ts,tsx}"`
4. **Test your changes** on iOS simulator/device

## Pull Request Process

1. **Create a descriptive PR title** - Use prefixes like `Fix:`, `Feature:`, `Refactor:`, `Docs:`
2. **Describe your changes** - Explain what you changed and why
3. **Reference any issues** - Link to related GitHub issues
4. **Ensure CI passes** - TypeScript compilation must succeed
5. **Request review** - Tag maintainers for review

### PR Title Examples

- `Feature: Add cycling workout type support`
- `Fix: Resolve leaderboard calculation error`
- `Refactor: Split CompetitionService into smaller modules`
- `Docs: Update README with new installation steps`

## Reporting Bugs

When reporting bugs, please include:

1. **Steps to reproduce** - Clear, numbered steps
2. **Expected behavior** - What should happen
3. **Actual behavior** - What actually happens
4. **Device/OS info** - iOS version, device model
5. **Screenshots** - If applicable

## Feature Requests

For feature requests:

1. **Check existing issues** - Avoid duplicates
2. **Describe the use case** - Why is this feature needed?
3. **Propose a solution** - If you have ideas on implementation
4. **Consider scope** - Does it fit RUNSTR's core mission?

## Architecture Principles

### Nostr-First Design
- All persistent data should be stored as Nostr events
- Use appropriate Nostr event kinds (1301 for workouts, 30000 for lists, etc.)
- Prefer decentralized solutions over centralized backends

### Local-First Data
- Store data locally first, sync to Nostr on user action
- Never force users to publish their workout data
- Respect user privacy at every step

### Bitcoin Integration
- Use Nostr Wallet Connect (NWC) for Lightning payments
- Support universal wallet compatibility
- Non-custodial approach—users control their funds

## Questions?

- **GitHub Issues**: For bugs and feature requests
- **Nostr**: Tag us on Nostr for questions
- **Website**: [runstr.club](https://www.runstr.club/)

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
