/**
 * Challenge Type Definitions
 * Types for 1v1 fitness challenges using Nostr kind 30000 lists
 * SIMPLIFIED: Trust-based model, no payment processing, 4 challenge types only
 */

import type { SimpleChallengeType } from '../constants/simpleChallengePresets';

export interface ChallengeMetadata {
  id: string; // Unique challenge ID
  type: SimpleChallengeType; // 'pushups' | 'distance' | 'carnivore' | 'meditation'
  name: string; // Display name (e.g., "Push-ups Challenge")
  description?: string; // Optional description
  duration: 1 | 7 | 30; // Challenge duration in days
  wager: number; // Amount in satoshis (display only, not collected by app)

  // Challenge status
  status: ChallengeStatus;

  // Participants
  challengerPubkey: string; // Creator's hex pubkey
  challengerName: string; // Creator's display name
  challengedPubkey: string; // Opponent's hex pubkey
  challengedName: string; // Opponent's display name

  // Timing
  createdAt: number; // Unix timestamp when created
  startsAt: number; // Unix timestamp when challenge becomes active
  expiresAt: number; // Unix timestamp when challenge ends

  // Completion
  winnerId?: string; // Pubkey of winner (set when challenge completes)

  // Optional: For QR challenges
  isQRChallenge?: boolean; // True if created via QR code sharing
  parentChallengeId?: string; // Original challenge ID if created from QR scan
}

export enum ChallengeStatus {
  PENDING = 'pending', // Waiting for acceptance (direct challenges only)
  ACTIVE = 'active', // Challenge ongoing
  COMPLETED = 'completed', // Challenge finished, winner determined
  DECLINED = 'declined', // Challenge rejected (direct challenges only)
  EXPIRED = 'expired', // Challenge expired without completion
  CANCELLED = 'cancelled', // Challenge cancelled by creator
}

// REMOVED: PaymentStatus enum - trust-based model, no payment tracking

export interface ChallengeRequest {
  challengeId: string;
  challengerName: string;
  challengerPubkey: string;
  challengeDetails: ChallengeMetadata;
  requestedAt: number;
  expiresAt: number;

  // For QR challenges
  isFromQR?: boolean; // True if challenge initiated via QR scan
}

export interface ChallengeParticipant {
  pubkey: string;
  name: string;
  avatar?: string;
  currentProgress: number; // Current value for the metric
  lastWorkoutAt?: number; // Unix timestamp of last workout
  workoutCount: number; // Number of workouts contributed
}

export interface ChallengeLeaderboard {
  challengeId: string;
  participants: ChallengeParticipant[];
  metric: string;
  target?: number;
  wager: number;
  status: ChallengeStatus;
  startsAt: number;
  expiresAt: number;
  leader?: string; // Pubkey of current leader
  tied: boolean; // Whether participants are tied
}

export interface UserCompetition {
  id: string;
  name: string;
  type: 'team' | 'league' | 'event' | 'challenge';
  status: 'upcoming' | 'active' | 'completed';
  participantCount: number;
  yourRole: 'captain' | 'member' | 'challenger' | 'challenged';
  startsAt?: number;
  endsAt?: number;
  wager?: number; // For challenges
  prizePool?: number; // For leagues/events
  eventData?: any; // ✅ Store complete event data (for events type only)
}

// Global User Discovery Types
export interface GlobalUserSearch {
  query: string;
  results: DiscoveredNostrUser[];
  isSearching: boolean;
  searchTime?: number;
}

export interface DiscoveredNostrUser {
  pubkey: string;
  npub: string;
  name?: string;
  displayName?: string;
  nip05?: string;
  picture?: string;
  about?: string;
  lastActivity?: Date;
  activityStatus: UserActivityStatus;
}

export enum UserActivityStatus {
  ACTIVE = 'active', // Active within 30 days
  INACTIVE = 'inactive', // No activity in 30+ days
  NEW = 'new', // No recorded activity
}

// REMOVED: Complex activity configuration - replaced with SimpleChallengeType presets
// See: src/constants/simpleChallengePresets.ts

// Legacy type exports for backward compatibility (will be gradually removed)
export type DurationOption = 1 | 7 | 30; // Days
export type ActivityType = 'running' | 'walking' | 'cycling' | 'strength' | 'meditation' | 'diet';
export type MetricType = 'distance' | 'duration' | 'reps' | 'days' | 'count' | 'calories';

// Nostr event kinds for challenges
export const CHALLENGE_REQUEST_KIND = 1105;
export const CHALLENGE_ACCEPT_KIND = 1106;
export const CHALLENGE_DECLINE_KIND = 1107;
export const CHALLENGE_COMPLETE_KIND = 1108;
