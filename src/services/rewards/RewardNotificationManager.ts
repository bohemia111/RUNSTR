/**
 * RewardNotificationManager - Imperative API for reward notifications
 * Allows DailyRewardService to trigger the RewardEarnedModal without React context
 *
 * Usage:
 *   // From any service:
 *   RewardNotificationManager.showRewardEarned(21);
 *   RewardNotificationManager.showPledgeRewardSent(50, 'Saturday 5K', 'OpenSats', 3, 7);
 */

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
  private callback: NotificationCallback | null = null;

  /**
   * Register a callback from the RewardNotificationProvider
   * Called automatically when the provider mounts
   */
  register(callback: NotificationCallback): void {
    this.callback = callback;
  }

  /**
   * Unregister the callback when provider unmounts
   */
  unregister(): void {
    this.callback = null;
  }

  /**
   * Show the reward earned notification
   * Can be called from anywhere (services, components, etc.)
   *
   * @param amount - Amount of sats earned
   * @param donationSplit - Optional donation breakdown (user, team, charity)
   */
  showRewardEarned(amount: number, donationSplit?: DonationSplit): void {
    if (this.callback) {
      this.callback({ visible: true, amount, donationSplit });
    } else {
      console.warn('[RewardNotification] Provider not registered - notification not shown');
    }
  }

  /**
   * Hide the notification
   * Usually called by the modal's onClose
   */
  hide(): void {
    if (this.callback) {
      this.callback({ visible: false, amount: 0 });
    }
  }

  /**
   * Show a pledge reward notification
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

    if (this.callback) {
      this.callback({
        visible: true,
        amount,
        pledgeInfo: {
          eventName,
          recipientName,
          completedWorkouts,
          totalWorkouts,
          isComplete,
        },
      });
    } else {
      console.warn(
        '[RewardNotification] Provider not registered - pledge notification not shown'
      );
    }
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
