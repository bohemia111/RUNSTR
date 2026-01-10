# Backend Services

This folder contains services that interact with RUNSTR's backend infrastructure (Supabase).

## Files

- **SupabaseCompetitionService.ts** - Competition management, workout submission, and leaderboard fetching via Supabase. Handles join/leave competitions, submit workouts for verification, and fetch pre-computed leaderboards.

## Architecture

RUNSTR uses a hybrid architecture:
- **Nostr**: Decentralized social layer (profiles, workout posts, team discovery)
- **Supabase**: Competition backend (verified workouts, leaderboards, participant management)

The app publishes workouts to Nostr for decentralization AND submits them to Supabase when users click "Compete" for competition tracking.

## Privacy Model

- No user accounts in database
- Data only stored when users explicitly opt-in:
  - Click "Join" on a competition → npub added to participants
  - Click "Compete" after workout → workout submitted for verification
- Users who don't compete are never stored
