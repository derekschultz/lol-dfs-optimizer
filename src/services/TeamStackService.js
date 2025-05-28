/**
 * TeamStackService
 * Handles all team stack related business logic
 */

const { generateRandomId } = require('../utils/generators');
const { AppError } = require('../middleware/errorHandler');

class TeamStackService {
  constructor(teamStackRepository, playerRepository) {
    this.teamStackRepository = teamStackRepository;
    this.playerRepository = playerRepository;
  }

  async getAllStacks() {
    try {
      const stacks = await this.teamStackRepository.findAll();
      return stacks;
    } catch (error) {
      throw new AppError('Failed to fetch team stacks', 500);
    }
  }

  async getEnhancedStacks() {
    try {
      const stacks = await this.teamStackRepository.findAll();
      const players = await this.playerRepository.findAll();

      if (players.length === 0) {
        return stacks; // Return raw stacks if no player data
      }

      const enhancedStacks = await this.enhanceStacksWithPlayerData(stacks, players);
      
      // Sort by total projection (descending)
      enhancedStacks.sort((a, b) => (b.totalProjection || 0) - (a.totalProjection || 0));
      
      return enhancedStacks;
    } catch (error) {
      throw new AppError('Failed to fetch enhanced team stacks', 500);
    }
  }

  async getStackById(id) {
    try {
      const stack = await this.teamStackRepository.findById(id);
      if (!stack) {
        throw new AppError('Team stack not found', 404);
      }
      return stack;
    } catch (error) {
      if (error.statusCode) throw error;
      throw new AppError('Failed to fetch team stack', 500);
    }
  }

  async getStacksByTeam(team) {
    try {
      const stacks = await this.teamStackRepository.findByTeam(team);
      return stacks;
    } catch (error) {
      throw new AppError(`Failed to fetch stacks for team ${team}`, 500);
    }
  }

  async createStack(stackData) {
    try {
      // Validate stack structure
      this.validateStackData(stackData);
      
      const newStack = await this.teamStackRepository.create(stackData);
      return newStack;
    } catch (error) {
      if (error.statusCode) throw error;
      throw new AppError('Failed to create team stack', 500);
    }
  }

  async updateStack(id, updateData) {
    try {
      const existingStack = await this.teamStackRepository.findById(id);
      if (!existingStack) {
        throw new AppError('Team stack not found', 404);
      }

      // Validate update data if provided
      if (updateData.team || updateData.stack) {
        this.validateStackData({ ...existingStack, ...updateData });
      }

      const updatedStack = await this.teamStackRepository.update(id, updateData);
      return updatedStack;
    } catch (error) {
      if (error.statusCode) throw error;
      throw new AppError('Failed to update team stack', 500);
    }
  }

  async deleteStack(id) {
    try {
      const deletedStack = await this.teamStackRepository.delete(id);
      if (!deletedStack) {
        throw new AppError('Team stack not found', 404);
      }
      return { success: true, deletedStack };
    } catch (error) {
      if (error.statusCode) throw error;
      throw new AppError('Failed to delete team stack', 500);
    }
  }

  async deleteStacks(stackIds) {
    try {
      const result = await this.teamStackRepository.deleteMany(stackIds);
      return {
        success: true,
        deletedStacks: result.deletedStacks,
        notFoundIds: result.notFoundIds.length > 0 ? result.notFoundIds : undefined,
        message: `Deleted ${result.deletedStacks.length} team stacks successfully`
      };
    } catch (error) {
      throw new AppError('Failed to delete team stacks', 500);
    }
  }

  async searchStacks(filters) {
    try {
      const stacks = await this.teamStackRepository.search(filters);
      return {
        success: true,
        count: stacks.length,
        stacks
      };
    } catch (error) {
      throw new AppError('Failed to search team stacks', 500);
    }
  }

  async getStackStats() {
    try {
      const [
        stackSizeDistribution,
        teamCount,
        averageStackPlus,
        totalCount
      ] = await Promise.all([
        this.teamStackRepository.getStackSizeDistribution(),
        this.teamStackRepository.getTeamCount(),
        this.teamStackRepository.getAverageStackPlus(),
        this.teamStackRepository.count()
      ]);

      return {
        overview: {
          totalStacks: totalCount,
          totalTeams: teamCount,
          ...averageStackPlus
        },
        stackSizeDistribution,
        averageStackPlus
      };
    } catch (error) {
      throw new AppError('Failed to calculate team stack statistics', 500);
    }
  }

  async getTopStacks(limit = 10) {
    try {
      const topStacks = await this.teamStackRepository.getTopStacks(limit);
      return topStacks;
    } catch (error) {
      throw new AppError('Failed to fetch top stacks', 500);
    }
  }

  async getStacksByTier() {
    try {
      const stacksByTier = await this.teamStackRepository.getStacksByTier();
      return stacksByTier;
    } catch (error) {
      throw new AppError('Failed to get stacks by tier', 500);
    }
  }

  async processStacksCsv(csvData) {
    try {
      const processedStacks = [];
      
      for (const data of csvData) {
        // Parse Stack+ columns (from original parseStacksCSV function)
        const stack = {
          id: generateRandomId(),
          team: data.Team || "",
          stack: [], // Will be populated below
          stackPlus: parseFloat(data["Stack+"] || 0) || 0,
          stackPlusValue: parseFloat(data["Stack+"] || 0) || 0,
          stackPlusAllWins: parseFloat(data["Stack+ All Wins"] || 0) || 0,
          stackPlusAllLosses: parseFloat(data["Stack+ All Losses"] || 0) || 0,
        };

        // If no team found, skip this row
        if (!stack.team) {
          continue;
        }

        // Extract positions for stacks
        const positions = ["TOP", "JNG", "MID", "ADC", "SUP"];
        const stackPositions = [];

        // Check if positions are directly present in the row
        positions.forEach((pos) => {
          if (
            data[pos] &&
            (data[pos] === "1" || data[pos] === "true" || data[pos] === "yes")
          ) {
            stackPositions.push(pos);
          }
        });

        // Default to 3-stack if no positions found
        if (stackPositions.length === 0) {
          stack.stack = ["MID", "JNG", "TOP"]; // Default 3-stack
        } else {
          stack.stack = stackPositions;
        }

        // Only add valid stacks with a team
        if (stack.team && stack.stack.length > 0) {
          processedStacks.push(stack);
        }
      }

      return processedStacks;
    } catch (error) {
      throw new AppError('Failed to process team stacks CSV data', 500);
    }
  }

  async enhanceStacksWithPlayerData(stacks, players) {
    // Group players by team (from original server.js logic)
    const teamGroups = {};

    players.forEach((player) => {
      if (!player.team) return;

      if (!teamGroups[player.team]) {
        teamGroups[player.team] = {
          players: [],
          totalProjection: 0,
        };
      }

      teamGroups[player.team].players.push(player);
      teamGroups[player.team].totalProjection += Number(player.projectedPoints || 0);
    });

    // Enhanced stacks with player data
    const enhancedStacks = stacks.map((stack) => {
      // Get all players for this team
      const teamPlayers = players.filter((p) => p.team === stack.team);

      // Calculate total projection for the team
      const totalProjection = teamPlayers.reduce(
        (sum, p) => sum + Number(p.projectedPoints || 0),
        0
      );

      // Get stack-specific players
      const stackPlayers = teamPlayers.filter(
        (player) => stack.stack && stack.stack.includes(player.position)
      );

      // Calculate stack-specific projections
      const stackProjection = stackPlayers.reduce(
        (sum, player) => sum + Number(player.projectedPoints || 0),
        0
      );

      // Calculate ownership data
      const avgTeamOwnership = teamPlayers.length > 0
        ? teamPlayers.reduce((sum, p) => sum + Number(p.ownership || 0), 0) / teamPlayers.length
        : 0;

      const avgStackOwnership = stackPlayers.length > 0
        ? stackPlayers.reduce((sum, p) => sum + Number(p.ownership || 0), 0) / stackPlayers.length
        : 0;

      // Add time info (for UI display)
      const times = ["1:00 AM", "2:00 AM", "4:00 AM", "11:00 PM"];
      const randomTime = times[Math.floor(Math.random() * times.length)];

      // Get tier information
      const tierInfo = this.teamStackRepository.getStackTier(stack.stackPlus);

      // Return enhanced stack
      return {
        ...stack,
        totalProjection,
        stackProjection,
        avgTeamOwnership,
        avgStackOwnership,
        teamPlayerCount: teamPlayers.length,
        stackPlayerCount: stackPlayers.length,
        time: randomTime,
        status: "—", // Default status
        tier: tierInfo.tier,
        tierColor: tierInfo.color
      };
    });

    return enhancedStacks;
  }

  validateStackData(stackData) {
    const errors = [];

    if (!stackData.team || typeof stackData.team !== 'string') {
      errors.push('Team is required and must be a string');
    }

    if (!Array.isArray(stackData.stack) || stackData.stack.length === 0) {
      errors.push('Stack must be a non-empty array of positions');
    }

    if (stackData.stack && Array.isArray(stackData.stack)) {
      const validPositions = ['TOP', 'JNG', 'MID', 'ADC', 'SUP', 'TEAM'];
      for (const position of stackData.stack) {
        if (!validPositions.includes(position)) {
          errors.push(`Invalid position in stack: ${position}`);
        }
      }
    }

    if (stackData.stackPlus !== undefined && 
        (typeof stackData.stackPlus !== 'number' || isNaN(stackData.stackPlus))) {
      errors.push('Stack+ rating must be a valid number');
    }

    if (errors.length > 0) {
      throw new AppError(`Team stack validation failed: ${errors.join(', ')}`, 400);
    }
  }

  // Export stacks in various formats
  async exportStacks(format = 'csv', stackIds = []) {
    try {
      let stacksToExport;
      
      if (stackIds.length > 0) {
        stacksToExport = await Promise.all(
          stackIds.map(id => this.teamStackRepository.findById(id))
        );
        stacksToExport = stacksToExport.filter(Boolean);
      } else {
        stacksToExport = await this.teamStackRepository.findAll();
      }

      if (stacksToExport.length === 0) {
        throw new AppError('No team stacks found to export', 400);
      }

      switch (format.toLowerCase()) {
        case 'csv':
          return this.generateCsvExport(stacksToExport);
        case 'json':
          return this.generateJsonExport(stacksToExport);
        default:
          throw new AppError('Unsupported export format. Use: csv or json', 400);
      }
    } catch (error) {
      if (error.statusCode) throw error;
      throw new AppError('Failed to export team stacks', 500);
    }
  }

  generateCsvExport(stacks) {
    const headers = [
      "Team", "Stack Positions", "Stack+", "Stack+ All Wins", "Stack+ All Losses",
      "Total Projection", "Stack Projection", "Team Players", "Stack Players"
    ];
    const rows = [headers.join(",")];

    stacks.forEach((stack) => {
      const row = [
        `"${stack.team || ""}"`,
        `"${stack.stack ? stack.stack.join(', ') : ""}"`,
        stack.stackPlus?.toFixed(2) || "0.00",
        stack.stackPlusAllWins?.toFixed(2) || "0.00",
        stack.stackPlusAllLosses?.toFixed(2) || "0.00",
        stack.totalProjection?.toFixed(2) || "0.00",
        stack.stackProjection?.toFixed(2) || "0.00",
        stack.teamPlayerCount || 0,
        stack.stackPlayerCount || 0
      ];
      rows.push(row.join(","));
    });

    return rows.join("\n");
  }

  generateJsonExport(stacks) {
    return JSON.stringify(stacks, null, 2);
  }
}

module.exports = TeamStackService;