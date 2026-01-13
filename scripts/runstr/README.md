# RUNSTR Operational Scripts

Essential scripts for managing RUNSTR competitions and rewards.

## Quick Start

```bash
# Check competition participants
node scripts/runstr/check-participants.cjs

# Sync all workouts to Supabase
node scripts/runstr/sync-workouts.cjs

# View charity activity
node scripts/runstr/charity-contributions.cjs

# Check reward wallet
node scripts/runstr/verify-wallet.cjs

# Test a payment
node scripts/runstr/test-payment.mjs [lightning-address] [amount]
```

## Scripts

### sync-workouts.cjs
Syncs kind 1301 workout events from Nostr to Supabase for **all** competition participants (not just Season II).

- Queries `competition_participants` from Supabase
- Fetches kind 1301 events from Nostr relays
- Submits to Supabase edge function for anti-cheat validation

**Run periodically** to keep leaderboards up to date.

### check-participants.cjs
Shows who has joined competitions but is NOT in the Season II participant list.

Output:
- Participants per competition
- Non-Season II users who joined (whose workouts need syncing)

### check-leaderboard.cjs
Simulates the leaderboard query to show current standings.

### charity-contributions.cjs
Shows which charities are being supported through RUNSTR workouts.

Output:
- Workouts per charity (based on team tags)
- Users per charity
- Estimated sats impact

**Note:** Actual donation amounts are tracked locally on devices, not in Supabase.

### verify-wallet.cjs
Checks the RUNSTR reward wallet status:
- NWC connection
- Wallet balance
- Payment capabilities

### test-payment.mjs
Sends a test payment to verify the reward system works.

```bash
# Default: 50 sats to thewildhustle@strike.me
node scripts/runstr/test-payment.mjs

# Custom recipient and amount
node scripts/runstr/test-payment.mjs user@getalby.com 21
```

## Environment Variables

Required in `.env`:
```
EXPO_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
ENCRYPTED_REWARD_NWC=your-encrypted-nwc
NWC_ENCRYPTION_KEY=your-encryption-key
```

## Typical Workflow

1. **Check participants** - See who has joined competitions
2. **Sync workouts** - Update Supabase with latest Nostr data
3. **Check leaderboard** - Verify standings are correct
4. **Charity report** - View charity impact stats
