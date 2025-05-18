/**
 * LoL DFS Advanced Optimizer
 *
 * This optimizer implements SaberSim-like functionality for League of Legends DFS:
 * - Advanced Monte Carlo simulation
 * - Smart lineup building with team stacking
 * - Exposure management
 * - Ownership-based leverage
 * - Correlation modeling for players and teams
 * - Randomization with projection-based weighting
 * - Stack-specific exposure constraints
 */

class AdvancedOptimizer {
  constructor(config = {}) {
    // Default configuration
    this.config = {
      salaryCap: 50000,
      positionRequirements: {
        CPT: 1,
        TOP: 1,
        JNG: 1,
        MID: 1,
        ADC: 1,
        SUP: 1,
        TEAM: 1
      },
      iterations: 10000,         // Monte Carlo iterations
      randomness: 0.3,           // 0-1 scale of how much to randomize projections
      targetTop: 0.2,            // Target top % of simulations
      leverageMultiplier: 1.0,   // How much to consider ownership for leverage
      correlation: {
        sameTeam: 0.65,          // Correlation for players on same team
        opposingTeam: -0.15,     // Correlation for players on opposing teams
        sameTeamSamePosition: 0.2, // Additional correlation for same position on same team
        captain: 0.8             // Correlation between CPT and their base projection
      },
      debugMode: false,          // Enable extra logging for debugging
      ...config
    };

    // Initialize results store
    this.simulationResults = [];
    this.generatedLineups = [];
    this.playerPerfMap = new Map();
    this.optimizerReady = false;

    // Initialize exposure tracking
    this.playerExposures = [];
    this.teamExposures = [];
    this.teamStackExposures = []; // Stack-specific exposures
    this.positionExposures = {};

    // For tracking current exposure levels during lineup generation
    this.exposureTracking = {
      players: new Map(),
      teams: new Map(),
      teamStacks: new Map(),
      positions: new Map()
    };

    this.debugLog(`Advanced Optimizer created with config: ${JSON.stringify(this.config, null, 2)}`);
  }

  /**
   * Debug logging helper - only logs if debugMode is enabled
   */
  debugLog(message, data = null) {
    if (this.config.debugMode) {
      if (data) {
        console.log(`[AdvancedOptimizer] ${message}`, data);
      } else {
        console.log(`[AdvancedOptimizer] ${message}`);
      }
    }
  }

  /**
   * Check if optimizer is ready and log status
   * @returns {boolean} - true if the optimizer is ready
   */
  isReady() {
    const status = {
      optimizerReady: this.optimizerReady,
      hasPlayerPool: Boolean(this.playerPool?.length),
      hasTeams: Boolean(this.teams?.length),
      hasCorrelationMatrix: Boolean(this.correlationMatrix?.size),
      hasPlayerPerfMap: Boolean(this.playerPerfMap?.size)
    };

    this.debugLog("Optimizer status check:", status);

    return this.optimizerReady;
  }

  /**
   * Initialize the optimizer with player pool and exposure settings
   * Enhanced to handle all types of exposure constraints
   *
   * @param {Array} playerPool - Array of player objects
   * @param {Object} exposureSettings - Exposure constraints
   * @param {Array} existingLineups - Any existing lineups to consider
   * @returns {Promise<boolean>} - True if initialization successful
   */
  async initialize(playerPool, exposureSettings = {}, existingLineups = []) {
    this.debugLog("Initializing advanced optimizer...");

    try {
      // Validate player pool data
      if (!playerPool || !Array.isArray(playerPool) || playerPool.length === 0) {
        console.error("Invalid player pool:", playerPool);
        throw new Error("Invalid player pool data. Please make sure player projections are loaded.");
      }

      // Log sample player data
      if (playerPool.length > 0) {
        this.debugLog("Sample player data:", {
          id: playerPool[0].id,
          name: playerPool[0].name,
          position: playerPool[0].position,
          team: playerPool[0].team,
          projectedPoints: playerPool[0].projectedPoints,
          ownership: playerPool[0].ownership
        });

        // Debug log to check for NaN values
        this.debugLog("Sample projectedPoints:", {
          raw: playerPool[0].projectedPoints,
          type: typeof playerPool[0].projectedPoints,
          asNumber: this._safeParseFloat(playerPool[0].projectedPoints),
          withFallback: this._safeParseFloat(playerPool[0].projectedPoints, 0)
        });
      }

      // First set playerPool temporarily so methods can use it during preprocessing
      this.playerPool = playerPool;
      this.existingLineups = existingLineups || [];

      // Process exposure settings
      this._processExposureSettings(exposureSettings);

      // Now preprocess with the raw player pool, storing the result after
      const processedPlayerPool = this._preprocessPlayerPool(playerPool);
      this.playerPool = processedPlayerPool;

      // Create and store team information
      this.teams = this._extractTeams(processedPlayerPool);
      this.debugLog(`Extracted ${this.teams.length} teams from player data`);

      // Calculate team and player correlations
      this.correlationMatrix = this._buildCorrelationMatrix();
      this.debugLog(`Built correlation matrix with ${this.correlationMatrix.size} entries`);

      // Initialize player performance simulation map
      await this._initializePlayerPerformanceMap();
      this.debugLog(`Initialized performance map for ${this.playerPerfMap.size} players`);

      // Initialize exposure tracking based on existing lineups
      this._initializeExposureTracking();

      // Optimizer is ready
      this.optimizerReady = true;

      this.debugLog("Advanced optimizer initialized successfully");
      return true;
    } catch (error) {
      console.error("Error initializing optimizer:", error);
      this.optimizerReady = false;
      return false;
    }
  }

  /**
   * Process all exposure settings into internal format
   */
  _processExposureSettings(exposureSettings) {
    // Process player exposure settings
    this.playerExposures = [];
    if (exposureSettings?.players && Array.isArray(exposureSettings.players)) {
      this.playerExposures = exposureSettings.players.map(player => ({
        id: player.id,
        name: player.name,
        min: player.min !== undefined && player.min !== null ? player.min / 100 : 0,
        max: player.max !== undefined && player.max !== null ? player.max / 100 : 1,
        target: player.target !== undefined && player.target !== null ? player.target / 100 : null
      }));
    }

    // Process team exposure settings - handle both regular and stack-specific exposures
    this.teamExposures = [];
    this.teamStackExposures = [];

    if (exposureSettings?.teams && Array.isArray(exposureSettings.teams)) {
      exposureSettings.teams.forEach(team => {
        // Check if this is a stack-specific exposure setting
        if (team.stackSize !== undefined && team.stackSize !== null) {
          // This is a stack-specific exposure
          this.teamStackExposures.push({
            team: team.team,
            stackSize: team.stackSize,
            min: team.min !== undefined && team.min !== null ? team.min / 100 : 0,
            max: team.max !== undefined && team.max !== null ? team.max / 100 : 1,
            target: team.target !== undefined && team.target !== null ? team.target / 100 : null
          });
        } else {
          // Regular team exposure
          this.teamExposures.push({
            team: team.team,
            min: team.min !== undefined && team.min !== null ? team.min / 100 : 0,
            max: team.max !== undefined && team.max !== null ? team.max / 100 : 1,
            target: team.target !== undefined && team.target !== null ? team.target / 100 : null
          });
        }
      });
    }

    // Process position exposure settings
    this.positionExposures = {};
    if (exposureSettings?.positions) {
      for (const [position, settings] of Object.entries(exposureSettings.positions)) {
        this.positionExposures[position] = {
          min: settings.min !== undefined && settings.min !== null ? settings.min / 100 : 0,
          max: settings.max !== undefined && settings.max !== null ? settings.max / 100 : 1,
          target: settings.target !== undefined && settings.target !== null ? settings.target / 100 : null
        };
      }
    }

    this.debugLog("Processed exposure settings:", {
      playerCount: this.playerExposures.length,
      teamCount: this.teamExposures.length,
      teamStackCount: this.teamStackExposures.length,
      positions: Object.keys(this.positionExposures)
    });
  }

  /**
   * Initialize exposure tracking based on existing lineups
   */
  _initializeExposureTracking() {
    // Reset tracking
    this.exposureTracking = {
      players: new Map(),
      teams: new Map(),
      teamStacks: new Map(),
      positions: new Map()
    };

    if (!this.existingLineups || this.existingLineups.length === 0) {
      this.debugLog("No existing lineups to track exposure for");
      return;
    }

    // Count occurrences in existing lineups
    this.existingLineups.forEach(lineup => {
      this._trackLineupExposure(lineup);
    });

    this.debugLog("Initialized exposure tracking from existing lineups", {
      playerCount: this.exposureTracking.players.size,
      teamCount: this.exposureTracking.teams.size,
      teamStackCount: this.exposureTracking.teamStacks.size,
      positionCount: this.exposureTracking.positions.size
    });
  }

  /**
   * Track the exposure for a single lineup
   */
  _trackLineupExposure(lineup) {
    if (!lineup) return;

    // Track player exposures
    const trackPlayer = (player) => {
      if (!player || !player.id) return;

      const count = this.exposureTracking.players.get(player.id) || 0;
      this.exposureTracking.players.set(player.id, count + 1);
    };

    // Track captain
    if (lineup.cpt) {
      trackPlayer(lineup.cpt);

      // Track position
      const position = lineup.cpt.position || 'CPT';
      const posCount = this.exposureTracking.positions.get(position) || 0;
      this.exposureTracking.positions.set(position, posCount + 1);

      // Track team
      if (lineup.cpt.team) {
        const teamCount = this.exposureTracking.teams.get(lineup.cpt.team) || 0;
        this.exposureTracking.teams.set(lineup.cpt.team, teamCount + 1);
      }
    }

    // Track regular players
    if (lineup.players && Array.isArray(lineup.players)) {
      // Count by team to track stack sizes
      const teamCounts = {};

      lineup.players.forEach(player => {
        if (!player) return;

        trackPlayer(player);

        // Track position
        if (player.position) {
          const posCount = this.exposureTracking.positions.get(player.position) || 0;
          this.exposureTracking.positions.set(player.position, posCount + 1);
        }

        // Track team and increment team counter
        if (player.team) {
          const teamCount = this.exposureTracking.teams.get(player.team) || 0;
          this.exposureTracking.teams.set(player.team, teamCount + 1);

          // Increment team counter for stack tracking
          teamCounts[player.team] = (teamCounts[player.team] || 0) + 1;
        }
      });

      // Track team stack sizes
      Object.entries(teamCounts).forEach(([team, count]) => {
        // Create a key for each team+stackSize combination
        const stackKey = `${team}_${count}`;
        const stackCount = this.exposureTracking.teamStacks.get(stackKey) || 0;
        this.exposureTracking.teamStacks.set(stackKey, stackCount + 1);
      });
    }
  }

  /**
   * Safe parsing of float values with fallback and NaN handling
   * @param {any} value - The value to parse
   * @param {number} fallback - Fallback value if parsing fails (default: 0)
   * @returns {number} - The parsed number or fallback
   */
  _safeParseFloat(value, fallback = 0) {
    // Handle null/undefined
    if (value == null) return fallback;

    // Convert to string if it's not already
    const strValue = String(value).trim();

    // Handle empty string
    if (strValue === '') return fallback;

    // Try to parse as float
    const parsed = parseFloat(strValue);

    // Return fallback if NaN
    return isNaN(parsed) ? fallback : parsed;
  }

  /**
   * Preprocess player pool to add required optimizer properties
   * Modified to pass the original player pool to the target exposure calculation
   * and use safe number parsing
   */
  _preprocessPlayerPool(playerPool) {
    return playerPool.map(player => {
      // Debug any problematic players
      const projPoints = this._safeParseFloat(player.projectedPoints, 0);
      if (projPoints === 0 && player.projectedPoints !== undefined && player.projectedPoints !== 0) {
        console.warn("Warning: Player with invalid projectedPoints:", {
          name: player.name,
          projectedPoints: player.projectedPoints,
          parsed: projPoints
        });
      }

      return {
        ...player,
        optId: player.id,
        position: player.position || 'UNKNOWN',
        projectedPoints: projPoints,
        salary: this._safeParseFloat(player.salary, 0),
        team: player.team || 'UNKNOWN',
        ownership: this._safeParseFloat(player.ownership, 0) / 100, // Convert to decimal
        stdDev: this._calculateStdDev({...player, projectedPoints: projPoints}), // Calculate with fixed value
        minExposure: this._getPlayerMinExposure(player),
        maxExposure: this._getPlayerMaxExposure(player),
        targetExposure: this._getPlayerTargetExposure({...player, projectedPoints: projPoints}, playerPool)
      };
    });
  }

  /**
   * Calculate standard deviation for a player's projection
   * Higher projections typically have higher variance
   */
  _calculateStdDev(player) {
    const basePoints = this._safeParseFloat(player.projectedPoints, 0);
    // LoL specific - points variance is typically about 30-40% of projection
    // Higher for volatile positions like MID, lower for consistent positions like SUP
    let positionVolatility = 0.35; // Default

    switch(player.position) {
      case 'MID':
      case 'ADC':
        positionVolatility = 0.4;
        break;
      case 'TOP':
      case 'JNG':
        positionVolatility = 0.35;
        break;
      case 'SUP':
        positionVolatility = 0.25;
        break;
      case 'TEAM':
        positionVolatility = 0.3;
        break;
      default:
        positionVolatility = 0.35;
    }

    // Minimum standard deviation of 3 points
    return Math.max(basePoints * positionVolatility, 3);
  }

  /**
   * Extract unique teams and build team data
   */
  _extractTeams(playerPool) {
    // Get unique team names
    const teamNames = [...new Set(playerPool.map(player => player.team))].filter(Boolean);

    // Create team objects with players
    return teamNames.map(teamName => {
      const teamPlayers = playerPool.filter(p => p.team === teamName);

      // Calculate team stats with safe number parsing
      const totalSalary = teamPlayers.reduce((sum, p) => sum + this._safeParseFloat(p.salary, 0), 0);
      const totalProjection = teamPlayers.reduce((sum, p) => sum + this._safeParseFloat(p.projectedPoints, 0), 0);
      const avgOwnership = teamPlayers.length > 0
        ? teamPlayers.reduce((sum, p) => sum + this._safeParseFloat(p.ownership, 0), 0) / teamPlayers.length
        : 0;

      return {
        name: teamName,
        players: teamPlayers,
        totalSalary,
        totalProjection,
        avgOwnership,
        // Store players by position for easy access
        playersByPosition: {
          TOP: teamPlayers.filter(p => p.position === 'TOP'),
          JNG: teamPlayers.filter(p => p.position === 'JNG'),
          MID: teamPlayers.filter(p => p.position === 'MID'),
          ADC: teamPlayers.filter(p => p.position === 'ADC'),
          SUP: teamPlayers.filter(p => p.position === 'SUP'),
          TEAM: teamPlayers.filter(p => p.position === 'TEAM')
        }
      };
    });
  }

  /**
   * Get player min exposure based on settings
   */
  _getPlayerMinExposure(player) {
    // Find player-specific setting
    const playerSetting = this.playerExposures.find(p => p.id === player.id);
    if (playerSetting && playerSetting.min !== undefined) {
      return playerSetting.min;
    }

    // Check position-specific setting
    if (this.positionExposures[player.position]) {
      return this.positionExposures[player.position].min || 0;
    }

    // Default to 0
    return 0;
  }

  /**
   * Get player max exposure based on settings
   */
  _getPlayerMaxExposure(player) {
    // Find player-specific setting
    const playerSetting = this.playerExposures.find(p => p.id === player.id);
    if (playerSetting && playerSetting.max !== undefined) {
      return playerSetting.max;
    }

    // Check position-specific setting
    if (this.positionExposures[player.position]) {
      return this.positionExposures[player.position].max || 1.0;
    }

    // Default to 1.0 (100%)
    return 1.0;
  }

  /**
   * Get player target exposure based on settings
   * Modified to pass player pool to _getProjectionPercentile
   */
  _getPlayerTargetExposure(player, playerPool = null) {
    // Find player-specific setting
    const playerSetting = this.playerExposures.find(p => p.id === player.id);
    if (playerSetting && playerSetting.target !== undefined && playerSetting.target !== null) {
      return playerSetting.target;
    }

    // Check position-specific setting
    if (this.positionExposures[player.position] &&
        this.positionExposures[player.position].target !== undefined &&
        this.positionExposures[player.position].target !== null) {
      return this.positionExposures[player.position].target;
    }

    // If no target is set, calculate a smart target based on projection
    // This mimics how SaberSim auto-adjusts exposure
    const projPoints = this._safeParseFloat(player.projectedPoints, 0);
    if (projPoints > 0) {
      // Scale target exposure based on projection percentile
      const projectionPercentile = this._getProjectionPercentile(player, playerPool);

      // Scale from min to max exposure based on percentile
      const min = this._getPlayerMinExposure(player);
      const max = this._getPlayerMaxExposure(player);

      // Higher projections get more exposure, but leverage ownership
      const playerOwnership = this._safeParseFloat(player.ownership, 0.01) * 100; // Ensure not zero
      const leverageAdjustment = Math.min(1, (projPoints / Math.max(0.1, playerOwnership)) / 1.5);

      return min + (max - min) * projectionPercentile * leverageAdjustment;
    }

    // Default to average of min and max
    const min = this._getPlayerMinExposure(player);
    const max = this._getPlayerMaxExposure(player);
    return (min + max) / 2;
  }

  /**
   * Build correlation matrix for all players
   * This creates a map of player correlations based on team relationships
   */
  _buildCorrelationMatrix() {
    const matrix = new Map();

    // Function to get/set correlation
    const getOrCreate = (id1, id2) => {
      const key = [id1, id2].sort().join('_');
      if (!matrix.has(key)) {
        matrix.set(key, 0);
      }
      return key;
    };

    // Process all players
    this.playerPool.forEach(player1 => {
      this.playerPool.forEach(player2 => {
        // Skip same player
        if (player1.id === player2.id) return;

        const key = getOrCreate(player1.id, player2.id);
        let correlation = 0;

        // Same team
        if (player1.team === player2.team) {
          correlation += this.config.correlation.sameTeam;

          // Same position on same team (uncommon in LoL)
          if (player1.position === player2.position) {
            correlation += this.config.correlation.sameTeamSamePosition;
          }
        }
        // Opposing team
        else {
          // In LoL, teams play against each other, so we need team matchup info
          // For now just use a default opposing correlation
          correlation += this.config.correlation.opposingTeam;
        }

        // Ensure correlation is between -1 and 1
        correlation = Math.max(-1, Math.min(1, correlation));
        matrix.set(key, correlation);
      });
    });

    return matrix;
  }

  /**
   * Get correlation between two players
   */
  _getCorrelation(player1Id, player2Id) {
    const key = [player1Id, player2Id].sort().join('_');
    return this.correlationMatrix.get(key) || 0;
  }

  /**
   * Calculate player projection percentile among players in same position
   * Modified to handle possible undefined playerPool
   */
  _getProjectionPercentile(player, customPlayerPool = null) {
    // Use provided player pool or instance's player pool
    const playerPool = customPlayerPool || this.playerPool;

    if (!playerPool || !Array.isArray(playerPool)) {
      console.warn("No valid player pool available for percentile calculation");
      return 0.5; // Default to middle percentile if no data
    }

    // Get players in same position
    const positionPlayers = playerPool.filter(p => p.position === player.position);

    if (positionPlayers.length <= 1) {
      return 0.5; // Only one player in position, return middle percentile
    }

    // Sort by projection, ensuring proper numeric sorting
    positionPlayers.sort((a, b) => {
      return this._safeParseFloat(a.projectedPoints, 0) - this._safeParseFloat(b.projectedPoints, 0);
    });

    // Find player index
    const playerIndex = positionPlayers.findIndex(p => p.id === player.id);

    if (playerIndex === -1) {
      console.warn(`Player ${player.name} (${player.id}) not found in position players`);
      return 0.5; // Player not found, return middle percentile
    }

    // Calculate percentile (0-1)
    return playerIndex / Math.max(1, positionPlayers.length - 1);
  }

  /**
   * Initialize player performance map with simulated performances
   * This is a key part of the Monte Carlo simulation
   */
  async _initializePlayerPerformanceMap() {
    this.playerPerfMap.clear();

    const iterations = this.config.iterations;
    this.debugLog(`Initializing Monte Carlo simulation with ${iterations} iterations...`);

    // For performance in large simulations, batch the processing
    const batchSize = 1000;
    const batches = Math.ceil(iterations / batchSize);

    for (let batch = 0; batch < batches; batch++) {
      const currentBatchSize = Math.min(batchSize, iterations - (batch * batchSize));

      // Process this batch
      await new Promise(resolve => {
        setTimeout(() => {
          // For each player, generate performance distributions
          this.playerPool.forEach(player => {
            if (!this.playerPerfMap.has(player.id)) {
              this.playerPerfMap.set(player.id, []);
            }

            const performances = this.playerPerfMap.get(player.id);

            // Generate new performances
            for (let i = 0; i < currentBatchSize; i++) {
              // Generate performance using normal distribution
              performances.push(this._generatePlayerPerformance(player, i));
            }
          });

          resolve();
        }, 0);
      });

      // Log progress for large simulations
      if (batches > 1 && batch % 5 === 0) {
        this.debugLog(`Simulation progress: ${Math.round(((batch + 1) / batches) * 100)}%`);
      }
    }

    this.debugLog("Player performance map initialized");
  }

  /**
   * Generate a single simulated performance for a player
   */
  _generatePlayerPerformance(player, iteration) {
    // Get mean and standard deviation
    const mean = this._safeParseFloat(player.projectedPoints, 0);
    const stdDev = this._safeParseFloat(player.stdDev, 3);

    // Generate base performance using normal distribution
    const basePerf = this._normalDistribution(mean, stdDev);

    // Apply randomness factor
    const randomFactor = 1 + (Math.random() * 2 - 1) * this.config.randomness;

    // Combine for final performance
    let performance = basePerf * randomFactor;

    // Performance can't be negative in DFS
    performance = Math.max(0, performance);

    return performance;
  }

  /**
   * Generate a random value from normal distribution
   */
  _normalDistribution(mean, stdDev) {
    // Box-Muller transform
    const u1 = Math.random();
    const u2 = Math.random();

    const z0 = Math.sqrt(-2.0 * Math.log(u1)) * Math.cos(2.0 * Math.PI * u2);

    // Transform to the desired mean and standard deviation
    const value = mean + z0 * stdDev;

    return value;
  }

  /**
   * Run a full Monte Carlo simulation on lineups
   */
  async runSimulation(count = 100) {
    if (!this.optimizerReady) {
      throw new Error("Optimizer not initialized. Call initialize() first.");
    }

    this.debugLog(`Running Monte Carlo simulation for ${count} lineups...`);

    // Clear previous results
    this.simulationResults = [];

    // Create lineups
    const lineups = await this._generateLineups(count);

    // Run simulations on each lineup
    for (const lineup of lineups) {
      const result = await this._simulateLineup(lineup);
      this.simulationResults.push(result);
    }

    // Sort by ROI descending, then by projected points descending for ties
    this.simulationResults.sort((a, b) => {
      // If ROIs are the same, sort by projected points
      if (b.roi === a.roi) {
        return b.projectedPoints - a.projectedPoints;
      }
      // Otherwise sort by ROI
      return b.roi - a.roi;
    });

    this.debugLog("Simulation complete");

    return {
      lineups: this.simulationResults,
      summary: this._getSimulationSummary()
    };
  }

  /**
   * Generate optimized lineups with constraints
   * Enhanced to handle all exposure constraints
   */
  async _generateLineups(count) {
    this.debugLog(`Generating ${count} optimized lineups...`);

    const lineups = [];
    const maxAttempts = count * 5; // Allow more attempts than needed to handle constraints
    let attempts = 0;

    // Reset exposure tracking for new generation
    this._initializeExposureTracking();

    // If we already have existing lineups, track their exposures
    if (this.existingLineups && this.existingLineups.length > 0) {
      this.existingLineups.forEach(lineup => {
        this._trackLineupExposure(lineup);
      });
    }

    while (lineups.length < count && attempts < maxAttempts) {
      attempts++;

      try {
        // Generate a lineup
        const lineup = await this._buildLineup(lineups);

        // Check if lineup is valid
        if (this._isValidLineup(lineup, lineups)) {
          // Track exposures for the new lineup
          this._trackLineupExposure(lineup);

          lineups.push(lineup);
          this.debugLog(`Generated lineup ${lineups.length}/${count}`);
        }
      } catch (error) {
        console.error("Error generating lineup:", error);
      }
    }

    // Store generated lineups
    this.generatedLineups = lineups;

    this.debugLog(`Generated ${lineups.length} lineups in ${attempts} attempts`);
    return lineups;
  }

  /**
   * Check if a team needs more exposure based on current constraints
   * Now includes stack-specific exposure checks
   */
  _teamNeedsExposure(team, stackSize = null) {
    const totalLineups = this.generatedLineups.length + this.existingLineups.length;
    if (totalLineups === 0) return true; // Always need exposure for first lineup

    // Check stack-specific exposure first if a stack size is provided
    if (stackSize !== null) {
      const stackKey = `${team}_${stackSize}`;
      const stackCount = this.exposureTracking.teamStacks.get(stackKey) || 0;
      const currentPct = stackCount / totalLineups;

      // Find the stack-specific constraint
      const stackConstraint = this.teamStackExposures.find(
        te => te.team === team && te.stackSize === stackSize
      );

      if (stackConstraint && stackConstraint.min > 0) {
        // Need more exposure if below min
        if (currentPct < stackConstraint.min) {
          this.debugLog(`Team ${team} needs more ${stackSize}-stack exposure: ${currentPct * 100}% < ${stackConstraint.min * 100}%`);
          return true;
        }

        // At max exposure?
        if (stackConstraint.max < 1 && currentPct >= stackConstraint.max) {
          return false;
        }
      }
    }

    // Check general team exposure
    const teamCount = this.exposureTracking.teams.get(team) || 0;
    const currentPct = teamCount / (totalLineups * 6); // 6 players per lineup (5 + CPT)

    // Find the team constraint
    const teamConstraint = this.teamExposures.find(te => te.team === team);

    if (teamConstraint && teamConstraint.min > 0) {
      // Need more exposure if below min
      if (currentPct < teamConstraint.min) {
        this.debugLog(`Team ${team} needs more general exposure: ${currentPct * 100}% < ${teamConstraint.min * 100}%`);
        return true;
      }

      // At max exposure?
      if (teamConstraint.max < 1 && currentPct >= teamConstraint.max) {
        return false;
      }
    }

    // If no constraints or below max, default to true
    return true;
  }

/**
 * Build a single lineup using a smart algorithm
 * Enhanced to consider all exposure constraints and ensure TEAM position
 */
async _buildLineup(existingLineups = []) {
  // Start with empty lineup
  const lineup = {
    id: Date.now() + Math.floor(Math.random() * 10000),
    name: `Optimized Lineup ${existingLineups.length + 1}`,
    cpt: null,
    players: []
  };

  // Track used players and salary
  const usedPlayers = new Set();
  let remainingSalary = this.config.salaryCap;

  // Calculate current exposure metrics
  const totalLineups = this.generatedLineups.length + this.existingLineups.length;

  // Select a stack team with consideration of stack-specific exposures
  const stackTeam = this._selectStackTeam();

  // Determine stack size based on constraints
  let stackSize = null;

  // Check if this team has any stack-specific constraints
  const teamStackConstraints = this.teamStackExposures.filter(tc => tc.team === stackTeam.name);

  if (teamStackConstraints.length > 0) {
    // Find underexposed stack sizes
    const underexposedStacks = teamStackConstraints.filter(tc => {
      const stackKey = `${stackTeam.name}_${tc.stackSize}`;
      const stackCount = this.exposureTracking.teamStacks.get(stackKey) || 0;
      const currentPct = totalLineups > 0 ? stackCount / totalLineups : 0;
      return currentPct < tc.min;
    });

    if (underexposedStacks.length > 0) {
      // Prioritize the most underexposed stack size
      const targetStack = underexposedStacks.sort((a, b) => {
        const aKey = `${stackTeam.name}_${a.stackSize}`;
        const bKey = `${stackTeam.name}_${b.stackSize}`;
        const aCount = this.exposureTracking.teamStacks.get(aKey) || 0;
        const bCount = this.exposureTracking.teamStacks.get(bKey) || 0;
        const aPct = totalLineups > 0 ? aCount / totalLineups : 0;
        const bPct = totalLineups > 0 ? bCount / totalLineups : 0;
        return (aPct - a.min) - (bPct - b.min); // Most negative = most underexposed relative to min
      })[0];

      stackSize = targetStack.stackSize;
      this.debugLog(`Selected ${stackSize}-stack for team ${stackTeam.name} based on exposure constraints`);
    }
  }

  // Select a captain
  lineup.cpt = this._selectCaptain(stackTeam, usedPlayers, stackSize);
  usedPlayers.add(lineup.cpt.id);
  remainingSalary -= lineup.cpt.salary;

  // Fill positions one by one - MODIFIED to check available positions
  // Create a prioritized list of positions to fill
  const availablePositions = new Set(this.playerPool.map(p => p.position));

  const positionsToFill = Object.entries(this.config.positionRequirements)
    .filter(([pos, count]) => {
      // Skip captain (already handled)
      if (pos === 'CPT') return false;

      // For TEAM position, only include if it exists in the player pool
      if (pos === 'TEAM' && !availablePositions.has('TEAM')) {
        this.debugLog(`Skipping TEAM position as no TEAM players exist in player pool`);
        return false;
      }

      return true;
    })
    .sort(([posA], [posB]) => {
      // Prioritize positions: Core positions first, TEAM last if it exists
      const order = { 'TOP': 1, 'JNG': 2, 'MID': 3, 'ADC': 4, 'SUP': 5, 'TEAM': 6 };
      return (order[posA] || 99) - (order[posB] || 99);
    });

  this.debugLog(`Filling positions in order: ${positionsToFill.map(([pos]) => pos).join(', ')}`);

  // Now fill each position in the prioritized order
  for (const [position, count] of positionsToFill) {
    this.debugLog(`Filling position: ${position} (need ${count})`);

    for (let i = 0; i < count; i++) {
      // Special handling for TEAM position
      if (position === 'TEAM') {
        this.debugLog('Selecting TEAM position player...');

        // First try to get TEAM player from stack team
        let teamPlayers = this.playerPool.filter(player =>
          !usedPlayers.has(player.id) &&
          player.position === 'TEAM' &&
          player.team === stackTeam.name &&
          this._safeParseFloat(player.salary, 0) <= remainingSalary
        );

        // If no TEAM players from stack team, get any TEAM player
        if (teamPlayers.length === 0) {
          this.debugLog('No TEAM players from stack team, selecting any TEAM player');
          teamPlayers = this.playerPool.filter(player =>
            !usedPlayers.has(player.id) &&
            player.position === 'TEAM' &&
            this._safeParseFloat(player.salary, 0) <= remainingSalary
          );
        }

        // If we found a TEAM player
        if (teamPlayers.length > 0) {
          // Select the TEAM player with highest projection
          const selectedTeamPlayer = teamPlayers.sort((a, b) =>
            this._safeParseFloat(b.projectedPoints, 0) - this._safeParseFloat(a.projectedPoints, 0)
          )[0];

          const player = {
            id: selectedTeamPlayer.id,
            name: selectedTeamPlayer.name,
            position: 'TEAM',
            team: selectedTeamPlayer.team,
            salary: this._safeParseFloat(selectedTeamPlayer.salary, 0)
          };

          lineup.players.push(player);
          usedPlayers.add(player.id);
          remainingSalary -= player.salary;
          this.debugLog(`Added TEAM player: ${player.name} (${player.team})`);
        } else {
          this.debugLog('No TEAM position players available within salary constraint');
          throw new Error(`Couldn't find player for position TEAM`);
        }
      } else {
        // Regular position selection
        const player = await this._selectPositionPlayer(
          position,
          stackTeam,
          usedPlayers,
          remainingSalary,
          lineup.players,
          stackSize
        );

        if (player) {
          lineup.players.push(player);
          usedPlayers.add(player.id);
          remainingSalary -= player.salary;
          this.debugLog(`Added ${position} player: ${player.name} (${player.team})`);
        } else {
          this.debugLog(`Failed to find player for position ${position}`);
          throw new Error(`Couldn't find player for position ${position}`);
        }
      }
    }
  }

  // Verify lineup has required positions
  const positionCounts = {};
  lineup.players.forEach(player => {
    positionCounts[player.position] = (positionCounts[player.position] || 0) + 1;
  });

  for (const [position, count] of Object.entries(this.config.positionRequirements)) {
    if (position !== 'CPT' && (positionCounts[position] || 0) !== count) {
      this.debugLog(`ISSUE: Position ${position} requires ${count} but has ${positionCounts[position] || 0}`);
    }
  }

  // Balance team exposures if needed
  this._balanceTeamExposures(lineup, usedPlayers, remainingSalary);

  return lineup;
}

  /**
   * Select a team to stack
   * Enhanced to consider stack-specific exposures
   */
  _selectStackTeam() {
    // First check for teams with specific stack requirements
    const teamsNeedingExposure = [];

    // Check regular team exposures
    this.teamExposures.forEach(team => {
      if (team.min > 0 && this._teamNeedsExposure(team.team)) {
        teamsNeedingExposure.push(team.team);
      }
    });

    // Check stack-specific exposures
    this.teamStackExposures.forEach(stack => {
      if (stack.min > 0 && this._teamNeedsExposure(stack.team, stack.stackSize)) {
        teamsNeedingExposure.push(stack.team);
      }
    });

    // If we have teams that need exposure, prioritize them
    if (teamsNeedingExposure.length > 0) {
      // Pick a random team from those needing exposure
      const teamName = teamsNeedingExposure[Math.floor(Math.random() * teamsNeedingExposure.length)];
      const team = this.teams.find(t => t.name === teamName);

      if (team) {
        this.debugLog(`Selected team ${teamName} based on exposure requirements`);
        return team;
      }
    }

    // Otherwise weight teams by projection and adjust by existing exposures
    const teamWeights = this.teams.map(team => {
      // Get projection value
      const projectionValue = team.totalProjection;

      // Get target exposure (if any)
      const exposureSetting = this.teamExposures.find(te => te.team === team.name);
      const targetExposure = exposureSetting?.target || 0.5; // Default to 50% if no target

      // Calculate current exposure
      const totalLineups = this.generatedLineups.length + this.existingLineups.length;
      const teamCount = this.exposureTracking.teams.get(team.name) || 0;
      const currentExposure = totalLineups > 0 ? teamCount / (totalLineups * 6) : 0;

      // Adjust weight based on exposure gap
      const exposureGap = targetExposure - currentExposure;
      const exposureMultiplier = Math.max(0.1, 1 + exposureGap);

      return {
        team,
        weight: projectionValue * exposureMultiplier
      };
    });

    // Filter out teams with zero weight
    const validTeams = teamWeights.filter(tw => tw.weight > 0);

    // If no valid teams with weight, just use all teams
    const teamsToUse = validTeams.length > 0 ? validTeams : teamWeights;

    // Select a team based on weights
    return this._weightedRandom(
      teamsToUse.map(tw => tw.team),
      teamsToUse.map(tw => tw.weight)
    );
  }

  /**
   * Select a captain for the lineup
   * Enhanced to consider exposure and stack size requirements
   */
  _selectCaptain(stackTeam, usedPlayers, targetStackSize = null) {
    // Get potential captain candidates
    let candidates = this.playerPool.filter(player =>
      !usedPlayers.has(player.id) &&
      // Captain is typically a high-scoring position
      ['TOP', 'MID', 'ADC', 'JNG'].includes(player.position)
    );

    // Prefer players from the stack team
    const stackTeamCandidates = candidates.filter(p => p.team === stackTeam.name);

    if (stackTeamCandidates.length > 0) {
      candidates = stackTeamCandidates;
    }

    // Calculate current exposures
    const exposures = candidates.map(player => {
      const totalLineups = this.generatedLineups.length + this.existingLineups.length;
      const playerCount = this.exposureTracking.players.get(player.id) || 0;
      const currentExposure = totalLineups > 0 ? playerCount / totalLineups : 0;

      // Get exposure constraints
      const exposureSetting = this.playerExposures.find(pe => pe.id === player.id);
      const minExposure = exposureSetting?.min || 0;
      const maxExposure = exposureSetting?.max || 1;

      // Check if player needs exposure
      const needsExposure = minExposure > 0 && currentExposure < minExposure;
      const atMaxExposure = maxExposure < 1 && currentExposure >= maxExposure;

      return {
        ...player,
        currentExposure,
        needsExposure,
        atMaxExposure,
        availableExposure: Math.max(0, maxExposure - currentExposure)
      };
    });

    // First, check if any players need more exposure (below min)
    const playersNeedingExposure = exposures.filter(p => p.needsExposure);

    if (playersNeedingExposure.length > 0) {
      // Pick a random player that needs exposure
      const selectedPlayer = playersNeedingExposure[Math.floor(Math.random() * playersNeedingExposure.length)];
      this.debugLog(`Selected captain ${selectedPlayer.name} based on exposure requirements`);

      // Apply captain formatting
      return {
        id: selectedPlayer.id,
        name: selectedPlayer.name,
        position: 'CPT',
        team: selectedPlayer.team,
        salary: Math.round(this._safeParseFloat(selectedPlayer.salary, 0) * 1.5)
      };
    }

    // Filter players who still have available exposure
    const availablePlayers = exposures.filter(p => !p.atMaxExposure);

    // If no players available, use all candidates
    const playersToUse = availablePlayers.length > 0 ? availablePlayers : exposures;

    // Weight by projection
    const weights = playersToUse.map(player => {
      // Captain value is influenced by projection, leverage, and remaining exposure
      const projectionValue = this._safeParseFloat(player.projectedPoints, 0) * 1.5; // CPT gets 1.5x
      const playerOwnership = this._safeParseFloat(player.ownership, 0.01) * 100; // Ensure not zero
      const leverageValue = projectionValue / playerOwnership;
      const exposureMultiplier = player.availableExposure / Math.max(0.1, player.maxExposure);

      return projectionValue * leverageValue * exposureMultiplier;
    });

    // Select a player based on weights
    const selectedPlayer = this._weightedRandom(playersToUse, weights);

    // Apply captain formatting
    return {
      id: selectedPlayer.id,
      name: selectedPlayer.name,
      position: 'CPT',
      team: selectedPlayer.team,
      salary: Math.round(this._safeParseFloat(selectedPlayer.salary, 0) * 1.5)
    };
  }

  /**
   * Select a player for a position
   * Enhanced to consider exposure and stack size requirements
   */
  async _selectPositionPlayer(position, stackTeam, usedPlayers, remainingSalary, selectedPlayers, targetStackSize = null) {
    console.log(`selecting position ${position} player`)
    // Special handling for TEAM position
    if (position === 'TEAM') {
      console.log('Selecting TEAM position player...');

      // First try to get a TEAM player from the stack team
      let teamPlayers = this.playerPool.filter(player =>
        !usedPlayers.has(player.id) &&
        player.position === 'TEAM' &&
        player.team === stackTeam.name &&
        this._safeParseFloat(player.salary, 0) <= remainingSalary
      );

      // If no TEAM players from stack team, get any TEAM player
      if (teamPlayers.length === 0) {
        console.log('No TEAM players from stack team, selecting any TEAM player');
        teamPlayers = this.playerPool.filter(player =>
          !usedPlayers.has(player.id) &&
          player.position === 'TEAM' &&
          this._safeParseFloat(player.salary, 0) <= remainingSalary
        );
      }

      // If still no TEAM players, this is an error condition
      if (teamPlayers.length === 0) {
        console.error('No TEAM position players available within salary constraint');
        return null;
      }

      // Select the TEAM player with highest projection
      const selectedPlayer = teamPlayers.sort((a, b) =>
        this._safeParseFloat(b.projectedPoints, 0) - this._safeParseFloat(a.projectedPoints, 0)
      )[0];

      return {
        id: selectedPlayer.id,
        name: selectedPlayer.name,
        position: 'TEAM',
        team: selectedPlayer.team,
        salary: this._safeParseFloat(selectedPlayer.salary, 0)
      };
    }

    // Get potential players for this position who are under salary cap
    let candidates = this.playerPool.filter(player =>
      !usedPlayers.has(player.id) &&
      player.position === position &&
      this._safeParseFloat(player.salary, 0) <= remainingSalary
    );

    // If no candidates, we have a problem
    if (candidates.length === 0) {
      // Try to find any player under salary cap
      candidates = this.playerPool.filter(player =>
        !usedPlayers.has(player.id) &&
        this._safeParseFloat(player.salary, 0) <= remainingSalary
      );

      // If still no candidates, return null
      if (candidates.length === 0) {
        return null;
      }
    }

    // Count how many players we have so far from the stack team
    const stackTeamCount = selectedPlayers.filter(p => p.team === stackTeam.name).length;

    // Check if we need to select from the stack team based on target stack size
    const needStackPlayer = targetStackSize !== null &&
                            stackTeamCount < targetStackSize &&
                            this._shouldPrioritizeStackForPosition(position, selectedPlayers);

    if (needStackPlayer) {
      // Get players from stack team for this position
      const stackTeamPlayers = candidates.filter(p => p.team === stackTeam.name);

      if (stackTeamPlayers.length > 0) {
        candidates = stackTeamPlayers;
        this.debugLog(`Prioritizing ${stackTeam.name} player for position ${position} to meet ${targetStackSize}-stack`);
      }
    } else {
      // Get players from stack team for this position
      const stackTeamPlayers = candidates.filter(p => p.team === stackTeam.name);

      // If we have stack team players, prioritize them for certain positions
      // In LoL, often you want to stack certain positions like MID+JNG or ADC+SUP
      if (stackTeamPlayers.length > 0 && this._shouldPrioritizeStackForPosition(position, selectedPlayers)) {
        candidates = stackTeamPlayers;
      }
    }

    // Calculate current exposures and check constraints
    const exposures = candidates.map(player => {
      const totalLineups = this.generatedLineups.length + this.existingLineups.length;
      const playerCount = this.exposureTracking.players.get(player.id) || 0;
      const currentExposure = totalLineups > 0 ? playerCount / totalLineups : 0;

      // Get exposure constraints
      const exposureSetting = this.playerExposures.find(pe => pe.id === player.id);
      const minExposure = exposureSetting?.min || 0;
      const maxExposure = exposureSetting?.max || 1;

      // Check if player needs exposure
      const needsExposure = minExposure > 0 && currentExposure < minExposure;
      const atMaxExposure = maxExposure < 1 && currentExposure >= maxExposure;

      return {
        ...player,
        currentExposure,
        needsExposure,
        atMaxExposure,
        availableExposure: Math.max(0, maxExposure - currentExposure)
      };
    });

    // First, check if any players need more exposure (below min)
    const playersNeedingExposure = exposures.filter(p => p.needsExposure);

    if (playersNeedingExposure.length > 0) {
      // Pick a random player that needs exposure
      const selectedPlayer = playersNeedingExposure[Math.floor(Math.random() * playersNeedingExposure.length)];
      this.debugLog(`Selected ${position} player ${selectedPlayer.name} based on exposure requirements`);

      return {
        id: selectedPlayer.id,
        name: selectedPlayer.name,
        position: selectedPlayer.position,
        team: selectedPlayer.team,
        salary: this._safeParseFloat(selectedPlayer.salary, 0)
      };
    }

    // Filter players who still have available exposure
    const availablePlayers = exposures.filter(p => !p.atMaxExposure);

    // If no players available, use all candidates
    const playersToUse = availablePlayers.length > 0 ? availablePlayers : exposures;

    // Weight by projection, leverage, and synergy with already selected players
    const weights = playersToUse.map(player => {
      // Base value from projection
      const projectionValue = this._safeParseFloat(player.projectedPoints, 0);

      // Leverage factor (projection vs ownership)
      const playerOwnership = this._safeParseFloat(player.ownership, 0.01) * 100; // Ensure not zero
      const leverageFactor = this.config.leverageMultiplier *
        (projectionValue / playerOwnership);

      // Synergy with already selected players
      const synergy = this._calculateSynergy(player, selectedPlayers);

      // Exposure factor - prioritize players under their target exposure
      const targetExposure = this._safeParseFloat(player.targetExposure, 0.5);
      const exposureFactor = targetExposure > 0
        ? (targetExposure - player.currentExposure) / targetExposure
        : 1;

      // Final weight
      return projectionValue * leverageFactor * synergy * Math.max(0.1, exposureFactor);
    });

    // Select a player based on weights
    const selectedPlayer = this._weightedRandom(playersToUse, weights);

    return {
      id: selectedPlayer.id,
      name: selectedPlayer.name,
      position: selectedPlayer.position,
      team: selectedPlayer.team,
      salary: this._safeParseFloat(selectedPlayer.salary, 0)
    };
  }

  /**
   * Determine if we should prioritize stack team for a position
   */
  _shouldPrioritizeStackForPosition(position, selectedPlayers) {
    // In LoL, certain positions are commonly stacked together
    switch(position) {
      // MID+JNG is a common stack
      case 'MID':
        return selectedPlayers.some(p => p.position === 'JNG');
      case 'JNG':
        return selectedPlayers.some(p => p.position === 'MID');

      // ADC+SUP is a very common stack
      case 'ADC':
        return selectedPlayers.some(p => p.position === 'SUP');
      case 'SUP':
        return selectedPlayers.some(p => p.position === 'ADC');

      // TOP is less commonly stacked
      case 'TOP':
        return Math.random() < 0.5; // 50% chance to stack TOP

      case 'TEAM':
      return true; // Always include TEAM in stacks

      default:
        return false;
    }
  }

  /**
   * Calculate synergy between a player and already selected players
   */
  _calculateSynergy(player, selectedPlayers) {
    // No players selected yet
    if (selectedPlayers.length === 0) return 1;

    // Calculate correlation with each selected player
    const correlations = selectedPlayers.map(selected => {
      return this._getCorrelation(player.id, selected.id) + 1; // Shift from [-1,1] to [0,2]
    });

    // Average correlation (geometric mean to emphasize synergy)
    return correlations.reduce((product, corr) => product * corr, 1) ** (1 / correlations.length);
  }

  /**
   * Balance team exposures as needed to meet constraints
   */
  _balanceTeamExposures(lineup, usedPlayers, remainingSalary) {
    // Implementation would swap players to balance team exposures
    // Not shown in full detail for brevity
    return lineup;
  }

  /**
   * Check if a lineup is valid based on all constraints
   */
  _isValidLineup(lineup, existingLineups) {
    // Check salary cap
    const totalSalary = this._safeParseFloat(lineup.cpt.salary, 0) +
      lineup.players.reduce((sum, player) => sum + this._safeParseFloat(player.salary, 0), 0);

    if (totalSalary > this.config.salaryCap) {
      return false;
    }

    // Check position requirements
    const positions = lineup.players.map(p => p.position);
    for (const [position, count] of Object.entries(this.config.positionRequirements)) {
      if (position === 'CPT') {
        // Captain is handled separately
        if (!lineup.cpt) return false;
      } else {
        // Check regular positions
        const posCount = positions.filter(p => p === position).length;
        if (posCount !== count) return false;
      }
    }

    // Check for duplicate players
    const playerIds = [lineup.cpt.id, ...lineup.players.map(p => p.id)];
    if (new Set(playerIds).size !== playerIds.length) {
      return false;
    }

    // Check uniqueness against existing lineups
    for (const existing of existingLineups) {
      const existingIds = [existing.cpt.id, ...existing.players.map(p => p.id)].sort().join(',');
      const currentIds = playerIds.sort().join(',');

      if (existingIds === currentIds) {
        return false; // Duplicate lineup
      }
    }

    return true;
  }

  /**
   * Simulate a lineup across all iterations
   */
  async _simulateLineup(lineup) {
    // Get all player IDs in the lineup
    const playerIds = [lineup.cpt.id, ...lineup.players.map(p => p.id)];

    // Get their simulated performances
    const performances = [];

    // For each iteration, calculate lineup performance
    for (let i = 0; i < this.config.iterations; i++) {
      let totalPoints = 0;

      // Apply correlation in the simulation
      const basePerformances = playerIds.map(id => {
        const player = this.playerPool.find(p => p.id === id);
        const perf = this.playerPerfMap.get(id)[i];
        return { id, perf, isCpt: player && player.id === lineup.cpt.id };
      });

      // Apply correlations between players
      const correlatedPerformances = this._applyCorrelations(basePerformances);

      // Sum up performances
      for (const { id, perf, isCpt } of correlatedPerformances) {
        // Captain gets 1.5x
        totalPoints += isCpt ? perf * 1.5 : perf;
      }

      performances.push(totalPoints);
    }

    // Sort performances for percentiles
    performances.sort((a, b) => a - b);

    // Calculate lineup metrics
    const metrics = this._calculateLineupMetrics(lineup, performances);

    return {
      ...lineup,
      ...metrics
    };
  }

  /**
   * Apply correlations between players in a simulation iteration
   */
  _applyCorrelations(performances) {
    const result = [...performances];

    // Apply correlation to each pair
    for (let i = 0; i < result.length; i++) {
      for (let j = i + 1; j < result.length; j++) {
        const player1 = result[i];
        const player2 = result[j];

        // Get correlation coefficient
        const correlation = this._getCorrelation(player1.id, player2.id);

        // Skip if no correlation
        if (correlation === 0) continue;

        // Apply correlation effect (simplified)
        const adjustmentFactor = correlation * 0.2; // Scale down the effect

        // Adjust both performances toward their average if positive correlation
        // Or away from average if negative correlation
        const avgPerf = (player1.perf + player2.perf) / 2;

        result[i].perf = player1.perf + (avgPerf - player1.perf) * adjustmentFactor;
        result[j].perf = player2.perf + (avgPerf - player2.perf) * adjustmentFactor;
      }
    }

    return result;
  }

  /**
   * Calculate metrics for a lineup based on simulated performances
   */
  _calculateLineupMetrics(lineup, performances) {
    // Sort performances for percentiles
    performances.sort((a, b) => a - b);

    const count = performances.length;
    const median = performances[Math.floor(count / 2)];
    const min = performances[0];
    const max = performances[count - 1];

    // Determine percentiles
    const p10 = performances[Math.floor(count * 0.1)];
    const p25 = performances[Math.floor(count * 0.25)];
    const p75 = performances[Math.floor(count * 0.75)];
    const p90 = performances[Math.floor(count * 0.9)];

    // Calculate cash rate and winning metrics
    const cashThreshold = 130; // Points needed to cash in a typical contest
    const winThreshold = 180;  // Points to win a typical contest

    // Calculate cash and win rates
    const cashLineups = performances.filter(p => p >= cashThreshold).length;
    const winLineups = performances.filter(p => p >= winThreshold).length;

    const cashRate = cashLineups / count;
    const winRate = winLineups / count;

    // Calculate ROI using a simplified payout structure
    // 1st place: 100x
    // Top 10: 10x
    // Cash: 2x
    const firstPlaceThreshold = performances[Math.floor(count * (1 - this.config.targetTop))];
    const top10Threshold = performances[Math.floor(count * 0.9)];

    const firstPlaceCount = performances.filter(p => p >= firstPlaceThreshold).length;
    const top10Count = performances.filter(p => p >= top10Threshold).length;

    const firstPlaceRate = firstPlaceCount / count;
    const top10Rate = top10Count / count;

    const roi = (
      (firstPlaceRate * 100) +
      (top10Rate * 10) +
      (cashRate * 2)
    );

    // Calculate projected points with safe handling
    let projectedPoints = 0;
    try {
      // Get the player for Captain from the player pool
      const cptPlayer = this.playerPool.find(p => p.id === lineup.cpt.id);
      // Add captain's points (1.5x)
      if (cptPlayer) {
        projectedPoints += this._safeParseFloat(cptPlayer.projectedPoints, 0) * 1.5;
      }

      // Add player points
      for (const player of lineup.players) {
        const poolPlayer = this.playerPool.find(p => p.id === player.id);
        if (poolPlayer) {
          projectedPoints += this._safeParseFloat(poolPlayer.projectedPoints, 0);
        }
      }
    } catch (e) {
      console.error("Error calculating projected points:", e);
    }

    return {
      median,
      min,
      max,
      p10,
      p25,
      p75,
      p90,
      cashRate: Math.round(cashRate * 100 * 10) / 10,
      winRate: Math.round(winRate * 100 * 10) / 10,
      roi: Math.round(roi * 100) / 100,
      firstPlace: Math.round(firstPlaceRate * 100 * 10) / 10,
      top10: Math.round(top10Rate * 100 * 10) / 10,
      projectedPoints: Math.round(projectedPoints * 10) / 10
    };
  }

  /**
   * Get simulation summary stats
   */
  _getSimulationSummary() {
    // Implementation would calculate aggregate statistics
    return {
      averageROI: this.simulationResults.reduce((sum, r) => sum + r.roi, 0) /
                 Math.max(1, this.simulationResults.length),
      topLineupROI: this.simulationResults.length > 0 ? this.simulationResults[0].roi : 0,
      distinctTeams: new Set(this.simulationResults.flatMap(r =>
        [r.cpt.team, ...r.players.map(p => p.team)]
      )).size,
      playerExposures: this._calculatePlayerExposures()
    };
  }

  /**
   * Calculate player exposures across all lineups
   */
  _calculatePlayerExposures() {
    // Create a map to count player occurrences
    const exposureMap = new Map();

    // Initialize all players to 0
    this.playerPool.forEach(player => {
      exposureMap.set(player.id, 0);
    });

    // Count occurrences
    this.simulationResults.forEach(lineup => {
      // Count captain
      const cptId = lineup.cpt.id;
      exposureMap.set(cptId, (exposureMap.get(cptId) || 0) + 1);

      // Count players
      lineup.players.forEach(player => {
        const playerId = player.id;
        exposureMap.set(playerId, (exposureMap.get(playerId) || 0) + 1);
      });
    });

    // Convert to percentages
    const totalLineups = Math.max(1, this.simulationResults.length);

    return Array.from(exposureMap.entries()).map(([id, count]) => {
      const player = this.playerPool.find(p => p.id === id);
      return {
        id,
        name: player ? player.name : 'Unknown',
        team: player ? player.team : 'Unknown',
        position: player ? player.position : 'Unknown',
        exposure: Math.round((count / totalLineups) * 1000) / 10
      };
    }).sort((a, b) => b.exposure - a.exposure);
  }

  /**
   * Weighted random selection
   */
  _weightedRandom(items, weights) {
    if (items.length === 0) return null;
    if (items.length === 1) return items[0];

    // Make sure weights are positive
    const positiveWeights = weights.map(w => Math.max(0, w));

    // Calculate total weight
    const totalWeight = positiveWeights.reduce((sum, w) => sum + w, 0);

    // If all weights are 0, select randomly
    if (totalWeight === 0) {
      return items[Math.floor(Math.random() * items.length)];
    }

    // Select based on weights
    const threshold = Math.random() * totalWeight;
    let cumulativeWeight = 0;

    for (let i = 0; i < items.length; i++) {
      cumulativeWeight += positiveWeights[i];
      if (cumulativeWeight >= threshold) {
        return items[i];
      }
    }

    // Fallback to last item
    return items[items.length - 1];
  }
}

// Export the optimizer class
module.exports = AdvancedOptimizer;