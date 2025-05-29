/**
 * PlayerService
 * Handles all player-related business logic
 */

const { generateRandomId, generatePlayerId } = require("../utils/generators");
const { AppError } = require("../middleware/errorHandler");

class PlayerService {
  constructor(playerRepository) {
    this.playerRepository = playerRepository;
  }

  async getAllPlayers() {
    try {
      const players = await this.playerRepository.findAll();
      return players;
    } catch (error) {
      throw new AppError("Failed to fetch players", 500);
    }
  }

  async getPlayerById(id) {
    try {
      const player = await this.playerRepository.findById(id);
      if (!player) {
        throw new AppError("Player not found", 404);
      }
      return player;
    } catch (error) {
      if (error.statusCode) throw error;
      throw new AppError("Failed to fetch player", 500);
    }
  }

  async getPlayersByTeam(team) {
    try {
      const players = await this.playerRepository.findByTeam(team);
      return players;
    } catch (error) {
      throw new AppError(`Failed to fetch players for team ${team}`, 500);
    }
  }

  async getPlayersByPosition(position) {
    try {
      const players = await this.playerRepository.findByPosition(position);
      return players;
    } catch (error) {
      throw new AppError(
        `Failed to fetch players for position ${position}`,
        500
      );
    }
  }

  async createPlayer(playerData) {
    try {
      // Generate ID if not provided
      if (!playerData.id) {
        playerData.id =
          playerData.name && playerData.team
            ? generatePlayerId(playerData.name, playerData.team)
            : generateRandomId();
      }

      // Calculate value (points per $1000)
      if (playerData.salary > 0 && playerData.projectedPoints > 0) {
        playerData.value = (
          playerData.projectedPoints /
          (playerData.salary / 1000)
        ).toFixed(2);
      } else {
        playerData.value = 0;
      }

      // Validate required fields
      this.validatePlayerData(playerData);

      const newPlayer = await this.playerRepository.create(playerData);
      return newPlayer;
    } catch (error) {
      if (error.statusCode) throw error;
      throw new AppError("Failed to create player", 500);
    }
  }

  async updatePlayer(id, updateData) {
    try {
      const existingPlayer = await this.playerRepository.findById(id);
      if (!existingPlayer) {
        throw new AppError("Player not found", 404);
      }

      // Recalculate value if salary or projectedPoints changed
      const updatedData = { ...updateData };
      if (updatedData.salary || updatedData.projectedPoints) {
        const salary = updatedData.salary || existingPlayer.salary;
        const projectedPoints =
          updatedData.projectedPoints || existingPlayer.projectedPoints;

        if (salary > 0 && projectedPoints > 0) {
          updatedData.value = (projectedPoints / (salary / 1000)).toFixed(2);
        }
      }

      const updatedPlayer = await this.playerRepository.update(id, updatedData);
      return updatedPlayer;
    } catch (error) {
      if (error.statusCode) throw error;
      throw new AppError("Failed to update player", 500);
    }
  }

  async deletePlayer(id) {
    try {
      const existingPlayer = await this.playerRepository.findById(id);
      if (!existingPlayer) {
        throw new AppError("Player not found", 404);
      }

      await this.playerRepository.delete(id);
      return { success: true, deletedPlayer: existingPlayer };
    } catch (error) {
      if (error.statusCode) throw error;
      throw new AppError("Failed to delete player", 500);
    }
  }

  async deletePlayers(playerIds) {
    try {
      const deletedPlayers = [];
      const notFoundIds = [];

      for (const id of playerIds) {
        try {
          const player = await this.playerRepository.findById(id);
          if (player) {
            await this.playerRepository.delete(id);
            deletedPlayers.push({
              id: player.id,
              name: player.name,
              team: player.team,
              position: player.position,
            });
          } else {
            notFoundIds.push(id);
          }
        } catch (error) {
          notFoundIds.push(id);
        }
      }

      return {
        success: true,
        deletedPlayers,
        notFoundIds: notFoundIds.length > 0 ? notFoundIds : undefined,
        message: `Deleted ${deletedPlayers.length} players successfully`,
      };
    } catch (error) {
      throw new AppError("Failed to delete players", 500);
    }
  }

  async processPlayersCsv(csvData) {
    try {
      const processedPlayers = [];

      for (const playerData of csvData) {
        // Extract data with flexible column naming (from original parsePlayersCSV)
        const player = {
          id:
            playerData.id ||
            playerData.ID ||
            playerData.Id ||
            generateRandomId(),
          name:
            playerData.name ||
            playerData.Name ||
            playerData.PLAYER ||
            playerData.Player ||
            "",
          team: playerData.team || playerData.Team || playerData.TEAM || "",
          position:
            playerData.position ||
            playerData.Position ||
            playerData.POS ||
            playerData.Pos ||
            "",
          projectedPoints:
            parseFloat(
              playerData.projectedPoints ||
                playerData.Proj ||
                playerData.FPTS ||
                playerData.Projection ||
                playerData.Median ||
                0
            ) || 0,
          ownership:
            parseFloat(
              playerData.Own ||
                playerData.OWN ||
                playerData.own ||
                playerData.Ownership ||
                playerData.OWNERSHIP ||
                playerData.ownership ||
                0
            ) || 0,
          salary:
            parseInt(
              playerData.salary || playerData.Salary || playerData.SALARY || 0
            ) || 0,
          opp:
            playerData.opp ||
            playerData.OPP ||
            playerData.Opp ||
            playerData.opponent ||
            playerData.Opponent ||
            "",
        };

        // Only add valid players with a name and projectedPoints > 0
        if (player.name && player.projectedPoints > 0) {
          // Calculate value (points per $1000)
          player.value =
            player.salary > 0
              ? (player.projectedPoints / (player.salary / 1000)).toFixed(2)
              : 0;

          processedPlayers.push(player);
        }
      }

      return processedPlayers;
    } catch (error) {
      throw new AppError("Failed to process players CSV data", 500);
    }
  }

  validatePlayerData(playerData) {
    const errors = [];

    if (!playerData.name || typeof playerData.name !== "string") {
      errors.push("Name is required and must be a string");
    }

    if (!playerData.team || typeof playerData.team !== "string") {
      errors.push("Team is required and must be a string");
    }

    if (!playerData.position || typeof playerData.position !== "string") {
      errors.push("Position is required and must be a string");
    }

    const validPositions = ["TOP", "JNG", "MID", "ADC", "SUP", "TEAM", "CPT"];
    if (playerData.position && !validPositions.includes(playerData.position)) {
      errors.push(`Position must be one of: ${validPositions.join(", ")}`);
    }

    if (typeof playerData.salary !== "number" || playerData.salary < 0) {
      errors.push("Salary must be a non-negative number");
    }

    if (
      typeof playerData.projectedPoints !== "number" ||
      playerData.projectedPoints < 0
    ) {
      errors.push("Projected points must be a non-negative number");
    }

    if (errors.length > 0) {
      throw new AppError(`Player validation failed: ${errors.join(", ")}`, 400);
    }
  }

  async getTeamStats() {
    try {
      const players = await this.playerRepository.findAll();

      if (players.length === 0) {
        throw new AppError("No player projections available", 400);
      }

      // Group players by team
      const teamMap = {};

      players.forEach((player) => {
        if (!player.team) return;

        if (!teamMap[player.team]) {
          teamMap[player.team] = {
            name: player.team,
            players: [],
            totalProjection: 0,
            totalSalary: 0,
          };
        }

        teamMap[player.team].players.push(player);
        teamMap[player.team].totalProjection += Number(
          player.projectedPoints || 0
        );
        teamMap[player.team].totalSalary += Number(player.salary || 0);
      });

      // Calculate averages and additional stats
      const teamStats = Object.values(teamMap).map((team) => {
        const playerCount = team.players.length;
        const ownerships = team.players
          .map((p) => Number(p.ownership || 0))
          .filter((o) => !isNaN(o));

        const avgOwnership =
          ownerships.length > 0
            ? ownerships.reduce((sum, o) => sum + o, 0) / ownerships.length
            : 0;

        // Add positions breakdown
        const positionCounts = {
          TOP: 0,
          JNG: 0,
          MID: 0,
          ADC: 0,
          SUP: 0,
        };

        team.players.forEach((player) => {
          if (
            player.position &&
            positionCounts[player.position] !== undefined
          ) {
            positionCounts[player.position]++;
          }
        });

        return {
          ...team,
          playerCount,
          avgProjection:
            playerCount > 0 ? team.totalProjection / playerCount : 0,
          avgSalary: playerCount > 0 ? team.totalSalary / playerCount : 0,
          avgOwnership,
          positionCounts,
        };
      });

      // Sort by total projection (descending)
      teamStats.sort((a, b) => b.totalProjection - a.totalProjection);

      return teamStats;
    } catch (error) {
      if (error.statusCode) throw error;
      throw new AppError("Failed to calculate team stats", 500);
    }
  }
}

module.exports = PlayerService;
