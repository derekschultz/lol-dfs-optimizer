/**
 * OptimizationService
 * Handles lineup optimization using various algorithms and strategies
 */

const AdvancedOptimizer = require("../../client/src/lib/AdvancedOptimizer");
const HybridOptimizer = require("../../client/src/lib/HybridOptimizer");
const { generateRandomId } = require("../utils/generators");
const { AppError } = require("../middleware/errorHandler");

class OptimizationService {
  constructor(lineupRepository, playerRepository) {
    this.lineupRepository = lineupRepository;
    this.playerRepository = playerRepository;
    this.activeOptimizations = new Map(); // Track running optimizations
  }

  /**
   * Generate optimized lineups using advanced algorithm
   */
  async generateLineups(options = {}) {
    const {
      players = [],
      teamStacks = [],
      numLineups = 20,
      algorithm = "advanced",
      exposureLimits = {},
      constraints = {},
      sessionId = null,
    } = options;

    try {
      // Validate input data
      if (!players || players.length === 0) {
        const allPlayers = await this.playerRepository.findAll();
        if (allPlayers.length === 0) {
          throw new AppError("No players available for optimization", 400);
        }
        options.players = allPlayers;
      }

      // Create optimization session
      const optimizationId = generateRandomId();
      this.activeOptimizations.set(optimizationId, {
        status: "running",
        progress: 0,
        startTime: Date.now(),
        sessionId,
      });

      let optimizer;
      let results;

      try {
        switch (algorithm) {
          case "advanced":
            optimizer = new AdvancedOptimizer();
            results = await this._runAdvancedOptimization(optimizer, options);
            break;

          case "hybrid":
            optimizer = new HybridOptimizer({
              fieldSizes: options.contestInfo?.fieldSizes || {},
            });
            results = await this._runHybridOptimization(optimizer, options);
            break;

          default:
            throw new AppError(
              `Unknown optimization algorithm: ${algorithm}`,
              400
            );
        }

        // Update optimization status
        this.activeOptimizations.set(optimizationId, {
          status: "completed",
          progress: 100,
          endTime: Date.now(),
          sessionId,
          results: results.lineups,
        });

        // Store generated lineups (with additional deduplication check)
        const savedLineups = [];
        const existingLineups = await this.lineupRepository.findAll();
        const existingSignatures = new Set();

        // Create signatures for existing lineups
        existingLineups.forEach((lineup) => {
          const allPlayerIds = new Set();
          if (lineup.cpt?.id) allPlayerIds.add(String(lineup.cpt.id));
          if (lineup.players) {
            lineup.players.forEach((p) => {
              if (p?.id) allPlayerIds.add(String(p.id));
            });
          }
          if (allPlayerIds.size > 0) {
            existingSignatures.add(Array.from(allPlayerIds).sort().join("|"));
          }
        });

        for (const lineup of results.lineups) {
          // Check if this lineup composition already exists
          const allPlayerIds = new Set();
          if (lineup.cpt?.id) allPlayerIds.add(String(lineup.cpt.id));
          if (lineup.players) {
            lineup.players.forEach((p) => {
              if (p?.id) allPlayerIds.add(String(p.id));
            });
          }

          const signature = Array.from(allPlayerIds).sort().join("|");

          if (!existingSignatures.has(signature)) {
            const savedLineup = await this.lineupRepository.create({
              ...lineup,
              algorithm,
              optimizationId,
              generatedAt: new Date().toISOString(),
            });
            savedLineups.push(savedLineup);
            existingSignatures.add(signature);
          } else {
            console.log("Skipping duplicate lineup composition:", signature);
          }
        }

        return {
          optimizationId,
          lineups: savedLineups,
          metadata: {
            algorithm,
            generationTime: results.generationTime,
            totalLineups: savedLineups.length,
            averageScore: this._calculateAverageScore(savedLineups),
            exposureStats: this._calculateExposureStats(savedLineups),
          },
        };
      } catch (error) {
        this.activeOptimizations.set(optimizationId, {
          status: "failed",
          error: error.message,
          endTime: Date.now(),
          sessionId,
        });
        throw error;
      }
    } catch (error) {
      throw new AppError(`Optimization failed: ${error.message}`, 500);
    }
  }

  /**
   * Run advanced optimization algorithm
   */
  async _runAdvancedOptimization(optimizer, options) {
    const startTime = Date.now();

    // Configure optimizer
    optimizer.setPlayers(options.players);
    optimizer.setTeamStacks(options.teamStacks || []);
    optimizer.setExposureLimits(options.exposureLimits || {});

    // Apply constraints
    if (options.constraints) {
      Object.entries(options.constraints).forEach(([key, value]) => {
        optimizer.setConstraint(key, value);
      });
    }

    // Generate lineups
    const lineups = await optimizer.generateLineups(options.numLineups);

    return {
      lineups: lineups || [],
      generationTime: Date.now() - startTime,
    };
  }

  /**
   * Run hybrid optimization algorithm
   */
  async _runHybridOptimization(optimizer, options) {
    const startTime = Date.now();

    // Initialize hybrid optimizer with correct parameters
    await optimizer.initialize(
      options.players,
      options.exposureLimits || {},
      [], // existingLineups - empty for fresh generation
      options.contestInfo || {}
    );

    // Generate lineups with hybrid approach
    let result;

    // Check if portfolio mode is requested
    if (options.strategy === "portfolio") {
      // Use the portfolio optimization method
      const portfolioStrategy = {
        config: options.customConfig || {},
      };
      result = await optimizer._runPortfolioOptimization(
        portfolioStrategy,
        options.customConfig || {}
      );
    } else {
      // Use standard optimization
      result = await optimizer.optimize(
        options.numLineups,
        options.strategy || "recommended",
        options.customConfig || {}
      );
    }

    return {
      lineups: result.lineups || [],
      generationTime: Date.now() - startTime,
      summary: result.summary,
      algorithms: result.algorithms,
    };
  }

  /**
   * Get optimization status
   */
  getOptimizationStatus(optimizationId) {
    const optimization = this.activeOptimizations.get(optimizationId);
    if (!optimization) {
      throw new AppError("Optimization not found", 404);
    }
    return optimization;
  }

  /**
   * Cancel running optimization
   */
  cancelOptimization(optimizationId) {
    const optimization = this.activeOptimizations.get(optimizationId);
    if (!optimization) {
      throw new AppError("Optimization not found", 404);
    }

    if (optimization.status === "running") {
      this.activeOptimizations.set(optimizationId, {
        ...optimization,
        status: "cancelled",
        endTime: Date.now(),
      });
      return { message: "Optimization cancelled successfully" };
    }

    throw new AppError(
      `Cannot cancel optimization with status: ${optimization.status}`,
      400
    );
  }

  /**
   * Clean up completed optimizations
   */
  cleanupOptimizations(maxAge = 3600000) {
    // 1 hour default
    const now = Date.now();
    const cleaned = [];

    for (const [id, optimization] of this.activeOptimizations.entries()) {
      const age = now - (optimization.endTime || optimization.startTime);
      if (age > maxAge && optimization.status !== "running") {
        this.activeOptimizations.delete(id);
        cleaned.push(id);
      }
    }

    return { cleaned: cleaned.length };
  }

  /**
   * Initialize hybrid optimizer with strategies
   */
  async initializeHybridOptimizer(options = {}) {
    const {
      players = [],
      teamStacks = [],
      constraints = {},
      strategies = ["genetic", "simulated_annealing"],
    } = options;

    try {
      const optimizer = new HybridOptimizer();

      // Get players and stacks if not provided
      const allPlayers =
        players.length > 0 ? players : await this.playerRepository.getAll();
      const allStacks = teamStacks.length > 0 ? teamStacks : [];

      optimizer.initialize({
        players: allPlayers,
        teamStacks: allStacks,
        constraints,
        strategies,
      });

      const initId = generateRandomId();
      this.activeOptimizations.set(initId, {
        type: "hybrid_init",
        status: "initialized",
        optimizer,
        config: {
          players: allPlayers,
          teamStacks: allStacks,
          constraints,
          strategies,
        },
        createdAt: Date.now(),
      });

      return {
        initializationId: initId,
        status: "initialized",
        playersCount: allPlayers.length,
        stacksCount: allStacks.length,
        availableStrategies: strategies,
      };
    } catch (error) {
      throw new AppError(
        `Hybrid optimizer initialization failed: ${error.message}`,
        500
      );
    }
  }

  /**
   * Get available optimization strategies
   */
  getOptimizationStrategies() {
    return [
      {
        name: "genetic",
        displayName: "Genetic Algorithm",
        description: "Uses evolutionary computation to find optimal lineups",
        parameters: {
          populationSize: { default: 100, min: 50, max: 500 },
          generations: { default: 50, min: 10, max: 200 },
          mutationRate: { default: 0.1, min: 0.01, max: 0.5 },
        },
      },
      {
        name: "simulated_annealing",
        displayName: "Simulated Annealing",
        description: "Uses probabilistic optimization inspired by metallurgy",
        parameters: {
          initialTemp: { default: 1000, min: 100, max: 10000 },
          coolingRate: { default: 0.95, min: 0.8, max: 0.99 },
          minTemp: { default: 1, min: 0.1, max: 10 },
        },
      },
      {
        name: "hybrid",
        displayName: "Hybrid Approach",
        description: "Combines multiple strategies for better results",
        parameters: {
          strategies: { default: ["genetic", "simulated_annealing"] },
          iterations: { default: 1000, min: 100, max: 5000 },
        },
      },
    ];
  }

  /**
   * Generate lineups using hybrid optimizer
   */
  async generateHybridLineups(initId, options = {}) {
    const optimization = this.activeOptimizations.get(initId);
    if (!optimization || optimization.type !== "hybrid_init") {
      throw new AppError(
        "Invalid initialization ID or optimizer not initialized",
        400
      );
    }

    const {
      numLineups = 20,
      strategy = "hybrid",
      strategyParams = {},
      sessionId = null,
    } = options;

    try {
      const optimizer = optimization.optimizer;
      const startTime = Date.now();

      // Update status to running
      this.activeOptimizations.set(initId, {
        ...optimization,
        status: "running",
        startTime,
        sessionId,
        progress: 0,
      });

      // Configure strategy
      optimizer.setStrategy(strategy, strategyParams);

      // Generate lineups with progress tracking
      const lineups = await optimizer.optimize({
        numLineups,
        progressCallback: (progress) => {
          this.activeOptimizations.set(initId, {
            ...this.activeOptimizations.get(initId),
            progress,
          });
        },
      });

      // Update final status
      this.activeOptimizations.set(initId, {
        ...optimization,
        status: "completed",
        endTime: Date.now(),
        progress: 100,
        results: lineups,
      });

      // Store generated lineups
      const savedLineups = [];
      for (const lineup of lineups) {
        const savedLineup = await this.lineupRepository.create({
          ...lineup,
          algorithm: "hybrid",
          strategy,
          optimizationId: initId,
          generatedAt: new Date().toISOString(),
        });
        savedLineups.push(savedLineup);
      }

      return {
        optimizationId: initId,
        lineups: savedLineups,
        metadata: {
          algorithm: "hybrid",
          strategy,
          generationTime: Date.now() - startTime,
          totalLineups: savedLineups.length,
        },
      };
    } catch (error) {
      this.activeOptimizations.set(initId, {
        ...optimization,
        status: "failed",
        error: error.message,
        endTime: Date.now(),
      });
      throw new AppError(`Hybrid optimization failed: ${error.message}`, 500);
    }
  }

  /**
   * Get optimizer statistics
   */
  async getOptimizerStats() {
    const allLineups = await this.lineupRepository.getAll();
    const allPlayers = await this.playerRepository.getAll();

    const stats = {
      totalLineups: allLineups.length,
      totalPlayers: allPlayers.length,
      optimizationRuns: this.activeOptimizations.size,
      algorithms: {},
      averageScore: 0,
      lastOptimization: null,
    };

    // Calculate algorithm usage
    allLineups.forEach((lineup) => {
      const algo = lineup.algorithm || "unknown";
      stats.algorithms[algo] = (stats.algorithms[algo] || 0) + 1;
    });

    // Calculate average score
    if (allLineups.length > 0) {
      const totalScore = allLineups.reduce(
        (sum, lineup) => sum + (lineup.projectedScore || 0),
        0
      );
      stats.averageScore = totalScore / allLineups.length;
    }

    // Get last optimization
    const optimizations = Array.from(this.activeOptimizations.values());
    if (optimizations.length > 0) {
      const latest = optimizations.reduce((latest, opt) =>
        (opt.startTime || 0) > (latest.startTime || 0) ? opt : latest
      );
      stats.lastOptimization = {
        status: latest.status,
        time: latest.startTime,
        duration: latest.endTime ? latest.endTime - latest.startTime : null,
      };
    }

    return stats;
  }

  /**
   * Run Monte Carlo simulation on lineups
   */
  async runSimulation(lineupIds, options = {}) {
    const {
      iterations = 1000,
      fieldSize = 1176,
      payoutStructure = null,
    } = options;

    try {
      // Get lineups for simulation
      const lineups = [];
      for (const id of lineupIds) {
        const lineup = await this.lineupRepository.getById(id);
        if (lineup) {
          lineups.push(lineup);
        }
      }

      if (lineups.length === 0) {
        throw new AppError("No valid lineups found for simulation", 400);
      }

      // Run simulation
      const simulationResults = await this._runMonteCarloSimulation(
        lineups,
        iterations,
        fieldSize,
        payoutStructure
      );

      return {
        lineups: simulationResults,
        metadata: {
          iterations,
          fieldSize,
          simulationDate: new Date().toISOString(),
          averageWinRate: this._calculateAverageWinRate(simulationResults),
          topPerformers: this._getTopPerformers(simulationResults, 5),
        },
      };
    } catch (error) {
      throw new AppError(`Simulation failed: ${error.message}`, 500);
    }
  }

  /**
   * Run Monte Carlo simulation
   */
  async _runMonteCarloSimulation(
    lineups,
    iterations,
    fieldSize,
    payoutStructure
  ) {
    const results = lineups.map((lineup) => ({
      ...lineup,
      wins: 0,
      totalPayout: 0,
      averageRank: 0,
      roi: 0,
      simulationScores: [],
    }));

    for (let i = 0; i < iterations; i++) {
      // Simulate scores for each lineup
      const simulatedScores = results.map((lineup) => {
        const variance = this._calculateLineupVariance(lineup);
        const score = this._simulateScore(lineup.projectedScore, variance);
        return { lineup, score };
      });

      // Sort by score (descending)
      simulatedScores.sort((a, b) => b.score - a.score);

      // Update results
      simulatedScores.forEach((entry, rank) => {
        const result = results.find((r) => r.id === entry.lineup.id);
        result.simulationScores.push(entry.score);
        result.averageRank += rank + 1;

        // Calculate wins and payouts
        if (rank === 0) result.wins++;
        if (payoutStructure && rank < payoutStructure.length) {
          result.totalPayout += payoutStructure[rank];
        }
      });
    }

    // Finalize calculations
    results.forEach((result) => {
      result.averageRank /= iterations;
      result.winRate = (result.wins / iterations) * 100;
      result.averageScore =
        result.simulationScores.reduce((a, b) => a + b, 0) /
        result.simulationScores.length;
      result.scoreVariance = this._calculateVariance(result.simulationScores);
      result.roi = payoutStructure
        ? (result.totalPayout / iterations - 1) * 100
        : 0;
    });

    return results;
  }

  /**
   * Calculate average score across lineups
   */
  _calculateAverageScore(lineups) {
    if (lineups.length === 0) return 0;
    const total = lineups.reduce(
      (sum, lineup) => sum + (lineup.projectedScore || 0),
      0
    );
    return total / lineups.length;
  }

  /**
   * Calculate exposure statistics
   */
  _calculateExposureStats(lineups) {
    const playerExposure = {};
    const teamExposure = {};

    lineups.forEach((lineup) => {
      lineup.players?.forEach((player) => {
        playerExposure[player.name] = (playerExposure[player.name] || 0) + 1;
        teamExposure[player.team] = (teamExposure[player.team] || 0) + 1;
      });
    });

    const totalLineups = lineups.length;
    const exposureStats = {
      players: Object.entries(playerExposure)
        .map(([name, count]) => ({
          name,
          exposure: (count / totalLineups) * 100,
        }))
        .sort((a, b) => b.exposure - a.exposure),
      teams: Object.entries(teamExposure)
        .map(([team, count]) => ({
          team,
          exposure: (count / totalLineups) * 100,
        }))
        .sort((a, b) => b.exposure - a.exposure),
    };

    return exposureStats;
  }

  /**
   * Calculate lineup variance for simulation
   */
  _calculateLineupVariance(lineup) {
    // Base variance calculation - could be enhanced with historical data
    const baseVariance = 0.15; // 15% standard variance
    const playerCount = lineup.players?.length || 5;
    return baseVariance * Math.sqrt(playerCount);
  }

  /**
   * Simulate a score with variance
   */
  _simulateScore(projectedScore, variance) {
    const random = this._generateNormalRandom();
    return projectedScore + projectedScore * variance * random;
  }

  /**
   * Generate normal random number (Box-Muller transform)
   */
  _generateNormalRandom() {
    if (this.spareRandom !== undefined) {
      const spare = this.spareRandom;
      delete this.spareRandom;
      return spare;
    }

    const u = Math.random();
    const v = Math.random();
    const mag = Math.sqrt(-2.0 * Math.log(u));
    this.spareRandom = mag * Math.cos(2.0 * Math.PI * v);
    return mag * Math.sin(2.0 * Math.PI * v);
  }

  /**
   * Calculate variance of an array
   */
  _calculateVariance(values) {
    const mean = values.reduce((a, b) => a + b, 0) / values.length;
    const squaredDiffs = values.map((value) => Math.pow(value - mean, 2));
    return squaredDiffs.reduce((a, b) => a + b, 0) / values.length;
  }

  /**
   * Calculate average win rate
   */
  _calculateAverageWinRate(results) {
    if (results.length === 0) return 0;
    const total = results.reduce(
      (sum, result) => sum + (result.winRate || 0),
      0
    );
    return total / results.length;
  }

  /**
   * Get top performing lineups
   */
  _getTopPerformers(results, count = 5) {
    return results
      .sort((a, b) => (b.winRate || 0) - (a.winRate || 0))
      .slice(0, count)
      .map((result) => ({
        id: result.id,
        winRate: result.winRate,
        averageScore: result.averageScore,
        roi: result.roi,
      }));
  }

  /**
   * Get active optimizations
   */
  getActiveOptimizations() {
    return Array.from(this.activeOptimizations.entries()).map(
      ([id, optimization]) => ({
        id,
        ...optimization,
      })
    );
  }
}

module.exports = OptimizationService;
