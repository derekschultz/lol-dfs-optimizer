/**
 * Hybrid Optimizer v2.0 for LoL DFS
 *
 * Intelligently combines multiple optimization algorithms:
 * - Contest-aware algorithm selection
 * - Strategy preset management
 * - Learning system for performance tracking
 * - Automatic algorithm mixing for optimal results
 *
 * Features:
 * - Monte Carlo for consistent lineups
 * - Genetic Algorithm for exploration
 * - Simulated Annealing for constraint satisfaction
 * - Smart defaults based on contest type and constraints
 */

const AdvancedOptimizer = require("./AdvancedOptimizer");
const GeneticOptimizer = require("./GeneticOptimizer");
const SimulatedAnnealingOptimizer = require("./SimulatedAnnealingOptimizer");
const DataValidator = require("./DataValidator");

class HybridOptimizer {
  constructor(config = {}) {
    this.config = {
      // Default field size for different contest types
      fieldSizes: {
        cash: 100,
        double_up: 200,
        gpp: 1000,
        satellite: 500,
        single_entry: 150000,
        ...config.fieldSizes,
      },

      // Learning system configuration
      learning: {
        enabled: true,
        trackPerformance: true,
        adaptRecommendations: true,
        historySize: 100,
        ...config.learning,
      },

      // Algorithm performance tracking
      performanceWeights: {
        monte_carlo: 1.0,
        genetic: 1.0,
        simulated_annealing: 1.0,
        ...config.performanceWeights,
      },

      ...config,
    };

    // Strategy presets
    this.presets = this._initializePresets();

    // Performance tracking
    this.performanceHistory = this._loadPerformanceHistory();

    // Active optimizers
    this.optimizers = {
      monte_carlo: null,
      genetic: null,
      simulated_annealing: null,
    };

    // Current optimization state
    this.isInitialized = false;
    this.currentStrategy = null;
    this.recommendedAlgorithm = null;

    // Progress tracking
    this.onProgress = null;
    this.onStatusUpdate = null;
    this.isCancelled = false;
  }

  /**
   * Initialize strategy presets
   */
  _initializePresets() {
    return {
      recommended: {
        name: "Recommended",
        description:
          "Smart algorithm selection based on your contest and constraints",
        algorithm: "auto",
        config: {},
        usage: "Auto-selects the best approach for your specific situation",
      },

      balanced: {
        name: "Balanced",
        description: "Reliable lineups with good upside potential",
        algorithm: "hybrid",
        distribution: {
          monte_carlo: 0.6,
          genetic: 0.3,
          simulated_annealing: 0.1,
        },
        config: {
          iterations: 8000,
          randomness: 0.5, // Increased randomness to prevent duplicates
          leverageMultiplier: 0.8,
          genetic: { generations: 30, populationSize: 60 },
        },
        usage: "General purpose optimization for most contests",
      },

      cash_game: {
        name: "Cash Game",
        description: "Consistent scoring for cash games and double-ups",
        algorithm: "monte_carlo",
        config: {
          iterations: 12000,
          randomness: 0.4, // Increased for more diversity
          leverageMultiplier: 0.4,
          targetTop: 0.5, // Target top 50% instead of 10%
          correlation: { sameTeam: 0.8, opposingTeam: -0.1 }, // Higher same-team correlation
        },
        usage: "Optimized for consistent cashing in cash games",
      },

      tournament: {
        name: "Tournament/GPP",
        description: "High-ceiling lineups for large field tournaments",
        algorithm: "genetic",
        config: {
          genetic: {
            populationSize: 120,
            generations: 60,
            mutationRate: 0.2,
            diversityWeight: 0.4,
          },
          leverageMultiplier: 1.3,
          randomness: 0.4,
          targetTop: 0.05, // Target top 5%
        },
        usage: "Designed for GPPs and large tournaments",
      },

      contrarian: {
        name: "Contrarian",
        description: "Low-owned players and unique stacks for differentiation",
        algorithm: "genetic",
        config: {
          genetic: {
            populationSize: 100,
            generations: 50,
            mutationRate: 0.25,
          },
          leverageMultiplier: 2.0,
          randomness: 0.5,
          targetTop: 0.02, // Target top 2%
        },
        usage: "Maximum differentiation from the field",
      },

      constraint_focused: {
        name: "Constraint Optimizer",
        description: "Perfect for complex exposure and stacking requirements",
        algorithm: "simulated_annealing",
        config: {
          annealing: {
            initialTemperature: 1500,
            maxIterations: 15000,
            neighborhoodSize: 8,
          },
          leverageMultiplier: 0.6,
        },
        usage: "Best when you have detailed exposure constraints",
      },
    };
  }

  /**
   * Set progress callback
   */
  setProgressCallback(callback) {
    this.onProgress = callback;
  }

  /**
   * Set status callback
   */
  setStatusCallback(callback) {
    this.onStatusUpdate = callback;
  }

  /**
   * Cancel current operations
   */
  cancel() {
    this.isCancelled = true;
    Object.values(this.optimizers).forEach((optimizer) => {
      if (optimizer && typeof optimizer.cancel === "function") {
        optimizer.cancel();
      }
    });
  }

  /**
   * Initialize the hybrid optimizer
   */
  async initialize(
    playerPool,
    exposureSettings = {},
    existingLineups = [],
    contestInfo = {}
  ) {
    this.updateStatus("Initializing hybrid optimizer...");
    this.updateProgress(0, "validation");

    try {
      // Phase 1: Data validation (20% of progress)
      const validator = new DataValidator();
      const validationResult = validator.validatePlayerPool(playerPool);

      if (!validationResult.isValid) {
        throw new Error(
          `Data validation failed: ${validationResult.errors.join(", ")}`
        );
      }

      this.updateProgress(20, "analyzing_constraints");
      this.updateStatus("Analyzing optimization constraints...");

      // Phase 2: Analyze constraints and recommend strategy (20% of progress)
      const constraintAnalysis = this._analyzeConstraints(
        exposureSettings,
        contestInfo
      );
      this.recommendedAlgorithm = this._selectOptimalAlgorithm(
        constraintAnalysis,
        contestInfo
      );

      this.updateProgress(40, "initializing_optimizers");
      this.updateStatus("Initializing optimization algorithms...");

      // Phase 3: Initialize optimizers (40% of progress)
      await this._initializeOptimizers(
        playerPool,
        exposureSettings,
        existingLineups,
        constraintAnalysis
      );

      this.updateProgress(80, "finalizing");
      this.updateStatus("Finalizing hybrid optimizer...");

      // Phase 4: Store context and finalize (20% of progress)
      this.playerPool = playerPool;
      this.exposureSettings = exposureSettings;
      this.existingLineups = existingLineups;
      this.contestInfo = contestInfo;
      this.constraintAnalysis = constraintAnalysis;

      this.isInitialized = true;
      this.updateProgress(100, "ready");
      this.updateStatus("Hybrid optimizer ready");

      return {
        success: true,
        recommendedStrategy: this.recommendedAlgorithm,
        constraintComplexity: constraintAnalysis.complexityScore,
        availablePresets: Object.keys(this.presets),
      };
    } catch (error) {
      this.updateStatus(`Initialization error: ${error.message}`);
      this.updateProgress(100, "error");
      throw error;
    }
  }

  /**
   * Run optimization with specified strategy
   */
  async optimize(count = 100, strategy = "recommended", customConfig = {}) {
    if (!this.isInitialized) {
      throw new Error(
        "Hybrid optimizer not initialized. Call initialize() first."
      );
    }

    this.updateStatus(`Starting optimization: ${strategy} strategy`);
    this.updateProgress(0, "starting");

    try {
      // Resolve strategy to actual algorithm(s)
      const resolvedStrategy = this._resolveStrategy(strategy);
      this.currentStrategy = resolvedStrategy;

      let results;

      if (resolvedStrategy.algorithm === "hybrid") {
        results = await this._runHybridOptimization(
          count,
          resolvedStrategy,
          customConfig
        );
      } else {
        results = await this._runSingleAlgorithm(
          count,
          resolvedStrategy,
          customConfig
        );
      }

      // Track performance for learning system
      if (this.config.learning.enabled) {
        this._trackPerformance(strategy, resolvedStrategy, results);
      }

      this.updateProgress(100, "completed");
      this.updateStatus(
        `Optimization completed: ${results.lineups.length} lineups generated`
      );

      return {
        ...results,
        strategy: resolvedStrategy,
        recommendation: this._generateRecommendations(results),
      };
    } catch (error) {
      this.updateStatus(`Optimization error: ${error.message}`);
      this.updateProgress(100, "error");
      throw error;
    }
  }

  /**
   * Get available strategies with recommendations
   */
  getStrategies() {
    const strategies = {};

    Object.entries(this.presets).forEach(([key, preset]) => {
      const performanceData = this._getStrategyPerformance(key);

      strategies[key] = {
        ...preset,
        recommended: key === "recommended", // Always mark 'recommended' strategy as recommended
        performance: performanceData,
        suitable: this._isStrategySuitable(key),
      };
    });

    return strategies;
  }

  /**
   * Analyze constraint complexity
   */
  _analyzeConstraints(exposureSettings, contestInfo) {
    let complexityScore = 0;
    const analysis = {
      hasPlayerConstraints: false,
      hasTeamConstraints: false,
      hasStackConstraints: false,
      constraintCount: 0,
      complexityScore: 0,
      contestType: contestInfo.type || "unknown",
      fieldSize: contestInfo.fieldSize || 1000,
    };

    // Player exposure constraints
    if (exposureSettings.players && exposureSettings.players.length > 0) {
      const activeConstraints = exposureSettings.players.filter(
        (p) =>
          (p.min !== undefined && p.min > 0) ||
          (p.max !== undefined && p.max < 100)
      );
      analysis.hasPlayerConstraints = activeConstraints.length > 0;
      analysis.constraintCount += activeConstraints.length;
      complexityScore += activeConstraints.length * 1.5;
    }

    // Team exposure constraints
    if (exposureSettings.teams && exposureSettings.teams.length > 0) {
      const activeTeamConstraints = exposureSettings.teams.filter(
        (t) =>
          (t.min !== undefined && t.min > 0) ||
          (t.max !== undefined && t.max < 100) ||
          t.stackSize !== undefined
      );
      analysis.hasTeamConstraints = activeTeamConstraints.length > 0;
      analysis.constraintCount += activeTeamConstraints.length;
      complexityScore += activeTeamConstraints.length * 2;

      // Stack-specific constraints are more complex
      const stackConstraints = activeTeamConstraints.filter(
        (t) => t.stackSize !== undefined
      );
      analysis.hasStackConstraints = stackConstraints.length > 0;
      complexityScore += stackConstraints.length * 3;
    }

    // Position constraints
    if (exposureSettings.positions) {
      const positionConstraints = Object.keys(
        exposureSettings.positions
      ).length;
      analysis.constraintCount += positionConstraints;
      complexityScore += positionConstraints * 1;
    }

    // Contest type complexity
    switch (contestInfo.type) {
      case "cash":
      case "double_up":
        complexityScore += 1; // Simple optimization
        break;
      case "gpp":
      case "tournament":
        complexityScore += 3; // Need differentiation
        break;
      case "single_entry":
        complexityScore += 5; // Maximum differentiation
        break;
    }

    // Field size complexity
    if (analysis.fieldSize > 10000) {
      complexityScore += 2;
    } else if (analysis.fieldSize > 1000) {
      complexityScore += 1;
    }

    analysis.complexityScore = complexityScore;
    return analysis;
  }

  /**
   * Select optimal algorithm based on analysis
   */
  _selectOptimalAlgorithm(constraintAnalysis, contestInfo) {
    const {
      complexityScore,
      contestType,
      hasStackConstraints,
      constraintCount,
    } = constraintAnalysis;

    // Always return 'recommended' as the default - the UI will show this as recommended
    // The actual algorithm selection happens in the 'recommended' preset logic
    return "recommended";
  }

  /**
   * Initialize optimizer instances
   */
  async _initializeOptimizers(
    playerPool,
    exposureSettings,
    existingLineups,
    constraintAnalysis
  ) {
    const baseConfig = {
      salaryCap: 50000,
      positionRequirements: {
        CPT: 1,
        TOP: 1,
        JNG: 1,
        MID: 1,
        ADC: 1,
        SUP: 1,
        TEAM: 1,
      },
      fieldSize: constraintAnalysis.fieldSize || 1000,
      debugMode: true, // Enable debug mode to track duplicate issues
    };

    const progressStep = 40 / 3; // 40% progress divided by 3 optimizers

    // Initialize Monte Carlo optimizer
    this.updateStatus("Initializing Monte Carlo optimizer...");
    this.optimizers.monte_carlo = new AdvancedOptimizer(baseConfig);
    this._setupOptimizerCallbacks(this.optimizers.monte_carlo);
    await this.optimizers.monte_carlo.initialize(
      playerPool,
      exposureSettings,
      existingLineups
    );
    this.updateProgress(40 + progressStep, "monte_carlo_ready");

    // Initialize Genetic optimizer
    this.updateStatus("Initializing Genetic optimizer...");
    this.optimizers.genetic = new GeneticOptimizer(baseConfig);
    this._setupOptimizerCallbacks(this.optimizers.genetic);
    await this.optimizers.genetic.initialize(
      playerPool,
      exposureSettings,
      existingLineups
    );
    this.updateProgress(40 + progressStep * 2, "genetic_ready");

    // Initialize Simulated Annealing optimizer
    this.updateStatus("Initializing Simulated Annealing optimizer...");
    this.optimizers.simulated_annealing = new SimulatedAnnealingOptimizer(
      baseConfig
    );
    this._setupOptimizerCallbacks(this.optimizers.simulated_annealing);
    await this.optimizers.simulated_annealing.initialize(
      playerPool,
      exposureSettings,
      existingLineups
    );
    this.updateProgress(80, "all_optimizers_ready");
  }

  /**
   * Setup callbacks for individual optimizers
   */
  _setupOptimizerCallbacks(optimizer) {
    if (optimizer.setProgressCallback) {
      optimizer.setProgressCallback((progress, stage) => {
        // Don't override main progress during initialization
        if (this.isInitialized) {
          this.updateProgress(progress, stage);
        }
      });
    }

    if (optimizer.setStatusCallback) {
      optimizer.setStatusCallback((status) => {
        // Don't override main status during initialization
        if (this.isInitialized) {
          this.updateStatus(status);
        }
      });
    }
  }

  /**
   * Resolve strategy name to configuration
   */
  _resolveStrategy(strategyName) {
    if (strategyName === "recommended") {
      // Smart algorithm selection based on contest and constraint analysis
      const optimalStrategy = this._getOptimalStrategyForContext();
      strategyName = optimalStrategy;
    }

    const preset = this.presets[strategyName];
    if (!preset) {
      throw new Error(`Unknown strategy: ${strategyName}`);
    }

    return { ...preset, name: strategyName };
  }

  /**
   * Get optimal strategy based on current context
   */
  _getOptimalStrategyForContext() {
    const {
      complexityScore,
      contestType,
      hasStackConstraints,
      constraintCount,
    } = this.constraintAnalysis || {};
    const fieldSize = this.contestInfo?.fieldSize || 1000;

    // High constraint complexity - use constraint-focused approach
    if (constraintCount > 5 || complexityScore > 15) {
      return "constraint_focused";
    }

    // Contest-specific recommendations
    switch (contestType) {
      case "cash":
      case "double_up":
        return "cash_game";
      case "gpp":
      case "tournament":
        return fieldSize > 5000 ? "contrarian" : "tournament";
    }

    // Field size considerations
    if (fieldSize < 100) {
      return "cash_game"; // Small field, play it safe
    } else if (fieldSize > 10000) {
      return "contrarian"; // Large field, need differentiation
    }

    // Default to balanced approach
    return "balanced";
  }

  /**
   * Run hybrid optimization (mix of algorithms)
   */
  async _runHybridOptimization(count, strategy, customConfig) {
    const distribution = strategy.distribution || {
      monte_carlo: 0.6,
      genetic: 0.3,
      simulated_annealing: 0.1,
    };
    const results = [];

    let totalProgress = 0;
    const algorithmKeys = Object.keys(distribution);

    for (const [algorithm, percentage] of Object.entries(distribution)) {
      if (this.isCancelled) throw new Error("Hybrid optimization cancelled");

      const algorithmCount = Math.round(count * percentage);
      if (algorithmCount === 0) continue;

      this.updateStatus(
        `Running ${algorithm} optimization (${algorithmCount} lineups)...`
      );

      try {
        const optimizer = this.optimizers[algorithm];
        if (!optimizer) {
          console.warn(`Optimizer ${algorithm} not available, skipping...`);
          continue;
        }

        // Merge strategy config with custom config
        const algorithmConfig = {
          ...strategy.config,
          ...customConfig,
          [algorithm]: {
            ...strategy.config?.[algorithm],
            ...customConfig[algorithm],
          },
        };

        let algorithmResults;

        if (algorithm === "monte_carlo") {
          algorithmResults = await optimizer.runSimulation(algorithmCount);
        } else if (algorithm === "genetic") {
          algorithmResults = await optimizer.runGeneticOptimization(
            algorithmCount
          );
        } else if (algorithm === "simulated_annealing") {
          algorithmResults = await optimizer.runSimulatedAnnealing(
            algorithmCount
          );
        }

        if (algorithmResults && algorithmResults.lineups) {
          // Tag lineups with their source algorithm
          algorithmResults.lineups.forEach((lineup) => {
            lineup.sourceAlgorithm = algorithm;
          });

          results.push(...algorithmResults.lineups);
        }
      } catch (error) {
        console.error(`Error running ${algorithm} optimization:`, error);
        // Continue with other algorithms
      }

      totalProgress += 100 / algorithmKeys.length;
      this.updateProgress(
        Math.min(95, totalProgress),
        `${algorithm}_completed`
      );
    }

    // Combine and rank results
    this.updateStatus("Combining and ranking results...");
    const combinedResults = this._combineResults(results, count);

    return {
      lineups: combinedResults,
      summary: this._generateHybridSummary(combinedResults, distribution),
      algorithms: Object.keys(distribution),
    };
  }

  /**
   * Run portfolio optimization
   */
  async _runPortfolioOptimization(strategy, customConfig) {
    const config = { ...strategy.config, ...customConfig };
    const portfolioSize = config.portfolioSize || 20;
    const bulkCount = portfolioSize * (config.bulkGenerationMultiplier || 25);

    this.updateStatus(
      `Generating ${bulkCount} lineup candidates for portfolio...`
    );

    // Generate bulk lineups using hybrid approach
    const bulkResults = await this._runHybridOptimization(
      bulkCount,
      strategy,
      customConfig
    );

    if (
      !bulkResults ||
      !bulkResults.lineups ||
      bulkResults.lineups.length === 0
    ) {
      throw new Error("Failed to generate bulk lineups for portfolio");
    }

    this.updateStatus("Calculating NexusScore for all candidates...");

    // Calculate NexusScore for all lineups
    const candidates = bulkResults.lineups.map((lineup) => {
      const nexusResult = this._calculateNexusScore(lineup);
      lineup.nexusScore = nexusResult.score;
      lineup.scoreComponents = nexusResult.components;
      lineup.avgOwnership = this._calculateLineupOwnership(lineup);
      lineup.stackType = this._classifyLineupStackType(lineup);
      lineup.barbellCategory = this._classifyBarbellCategory(lineup);
      return lineup;
    });

    this.updateStatus(
      "Selecting portfolio lineups with barbell distribution..."
    );

    // Select portfolio with barbell distribution
    const portfolio = this._selectBarbellPortfolio(candidates, config);

    console.log(`🏆 Portfolio created: ${portfolio.length} lineups`);
    console.log(
      `   - High-floor: ${
        portfolio.filter((l) => l.barbellCategory === "highFloor").length
      }`
    );
    console.log(
      `   - High-ceiling: ${
        portfolio.filter((l) => l.barbellCategory === "highCeiling").length
      }`
    );
    console.log(
      `   - Balanced: ${
        portfolio.filter((l) => l.barbellCategory === "balanced").length
      }`
    );
    console.log(
      `   - 4-3 stacks: ${
        portfolio.filter((l) => l.stackType === "4-3").length
      }`
    );
    console.log(
      `   - 4-2-1 stacks: ${
        portfolio.filter((l) => l.stackType === "4-2-1").length
      }`
    );
    console.log(
      `   - NexusScore range: ${Math.min(
        ...portfolio.map((l) => l.nexusScore)
      ).toFixed(1)} to ${Math.max(
        ...portfolio.map((l) => l.nexusScore)
      ).toFixed(1)}`
    );

    return {
      lineups: portfolio,
      summary: this._generatePortfolioSummary(portfolio, config),
      algorithm: "portfolio",
      portfolioStats: this._calculatePortfolioStats(portfolio),
    };
  }

  /**
   * Run single algorithm optimization
   */
  async _runSingleAlgorithm(count, strategy, customConfig) {
    const algorithm = strategy.algorithm;
    const optimizer = this.optimizers[algorithm];

    if (!optimizer) {
      throw new Error(`Optimizer ${algorithm} not available`);
    }

    // Merge configs
    const algorithmConfig = {
      ...strategy.config,
      ...customConfig,
    };

    // Apply config to optimizer if possible
    if (algorithmConfig && typeof optimizer.updateConfig === "function") {
      optimizer.updateConfig(algorithmConfig);
    }

    let results;

    switch (algorithm) {
      case "monte_carlo":
        results = await optimizer.runSimulation(count);
        break;
      case "genetic":
        results = await optimizer.runGeneticOptimization(count);
        break;
      case "simulated_annealing":
        results = await optimizer.runSimulatedAnnealing(count);
        break;
      default:
        throw new Error(`Unsupported algorithm: ${algorithm}`);
    }

    // Tag lineups with source algorithm
    if (results && results.lineups) {
      results.lineups.forEach((lineup) => {
        lineup.sourceAlgorithm = algorithm;
      });
    }

    return results;
  }

  /**
   * Combine results from multiple algorithms
   */
  _combineResults(results, targetCount) {
    if (results.length === 0) return [];

    // Sort all results by their best available score
    results.sort((a, b) => {
      const scoreA =
        a.nexusScore || a.roi || a.geneticFitness || a.annealingScore || 0;
      const scoreB =
        b.nexusScore || b.roi || b.geneticFitness || b.annealingScore || 0;
      return scoreB - scoreA;
    });

    // Remove duplicates (same player combination)
    const uniqueResults = [];
    const seenLineups = new Set();

    for (const lineup of results) {
      const playerIds = [lineup.cpt?.id, ...lineup.players.map((p) => p.id)];
      const lineupSignature = playerIds.sort().join("|");

      if (!seenLineups.has(lineupSignature)) {
        seenLineups.add(lineupSignature);
        uniqueResults.push(lineup);

        if (uniqueResults.length >= targetCount) break;
      }
    }

    return uniqueResults.slice(0, targetCount);
  }

  /**
   * Generate hybrid summary
   */
  _generateHybridSummary(results, distribution) {
    const algorithmCounts = {};
    results.forEach((lineup) => {
      const algo = lineup.sourceAlgorithm || "unknown";
      algorithmCounts[algo] = (algorithmCounts[algo] || 0) + 1;
    });

    const avgROI =
      results.reduce((sum, r) => sum + (r.roi || 0), 0) /
      Math.max(1, results.length);
    const avgNexusScore =
      results.reduce((sum, r) => sum + (r.nexusScore || 0), 0) /
      Math.max(1, results.length);

    return {
      algorithm: "hybrid",
      distribution: distribution,
      actualDistribution: algorithmCounts,
      averageROI: avgROI,
      averageNexusScore: avgNexusScore,
      uniqueLineups: results.length,
      diversityScore: this._calculateDiversityScore(results),
    };
  }

  /**
   * Calculate diversity score for lineups
   */
  _calculateDiversityScore(lineups) {
    if (lineups.length < 2) return 0;

    let totalDistance = 0;
    let comparisons = 0;

    for (let i = 0; i < Math.min(lineups.length, 50); i++) {
      // Sample for performance
      for (let j = i + 1; j < Math.min(lineups.length, 50); j++) {
        const distance = this._calculateLineupDistance(lineups[i], lineups[j]);
        totalDistance += distance;
        comparisons++;
      }
    }

    return comparisons > 0 ? totalDistance / comparisons : 0;
  }

  /**
   * Calculate NexusScore for a lineup
   */
  _calculateNexusScore(lineup) {
    // Use AdvancedOptimizer's NexusScore calculation if available
    if (
      this.optimizers.monte_carlo &&
      typeof this.optimizers.monte_carlo._calculateNexusScore === "function"
    ) {
      return this.optimizers.monte_carlo._calculateNexusScore(lineup);
    }

    // Fallback simple calculation
    let baseProjection = 0;
    if (lineup.cpt) {
      baseProjection += (lineup.cpt.projection || 0) * 1.5;
    }
    if (lineup.players) {
      baseProjection += lineup.players.reduce(
        (sum, p) => sum + (p.projection || 0),
        0
      );
    }

    return { score: baseProjection, components: { baseProjection } };
  }

  /**
   * Calculate lineup ownership percentage
   */
  _calculateLineupOwnership(lineup) {
    let totalOwnership = 0;
    let playerCount = 0;

    if (lineup.cpt && lineup.cpt.ownership !== undefined) {
      totalOwnership += parseFloat(lineup.cpt.ownership) || 0;
      playerCount++;
    }

    if (lineup.players) {
      lineup.players.forEach((player) => {
        if (player.ownership !== undefined) {
          totalOwnership += parseFloat(player.ownership) || 0;
          playerCount++;
        }
      });
    }

    return playerCount > 0 ? totalOwnership / playerCount : 0;
  }

  /**
   * Classify lineup stack type based on team distribution
   */
  _classifyLineupStackType(lineup) {
    const teamCounts = {};

    // Count captain
    if (lineup.cpt && lineup.cpt.team) {
      teamCounts[lineup.cpt.team] = (teamCounts[lineup.cpt.team] || 0) + 1;
    }

    // Count flex players
    if (lineup.players) {
      lineup.players.forEach((player) => {
        if (player.team) {
          teamCounts[player.team] = (teamCounts[player.team] || 0) + 1;
        }
      });
    }

    // Get sorted team counts
    const counts = Object.values(teamCounts).sort((a, b) => b - a);

    // Classify based on distribution pattern
    if (counts.length >= 2 && counts[0] === 4 && counts[1] === 3) {
      return "4-3";
    } else if (
      counts.length >= 3 &&
      counts[0] === 4 &&
      counts[1] === 2 &&
      counts[2] === 1
    ) {
      return "4-2-1";
    } else if (counts.length >= 2 && counts[0] >= 4) {
      return "4-3";
    } else {
      return "4-2-1";
    }
  }

  /**
   * Classify lineup into barbell category
   */
  _classifyBarbellCategory(lineup) {
    const ownership =
      lineup.avgOwnership || this._calculateLineupOwnership(lineup);

    // High-floor: chalk/safe lineups (high ownership)
    if (ownership >= 15) {
      return "highFloor";
    }
    // High-ceiling: contrarian lineups (low ownership)
    else if (ownership <= 8) {
      return "highCeiling";
    }
    // Balanced: medium ownership
    else {
      return "balanced";
    }
  }

  /**
   * Select portfolio with barbell distribution
   */
  _selectBarbellPortfolio(candidates, config) {
    const portfolioSize = config.portfolioSize || 20;
    const barbellDist = config.barbellDistribution || {
      highFloor: 0.35,
      highCeiling: 0.35,
      balanced: 0.3,
    };

    // Calculate target counts for each category
    const targets = {
      highFloor: Math.round(portfolioSize * barbellDist.highFloor),
      highCeiling: Math.round(portfolioSize * barbellDist.highCeiling),
      balanced: Math.round(portfolioSize * barbellDist.balanced),
    };

    // Adjust for rounding errors
    const totalTargets =
      targets.highFloor + targets.highCeiling + targets.balanced;
    if (totalTargets !== portfolioSize) {
      targets.balanced += portfolioSize - totalTargets;
    }

    // Sort candidates by NexusScore within each category
    const categorized = {
      highFloor: candidates
        .filter((l) => l.barbellCategory === "highFloor")
        .sort((a, b) => b.nexusScore - a.nexusScore),
      highCeiling: candidates
        .filter((l) => l.barbellCategory === "highCeiling")
        .sort((a, b) => b.nexusScore - a.nexusScore),
      balanced: candidates
        .filter((l) => l.barbellCategory === "balanced")
        .sort((a, b) => b.nexusScore - a.nexusScore),
    };

    // Select best from each category
    const portfolio = [];

    // Take top lineups from each category
    portfolio.push(...categorized.highFloor.slice(0, targets.highFloor));
    portfolio.push(...categorized.highCeiling.slice(0, targets.highCeiling));
    portfolio.push(...categorized.balanced.slice(0, targets.balanced));

    // If we don't have enough in any category, fill from the highest scoring remaining
    if (portfolio.length < portfolioSize) {
      const remaining = candidates
        .filter((l) => !portfolio.includes(l))
        .sort((a, b) => b.nexusScore - a.nexusScore);

      portfolio.push(...remaining.slice(0, portfolioSize - portfolio.length));
    }

    // Final sort by NexusScore
    return portfolio
      .sort((a, b) => b.nexusScore - a.nexusScore)
      .slice(0, portfolioSize);
  }

  /**
   * Generate portfolio summary
   */
  _generatePortfolioSummary(portfolio, config) {
    const barbellCounts = {
      highFloor: portfolio.filter((l) => l.barbellCategory === "highFloor")
        .length,
      highCeiling: portfolio.filter((l) => l.barbellCategory === "highCeiling")
        .length,
      balanced: portfolio.filter((l) => l.barbellCategory === "balanced")
        .length,
    };

    const stackCounts = {
      "4-3": portfolio.filter((l) => l.stackType === "4-3").length,
      "4-2-1": portfolio.filter((l) => l.stackType === "4-2-1").length,
    };

    const avgNexusScore =
      portfolio.reduce((sum, l) => sum + (l.nexusScore || 0), 0) /
      portfolio.length;
    const avgOwnership =
      portfolio.reduce((sum, l) => sum + (l.avgOwnership || 0), 0) /
      portfolio.length;

    return {
      algorithm: "portfolio",
      portfolioSize: portfolio.length,
      barbellDistribution: barbellCounts,
      stackDistribution: stackCounts,
      averageNexusScore: avgNexusScore,
      averageOwnership: avgOwnership,
      diversityScore: this._calculateDiversityScore(portfolio),
      nexusScoreRange: {
        min: Math.min(...portfolio.map((l) => l.nexusScore || 0)),
        max: Math.max(...portfolio.map((l) => l.nexusScore || 0)),
      },
      ownershipRange: {
        min: Math.min(...portfolio.map((l) => l.avgOwnership || 0)),
        max: Math.max(...portfolio.map((l) => l.avgOwnership || 0)),
      },
    };
  }

  /**
   * Calculate portfolio statistics
   */
  _calculatePortfolioStats(portfolio) {
    return {
      totalLineups: portfolio.length,
      averageNexusScore:
        portfolio.reduce((sum, l) => sum + (l.nexusScore || 0), 0) /
        portfolio.length,
      averageOwnership:
        portfolio.reduce((sum, l) => sum + (l.avgOwnership || 0), 0) /
        portfolio.length,
      sourceAlgorithms: [...new Set(portfolio.map((l) => l.sourceAlgorithm))],
      barbellBreakdown: {
        highFloor: portfolio.filter((l) => l.barbellCategory === "highFloor")
          .length,
        highCeiling: portfolio.filter(
          (l) => l.barbellCategory === "highCeiling"
        ).length,
        balanced: portfolio.filter((l) => l.barbellCategory === "balanced")
          .length,
      },
      stackBreakdown: {
        "4-3": portfolio.filter((l) => l.stackType === "4-3").length,
        "4-2-1": portfolio.filter((l) => l.stackType === "4-2-1").length,
      },
    };
  }

  /**
   * Calculate distance between lineups
   */
  _calculateLineupDistance(lineup1, lineup2) {
    const ids1 = new Set([
      lineup1.cpt?.id,
      ...lineup1.players.map((p) => p.id),
    ]);
    const ids2 = new Set([
      lineup2.cpt?.id,
      ...lineup2.players.map((p) => p.id),
    ]);

    const intersection = new Set([...ids1].filter((id) => ids2.has(id)));
    const union = new Set([...ids1, ...ids2]);

    return 1 - intersection.size / union.size;
  }

  /**
   * Track performance for learning system
   */
  _trackPerformance(strategyName, strategy, results) {
    if (!this.config.learning.trackPerformance) return;

    const performance = {
      timestamp: Date.now(),
      strategy: strategyName,
      algorithm: strategy.algorithm,
      lineupCount: results.lineups.length,
      averageROI: results.summary?.averageROI || 0,
      averageNexusScore: results.summary?.averageNexusScore || 0,
      topLineupROI: results.lineups[0]?.roi || 0,
      diversityScore: results.summary?.diversityScore || 0,
      contestType: this.contestInfo?.type || "unknown",
      constraintComplexity: this.constraintAnalysis?.complexityScore || 0,
    };

    this.performanceHistory.push(performance);

    // Keep only recent history
    if (this.performanceHistory.length > this.config.learning.historySize) {
      this.performanceHistory = this.performanceHistory.slice(
        -this.config.learning.historySize
      );
    }

    // Update performance weights
    this._updatePerformanceWeights();

    // Save to storage
    this._savePerformanceHistory();
  }

  /**
   * Update algorithm performance weights based on history
   */
  _updatePerformanceWeights() {
    if (
      !this.config.learning.adaptRecommendations ||
      this.performanceHistory.length < 10
    ) {
      return;
    }

    const algorithmPerformance = {};

    // Calculate average performance by algorithm
    this.performanceHistory.forEach((record) => {
      if (!algorithmPerformance[record.algorithm]) {
        algorithmPerformance[record.algorithm] = {
          roi: [],
          nexusScore: [],
          diversity: [],
        };
      }

      algorithmPerformance[record.algorithm].roi.push(record.averageROI);
      algorithmPerformance[record.algorithm].nexusScore.push(
        record.averageNexusScore
      );
      algorithmPerformance[record.algorithm].diversity.push(
        record.diversityScore
      );
    });

    // Update weights based on performance
    Object.entries(algorithmPerformance).forEach(([algorithm, metrics]) => {
      if (metrics.roi.length > 0) {
        const avgROI =
          metrics.roi.reduce((sum, r) => sum + r, 0) / metrics.roi.length;
        const avgNexus =
          metrics.nexusScore.reduce((sum, n) => sum + n, 0) /
          metrics.nexusScore.length;
        const avgDiversity =
          metrics.diversity.reduce((sum, d) => sum + d, 0) /
          metrics.diversity.length;

        // Combine metrics into performance score
        const performanceScore =
          avgROI * 0.4 + avgNexus * 0.4 + avgDiversity * 100 * 0.2;

        // Update weight (slowly adapt)
        const currentWeight = this.config.performanceWeights[algorithm] || 1.0;
        const targetWeight = Math.max(
          0.5,
          Math.min(2.0, 1.0 + performanceScore / 100)
        );
        this.config.performanceWeights[algorithm] =
          currentWeight * 0.9 + targetWeight * 0.1;
      }
    });
  }

  /**
   * Get strategy performance data
   */
  _getStrategyPerformance(strategyName) {
    const strategyRecords = this.performanceHistory.filter(
      (r) => r.strategy === strategyName
    );

    if (strategyRecords.length === 0) {
      return { usage: 0, averageROI: 0, averageNexusScore: 0, lastUsed: null };
    }

    const avgROI =
      strategyRecords.reduce((sum, r) => sum + r.averageROI, 0) /
      strategyRecords.length;
    const avgNexusScore =
      strategyRecords.reduce((sum, r) => sum + r.averageNexusScore, 0) /
      strategyRecords.length;
    const lastUsed = Math.max(...strategyRecords.map((r) => r.timestamp));

    return {
      usage: strategyRecords.length,
      averageROI: avgROI,
      averageNexusScore: avgNexusScore,
      lastUsed: new Date(lastUsed).toLocaleDateString(),
    };
  }

  /**
   * Check if strategy is suitable for current context
   */
  _isStrategySuitable(strategyName) {
    const preset = this.presets[strategyName];
    if (!preset) return false;

    const contestType = this.contestInfo?.type;
    const complexityScore = this.constraintAnalysis?.complexityScore || 0;

    // Basic suitability rules
    switch (strategyName) {
      case "cash_game":
        return contestType === "cash" || contestType === "double_up";
      case "tournament":
      case "contrarian":
        return contestType === "gpp" || contestType === "tournament";
      case "constraint_focused":
        return complexityScore > 10;
      default:
        return true; // Generic strategies are always suitable
    }
  }

  /**
   * Generate recommendations based on results
   */
  _generateRecommendations(results) {
    const recommendations = [];

    // Analyze lineup diversity
    const diversityScore = results.summary?.diversityScore || 0;
    if (diversityScore < 0.3) {
      recommendations.push({
        type: "diversity",
        message:
          'Consider using "Tournament" or "Contrarian" strategy for more lineup diversity',
        severity: "warning",
      });
    }

    // Analyze constraint satisfaction
    if (
      this.constraintAnalysis?.constraintCount > 5 &&
      results.summary?.algorithm !== "simulated_annealing"
    ) {
      recommendations.push({
        type: "constraints",
        message:
          'Try "Constraint Optimizer" strategy for better exposure constraint handling',
        severity: "info",
      });
    }

    // Performance-based recommendations
    const avgROI = results.summary?.averageROI || 0;
    if (avgROI < 0 && this.contestInfo?.type === "gpp") {
      recommendations.push({
        type: "performance",
        message:
          'Consider "Contrarian" strategy for higher ceiling in tournaments',
        severity: "suggestion",
      });
    }

    return recommendations;
  }

  /**
   * Load performance history from storage
   */
  _loadPerformanceHistory() {
    try {
      if (typeof localStorage !== "undefined") {
        const stored = localStorage.getItem("lol_dfs_optimizer_performance");
        return stored ? JSON.parse(stored) : [];
      }
    } catch (error) {
      console.warn("Could not load performance history:", error);
    }
    return [];
  }

  /**
   * Save performance history to storage
   */
  _savePerformanceHistory() {
    try {
      if (typeof localStorage !== "undefined") {
        localStorage.setItem(
          "lol_dfs_optimizer_performance",
          JSON.stringify(this.performanceHistory)
        );
      }
    } catch (error) {
      console.warn("Could not save performance history:", error);
    }
  }

  /**
   * Update progress
   */
  updateProgress(percent, stage = "") {
    if (this.onProgress && typeof this.onProgress === "function") {
      this.onProgress(Math.max(0, Math.min(100, percent)), stage);
    }
  }

  /**
   * Update status
   */
  updateStatus(status) {
    if (this.onStatusUpdate && typeof this.onStatusUpdate === "function") {
      this.onStatusUpdate(status);
    }
  }

  /**
   * Get optimizer statistics
   */
  getStats() {
    return {
      isInitialized: this.isInitialized,
      playerCount: this.playerPool?.length || 0,
      constraintComplexity: this.constraintAnalysis?.complexityScore || 0,
      recommendedStrategy: this.recommendedAlgorithm,
      performanceHistory: this.performanceHistory.length,
      availableAlgorithms: Object.keys(this.optimizers).filter(
        (key) => this.optimizers[key]
      ),
      performanceWeights: { ...this.config.performanceWeights },
    };
  }
}

module.exports = HybridOptimizer;
