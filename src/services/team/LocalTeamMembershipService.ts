import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Local Team Membership Service
 *
 * Manages team membership locally without Nostr lists.
 * - Users can follow multiple teams (social browsing)
 * - Users can compete on ONE team at a time (leaderboards)
 * - Competition team determines which team tag gets added to kind 1301 workouts
 */

interface UserTeamMembership {
  competitionTeam: string | null; // Single team for leaderboard participation
  followedTeams: string[]; // Multiple teams for browsing
  joinDates: Record<string, number>; // teamId -> timestamp
}

export class LocalTeamMembershipService {
  private static COMPETITION_TEAM_KEY = '@runstr:competition_team';
  private static FOLLOWED_TEAMS_KEY = '@runstr:followed_teams';
  private static JOIN_DATES_KEY = '@runstr:team_join_dates';

  /**
   * Set competition team (appears on leaderboards)
   * User workouts will be tagged with this team
   */
  static async setCompetitionTeam(teamId: string): Promise<void> {
    try {
      await AsyncStorage.setItem(this.COMPETITION_TEAM_KEY, teamId);

      // Auto-follow team if not already followed
      const followed = await this.getFollowedTeams();
      if (!followed.includes(teamId)) {
        await this.followTeam(teamId);
      }

      console.log(`✅ Competition team set: ${teamId}`);
    } catch (error) {
      console.error('Error setting competition team:', error);
      throw error;
    }
  }

  /**
   * Get current competition team
   */
  static async getCompetitionTeam(): Promise<string | null> {
    try {
      const teamId = await AsyncStorage.getItem(this.COMPETITION_TEAM_KEY);
      return teamId;
    } catch (error) {
      console.error('Error getting competition team:', error);
      return null;
    }
  }

  /**
   * Clear competition team (stop competing)
   */
  static async clearCompetitionTeam(): Promise<void> {
    try {
      await AsyncStorage.removeItem(this.COMPETITION_TEAM_KEY);
      console.log('✅ Competition team cleared');
    } catch (error) {
      console.error('Error clearing competition team:', error);
      throw error;
    }
  }

  /**
   * Follow a team (social browsing only)
   */
  static async followTeam(teamId: string): Promise<void> {
    try {
      const followed = await this.getFollowedTeams();

      if (followed.includes(teamId)) {
        console.log(`Already following team: ${teamId}`);
        return;
      }

      const updated = [...followed, teamId];
      await AsyncStorage.setItem(
        this.FOLLOWED_TEAMS_KEY,
        JSON.stringify(updated)
      );

      // Record join date
      const joinDates = await this.getJoinDates();
      joinDates[teamId] = Date.now();
      await AsyncStorage.setItem(
        this.JOIN_DATES_KEY,
        JSON.stringify(joinDates)
      );

      console.log(`✅ Following team: ${teamId}`);
    } catch (error) {
      console.error('Error following team:', error);
      throw error;
    }
  }

  /**
   * Unfollow a team
   */
  static async unfollowTeam(teamId: string): Promise<void> {
    try {
      const followed = await this.getFollowedTeams();
      const updated = followed.filter((id) => id !== teamId);
      await AsyncStorage.setItem(
        this.FOLLOWED_TEAMS_KEY,
        JSON.stringify(updated)
      );

      // Clear competition team if unfollowing current competition team
      const competitionTeam = await this.getCompetitionTeam();
      if (competitionTeam === teamId) {
        await this.clearCompetitionTeam();
      }

      // Remove join date
      const joinDates = await this.getJoinDates();
      delete joinDates[teamId];
      await AsyncStorage.setItem(
        this.JOIN_DATES_KEY,
        JSON.stringify(joinDates)
      );

      console.log(`✅ Unfollowed team: ${teamId}`);
    } catch (error) {
      console.error('Error unfollowing team:', error);
      throw error;
    }
  }

  /**
   * Get all followed teams
   */
  static async getFollowedTeams(): Promise<string[]> {
    try {
      const data = await AsyncStorage.getItem(this.FOLLOWED_TEAMS_KEY);
      return data ? JSON.parse(data) : [];
    } catch (error) {
      console.error('Error getting followed teams:', error);
      return [];
    }
  }

  /**
   * Check if user is following a team
   */
  static async isFollowing(teamId: string): Promise<boolean> {
    const followed = await this.getFollowedTeams();
    return followed.includes(teamId);
  }

  /**
   * Check if team is user's competition team
   */
  static async isCompetitionTeam(teamId: string): Promise<boolean> {
    const competitionTeam = await this.getCompetitionTeam();
    return competitionTeam === teamId;
  }

  /**
   * Get join dates for all teams
   */
  static async getJoinDates(): Promise<Record<string, number>> {
    try {
      const data = await AsyncStorage.getItem(this.JOIN_DATES_KEY);
      return data ? JSON.parse(data) : {};
    } catch (error) {
      console.error('Error getting join dates:', error);
      return {};
    }
  }

  /**
   * Get join date for specific team
   */
  static async getJoinDate(teamId: string): Promise<number | null> {
    const joinDates = await this.getJoinDates();
    return joinDates[teamId] || null;
  }

  /**
   * Get full membership data
   */
  static async getMembershipData(): Promise<UserTeamMembership> {
    const competitionTeam = await this.getCompetitionTeam();
    const followedTeams = await this.getFollowedTeams();
    const joinDates = await this.getJoinDates();

    return {
      competitionTeam,
      followedTeams,
      joinDates,
    };
  }

  /**
   * Clear all team membership data (for logout/reset)
   */
  static async clearAll(): Promise<void> {
    try {
      await AsyncStorage.multiRemove([
        this.COMPETITION_TEAM_KEY,
        this.FOLLOWED_TEAMS_KEY,
        this.JOIN_DATES_KEY,
      ]);
      console.log('✅ Cleared all team membership data');
    } catch (error) {
      console.error('Error clearing team membership data:', error);
      throw error;
    }
  }
}
