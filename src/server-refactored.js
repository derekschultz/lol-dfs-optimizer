/**
 * Refactored Server (Phase 1 Demo)
 * Demonstrates the new modular architecture
 * 
 * This file shows how the refactored server would look after Phase 1 extraction.
 * The original server.js remains intact for comparison and fallback.
 */

const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');

// Import middleware
const { errorHandler } = require('./middleware/errorHandler');

// Import routes
const apiRoutes = require('./routes');

// Create Express app
const app = express();
const PORT = process.env.REFACTORED_PORT || 3003; // Different port to avoid conflicts

// Middleware setup
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Request logging middleware (simple version)
app.use((req, res, next) => {
  console.log(`${new Date().toISOString()} - ${req.method} ${req.path}`);
  next();
});

// Mount API routes
app.use('/api', apiRoutes);

// Root endpoint
app.get('/', (req, res) => {
  res.json({
    message: 'LoL DFS Optimizer - Refactored API',
    version: '1.0.0',
    phase: 'Phase 1 - Service Extraction',
    status: 'Demo Mode',
    documentation: '/api/docs',
    health: '/api/health',
    endpoints: {
      players: '/api/players',
      // Additional endpoints will be added in subsequent phases
    },
    note: 'This is the refactored server running alongside the original server.js'
  });
});

// Global error handling middleware (must be last)
app.use(errorHandler);

// Start server
const server = app.listen(PORT, () => {
  console.log(`🚀 Refactored LoL DFS Optimization Server running on port ${PORT}`);
  console.log(`📚 API Documentation: http://localhost:${PORT}/api/docs`);
  console.log(`💚 Health Check: http://localhost:${PORT}/api/health`);
  console.log(`👥 Players API: http://localhost:${PORT}/api/players/projections`);
  console.log(`🔄 Phase 1 Status: Service extraction in progress`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  console.log('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    console.log('Process terminated');
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received. Shutting down gracefully...');
  server.close(() => {
    console.log('Process terminated');
  });
});

module.exports = app;