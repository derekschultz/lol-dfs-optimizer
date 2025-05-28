const express = require('express');
const { catchAsync } = require('../middleware/errorHandler');
const { validateId } = require('../middleware/validation');

const router = express.Router();

// Generate optimized lineups
router.post('/generate', catchAsync(async (req, res) => {
  const optimizationService = req.app.get('services').optimization;
  const options = req.body;

  const result = await optimizationService.generateLineups(options);

  res.json({
    success: true,
    data: result,
    message: `Generated ${result.lineups.length} optimized lineups`
  });
}));

// Get optimization status
router.get('/status/:id', validateId, catchAsync(async (req, res) => {
  const optimizationService = req.app.get('services').optimization;
  const { id } = req.params;

  const status = optimizationService.getOptimizationStatus(id);

  res.json({
    success: true,
    data: status,
    message: `Optimization status: ${status.status}`
  });
}));

// Cancel running optimization
router.post('/cancel/:id', validateId, catchAsync(async (req, res) => {
  const optimizationService = req.app.get('services').optimization;
  const { id } = req.params;

  const result = await optimizationService.cancelOptimization(id);

  res.json({
    success: true,
    data: result,
    message: 'Optimization cancelled successfully'
  });
}));

// Get all active optimizations
router.get('/active', catchAsync(async (req, res) => {
  const optimizationService = req.app.get('services').optimization;

  const optimizations = optimizationService.getActiveOptimizations();

  res.json({
    success: true,
    data: optimizations,
    message: `Found ${optimizations.length} active optimizations`
  });
}));

// Clean up old optimizations
router.post('/cleanup', catchAsync(async (req, res) => {
  const optimizationService = req.app.get('services').optimization;
  const { maxAge } = req.body;

  const result = optimizationService.cleanupOptimizations(maxAge);

  res.json({
    success: true,
    data: result,
    message: `Cleaned up ${result.cleaned} old optimizations`
  });
}));

// Run Monte Carlo simulation
router.post('/simulate', catchAsync(async (req, res) => {
  const optimizationService = req.app.get('services').optimization;
  const { lineupIds, options = {} } = req.body;

  if (!lineupIds || !Array.isArray(lineupIds) || lineupIds.length === 0) {
    return res.status(400).json({
      success: false,
      message: 'lineupIds array is required'
    });
  }

  const result = await optimizationService.runSimulation(lineupIds, options);

  res.json({
    success: true,
    data: result,
    message: `Simulation completed for ${lineupIds.length} lineups`
  });
}));

// Initialize hybrid optimizer
router.post('/hybrid/initialize', catchAsync(async (req, res) => {
  const optimizationService = req.app.get('services').optimization;
  const options = req.body;

  const result = await optimizationService.initializeHybridOptimizer(options);

  res.json({
    success: true,
    data: result,
    message: 'Hybrid optimizer initialized successfully'
  });
}));

// Generate lineups using hybrid optimizer
router.post('/hybrid/generate/:initId', validateId, catchAsync(async (req, res) => {
  const optimizationService = req.app.get('services').optimization;
  const { initId } = req.params;
  const options = req.body;

  const result = await optimizationService.generateHybridLineups(initId, options);

  res.json({
    success: true,
    data: result,
    message: `Generated ${result.lineups.length} hybrid lineups`
  });
}));

// Get optimization strategies
router.get('/strategies', catchAsync(async (req, res) => {
  const optimizationService = req.app.get('services').optimization;

  const strategies = optimizationService.getOptimizationStrategies();

  res.json({
    success: true,
    data: strategies,
    message: `Available strategies: ${strategies.length}`
  });
}));

// Get optimizer statistics
router.get('/stats', catchAsync(async (req, res) => {
  const optimizationService = req.app.get('services').optimization;

  const stats = await optimizationService.getOptimizerStats();

  res.json({
    success: true,
    data: stats,
    message: 'Optimizer statistics retrieved'
  });
}));

// Get optimization algorithms
router.get('/algorithms', catchAsync(async (req, res) => {
  const algorithms = [
    {
      name: 'advanced',
      displayName: 'Advanced Optimizer',
      description: 'Uses advanced mathematical optimization techniques',
      features: ['Stack optimization', 'Exposure control', 'Constraint handling'],
      recommended: true
    },
    {
      name: 'hybrid',
      displayName: 'Hybrid Optimizer',
      description: 'Combines multiple optimization approaches',
      features: ['Genetic algorithms', 'Simulated annealing', 'Multi-objective optimization'],
      recommended: false
    }
  ];

  res.json({
    success: true,
    data: algorithms,
    message: `Available optimization algorithms: ${algorithms.length}`
  });
}));

// Get optimization constraints
router.get('/constraints', catchAsync(async (req, res) => {
  const constraints = {
    salary: {
      min: 40000,
      max: 50000,
      description: 'Total salary cap for lineup'
    },
    positions: {
      TOP: { min: 1, max: 1 },
      JNG: { min: 1, max: 1 },
      MID: { min: 1, max: 1 },
      ADC: { min: 1, max: 1 },
      SUP: { min: 1, max: 1 },
      TEAM: { min: 1, max: 1 }
    },
    exposure: {
      player: { min: 0, max: 100, description: 'Player exposure percentage' },
      team: { min: 0, max: 100, description: 'Team exposure percentage' }
    },
    stacking: {
      maxTeamPlayers: 4,
      description: 'Maximum players from same team'
    }
  };

  res.json({
    success: true,
    data: constraints,
    message: 'Available optimization constraints'
  });
}));

// Validate lineup configuration
router.post('/validate', catchAsync(async (req, res) => {
  const { players, constraints = {} } = req.body;

  if (!players || !Array.isArray(players)) {
    return res.status(400).json({
      success: false,
      message: 'Players array is required'
    });
  }

  const validation = {
    isValid: true,
    errors: [],
    warnings: []
  };

  // Check position requirements
  const positions = players.reduce((acc, player) => {
    acc[player.position] = (acc[player.position] || 0) + 1;
    return acc;
  }, {});

  const requiredPositions = ['TOP', 'JNG', 'MID', 'ADC', 'SUP', 'TEAM'];
  requiredPositions.forEach(pos => {
    if (!positions[pos] || positions[pos] === 0) {
      validation.errors.push(`Missing ${pos} position`);
      validation.isValid = false;
    }
  });

  // Check salary constraints
  const totalSalary = players.reduce((sum, player) => sum + (player.salary || 0), 0);
  const maxSalary = constraints.maxSalary || 50000;
  const minSalary = constraints.minSalary || 40000;

  if (totalSalary > maxSalary) {
    validation.errors.push(`Total salary ${totalSalary} exceeds maximum ${maxSalary}`);
    validation.isValid = false;
  } else if (totalSalary < minSalary) {
    validation.warnings.push(`Total salary ${totalSalary} below recommended minimum ${minSalary}`);
  }

  // Check team stacking
  const teamCounts = players.reduce((acc, player) => {
    acc[player.team] = (acc[player.team] || 0) + 1;
    return acc;
  }, {});

  const maxTeamPlayers = constraints.maxTeamPlayers || 4;
  Object.entries(teamCounts).forEach(([team, count]) => {
    if (count > maxTeamPlayers) {
      validation.errors.push(`Too many players from ${team}: ${count} (max: ${maxTeamPlayers})`);
      validation.isValid = false;
    }
  });

  res.json({
    success: true,
    data: validation,
    message: validation.isValid ? 'Lineup configuration is valid' : 'Lineup configuration has errors'
  });
}));

module.exports = router;