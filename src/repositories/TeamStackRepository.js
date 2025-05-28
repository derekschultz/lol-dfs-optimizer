/**
 * TeamStackRepository
 * Data access layer for team stack operations
 * Currently uses in-memory storage, will be replaced with database in Phase 2
 */

const { generateRandomId } = require('../utils/generators');

class TeamStackRepository {
  constructor() {
    // In-memory storage (temporary until Phase 2 database implementation)
    this.teamStacks = [];
    this.nextId = 1;
  }

  async findAll() {
    return [...this.teamStacks];
  }

  async findById(id) {
    return this.teamStacks.find(stack => stack.id == id) || null;
  }

  async findByTeam(team) {
    return this.teamStacks.filter(stack => stack.team === team);
  }

  async findByStackSize(stackSize) {
    return this.teamStacks.filter(stack => stack.stack && stack.stack.length === stackSize);
  }

  async create(stackData) {
    const newStack = {
      ...stackData,
      id: stackData.id || generateRandomId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
    
    this.teamStacks.push(newStack);
    return newStack;
  }

  async createMany(stacksData) {
    const newStacks = stacksData.map(stackData => ({
      ...stackData,
      id: stackData.id || generateRandomId(),
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
    
    this.teamStacks.push(...newStacks);
    return newStacks;
  }

  async update(id, updateData) {
    const index = this.teamStacks.findIndex(stack => stack.id == id);
    if (index === -1) {
      return null;
    }

    this.teamStacks[index] = {
      ...this.teamStacks[index],
      ...updateData,
      updatedAt: new Date().toISOString()
    };

    return this.teamStacks[index];
  }

  async delete(id) {
    const index = this.teamStacks.findIndex(stack => stack.id == id);
    if (index === -1) {
      return false;
    }

    const deletedStack = this.teamStacks[index];
    this.teamStacks.splice(index, 1);
    return deletedStack;
  }

  async deleteMany(ids) {
    const deletedStacks = [];
    const notFoundIds = [];

    for (const id of ids) {
      const index = this.teamStacks.findIndex(stack => stack.id == id);
      if (index !== -1) {
        deletedStacks.push(this.teamStacks.splice(index, 1)[0]);
      } else {
        notFoundIds.push(id);
      }
    }

    return { deletedStacks, notFoundIds };
  }

  async deleteAll() {
    this.teamStacks = [];
    return true;
  }

  async replaceAll(newStacks) {
    this.teamStacks = newStacks.map(stack => ({
      ...stack,
      id: stack.id || generateRandomId(),
      createdAt: stack.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString()
    }));
    
    return this.teamStacks;
  }

  async count() {
    return this.teamStacks.length;
  }

  async search(filters = {}) {
    let results = [...this.teamStacks];

    if (filters.team) {
      results = results.filter(stack => 
        stack.team && stack.team.toLowerCase().includes(filters.team.toLowerCase())
      );
    }

    if (filters.minStackPlus !== undefined) {
      results = results.filter(stack => 
        (stack.stackPlus || 0) >= filters.minStackPlus
      );
    }

    if (filters.maxStackPlus !== undefined) {
      results = results.filter(stack => 
        (stack.stackPlus || 0) <= filters.maxStackPlus
      );
    }

    if (filters.stackSize) {
      results = results.filter(stack => 
        stack.stack && stack.stack.length === filters.stackSize
      );
    }

    if (filters.includesPosition) {
      results = results.filter(stack => 
        stack.stack && stack.stack.includes(filters.includesPosition)
      );
    }

    if (filters.minProjection !== undefined) {
      results = results.filter(stack => 
        (stack.totalProjection || 0) >= filters.minProjection
      );
    }

    if (filters.maxProjection !== undefined) {
      results = results.filter(stack => 
        (stack.totalProjection || 0) <= filters.maxProjection
      );
    }

    return results;
  }

  // Statistics methods
  async getStackSizeDistribution() {
    const distribution = {};
    
    this.teamStacks.forEach(stack => {
      const size = stack.stack ? stack.stack.length : 0;
      distribution[size] = (distribution[size] || 0) + 1;
    });

    return distribution;
  }

  async getTeamCount() {
    const teams = new Set(this.teamStacks.map(stack => stack.team).filter(Boolean));
    return teams.size;
  }

  async getAverageStackPlus() {
    if (this.teamStacks.length === 0) {
      return {
        avgStackPlus: 0,
        avgStackPlusWins: 0,
        avgStackPlusLosses: 0,
        totalStacks: 0
      };
    }

    const totals = this.teamStacks.reduce((acc, stack) => ({
      stackPlus: acc.stackPlus + (stack.stackPlus || 0),
      stackPlusWins: acc.stackPlusWins + (stack.stackPlusAllWins || 0),
      stackPlusLosses: acc.stackPlusLosses + (stack.stackPlusAllLosses || 0)
    }), { stackPlus: 0, stackPlusWins: 0, stackPlusLosses: 0 });

    const count = this.teamStacks.length;

    return {
      avgStackPlus: parseFloat((totals.stackPlus / count).toFixed(2)),
      avgStackPlusWins: parseFloat((totals.stackPlusWins / count).toFixed(2)),
      avgStackPlusLosses: parseFloat((totals.stackPlusLosses / count).toFixed(2)),
      totalStacks: count
    };
  }

  async getTopStacks(limit = 10) {
    return [...this.teamStacks]
      .sort((a, b) => (b.stackPlus || 0) - (a.stackPlus || 0))
      .slice(0, limit);
  }

  async getStacksByTier() {
    const tiers = {
      elite: [], // 200+
      veryStrong: [], // 150-199
      strong: [], // 100-149
      aboveAverage: [], // 50-99
      slightlyAbove: [], // 20-49
      average: [], // 10-19
      belowAverage: [], // 5-9
      poor: [] // 0-4
    };

    this.teamStacks.forEach(stack => {
      const rating = stack.stackPlus || 0;
      
      if (rating >= 200) {
        tiers.elite.push(stack);
      } else if (rating >= 150) {
        tiers.veryStrong.push(stack);
      } else if (rating >= 100) {
        tiers.strong.push(stack);
      } else if (rating >= 50) {
        tiers.aboveAverage.push(stack);
      } else if (rating >= 20) {
        tiers.slightlyAbove.push(stack);
      } else if (rating >= 10) {
        tiers.average.push(stack);
      } else if (rating >= 5) {
        tiers.belowAverage.push(stack);
      } else {
        tiers.poor.push(stack);
      }
    });

    return tiers;
  }

  // Helper methods for enhanced stack data
  calculateStackProjection(stack, teamPlayers) {
    if (!stack.stack || !teamPlayers) return 0;
    
    const stackPlayers = teamPlayers.filter(player => 
      stack.stack.includes(player.position)
    );
    
    return stackPlayers.reduce((sum, player) => 
      sum + Number(player.projectedPoints || 0), 0
    );
  }

  calculateStackOwnership(stack, teamPlayers) {
    if (!stack.stack || !teamPlayers) return 0;
    
    const stackPlayers = teamPlayers.filter(player => 
      stack.stack.includes(player.position)
    );
    
    if (stackPlayers.length === 0) return 0;
    
    return stackPlayers.reduce((sum, player) => 
      sum + Number(player.ownership || 0), 0
    ) / stackPlayers.length;
  }

  getStackTier(stackPlus) {
    const rating = stackPlus || 0;
    
    if (rating >= 200) return { tier: 'Elite', color: '#10b981' };
    if (rating >= 150) return { tier: 'Very Strong', color: '#34d399' };
    if (rating >= 100) return { tier: 'Strong', color: '#60a5fa' };
    if (rating >= 50) return { tier: 'Above Average', color: '#93c5fd' };
    if (rating >= 20) return { tier: 'Slightly Above', color: '#cbd5e1' };
    if (rating >= 10) return { tier: 'Average', color: '#94a3b8' };
    if (rating >= 5) return { tier: 'Below Average', color: '#f59e0b' };
    return { tier: 'Poor', color: '#ef4444' };
  }
}

module.exports = TeamStackRepository;