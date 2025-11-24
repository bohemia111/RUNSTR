/**
 * LocalTeamStorageService
 * Manages locally-created teams in AsyncStorage
 *
 * Teams created by captains are stored locally and visible only to them
 * until approved and hardcoded in next app release
 */

import AsyncStorage from '@react-native-async-storage/async-storage';
import { Team } from '../../types/team';

export interface LocalTeam extends Team {
  publishedToNostr: boolean; // Whether kind 33404 event was published
  localOnly: boolean; // True = not hardcoded yet, false = hardcoded team
}

export class LocalTeamStorageService {
  private static readonly STORAGE_KEY = '@runstr:created_teams';

  /**
   * Save a newly-created team to AsyncStorage
   * @param team Team data to save
   */
  static async saveCreatedTeam(
    team: Omit<LocalTeam, 'localOnly'>
  ): Promise<void> {
    try {
      const existingTeams = await this.getCreatedTeams();

      // Add localOnly flag
      const localTeam: LocalTeam = {
        ...team,
        localOnly: true,
      };

      // Check for duplicates
      const isDuplicate = existingTeams.some((t) => t.id === team.id);
      if (isDuplicate) {
        console.log(
          '[LocalTeamStorage] Team already exists, updating:',
          team.id
        );
        await this.updateCreatedTeam(team.id, localTeam);
        return;
      }

      // Add to existing teams
      const updatedTeams = [...existingTeams, localTeam];
      await AsyncStorage.setItem(
        this.STORAGE_KEY,
        JSON.stringify(updatedTeams)
      );

      console.log('[LocalTeamStorage] Team saved successfully:', {
        teamId: team.id,
        teamName: team.name,
        totalTeams: updatedTeams.length,
      });
    } catch (error) {
      console.error('[LocalTeamStorage] Error saving team:', error);
      throw new Error('Failed to save team to local storage');
    }
  }

  /**
   * Get all locally-created teams from AsyncStorage
   * @returns Array of locally-created teams
   */
  static async getCreatedTeams(): Promise<LocalTeam[]> {
    try {
      const data = await AsyncStorage.getItem(this.STORAGE_KEY);

      if (!data) {
        return [];
      }

      const teams: LocalTeam[] = JSON.parse(data);
      console.log('[LocalTeamStorage] Loaded teams:', teams.length);
      return teams;
    } catch (error) {
      console.error('[LocalTeamStorage] Error loading teams:', error);
      return [];
    }
  }

  /**
   * Get locally-created teams for a specific captain
   * @param captainNpub Captain's npub to filter by
   * @returns Array of teams created by this captain
   */
  static async getTeamsByCaptain(captainNpub: string): Promise<LocalTeam[]> {
    try {
      const allTeams = await this.getCreatedTeams();

      // Normalize captain identifier (lowercase, trim whitespace)
      const normalizedCaptainId = captainNpub?.toLowerCase().trim();

      console.log('[LocalTeamStorage] 🔍 Searching for captain teams:', {
        inputNpub: captainNpub?.slice(0, 20) + '...',
        normalizedNpub: normalizedCaptainId?.slice(0, 20) + '...',
        totalTeams: allTeams.length,
      });

      // Debug: Log all team captainIds for comparison
      if (allTeams.length > 0) {
        console.log('[LocalTeamStorage] 📋 All stored teams:');
        allTeams.forEach((team, index) => {
          console.log(`  [${index}] ${team.name}:`);
          console.log(`      captainId: ${team.captainId?.slice(0, 20)}...`);
          console.log(
            `      normalized: ${team.captainId
              ?.toLowerCase()
              .trim()
              .slice(0, 20)}...`
          );
        });
      }

      // Filter teams with normalized comparison
      const captainTeams = allTeams.filter((team) => {
        const normalizedTeamCaptainId = team.captainId?.toLowerCase().trim();
        const matches = normalizedTeamCaptainId === normalizedCaptainId;

        if (matches) {
          console.log('[LocalTeamStorage] ✅ Found match:', {
            teamName: team.name,
            teamCaptainId: team.captainId?.slice(0, 20) + '...',
          });
        }

        return matches;
      });

      console.log('[LocalTeamStorage] 📊 Captain teams result:', {
        captainNpub: captainNpub?.slice(0, 20) + '...',
        teamCount: captainTeams.length,
        teamNames: captainTeams.map((t) => t.name),
      });

      return captainTeams;
    } catch (error) {
      console.error(
        '[LocalTeamStorage] ❌ Error getting captain teams:',
        error
      );
      return [];
    }
  }

  /**
   * Update an existing locally-created team
   * @param teamId ID of team to update
   * @param updates Partial team data to update
   */
  static async updateCreatedTeam(
    teamId: string,
    updates: Partial<LocalTeam>
  ): Promise<void> {
    try {
      const teams = await this.getCreatedTeams();
      const teamIndex = teams.findIndex((t) => t.id === teamId);

      if (teamIndex === -1) {
        throw new Error(`Team not found: ${teamId}`);
      }

      // Merge updates
      teams[teamIndex] = {
        ...teams[teamIndex],
        ...updates,
      };

      await AsyncStorage.setItem(this.STORAGE_KEY, JSON.stringify(teams));

      console.log('[LocalTeamStorage] Team updated successfully:', {
        teamId,
        updatedFields: Object.keys(updates),
      });
    } catch (error) {
      console.error('[LocalTeamStorage] Error updating team:', error);
      throw new Error('Failed to update team in local storage');
    }
  }

  /**
   * Delete a locally-created team
   * @param teamId ID of team to delete
   */
  static async deleteCreatedTeam(teamId: string): Promise<void> {
    try {
      const teams = await this.getCreatedTeams();
      const filteredTeams = teams.filter((t) => t.id !== teamId);

      await AsyncStorage.setItem(
        this.STORAGE_KEY,
        JSON.stringify(filteredTeams)
      );

      console.log('[LocalTeamStorage] Team deleted successfully:', teamId);
    } catch (error) {
      console.error('[LocalTeamStorage] Error deleting team:', error);
      throw new Error('Failed to delete team from local storage');
    }
  }

  /**
   * Get a single team by ID
   * @param teamId ID of team to retrieve
   * @returns Team if found, null otherwise
   */
  static async getTeamById(teamId: string): Promise<LocalTeam | null> {
    try {
      const teams = await this.getCreatedTeams();
      const team = teams.find((t) => t.id === teamId);
      return team || null;
    } catch (error) {
      console.error('[LocalTeamStorage] Error getting team by ID:', error);
      return null;
    }
  }

  /**
   * Check if a team is stored locally
   * @param teamId ID of team to check
   * @returns True if team exists in local storage
   */
  static async isLocalTeam(teamId: string): Promise<boolean> {
    try {
      const team = await this.getTeamById(teamId);
      return team !== null;
    } catch (error) {
      console.error(
        '[LocalTeamStorage] Error checking if team is local:',
        error
      );
      return false;
    }
  }

  /**
   * Clear all locally-created teams (for testing/debugging)
   */
  static async clearAllTeams(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.STORAGE_KEY);
      console.log('[LocalTeamStorage] All teams cleared');
    } catch (error) {
      console.error('[LocalTeamStorage] Error clearing teams:', error);
      throw new Error('Failed to clear teams from local storage');
    }
  }
}
