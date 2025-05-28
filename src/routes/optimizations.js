const express = require("express");
const { catchAsync, AppError } = require("../middleware/errorHandler");
const { validateId } = require("../middleware/validation");
const HybridOptimizer = require("../../client/src/lib/HybridOptimizer");

const router = express.Router();

// Store optimizer instances per session
const optimizerInstances = new Map();
// Store SSE connections for progress updates
const progressConnections = new Map();

// Initialize hybrid optimizer
router.post(
  "/initialize",
  catchAsync(async (req, res) => {
    const { exposureSettings = {}, contestInfo = {} } = req.body;
    const playerRepository = req.app.get("repositories").player;

    // Check if we have necessary data
    const playerProjections = await playerRepository.findAll();
    if (playerProjections.length === 0) {
      throw new AppError(
        "No player projections available. Please upload player projections data before initializing optimizer.",
        400
      );
    }

    // Create session ID for this optimizer instance
    const sessionId = Date.now().toString();

    // Create new hybrid optimizer instance
    const hybridOptimizer = new HybridOptimizer({
      fieldSizes: {
        cash: contestInfo.fieldSize || 100,
        double_up: contestInfo.fieldSize || 200,
        gpp: contestInfo.fieldSize || 1000,
        tournament: contestInfo.fieldSize || 1000,
        single_entry: contestInfo.fieldSize || 150000,
      },
    });

    // Set up progress callbacks to send updates via SSE
    hybridOptimizer.setProgressCallback((progress, stage) => {
      // Send progress updates to all connected clients for this session
      const connections = progressConnections.get(sessionId) || [];
      connections.forEach((res) => {
        try {
          res.write(
            `data: ${JSON.stringify({
              progress: Number(progress.toFixed(2)),
              stage,
            })}\n\n`
          );
        } catch (err) {
          // Connection might be closed
        }
      });
    });

    hybridOptimizer.setStatusCallback((status) => {
      // Send status updates to all connected clients for this session
      const connections = progressConnections.get(sessionId) || [];
      connections.forEach((res) => {
        try {
          res.write(
            `data: ${JSON.stringify({
              status,
              progress: null,
            })}\n\n`
          );
        } catch (err) {
          // Connection might be closed
        }
      });
    });

    // Initialize with current data
    const initResult = await hybridOptimizer.initialize(
      playerProjections,
      exposureSettings,
      [], // Empty array for fresh lineup generation
      contestInfo
    );

    // Store optimizer instance for this session
    optimizerInstances.set(sessionId, {
      optimizer: hybridOptimizer,
      initialized: true,
      timestamp: Date.now(),
    });

    // Clean up old instances (older than 1 hour)
    const oneHourAgo = Date.now() - 60 * 60 * 1000;
    for (const [id, instance] of optimizerInstances.entries()) {
      if (instance.timestamp < oneHourAgo) {
        optimizerInstances.delete(id);
      }
    }

    res.json({
      success: true,
      message: "Hybrid optimizer initialized successfully",
      sessionId,
      ...initResult,
    });
  })
);

// Get available optimization strategies
router.get(
  "/strategies",
  catchAsync(async (req, res) => {
    const { sessionId } = req.query;

    // Always return default strategies for now to ensure algorithm property is included
    if (
      true ||
      !sessionId ||
      sessionId === "null" ||
      !optimizerInstances.has(sessionId)
    ) {
      // Return default strategies structure
      const defaultStrategies = {
        recommended: {
          name: "Recommended",
          description:
            "Smart algorithm selection based on your contest and constraints",
          algorithm: "auto",
          config: {},
          usage: "Auto-selects the best approach for your specific situation",
          recommended: true,
          performance: null,
          suitable: true,
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
            randomness: 0.5,
            leverageMultiplier: 0.8,
            genetic: { generations: 30, populationSize: 60 },
          },
          usage: "General purpose optimization for most contests",
          recommended: false,
          performance: null,
          suitable: true,
        },
        cash_game: {
          name: "Cash Game",
          description: "Consistent scoring for cash games and double-ups",
          algorithm: "monte_carlo",
          config: {
            iterations: 12000,
            leverageMultiplier: 0.6,
            randomness: 0.3,
            targetCeiling: false,
          },
          usage: "Optimized for consistent cashing in cash games",
          recommended: false,
          performance: null,
          suitable: true,
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
            targetTop: 0.05,
          },
          usage: "Designed for GPPs and large tournaments",
          recommended: false,
          performance: null,
          suitable: true,
        },
        contrarian: {
          name: "Contrarian",
          description:
            "Low-owned players and unique stacks for differentiation",
          algorithm: "genetic",
          config: {
            genetic: {
              populationSize: 100,
              generations: 50,
              mutationRate: 0.25,
              diversityWeight: 0.5,
            },
            leverageMultiplier: 1.5,
            randomness: 0.6,
            ownershipPenalty: 2.0,
          },
          usage: "For large fields where differentiation is critical",
          recommended: false,
          performance: null,
          suitable: true,
        },
        constraint_focused: {
          name: "Constraint Optimizer",
          description: "Perfect for complex exposure requirements",
          algorithm: "simulated_annealing",
          config: {
            maxConstraintViolations: 0,
            exposurePriority: 1.0,
            leverageMultiplier: 1.0,
            randomness: 0.3,
          },
          usage: "Ideal when you have specific exposure targets",
          recommended: false,
          performance: null,
          suitable: true,
        },
      };

      res.json({
        success: true,
        strategies: defaultStrategies,
        stats: null,
      });
      return;
    }

    const instance = optimizerInstances.get(sessionId);
    const strategies = instance.optimizer.getStrategies();
    const stats = instance.optimizer.getStats();

    res.json({
      success: true,
      strategies,
      stats,
    });
  })
);

// Server-Sent Events endpoint for real-time progress updates
router.get("/progress/:sessionId", (req, res) => {
  const { sessionId } = req.params;

  // Set SSE headers
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-cache",
    Connection: "keep-alive",
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "Cache-Control",
  });

  // Register this connection for progress updates
  if (!progressConnections.has(sessionId)) {
    progressConnections.set(sessionId, []);
  }
  progressConnections.get(sessionId).push(res);

  // Send initial connection message
  res.write(
    `data: ${JSON.stringify({
      progress: 0,
      status: "Connected to progress stream",
    })}\n\n`
  );

  // Keep connection alive
  const keepAlive = setInterval(() => {
    res.write(":keepalive\n\n");
  }, 30000);

  // Handle client disconnect
  req.on("close", () => {
    clearInterval(keepAlive);

    // Remove this connection from the list
    const connections = progressConnections.get(sessionId) || [];
    const index = connections.indexOf(res);
    if (index > -1) {
      connections.splice(index, 1);
    }

    // Clean up empty connection lists
    if (connections.length === 0) {
      progressConnections.delete(sessionId);
    }
  });
});

// Generate optimized lineups
router.post(
  "/generate",
  catchAsync(async (req, res) => {
    const optimizationService = req.app.get("services").optimization;
    const options = req.body;

    const result = await optimizationService.generateLineups(options);

    res.json({
      success: true,
      data: result,
      message: `Generated ${result.lineups.length} optimized lineups`,
    });
  })
);

// Get optimization status
router.get(
  "/status/:id",
  validateId,
  catchAsync(async (req, res) => {
    const optimizationService = req.app.get("services").optimization;
    const { id } = req.params;

    const status = optimizationService.getOptimizationStatus(id);

    res.json({
      success: true,
      data: status,
      message: `Optimization status: ${status.status}`,
    });
  })
);

// Cancel running optimization
router.post(
  "/cancel/:id",
  validateId,
  catchAsync(async (req, res) => {
    const optimizationService = req.app.get("services").optimization;
    const { id } = req.params;

    const result = await optimizationService.cancelOptimization(id);

    res.json({
      success: true,
      data: result,
      message: "Optimization cancelled successfully",
    });
  })
);

// Get all active optimizations
router.get(
  "/active",
  catchAsync(async (req, res) => {
    const optimizationService = req.app.get("services").optimization;

    const optimizations = optimizationService.getActiveOptimizations();

    res.json({
      success: true,
      data: optimizations,
      message: `Found ${optimizations.length} active optimizations`,
    });
  })
);

// Clean up old optimizations
router.post(
  "/cleanup",
  catchAsync(async (req, res) => {
    const optimizationService = req.app.get("services").optimization;
    const { maxAge } = req.body;

    const result = optimizationService.cleanupOptimizations(maxAge);

    res.json({
      success: true,
      data: result,
      message: `Cleaned up ${result.cleaned} old optimizations`,
    });
  })
);

// Run Monte Carlo simulation
router.post(
  "/simulate",
  catchAsync(async (req, res) => {
    const optimizationService = req.app.get("services").optimization;
    const { lineupIds, options = {} } = req.body;

    if (!lineupIds || !Array.isArray(lineupIds) || lineupIds.length === 0) {
      return res.status(400).json({
        success: false,
        message: "lineupIds array is required",
      });
    }

    const result = await optimizationService.runSimulation(lineupIds, options);

    res.json({
      success: true,
      data: result,
      message: `Simulation completed for ${lineupIds.length} lineups`,
    });
  })
);

// Initialize hybrid optimizer
router.post(
  "/hybrid/initialize",
  catchAsync(async (req, res) => {
    const optimizationService = req.app.get("services").optimization;
    const options = req.body;

    const result = await optimizationService.initializeHybridOptimizer(options);

    res.json({
      success: true,
      data: result,
      message: "Hybrid optimizer initialized successfully",
    });
  })
);

// Generate lineups using hybrid optimizer
router.post(
  "/hybrid/generate/:initId",
  validateId,
  catchAsync(async (req, res) => {
    const optimizationService = req.app.get("services").optimization;
    const { initId } = req.params;
    const options = req.body;

    const result = await optimizationService.generateHybridLineups(
      initId,
      options
    );

    res.json({
      success: true,
      data: result,
      message: `Generated ${result.lineups.length} hybrid lineups`,
    });
  })
);

// Get optimization algorithm types (different from UI strategies)
router.get(
  "/algorithm-types",
  catchAsync(async (req, res) => {
    const optimizationService = req.app.get("services").optimization;

    const strategies = optimizationService.getOptimizationStrategies();

    res.json({
      success: true,
      data: strategies,
      message: `Available strategies: ${strategies.length}`,
    });
  })
);

// Get optimizer statistics
router.get(
  "/stats",
  catchAsync(async (req, res) => {
    const optimizationService = req.app.get("services").optimization;

    const stats = await optimizationService.getOptimizerStats();

    res.json({
      success: true,
      data: stats,
      message: "Optimizer statistics retrieved",
    });
  })
);

// Get optimization algorithms
router.get(
  "/algorithms",
  catchAsync(async (req, res) => {
    const algorithms = [
      {
        name: "advanced",
        displayName: "Advanced Optimizer",
        description: "Uses advanced mathematical optimization techniques",
        features: [
          "Stack optimization",
          "Exposure control",
          "Constraint handling",
        ],
        recommended: true,
      },
      {
        name: "hybrid",
        displayName: "Hybrid Optimizer",
        description: "Combines multiple optimization approaches",
        features: [
          "Genetic algorithms",
          "Simulated annealing",
          "Multi-objective optimization",
        ],
        recommended: false,
      },
    ];

    res.json({
      success: true,
      data: algorithms,
      message: `Available optimization algorithms: ${algorithms.length}`,
    });
  })
);

// Get optimization constraints
router.get(
  "/constraints",
  catchAsync(async (req, res) => {
    const constraints = {
      salary: {
        min: 40000,
        max: 50000,
        description: "Total salary cap for lineup",
      },
      positions: {
        TOP: { min: 1, max: 1 },
        JNG: { min: 1, max: 1 },
        MID: { min: 1, max: 1 },
        ADC: { min: 1, max: 1 },
        SUP: { min: 1, max: 1 },
        TEAM: { min: 1, max: 1 },
      },
      exposure: {
        player: { min: 0, max: 100, description: "Player exposure percentage" },
        team: { min: 0, max: 100, description: "Team exposure percentage" },
      },
      stacking: {
        maxTeamPlayers: 4,
        description: "Maximum players from same team",
      },
    };

    res.json({
      success: true,
      data: constraints,
      message: "Available optimization constraints",
    });
  })
);

// Validate lineup configuration
router.post(
  "/validate",
  catchAsync(async (req, res) => {
    const { players, constraints = {} } = req.body;

    if (!players || !Array.isArray(players)) {
      return res.status(400).json({
        success: false,
        message: "Players array is required",
      });
    }

    const validation = {
      isValid: true,
      errors: [],
      warnings: [],
    };

    // Check position requirements
    const positions = players.reduce((acc, player) => {
      acc[player.position] = (acc[player.position] || 0) + 1;
      return acc;
    }, {});

    const requiredPositions = ["TOP", "JNG", "MID", "ADC", "SUP", "TEAM"];
    requiredPositions.forEach((pos) => {
      if (!positions[pos] || positions[pos] === 0) {
        validation.errors.push(`Missing ${pos} position`);
        validation.isValid = false;
      }
    });

    // Check salary constraints
    const totalSalary = players.reduce(
      (sum, player) => sum + (player.salary || 0),
      0
    );
    const maxSalary = constraints.maxSalary || 50000;
    const minSalary = constraints.minSalary || 40000;

    if (totalSalary > maxSalary) {
      validation.errors.push(
        `Total salary ${totalSalary} exceeds maximum ${maxSalary}`
      );
      validation.isValid = false;
    } else if (totalSalary < minSalary) {
      validation.warnings.push(
        `Total salary ${totalSalary} below recommended minimum ${minSalary}`
      );
    }

    // Check team stacking
    const teamCounts = players.reduce((acc, player) => {
      acc[player.team] = (acc[player.team] || 0) + 1;
      return acc;
    }, {});

    const maxTeamPlayers = constraints.maxTeamPlayers || 4;
    Object.entries(teamCounts).forEach(([team, count]) => {
      if (count > maxTeamPlayers) {
        validation.errors.push(
          `Too many players from ${team}: ${count} (max: ${maxTeamPlayers})`
        );
        validation.isValid = false;
      }
    });

    res.json({
      success: true,
      data: validation,
      message: validation.isValid
        ? "Lineup configuration is valid"
        : "Lineup configuration has errors",
    });
  })
);

module.exports = router;
module.exports.optimizerInstances = optimizerInstances;
module.exports.progressConnections = progressConnections;
