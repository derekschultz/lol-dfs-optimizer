/**
 * LineupRepository
 * Data access layer for lineup operations
 * Currently uses in-memory storage, will be replaced with database in Phase 2
 */

const { generateLineupId } = require('../utils/generators');

class LineupRepository {
  constructor() {
    // In-memory storage (temporary until Phase 2 database implementation)
    this.lineups = [];
    this.nextId = 1;
  }

  async findAll() {
    return [...this.lineups];
  }

  async findById(id) {
    return this.lineups.find(lineup => lineup.id == id) || null;
  }

  async findByIds(ids) {
    return this.lineups.filter(lineup => ids.includes(lineup.id));
  }

  async create(lineupData) {
    const newLineup = {
      ...lineupData,
      id: lineupData.id || generateLineupId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    this.lineups.push(newLineup);
    return newLineup;
  }

  async createMany(lineupsData) {
    const newLineups = lineupsData.map(lineupData => ({
      ...lineupData,
      id: lineupData.id || generateLineupId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
    
    this.lineups.push(...newLineups);
    return newLineups;
  }

  async update(id, updateData) {
    const index = this.lineups.findIndex(lineup => lineup.id == id);
    if (index === -1) {
      return null;
    }

    this.lineups[index] = {
      ...this.lineups[index],
      ...updateData,
      updatedAt: new Date().toISOString()
    };

    return this.lineups[index];
  }

  async delete(id) {
    const index = this.lineups.findIndex(lineup => lineup.id == id);
    if (index === -1) {
      return false;
    }

    const deletedLineup = this.lineups[index];
    this.lineups.splice(index, 1);
    return deletedLineup;
  }

  async deleteMany(ids) {
    const deletedLineups = [];
    const notFoundIds = [];

    for (const id of ids) {
      const index = this.lineups.findIndex(lineup => lineup.id == id);
      if (index !== -1) {
        deletedLineups.push(this.lineups.splice(index, 1)[0]);
      } else {
        notFoundIds.push(id);
      }
    }

    return { deletedLineups, notFoundIds };
  }

  async deleteAll() {
    this.lineups = [];
    return true;
  }

  async replaceAll(newLineups) {
    this.lineups = newLineups.map(lineup => ({
      ...lineup,
      id: lineup.id || generateLineupId(),
      createdAt: lineup.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
    
    return this.lineups;
  }

  async count() {
    return this.lineups.length;
  }

  async search(filters = {}) {
    let results = [...this.lineups];

    if (filters.name) {
      results = results.filter(lineup => 
        lineup.name && lineup.name.toLowerCase().includes(filters.name.toLowerCase())
      );
    }

    if (filters.minSalary) {
      results = results.filter(lineup => {
        const totalSalary = this.calculateTotalSalary(lineup);
        return totalSalary >= filters.minSalary;
      });
    }

    if (filters.maxSalary) {
      results = results.filter(lineup => {
        const totalSalary = this.calculateTotalSalary(lineup);
        return totalSalary <= filters.maxSalary;
      });
    }

    if (filters.minProjection) {
      results = results.filter(lineup => {
        const totalProjection = this.calculateTotalProjection(lineup);
        return totalProjection >= filters.minProjection;
      });
    }

    if (filters.maxProjection) {
      results = results.filter(lineup => {
        const totalProjection = this.calculateTotalProjection(lineup);
        return totalProjection <= filters.maxProjection;
      });
    }

    if (filters.team) {
      results = results.filter(lineup => {
        const teams = this.getLineupTeams(lineup);
        return teams.includes(filters.team);
      });
    }

    if (filters.hasTeam) {
      results = results.filter(lineup => {
        const teams = this.getLineupTeams(lineup);
        return teams.includes(filters.hasTeam);
      });
    }

    if (filters.minNexusScore) {
      results = results.filter(lineup => 
        (lineup.nexusScore || 0) >= filters.minNexusScore
      );
    }

    if (filters.maxNexusScore) {
      results = results.filter(lineup => 
        (lineup.nexusScore || 0) <= filters.maxNexusScore
      );
    }

    return results;
  }

  // Helper methods for lineup calculations
  calculateTotalSalary(lineup) {
    const captainSalary = lineup.cpt?.salary || 0;
    const playersSalary = lineup.players?.reduce((sum, p) => sum + (p.salary || 0), 0) || 0;
    return captainSalary + playersSalary;
  }

  calculateTotalProjection(lineup) {
    const captainProjection = lineup.cpt?.projectedPoints || 0;
    const playersProjection = lineup.players?.reduce((sum, p) => sum + (p.projectedPoints || 0), 0) || 0;
    return captainProjection * 1.5 + playersProjection; // Captain gets 1.5x multiplier
  }

  getLineupTeams(lineup) {
    const teams = new Set();
    
    if (lineup.cpt?.team) {
      teams.add(lineup.cpt.team);
    }
    
    if (lineup.players) {
      lineup.players.forEach(player => {
        if (player.team) {
          teams.add(player.team);
        }
      });
    }
    
    return Array.from(teams);
  }

  getTeamComposition(lineup) {
    const teamComposition = {};
    
    if (lineup.cpt?.team) {
      teamComposition[lineup.cpt.team] = (teamComposition[lineup.cpt.team] || 0) + 1;
    }
    
    if (lineup.players) {
      lineup.players.forEach(player => {
        if (player.team) {
          teamComposition[player.team] = (teamComposition[player.team] || 0) + 1;
        }
      });
    }
    
    return teamComposition;
  }

  // Statistics methods
  async getAverageStats() {
    if (this.lineups.length === 0) {
      return {
        avgSalary: 0,
        avgProjection: 0,
        avgNexusScore: 0,
        totalLineups: 0
      };
    }

    const totals = this.lineups.reduce((acc, lineup) => ({
      salary: acc.salary + this.calculateTotalSalary(lineup),
      projection: acc.projection + this.calculateTotalProjection(lineup),
      nexusScore: acc.nexusScore + (lineup.nexusScore || 0)
    }), { salary: 0, projection: 0, nexusScore: 0 });

    const count = this.lineups.length;

    return {
      avgSalary: Math.round(totals.salary / count),
      avgProjection: parseFloat((totals.projection / count).toFixed(2)),
      avgNexusScore: parseFloat((totals.nexusScore / count).toFixed(2)),
      totalLineups: count
    };
  }

  async getTeamExposure() {
    const teamCounts = {};
    const totalLineups = this.lineups.length;

    this.lineups.forEach(lineup => {
      const teams = this.getLineupTeams(lineup);
      teams.forEach(team => {
        teamCounts[team] = (teamCounts[team] || 0) + 1;
      });
    });

    // Convert counts to percentages
    const teamExposure = {};
    Object.keys(teamCounts).forEach(team => {
      teamExposure[team] = totalLineups > 0 
        ? parseFloat(((teamCounts[team] / totalLineups) * 100).toFixed(2))
        : 0;
    });

    return teamExposure;
  }

  async getPositionExposure() {
    const positionCounts = {};
    const totalLineups = this.lineups.length;

    this.lineups.forEach(lineup => {
      // Count captain position
      if (lineup.cpt?.position) {
        positionCounts[lineup.cpt.position] = (positionCounts[lineup.cpt.position] || 0) + 1;
      }

      // Count regular positions
      if (lineup.players) {
        lineup.players.forEach(player => {
          if (player.position) {
            positionCounts[player.position] = (positionCounts[player.position] || 0) + 1;
          }
        });
      }
    });

    // Convert counts to percentages
    const positionExposure = {};
    Object.keys(positionCounts).forEach(position => {
      positionExposure[position] = totalLineups > 0 
        ? parseFloat(((positionCounts[position] / totalLineups) * 100).toFixed(2))
        : 0;
    });

    return positionExposure;
  }
}

module.exports = LineupRepository;