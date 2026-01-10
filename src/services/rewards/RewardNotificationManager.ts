/**
 * RewardNotificationManager - Imperative API for reward notifications
 * Uses Toast for non-blocking notifications that don't conflict with modals
 *
 * Usage:
 *   // From any service:
 *   RewardNotificationManager.showRewardEarned(21);
 *   RewardNotificationManager.showPledgeRewardSent(50, 'Saturday 5K', 'OpenSats', 3, 7);
 */

import Toast from 'react-native-toast-message';

export interface DonationSplit {
  userAmount: number;
  charityAmount: number;
  charityName?: string;
  // Note: Team donations disabled until teams have lightning addresses configured
}

/**
 * Pledge progress info for reward notifications
 */
export interface PledgeInfo {
  eventName: string;
  recipientName: string;
  completedWorkouts: number;
  totalWorkouts: number;
  isComplete: boolean;
}

export interface RewardNotificationState {
  visible: boolean;
  amount: number;
  donationSplit?: DonationSplit;
  /** If set, this is a pledge reward notification */
  pledgeInfo?: PledgeInfo;
}

type NotificationCallback = (state: RewardNotificationState) => void;

class RewardNotificationManagerClass {
  // Keep callback for backwards compatibility with RewardNotificationProvider
  // But Toast is now the primary notification method
  private callback: NotificationCallback | null = null;

  // Store the latest reward so modals can display it
  private lastReward: { amount: number; donationSplit?: DonationSplit; timestamp: number } | null = null;

  /**
   * Get the last reward if it was earned recently (within 30 seconds)
   * Used by workout summary modals to display reward info
   */
  getLastReward(): { amount: number; donationSplit?: DonationSplit } | null {
    if (!this.lastReward) return null;

    // Only return if earned within last 30 seconds
    const age = Date.now() - this.lastReward.timestamp;
    if (age > 30000) {
      this.lastReward = null;
      return null;
    }

    return {
      amount: this.lastReward.amount,
      donationSplit: this.lastReward.donationSplit,
    };
  }

  /**
   * Clear the last reward (call after displaying in modal)
   */
  clearLastReward(): void {
    this.lastReward = null;
  }

  /**
   * Show pending reward toast after a delay (call when modal closes)
   * The 350ms delay ensures the modal has finished animating out
   * before the toast appears, preventing it from being obscured
   */
  showPendingRewardToast(): void {
    const reward = this.getLastReward();
    if (reward) {
      this.clearLastReward();

      let subtitle = `+${reward.amount} sats earned!`;
      if (reward.donationSplit?.charityName && reward.donationSplit.charityAmount > 0) {
        subtitle = `+${reward.donationSplit.userAmount} sats to you, +${reward.donationSplit.charityAmount} to ${reward.donationSplit.charityName}`;
      } else if (reward.donationSplit?.userAmount) {
        subtitle = `+${reward.donationSplit.userAmount} sats earned!`;
      }

      // Delay toast to ensure modal slide-out animation is complete (~300ms)
      setTimeout(() => {
        console.log('[RewardNotification] 📢 Showing pending reward toast now');
        Toast.show({
          type: 'reward',
          text1: 'Reward Earned!',
          text2: subtitle,
          position: 'top',
          visibilityTime: 7000,
        });
      }, 350);
    }
  }

  /**
   * Register a callback from the RewardNotificationProvider
   * Called automatically when the provider mounts
   * @deprecated Toast is now used instead - this is kept for backwards compatibility
   */
  register(callback: NotificationCallback): void {
    this.callback = callback;
  }

  /**
   * Unregister the callback when provider unmounts
   * @deprecated Toast is now used instead - this is kept for backwards compatibility
   */
  unregister(): void {
    this.callback = null;
  }

  /**
   * Show the reward earned notification as a non-blocking toast
   * Can be called from anywhere (services, components, etc.)
   *
   * @param amount - Amount of sats earned
   * @param donationSplit - Optional donation breakdown (user, team, charity)
   */
  showRewardEarned(amount: number, donationSplit?: DonationSplit): void {
    console.log('[RewardNotification] 🎉 showRewardEarned called:', { amount, donationSplit });

    // Store reward for modals to display
    this.lastReward = { amount, donationSplit, timestamp: Date.now() };

    let subtitle = `+${amount} sats earned!`;

    // Show split if charity was included
    if (donationSplit?.charityName && donationSplit.charityAmount > 0) {
      subtitle = `+${donationSplit.userAmount} sats to you, +${donationSplit.charityAmount} to ${donationSplit.charityName}`;
    } else if (donationSplit?.userAmount) {
      subtitle = `+${donationSplit.userAmount} sats earned!`;
    }

    // Don't show toast here - it will appear behind modals
    // Instead, each screen calls showPendingRewardToast() when their modal closes
    console.log('[RewardNotification] 📢 Reward stored, waiting for modal to close...');
  }

  /**
   * Hide the notification
   * @deprecated Toast auto-dismisses - this is kept for backwards compatibility
   */
  hide(): void {
    Toast.hide();
  }

  /**
   * Show a pledge reward notification as a non-blocking toast
   * Called when a daily reward is routed to a pledge destination
   *
   * @param amount - Amount of sats sent (usually 50)
   * @param eventName - Name of the event the pledge is for
   * @param recipientName - Name of recipient (captain or charity name)
   * @param completedWorkouts - Number of workouts completed after this one
   * @param totalWorkouts - Total workouts required for pledge
   */
  showPledgeRewardSent(
    amount: number,
    eventName: string,
    recipientName: string,
    completedWorkouts: number,
    totalWorkouts: number
  ): void {
    const isComplete = completedWorkouts >= totalWorkouts;
    const progress = `${completedWorkouts}/${totalWorkouts}`;

    let title = 'Pledge Reward Sent!';
    let subtitle = `+${amount} sats to ${recipientName} (${progress})`;

    if (isComplete) {
      title = 'Pledge Complete!';
      subtitle = `${eventName} - ${amount} sats sent to ${recipientName}`;
    }

    Toast.show({
      type: 'pledge',
      text1: title,
      text2: subtitle,
      position: 'top',
      visibilityTime: isComplete ? 6000 : 5000, // Show longer for completion
    });
  }

  /**
   * Show a pledge completion notification
   * Called when user completes all pledged workouts
   *
   * @param eventName - Name of the event
   * @param totalSats - Total sats sent over all pledge workouts
   * @param recipientName - Name of recipient
   */
  showPledgeCompleted(
    eventName: string,
    totalSats: number,
    recipientName: string
  ): void {
    // Use the same notification but with isComplete flag
    this.showPledgeRewardSent(
      totalSats,
      eventName,
      recipientName,
      1, // Completed
      1 // Of 1 (100%)
    );
  }
}

// Export singleton instance
export const RewardNotificationManager = new RewardNotificationManagerClass();
export default RewardNotificationManager;
