/**
 * ServiceRegistry
 * Centralized service and repository management to avoid circular dependencies
 */

const PlayerRepository = require("../repositories/PlayerRepository");
const LineupRepository = require("../repositories/LineupRepository");
const TeamStackRepository = require("../repositories/TeamStackRepository");
const PlayerService = require("./PlayerService");
const LineupService = require("./LineupService");
const TeamStackService = require("./TeamStackService");
const FileProcessingService = require("./FileProcessingService");
const OptimizationService = require("./OptimizationService");
const ProgressService = require("./ProgressService");
const SettingsService = require("./SettingsService");
const DataService = require("./DataService");

class ServiceRegistry {
  constructor() {
    this.repositories = {};
    this.services = {};
    this.initialized = false;
  }

  initialize() {
    if (this.initialized) {
      return;
    }

    // Initialize repositories first
    this.repositories.player = new PlayerRepository();
    this.repositories.lineup = new LineupRepository();
    this.repositories.teamStack = new TeamStackRepository();

    // Initialize services with repository dependencies
    this.services.player = new PlayerService(this.repositories.player);
    this.services.lineup = new LineupService(
      this.repositories.lineup,
      this.repositories.player
    );
    this.services.teamStack = new TeamStackService(
      this.repositories.teamStack,
      this.repositories.player
    );
    this.services.fileProcessing = new FileProcessingService();
    this.services.optimization = new OptimizationService(
      this.repositories.lineup,
      this.repositories.player
    );
    this.services.progress = new ProgressService();
    this.services.settings = new SettingsService();
    this.services.data = new DataService(
      this.repositories.player,
      this.repositories.lineup,
      this.repositories.teamStack
    );

    this.initialized = true;
  }

  getRepository(name) {
    if (!this.initialized) {
      this.initialize();
    }
    return this.repositories[name];
  }

  getService(name) {
    if (!this.initialized) {
      this.initialize();
    }
    return this.services[name];
  }

  // Convenience methods
  getPlayerService() {
    return this.getService("player");
  }

  getLineupService() {
    return this.getService("lineup");
  }

  getPlayerRepository() {
    return this.getRepository("player");
  }

  getLineupRepository() {
    return this.getRepository("lineup");
  }

  getTeamStackService() {
    return this.getService("teamStack");
  }

  getTeamStackRepository() {
    return this.getRepository("teamStack");
  }

  getFileProcessingService() {
    return this.getService("fileProcessing");
  }

  getOptimizationService() {
    return this.getService("optimization");
  }

  getProgressService() {
    return this.getService("progress");
  }

  getSettingsService() {
    return this.getService("settings");
  }

  getDataService() {
    return this.getService("data");
  }
}

// Export singleton instance
module.exports = new ServiceRegistry();
