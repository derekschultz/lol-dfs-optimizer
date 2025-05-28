const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");

// Import refactored services and routes
const serviceRegistry = require('./src/services/ServiceRegistry');
const { router: playerRoutes } = require('./src/routes/players');
const { router: lineupRoutes } = require('./src/routes/lineups');
const { router: teamRoutes } = require('./src/routes/teams');
const fileRoutes = require('./src/routes/files');
const optimizationRoutes = require('./src/routes/optimizations');
const progressRoutes = require('./src/routes/progress');
const settingsRoutes = require('./src/routes/settings');
const dataRoutes = require('./src/routes/data');
const { errorHandler } = require('./src/middleware/errorHandler');

// Create Express app
const app = express();
const PORT = 3001;

// Enable CORS for all routes
app.use(cors());

// Parse JSON bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize services
serviceRegistry.initialize();
app.set('services', {
  player: serviceRegistry.getPlayerService(),
  lineup: serviceRegistry.getLineupService(),
  teamStack: serviceRegistry.getTeamStackService(),
  fileProcessing: serviceRegistry.getFileProcessingService(),
  optimization: serviceRegistry.getOptimizationService(),
  progress: serviceRegistry.getProgressService(),
  settings: serviceRegistry.getSettingsService(),
  data: serviceRegistry.getDataService()
});

app.set('repositories', {
  player: serviceRegistry.getPlayerRepository(),
  lineup: serviceRegistry.getLineupRepository(),
  teamStack: serviceRegistry.getTeamStackRepository()
});

// Setup API routes
app.use('/api/players', playerRoutes);
app.use('/api/lineups', lineupRoutes);
app.use('/api/teams', teamRoutes);
app.use('/api/files', fileRoutes);
app.use('/api/optimizations', optimizationRoutes);
app.use('/api/progress', progressRoutes);
app.use('/api/settings', settingsRoutes);
app.use('/api/data', dataRoutes);

// Global error handler (must be last middleware)
app.use(errorHandler);

// Start the server
app.listen(PORT, () => {
  console.log(`LoL DFS Optimization Server running on port ${PORT}`);
});