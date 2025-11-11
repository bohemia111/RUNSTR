# Onboarding Components

Simplified onboarding components for new user experience.

## Files

**WelcomePermissionModal.tsx** - Single welcome modal shown on first app launch with location permission request and app introduction

**ProfileSetupStep.tsx** - (UNUSED) Optional profile customization component

**WalletSetupStep.tsx** - (UNUSED) Optional wallet setup component

## Onboarding Flow

The onboarding flow has been simplified to a single modal approach:

1. **User clicks "Start" or "Login"** → Authentication happens
2. **First launch only** → WelcomePermissionModal appears with:
   - Brief app description
   - Location permission request
   - Single "Get Started" button
3. **Main App** → User enters authenticated app immediately

**Key Changes:**
- No multi-step wizard
- No splash screens
- Password saved silently (accessible in Settings → Backup Password)
- Background data loading (non-blocking)
- Single modal shown only on first launch
