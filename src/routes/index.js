/**
 * Main Routes Index
 * Centralizes all route imports and provides API structure
 */

const express = require('express');
const { router: playersRouter } = require('./players');
const { router: lineupsRouter } = require('./lineups');
const { router: teamsRouter } = require('./teams');

const router = express.Router();

// API versioning (future-proofing)
const API_VERSION = '/api/v1';

// Health check endpoint
router.get('/health', (req, res) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: '1.0.0',
    services: {
      players: 'available',
      lineups: 'available',
      teams: 'available',
      // optimizer: 'available',  // Will be added in next step
    }
  });
});

// Mount route modules
router.use('/players', playersRouter);
router.use('/lineups', lineupsRouter);
router.use('/teams', teamsRouter);

// Future route modules (to be implemented)
// router.use('/optimizer', optimizerRouter);
// router.use('/simulation', simulationRouter);
// router.use('/upload', uploadRouter);
// router.use('/data', dataRouter);

// API documentation endpoint
router.get('/docs', (req, res) => {
  res.json({
    title: 'LoL DFS Optimizer API',
    version: '1.0.0',
    description: 'Advanced Monte Carlo simulation and optimization for League of Legends DFS',
    endpoints: {
      players: {
        'GET /players/projections': 'Get all players',
        'GET /players/:id': 'Get player by ID',
        'POST /players': 'Create new player',
        'PUT /players/:id': 'Update player',
        'DELETE /players/:id': 'Delete player',
        'DELETE /players/bulk': 'Delete multiple players',
        'POST /players/projections/upload': 'Upload player projections CSV',
        'GET /players/stats/teams': 'Get team statistics',
        'GET /players/stats/overview': 'Get player overview statistics',
        'POST /players/search': 'Search players with filters'
      },
      lineups: {
        'GET /lineups': 'Get all lineups',
        'GET /lineups/:id': 'Get lineup by ID',
        'POST /lineups': 'Create new lineup',
        'PUT /lineups/:id': 'Update lineup',
        'DELETE /lineups/:id': 'Delete lineup',
        'DELETE /lineups/bulk': 'Delete multiple lineups',
        'POST /lineups/search': 'Search lineups with filters',
        'GET /lineups/stats/overview': 'Get lineup statistics',
        'POST /lineups/export': 'Export lineups (CSV/JSON/DraftKings)',
        'POST /lineups/dkentries': 'Upload DraftKings entries CSV',
        'POST /lineups/import': 'Import lineups JSON',
        'POST /lineups/simulate': 'Run simulation on lineups'
      },
      teams: {
        'GET /teams/stacks': 'Get all team stacks (enhanced)',
        'GET /teams/stacks/raw': 'Get raw team stacks',
        'GET /teams/stacks/:id': 'Get team stack by ID',
        'GET /teams/:team/stacks': 'Get stacks for specific team',
        'POST /teams/stacks': 'Create new team stack',
        'PUT /teams/stacks/:id': 'Update team stack',
        'DELETE /teams/stacks/:id': 'Delete team stack',
        'DELETE /teams/stacks/bulk': 'Delete multiple team stacks',
        'POST /teams/stacks/search': 'Search team stacks with filters',
        'GET /teams/stacks/stats/overview': 'Get team stack statistics',
        'GET /teams/stacks/top/:limit?': 'Get top performing stacks',
        'GET /teams/stacks/tiers': 'Get stacks by performance tiers',
        'POST /teams/stacks/export': 'Export team stacks (CSV/JSON)',
        'POST /teams/stacks/upload': 'Upload team stacks CSV'
      }
      // Additional endpoints will be documented as they're implemented
    },
    status: 'Phase 1 - Service Extraction in Progress'
  });
});

// 404 handler for undefined routes
router.use('*', (req, res) => {
  res.status(404).json({
    status: 'error',
    message: `Route ${req.originalUrl} not found`,
    availableRoutes: [
      '/health',
      '/docs',
      '/players/*',
      '/lineups/*',
      '/teams/*'
    ]
  });
});

module.exports = router;