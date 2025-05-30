import { useMemo } from "react";

/**
 * Custom hook for processing stack exposure data from lineups and player data
 */
export const useStackExposureData = (lineups = [], playerData = []) => {
  const stackExposures = useMemo(() => {
    // Only show teams if we have player data uploaded
    if (!playerData || playerData.length === 0) {
      return [];
    }

    // Get unique teams from player data
    let teams = [...new Set(playerData.map((p) => p.team))].filter(Boolean);

    // If no teams from player data, try to get from lineups as fallback
    if (teams.length === 0 && lineups.length > 0) {
      const lineupTeams = new Set();
      lineups.forEach((lineup) => {
        if (lineup.cpt?.team) lineupTeams.add(lineup.cpt.team);
        if (lineup.players) {
          lineup.players.forEach((player) => {
            if (player?.team) lineupTeams.add(player.team);
          });
        }
      });
      teams = [...lineupTeams];
    }

    // If still no teams, return empty (don't show default teams without data)
    if (teams.length === 0) {
      return [];
    }

    // Initialize team stack data
    const teamStackData = teams.map((team) => ({
      team,
      projPoints: playerData
        .filter((p) => p.team === team)
        .reduce((sum, p) => sum + (p.projectedPoints || 0), 0)
        .toFixed(1),
      twoManStacks: 0,
      threeManStacks: 0,
      fourManStacks: 0,
      twoManExp: 0,
      threeManExp: 0,
      fourManExp: 0,
      minExp: 0,
      maxExp: 0,
    }));

    // Count stacks in each lineup
    lineups.forEach((lineup) => {
      // Get all players in the lineup (captain + regular players)
      const allPlayers = [];
      if (lineup.cpt) allPlayers.push(lineup.cpt);
      if (lineup.players) allPlayers.push(...lineup.players);

      // Count players by team
      const teamCounts = {};
      allPlayers.forEach((player) => {
        if (player?.team) {
          teamCounts[player.team] = (teamCounts[player.team] || 0) + 1;
        }
      });

      // Update stack counts for each team
      Object.entries(teamCounts).forEach(([team, count]) => {
        const teamData = teamStackData.find((t) => t.team === team);
        if (teamData) {
          // Count different stack sizes
          if (count >= 2) {
            teamData.twoManStacks++;
          }
          if (count >= 3) {
            teamData.threeManStacks++;
          }
          if (count >= 4) {
            teamData.fourManStacks++;
          }
        }
      });
    });

    // Calculate exposure percentages
    teamStackData.forEach((team) => {
      team.twoManExp =
        lineups.length > 0
          ? Math.round((team.twoManStacks / lineups.length) * 100)
          : 0;
      team.threeManExp =
        lineups.length > 0
          ? Math.round((team.threeManStacks / lineups.length) * 100)
          : 0;
      team.fourManExp =
        lineups.length > 0
          ? Math.round((team.fourManStacks / lineups.length) * 100)
          : 0;

      // Set default min/max values to 0
      team.minExp = 0;
      team.maxExp = 0;
    });

    return teamStackData;
  }, [lineups, playerData]);

  return stackExposures;
};
