/**
 * ChallengeAnnouncementCardGenerator - Social Media Cards for Challenge Announcements
 * Creates beautiful announcement cards when users create new challenges
 * Reuses SVG architecture from EventAnnouncementCardGenerator
 */

import { RUNSTR_LOGO_BASE64 } from './runstrLogoBase64';

export interface ChallengeAnnouncementData {
  challengeId: string;
  challengeName: string;
  teamId: string;
  teamName: string;
  challengeDate: string; // ISO string
  challengeTime: string; // HH:MM format
  distance: number; // km
  opponentName: string;
  isRecurring?: boolean;
  recurrenceDay?:
    | 'monday'
    | 'tuesday'
    | 'wednesday'
    | 'thursday'
    | 'friday'
    | 'saturday'
    | 'sunday';
  description?: string;
}

export interface AnnouncementCardData {
  svgContent: string;
  dimensions: { width: number; height: number };
  deepLink: string;
  metadata: {
    challengeId: string;
    generatedAt: string;
  };
}

export class ChallengeAnnouncementCardGenerator {
  private static instance: ChallengeAnnouncementCardGenerator;

  private constructor() {}

  static getInstance(): ChallengeAnnouncementCardGenerator {
    if (!ChallengeAnnouncementCardGenerator.instance) {
      ChallengeAnnouncementCardGenerator.instance =
        new ChallengeAnnouncementCardGenerator();
    }
    return ChallengeAnnouncementCardGenerator.instance;
  }

  /**
   * Generate challenge announcement card as SVG
   */
  async generateAnnouncementCard(
    challenge: ChallengeAnnouncementData
  ): Promise<AnnouncementCardData> {
    try {
      console.log(
        `🎨 Generating announcement card for challenge: ${challenge.challengeName}`
      );

      const dimensions = { width: 800, height: 600 };

      // Generate deep link (simple format for now)
      const deepLink = `runstr://challenge/${challenge.challengeId}`;

      // Generate SVG content
      const svgContent = this.createAnnouncementSVG(
        challenge,
        deepLink,
        dimensions
      );

      return {
        svgContent,
        dimensions,
        deepLink,
        metadata: {
          challengeId: challenge.challengeId,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('❌ Error generating announcement card:', error);
      throw new Error('Failed to generate announcement card');
    }
  }

  /**
   * Create SVG card content for challenge announcement
   */
  private createAnnouncementSVG(
    challenge: ChallengeAnnouncementData,
    deepLink: string,
    dimensions: { width: number; height: number }
  ): string {
    const { width, height } = dimensions;
    const centerX = width / 2;
    const accentColor = '#FF6B35'; // RUNSTR orange
    const sansFont = 'system-ui, -apple-system, sans-serif';

    // Format date
    const challengeDate = new Date(challenge.challengeDate);
    const dateText = challengeDate.toLocaleDateString('en-US', {
      weekday: 'long',
      month: 'long',
      day: 'numeric',
    });

    // Format time (convert 24h to 12h)
    const [hours, minutes] = challenge.challengeTime.split(':').map(Number);
    const period = hours >= 12 ? 'PM' : 'AM';
    const displayHours = hours % 12 || 12;
    const timeText = `${displayHours}:${minutes
      .toString()
      .padStart(2, '0')} ${period}`;

    // Recurring text
    const recurringText =
      challenge.isRecurring && challenge.recurrenceDay
        ? `Every ${
            challenge.recurrenceDay.charAt(0).toUpperCase() +
            challenge.recurrenceDay.slice(1)
          }`
        : '';

    // Format opponent info
    const opponentText = challenge.opponentName;

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

        <!-- "NEW CHALLENGE" label -->
        <text
          x="${centerX}"
          y="160"
          font-family="${sansFont}"
          font-size="16"
          font-weight="600"
          text-anchor="middle"
          fill="${accentColor}"
          letter-spacing="2"
        >NEW CHALLENGE</text>

        <!-- Challenge name -->
        <text
          x="${centerX}"
          y="210"
          font-family="${sansFont}"
          font-size="36"
          font-weight="700"
          text-anchor="middle"
          fill="#FFFFFF"
          letter-spacing="-0.5"
        >${this.escapeXml(challenge.challengeName)}</text>

        <!-- Distance -->
        <text
          x="${centerX}"
          y="260"
          font-family="${sansFont}"
          font-size="28"
          font-weight="500"
          text-anchor="middle"
          fill="#FFFFFF"
          opacity="0.8"
        >🏃 ${challenge.distance} km</text>

        <!-- Date -->
        <text
          x="${centerX}"
          y="300"
          font-family="${sansFont}"
          font-size="20"
          font-weight="400"
          text-anchor="middle"
          fill="#FFFFFF"
          opacity="0.7"
        >📅 ${dateText}</text>

        <!-- Time -->
        <text
          x="${centerX}"
          y="335"
          font-family="${sansFont}"
          font-size="18"
          font-weight="400"
          text-anchor="middle"
          fill="#FFFFFF"
          opacity="0.6"
        >⏰ ${timeText}</text>

        <!-- Recurring (if applicable) -->
        ${
          recurringText
            ? `
        <text
          x="${centerX}"
          y="365"
          font-family="${sansFont}"
          font-size="16"
          font-weight="400"
          text-anchor="middle"
          fill="${accentColor}"
          opacity="0.8"
        >🔄 ${recurringText}</text>
        `
            : ''
        }

        <!-- Opponent info (centered card) -->
        <g transform="translate(${centerX - 150}, ${
      recurringText ? 385 : 360
    })">
          <rect x="0" y="0" width="300" height="70" fill="${accentColor}20" rx="12" stroke="${accentColor}" stroke-width="2"/>
          <text
            x="150"
            y="30"
            font-family="${sansFont}"
            font-size="18"
            font-weight="600"
            text-anchor="middle"
            fill="#FFFFFF"
            opacity="0.7"
            letter-spacing="1"
          >CHALLENGING</text>
          <text
            x="150"
            y="55"
            font-family="${sansFont}"
            font-size="24"
            font-weight="700"
            text-anchor="middle"
            fill="${accentColor}"
          >@${this.escapeXml(opponentText)}</text>
        </g>

        <!-- Team name -->
        <text
          x="${centerX}"
          y="${recurringText ? 490 : 465}"
          font-family="${sansFont}"
          font-size="16"
          font-weight="500"
          text-anchor="middle"
          fill="#FFFFFF"
          opacity="0.6"
        >Team: ${this.escapeXml(challenge.teamName)}</text>

        <!-- Deep link (bottom) -->
        <text
          x="${centerX}"
          y="${recurringText ? 540 : 520}"
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
          y="${recurringText ? 570 : 555}"
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

export default ChallengeAnnouncementCardGenerator.getInstance();
