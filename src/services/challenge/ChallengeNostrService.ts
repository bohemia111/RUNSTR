/**
 * ChallengeNostrService - Post Challenge QR Codes to Nostr
 * Creates kind 1 social posts with challenge QR codes and deep links
 * Integrates with ImageUploadService and GlobalNDKService
 */

import { GlobalNDKService } from '../nostr/GlobalNDKService';
import { NDKEvent, NDKPrivateKeySigner } from '@nostr-dev-kit/ndk';
import type { NDKSigner } from '@nostr-dev-kit/ndk';
import { ImageUploadService } from '../media/ImageUploadService';
import type { SimpleChallengeType } from '../../constants/simpleChallengePresets';
import { getChallengeName } from '../../constants/simpleChallengePresets';
import { getChallengeDescription } from '../../utils/challengeDeepLink';

export interface ChallengePostOptions {
  qrImageUri?: string; // Pre-rendered QR code image URI (optional)
}

export interface ChallengePostResult {
  success: boolean;
  eventId?: string;
  error?: string;
}

export class ChallengeNostrService {
  private static instance: ChallengeNostrService;
  private imageUploadService: ImageUploadService;

  private constructor() {
    this.imageUploadService = ImageUploadService.getInstance();
  }

  static getInstance(): ChallengeNostrService {
    if (!ChallengeNostrService.instance) {
      ChallengeNostrService.instance = new ChallengeNostrService();
    }
    return ChallengeNostrService.instance;
  }

  /**
   * Post challenge to Nostr as kind 1 event with QR code image
   * Supports both direct privateKeyHex (nsec users) and NDKSigner (Amber users)
   */
  async postChallenge(
    challengeData: {
      type: SimpleChallengeType;
      duration: 1 | 7 | 30;
      wager: number;
      creatorName: string;
      deepLink: string;
    },
    privateKeyHexOrSigner: string | NDKSigner,
    options: ChallengePostOptions = {}
  ): Promise<ChallengePostResult> {
    try {
      console.log(`🔄 Posting challenge to Nostr...`);

      const ndk = await GlobalNDKService.getInstance();
      const isSigner = typeof privateKeyHexOrSigner !== 'string';

      // Get signer
      let signer: NDKSigner;
      if (isSigner) {
        signer = privateKeyHexOrSigner;
      } else {
        signer = new NDKPrivateKeySigner(privateKeyHexOrSigner);
      }

      // Upload QR code image if provided
      let imageUrl: string | undefined;
      let imageDimensions: { width: number; height: number } | undefined;

      if (options.qrImageUri) {
        console.log(
          '📤 Uploading QR code image to nostr.build with NIP-98 auth...'
        );
        const uploadResult = await this.imageUploadService.uploadImage(
          options.qrImageUri,
          `runstr-challenge-qr-${Date.now()}.png`,
          signer
        );

        if (uploadResult.success && uploadResult.url) {
          imageUrl = uploadResult.url;
          imageDimensions = uploadResult.dimensions || {
            width: 200,
            height: 200,
          };
          console.log(`✅ QR image uploaded successfully to: ${imageUrl}`);
        } else {
          console.warn('⚠️ QR image upload failed:', uploadResult.error);
          // Continue without image - post will still have text content
        }
      }

      // Create unsigned NDKEvent
      const ndkEvent = new NDKEvent(ndk);
      ndkEvent.kind = 1;
      ndkEvent.content = this.generateChallengePostContent(
        challengeData,
        imageUrl
      );
      ndkEvent.tags = this.createChallengePostTags(
        challengeData,
        imageUrl,
        imageDimensions
      );
      ndkEvent.created_at = Math.floor(Date.now() / 1000);

      // Sign and publish
      await ndkEvent.sign(signer);
      await ndkEvent.publish();

      console.log(`✅ Challenge posted to Nostr: ${ndkEvent.id}`);

      return {
        success: true,
        eventId: ndkEvent.id,
      };
    } catch (error) {
      console.error('❌ Error posting challenge to Nostr:', error);
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
      };
    }
  }

  /**
   * Generate social post content for challenge
   * If imageUrl is provided, content is minimal (image + hashtags only)
   * Otherwise, full text with deep link is included
   */
  private generateChallengePostContent(
    challengeData: {
      type: SimpleChallengeType;
      duration: 1 | 7 | 30;
      wager: number;
      creatorName: string;
      deepLink: string;
    },
    imageUrl?: string
  ): string {
    const challengeName = getChallengeName(challengeData.type);
    const durationText =
      challengeData.duration === 1 ? '1 Day' : `${challengeData.duration} Days`;
    const wagerText =
      challengeData.wager > 0
        ? `${challengeData.wager.toLocaleString()} sats`
        : 'No wager';

    // If we have an image, keep it minimal
    if (imageUrl) {
      return `${imageUrl}\n\nChallenge me: ${challengeName} | ${durationText} | ${wagerText}\n\nScan the QR code or click: ${challengeData.deepLink}\n\n#RUNSTR #FitnessChallenge #Bitcoin`;
    }

    // Full text content when no image
    let content = `🏆 Challenge Accepted!\n\n`;
    content += `I'm challenging anyone to: ${challengeName}\n`;
    content += `Duration: ${durationText}\n`;
    if (challengeData.wager > 0) {
      content += `Wager: ${wagerText}\n`;
    }
    content += `\nScan QR or click to accept: ${challengeData.deepLink}\n\n`;
    content += `#RUNSTR #FitnessChallenge #Bitcoin`;

    return content;
  }

  /**
   * Create tags for kind 1 challenge posts with NIP-94 image metadata
   */
  private createChallengePostTags(
    challengeData: {
      type: SimpleChallengeType;
      duration: 1 | 7 | 30;
      wager: number;
      creatorName: string;
      deepLink: string;
    },
    imageUrl?: string,
    imageDimensions?: { width: number; height: number }
  ): string[][] {
    const tags: string[][] = [
      ['t', 'RUNSTR'],
      ['t', 'FitnessChallenge'],
      ['t', 'challenge'],
      ['t', challengeData.type],
    ];

    // Add Bitcoin tag if there's a wager
    if (challengeData.wager > 0) {
      tags.push(['t', 'Bitcoin']);
      tags.push(['t', 'Lightning']);
    }

    // Add NIP-94 image metadata tag (imeta) if image was uploaded
    if (imageUrl) {
      const imetaTag = ['imeta', `url ${imageUrl}`];
      if (imageDimensions) {
        imetaTag.push(`dim ${imageDimensions.width}x${imageDimensions.height}`);
      }
      imetaTag.push('m image/png');
      tags.push(imetaTag);
    }

    // Add deep link as a reference tag
    tags.push(['r', challengeData.deepLink]);

    return tags;
  }
}

export default ChallengeNostrService.getInstance();
