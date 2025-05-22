const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const http = require('http');
const socketIo = require('socket.io');

// Import AI services
const RecommendationEngine = require('./services/RecommendationEngine');
const MetaDetector = require('./services/MetaDetector');
const PlayerPredictor = require('./services/PlayerPredictor');
const RiskAssessor = require('./services/RiskAssessor');
const DataCollector = require('./services/DataCollector');

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000", // React app
    methods: ["GET", "POST"]
  }
});

const PORT = process.env.AI_PORT || 3002;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize AI services
const recommendationEngine = new RecommendationEngine();
const metaDetector = new MetaDetector();
const playerPredictor = new PlayerPredictor();
const riskAssessor = new RiskAssessor();
const dataCollector = new DataCollector();

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    services: {
      recommendations: recommendationEngine.isReady(),
      meta_detection: metaDetector.isReady(),
      player_prediction: playerPredictor.isReady(),
      risk_assessment: riskAssessor.isReady()
    }
  });
});

// AI Insights Endpoints
app.post('/api/ai/recommendations', async (req, res) => {
  try {
    const { lineups, playerData, contestData } = req.body;
    
    console.log('Generating AI recommendations for', lineups?.length || 0, 'lineups');
    
    const recommendations = await recommendationEngine.generateRecommendations({
      lineups,
      playerData,
      contestData,
      timestamp: new Date().toISOString()
    });
    
    res.json({
      success: true,
      recommendations,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating recommendations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate recommendations',
      details: error.message
    });
  }
});

app.get('/api/ai/meta-insights', async (req, res) => {
  try {
    const insights = await metaDetector.getCurrentMetaInsights();
    
    res.json({
      success: true,
      meta_insights: insights,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting meta insights:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get meta insights',
      details: error.message
    });
  }
});

app.post('/api/ai/player-predictions', async (req, res) => {
  try {
    const { players, matchContext } = req.body;
    
    const predictions = await playerPredictor.predictPlayerPerformance(players, matchContext);
    
    res.json({
      success: true,
      predictions,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error predicting player performance:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to predict player performance',
      details: error.message
    });
  }
});

app.post('/api/ai/risk-assessment', async (req, res) => {
  try {
    const { lineups, exposureData } = req.body;
    
    const riskAnalysis = await riskAssessor.assessPortfolioRisk(lineups, exposureData);
    
    res.json({
      success: true,
      risk_analysis: riskAnalysis,
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error assessing risk:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to assess risk',
      details: error.message
    });
  }
});

// Real-time updates via WebSocket
io.on('connection', (socket) => {
  console.log('Client connected for AI updates:', socket.id);
  
  socket.on('subscribe_to_insights', (data) => {
    console.log('Client subscribed to AI insights:', data);
    
    // Send immediate insights if available
    socket.emit('ai_insights_update', {
      type: 'welcome',
      message: 'Connected to AI insights service',
      timestamp: new Date().toISOString()
    });
  });
  
  socket.on('request_live_recommendations', async (data) => {
    try {
      const recommendations = await recommendationEngine.generateRecommendations(data);
      socket.emit('live_recommendations', {
        recommendations,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      socket.emit('ai_error', {
        error: 'Failed to generate live recommendations',
        details: error.message
      });
    }
  });
  
  socket.on('disconnect', () => {
    console.log('Client disconnected:', socket.id);
  });
});

// Background data collection and model updates
const startBackgroundTasks = () => {
  // Collect data every hour
  setInterval(async () => {
    try {
      console.log('Running background data collection...');
      await dataCollector.collectLatestData();
      
      // Notify connected clients of data updates
      io.emit('data_update', {
        type: 'background_collection',
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Background data collection failed:', error);
    }
  }, 60 * 60 * 1000); // Every hour
  
  // Update meta insights every 30 minutes
  setInterval(async () => {
    try {
      console.log('Updating meta insights...');
      const insights = await metaDetector.updateMetaInsights();
      
      // Notify clients of meta changes
      io.emit('meta_update', {
        insights,
        timestamp: new Date().toISOString()
      });
    } catch (error) {
      console.error('Meta update failed:', error);
    }
  }, 30 * 60 * 1000); // Every 30 minutes
};

// Start server
server.listen(PORT, () => {
  console.log(`🤖 AI Service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  
  // Initialize background tasks
  startBackgroundTasks();
});

module.exports = { app, io };