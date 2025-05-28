const express = require('express');
const { catchAsync } = require('../middleware/errorHandler');

const router = express.Router();

// Get player data for AI service
router.get('/players', catchAsync(async (req, res) => {
  const dataService = req.app.get('services').data;

  const data = await dataService.getPlayersForAI();

  res.json({
    success: true,
    data,
    message: `Retrieved ${data.players.length} players for AI service`
  });
}));

// Get lineup data for AI service  
router.get('/lineups', catchAsync(async (req, res) => {
  const dataService = req.app.get('services').data;

  const data = await dataService.getLineupsForAI();

  res.json({
    success: true,
    data,
    message: `Retrieved ${data.lineups.length} lineups for AI service`
  });
}));

// Get aggregated exposure data
router.get('/exposures', catchAsync(async (req, res) => {
  const dataService = req.app.get('services').data;

  const data = await dataService.getExposureData();

  res.json({
    success: true,
    data,
    message: 'Exposure data retrieved successfully'
  });
}));

// Get contest metadata and team analysis
router.get('/contest', catchAsync(async (req, res) => {
  const dataService = req.app.get('services').data;

  const data = await dataService.getContestData();

  res.json({
    success: true,
    data,
    message: 'Contest data retrieved successfully'
  });
}));

// Validate data integrity
router.post('/validate', catchAsync(async (req, res) => {
  const dataService = req.app.get('services').data;

  const validation = await dataService.validateData();

  res.json({
    success: validation.isValid,
    data: validation,
    message: validation.isValid ? 'Data validation passed' : 'Data validation failed'
  });
}));

module.exports = router;