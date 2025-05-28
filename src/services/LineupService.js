/**
 * LineupService
 * Handles all lineup-related business logic
 */

const { generateLineupId } = require('../utils/generators');
const { AppError } = require('../middleware/errorHandler');

class LineupService {
  constructor(lineupRepository, playerRepository) {
    this.lineupRepository = lineupRepository;
    this.playerRepository = playerRepository;
  }

  async getAllLineups() {
    try {
      const lineups = await this.lineupRepository.findAll();
      return lineups;
    } catch (error) {
      throw new AppError('Failed to fetch lineups', 500);
    }
  }

  async getLineupById(id) {
    try {
      const lineup = await this.lineupRepository.findById(id);
      if (!lineup) {
        throw new AppError('Lineup not found', 404);
      }
      return lineup;
    } catch (error) {
      if (error.statusCode) throw error;
      throw new AppError('Failed to fetch lineup', 500);
    }
  }

  async createLineup(lineupData) {
    try {
      // Validate lineup structure
      this.validateLineupStructure(lineupData);
      
      // Enrich lineup data with calculated fields
      const enrichedLineup = await this.enrichLineupData(lineupData);
      
      const newLineup = await this.lineupRepository.create(enrichedLineup);
      return newLineup;
    } catch (error) {
      if (error.statusCode) throw error;
      throw new AppError('Failed to create lineup', 500);
    }
  }

  async createLineups(lineupsData) {
    try {
      const enrichedLineups = await Promise.all(
        lineupsData.map(lineup => this.enrichLineupData(lineup))
      );
      
      const newLineups = await this.lineupRepository.createMany(enrichedLineups);
      return newLineups;
    } catch (error) {
      if (error.statusCode) throw error;
      throw new AppError('Failed to create lineups', 500);
    }
  }

  async updateLineup(id, updateData) {
    try {
      const existingLineup = await this.lineupRepository.findById(id);
      if (!existingLineup) {
        throw new AppError('Lineup not found', 404);
      }

      // Re-enrich lineup data if players or captain changed
      let enrichedUpdateData = updateData;
      if (updateData.cpt || updateData.players) {
        const updatedLineup = { ...existingLineup, ...updateData };
        enrichedUpdateData = await this.enrichLineupData(updatedLineup);
      }

      const updatedLineup = await this.lineupRepository.update(id, enrichedUpdateData);
      return updatedLineup;
    } catch (error) {
      if (error.statusCode) throw error;
      throw new AppError('Failed to update lineup', 500);
    }
  }

  async deleteLineup(id) {
    try {
      const deletedLineup = await this.lineupRepository.delete(id);
      if (!deletedLineup) {
        throw new AppError('Lineup not found', 404);
      }
      return { success: true, deletedLineup };
    } catch (error) {
      if (error.statusCode) throw error;
      throw new AppError('Failed to delete lineup', 500);
    }
  }

  async deleteLineups(lineupIds) {
    try {
      const result = await this.lineupRepository.deleteMany(lineupIds);
      return {
        success: true,
        deletedLineups: result.deletedLineups,
        notFoundIds: result.notFoundIds.length > 0 ? result.notFoundIds : undefined,
        message: `Deleted ${result.deletedLineups.length} lineups successfully`
      };
    } catch (error) {
      throw new AppError('Failed to delete lineups', 500);
    }
  }

  async searchLineups(filters) {
    try {
      const lineups = await this.lineupRepository.search(filters);
      return {
        success: true,
        count: lineups.length,
        lineups
      };
    } catch (error) {
      throw new AppError('Failed to search lineups', 500);
    }
  }

  async getLineupStats() {
    try {
      const [averageStats, teamExposure, positionExposure, totalCount] = await Promise.all([
        this.lineupRepository.getAverageStats(),
        this.lineupRepository.getTeamExposure(),
        this.lineupRepository.getPositionExposure(),
        this.lineupRepository.count()
      ]);

      return {
        overview: averageStats,
        teamExposure,
        positionExposure,
        totalLineups: totalCount
      };
    } catch (error) {
      throw new AppError('Failed to calculate lineup statistics', 500);
    }
  }

  async processFromDraftKingsEntries(csvData) {
    try {
      const processedLineups = [];
      
      for (const row of csvData) {
        try {
          // Skip header rows or invalid entries
          if (row["Entry ID"] === "Entry ID" || !row["Entry ID"] || isNaN(row["Entry ID"])) {
            continue;
          }

          // Generate lineup from DraftKings format
          const lineup = this.parseDraftKingsEntry(row);
          if (lineup) {
            processedLineups.push(lineup);
          }
        } catch (error) {
          console.warn('Failed to process DraftKings entry:', error.message);
          continue;
        }
      }

      return processedLineups;
    } catch (error) {
      throw new AppError('Failed to process DraftKings entries', 500);
    }
  }

  async processFromJson(jsonData) {
    try {
      if (!Array.isArray(jsonData)) {
        throw new AppError('JSON data must be an array of lineups', 400);
      }

      const processedLineups = jsonData.map(lineup => ({
        ...lineup,
        id: lineup.id || generateLineupId()
      }));

      return processedLineups;
    } catch (error) {
      if (error.statusCode) throw error;
      throw new AppError('Failed to process JSON lineup data', 500);
    }
  }

  async exportLineups(format = 'csv', lineupIds = []) {
    try {
      let lineupsToExport;
      
      if (lineupIds.length > 0) {
        lineupsToExport = await this.lineupRepository.findByIds(lineupIds);
      } else {
        lineupsToExport = await this.lineupRepository.findAll();
      }

      if (lineupsToExport.length === 0) {
        throw new AppError('No lineups found to export', 400);
      }

      switch (format.toLowerCase()) {
        case 'csv':
          return this.generateCsvExport(lineupsToExport);
        case 'json':
          return this.generateJsonExport(lineupsToExport);
        case 'draftkings':
        case 'dk':
          return this.generateDraftKingsExport(lineupsToExport);
        default:
          throw new AppError('Unsupported export format. Use: csv, json, or draftkings', 400);
      }
    } catch (error) {
      if (error.statusCode) throw error;
      throw new AppError('Failed to export lineups', 500);
    }
  }

  // Simulate lineup performance (extracted from original server.js)
  async simulateLineups(lineupIds, simSettings = {}) {
    try {
      const selectedLineups = await this.lineupRepository.findByIds(lineupIds);
      
      if (selectedLineups.length === 0) {
        throw new AppError('No valid lineups found for simulation', 400);
      }

      // Calculate exposures
      const exposures = this.calculateExposures(selectedLineups);

      // Get player projections for simulation
      const playerProjections = await this.playerRepository.findAll();
      
      // Generate performance metrics based on player projections
      const lineupPerformance = selectedLineups.map((lineup) => {
        // Calculate base projected points using actual player data
        let baseProjection = 0;
        const cptProj = playerProjections.find((p) => p.name === lineup.cpt.name);
        if (cptProj) {
          baseProjection += cptProj.projectedPoints * 1.5; // CPT gets 1.5x points
        }

        lineup.players.forEach((player) => {
          const playerProj = playerProjections.find((p) => p.name === player.name);
          if (playerProj) {
            baseProjection += playerProj.projectedPoints;
          }
        });

        // Calculate placement chances based on projected points
        const minCashPct = Math.max(0, Math.min(100, 20 + baseProjection * 0.1));
        const top10Pct = Math.max(0, Math.min(50, 5 + baseProjection * 0.05));
        const firstPlacePct = Math.max(0, Math.min(10, baseProjection * 0.02));

        return {
          id: lineup.id,
          name: lineup.name,
          firstPlace: firstPlacePct.toFixed(2),
          top10: top10Pct.toFixed(2),
          minCash: minCashPct.toFixed(2),
          averagePayout: (baseProjection * 0.1).toFixed(2),
          projectedPoints: baseProjection.toFixed(1),
        };
      });

      // Sort by projected points descending
      lineupPerformance.sort((a, b) => parseFloat(b.projectedPoints) - parseFloat(a.projectedPoints));

      // Generate score distributions
      const scoreDistributions = lineupPerformance.map((perf) => {
        const projectedPoints = parseFloat(perf.projectedPoints);
        return {
          lineup: perf.id,
          p10: (projectedPoints * 0.8).toFixed(1),
          p25: (projectedPoints * 0.9).toFixed(1),
          p50: projectedPoints.toFixed(1),
          p75: (projectedPoints * 1.1).toFixed(1),
          p90: (projectedPoints * 1.2).toFixed(1),
        };
      });

      return {
        lineupPerformance,
        exposures,
        scoreDistributions,
      };
    } catch (error) {
      if (error.statusCode) throw error;
      throw new AppError('Failed to simulate lineups', 500);
    }
  }

  // Private helper methods
  validateLineupStructure(lineupData) {
    const errors = [];

    if (!lineupData.name || typeof lineupData.name !== 'string') {
      errors.push('Lineup name is required and must be a string');
    }

    if (!lineupData.cpt || !lineupData.cpt.name) {
      errors.push('Captain player is required');
    }

    if (!Array.isArray(lineupData.players) || lineupData.players.length < 5) {
      errors.push('At least 5 players are required');
    }

    if (lineupData.players && lineupData.players.length > 6) {
      errors.push('Maximum 6 players allowed');
    }

    if (errors.length > 0) {
      throw new AppError(`Lineup validation failed: ${errors.join(', ')}`, 400);
    }
  }

  async enrichLineupData(lineupData) {
    // Calculate total salary
    const totalSalary = this.lineupRepository.calculateTotalSalary(lineupData);
    
    // Calculate total projection
    const totalProjection = this.lineupRepository.calculateTotalProjection(lineupData);
    
    // Calculate NexusScore (simplified version)
    const nexusScore = this.calculateNexusScore(lineupData);
    
    return {
      ...lineupData,
      totalSalary,
      totalProjection: parseFloat(totalProjection.toFixed(2)),
      nexusScore: parseFloat(nexusScore.toFixed(1))
    };
  }

  calculateNexusScore(lineup) {
    // Simplified NexusScore calculation
    const allPlayers = [lineup.cpt, ...(lineup.players || [])];
    const teamCounts = {};

    allPlayers.forEach((player) => {
      if (player && player.team) {
        teamCounts[player.team] = (teamCounts[player.team] || 0) + 1;
      }
    });

    // Calculate total projection
    let totalProj = 0;
    if (lineup.cpt) {
      totalProj += (lineup.cpt.projectedPoints || 0) * 1.5; // CPT gets 1.5x
    }

    totalProj += (lineup.players || [])
      .reduce((sum, p) => sum + (p.projectedPoints || 0), 0);

    // Calculate average ownership
    const totalOwnership = allPlayers.reduce((sum, p) => {
      return sum + (p.ownership || 0);
    }, 0);

    const avgOwn = allPlayers.length > 0 ? totalOwnership / allPlayers.length : 0;

    // Calculate stack bonus
    let stackBonus = 0;
    Object.values(teamCounts).forEach((count) => {
      if (count >= 3) stackBonus += (count - 2) * 3;
    });

    // Calculate NexusScore
    const ownership = Math.max(0.1, avgOwn / 100);
    const leverageFactor = Math.min(1.5, Math.max(0.6, 1 / ownership));
    const baseScore = totalProj / 10;
    const nexusScore = Math.min(65, Math.max(25, baseScore * leverageFactor + stackBonus / 2));

    return nexusScore;
  }

  parseDraftKingsEntry(row) {
    const id = row["Entry ID"] || generateLineupId();
    const name = `DK Lineup ${id}`;

    // Extract CPT player
    let cpt = null;
    if (row["CPT"]) {
      const cptName = this.extractPlayerName(row["CPT"]);
      const cptId = this.extractPlayerId(row["CPT"]);
      cpt = {
        name: cptName,
        id: cptId,
        position: "CPT",
        salary: 0,
      };
    }

    if (!cpt) {
      return null; // Skip invalid entries
    }

    // Extract position players
    const players = [];
    const positions = ["TOP", "JNG", "MID", "ADC", "SUP", "TEAM"];

    positions.forEach(position => {
      if (row[position]) {
        players.push({
          name: this.extractPlayerName(row[position]),
          id: this.extractPlayerId(row[position]),
          position: position,
          salary: 0,
        });
      }
    });

    if (players.length < 2) {
      return null; // Skip invalid lineups
    }

    return {
      id,
      name,
      cpt,
      players,
    };
  }

  extractPlayerName(playerStr) {
    if (!playerStr) return "";
    const nameMatch = playerStr.match(/^(.*?)(?:\s+\(|$)/);
    return nameMatch ? nameMatch[1].trim() : playerStr.trim();
  }

  extractPlayerId(playerStr) {
    if (!playerStr) return "";
    const idMatch = playerStr.match(/\((\d+)\)$/);
    return idMatch ? idMatch[1] : "";
  }

  calculateExposures(lineupList) {
    const teamExposure = {};
    const positionExposure = {};
    let totalPlayers = 0;

    // Initialize position counters
    ["TOP", "JNG", "MID", "ADC", "SUP", "TEAM"].forEach((pos) => {
      positionExposure[pos] = 0;
    });

    lineupList.forEach((lineup) => {
      // Count CPT team
      const cptTeam = lineup.cpt.team;
      teamExposure[cptTeam] = (teamExposure[cptTeam] || 0) + 1;

      // Count CPT position
      const cptPos = lineup.cpt.position;
      positionExposure[cptPos] = (positionExposure[cptPos] || 0) + 1;

      totalPlayers++;

      // Count players
      lineup.players.forEach((player) => {
        teamExposure[player.team] = (teamExposure[player.team] || 0) + 1;
        positionExposure[player.position] = (positionExposure[player.position] || 0) + 1;
        totalPlayers++;
      });
    });

    // Convert counts to percentages
    Object.keys(teamExposure).forEach((team) => {
      teamExposure[team] = (teamExposure[team] / totalPlayers) * 100;
    });

    Object.keys(positionExposure).forEach((pos) => {
      positionExposure[pos] = (positionExposure[pos] / totalPlayers) * 100;
    });

    return { team: teamExposure, position: positionExposure };
  }

  generateCsvExport(lineups) {
    const headers = [
      "ID", "Name", "CPT", "TOP", "JNG", "MID", "ADC", "SUP", "TEAM", 
      "Total Salary", "Total Projection", "NexusScore"
    ];
    const rows = [headers.join(",")];

    lineups.forEach((lineup) => {
      const players = lineup.players || [];
      const totalSalary = this.lineupRepository.calculateTotalSalary(lineup);
      const totalProjection = this.lineupRepository.calculateTotalProjection(lineup);

      const row = [
        lineup.id || "",
        `"${lineup.name || ""}"`,
        `"${lineup.cpt?.name || ""}"`,
        `"${players.find((p) => p.position === "TOP")?.name || ""}"`,
        `"${players.find((p) => p.position === "JNG")?.name || ""}"`,
        `"${players.find((p) => p.position === "MID")?.name || ""}"`,
        `"${players.find((p) => p.position === "ADC")?.name || ""}"`,
        `"${players.find((p) => p.position === "SUP")?.name || ""}"`,
        `"${players.find((p) => p.position === "TEAM")?.name || ""}"`,
        totalSalary,
        totalProjection.toFixed(2),
        (lineup.nexusScore || 0).toFixed(1)
      ];
      rows.push(row.join(","));
    });

    return rows.join("\n");
  }

  generateJsonExport(lineups) {
    return JSON.stringify(lineups, null, 2);
  }

  generateDraftKingsExport(lineups) {
    // This would need contest metadata for proper DraftKings export
    // For now, return basic CSV format
    return this.generateCsvExport(lineups);
  }
}

module.exports = LineupService;