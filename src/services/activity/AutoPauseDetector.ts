/**
 * AutoPauseDetector - Smart pause detection
 *
 * Automatically pauses tracking when user stops moving (e.g., at stoplights)
 * and resumes when movement detected (like Strava/Nike Run Club)
 */

export class AutoPauseDetector {
  private stationaryTime: number = 0; // Seconds stationary
  private isStationary: boolean = false;
  private enabled: boolean = false;

  // Thresholds
  private readonly AUTO_PAUSE_THRESHOLD_SECONDS = 10; // Pause after 10 seconds stationary
  private readonly AUTO_RESUME_SPEED_MPS = 0.5; // Resume when speed > 0.5 m/s
  private readonly STATIONARY_SPEED_MPS = 0.3; // Consider stationary if speed < 0.3 m/s
  private readonly MIN_ACCURACY_METERS = 20; // Only use GPS readings with accuracy < 20m

  /**
   * Enable or disable auto-pause
   */
  setEnabled(enabled: boolean) {
    this.enabled = enabled;
    if (!enabled) {
      this.reset();
    }
  }

  /**
   * Check if auto-pause should trigger based on current speed and accuracy
   * Returns: 'pause' | 'resume' | null
   */
  checkForAutoPause(
    speed: number | undefined,
    accuracy: number | undefined
  ): 'pause' | 'resume' | null {
    if (!this.enabled) {
      return null;
    }

    // Ignore poor GPS readings
    if (accuracy === undefined || accuracy > this.MIN_ACCURACY_METERS) {
      return null;
    }

    // No speed data = can't determine movement
    if (speed === undefined) {
      return null;
    }

    // Check if user is stationary
    if (speed < this.STATIONARY_SPEED_MPS) {
      this.stationaryTime++;

      // Trigger auto-pause after threshold
      if (
        !this.isStationary &&
        this.stationaryTime >= this.AUTO_PAUSE_THRESHOLD_SECONDS
      ) {
        this.isStationary = true;
        console.log(
          `[AutoPauseDetector] 🛑 Auto-pause triggered (stationary for ${this.stationaryTime}s)`
        );
        return 'pause';
      }
    } else if (speed > this.AUTO_RESUME_SPEED_MPS) {
      // User is moving - resume if was stationary
      if (this.isStationary) {
        this.isStationary = false;
        this.stationaryTime = 0;
        console.log(
          '[AutoPauseDetector] ▶️ Auto-resume triggered (movement detected)'
        );
        return 'resume';
      }
      // Reset stationary counter
      this.stationaryTime = 0;
    }

    return null;
  }

  /**
   * Reset detector state
   */
  reset() {
    this.stationaryTime = 0;
    this.isStationary = false;
  }

  /**
   * Check if currently in stationary state
   */
  isCurrentlyStationary(): boolean {
    return this.isStationary;
  }

  /**
   * Get time user has been stationary (seconds)
   */
  getStationaryTime(): number {
    return this.stationaryTime;
  }
}

// Export singleton instance
export const autoPauseDetector = new AutoPauseDetector();
