/**
 * WorkoutCardGenerator - Beautiful Social Media Cards for Workouts
 * React Native SVG-based card generation inspired by Quotestr
 * Creates visually stunning workout achievement cards with RUNSTR branding
 */

import type { WorkoutType } from '../../types/workout';
import type { PublishableWorkout } from './workoutPublishingService';
import { RUNSTR_LOGO_BASE64 } from './runstrLogoBase64';
import { formatDistanceValue } from '../../utils/distanceFormatter';

export interface WorkoutCardOptions {
  template?: 'achievement' | 'progress' | 'minimal' | 'stats' | 'elegant';
  backgroundColor?: string;
  accentColor?: string;
  includeQR?: boolean;
  includeMap?: boolean; // For workouts with GPS data
  customMessage?: string;
  showBranding?: boolean;
  userAvatar?: string; // User's profile picture URL
  userName?: string; // User's display name
}

export interface WorkoutCardData {
  svgContent: string;
  base64Image?: string;
  dimensions: { width: number; height: number };
  metadata: {
    workoutId: string;
    template: string;
    generatedAt: string;
  };
}

// Card templates configuration - RUNSTR orange and black theme
const CARD_TEMPLATES = {
  achievement: {
    width: 800,
    height: 600,
    backgroundColor: '#000000',
    accentColor: '#FF6B35', // RUNSTR orange
    showStats: true,
    showMotivation: true,
    showBranding: true,
  },
  progress: {
    width: 800,
    height: 600,
    backgroundColor: '#000000',
    accentColor: '#FF6B35', // RUNSTR orange
    showStats: true,
    showProgress: true,
    showBranding: true,
  },
  minimal: {
    width: 600,
    height: 600,
    backgroundColor: '#000000',
    accentColor: '#FF6B35', // RUNSTR orange
    showStats: true, // Show just duration and distance
    showMotivation: false,
    showBranding: false,
  },
  stats: {
    width: 800,
    height: 800,
    backgroundColor: '#000000',
    accentColor: '#FF6B35', // RUNSTR orange
    showStats: true,
    showCharts: true,
    showBranding: true,
  },
  elegant: {
    width: 800,
    height: 600,
    backgroundColor: '#000000',
    accentColor: '#FFFFFF', // White for elegant design
    showStats: true,
    showMotivation: false,
    showBranding: true,
    useSplitLayout: true, // Two-panel split
    useSerifFont: true, // Serif typography
  },
} as const;

export class WorkoutCardGenerator {
  private static instance: WorkoutCardGenerator;

  private constructor() {}

  static getInstance(): WorkoutCardGenerator {
    if (!WorkoutCardGenerator.instance) {
      WorkoutCardGenerator.instance = new WorkoutCardGenerator();
    }
    return WorkoutCardGenerator.instance;
  }

  /**
   * Generate workout card as SVG
   */
  async generateWorkoutCard(
    workout: PublishableWorkout,
    options: WorkoutCardOptions = {}
  ): Promise<WorkoutCardData> {
    try {
      console.log(`🎨 Generating workout card for ${workout.type} workout...`);

      const template = options.template || 'achievement';
      const config = CARD_TEMPLATES[template];
      const dimensions = { width: config.width, height: config.height };

      // Generate SVG content
      const svgContent = this.createSVGCard(workout, config, options);

      return {
        svgContent,
        dimensions,
        metadata: {
          workoutId: workout.id,
          template,
          generatedAt: new Date().toISOString(),
        },
      };
    } catch (error) {
      console.error('❌ Error generating workout card:', error);
      throw new Error('Failed to generate workout card');
    }
  }

  /**
   * Create SVG card content
   */
  private createSVGCard(
    workout: PublishableWorkout,
    config: (typeof CARD_TEMPLATES)[keyof typeof CARD_TEMPLATES],
    options: WorkoutCardOptions
  ): string {
    // Use elegant split-panel layout for 'elegant' template
    if (options.template === 'elegant') {
      return this.createElegantCard(workout, config, options);
    }

    // Use modern centered layout for 'minimal' template
    if (options.template === 'minimal') {
      return this.createMinimalCard(workout, config, options);
    }

    const { width, height } = config;

    // Get dynamic colors based on activity type
    const activityColors = this.getActivityColors(workout.type);
    const backgroundColor =
      options.backgroundColor || activityColors.background;
    const accentColor = options.accentColor || activityColors.accent;

    // Build SVG components based on template configuration
    const background = this.createBackground(width, height, backgroundColor);
    const avatar = options.userAvatar
      ? this.createUserAvatar(
          options.userAvatar,
          options.userName,
          20,
          20,
          accentColor
        )
      : '';
    const weather = workout.weather
      ? this.createWeatherBadge(workout.weather, width - 120, 20, accentColor)
      : '';
    const activityIcon = this.createActivityIcon(
      workout.type,
      80,
      80,
      accentColor
    );
    const title = this.createTitle(workout, 100, accentColor);

    // Only show stats if template config allows it
    const stats = config.showStats
      ? this.createStatsSection(workout, 180, accentColor)
      : '';

    // Only show achievement badge if we have one and template supports it
    const achievement = 'showMotivation' in config && config.showMotivation
      ? this.createAchievementBadge(workout, 320, accentColor)
      : '';

    // Only show motivational message if template config allows it
    const motivation = 'showMotivation' in config && config.showMotivation
      ? this.createMotivationalMessage(workout, 420, accentColor)
      : '';

    // Branding can be disabled via options or template
    const branding =
      (options.showBranding !== false && config.showBranding)
        ? this.createBranding(workout, height - 60, accentColor)
        : '';

    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        ${background}
        ${avatar}
        ${weather}
        <g transform="translate(40, 40)">
          ${activityIcon}
          ${title}
          ${stats}
          ${achievement}
          ${motivation}
        </g>
        ${branding}
      </svg>
    `.trim();
  }

  /**
   * Create elegant Quotestr-inspired split-panel card
   * Left panel: Grayscale user avatar or workout icon (400px)
   * Right panel: Black background with elegant serif text (400px)
   */
  private createElegantCard(
    workout: PublishableWorkout,
    config: (typeof CARD_TEMPLATES)[keyof typeof CARD_TEMPLATES],
    options: WorkoutCardOptions
  ): string {
    const { width, height } = config;
    const panelWidth = width / 2; // 400px each panel

    // Serif font family (system fonts with good cross-platform support)
    const serifFont = 'Georgia, Times New Roman, serif';
    const sansFont = 'system-ui, -apple-system, sans-serif';

    // Left panel: Grayscale avatar or workout icon
    const leftPanel = this.createElegantLeftPanel(
      workout,
      options.userAvatar,
      panelWidth,
      height
    );

    // Right panel: Black background with workout details
    const rightPanel = this.createElegantRightPanel(
      workout,
      options,
      panelWidth,
      height,
      serifFont,
      sansFont
    );

    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <filter id="grayscale">
            <feColorMatrix type="saturate" values="0"/>
          </filter>
        </defs>

        <!-- Black background -->
        <rect width="${width}" height="${height}" fill="#000000"/>

        <!-- Left panel with grayscale image -->
        <g transform="translate(0, 0)">
          ${leftPanel}
        </g>

        <!-- Dividing line -->
        <line x1="${panelWidth}" y1="0" x2="${panelWidth}" y2="${height}" stroke="#FFFFFF" stroke-width="0.5" opacity="0.2"/>

        <!-- Right panel with text -->
        <g transform="translate(${panelWidth}, 0)">
          ${rightPanel}
        </g>
      </svg>
    `.trim();
  }

  /**
   * Create left panel for elegant card (grayscale image)
   */
  private createElegantLeftPanel(
    workout: PublishableWorkout,
    userAvatar: string | undefined,
    width: number,
    height: number
  ): string {
    if (userAvatar) {
      // User avatar with grayscale filter
      return `
        <image
          href="${userAvatar}"
          x="0"
          y="0"
          width="${width}"
          height="${height}"
          preserveAspectRatio="xMidYMid slice"
          filter="url(#grayscale)"
          opacity="0.8"
        />
      `;
    } else {
      // Fallback: Large centered workout icon with grayscale effect
      const icon = this.getWorkoutIcon(workout.type);
      return `
        <rect width="${width}" height="${height}" fill="#1a1a1a"/>
        <text
          x="${width / 2}"
          y="${height / 2}"
          font-size="120"
          text-anchor="middle"
          alignment-baseline="middle"
          opacity="0.3"
        >${icon}</text>
      `;
    }
  }

  /**
   * Create right panel for elegant card (text content)
   */
  private createElegantRightPanel(
    workout: PublishableWorkout,
    options: WorkoutCardOptions,
    width: number,
    height: number,
    serifFont: string,
    sansFont: string
  ): string {
    const padding = 40;
    const contentWidth = width - (padding * 2);

    // Workout type and date
    const workoutType = this.getWorkoutTypeName(workout);
    const date = new Date(workout.startTime).toLocaleDateString('en-US', {
      month: 'long',
      day: 'numeric',
      year: 'numeric'
    });

    // Key stats with null safety
    const stats = this.getWorkoutStats(workout);
    const primaryStat = stats[0] || {
      value: this.formatDurationDetailed(workout.duration),
      label: 'Duration'
    };
    const secondaryStat = stats[1]; // Keep optional (handled with conditional rendering)

    // Motivational quote (optional) - wrap text ONCE and cache result
    const quote = options.customMessage || this.getMotivationalMessage(workout);
    const wrappedLines = quote ? this.wrapText(quote, 35) : [];

    // Build quote tspans safely
    let quoteTspans = '';
    if (wrappedLines.length > 0) {
      quoteTspans = `<tspan x="${padding}" dy="0">"${this.escapeXml(wrappedLines[0])}"</tspan>`;
      for (let i = 1; i < wrappedLines.length; i++) {
        quoteTspans += `<tspan x="${padding}" dy="18">${this.escapeXml(wrappedLines[i])}</tspan>`;
      }
    }

    return `
      <!-- User name (if available) -->
      ${options.userName ? `
        <text
          x="${padding}"
          y="40"
          font-family="${sansFont}"
          font-size="12"
          font-weight="500"
          fill="#FFFFFF"
          opacity="0.6"
          letter-spacing="0.5"
        >${this.escapeXml(options.userName).toUpperCase()}</text>
      ` : ''}

      <!-- Workout type -->
      <text
        x="${padding}"
        y="${options.userName ? 80 : 60}"
        font-family="${serifFont}"
        font-size="32"
        font-weight="400"
        fill="#FFFFFF"
        letter-spacing="-0.5"
      >${this.escapeXml(workoutType)}</text>

      <!-- Date -->
      <text
        x="${padding}"
        y="${options.userName ? 110 : 90}"
        font-family="${sansFont}"
        font-size="14"
        font-weight="400"
        fill="#FFFFFF"
        opacity="0.5"
      >${date}</text>

      <!-- Primary stat (duration) -->
      <text
        x="${padding}"
        y="${options.userName ? 180 : 160}"
        font-family="${serifFont}"
        font-size="64"
        font-weight="300"
        fill="#FFFFFF"
        letter-spacing="-1"
      >${primaryStat.value}</text>

      <text
        x="${padding}"
        y="${options.userName ? 210 : 190}"
        font-family="${sansFont}"
        font-size="12"
        font-weight="500"
        fill="#FFFFFF"
        opacity="0.5"
        letter-spacing="1"
      >${primaryStat.label.toUpperCase()}</text>

      <!-- Secondary stat (distance, calories, etc.) -->
      ${secondaryStat ? `
        <text
          x="${padding}"
          y="${options.userName ? 270 : 250}"
          font-family="${serifFont}"
          font-size="36"
          font-weight="300"
          fill="#FFFFFF"
        >${secondaryStat.value}</text>

        <text
          x="${padding}"
          y="${options.userName ? 295 : 275}"
          font-family="${sansFont}"
          font-size="12"
          font-weight="500"
          fill="#FFFFFF"
          opacity="0.5"
          letter-spacing="1"
        >${secondaryStat.label.toUpperCase()}</text>
      ` : ''}

      <!-- Motivational quote -->
      ${quoteTspans ? `
        <text
          x="${padding}"
          y="${height - 100}"
          font-family="${serifFont}"
          font-size="14"
          font-weight="400"
          font-style="italic"
          fill="#FFFFFF"
          opacity="0.7"
        >${quoteTspans}</text>
      ` : ''}

      <!-- RUNSTR branding -->
      <text
        x="${padding}"
        y="${height - 40}"
        font-family="${sansFont}"
        font-size="10"
        font-weight="600"
        fill="#FFFFFF"
        opacity="0.4"
        letter-spacing="1"
      >RUNSTR</text>
    `;
  }

  /**
   * Create modern minimal card with centered RUNSTR logo
   * Instagram-story-style vertical layout with clean typography
   */
  private createMinimalCard(
    workout: PublishableWorkout,
    config: (typeof CARD_TEMPLATES)[keyof typeof CARD_TEMPLATES],
    options: WorkoutCardOptions
  ): string {
    const { width, height } = config;
    const centerX = width / 2;
    const sansFont = 'system-ui, -apple-system, sans-serif';

    // Get activity name (e.g., "MEDITATION", "RUNNING")
    const activityName = this.getWorkoutTypeName(workout).toUpperCase();

    // Format duration as MM:SS
    const duration = this.formatDurationDetailed(workout.duration);

    // Get distance if available
    const distance = workout.distance
      ? `${formatDistanceValue(workout.distance)} km`
      : null;

    return `
      <svg width="${width}" height="${height}" xmlns="http://www.w3.org/2000/svg">
        <defs>
          <!-- Subtle gradient background -->
          <linearGradient id="minimalGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" style="stop-color:#000000;stop-opacity:1" />
            <stop offset="100%" style="stop-color:#0a0a0a;stop-opacity:1" />
          </linearGradient>
        </defs>

        <!-- Background -->
        <rect width="${width}" height="${height}" fill="url(#minimalGradient)"/>

        <!-- RUNSTR Ostrich Logo (centered, 120x120) -->
        <image
          href="${RUNSTR_LOGO_BASE64}"
          x="${centerX - 60}"
          y="80"
          width="120"
          height="120"
          preserveAspectRatio="xMidYMid meet"
        />

        <!-- Activity name (white) -->
        <text
          x="${centerX}"
          y="260"
          font-family="${sansFont}"
          font-size="36"
          font-weight="700"
          text-anchor="middle"
          fill="#FFFFFF"
          letter-spacing="2"
        >${this.escapeXml(activityName)}</text>

        <!-- "COMPLETED" text (orange) -->
        <text
          x="${centerX}"
          y="300"
          font-family="${sansFont}"
          font-size="36"
          font-weight="700"
          text-anchor="middle"
          fill="${config.accentColor}"
          letter-spacing="2"
        >COMPLETED</text>

        <!-- Duration label -->
        <text
          x="${centerX}"
          y="370"
          font-family="${sansFont}"
          font-size="14"
          font-weight="500"
          text-anchor="middle"
          fill="#FFFFFF"
          opacity="0.6"
          letter-spacing="1"
        >DURATION</text>

        <!-- Duration value (large, bold, orange) -->
        <text
          x="${centerX}"
          y="430"
          font-family="${sansFont}"
          font-size="72"
          font-weight="300"
          text-anchor="middle"
          fill="${config.accentColor}"
          letter-spacing="-2"
        >${duration}</text>

        ${
          distance
            ? `
        <!-- Distance (if available) -->
        <text
          x="${centerX}"
          y="480"
          font-family="${sansFont}"
          font-size="24"
          font-weight="400"
          text-anchor="middle"
          fill="#FFFFFF"
          opacity="0.7"
        >${distance}</text>
        `
            : ''
        }

        <!-- RUNSTR branding (bottom) -->
        <text
          x="${centerX}"
          y="540"
          font-family="${sansFont}"
          font-size="12"
          font-weight="600"
          text-anchor="middle"
          fill="#FFFFFF"
          opacity="0.3"
          letter-spacing="2"
        >RUNSTR</text>
      </svg>
    `.trim();
  }

  /**
   * Get workout icon (no emoji, just simple shapes)
   */
  private getWorkoutIcon(type: WorkoutType): string {
    const icons = {
      running: '🏃',
      cycling: '🚴',
      walking: '🚶',
      hiking: '🥾',
      gym: '💪',
      strength_training: '🏋️',
      yoga: '🧘',
      meditation: '🧘',
      other: '⚡',
    };
    return icons[type] || icons.other;
  }

  /**
   * Get clean workout type name (no underscores)
   */
  private getWorkoutTypeName(workout: PublishableWorkout): string {
    const typeMap: Record<string, string> = {
      running: 'Running',
      cycling: 'Cycling',
      walking: 'Walking',
      hiking: 'Hiking',
      gym: 'Gym Session',
      strength_training: 'Strength Training',
      yoga: 'Yoga',
      meditation: 'Meditation',
      other: 'Workout',
    };
    return typeMap[workout.type] || 'Workout';
  }

  /**
   * Wrap text to fit within a certain character width
   */
  private wrapText(text: string, maxChars: number): string[] {
    const words = text.split(' ');
    const lines: string[] = [];
    let currentLine = '';

    words.forEach((word) => {
      if ((currentLine + word).length <= maxChars) {
        currentLine += (currentLine ? ' ' : '') + word;
      } else {
        if (currentLine) lines.push(currentLine);
        currentLine = word;
      }
    });

    if (currentLine) lines.push(currentLine);
    return lines.slice(0, 3); // Max 3 lines
  }

  /**
   * Get RUNSTR brand colors (orange and black theme)
   */
  private getActivityColors(type: WorkoutType): {
    background: string;
    accent: string;
  } {
    // All workouts use RUNSTR's signature orange and black theme
    return { background: '#000000', accent: '#FF6B35' }; // RUNSTR orange
  }

  /**
   * Create user avatar with circular clip
   */
  private createUserAvatar(
    avatarUrl: string,
    userName: string | undefined,
    x: number,
    y: number,
    accentColor: string
  ): string {
    return `
      <g transform="translate(${x}, ${y})">
        <defs>
          <clipPath id="avatarClip">
            <circle cx="30" cy="30" r="30"/>
          </clipPath>
        </defs>
        <!-- Avatar circle background -->
        <circle cx="30" cy="30" r="30" fill="${accentColor}20" stroke="${accentColor}" stroke-width="2"/>
        <!-- Avatar image -->
        <image href="${avatarUrl}" x="0" y="0" width="60" height="60" clip-path="url(#avatarClip)" preserveAspectRatio="xMidYMid slice"/>
        ${
          userName
            ? `<text x="70" y="35" font-family="Arial, sans-serif" font-size="14" font-weight="600" fill="${accentColor}">${this.escapeXml(
                userName
              )}</text>`
            : ''
        }
      </g>
    `;
  }

  /**
   * Create weather badge with icon and temperature
   */
  private createWeatherBadge(
    weather: { icon: string; temp: number; description?: string },
    x: number,
    y: number,
    accentColor: string
  ): string {
    const weatherEmoji = this.getWeatherEmoji(weather.icon);

    return `
      <g transform="translate(${x}, ${y})">
        <rect x="0" y="0" width="100" height="50" fill="${accentColor}15" rx="25" ry="25" stroke="${accentColor}30" stroke-width="1"/>
        <text x="25" y="30" font-size="20" text-anchor="middle" alignment-baseline="middle">${weatherEmoji}</text>
        <text x="65" y="30" font-family="Arial, sans-serif" font-size="16" font-weight="600" text-anchor="middle" alignment-baseline="middle" fill="${accentColor}">${weather.temp}°C</text>
      </g>
    `;
  }

  /**
   * Get weather emoji from icon code
   */
  private getWeatherEmoji(icon: string): string {
    const iconMap: Record<string, string> = {
      '01d': '☀️',
      '01n': '🌙',
      '02d': '⛅',
      '02n': '☁️',
      '03d': '☁️',
      '03n': '☁️',
      '04d': '☁️',
      '04n': '☁️',
      '09d': '🌧️',
      '09n': '🌧️',
      '10d': '🌦️',
      '10n': '🌧️',
      '11d': '⛈️',
      '11n': '⛈️',
      '13d': '❄️',
      '13n': '❄️',
      '50d': '🌫️',
      '50n': '🌫️',
    };
    return iconMap[icon] || '🌤️';
  }

  /**
   * Escape XML special characters
   */
  private escapeXml(text: string): string {
    return text
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  /**
   * Create background with gradient
   */
  private createBackground(
    width: number,
    height: number,
    backgroundColor: string
  ): string {
    return `
      <defs>
        <linearGradient id="backgroundGradient" x1="0%" y1="0%" x2="100%" y2="100%">
          <stop offset="0%" style="stop-color:${backgroundColor};stop-opacity:1" />
          <stop offset="100%" style="stop-color:${this.adjustBrightness(
            backgroundColor,
            20
          )};stop-opacity:1" />
        </linearGradient>
        <filter id="glow">
          <feGaussianBlur stdDeviation="3" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>
      <rect width="${width}" height="${height}" fill="url(#backgroundGradient)" rx="12" ry="12"/>
    `;
  }

  /**
   * Create activity icon with workout type
   */
  private createActivityIcon(
    type: WorkoutType,
    y: number,
    size: number,
    accentColor: string
  ): string {
    const icons = {
      running: '🏃‍♂️',
      cycling: '🚴‍♂️',
      walking: '🚶‍♂️',
      hiking: '🥾',
      gym: '💪',
      strength_training: '🏋️‍♂️',
      yoga: '🧘‍♂️',
      meditation: '🧘‍♂️', // Same as yoga icon for meditation workouts
      other: '⚡',
    };

    const icon = icons[type] || icons.other;

    return `
      <g transform="translate(0, ${y})">
        <circle cx="40" cy="40" r="40" fill="${accentColor}20" stroke="${accentColor}" stroke-width="2"/>
        <text x="40" y="50" font-size="${
          size * 0.6
        }" text-anchor="middle" alignment-baseline="middle">${icon}</text>
      </g>
    `;
  }

  /**
   * Create workout title
   */
  private createTitle(
    workout: PublishableWorkout,
    y: number,
    accentColor: string
  ): string {
    const workoutType =
      workout.type.charAt(0).toUpperCase() +
      workout.type.slice(1).replace('_', ' ');
    const completedText = 'Workout Complete!';

    return `
      <g transform="translate(100, ${y})">
        <text x="0" y="0" font-family="Arial, sans-serif" font-size="24" font-weight="bold" fill="${accentColor}">
          ${completedText}
        </text>
        <text x="0" y="35" font-family="Arial, sans-serif" font-size="32" font-weight="700" fill="${accentColor}">
          ${workoutType}
        </text>
      </g>
    `;
  }

  /**
   * Create stats section with key metrics
   */
  private createStatsSection(
    workout: PublishableWorkout,
    y: number,
    accentColor: string
  ): string {
    const stats = this.getWorkoutStats(workout);
    let statsElements = '';
    let xOffset = 100;

    stats.forEach((stat, index) => {
      if (index < 4) {
        // Max 4 stats to fit nicely
        statsElements += `
          <g transform="translate(${xOffset}, ${y})">
            <rect x="0" y="0" width="140" height="80" fill="${accentColor}15" rx="8" ry="8" stroke="${accentColor}30" stroke-width="1"/>
            <text x="70" y="25" font-family="Arial, sans-serif" font-size="18" font-weight="700" text-anchor="middle" fill="${accentColor}">
              ${stat.value}
            </text>
            <text x="70" y="45" font-family="Arial, sans-serif" font-size="12" text-anchor="middle" fill="${accentColor}80">
              ${stat.label}
            </text>
          </g>
        `;
        xOffset += 160;
      }
    });

    return statsElements;
  }

  /**
   * Create achievement badge
   */
  private createAchievementBadge(
    workout: PublishableWorkout,
    y: number,
    accentColor: string
  ): string {
    const achievement = this.getAchievementText(workout);

    if (!achievement) return '';

    return `
      <g transform="translate(100, ${y})">
        <rect x="0" y="0" width="500" height="60" fill="${accentColor}" rx="30" ry="30" filter="url(#glow)"/>
        <text x="250" y="35" font-family="Arial, sans-serif" font-size="18" font-weight="600" text-anchor="middle" fill="#000000">
          🎉 ${achievement}
        </text>
      </g>
    `;
  }

  /**
   * Create motivational message
   */
  private createMotivationalMessage(
    workout: PublishableWorkout,
    y: number,
    accentColor: string
  ): string {
    const message = this.getMotivationalMessage(workout);

    return `
      <g transform="translate(100, ${y})">
        <text x="250" y="0" font-family="Arial, sans-serif" font-size="16" text-anchor="middle" fill="${accentColor}90">
          "${message}"
        </text>
      </g>
    `;
  }

  /**
   * Create RUNSTR branding
   */
  private createBranding(
    workout: PublishableWorkout,
    y: number,
    accentColor: string
  ): string {
    return `
      <g transform="translate(40, ${y})">
        <text x="0" y="0" font-family="Arial, sans-serif" font-size="14" font-weight="600" fill="${accentColor}60">
          💪 Tracked with RUNSTR
        </text>
        <text x="600" y="0" font-family="Arial, sans-serif" font-size="12" text-anchor="end" fill="${accentColor}40">
          #fitness #${this.sanitizeHashtag(workout.type)} #RUNSTR
        </text>
      </g>
    `;
  }

  /**
   * Get formatted workout stats
   */
  private getWorkoutStats(
    workout: PublishableWorkout
  ): Array<{ value: string; label: string }> {
    const stats = [];

    // Duration
    const duration = this.formatDurationDetailed(workout.duration);
    stats.push({ value: duration, label: 'Duration' });

    // Distance
    if (workout.distance) {
      const distance = `${formatDistanceValue(workout.distance)} km`;
      stats.push({ value: distance, label: 'Distance' });
    }

    // Calories
    if (workout.calories) {
      stats.push({
        value: Math.round(workout.calories).toString(),
        label: 'Calories',
      });
    }

    // Heart Rate
    if (workout.heartRate?.avg) {
      stats.push({
        value: `${Math.round(workout.heartRate.avg)}`,
        label: 'Avg HR',
      });
    }

    // Activity-specific stats

    // Cycling: Show speed (km/h) instead of pace
    if (workout.type === 'cycling' && workout.distance && workout.duration) {
      const speedKmh = (workout.distance / 1000) / (workout.duration / 3600);
      stats.push({
        value: `${speedKmh.toFixed(1)} km/h`,
        label: 'Speed',
      });
    }

    // Pace (for running only - cycling shows speed instead)
    if (
      workout.type === 'running' &&
      workout.pace &&
      workout.distance
    ) {
      const paceMin = Math.floor(workout.pace / 60);
      const paceSec = workout.pace % 60;
      stats.push({
        value: `${paceMin}:${paceSec.toString().padStart(2, '0')}`,
        label: 'Pace/km',
      });
    }

    // Strength training: Show per-set breakdown or summary
    if (['strength_training', 'gym'].includes(workout.type)) {
      // If we have per-set weight data, show detailed breakdown
      if (workout.weightsPerSet && workout.weightsPerSet.length > 0) {
        // Get reps breakdown from metadata if available
        const repsBreakdown = (workout.metadata as any)?.repsBreakdown as number[] | undefined;

        // Show first 3 sets (to avoid overcrowding the card)
        const setsToShow = Math.min(3, workout.weightsPerSet.length);
        for (let i = 0; i < setsToShow; i++) {
          const reps = repsBreakdown?.[i] || 0;
          const weight = workout.weightsPerSet[i];
          stats.push({
            value: `${reps} @ ${weight} lbs`,
            label: `Set ${i + 1}`,
          });
        }

        // If more than 3 sets, show "..." indicator
        if (workout.weightsPerSet.length > 3) {
          stats.push({
            value: `+${workout.weightsPerSet.length - 3} more`,
            label: 'Sets',
          });
        }
      } else {
        // Fallback: Show summary stats (sets, reps, weight)
        if (workout.sets) {
          stats.push({
            value: workout.sets.toString(),
            label: 'Sets',
          });
        }
        if (workout.reps) {
          stats.push({
            value: workout.reps.toString(),
            label: 'Reps',
          });
        }
        if (workout.weight && workout.weight > 0) {
          stats.push({
            value: `${workout.weight} lbs`,
            label: 'Avg Weight',
          });
        }
      }
    }

    // Walking: Show steps from metadata
    if (workout.type === 'walking' && workout.metadata?.steps) {
      const steps = Math.round(workout.metadata.steps);
      stats.push({
        value: steps.toLocaleString(),
        label: 'Steps',
      });
    }

    // Diet: Show meal type and meal size
    if (workout.type === 'diet') {
      if (workout.mealType) {
        // Capitalize first letter
        const mealTypeFormatted = workout.mealType.charAt(0).toUpperCase() + workout.mealType.slice(1);
        stats.push({
          value: mealTypeFormatted,
          label: 'Meal',
        });
      }
      if (workout.mealSize) {
        // Capitalize first letter
        const mealSizeFormatted = workout.mealSize.charAt(0).toUpperCase() + workout.mealSize.slice(1);
        stats.push({
          value: mealSizeFormatted,
          label: 'Portion',
        });
      }
    }

    // Meditation: Show meditation type
    if (workout.type === 'meditation') {
      if (workout.meditationType) {
        // Format meditation type nicely (e.g., "body_scan" → "Body Scan")
        const typeFormatted = workout.meditationType
          .split('_')
          .map(word => word.charAt(0).toUpperCase() + word.slice(1))
          .join(' ');
        stats.push({
          value: typeFormatted,
          label: 'Type',
        });
      }
    }

    return stats;
  }

  /**
   * Get achievement text for workout
   */
  private getAchievementText(workout: PublishableWorkout): string | null {
    // Distance-based achievements
    if (workout.distance) {
      const km = workout.distance / 1000;
      if (km >= 21.1) return 'Half Marathon Distance!';
      if (km >= 10) return '10K Achievement!';
      if (km >= 5) return '5K Complete!';
    }

    // Duration-based achievements
    if (workout.duration >= 3600) return '1+ Hour Workout!';
    if (workout.duration >= 1800) return '30+ Minute Session!';

    // Calorie achievements
    if (workout.calories && workout.calories >= 500)
      return '500+ Calories Burned!';

    // First workout of the day/week
    const today = new Date().toDateString();
    const workoutDate = new Date(workout.startTime).toDateString();
    if (today === workoutDate) return "Today's Workout Done!";

    return null;
  }

  /**
   * Get motivational message
   */
  private getMotivationalMessage(workout: PublishableWorkout): string {
    const messages = {
      running: [
        'Every step forward is a step toward achieving something bigger and better than your current situation.',
        "The miracle isn't that I finished. The miracle is that I had the courage to start.",
        "Your body can stand almost anything. It's your mind you have to convince.",
      ],
      cycling: [
        'Life is like riding a bicycle. To keep your balance, you must keep moving.',
        'It never gets easier; you just go faster.',
        'The bicycle is a curious vehicle. Its passenger is its engine.',
      ],
      meditation: [
        'Peace comes from within. Do not seek it without.',
        'The mind is everything. What you think you become.',
        'In the midst of movement and chaos, keep stillness inside of you.',
        'Meditation is not about stopping thoughts, but recognizing that we are more than our thoughts.',
      ],
      yoga: [
        'Yoga is the journey of the self, through the self, to the self.',
        'The body benefits from movement, and the mind benefits from stillness.',
        'Inhale the future, exhale the past.',
      ],
      gym: [
        "The only bad workout is the one that didn't happen.",
        "Your body can stand almost anything. It's your mind you have to convince.",
        "Strength doesn't come from what you can do. It comes from overcoming the things you thought you couldn't.",
      ],
    };

    const typeMessages =
      messages[workout.type as keyof typeof messages] || messages.gym;
    return typeMessages[Math.floor(Math.random() * typeMessages.length)];
  }

  /**
   * Format duration in human-readable format
   */
  private formatDuration(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);

    if (h > 0) {
      return `${h}h ${m}m`;
    }
    return `${m}m`;
  }

  /**
   * Format duration with seconds (MM:SS or H:MM:SS)
   * Used for elegant cards where precision matters
   */
  private formatDurationDetailed(seconds: number): string {
    const h = Math.floor(seconds / 3600);
    const m = Math.floor((seconds % 3600) / 60);
    const s = Math.floor(seconds % 60);

    if (h > 0) {
      return `${h}:${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`;
    }
    return `${m}:${s.toString().padStart(2, '0')}`;
  }

  /**
   * Sanitize text for hashtag use
   */
  private sanitizeHashtag(text: string): string {
    return text.replace(/_/g, '').replace(/\s+/g, '').toLowerCase();
  }

  /**
   * Adjust color brightness
   */
  private adjustBrightness(hex: string, percent: number): string {
    const num = parseInt(hex.replace('#', ''), 16);
    const amt = Math.round(2.55 * percent);
    const R = (num >> 16) + amt;
    const G = ((num >> 8) & 0x00ff) + amt;
    const B = (num & 0x0000ff) + amt;

    return (
      '#' +
      (
        0x1000000 +
        (R < 255 ? (R < 1 ? 0 : R) : 255) * 0x10000 +
        (G < 255 ? (G < 1 ? 0 : G) : 255) * 0x100 +
        (B < 255 ? (B < 1 ? 0 : B) : 255)
      )
        .toString(16)
        .slice(1)
    );
  }

  /**
   * Generate batch cards for multiple workouts
   */
  async generateBatchCards(
    workouts: PublishableWorkout[],
    options: WorkoutCardOptions = {},
    onProgress?: (completed: number, total: number) => void
  ): Promise<WorkoutCardData[]> {
    const results: WorkoutCardData[] = [];

    for (let i = 0; i < workouts.length; i++) {
      try {
        const card = await this.generateWorkoutCard(workouts[i], options);
        results.push(card);
        onProgress?.(i + 1, workouts.length);
      } catch (error) {
        console.error(
          `Failed to generate card for workout ${workouts[i].id}:`,
          error
        );
        // Continue with other workouts
      }
    }

    return results;
  }

  /**
   * Get available templates (simplified to 3 core options)
   */
  getAvailableTemplates(): Array<{
    id: keyof typeof CARD_TEMPLATES;
    name: string;
    description: string;
  }> {
    return [
      {
        id: 'elegant',
        name: 'Elegant',
        description: 'Quotestr-inspired split design with serif typography',
      },
      {
        id: 'minimal',
        name: 'RUNSTR Theme',
        description: 'RUNSTR-branded card with ostrich logo',
      },
      {
        id: 'achievement',
        name: 'Text-based',
        description: 'Full stats with motivational messages',
      },
    ];
  }
}

export default WorkoutCardGenerator.getInstance();
