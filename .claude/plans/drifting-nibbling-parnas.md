# Fix: Anonymous Users Showing as "Participating" in Running Bitcoin

## Bug
Anonymous users are incorrectly shown as "You're participating!" in the Running Bitcoin challenge.

## Root Cause
The `hasJoined()` method checks:
1. Is user in `SEASON_2_PARTICIPANTS`? → auto-joined
2. Is user in local join list (`@runstr:running_bitcoin_joined`)? → manually joined

Anonymous users have auto-generated pubkeys that may be in the local join list from clicking "Join" in a previous session. The list persists across sessions.

## Fix
Clear the Running Bitcoin local join list when a new user logs in (or logs out). This ensures stale join state doesn't persist across different accounts/sessions.

## Files to Modify
- `src/services/auth/authService.ts` or logout handler - Clear `@runstr:running_bitcoin_joined` on logout

## Implementation
In the logout/login flow, add:
```typescript
await AsyncStorage.removeItem('@runstr:running_bitcoin_joined');
```

This ensures each new session starts fresh - users must explicitly join (unless they're Season II participants who are auto-joined).
