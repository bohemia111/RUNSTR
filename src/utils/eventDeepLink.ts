/**
 * Event Deep Link Utilities
 * Generate and parse deep links for event sharing via social posts
 * Format: runstr://event/{eventId}?team={teamId}&name={eventName}&date={isoDate}
 */

export interface EventDeepLinkData {
  eventId: string;
  teamId: string;
  eventName: string;
  eventDate?: string; // ISO date string
  entryFee?: number; // sats
}

export interface ParsedEventData extends EventDeepLinkData {
  isValid: boolean;
  error?: string;
}

/**
 * Generate deep link URL for event sharing
 */
export function generateEventDeepLink(event: EventDeepLinkData): string {
  const params = new URLSearchParams({
    team: event.teamId,
    name: encodeURIComponent(event.eventName),
  });

  if (event.eventDate) {
    params.append('date', event.eventDate);
  }

  if (event.entryFee !== undefined && event.entryFee > 0) {
    params.append('fee', event.entryFee.toString());
  }

  return `runstr://event/${event.eventId}?${params.toString()}`;
}

/**
 * Parse deep link URL into event data
 */
export function parseEventDeepLink(url: string): ParsedEventData {
  try {
    // Extract event ID and query params from URL
    // runstr://event/{eventId}?team={teamId}&name={eventName}
    const eventMatch = url.match(/runstr:\/\/event\/([^?]+)/);

    if (!eventMatch || !eventMatch[1]) {
      return {
        eventId: '',
        teamId: '',
        eventName: '',
        isValid: false,
        error: 'Invalid event URL format',
      };
    }

    const eventId = eventMatch[1];

    // Parse query parameters
    const urlObj = new URL(url.replace('runstr://', 'https://'));
    const params = urlObj.searchParams;

    const teamId = params.get('team') || '';
    const eventName = decodeURIComponent(params.get('name') || '');
    const eventDate = params.get('date') || undefined;
    const entryFeeStr = params.get('fee');
    const entryFee = entryFeeStr ? parseInt(entryFeeStr) : undefined;

    // Validate required params
    if (!eventId || !teamId || !eventName) {
      return {
        eventId,
        teamId,
        eventName,
        isValid: false,
        error: 'Missing required event parameters',
      };
    }

    return {
      eventId,
      teamId,
      eventName,
      eventDate,
      entryFee,
      isValid: true,
    };
  } catch (error) {
    console.error('Failed to parse event deep link:', error);
    return {
      eventId: '',
      teamId: '',
      eventName: '',
      isValid: false,
      error: `Failed to parse URL: ${
        error instanceof Error ? error.message : 'Unknown error'
      }`,
    };
  }
}

/**
 * Validate if URL is an event deep link
 */
export function isEventDeepLink(url: string): boolean {
  return url.startsWith('runstr://event/');
}

/**
 * Generate user-friendly deep link text for display
 */
export function getEventDeepLinkDisplay(eventId: string): string {
  return `runstr://event/${eventId}`;
}

/**
 * Generate full deep link with all parameters for sharing
 */
export function getEventShareLink(
  eventId: string,
  teamId: string,
  eventName: string,
  eventDate?: string,
  entryFee?: number
): string {
  return generateEventDeepLink({
    eventId,
    teamId,
    eventName,
    eventDate,
    entryFee,
  });
}
