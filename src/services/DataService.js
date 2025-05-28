/**
 * DataService
 * Handles data aggregation and formatting for AI service integration
 */

const { AppError } = require('../middleware/errorHandler');

class DataService {
  constructor(playerRepository, lineupRepository, teamStackRepository) {
    this.playerRepository = playerRepository;
    this.lineupRepository = lineupRepository;
    this.teamStackRepository = teamStackRepository;
  }

  /**
   * Get player data formatted for AI service
   */
  async getPlayersForAI() {
    try {
      const players = await this.playerRepository.findAll();
      const lineups = await this.lineupRepository.findAll();
      
      // Calculate exposures for each player
      const playerExposures = this.calculatePlayerExposures(players, lineups);
      
      // Format data for AI service
      const formattedPlayers = players.map(player => ({
        id: player.id,
        name: player.name,
        team: player.team,
        position: player.position,
        salary: player.salary,
        projectedPoints: player.projectedPoints,
        ownership: player.ownership || 0,
        exposure: playerExposures[player.id] || 0,
        pointsPerDollar: player.salary > 0 ? player.projectedPoints / (player.salary / 1000) : 0,
        tier: this.calculatePlayerTier(player),
        riskLevel: this.calculateRiskLevel(player),
        recent_performance: player.recentPerformance || [],
        metadata: {
          gamesPlayed: player.gamesPlayed || 0,
          averageScore: player.averageScore || 0,
          consistency: player.consistency || 0,
          ceiling: player.ceiling || player.projectedPoints * 1.5,
          floor: player.floor || player.projectedPoints * 0.5
        }
      }));

      return {
        players: formattedPlayers,
        summary: {
          totalPlayers: formattedPlayers.length,
          averageSalary: this.calculateAverage(formattedPlayers, 'salary'),
          averageProjection: this.calculateAverage(formattedPlayers, 'projectedPoints'),
          positionBreakdown: this.getPositionBreakdown(formattedPlayers),
          teamBreakdown: this.getTeamBreakdown(formattedPlayers)
        }
      };
    } catch (error) {
      throw new AppError(`Failed to get player data for AI: ${error.message}`, 500);
    }
  }

  /**
   * Get lineup data formatted for AI service
   */
  async getLineupsForAI() {
    try {
      const lineups = await this.lineupRepository.findAll();
      const players = await this.playerRepository.findAll();
      
      // Create player lookup for quick access
      const playerLookup = players.reduce((acc, player) => {
        acc[player.id] = player;
        return acc;
      }, {});

      // Format lineups for AI service
      const formattedLineups = lineups.map(lineup => ({
        id: lineup.id,
        projectedScore: lineup.projectedScore,
        totalSalary: lineup.totalSalary,
        algorithm: lineup.algorithm || 'unknown',
        generatedAt: lineup.generatedAt,
        players: lineup.players?.map(playerId => {
          const player = playerLookup[playerId] || playerLookup[playerId.toString()];
          return player ? {
            id: player.id,
            name: player.name,
            team: player.team,
            position: player.position,
            salary: player.salary,
            projectedPoints: player.projectedPoints
          } : null;
        }).filter(Boolean) || [],
        teamStacks: this.identifyTeamStacks(lineup, playerLookup),
        diversification: this.calculateDiversification(lineup, playerLookup),
        riskScore: this.calculateLineupRisk(lineup, playerLookup),
        metadata: {
          salaryRemaining: 50000 - (lineup.totalSalary || 0),
          stackCount: this.countStacks(lineup, playerLookup),
          uniqueTeams: this.countUniqueTeams(lineup, playerLookup),
          averageOwnership: this.calculateAverageOwnership(lineup, playerLookup)
        }
      }));

      return {
        lineups: formattedLineups,
        summary: {
          totalLineups: formattedLineups.length,
          averageScore: this.calculateAverage(formattedLineups, 'projectedScore'),
          averageSalary: this.calculateAverage(formattedLineups, 'totalSalary'),
          algorithmBreakdown: this.getAlgorithmBreakdown(formattedLineups),
          riskDistribution: this.getRiskDistribution(formattedLineups)
        }
      };
    } catch (error) {
      throw new AppError(`Failed to get lineup data for AI: ${error.message}`, 500);
    }
  }

  /**
   * Get aggregated exposure data
   */
  async getExposureData() {
    try {
      const players = await this.playerRepository.findAll();
      const lineups = await this.lineupRepository.findAll();
      
      const exposures = this.calculatePlayerExposures(players, lineups);
      const teamExposures = this.calculateTeamExposures(players, lineups);
      
      return {
        playerExposures: Object.entries(exposures).map(([playerId, exposure]) => {
          const player = players.find(p => p.id.toString() === playerId);
          return {
            playerId,
            playerName: player?.name || 'Unknown',
            team: player?.team || 'Unknown',
            position: player?.position || 'Unknown',
            exposure: Math.round(exposure * 100) / 100,
            projectedPoints: player?.projectedPoints || 0,
            salary: player?.salary || 0
          };
        }).sort((a, b) => b.exposure - a.exposure),
        
        teamExposures: Object.entries(teamExposures).map(([team, exposure]) => ({
          team,
          exposure: Math.round(exposure * 100) / 100,
          playerCount: players.filter(p => p.team === team).length
        })).sort((a, b) => b.exposure - a.exposure),
        
        summary: {
          totalPlayers: players.length,
          totalLineups: lineups.length,
          averagePlayerExposure: Object.values(exposures).reduce((a, b) => a + b, 0) / Object.keys(exposures).length || 0,
          maxPlayerExposure: Math.max(...Object.values(exposures), 0),
          minPlayerExposure: Math.min(...Object.values(exposures), 0)
        }
      };
    } catch (error) {
      throw new AppError(`Failed to get exposure data: ${error.message}`, 500);
    }
  }

  /**
   * Get contest metadata and team stacks
   */
  async getContestData() {
    try {
      const teamStacks = await this.teamStackRepository.findAll();
      const players = await this.playerRepository.findAll();
      
      // Get contest metadata (this would typically come from DraftKings import)
      const contestMetadata = this.getStoredContestMetadata();
      
      return {
        contest: contestMetadata || {
          name: 'Default Contest',
          entryFee: 5,
          fieldSize: 1176,
          totalPrizePool: 5880,
          payoutStructure: this.getDefaultPayoutStructure()
        },
        teamStacks: teamStacks.map(stack => ({
          ...stack,
          playerCount: players.filter(p => stack.players?.includes(p.id)).length,
          averageSalary: this.calculateStackAverageSalary(stack, players),
          projectedPoints: this.calculateStackProjectedPoints(stack, players)
        })),
        teams: this.getTeamAnalysis(players),
        metadata: {
          totalStacks: teamStacks.length,
          averageStackSize: teamStacks.reduce((sum, stack) => sum + (stack.players?.length || 0), 0) / teamStacks.length || 0,
          uniqueTeams: [...new Set(players.map(p => p.team))].length
        }
      };
    } catch (error) {
      throw new AppError(`Failed to get contest data: ${error.message}`, 500);
    }
  }

  /**
   * Validate data integrity
   */
  async validateData() {
    try {
      const players = await this.playerRepository.findAll();
      const lineups = await this.lineupRepository.findAll();
      const teamStacks = await this.teamStackRepository.findAll();
      
      const validation = {
        isValid: true,
        errors: [],
        warnings: [],
        playerValidation: this.validatePlayers(players),
        lineupValidation: this.validateLineups(lineups, players),
        stackValidation: this.validateStacks(teamStacks, players)
      };

      validation.isValid = validation.playerValidation.isValid && 
                          validation.lineupValidation.isValid && 
                          validation.stackValidation.isValid;

      return validation;
    } catch (error) {
      throw new AppError(`Data validation failed: ${error.message}`, 500);
    }
  }

  // Helper methods

  calculatePlayerExposures(players, lineups) {
    const exposures = {};
    const totalLineups = lineups.length;
    
    if (totalLineups === 0) return exposures;

    players.forEach(player => {
      const appearances = lineups.filter(lineup => 
        lineup.players?.includes(player.id) || 
        lineup.players?.includes(player.id.toString())
      ).length;
      
      exposures[player.id] = (appearances / totalLineups) * 100;
    });

    return exposures;
  }

  calculateTeamExposures(players, lineups) {
    const teamExposures = {};
    const totalLineups = lineups.length;
    
    if (totalLineups === 0) return teamExposures;

    const teams = [...new Set(players.map(p => p.team))];
    
    teams.forEach(team => {
      const teamPlayers = players.filter(p => p.team === team);
      let totalAppearances = 0;
      
      lineups.forEach(lineup => {
        const teamPlayersInLineup = teamPlayers.filter(player =>
          lineup.players?.includes(player.id) || 
          lineup.players?.includes(player.id.toString())
        ).length;
        
        if (teamPlayersInLineup > 0) {
          totalAppearances += teamPlayersInLineup;
        }
      });
      
      teamExposures[team] = (totalAppearances / (totalLineups * teamPlayers.length)) * 100;
    });

    return teamExposures;
  }

  calculatePlayerTier(player) {
    const ppd = player.salary > 0 ? player.projectedPoints / (player.salary / 1000) : 0;
    
    if (ppd >= 3.0) return 'S';
    if (ppd >= 2.5) return 'A';
    if (ppd >= 2.0) return 'B';
    if (ppd >= 1.5) return 'C';
    return 'D';
  }

  calculateRiskLevel(player) {
    const consistency = player.consistency || 0;
    
    if (consistency >= 0.8) return 'Low';
    if (consistency >= 0.6) return 'Medium';
    return 'High';
  }

  calculateAverage(items, field) {
    if (items.length === 0) return 0;
    return items.reduce((sum, item) => sum + (item[field] || 0), 0) / items.length;
  }

  getPositionBreakdown(players) {
    return players.reduce((acc, player) => {
      acc[player.position] = (acc[player.position] || 0) + 1;
      return acc;
    }, {});
  }

  getTeamBreakdown(players) {
    return players.reduce((acc, player) => {
      acc[player.team] = (acc[player.team] || 0) + 1;
      return acc;
    }, {});
  }

  // Additional helper methods would go here...
  identifyTeamStacks(lineup, playerLookup) {
    // Implementation for identifying team stacks in a lineup
    return [];
  }

  calculateDiversification(lineup, playerLookup) {
    // Implementation for calculating lineup diversification
    return 0;
  }

  calculateLineupRisk(lineup, playerLookup) {
    // Implementation for calculating lineup risk score
    return 0;
  }

  getStoredContestMetadata() {
    // This would retrieve stored contest metadata
    return null;
  }

  getDefaultPayoutStructure() {
    return [5880, 1470, 735]; // Example payout structure
  }

  validatePlayers(players) {
    return { isValid: true, errors: [], warnings: [] };
  }

  validateLineups(lineups, players) {
    return { isValid: true, errors: [], warnings: [] };
  }

  validateStacks(stacks, players) {
    return { isValid: true, errors: [], warnings: [] };
  }
}

module.exports = DataService;