/**
 * QRCodeService
 * Service for generating and parsing QR codes for events and NWC connections
 */

export interface EventQRData {
  type: 'event';
  id: string;
  team_id: string;
  captain_npub: string;
  name: string;
  description?: string;
  starts: number;
  ends: number;
}

export interface NWCQRData {
  type: 'nwc';
  connectionString: string;
}

export type QRData = EventQRData | NWCQRData;

class QRCodeService {
  private static instance: QRCodeService;

  static getInstance(): QRCodeService {
    if (!QRCodeService.instance) {
      QRCodeService.instance = new QRCodeService();
    }
    return QRCodeService.instance;
  }

  /**
   * Generate QR code data for an event
   */
  generateEventQR(
    eventId: string,
    teamId: string,
    captainNpub: string,
    name: string,
    starts: number,
    ends: number,
    description?: string
  ): string {
    const data: EventQRData = {
      type: 'event',
      id: eventId,
      team_id: teamId,
      captain_npub: captainNpub,
      name,
      description,
      starts,
      ends,
    };
    return JSON.stringify(data);
  }

  /**
   * Parse scanned QR code data
   */
  parseQR(qrString: string): QRData | null {
    try {
      // Normalize: trim whitespace and decode URL encoding
      const normalized = qrString.trim();
      const decoded = normalized.includes('%')
        ? decodeURIComponent(normalized)
        : normalized;

      // Check for NWC connection string (case-insensitive for robustness)
      if (decoded.toLowerCase().startsWith('nostr+walletconnect://')) {
        return {
          type: 'nwc',
          connectionString: decoded,
        };
      }

      // Otherwise try to parse as JSON (challenge/event)
      const data = JSON.parse(decoded);
      return this.validateQRData(data) ? data : null;
    } catch (error) {
      console.error('Failed to parse QR code:', error);
      return null;
    }
  }

  /**
   * Validate QR data structure
   */
  private validateQRData(data: any): data is QRData {
    if (!data || typeof data !== 'object') {
      return false;
    }

    if (data.type === 'event') {
      return !!(
        data.id &&
        data.team_id &&
        data.captain_npub &&
        data.name &&
        typeof data.starts === 'number' &&
        typeof data.ends === 'number'
      );
    }

    if (data.type === 'nwc') {
      return !!(
        data.connectionString && typeof data.connectionString === 'string'
      );
    }

    return false;
  }

  /**
   * Format duration for display
   */
  formatDuration(days: number): string {
    if (days === 1) return '1 day';
    if (days === 7) return '1 week';
    if (days === 14) return '2 weeks';
    if (days === 30) return '1 month';
    return `${days} days`;
  }

  /**
   * Format activity type for display
   */
  formatActivity(activity: string): string {
    return activity.charAt(0).toUpperCase() + activity.slice(1);
  }

  /**
   * Format metric for display
   */
  formatMetric(metric: string): string {
    const metricMap: Record<string, string> = {
      distance: 'Distance',
      duration: 'Duration',
      count: 'Count',
      calories: 'Calories',
      pace: 'Pace',
    };
    return metricMap[metric] || metric;
  }

  /**
   * Format wager amount for display
   */
  formatWager(sats: number): string {
    if (sats >= 1000) {
      return `${(sats / 1000).toFixed(1)}k sats`;
    }
    return `${sats} sats`;
  }
}

// Export class instead of instance to prevent blocking module initialization
export default QRCodeService;
export { QRCodeService };
