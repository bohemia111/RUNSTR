/**
 * EventAnnouncementCardGenerator - Social Media Cards for Event Announcements
 * Creates beautiful announcement cards when captains create new events
 * Reuses SVG architecture from WorkoutCardGenerator
 */

import { RUNSTR_LOGO_BASE64 } from './runstrLogoBase64';
import { generateEventDeepLink } from '../../utils/eventDeepLink';

export interface EventAnnouncementData {
  eventId: string;
  eventName: string;
  teamId: string;
  teamName: string;
  eventDate: string; // ISO string
  eventTime?: string; // Time in "HH:MM" format (e.g., "09:00", "14:30")
  isRecurring?: boolean; // Whether event repeats weekly
  recurrenceDay?: string; // Day of week (e.g., "monday", "tuesday")
  description?: string; // Event description (optional)
  targetValue: number; // Distance value (5, 10, 21.1)
  targetUnit: string; // Distance unit (km)
  captainName?: string;
  durationMinutes?: number;
}

export interface AnnouncementCardData {
  svgContent: string;
  dimensions: { width: number; height: number };
  deepLink: string;
  metadata: {
    eventId: string;
    generatedAt: string;
  };
}

export class EventAnnouncementCardGenerator {
  private static instance: EventAnnouncementCardGenerator;

  private constructor() {}

  static getInstance(): EventAnnouncementCardGenerator {
    if (!EventAnnouncementCardGenerator.instance) {
      EventAnnouncementCardGenerator.instance =
        new EventAnnouncementCardGenerator();
    }
    return EventAnnouncementCardGenerator.instance;
  }

  /**
   * Generate event announcement card as SVG
   */
  async generateAnnouncementCard(
    event: EventAnnouncementData
  ): Promise<AnnouncementCardData> {
    try {
      console.log(
        `🎨 Generating announcement card for event: ${event.eventName}`
      );

      // ✅ FIX: Validate required fields before generating
      if (!event.eventId) {
        throw new Error('Event ID is required');
      }
      if (!event.teamId) {
        throw new Error('Team ID is required');
      }
      if (!event.eventName) {
        throw new Error('Event name is required');
      }
      if (!event.targetValue || !event.targetUnit) {
        console.warn('⚠️ Distance info missing, using defaults');
      }

      const dimensions = { width: 800, height: 600 };

      // Generate deep link
      const deepLink = generateEventDeepLink({
        eventId: event.eventId,
        teamId: event.teamId,
        eventName: event.eventName,
        eventDate: event.eventDate,
        entryFee: event.entryFee,
      });

      // Generate SVG content
      const svgContent = this.createAnnouncementSVG(event, deepLink, dimensions);

      return {
        svgContent,
        dimensions,
        deepLink,
        metadata: {
          eventId: event.eventId,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('❌ Error generating announcement card:', error);
      // ✅ FIX: Preserve original error message
      if (error instanceof Error) {
        throw error;
      }
      throw new Error('Failed to generate announcement card');
    }
  }

  /**
   * Create SVG card content for event announcement
   */
  private createAnnouncementSVG(
    event: EventAnnouncementData,
    deepLink: string,
    dimensions: { width: number; height: number }
  ): string {
    const { width, height } = dimensions;
    const centerX = width / 2;
    const accentColor = '#FF6B35'; // RUNSTR orange
    const sansFont = 'system-ui, -apple-system, sans-serif';

    // Format event date
    const eventDateObj = new Date(event.eventDate);
    const formattedDate = eventDateObj.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });

    // Format duration if available
    const durationText = event.durationMinutes
      ? this.formatDuration(event.durationMinutes)
      : null;

    // Format event time if available
    const timeText = event.eventTime ? this.formatTime(event.eventTime) : null;

    // Format recurring schedule if applicable
    const recurringText = event.isRecurring && event.recurrenceDay
      ? this.formatRecurringSchedule(event.recurrenceDay)
      : null;

    // Wrap description text (if provided)
    const descriptionLines = event.description
      ? this.wrapText(event.description, 60) // Max 60 chars per line
      : [];

    // Calculate dynamic Y positions based on what's shown
    let currentY = 240; // Starting Y for event date (moved up from 310)
    const lineHeight = 35;

    const dateY = currentY;
    currentY += lineHeight;

    const recurringY = recurringText ? currentY : null;
    if (recurringText) currentY += lineHeight;

    const durationY = durationText ? currentY : null;
    if (durationText) currentY += lineHeight;

    // Description section (if present)
    const descriptionStartY = descriptionLines.length > 0 ? currentY + 10 : null;
    if (descriptionLines.length > 0) {
      currentY += 10 + (descriptionLines.length * 25); // 25px per line
    }

    // Distance box Y position (add padding)
    const distanceBoxY = currentY + 15;

    // Calculate remaining element positions
    const teamNameY = distanceBoxY + 85; // Box height (60) + padding (25)
    const deepLinkY = teamNameY + 50;
    const brandingY = deepLinkY + 35;

    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <!-- Gradient background -->
          <linearGradient id="bgGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#000000;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#0a0a0a;stop-opacity:1" />
          </linearGradient>
        </defs>

        <!-- Background -->
        <rect width="${width}" height="${height}" fill="url(#bgGradient)"/>

        <!-- Orange accent bar at top -->
        <rect width="${width}" height="8" fill="${accentColor}"/>

        <!-- RUNSTR Logo (top center) -->
        <image
          href="${RUNSTR_LOGO_BASE64}"
          x="${centerX - 50}"
          y="30"
          width="100"
          height="100"
          preserveAspectRatio="xMidYMid meet"
        />

        <!-- "NEW EVENT" label -->
        <text
          x="${centerX}"
          y="160"
          font-family="${sansFont}"
          font-size="16"
          font-weight="600"
          text-anchor="middle"
          fill="${accentColor}"
          letter-spacing="2"
        >NEW EVENT</text>

        <!-- Event name -->
        <text
          x="${centerX}"
          y="210"
          font-family="${sansFont}"
          font-size="36"
          font-weight="700"
          text-anchor="middle"
          fill="#FFFFFF"
          letter-spacing="-0.5"
        >${this.escapeXml(event.eventName)}</text>

        <!-- Event date -->
        <text
          x="${centerX}"
          y="${dateY}"
          font-family="${sansFont}"
          font-size="20"
          font-weight="400"
          text-anchor="middle"
          fill="#FFFFFF"
          opacity="0.7"
        >${formattedDate}${timeText ? ' at ' + timeText : ''}</text>

        <!-- Recurring schedule (if applicable) -->
        ${
          recurringText
            ? `
        <text
          x="${centerX}"
          y="${recurringY}"
          font-family="${sansFont}"
          font-size="18"
          font-weight="400"
          text-anchor="middle"
          fill="#FFFFFF"
          opacity="0.6"
        >${recurringText}</text>
        `
            : ''
        }

        <!-- Duration (if available) -->
        ${
          durationText
            ? `
        <text
          x="${centerX}"
          y="${durationY}"
          font-family="${sansFont}"
          font-size="18"
          font-weight="400"
          text-anchor="middle"
          fill="#FFFFFF"
          opacity="0.6"
        >${durationText}</text>
        `
            : ''
        }

        <!-- Event description (if available) -->
        ${
          descriptionLines.length > 0
            ? descriptionLines
                .map(
                  (line, index) => `
        <text
          x="${centerX}"
          y="${descriptionStartY! + index * 25}"
          font-family="${sansFont}"
          font-size="16"
          font-weight="400"
          text-anchor="middle"
          fill="#FFFFFF"
          opacity="0.7"
        >${this.escapeXml(line)}</text>
        `
                )
                .join('')
            : ''
        }

        <!-- Distance box (centered) -->
        <g transform="translate(${centerX - 70}, ${distanceBoxY})">
          <rect x="0" y="0" width="140" height="60" fill="${accentColor}20" rx="8" stroke="${accentColor}" stroke-width="2"/>
          <text
            x="70"
            y="28"
            font-family="${sansFont}"
            font-size="24"
            font-weight="700"
            text-anchor="middle"
            fill="${accentColor}"
          >${event.targetValue} ${event.targetUnit}</text>
          <text
            x="70"
            y="48"
            font-family="${sansFont}"
            font-size="12"
            font-weight="500"
            text-anchor="middle"
            fill="#FFFFFF"
            opacity="0.7"
            letter-spacing="0.5"
          >DISTANCE</text>
        </g>

        <!-- Team name -->
        <text
          x="${centerX}"
          y="${teamNameY}"
          font-family="${sansFont}"
          font-size="16"
          font-weight="500"
          text-anchor="middle"
          fill="#FFFFFF"
          opacity="0.6"
        >Hosted by ${this.escapeXml(event.teamName)}</text>

        <!-- Deep link (bottom) -->
        <text
          x="${centerX}"
          y="${deepLinkY}"
          font-family="${sansFont}"
          font-size="14"
          font-weight="400"
          text-anchor="middle"
          fill="${accentColor}"
          opacity="0.8"
        >${deepLink}</text>

        <!-- RUNSTR branding -->
        <text
          x="${centerX}"
          y="${brandingY}"
          font-family="${sansFont}"
          font-size="12"
          font-weight="600"
          text-anchor="middle"
          fill="#FFFFFF"
          opacity="0.4"
          letter-spacing="1"
        >POWERED BY RUNSTR</text>
      </svg>
    `.trim();
  }

  /**
   * Wrap text into multiple lines based on max character width
   * @param text - Text to wrap
   * @param maxChars - Maximum characters per line
   * @returns Array of text lines
   */
  private wrapText(text: string, maxChars: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    for (const word of words) {
      const testLine = currentLine ? `${currentLine} ${word}` : word;

      if (testLine.length <= maxChars) {
        currentLine = testLine;
      } else {
        if (currentLine) {
          lines.push(currentLine);
        }
        currentLine = word;
      }
    }

    if (currentLine) {
      lines.push(currentLine);
    }

    return lines;
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(minutes: number): string {
    if (minutes < 60) {
      return `${minutes} minutes`;
    }

    const hours = Math.floor(minutes / 60);
    const remainingMinutes = minutes % 60;

    if (remainingMinutes === 0) {
      return `${hours} ${hours === 1 ? 'hour' : 'hours'}`;
    }

    return `${hours}h ${remainingMinutes}m`;
  }

  /**
   * Format time from 24-hour to 12-hour format
   * @param time - Time in "HH:MM" format (e.g., "09:00", "14:30")
   * @returns Formatted time (e.g., "9:00 AM", "2:30 PM")
   */
  private formatTime(time: string): string {
    const [hours, minutes] = time.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12; // Convert 0 to 12 for midnight
    return `${displayHours}:${minutes.toString().padStart(2, '0')} ${period}`;
  }

  /**
   * Format recurring schedule text
   * @param day - Day of week (e.g., "monday", "tuesday")
   * @returns Formatted text (e.g., "Weekly on Monday")
   */
  private formatRecurringSchedule(day: string): string {
    const capitalizedDay = day.charAt(0).toUpperCase() + day.slice(1);
    return `Weekly on ${capitalizedDay}`;
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;')
      .replace(/'/g, '&apos;');
  }
}

export default EventAnnouncementCardGenerator.getInstance();
