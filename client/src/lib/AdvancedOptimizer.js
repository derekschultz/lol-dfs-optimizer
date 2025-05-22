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
 * - NexusScore comprehensive lineup evaluation
 */

// Add a global counter for truly unique lineup IDs
let lineupCounter = 0;

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
        TEAM: 1,
      },
      maxPlayersPerTeam: 4, // Added max players per team constraint
      iterations: 10000, // Monte Carlo iterations
      randomness: 0.3, // 0-1 scale of how much to randomize projections
      targetTop: 0.2, // Target top % of simulations
      leverageMultiplier: 1.0, // How much to consider ownership for leverage
      correlation: {
        sameTeam: 0.65, // Correlation for players on same team
        opposingTeam: -0.15, // Correlation for players on opposing teams
        sameTeamSamePosition: 0.2, // Additional correlation for same position on same team
        captain: 0.8, // Correlation between CPT and their base projection
      },
      fieldSize: 1000, // Default field size for tournaments
      debugMode: false, // Enable extra logging for debugging
      ...config,
    };

    // Initialize results store
    this.simulationResults = [];
    this.generatedLineups = [];
    this.playerPerfMap = new Map();
    this.optimizerReady = false;
    this.teamMatchups = new Map(); // Map to store team -> opponent relationships

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
      positions: new Map(),
    };

    // Add progress callback properties
    this.onProgress = null; // Callback for progress updates
    this.onStatusUpdate = null; // Callback for status text updates
    this.isCancelled = false; // Flag to allow cancellation

    this.debugLog(
      `Advanced Optimizer created with config: ${JSON.stringify(
        this.config,
        null,
        2
      )}`
    );
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
   * Set progress callback function
   */
  setProgressCallback(callback) {
    this.onProgress = callback;
  }

  /**
   * Set status update callback function
   */
  setStatusCallback(callback) {
    this.onStatusUpdate = callback;
  }

  /**
   * Cancel current operations
   */
  cancel() {
    this.isCancelled = true;
    this.updateStatus("Operation cancelled by user");
  }

  /**
   * Reset cancelled state
   */
  resetCancel() {
    this.isCancelled = false;
  }

  /**
   * Report progress to UI
   */
  updateProgress(percent, stage = "") {
    if (this.onProgress && typeof this.onProgress === "function") {
      try {
        // Ensure we're sending a valid percentage
        const validPercent = Math.max(0, Math.min(100, percent));
        this.onProgress(validPercent, stage);
      } catch (e) {
        console.error("Error in progress callback:", e);
      }
    }
  }

  /**
   * Update status text
   */
  updateStatus(status) {
    if (this.onStatusUpdate && typeof this.onStatusUpdate === "function") {
      try {
        this.onStatusUpdate(status);
      } catch (e) {
        console.error("Error in status callback:", e);
      }
    }
  }

  /**
   * Helper to yield to UI thread
   */
  async yieldToUI() {
    return new Promise((resolve) => setTimeout(resolve, 0));
  }

  /**
   * Check if optimizer is ready and log status
   */
  isReady() {
    const status = {
      optimizerReady: this.optimizerReady,
      hasPlayerPool: Boolean(this.playerPool?.length),
      hasTeams: Boolean(this.teams?.length),
      hasCorrelationMatrix: Boolean(this.correlationMatrix?.size),
      hasPlayerPerfMap: Boolean(this.playerPerfMap?.size),
    };

    this.debugLog("Optimizer status check:", status);

    return this.optimizerReady;
  }

  /**
   * Update optimizer configuration
   */
  updateConfig(newConfig) {
    this.config = { ...this.config, ...newConfig };
    console.log("Updated optimizer config:", this.config);
    this.debugLog("Updated optimizer config:", this.config);
  }

  /**
   * Initialize the optimizer with player pool and exposure settings
   */
  async initialize(playerPool, exposureSettings = {}, existingLineups = []) {
    this.debugLog("Initializing advanced optimizer...");
    this.resetCancel();
    this.updateStatus("Initializing optimizer...");
    this.updateProgress(5, "initialization");

    try {
      // Validate player pool data
      if (
        !playerPool ||
        !Array.isArray(playerPool) ||
        playerPool.length === 0
      ) {
        console.error("Invalid player pool:", playerPool);
        throw new Error(
          "Invalid player pool data. Please make sure player projections are loaded."
        );
      }

      // Log sample player data
      if (playerPool.length > 0) {
        this.debugLog("Sample player data:", {
          id: playerPool[0].id,
          name: playerPool[0].name,
          position: playerPool[0].position,
          team: playerPool[0].team,
          projectedPoints: playerPool[0].projectedPoints,
          ownership: playerPool[0].ownership,
        });

        this.debugLog("Sample projectedPoints:", {
          raw: playerPool[0].projectedPoints,
          type: typeof playerPool[0].projectedPoints,
          asNumber: this._safeParseFloat(playerPool[0].projectedPoints),
          withFallback: this._safeParseFloat(playerPool[0].projectedPoints, 0),
        });
      }

      this.updateProgress(10, "processing_players");
      this.updateStatus("Processing player data...");
      await this.yieldToUI();

      // First set playerPool temporarily so methods can use it during preprocessing
      this.playerPool = playerPool;
      this.existingLineups = existingLineups || [];

      // Process exposure settings
      this._processExposureSettings(exposureSettings);
      this.updateProgress(20, "processing_exposures");
      await this.yieldToUI();

      if (this.isCancelled) {
        throw new Error("Initialization cancelled");
      }

      // Now preprocess with the raw player pool, storing the result after
      const processedPlayerPool = this._preprocessPlayerPool(playerPool);
      this.playerPool = processedPlayerPool;
      this.updateProgress(30, "extracting_teams");
      this.updateStatus("Extracting team data...");
      await this.yieldToUI();

      // Create and store team information
      this.teams = this._extractTeams(processedPlayerPool);
      this.debugLog(`Extracted ${this.teams.length} teams from player data`);
      this.updateProgress(40, "extracting_matchups");
      await this.yieldToUI();

      if (this.isCancelled) {
        throw new Error("Initialization cancelled");
      }

      // Extract matchups from player data
      this._extractTeamMatchups();
      this.updateProgress(50, "building_correlation");
      this.updateStatus("Building correlation matrix...");
      await this.yieldToUI();

      // Calculate team and player correlations
      this.correlationMatrix = this._buildCorrelationMatrix();
      this.debugLog(
        `Built correlation matrix with ${this.correlationMatrix.size} entries`
      );
      this.updateProgress(60, "initializing_performance");
      this.updateStatus("Generating player performance distributions...");
      await this.yieldToUI();

      if (this.isCancelled) {
        throw new Error("Initialization cancelled");
      }

      // Initialize player performance simulation map
      await this._initializePlayerPerformanceMap();
      this.debugLog(
        `Initialized performance map for ${this.playerPerfMap.size} players`
      );
      this.updateProgress(90, "initializing_exposures");
      this.updateStatus("Initializing exposure tracking...");
      await this.yieldToUI();

      // Initialize exposure tracking based on existing lineups
      this._initializeExposureTracking();

      // Optimizer is ready
      this.optimizerReady = true;
      this.updateProgress(100, "ready");
      this.updateStatus("Optimizer ready");
      this.debugLog("Advanced optimizer initialized successfully");
      return true;
    } catch (error) {
      console.error("Error initializing optimizer:", error);
      this.optimizerReady = false;
      this.updateStatus(`Error: ${error.message}`);
      this.updateProgress(100, "error");
      return false;
    }
  }

  /**
   * Extract team matchups from player data
   */
  _extractTeamMatchups() {
    this.debugLog("Extracting team matchups...");

    // First check if players already have opponent information
    const hasOpponentData = this.playerPool.some(
      (player) => player.opponent || player.opp || player.matchup || player.vs
    );

    if (hasOpponentData) {
      // Extract matchups from existing data
      this.debugLog("Found opponent data in player pool, extracting matchups");

      // Create a map of team -> opponent
      this.playerPool.forEach((player) => {
        if (!player.team) return;

        // Get opponent from any available field
        const opponent =
          player.opponent || player.opp || player.matchup || player.vs;

        if (opponent) {
          // Clean up opponent name (remove "vs" or "at" if present)
          let cleanOpponent = opponent;
          if (typeof cleanOpponent === "string") {
            if (cleanOpponent.startsWith("vs ")) {
              cleanOpponent = cleanOpponent.substring(3);
            } else if (cleanOpponent.startsWith("at ")) {
              cleanOpponent = cleanOpponent.substring(3);
            }
          }

          this.teamMatchups.set(player.team, cleanOpponent);
        }
      });
    } else {
      // No opponent data in player pool, create artificial matchups
      this.debugLog("No opponent data found, creating artificial matchups");

      // Get unique teams
      const teams = [
        ...new Set(this.playerPool.filter((p) => p.team).map((p) => p.team)),
      ];

      // Create matchups (match teams in pairs)
      for (let i = 0; i < teams.length; i += 2) {
        if (i + 1 < teams.length) {
          // Match teams in pairs
          this.teamMatchups.set(teams[i], teams[i + 1]);
          this.teamMatchups.set(teams[i + 1], teams[i]);
        } else if (i < teams.length) {
          // If we have an odd number of teams, the last one plays against first one
          this.teamMatchups.set(teams[i], teams[0]);
          this.teamMatchups.set(teams[0], teams[i]);
        }
      }
    }

    // Log the matchups for debugging
    this.debugLog(
      "Team matchups extracted:",
      Array.from(this.teamMatchups.entries()).map(
        ([team, opp]) => `${team} vs ${opp}`
      )
    );

    return this.teamMatchups;
  }

  /**
   * Get the opponent for a team
   */
  _getTeamOpponent(team) {
    if (!team) return "";
    return this.teamMatchups.get(team) || "";
  }

  /**
   * Process all exposure settings into internal format
   */
  _processExposureSettings(exposureSettings) {
    // Process player exposure settings
    this.playerExposures = [];
    if (exposureSettings?.players && Array.isArray(exposureSettings.players)) {
      this.playerExposures = exposureSettings.players.map((player) => ({
        id: player.id,
        name: player.name,
        min:
          player.min !== undefined && player.min !== null
            ? player.min / 100
            : 0,
        max:
          player.max !== undefined && player.max !== null
            ? player.max / 100
            : 1,
        target:
          player.target !== undefined && player.target !== null
            ? player.target / 100
            : null,
      }));
    }

    // Process team exposure settings - handle both regular and stack-specific exposures
    this.teamExposures = [];
    this.teamStackExposures = [];

    if (exposureSettings?.teams && Array.isArray(exposureSettings.teams)) {
      exposureSettings.teams.forEach((team) => {
        // Check if this is a stack-specific exposure setting
        if (team.stackSize !== undefined && team.stackSize !== null) {
          // This is a stack-specific exposure
          this.teamStackExposures.push({
            team: team.team,
            stackSize: team.stackSize,
            min:
              team.min !== undefined && team.min !== null ? team.min / 100 : 0,
            max:
              team.max !== undefined && team.max !== null ? team.max / 100 : 1,
            target:
              team.target !== undefined && team.target !== null
                ? team.target / 100
                : null,
          });
        } else {
          // Regular team exposure
          this.teamExposures.push({
            team: team.team,
            min:
              team.min !== undefined && team.min !== null ? team.min / 100 : 0,
            max:
              team.max !== undefined && team.max !== null ? team.max / 100 : 1,
            target:
              team.target !== undefined && team.target !== null
                ? team.target / 100
                : null,
          });
        }
      });
    }

    // Process position exposure settings
    this.positionExposures = {};
    if (exposureSettings?.positions) {
      for (const [position, settings] of Object.entries(
        exposureSettings.positions
      )) {
        this.positionExposures[position] = {
          min:
            settings.min !== undefined && settings.min !== null
              ? settings.min / 100
              : 0,
          max:
            settings.max !== undefined && settings.max !== null
              ? settings.max / 100
              : 1,
          target:
            settings.target !== undefined && settings.target !== null
              ? settings.target / 100
              : null,
        };
      }
    }

    this.debugLog("Processed exposure settings:", {
      playerCount: this.playerExposures.length,
      teamCount: this.teamExposures.length,
      teamStackCount: this.teamStackExposures.length,
      positions: Object.keys(this.positionExposures),
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
      positions: new Map(),
    };

    if (!this.existingLineups || this.existingLineups.length === 0) {
      this.debugLog("No existing lineups to track exposure for");
      return;
    }

    // Count occurrences in existing lineups
    this.existingLineups.forEach((lineup) => {
      this._trackLineupExposure(lineup);
    });

    this.debugLog("Initialized exposure tracking from existing lineups", {
      playerCount: this.exposureTracking.players.size,
      teamCount: this.exposureTracking.teams.size,
      teamStackCount: this.exposureTracking.teamStacks.size,
      positionCount: this.exposureTracking.positions.size,
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
      const position = lineup.cpt.position || "CPT";
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

      lineup.players.forEach((player) => {
        if (!player) return;

        trackPlayer(player);

        // Track position
        if (player.position) {
          const posCount =
            this.exposureTracking.positions.get(player.position) || 0;
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
   */
  _safeParseFloat(value, fallback = 0) {
    // Handle null/undefined
    if (value == null) return fallback;

    // Convert to string if it's not already
    const strValue = String(value).trim();

    // Handle empty string
    if (strValue === "") return fallback;

    // Try to parse as float
    const parsed = parseFloat(strValue);

    // Return fallback if NaN
    return isNaN(parsed) ? fallback : parsed;
  }

  /**
   * Preprocess player pool to add required optimizer properties
   */
  _preprocessPlayerPool(playerPool) {
    return playerPool.map((player) => {
      // Debug any problematic players
      const projPoints = this._safeParseFloat(player.projectedPoints, 0);
      if (
        projPoints === 0 &&
        player.projectedPoints !== undefined &&
        player.projectedPoints !== 0
      ) {
        console.warn("Warning: Player with invalid projectedPoints:", {
          name: player.name,
          projectedPoints: player.projectedPoints,
          parsed: projPoints,
        });
      }

      return {
        ...player,
        optId: player.id,
        position: player.position || "UNKNOWN",
        projectedPoints: projPoints,
        salary: this._safeParseFloat(player.salary, 0),
        team: player.team || "UNKNOWN",
        ownership: this._safeParseFloat(player.ownership, 0), // Keep as percentage
        stdDev: this._calculateStdDev({
          ...player,
          projectedPoints: projPoints,
        }),
        minExposure: this._getPlayerMinExposure(player),
        maxExposure: this._getPlayerMaxExposure(player),
        targetExposure: this._getPlayerTargetExposure(
          { ...player, projectedPoints: projPoints },
          playerPool
        ),
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

    switch (player.position) {
      case "MID":
      case "ADC":
        positionVolatility = 0.4;
        break;
      case "TOP":
      case "JNG":
        positionVolatility = 0.35;
        break;
      case "SUP":
        positionVolatility = 0.25;
        break;
      case "TEAM":
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
    const teamNames = [
      ...new Set(playerPool.map((player) => player.team)),
    ].filter(Boolean);

    // Create team objects with players
    return teamNames.map((teamName) => {
      const teamPlayers = playerPool.filter((p) => p.team === teamName);

      // Calculate team stats with safe number parsing
      const totalSalary = teamPlayers.reduce(
        (sum, p) => sum + this._safeParseFloat(p.salary, 0),
        0
      );
      const totalProjection = teamPlayers.reduce(
        (sum, p) => sum + this._safeParseFloat(p.projectedPoints, 0),
        0
      );
      const avgOwnership =
        teamPlayers.length > 0
          ? teamPlayers.reduce(
              (sum, p) => sum + this._safeParseFloat(p.ownership, 0),
              0
            ) / teamPlayers.length
          : 0;

      return {
        name: teamName,
        players: teamPlayers,
        totalSalary,
        totalProjection,
        avgOwnership,
        // Store players by position for easy access
        playersByPosition: {
          TOP: teamPlayers.filter((p) => p.position === "TOP"),
          JNG: teamPlayers.filter((p) => p.position === "JNG"),
          MID: teamPlayers.filter((p) => p.position === "MID"),
          ADC: teamPlayers.filter((p) => p.position === "ADC"),
          SUP: teamPlayers.filter((p) => p.position === "SUP"),
        },
      };
    });
  }

  /**
   * Get player min exposure based on settings
   */
  _getPlayerMinExposure(player) {
    // Find player-specific setting
    const playerSetting = this.playerExposures.find((p) => p.id === player.id);
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
    const playerSetting = this.playerExposures.find((p) => p.id === player.id);
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
   */
  _getPlayerTargetExposure(player, playerPool = null) {
    // Find player-specific setting
    const playerSetting = this.playerExposures.find((p) => p.id === player.id);
    if (
      playerSetting &&
      playerSetting.target !== undefined &&
      playerSetting.target !== null
    ) {
      return playerSetting.target;
    }

    // Check position-specific setting
    if (
      this.positionExposures[player.position] &&
      this.positionExposures[player.position].target !== undefined &&
      this.positionExposures[player.position].target !== null
    ) {
      return this.positionExposures[player.position].target;
    }

    // If no target is set, calculate a smart target based on projection
    // This mimics how SaberSim auto-adjusts exposure
    const projPoints = this._safeParseFloat(player.projectedPoints, 0);
    if (projPoints > 0) {
      // Scale target exposure based on projection percentile
      const projectionPercentile = this._getProjectionPercentile(
        player,
        playerPool
      );

      // Scale from min to max exposure based on percentile
      const min = this._getPlayerMinExposure(player);
      const max = this._getPlayerMaxExposure(player);

      // Higher projections get more exposure, but leverage ownership
      const playerOwnership =
        this._safeParseFloat(player.ownership, 0.01); // Ensure not zero
      const leverageAdjustment = Math.min(
        1,
        projPoints / Math.max(0.1, playerOwnership) / 1.5
      );

      return min + (max - min) * projectionPercentile * leverageAdjustment;
    }

    // Default to average of min and max
    const min = this._getPlayerMinExposure(player);
    const max = this._getPlayerMaxExposure(player);
    return (min + max) / 2;
  }

  /**
   * Build correlation matrix for all players
   */
  _buildCorrelationMatrix() {
    const matrix = new Map();

    // Function to get/set correlation
    const getOrCreate = (id1, id2) => {
      const key = [id1, id2].sort().join("_");
      if (!matrix.has(key)) {
        matrix.set(key, 0);
      }
      return key;
    };

    // Process all players
    this.playerPool.forEach((player1) => {
      this.playerPool.forEach((player2) => {
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
    const key = [player1Id, player2Id].sort().join("_");
    return this.correlationMatrix.get(key) || 0;
  }

  /**
   * Calculate player projection percentile among players in same position
   */
  _getProjectionPercentile(player, customPlayerPool = null) {
    // Use provided player pool or instance's player pool
    const playerPool = customPlayerPool || this.playerPool;

    if (!playerPool || !Array.isArray(playerPool)) {
      console.warn("No valid player pool available for percentile calculation");
      return 0.5; // Default to middle percentile if no data
    }

    // Get players in same position
    const positionPlayers = playerPool.filter(
      (p) => p.position === player.position
    );

    if (positionPlayers.length <= 1) {
      return 0.5; // Only one player in position, return middle percentile
    }

    // Sort by projection, ensuring proper numeric sorting
    positionPlayers.sort((a, b) => {
      return (
        this._safeParseFloat(a.projectedPoints, 0) -
        this._safeParseFloat(b.projectedPoints, 0)
      );
    });

    // Find player index
    const playerIndex = positionPlayers.findIndex((p) => p.id === player.id);

    if (playerIndex === -1) {
      console.warn(
        `Player ${player.name} (${player.id}) not found in position players`
      );
      return 0.5; // Player not found, return middle percentile
    }

    // Calculate percentile (0-1)
    return playerIndex / Math.max(1, positionPlayers.length - 1);
  }

  /**
   * Initialize player performance map with simulated performances
   */
  async _initializePlayerPerformanceMap() {
    this.playerPerfMap.clear();

    const iterations = this.config.iterations;
    this.debugLog(
      `Initializing Monte Carlo simulation with ${iterations} iterations...`
    );

    // For performance, use TypedArrays instead of regular arrays
    this.playerPool.forEach((player) => {
      // Use Float32Array for better memory efficiency and performance
      this.playerPerfMap.set(player.id, new Float32Array(iterations));
    });

    // Increase batch size significantly for better performance
    const batchSize = 2000;
    const batches = Math.ceil(iterations / batchSize);

    // Use SharedArrayBuffer if available for parallel processing
    const useSharedMemory = typeof SharedArrayBuffer !== "undefined";

    for (let batch = 0; batch < batches; batch++) {
      if (this.isCancelled) {
        this.debugLog("Performance map initialization cancelled");
        return;
      }

      const currentBatchSize = Math.min(
        batchSize,
        iterations - batch * batchSize
      );

      // Process batches concurrently when possible
      await Promise.all(
        // Split processing into chunks for better UI responsiveness
        Array.from({ length: 4 }, (_, chunkIndex) => {
          const chunkStart = Math.floor((currentBatchSize * chunkIndex) / 4);
          const chunkEnd = Math.floor(
            (currentBatchSize * (chunkIndex + 1)) / 4
          );

          return new Promise((resolve) => {
            setTimeout(() => {
              // Process this chunk
              this.playerPool.forEach((player) => {
                const performances = this.playerPerfMap.get(player.id);
                const baseOffset = batch * batchSize;

                // Use loop unrolling for better performance
                for (let i = chunkStart; i < chunkEnd; i += 4) {
                  const idx = baseOffset + i;

                  // Generate 4 performances at once (loop unrolling)
                  if (i < chunkEnd)
                    performances[idx] = this._generatePlayerPerformance(
                      player,
                      idx
                    );
                  if (i + 1 < chunkEnd)
                    performances[idx + 1] = this._generatePlayerPerformance(
                      player,
                      idx + 1
                    );
                  if (i + 2 < chunkEnd)
                    performances[idx + 2] = this._generatePlayerPerformance(
                      player,
                      idx + 2
                    );
                  if (i + 3 < chunkEnd)
                    performances[idx + 3] = this._generatePlayerPerformance(
                      player,
                      idx + 3
                    );
                }
              });
              resolve();
            }, 0);
          });
        })
      );

      // Update progress less frequently for better performance
      if (batch % 2 === 0) {
        const progress = Math.min(
          60,
          30 + Math.floor(((batch + 1) / batches) * 30)
        );
        this.updateProgress(progress, "generating_performance_data");

        // Only log every few batches
        if (batches > 5 && batch % 5 === 0) {
          this.debugLog(
            `Simulation progress: ${Math.round(((batch + 1) / batches) * 100)}%`
          );
          this.updateStatus(
            `Generating player performance distributions... ${Math.round(
              ((batch + 1) / batches) * 100
            )}%`
          );
          await this.yieldToUI();
        }
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

    this.resetCancel();
    this.updateStatus("Starting Monte Carlo simulation...");
    this.updateProgress(0, "starting_simulation");
    this.debugLog(`Running Monte Carlo simulation for ${count} lineups...`);

    // Clear previous results
    this.simulationResults = [];

    try {
      // Phase 1: Generate lineups (40% of progress)
      this.updateStatus("Generating lineups...");
      this.updateProgress(5, "generating_lineups");

      const lineups = await this._generateLineups(count);
      if (this.isCancelled) throw new Error("Simulation cancelled");

      this.updateProgress(40, "preparing_simulation");
      this.updateStatus("Preparing to simulate lineups...");
      await this.yieldToUI();

      // Phase 2: Run simulations on each lineup (40% of progress)
      // Process in batches to keep UI responsive
      const batchSize = 5; // Process 5 lineups at a time
      const totalBatches = Math.ceil(lineups.length / batchSize);

      for (let batchIndex = 0; batchIndex < totalBatches; batchIndex++) {
        if (this.isCancelled) throw new Error("Simulation cancelled");

        const startIdx = batchIndex * batchSize;
        const endIdx = Math.min(startIdx + batchSize, lineups.length);

        // Update status with progress
        this.updateStatus(
          `Simulating lineup performance... (${Math.min(
            endIdx,
            lineups.length
          )}/${lineups.length})`
        );

        // Process this batch of lineups
        await new Promise((resolve) => {
          setTimeout(async () => {
            // Process each lineup in this batch
            for (let i = startIdx; i < endIdx; i++) {
              const lineup = lineups[i];
              const result = await this._simulateLineup(lineup);
              this.simulationResults.push(result);

              // Micro-progress update within batch
              const lineupProgress =
                40 +
                ((batchIndex * batchSize + (i - startIdx) + 1) /
                  lineups.length) *
                  40;
              this.updateProgress(lineupProgress, "simulating_lineups");
            }
            resolve();
          }, 0);
        });

        // Yield to UI thread between batches
        await this.yieldToUI();

        // Progress update for batch
        const batchProgress = 40 + ((batchIndex + 1) / totalBatches) * 40;
        this.updateProgress(batchProgress, "simulating_lineups");
      }

      if (this.isCancelled) throw new Error("Simulation cancelled");

      // Phase 3: Calculate global metrics and finalize results (20% of progress)
      this.updateStatus("Analyzing results...");
      this.updateProgress(80, "analyzing_results");
      await this.yieldToUI();

      // Create arrays to store all simulation results
      const allPerformances = [];
      const lineupIndexMap = [];

      // Store all simulated performances with lineup references
      this.simulationResults.forEach((lineup, lineupIndex) => {
        lineup.performances.forEach((perf) => {
          allPerformances.push(perf);
          lineupIndexMap.push(lineupIndex);
        });
      });

      // Sort performances to find contest thresholds
      allPerformances.sort((a, b) => b - a); // Sort descending

      // Determine global thresholds
      const totalSims = allPerformances.length;

      // Use field size to determine thresholds
      const fieldSize = this.config.fieldSize || 1000; // Default field size if not specified

      // Calculate thresholds based on field size
      // Calculate how many entries make it to first place (usually top 0.1% of field)
      const firstPlaceCount = Math.max(1, Math.ceil(fieldSize * 0.001));
      const firstPlaceThreshold =
        allPerformances[Math.min(firstPlaceCount - 1, totalSims - 1)];

      // Calculate how many entries make top 10 (usually top ~1% of field)
      const top10Count = Math.max(10, Math.ceil(fieldSize * 0.01));
      const top10Threshold =
        allPerformances[Math.min(top10Count - 1, totalSims - 1)];

      // Calculate how many entries cash (usually top ~20% of field)
      const cashCount = Math.max(20, Math.ceil(fieldSize * 0.2));
      const cashThreshold =
        allPerformances[Math.min(cashCount - 1, totalSims - 1)];

      this.debugLog(
        `Global thresholds: Field size=${fieldSize}, 1st=${firstPlaceThreshold} (top ${firstPlaceCount}), Top10=${top10Threshold} (top ${top10Count}), Cash=${cashThreshold} (top ${cashCount})`
      );

      this.updateProgress(85, "calculating_thresholds");
      await this.yieldToUI();

      // Process results in batches for UI responsiveness
      const resultBatchSize = 10;
      const resultBatches = Math.ceil(
        this.simulationResults.length / resultBatchSize
      );

      for (let resultBatch = 0; resultBatch < resultBatches; resultBatch++) {
        if (this.isCancelled) throw new Error("Simulation cancelled");

        const startIdx = resultBatch * resultBatchSize;
        const endIdx = Math.min(
          startIdx + resultBatchSize,
          this.simulationResults.length
        );

        await new Promise((resolve) => {
          setTimeout(() => {
            // Calculate each lineup's results against these global thresholds
            for (let i = startIdx; i < endIdx; i++) {
              const lineup = this.simulationResults[i];
              const iterations = lineup.performances.length;
              const firstPlaceCount = lineup.performances.filter(
                (p) => p >= firstPlaceThreshold
              ).length;
              const top10Count = lineup.performances.filter(
                (p) => p >= top10Threshold
              ).length;
              const cashCount = lineup.performances.filter(
                (p) => p >= cashThreshold
              ).length;

              // Update metrics with new global values - NUMERIC VALUES (not strings)
              lineup.firstPlace = (firstPlaceCount / iterations) * 100;
              lineup.top10 = (top10Count / iterations) * 100;
              lineup.cashRate = (cashCount / iterations) * 100;

              // Calculate ROI based on NexusScore instead
              // This provides more stable and interpretable results
              if (lineup.nexusScore) {
                lineup.roi = (lineup.nexusScore / 100) * 200 - 50;
              } else {
                // If NexusScore not calculated yet, use a temporary placeholder
                // that will be replaced after NexusScore calculation
                lineup.roi = 0;
              }
            }
            resolve();
          }, 0);
        });

        // Update progress for this batch
        const resultProgress = 85 + ((resultBatch + 1) / resultBatches) * 5;
        this.updateProgress(resultProgress, "calculating_metrics");
        await this.yieldToUI();
      }

      if (this.isCancelled) throw new Error("Simulation cancelled");

      // Calculate NexusScore for each lineup
      this.updateStatus("Calculating NexusScore...");
      this.updateProgress(90, "calculating_nexusscore");
      await this.yieldToUI();

      // Process NexusScore calculations in batches
      const nexusBatchSize = 10;
      const nexusBatches = Math.ceil(
        this.simulationResults.length / nexusBatchSize
      );

      for (let nexusBatch = 0; nexusBatch < nexusBatches; nexusBatch++) {
        if (this.isCancelled) throw new Error("Simulation cancelled");

        const startIdx = nexusBatch * nexusBatchSize;
        const endIdx = Math.min(
          startIdx + nexusBatchSize,
          this.simulationResults.length
        );

        await new Promise((resolve) => {
          setTimeout(() => {
            for (let i = startIdx; i < endIdx; i++) {
              const lineup = this.simulationResults[i];
              const nexusResult = this._calculateNexusScore(lineup);
              lineup.nexusScore = nexusResult.score;
              lineup.scoreComponents = nexusResult.components;

              // Update ROI calculation after NexusScore is calculated
              lineup.roi = (lineup.nexusScore / 100) * 200 - 50;
            }
            resolve();
          }, 0);
        });

        // Update progress for this batch
        const nexusProgress = 90 + ((nexusBatch + 1) / nexusBatches) * 5;
        this.updateProgress(nexusProgress, "calculating_nexusscore");
        await this.yieldToUI();
      }

      if (this.isCancelled) throw new Error("Simulation cancelled");

      // Sort by ROI descending, then by NexusScore for ties
      this.simulationResults.sort((a, b) => {
        // If ROIs are the same, sort by NexusScore
        if (b.roi === a.roi) {
          return b.nexusScore - a.nexusScore;
        }
        // Otherwise sort by ROI
        return b.roi - a.roi;
      });

      // Final steps
      this.updateStatus("Finalizing results...");
      this.updateProgress(95, "finalizing");
      await this.yieldToUI();

      // Create summary
      const summary = this._getSimulationSummary();

      this.updateProgress(100, "completed");
      this.updateStatus("Simulation completed successfully");
      this.debugLog("Simulation complete");

      return {
        lineups: this.simulationResults,
        summary,
      };
    } catch (error) {
      this.updateStatus(`Error: ${error.message}`);
      this.updateProgress(100, "error");
      this.debugLog(`Simulation error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Calculate NexusScore - a comprehensive lineup evaluation metric
   */
  _calculateNexusScore(lineup) {
    // 1. Base projection (sum of all players' projected points)
    let baseProjection = 0;

    // Calculate captain's points (1.5x)
    const cptPlayer = this.playerPool.find((p) => p.id === lineup.cpt.id);
    if (cptPlayer) {
      baseProjection +=
        this._safeParseFloat(cptPlayer.projectedPoints, 0) * 1.5;
    }

    // Add regular players' points
    for (const player of lineup.players) {
      const poolPlayer = this.playerPool.find((p) => p.id === player.id);
      if (poolPlayer) {
        baseProjection += this._safeParseFloat(poolPlayer.projectedPoints, 0);
      }
    }

    // 2. Calculate ownership leverage
    // Average ownership across all players in the lineup
    let totalOwnership = 0;
    let playerCount = 0;

    if (cptPlayer) {
      totalOwnership += this._safeParseFloat(cptPlayer.ownership, 0);
      playerCount++;
    }

    for (const player of lineup.players) {
      const poolPlayer = this.playerPool.find((p) => p.id === player.id);
      if (poolPlayer) {
        totalOwnership += this._safeParseFloat(poolPlayer.ownership, 0);
        playerCount++;
      }
    }

    const avgLineupOwnership =
      playerCount > 0 ? totalOwnership / playerCount : 0;

    // Calculate average field ownership
    const fieldAvgOwnership =
      this.playerPool.reduce(
        (sum, p) => sum + this._safeParseFloat(p.ownership, 0),
        0
      ) / Math.max(1, this.playerPool.length);

    // Leverage factor - reward lineups with lower ownership
    // Scale: 0.5 at 2x avg ownership, 1.5 at 0.5x avg ownership
    const ownershipRatio =
      fieldAvgOwnership > 0 ? avgLineupOwnership / fieldAvgOwnership : 1;
    const leverageFactor = Math.max(0.5, Math.min(1.5, 2 - ownershipRatio));

    // 3. Team synergy bonus (reward effective stacking)
    const teamCounts = {};

    // Count captain's team
    if (lineup.cpt && lineup.cpt.team) {
      teamCounts[lineup.cpt.team] = 1;
    }

    // Count regular players' teams
    for (const player of lineup.players) {
      if (player.team) {
        teamCounts[player.team] = (teamCounts[player.team] || 0) + 1;
      }
    }

    // Calculate stack bonus
    let stackBonus = 0;
    for (const [team, count] of Object.entries(teamCounts)) {
      // Exponential bonus for larger stacks
      if (count >= 3) {
        stackBonus += Math.pow(count - 2, 1.5) * 3;
      }
    }

    // 4. Position impact weighting
    // Certain positions have higher ceiling/impact
    let positionBonus = 0;

    // Position impact values (based on volatility and ceiling)
    const positionImpact = {
      MID: 2, // High carry potential
      ADC: 1.8, // High carry potential
      JNG: 1.5, // Game influence
      TOP: 1.2, // Moderate impact
      SUP: 1.0, // Lower ceiling
      TEAM: 0.8, // Consistent but limited upside
    };

    // Check if captain is in a high-impact position
    if (cptPlayer) {
      const posImpact = positionImpact[cptPlayer.position] || 1;
      positionBonus += posImpact * 2; // Double impact for captain
    }

    // 5. Calculate consistency/ceiling factor using performance simulation data
    let consistencyFactor = 1;

    // If we have simulation data for this lineup
    const simData = this.simulationResults.find((r) => r.id === lineup.id);
    if (simData && simData.performances) {
      // Calculate coefficient of variation (higher = more volatile)
      const mean = simData.median || baseProjection;
      const stdDev =
        simData.p90 && simData.p10 ? (simData.p90 - simData.p10) / 2.56 : 0;

      // Slight bonus for moderate volatility, penalty for extreme volatility
      const cv = mean > 0 ? stdDev / mean : 0;
      consistencyFactor = 1 + 0.2 * Math.sin(Math.PI * (cv * 2)); // Peaks at CV=0.25, dips at CV=0.5
    }

    // 6. Combine all factors for final NexusScore
    // Scale the base projection by our modifiers
    const nexusScore =
      baseProjection * leverageFactor * consistencyFactor +
      stackBonus +
      positionBonus;

    // Add component breakdown for UI explanation
    const scoreComponents = {
      baseProjection,
      leverageFactor,
      avgOwnership: avgLineupOwnership,
      fieldAvgOwnership,
      stackBonus,
      positionBonus,
      consistencyFactor,
      teamStacks: Object.entries(teamCounts)
        .filter(([_, count]) => count >= 2)
        .map(([team, count]) => `${team} (${count})`)
        .join(", "),
    };

    return {
      score: Math.round(nexusScore * 10) / 10, // Round to 1 decimal
      components: scoreComponents,
    };
  }

  /**
   * Generate optimized lineups with constraints
   */
  async _generateLineups(count) {
    this.debugLog(`Generating ${count} optimized lineups...`);
    this.updateStatus(`Generating ${count} lineups...`);

    const lineups = [];
    const lineupSignatures = new Set(); // Track unique lineup signatures
    const maxAttempts = count * 50; // Increase max attempts significantly
    let attempts = 0;
    let consecutiveFailures = 0;
    const maxConsecutiveFailures = 100; // Stop if we can't generate unique lineups

    // Reset exposure tracking for new generation
    this._initializeExposureTracking();

    // If we already have existing lineups, track their exposures
    if (this.existingLineups && this.existingLineups.length > 0) {
      this.existingLineups.forEach((lineup) => {
        this._trackLineupExposure(lineup);
      });
    }

    // Process in small batches to keep UI responsive
    const targetBatchSize = 1; // Generate one unique lineup at a time for better control

    while (lineups.length < count && attempts < maxAttempts && consecutiveFailures < maxConsecutiveFailures) {
      if (this.isCancelled) {
        this.debugLog("Lineup generation cancelled");
        break;
      }

      attempts++;

      try {
        // Update status every 10 attempts
        if (attempts % 10 === 0) {
          this.updateStatus(`Generating lineups... (${lineups.length}/${count}) - Attempt ${attempts}`);
          
          // Update progress - scales from 5% to 40% during generation
          const progress = 5 + (lineups.length / count) * 35;
          this.updateProgress(progress, "generating_lineups");
        }

        // Generate a lineup with enhanced randomness to prevent duplicates
        const currentLineupCount = lineups.length;
        const lineup = await this._buildLineup(lineups, currentLineupCount);

        // Create signature for quick duplicate checking
        const signature = [lineup.cpt.id, ...lineup.players.map(p => p.id)].sort().join('|');

        // Check if lineup is valid and unique
        if (this._isValidLineup(lineup, lineups) && !lineupSignatures.has(signature)) {
          // Additional diversity check only if we have multiple lineups
          const hasSufficientDiversity = lineups.length === 0 || this._hasSufficientDiversity(lineup, lineups);
          
          if (hasSufficientDiversity) {
            // Track exposures for the new lineup
            this._trackLineupExposure(lineup);
            lineups.push(lineup);
            lineupSignatures.add(signature);
            consecutiveFailures = 0; // Reset failure counter
            
            this.debugLog(`Lineup accepted: ${lineups.length}/${count} (attempts: ${attempts})`);
            
            // Increase randomness for next lineup to ensure diversity
            this.config.randomness = Math.min(0.9, this.config.randomness + 0.05);
          } else {
            consecutiveFailures++;
            this.debugLog(`Diversity rejected: ${consecutiveFailures} consecutive failures`);
          }
        } else {
          consecutiveFailures++;
          if (lineupSignatures.has(signature)) {
            this.debugLog(`Duplicate rejected: signature already exists`);
          }
        }

        // Yield to UI thread occasionally
        if (attempts % 5 === 0) {
          await this.yieldToUI();
        }

      } catch (error) {
        console.error("Error generating lineup:", error);
        consecutiveFailures++;
        await this.yieldToUI();
      }
    }

    // Log final generation results
    if (lineups.length < count) {
      const reason = consecutiveFailures >= maxConsecutiveFailures ? 
        "too many consecutive failures (not enough unique combinations)" : 
        "maximum attempts reached";
      this.debugLog(`Generation stopped: ${reason}. Generated ${lineups.length}/${count} unique lineups`);
      this.updateStatus(`Generated ${lineups.length} unique lineups (${reason})`);
    }

    // Store generated lineups
    this.generatedLineups = lineups;

    this.debugLog(
      `Generated ${lineups.length} lineups in ${attempts} attempts`
    );
    this.updateProgress(40, "lineups_generated");
    this.updateStatus(`Generated ${lineups.length} lineups`);

    return lineups;
  }

  /**
   * Check if a team needs more exposure based on current constraints
   * Now includes stack-specific exposure checks
   */
  _teamNeedsExposure(team, stackSize = null) {
    const totalLineups =
      this.generatedLineups.length + this.existingLineups.length;
    if (totalLineups === 0) return true; // Always need exposure for first lineup

    // Check stack-specific exposure first if a stack size is provided
    if (stackSize !== null) {
      const stackKey = `${team}_${stackSize}`;
      const stackCount = this.exposureTracking.teamStacks.get(stackKey) || 0;
      const currentPct = stackCount / totalLineups;

      // Find the stack-specific constraint
      const stackConstraint = this.teamStackExposures.find(
        (te) => te.team === team && te.stackSize === stackSize
      );

      if (stackConstraint && stackConstraint.min > 0) {
        // Need more exposure if below min
        if (currentPct < stackConstraint.min) {
          this.debugLog(
            `Team ${team} needs more ${stackSize}-stack exposure: ${
              currentPct * 100
            }% < ${stackConstraint.min * 100}%`
          );
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
    const teamConstraint = this.teamExposures.find((te) => te.team === team);

    if (teamConstraint && teamConstraint.min > 0) {
      // Need more exposure if below min
      if (currentPct < teamConstraint.min) {
        this.debugLog(
          `Team ${team} needs more general exposure: ${currentPct * 100}% < ${
            teamConstraint.min * 100
          }%`
        );
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
   */
  async _buildLineup(existingLineups = [], currentLineupCount = 0) {
    // Increment global counter to ensure unique IDs
    lineupCounter++;

    // Create a unique seed for this lineup to inject additional randomness
    const lineupSeed = Math.random() * 1000 + currentLineupCount * 13 + Date.now() % 1000;
    
    // Use the seed to initialize a pseudorandom sequence for this lineup
    Math.seedrandom = Math.seedrandom || ((seed) => {
      let m = 0x80000000; // pow(2,31)
      let a = 1103515245;
      let c = 12345;
      let state = seed ? seed : Math.floor(Math.random() * (m - 1));
      return () => {
        state = (a * state + c) % m;
        return state / (m - 1);
      };
    });
    
    const lineupRandom = Math.seedrandom(lineupSeed);

    // Start with empty lineup
    const lineup = {
      id: `lineup_${Date.now()}_${lineupCounter}`,
      name: `Optimized Lineup ${currentLineupCount + 1}`,
      cpt: null,
      players: [],
      _seed: lineupSeed, // Store seed for debugging
    };

    // Track used players and salary
    const usedPlayers = new Set();
    let remainingSalary = this.config.salaryCap;

    // Track team usage for this lineup
    const teamCounts = {};

    // Calculate current exposure metrics
    const totalLineups =
      this.generatedLineups.length + this.existingLineups.length;

    // Select a stack team with consideration of stack-specific exposures and added randomness
    const stackTeam = this._selectStackTeam(currentLineupCount, lineupSeed);

    // Start counting players from this team
    teamCounts[stackTeam.name] = 0;

    // Determine stack size based on constraints
    let stackSize = null;

    // Check if this team has any stack-specific constraints
    const teamStackConstraints = this.teamStackExposures.filter(
      (tc) => tc.team === stackTeam.name
    );

    if (teamStackConstraints.length > 0) {
      // Find underexposed stack sizes
      const underexposedStacks = teamStackConstraints.filter((tc) => {
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
          return aPct - a.min - (bPct - b.min); // Most negative = most underexposed relative to min
        })[0];

        stackSize = targetStack.stackSize;
        this.debugLog(
          `Selected ${stackSize}-stack for team ${stackTeam.name} based on exposure constraints`
        );
      }
    }

    // Select a captain
    lineup.cpt = this._selectCaptain(stackTeam, usedPlayers, stackSize, lineupSeed);
    usedPlayers.add(lineup.cpt.id);
    remainingSalary -= lineup.cpt.salary;

    // Update team counts for captain
    if (lineup.cpt.team) {
      teamCounts[lineup.cpt.team] = (teamCounts[lineup.cpt.team] || 0) + 1;
    }

    // Find available positions in player pool
    const availablePositions = new Set(this.playerPool.map((p) => p.position));

    // Create a prioritized list of positions to fill
    const positionsToFill = Object.entries(this.config.positionRequirements)
      .filter(([pos, count]) => {
        // Skip captain (already handled)
        if (pos === "CPT") return false;

        // For TEAM position, only include if it exists in the player pool
        if (pos === "TEAM" && !availablePositions.has("TEAM")) {
          return false;
        }

        return true;
      })
      .sort(([posA], [posB]) => {
        // Prioritize positions: Core positions first, TEAM last if it exists
        const order = { TOP: 1, JNG: 2, MID: 3, ADC: 4, SUP: 5, TEAM: 6 };
        return (order[posA] || 99) - (order[posB] || 99);
      });

    // Now fill each position in the prioritized order
    for (const [position, count] of positionsToFill) {
      for (let i = 0; i < count; i++) {
        // Special handling for TEAM position
        if (position === "TEAM") {
          // First try to get TEAM player from stack team
          let teamPlayers = this.playerPool.filter(
            (player) =>
              !usedPlayers.has(player.id) &&
              player.position === "TEAM" &&
              player.team === stackTeam.name &&
              this._safeParseFloat(player.salary, 0) <= remainingSalary
          );

          // If no TEAM players from stack team, get any TEAM player
          if (teamPlayers.length === 0) {
            teamPlayers = this.playerPool.filter(
              (player) =>
                !usedPlayers.has(player.id) &&
                player.position === "TEAM" &&
                this._safeParseFloat(player.salary, 0) <= remainingSalary
            );
          }

          // If we found a TEAM player
          if (teamPlayers.length > 0) {
            // Select the TEAM player with highest projection
            const selectedTeamPlayer = teamPlayers.sort(
              (a, b) =>
                this._safeParseFloat(b.projectedPoints, 0) -
                this._safeParseFloat(a.projectedPoints, 0)
            )[0];

            const player = {
              id: selectedTeamPlayer.id,
              name: selectedTeamPlayer.name,
              position: "TEAM",
              team: selectedTeamPlayer.team,
              opponent: this._getTeamOpponent(selectedTeamPlayer.team),
              salary: this._safeParseFloat(selectedTeamPlayer.salary, 0),
            };

            // Update team counts for the TEAM position
            if (player.team) {
              teamCounts[player.team] = (teamCounts[player.team] || 0) + 1;
            }

            lineup.players.push(player);
            usedPlayers.add(player.id);
            remainingSalary -= player.salary;
          } else {
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
            stackSize,
            teamCounts,
            lineupSeed
          );

          if (player) {
            // Update team counts for this player
            if (player.team) {
              teamCounts[player.team] = (teamCounts[player.team] || 0) + 1;
            }

            lineup.players.push(player);
            usedPlayers.add(player.id);
            remainingSalary -= player.salary;
          } else {
            throw new Error(`Couldn't find player for position ${position}`);
          }
        }
      }
    }

    // Balance team exposures if needed
    this._balanceTeamExposures(lineup, usedPlayers, remainingSalary);

    // Debug: Log the final lineup composition
    const lineupSummary = [lineup.cpt.name, ...lineup.players.map(p => p.name)].join(', ');
    this.debugLog(`Built lineup ${currentLineupCount + 1}: ${lineupSummary}`);

    return lineup;
  }

  /**
   * Select a team to stack with enhanced randomness
   */
  _selectStackTeam(currentLineupCount = 0, lineupSeed = 0) {
    // First check for teams with specific stack requirements
    const teamsNeedingExposure = [];

    // Check regular team exposures
    this.teamExposures.forEach((team) => {
      if (team.min > 0 && this._teamNeedsExposure(team.team)) {
        teamsNeedingExposure.push(team.team);
      }
    });

    // Check stack-specific exposures
    this.teamStackExposures.forEach((stack) => {
      if (
        stack.min > 0 &&
        this._teamNeedsExposure(stack.team, stack.stackSize)
      ) {
        teamsNeedingExposure.push(stack.team);
      }
    });

    // If we have teams that need exposure, prioritize them
    if (teamsNeedingExposure.length > 0) {
      // Pick a random team from those needing exposure
      const teamName =
        teamsNeedingExposure[
          Math.floor(Math.random() * teamsNeedingExposure.length)
        ];
      const team = this.teams.find((t) => t.name === teamName);

      if (team) {
        this.debugLog(
          `Selected team ${teamName} based on exposure requirements`
        );
        return team;
      }
    }

    // Otherwise weight teams by projection and adjust by existing exposures
    const teamWeights = this.teams.map((team) => {
      // Get projection value
      const projectionValue = team.totalProjection;

      // Get target exposure (if any)
      const exposureSetting = this.teamExposures.find(
        (te) => te.team === team.name
      );
      const targetExposure = exposureSetting?.target || 0.5; // Default to 50% if no target

      // Calculate current exposure
      const totalLineups =
        this.generatedLineups.length + this.existingLineups.length;
      const teamCount = this.exposureTracking.teams.get(team.name) || 0;
      const currentExposure =
        totalLineups > 0 ? teamCount / (totalLineups * 6) : 0;

      // Adjust weight based on exposure gap
      const exposureGap = targetExposure - currentExposure;
      const exposureMultiplier = Math.max(0.1, 1 + exposureGap);

      return {
        team,
        weight: projectionValue * exposureMultiplier,
      };
    });

    // Filter out teams with zero weight
    const validTeams = teamWeights.filter((tw) => tw.weight > 0);

    // If no valid teams with weight, just use all teams
    const teamsToUse = validTeams.length > 0 ? validTeams : teamWeights;

    // Add extra randomness to team selection to prevent always picking same team
    const randomnessFactor = this.config.randomness || 0.3;
    
    // Increase randomness significantly for preventing duplicates - use different approach for each lineup
    const lineupBasedRandomness = Math.min(0.9, randomnessFactor + (currentLineupCount * 0.08));
    
    // Use a more aggressive randomness approach for team selection
    // Use lineupSeed to add deterministic but varying randomness across lineups
    const seedBasedRandomness = (lineupSeed % 100) / 100;
    if (seedBasedRandomness < lineupBasedRandomness && currentLineupCount > 0) {
      // Sometimes just pick a random team to increase diversity
      const randomIndex = Math.floor(((lineupSeed * 17) % this.teams.length));
      const randomTeam = this.teams[randomIndex];
      this.debugLog(`Selected random team ${randomTeam.name} for diversity (lineup ${currentLineupCount}, seed: ${lineupSeed})`);
      return randomTeam;
    }
    
    // After 5 lineups, force more randomness by flattening the distribution
    if (currentLineupCount >= 5) {
      // Flatten the weight distribution to make all teams more equally likely
      const flattenedWeights = teamsToUse.map(tw => ({
        team: tw.team,
        weight: tw.weight * 0.3 + (Math.random() * tw.weight * 0.7)
      }));
      teamsToUse.splice(0, teamsToUse.length, ...flattenedWeights);
    }

    // Select a team based on weights with enhanced randomness
    const selectedTeam = this._weightedRandom(
      teamsToUse.map((tw) => tw.team),
      teamsToUse.map((tw) => tw.weight),
      lineupSeed
    );
    
    this.debugLog(`Selected team: ${selectedTeam?.name}, lineup count: ${currentLineupCount}, randomness: ${randomnessFactor}`);
    return selectedTeam;
  }

  /**
   * Select a captain for the lineup
   */
  _selectCaptain(stackTeam, usedPlayers, targetStackSize = null, lineupSeed = 0) {
    // Get potential captain candidates
    let candidates = this.playerPool.filter(
      (player) =>
        !usedPlayers.has(player.id) &&
        // Captain is typically a high-scoring position
        ["TOP", "MID", "ADC", "JNG"].includes(player.position)
    );

    // Prefer players from the stack team
    const stackTeamCandidates = candidates.filter(
      (p) => p.team === stackTeam.name
    );

    if (stackTeamCandidates.length > 0) {
      candidates = stackTeamCandidates;
    }

    // Calculate current exposures
    const exposures = candidates.map((player) => {
      const totalLineups =
        this.generatedLineups.length + this.existingLineups.length;
      const playerCount = this.exposureTracking.players.get(player.id) || 0;
      const currentExposure = totalLineups > 0 ? playerCount / totalLineups : 0;

      // Get exposure constraints
      const exposureSetting = this.playerExposures.find(
        (pe) => pe.id === player.id
      );
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
        availableExposure: Math.max(0, maxExposure - currentExposure),
      };
    });

    // First, check if any players need more exposure (below min)
    const playersNeedingExposure = exposures.filter((p) => p.needsExposure);

    if (playersNeedingExposure.length > 0) {
      // Pick a random player that needs exposure
      const selectedPlayer =
        playersNeedingExposure[
          Math.floor(Math.random() * playersNeedingExposure.length)
        ];
      this.debugLog(
        `Selected captain ${selectedPlayer.name} based on exposure requirements`
      );

      // Apply captain formatting
      return {
        id: selectedPlayer.id,
        name: selectedPlayer.name,
        position: "CPT",
        team: selectedPlayer.team,
        opponent: this._getTeamOpponent(selectedPlayer.team),
        salary: Math.round(
          this._safeParseFloat(selectedPlayer.salary, 0) * 1.5
        ),
      };
    }

    // Filter players who still have available exposure
    const availablePlayers = exposures.filter((p) => !p.atMaxExposure);

    // If no players available, use all candidates
    const playersToUse =
      availablePlayers.length > 0 ? availablePlayers : exposures;

    // Weight by projection
    const weights = playersToUse.map((player) => {
      // Captain value is influenced by projection, leverage, and remaining exposure
      const projectionValue =
        this._safeParseFloat(player.projectedPoints, 0) * 1.5; // CPT gets 1.5x
      const playerOwnership =
        this._safeParseFloat(player.ownership, 0.01); // Ensure not zero
      const leverageValue = projectionValue / playerOwnership;
      const exposureMultiplier =
        player.availableExposure / Math.max(0.1, player.maxExposure);

      return projectionValue * leverageValue * exposureMultiplier;
    });

    // Select a player based on weights
    const selectedPlayer = this._weightedRandom(playersToUse, weights, lineupSeed);
    
    this.debugLog(`Selected captain: ${selectedPlayer?.name} (${selectedPlayer?.team})`);

    // Apply captain formatting
    return {
      id: selectedPlayer.id,
      name: selectedPlayer.name,
      position: "CPT",
      team: selectedPlayer.team,
      opponent: this._getTeamOpponent(selectedPlayer.team),
      salary: Math.round(this._safeParseFloat(selectedPlayer.salary, 0) * 1.5),
    };
  }

  /**
   * Select a player for a position
   */
  async _selectPositionPlayer(
    position,
    stackTeam,
    usedPlayers,
    remainingSalary,
    selectedPlayers,
    targetStackSize = null,
    teamCounts = {},
    lineupSeed = 0
  ) {
    // Special handling for TEAM position
    if (position === "TEAM") {
      console.log("Selecting TEAM position player...");

      // First try to get a TEAM player from the stack team
      let teamPlayers = this.playerPool.filter(
        (player) =>
          !usedPlayers.has(player.id) &&
          player.position === "TEAM" &&
          player.team === stackTeam.name &&
          this._safeParseFloat(player.salary, 0) <= remainingSalary
      );

      // If no TEAM players from stack team, get any TEAM player
      if (teamPlayers.length === 0) {
        console.log(
          "No TEAM players from stack team, selecting any TEAM player"
        );
        teamPlayers = this.playerPool.filter(
          (player) =>
            !usedPlayers.has(player.id) &&
            player.position === "TEAM" &&
            this._safeParseFloat(player.salary, 0) <= remainingSalary
        );
      }

      // If still no TEAM players, this is an error condition
      if (teamPlayers.length === 0) {
        console.error(
          "No TEAM position players available within salary constraint"
        );
        return null;
      }

      // Select the TEAM player with highest projection
      const selectedPlayer = teamPlayers.sort(
        (a, b) =>
          this._safeParseFloat(b.projectedPoints, 0) -
          this._safeParseFloat(a.projectedPoints, 0)
      )[0];

      return {
        id: selectedPlayer.id,
        name: selectedPlayer.name,
        position: "TEAM",
        team: selectedPlayer.team,
        opponent: this._getTeamOpponent(selectedPlayer.team),
        salary: this._safeParseFloat(selectedPlayer.salary, 0),
      };
    }

    // Get potential players for this position who are under salary cap
    let candidates = this.playerPool.filter(
      (player) =>
        !usedPlayers.has(player.id) &&
        player.position === position &&
        this._safeParseFloat(player.salary, 0) <= remainingSalary
    );

    // If no candidates, we have a problem
    if (candidates.length === 0) {
      // Try to find any player under salary cap
      candidates = this.playerPool.filter(
        (player) =>
          !usedPlayers.has(player.id) &&
          this._safeParseFloat(player.salary, 0) <= remainingSalary
      );

      // If still no candidates, return null
      if (candidates.length === 0) {
        return null;
      }
    }

    // Apply team limits - filter out players from teams that already have the max number of players
    const MAX_PLAYERS_PER_TEAM = this.config.maxPlayersPerTeam || 4; // Use config value or default to 4

    // First, filter by team limit
    candidates = candidates.filter((player) => {
      const teamCount = teamCounts[player.team] || 0;
      return teamCount < MAX_PLAYERS_PER_TEAM;
    });

    // If no candidates after team limit filter, try to find any player
    if (candidates.length === 0) {
      this.debugLog(
        `No candidates for ${position} after team limit filter, relaxing constraints`
      );

      // Try to find any player for this position
      candidates = this.playerPool.filter(
        (player) =>
          !usedPlayers.has(player.id) &&
          player.position === position &&
          this._safeParseFloat(player.salary, 0) <= remainingSalary
      );

      // If still no candidates, return null
      if (candidates.length === 0) {
        return null;
      }
    }

    // Count how many players we have so far from the stack team
    const stackTeamCount = selectedPlayers.filter(
      (p) => p.team === stackTeam.name
    ).length;

    // Check if we need to select from the stack team based on target stack size
    const needStackPlayer =
      targetStackSize !== null &&
      stackTeamCount < targetStackSize &&
      this._shouldPrioritizeStackForPosition(position, selectedPlayers);

    if (needStackPlayer) {
      // Get players from stack team for this position
      const stackTeamPlayers = candidates.filter(
        (p) => p.team === stackTeam.name
      );

      if (stackTeamPlayers.length > 0) {
        candidates = stackTeamPlayers;
        this.debugLog(
          `Prioritizing ${stackTeam.name} player for position ${position} to meet ${targetStackSize}-stack`
        );
      }
    } else {
      // Get players from stack team for this position
      const stackTeamPlayers = candidates.filter(
        (p) => p.team === stackTeam.name
      );

      // If we have stack team players, prioritize them for certain positions
      // In LoL, often you want to stack certain positions like MID+JNG or ADC+SUP
      if (
        stackTeamPlayers.length > 0 &&
        this._shouldPrioritizeStackForPosition(position, selectedPlayers)
      ) {
        candidates = stackTeamPlayers;
      }
    }

    // Calculate current exposures and check constraints
    const exposures = candidates.map((player) => {
      const totalLineups =
        this.generatedLineups.length + this.existingLineups.length;
      const playerCount = this.exposureTracking.players.get(player.id) || 0;
      const currentExposure = totalLineups > 0 ? playerCount / totalLineups : 0;

      // Get exposure constraints
      const exposureSetting = this.playerExposures.find(
        (pe) => pe.id === player.id
      );
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
        availableExposure: Math.max(0, maxExposure - currentExposure),
      };
    });

    // First, check if any players need more exposure (below min)
    const playersNeedingExposure = exposures.filter((p) => p.needsExposure);

    if (playersNeedingExposure.length > 0) {
      // Pick a random player that needs exposure
      const selectedPlayer =
        playersNeedingExposure[
          Math.floor(Math.random() * playersNeedingExposure.length)
        ];
      this.debugLog(
        `Selected ${position} player ${selectedPlayer.name} based on exposure requirements`
      );

      return {
        id: selectedPlayer.id,
        name: selectedPlayer.name,
        position: selectedPlayer.position,
        team: selectedPlayer.team,
        opponent: this._getTeamOpponent(selectedPlayer.team),
        salary: this._safeParseFloat(selectedPlayer.salary, 0),
      };
    }

    // Filter players who still have available exposure
    const availablePlayers = exposures.filter((p) => !p.atMaxExposure);

    // If no players available, use all candidates
    const playersToUse =
      availablePlayers.length > 0 ? availablePlayers : exposures;

    // Weight by projection, leverage, and synergy with already selected players
    const weights = playersToUse.map((player) => {
      // Base value from projection
      const projectionValue = this._safeParseFloat(player.projectedPoints, 0);

      // Leverage factor (projection vs ownership)
      const playerOwnership =
        this._safeParseFloat(player.ownership, 0.01); // Ensure not zero
      const leverageFactor =
        this.config.leverageMultiplier * (projectionValue / playerOwnership);

      // Synergy with already selected players
      const synergy = this._calculateSynergy(player, selectedPlayers);

      // Exposure factor - prioritize players under their target exposure
      const targetExposure = this._safeParseFloat(player.targetExposure, 0.5);
      const exposureFactor =
        targetExposure > 0
          ? (targetExposure - player.currentExposure) / targetExposure
          : 1;

      // Final weight
      return (
        projectionValue *
        leverageFactor *
        synergy *
        Math.max(0.1, exposureFactor)
      );
    });

    // Select a player based on weights
    const selectedPlayer = this._weightedRandom(playersToUse, weights, lineupSeed);

    return {
      id: selectedPlayer.id,
      name: selectedPlayer.name,
      position: selectedPlayer.position,
      team: selectedPlayer.team,
      opponent: this._getTeamOpponent(selectedPlayer.team),
      salary: this._safeParseFloat(selectedPlayer.salary, 0),
    };
  }

  /**
   * Determine if we should prioritize stack team for a position
   */
  _shouldPrioritizeStackForPosition(position, selectedPlayers) {
    // In LoL, certain positions are commonly stacked together
    switch (position) {
      // MID+JNG is a common stack
      case "MID":
        return selectedPlayers.some((p) => p.position === "JNG");
      case "JNG":
        return selectedPlayers.some((p) => p.position === "MID");

      // ADC+SUP is a very common stack
      case "ADC":
        return selectedPlayers.some((p) => p.position === "SUP");
      case "SUP":
        return selectedPlayers.some((p) => p.position === "ADC");

      // TOP is less commonly stacked
      case "TOP":
        return Math.random() < 0.5; // 50% chance to stack TOP

      case "TEAM":
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
    const correlations = selectedPlayers.map((selected) => {
      return this._getCorrelation(player.id, selected.id) + 1; // Shift from [-1,1] to [0,2]
    });

    // Average correlation (geometric mean to emphasize synergy)
    return (
      correlations.reduce((product, corr) => product * corr, 1) **
      (1 / correlations.length)
    );
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
    const totalSalary =
      this._safeParseFloat(lineup.cpt.salary, 0) +
      lineup.players.reduce(
        (sum, player) => sum + this._safeParseFloat(player.salary, 0),
        0
      );

    if (totalSalary > this.config.salaryCap) {
      this.debugLog(`Lineup rejected: Salary $${totalSalary} exceeds cap $${this.config.salaryCap}`);
      return false;
    }

    // Check position requirements
    const positions = lineup.players.map((p) => p.position);
    for (const [position, count] of Object.entries(
      this.config.positionRequirements
    )) {
      if (position === "CPT") {
        // Captain is handled separately
        if (!lineup.cpt) return false;
      } else {
        // Check regular positions
        const posCount = positions.filter((p) => p === position).length;
        if (posCount !== count) return false;
      }
    }

    // Check for duplicate players
    const playerIds = [lineup.cpt.id, ...lineup.players.map((p) => p.id)];
    if (new Set(playerIds).size !== playerIds.length) {
      return false;
    }

    // Check team limits
    const MAX_PLAYERS_PER_TEAM = this.config.maxPlayersPerTeam || 4; // Use config value or default to 4

    const teamCounts = {};
    // Count captain's team
    if (lineup.cpt && lineup.cpt.team) {
      teamCounts[lineup.cpt.team] = 1;
    }

    // Count players' teams
    lineup.players.forEach((player) => {
      if (player && player.team) {
        teamCounts[player.team] = (teamCounts[player.team] || 0) + 1;
      }
    });

    // Check if any team exceeds the limit
    for (const team in teamCounts) {
      if (teamCounts[team] > MAX_PLAYERS_PER_TEAM) {
        this.debugLog(
          `Lineup invalid: ${team} has ${teamCounts[team]} players (max: ${MAX_PLAYERS_PER_TEAM})`
        );
        return false;
      }
    }

    // Check uniqueness against existing lineups
    for (const existing of existingLineups) {
      const existingIds = [
        existing.cpt.id,
        ...existing.players.map((p) => p.id),
      ]
        .sort()
        .join(",");
      const currentIds = playerIds.sort().join(",");

      if (existingIds === currentIds) {
        return false; // Duplicate lineup
      }
    }

    return true;
  }

  /**
   * Enhanced duplicate detection method
   */
  _isDuplicateLineup(lineup, existingLineups) {
    const currentPlayerIds = [lineup.cpt.id, ...lineup.players.map(p => p.id)].sort().join('|');
    
    for (let i = 0; i < existingLineups.length; i++) {
      const existing = existingLineups[i];
      const existingPlayerIds = [existing.cpt.id, ...existing.players.map(p => p.id)].sort().join('|');
      if (currentPlayerIds === existingPlayerIds) {
        this.debugLog(`Duplicate detected: matches existing lineup ${i}`);
        return true;
      }
    }
    
    this.debugLog(`Unique lineup: ${currentPlayerIds} (vs ${existingLineups.length} existing)`);
    return false;
  }

  /**
   * Check if lineup has sufficient diversity from existing lineups
   */
  _hasSufficientDiversity(lineup, existingLineups) {
    if (existingLineups.length === 0) return true;
    
    const currentPlayers = new Set([lineup.cpt.id, ...lineup.players.map(p => p.id)]);
    const minDifferentPlayers = Math.max(2, Math.floor(currentPlayers.size * 0.3)); // At least 30% different players
    
    for (const existing of existingLineups) {
      const existingPlayers = new Set([existing.cpt.id, ...existing.players.map(p => p.id)]);
      
      // Calculate intersection (same players)
      const intersection = new Set([...currentPlayers].filter(x => existingPlayers.has(x)));
      const differentPlayers = currentPlayers.size - intersection.size;
      
      if (differentPlayers < minDifferentPlayers) {
        this.debugLog(`Insufficient diversity: only ${differentPlayers} different players (need ${minDifferentPlayers})`);
        return false;
      }
    }
    
    return true;
  }

  /**
   * Simulate a lineup across all iterations
   */
  async _simulateLineup(lineup) {
    // Get all player IDs in the lineup
    const playerIds = [lineup.cpt.id, ...lineup.players.map((p) => p.id)];

    // Get their simulated performances
    const performances = [];

    // Process in batches to keep UI responsive
    const batchSize = 1000;
    const batches = Math.ceil(this.config.iterations / batchSize);

    for (let batch = 0; batch < batches; batch++) {
      if (this.isCancelled) {
        throw new Error("Simulation cancelled");
      }

      const startIdx = batch * batchSize;
      const endIdx = Math.min(startIdx + batchSize, this.config.iterations);

      await new Promise((resolve) => {
        setTimeout(() => {
          // Process this batch of iterations
          for (let i = startIdx; i < endIdx; i++) {
            let totalPoints = 0;

            // Apply correlation in the simulation
            const basePerformances = playerIds.map((id) => {
              const player = this.playerPool.find((p) => p.id === id);
              const perf = this.playerPerfMap.get(id)[i];
              return { id, perf, isCpt: player && player.id === lineup.cpt.id };
            });

            // Apply correlations between players
            const correlatedPerformances =
              this._applyCorrelations(basePerformances);

            // Sum up performances
            for (const { id, perf, isCpt } of correlatedPerformances) {
              // Captain gets 1.5x
              totalPoints += isCpt ? perf * 1.5 : perf;
            }

            performances.push(totalPoints);
          }
          resolve();
        }, 0);
      });

      // Yield to UI thread occasionally
      if (batch % 3 === 0) {
        await this.yieldToUI();
      }
    }

    // Sort performances for percentiles
    performances.sort((a, b) => a - b);

    // Calculate lineup metrics
    const metrics = this._calculateLineupMetrics(lineup, performances);

    // Store raw performances for global threshold calculations
    return {
      ...lineup,
      ...metrics,
      performances: performances, // Add all performance results
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

        result[i].perf =
          player1.perf + (avgPerf - player1.perf) * adjustmentFactor;
        result[j].perf =
          player2.perf + (avgPerf - player2.perf) * adjustmentFactor;
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

    // Determine percentiles (these are just for lineup score distribution)
    const p10 = performances[Math.floor(count * 0.1)];
    const p25 = performances[Math.floor(count * 0.25)];
    const p75 = performances[Math.floor(count * 0.75)];
    const p90 = performances[Math.floor(count * 0.9)];

    // Calculate projected points with safe handling
    let projectedPoints = 0;
    try {
      // Get the player for Captain from the player pool
      const cptPlayer = this.playerPool.find((p) => p.id === lineup.cpt.id);
      // Add captain's points (1.5x)
      if (cptPlayer) {
        projectedPoints +=
          this._safeParseFloat(cptPlayer.projectedPoints, 0) * 1.5;
      }

      // Add player points
      for (const player of lineup.players) {
        const poolPlayer = this.playerPool.find((p) => p.id === player.id);
        if (poolPlayer) {
          projectedPoints += this._safeParseFloat(
            poolPlayer.projectedPoints,
            0
          );
        }
      }
    } catch (e) {
      console.error("Error calculating projected points:", e);
    }

    // NOTE: ROI and contest-specific metrics will be calculated in runSimulation
    // based on global contest thresholds, not individually per lineup
    return {
      median,
      min,
      max,
      p10,
      p25,
      p75,
      p90,
      // These will be filled in by the runSimulation global analysis
      cashRate: 0,
      winRate: 0,
      roi: 0,
      firstPlace: 0,
      top10: 0,
      projectedPoints: Math.round(projectedPoints * 10) / 10,
    };
  }

  /**
   * Get simulation summary stats
   */
  _getSimulationSummary() {
    // Calculate average ROI across all lineups
    const avgRoi =
      this.simulationResults.reduce((sum, r) => sum + r.roi, 0) /
      Math.max(1, this.simulationResults.length);

    // Get top lineup's ROI
    const topLineupRoi =
      this.simulationResults.length > 0 ? this.simulationResults[0].roi : 0;

    // Get top lineup's NexusScore
    const topNexusScore =
      this.simulationResults.length > 0
        ? this.simulationResults[0].nexusScore
        : 0;

    // Calculate average NexusScore
    const avgNexusScore =
      this.simulationResults.reduce((sum, r) => sum + (r.nexusScore || 0), 0) /
      Math.max(1, this.simulationResults.length);

    // Count distinct teams used
    const distinctTeams = new Set(
      this.simulationResults.flatMap((r) => [
        r.cpt.team,
        ...r.players.map((p) => p.team),
      ])
    ).size;

    return {
      averageROI: avgRoi,
      topLineupROI: topLineupRoi,
      averageNexusScore: avgNexusScore,
      topNexusScore: topNexusScore,
      distinctTeams,
      playerExposures: this._calculatePlayerExposures(),
    };
  }

  /**
   * Calculate player exposures across all lineups
   */
  _calculatePlayerExposures() {
    // Create a map to count player occurrences
    const exposureMap = new Map();

    // Initialize all players to 0
    this.playerPool.forEach((player) => {
      exposureMap.set(player.id, 0);
    });

    // Count occurrences
    this.simulationResults.forEach((lineup) => {
      // Count captain
      const cptId = lineup.cpt.id;
      exposureMap.set(cptId, (exposureMap.get(cptId) || 0) + 1);

      // Count players
      lineup.players.forEach((player) => {
        const playerId = player.id;
        exposureMap.set(playerId, (exposureMap.get(playerId) || 0) + 1);
      });
    });

    // Convert to percentages
    const totalLineups = Math.max(1, this.simulationResults.length);

    return Array.from(exposureMap.entries())
      .map(([id, count]) => {
        const player = this.playerPool.find((p) => p.id === id);
        return {
          id,
          name: player ? player.name : "Unknown",
          team: player ? player.team : "Unknown",
          position: player ? player.position : "Unknown",
          exposure: Math.round((count / totalLineups) * 1000) / 10,
        };
      })
      .sort((a, b) => b.exposure - a.exposure);
  }

  /**
   * Weighted random selection with enhanced randomness
   */
  _weightedRandom(items, weights, lineupSeed = 0) {
    if (items.length === 0) return null;
    if (items.length === 1) return items[0];

    // Make sure weights are positive
    const positiveWeights = weights.map((w) => Math.max(0, w));

    // Add randomness factor to flatten the distribution and prevent same selections
    const randomnessFactor = this.config.randomness || 0.3;
    
    // Increase randomness based on current lineup count to prevent duplicates
    const lineupCount = this.generatedLineups.length;
    const adaptiveRandomness = Math.min(0.9, randomnessFactor + (lineupCount * 0.03));
    
    const baseWeight = Math.max(...positiveWeights) * adaptiveRandomness;
    
    // Normalize weights with enhanced randomness
    const normalizedWeights = positiveWeights.map(w => {
      // Add different levels of randomness for each selection - make it more variable
      const randomMultiplier = 0.3 + (Math.random() * adaptiveRandomness * 1.5);
      // Add additional entropy based on lineup count and seed
      const entropyBoost = (lineupCount % 7) * 0.1; // Use modulo to create cycling randomness
      const seedEntropy = lineupSeed ? (lineupSeed % 10) * 0.05 : 0; // Additional seed-based entropy
      return w + baseWeight * (randomMultiplier + entropyBoost + seedEntropy);
    });

    // Calculate total weight
    const totalWeight = normalizedWeights.reduce((sum, w) => sum + w, 0);

    // If all weights are 0, select randomly
    if (totalWeight === 0) {
      return items[Math.floor(Math.random() * items.length)];
    }

    // Significantly increase pure random selection chance after first few lineups
    const pureRandomChance = Math.min(0.8, adaptiveRandomness * 1.2);
    if (Math.random() < pureRandomChance && lineupCount > 1) {
      // For preventing duplicates, sometimes just pick completely randomly
      const randomIndex = Math.floor(Math.random() * items.length);
      this.debugLog(`Pure random selection (chance: ${pureRandomChance}, lineup: ${lineupCount})`);
      return items[randomIndex];
    }

    // Add extra randomness - sometimes pick randomly from top options
    if (Math.random() < adaptiveRandomness * 0.4) {
      // Sort by weight and pick randomly from top portion
      const sortedIndices = normalizedWeights
        .map((weight, index) => ({ weight, index }))
        .sort((a, b) => b.weight - a.weight);
      
      // Increase the portion we select from as we generate more lineups
      const topPortion = Math.min(0.5, 0.3 + (lineupCount * 0.02));
      const topCount = Math.max(1, Math.ceil(items.length * topPortion));
      const randomTopIndex = Math.floor(Math.random() * topCount);
      return items[sortedIndices[randomTopIndex].index];
    }

    // Select based on weights
    const threshold = Math.random() * totalWeight;
    let cumulativeWeight = 0;

    for (let i = 0; i < items.length; i++) {
      cumulativeWeight += normalizedWeights[i];
      if (cumulativeWeight >= threshold) {
        return items[i];
      }
    }

    // Fallback to random selection from available items
    return items[Math.floor(Math.random() * items.length)];
  }
}

// Export the optimizer class
module.exports = AdvancedOptimizer;
