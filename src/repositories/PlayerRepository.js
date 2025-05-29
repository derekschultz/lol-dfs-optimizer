/**
 * PlayerRepository
 * Data access layer for player operations
 * Currently uses in-memory storage, will be replaced with database in Phase 2
 */

class PlayerRepository {
  constructor() {
    // In-memory storage (temporary until Phase 2 database implementation)
    this.players = [];
    this.nextId = 1;
  }

  async findAll() {
    return [...this.players];
  }

  async findById(id) {
    return this.players.find((player) => player.id == id) || null;
  }

  async findByTeam(team) {
    return this.players.filter((player) => player.team === team);
  }

  async findByPosition(position) {
    return this.players.filter((player) => player.position === position);
  }

  async create(playerData) {
    const newPlayer = {
      ...playerData,
      id: playerData.id || this.nextId++,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    };

    this.players.push(newPlayer);
    return newPlayer;
  }

  async update(id, updateData) {
    const index = this.players.findIndex((player) => player.id == id);
    if (index === -1) {
      return null;
    }

    this.players[index] = {
      ...this.players[index],
      ...updateData,
      updatedAt: new Date().toISOString(),
    };

    return this.players[index];
  }

  async delete(id) {
    const index = this.players.findIndex((player) => player.id == id);
    if (index === -1) {
      return false;
    }

    this.players.splice(index, 1);
    return true;
  }

  async deleteAll() {
    this.players = [];
    return true;
  }

  async replaceAll(newPlayers) {
    this.players = newPlayers.map((player, index) => ({
      ...player,
      id: player.id || index + 1,
      createdAt: player.createdAt || new Date().toISOString(),
      updatedAt: new Date().toISOString(),
    }));

    // Update nextId counter
    this.nextId = Math.max(...this.players.map((p) => p.id || 0)) + 1;

    return this.players;
  }

  async count() {
    return this.players.length;
  }

  async search(filters = {}) {
    let results = [...this.players];

    if (filters.team) {
      results = results.filter((player) =>
        player.team.toLowerCase().includes(filters.team.toLowerCase())
      );
    }

    if (filters.position) {
      results = results.filter(
        (player) => player.position === filters.position
      );
    }

    if (filters.name) {
      results = results.filter((player) =>
        player.name.toLowerCase().includes(filters.name.toLowerCase())
      );
    }

    if (filters.minSalary) {
      results = results.filter((player) => player.salary >= filters.minSalary);
    }

    if (filters.maxSalary) {
      results = results.filter((player) => player.salary <= filters.maxSalary);
    }

    if (filters.minProjection) {
      results = results.filter(
        (player) => player.projectedPoints >= filters.minProjection
      );
    }

    if (filters.maxProjection) {
      results = results.filter(
        (player) => player.projectedPoints <= filters.maxProjection
      );
    }

    return results;
  }

  // Statistics methods
  async getPositionCounts() {
    const counts = {};
    this.players.forEach((player) => {
      counts[player.position] = (counts[player.position] || 0) + 1;
    });
    return counts;
  }

  async getTeamCounts() {
    const counts = {};
    this.players.forEach((player) => {
      counts[player.team] = (counts[player.team] || 0) + 1;
    });
    return counts;
  }

  async getAverageStats() {
    if (this.players.length === 0) {
      return {
        avgSalary: 0,
        avgProjection: 0,
        avgOwnership: 0,
        avgValue: 0,
      };
    }

    const totals = this.players.reduce(
      (acc, player) => ({
        salary: acc.salary + (player.salary || 0),
        projection: acc.projection + (player.projectedPoints || 0),
        ownership: acc.ownership + (player.ownership || 0),
        value: acc.value + (parseFloat(player.value) || 0),
      }),
      { salary: 0, projection: 0, ownership: 0, value: 0 }
    );

    const count = this.players.length;

    return {
      avgSalary: Math.round(totals.salary / count),
      avgProjection: parseFloat((totals.projection / count).toFixed(2)),
      avgOwnership: parseFloat((totals.ownership / count).toFixed(2)),
      avgValue: parseFloat((totals.value / count).toFixed(2)),
    };
  }
}

module.exports = PlayerRepository;
