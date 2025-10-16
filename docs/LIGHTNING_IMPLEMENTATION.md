# Lightning Payment Implementation Guide

This document provides detailed implementation guidance for Lightning payments using Nostr Wallet Connect (NWC) and Alby MCP tools.

## Overview

RUNSTR uses Lightning payments for:
- **Event entry fees** - Users pay to join competitions
- **1v1 challenge wagers** - Bitcoin-based fitness challenges with escrow
- **Team payments** - Non-custodial team wallet reception via NWC

## Event Ticket Purchase Flow

### User Journey

```
1. User clicks "Join Event" → sees entry fee (e.g., 2,100 sats)
2. App generates Lightning invoice using team's NWC connection
3. User pays from ANY Lightning wallet (Cash App, Strike, self-custodial)
4. Payment detection (NWC webhook or polling every 5 seconds)
5. Payment confirmed → User added to event locally (instant UX)
6. Join request (kind 1105) published to Nostr
7. Captain sees notification → approves request
8. User added to official kind 30000 member list
9. User workouts now count toward event leaderboard
```

### Technical Implementation

**Team Metadata Structure:**
```typescript
interface Team {
  nwcConnectionString?: string; // "nostr+walletconnect://..."
  lightningAddress?: string; // "team@getalby.com" as fallback
  charityId?: string; // "opensats", "hrf", etc.
  charityUrl?: string; // Link to charity page
}
```

**Event Ticket Purchase Service:**
```typescript
async purchaseEventTicket(eventId: string, userId: string) {
  // 1. Get team's NWC connection via Alby MCP tools
  const invoice = await mcp__alby__make_invoice({
    amount_in_sats: event.entryFee,
    description: `Entry fee for ${event.name}`,
    metadata: { eventId, userId }
  });

  // 2. Show invoice to user (QR + copy button)
  displayInvoiceModal(invoice);

  // 3. Poll for payment (Alby MCP lookup_invoice)
  const paymentDetected = await pollForPayment(invoice.payment_hash);

  // 4. Add user to event locally
  await addUserToEventLocally(eventId, userId);

  // 5. Submit join request to Nostr
  await publishJoinRequest(eventId, userId);

  // 6. Navigate to event detail screen
  navigation.navigate('EventDetail', { eventId });
}
```

### Alby MCP Tools Integration

**Available Tools:**
- `mcp__alby__make_invoice()` - Generate Lightning invoices
- `mcp__alby__lookup_invoice()` - Check payment status
- `mcp__alby__get_info()` - Get wallet capabilities
- `mcp__alby__get_balance()` - Check team wallet balance

**Why This Works:**
- Uses standard Lightning invoices (works with any wallet)
- NWC enables teams to receive payments without platform custody
- Payment detection is reliable (Alby tools provide invoice lookup)
- Local-first UX (user sees event immediately, approval is async)
- Captain retains control (manual approval for official roster)

## 1v1 Challenge with Bitcoin Escrow

### Challenge Flow

```
1. User A challenges User B to a fitness competition
2. Both users stake Bitcoin (e.g., 10,000 sats each)
3. Challenge parameters: goal type, deadline, activity
4. Both users pay into escrow (separate Lightning invoices)
5. App monitors published kind 1301 workout events
6. Deadline expires → Determine winner from workout data
7. Auto-payout winner via NWC (receives 20,000 sats)
```

### Data Structure

```typescript
interface Challenge {
  id: string;
  challengerId: string;
  challengedId: string;
  wagerSats: number; // Amount each participant stakes
  goalType: 'fastest_5k' | 'most_distance' | 'workout_count';
  activityType: 'running' | 'cycling' | 'walking' | 'strength';
  deadline: string; // ISO timestamp
  status: 'pending' | 'both_paid' | 'active' | 'completed';
  escrowInvoices: {
    challenger: string; // Lightning payment hash
    challenged: string; // Lightning payment hash
  };
  winnerId?: string;
}
```

### Implementation

**Create Challenge Escrow:**
```typescript
async createChallengeEscrow(challenge: Challenge) {
  // Generate two invoices (one for each participant)
  const invoice1 = await mcp__alby__make_invoice({
    amount_in_sats: challenge.wagerSats,
    description: `Challenge wager: ${challenge.goalType}`,
    metadata: { challengeId: challenge.id, userId: challenge.challengerId }
  });

  const invoice2 = await mcp__alby__make_invoice({
    amount_in_sats: challenge.wagerSats,
    description: `Challenge wager: ${challenge.goalType}`,
    metadata: { challengeId: challenge.id, userId: challenge.challengedId }
  });

  // Store invoices and wait for both payments
  return { invoice1, invoice2 };
}
```

**Detect Both Payments:**
```typescript
async waitForBothPayments(invoices) {
  const [payment1, payment2] = await Promise.all([
    pollForPayment(invoices.invoice1.payment_hash),
    pollForPayment(invoices.invoice2.payment_hash),
  ]);

  // Mark challenge as active
  await updateChallengeStatus(challenge.id, 'active');
}
```

**Determine Winner and Payout:**
```typescript
async completeChallengeWithPayout(challengeId: string) {
  const challenge = await getChallenge(challengeId);
  const winner = await determineWinnerFromWorkouts(challenge);

  // Payout winner (total: wagerSats * 2)
  await mcp__alby__pay_invoice({
    invoice: winner.lightningAddress,
    amount_in_sats: challenge.wagerSats * 2,
  });

  // Publish result to Nostr (kind 1102 notification)
  await publishChallengeResult(challenge, winner);
}
```

### Winner Determination

**Process:**
1. Query kind 1301 events from both participants within challenge timeframe
2. Apply challenge goal logic (fastest time, most distance, etc.)
3. Automatic and transparent (all workouts verifiable on Nostr)

**Example Goal Logic:**
```typescript
async determineWinnerFromWorkouts(challenge: Challenge) {
  const workouts1 = await fetchUserWorkouts(challenge.challengerId, challenge.deadline);
  const workouts2 = await fetchUserWorkouts(challenge.challengedId, challenge.deadline);

  switch (challenge.goalType) {
    case 'fastest_5k':
      return findFastest5K(workouts1, workouts2);
    case 'most_distance':
      return calculateTotalDistance(workouts1, workouts2);
    case 'workout_count':
      return workouts1.length > workouts2.length ? challenge.challengerId : challenge.challengedId;
  }
}
```

## Payment Detection Strategies

### Polling Approach
```typescript
async pollForPayment(paymentHash: string, maxAttempts = 60) {
  for (let i = 0; i < maxAttempts; i++) {
    const invoice = await mcp__alby__lookup_invoice({ payment_hash: paymentHash });

    if (invoice.settled) {
      return true;
    }

    await sleep(5000); // Poll every 5 seconds
  }

  return false; // Timeout after 5 minutes
}
```

### Webhook Approach (Future)
```typescript
// Configure NWC webhook endpoint
const webhookUrl = 'https://api.runstr.app/nwc-webhook';

// NWC will POST to this endpoint when payment settles
app.post('/nwc-webhook', async (req, res) => {
  const { payment_hash, settled } = req.body;

  if (settled) {
    await handlePaymentConfirmed(payment_hash);
  }

  res.status(200).send('OK');
});
```

## Security Considerations

1. **Invoice Validation**: Always verify invoice amounts match expected values
2. **Timeout Handling**: Implement payment timeouts to avoid indefinite waiting
3. **Escrow Safety**: Only release escrow when winner is definitively determined
4. **Fraud Prevention**: Validate workout events are published before payment
5. **Error Handling**: Gracefully handle failed payments and provide refund paths

## Best Practices

1. **User Experience**: Show payment status in real-time with progress indicators
2. **Fallback Options**: Provide Lightning address fallback if NWC unavailable
3. **Receipt Storage**: Store payment hashes for dispute resolution
4. **Testing**: Use testnet/signet for development and testing
5. **Documentation**: Clearly communicate payment flows to users

## Related Documentation

- 📖 **For NWC setup**: [ENVIRONMENT_SETUP.md](./ENVIRONMENT_SETUP.md)
- 📖 **For Nostr integration**: [nostr-native-fitness-competitions.md](./nostr-native-fitness-competitions.md)
- 📖 **For payment architecture**: Main CLAUDE.md file
