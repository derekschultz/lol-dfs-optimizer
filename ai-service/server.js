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
const DataSyncService = require('./services/DataSyncService');

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
const dataSyncService = new DataSyncService();

// Health check
app.get('/health', (req, res) => {
  res.json({ 
    status: 'healthy', 
    timestamp: new Date().toISOString(),
    services: {
      recommendations: recommendationEngine.isReady(),
      meta_detection: metaDetector.isReady(),
      player_prediction: playerPredictor.isReady(),
      risk_assessment: riskAssessor.isReady(),
      data_sync: dataSyncService.isRunning
    }
  });
});

// AI Insights Endpoints
app.get('/api/ai/recommendations/live', async (req, res) => {
  try {
    console.log('Fetching live data using DataSyncService...');
    
    // Get live data from DataSyncService
    const players = dataSyncService.getPlayers();
    const lineups = dataSyncService.getLineups();
    const exposures = dataSyncService.getExposures();
    const contest = dataSyncService.getContest();
    
    if (!players.length && !lineups.length) {
      return res.status(404).json({
        success: false,
        error: 'No data available from main server',
        message: 'Please upload player projections and generate lineups first'
      });
    }
    
    console.log('Generating recommendations from synced data...');
    
    const recommendations = await recommendationEngine.generateRecommendations({
      lineups: lineups,
      playerData: players,
      contestData: contest,
      exposureData: exposures,
      timestamp: new Date().toISOString()
    });
    
    res.json({
      success: true,
      source: 'live_sync',
      live_data: true,
      recommendations,
      data_summary: {
        players_count: players.length,
        lineups_count: lineups.length,
        contest_data: !!contest,
        exposures_configured: Object.keys(exposures.team || {}).length > 0
      },
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating live recommendations:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to generate live recommendations',
      details: error.message
    });
  }
});

app.post('/api/ai/recommendations', async (req, res) => {
  try {
    const { lineups, playerData, contestData, forceRefresh } = req.body;
    
    console.log('Generating AI recommendations for', lineups?.length || 0, 'lineups', forceRefresh ? '(force refresh)' : '');
    
    const recommendations = await recommendationEngine.generateRecommendations({
      lineups,
      playerData,
      contestData,
      forceRefresh,
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

app.get('/api/ai/sync-status', (req, res) => {
  try {
    const players = dataSyncService.getPlayers();
    const lineups = dataSyncService.getLineups();
    const exposures = dataSyncService.getExposures();
    const contest = dataSyncService.getContest();
    
    res.json({
      success: true,
      sync_status: {
        is_running: dataSyncService.isRunning,
        last_sync: new Date().toISOString(),
        data_availability: {
          players: { count: players.length, available: players.length > 0 },
          lineups: { count: lineups.length, available: lineups.length > 0 },
          exposures: { configured: Object.keys(exposures.team || {}).length > 0 },
          contest: { configured: !!contest.metadata }
        }
      },
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error getting sync status:', error);
    res.status(500).json({
      success: false,
      error: 'Failed to get sync status',
      details: error.message
    });
  }
});

app.get('/api/ai/coach', async (req, res) => {
  try {
    console.log('Generating AI coach recommendations...');
    
    // Get current data
    const players = dataSyncService.getPlayers();
    const lineups = dataSyncService.getLineups();
    const exposures = dataSyncService.getExposures();
    
    if (!players.length || !lineups.length) {
      return res.status(404).json({
        success: false,
        error: 'Insufficient data for coaching',
        message: 'Please upload player projections and generate lineups first'
      });
    }
    
    // Clean lineup data to remove any circular references
    const cleanLineups = JSON.parse(JSON.stringify(lineups));
    const cleanPlayers = JSON.parse(JSON.stringify(players));
    const cleanExposures = JSON.parse(JSON.stringify(exposures));
    
    // Generate coaching insights
    const [recommendations, metaInsights, riskAnalysis] = await Promise.all([
      recommendationEngine.generateRecommendations({
        lineups: cleanLineups,
        playerData: cleanPlayers,
        exposureData: cleanExposures
      }),
      metaDetector.getCurrentMetaInsights(),
      riskAssessor.assessPortfolioRisk(cleanLineups, cleanExposures)
    ]);
    
    // Generate coaching summary
    const coachingSummary = {
      portfolio_grade: calculatePortfolioGrade(riskAnalysis, recommendations),
      key_strengths: identifyStrengths(cleanLineups, cleanPlayers, metaInsights),
      areas_for_improvement: identifyImprovements(riskAnalysis, recommendations),
      actionable_tips: generateActionableTips(recommendations, metaInsights, riskAnalysis),
      meta_alignment: assessMetaAlignment(cleanPlayers, cleanLineups, metaInsights),
      next_steps: generateNextSteps(recommendations, riskAnalysis)
    };
    
    res.json({
      success: true,
      coaching: coachingSummary,
      supporting_data: {
        recommendations_count: recommendations.length,
        risk_score: riskAnalysis.risk_score,
        meta_strength: metaInsights.metaStrength
      },
      generated_at: new Date().toISOString()
    });
  } catch (error) {
    console.error('Error generating coach insights:', error);
    
    // Check if it's a circular reference error
    if (error.message && error.message.includes('circular')) {
      console.error('Circular reference detected in data');
      return res.status(500).json({
        success: false,
        error: 'Data processing error - circular reference detected',
        details: 'The lineup data contains circular references. Please refresh the page and try again.'
      });
    }
    
    res.status(500).json({
      success: false,
      error: 'Failed to generate coach insights',
      details: error.message
    });
  }
});

// Helper functions for AI Coach
function calculatePortfolioGrade(riskAnalysis, recommendations) {
  let grade = 'A';
  let score = 85;
  
  // Deduct points for high risk
  if (riskAnalysis.risk_score > 70) {
    grade = 'C';
    score = 65;
  } else if (riskAnalysis.risk_score > 50) {
    grade = 'B';
    score = 75;
  }
  
  // Add points for good recommendations
  const highPriorityRecs = recommendations.filter(r => r.priority === 'high').length;
  if (highPriorityRecs === 0) {
    score += 10;
    if (score >= 90) grade = 'A+';
  }
  
  return { grade, score, description: getGradeDescription(grade) };
}

function getGradeDescription(grade) {
  const descriptions = {
    'A+': 'Exceptional portfolio construction with optimal diversification',
    'A': 'Strong portfolio with good risk/reward balance',
    'B': 'Solid portfolio with some areas for improvement',
    'C': 'Portfolio needs significant optimization',
    'D': 'High-risk portfolio requiring major adjustments'
  };
  return descriptions[grade] || 'Portfolio assessment unavailable';
}

function identifyStrengths(lineups, players, metaInsights) {
  const strengths = [];
  
  // Check diversification
  const uniqueTeams = new Set();
  lineups.forEach(lineup => {
    if (lineup.players) {
      lineup.players.forEach(player => uniqueTeams.add(player.team));
    }
  });
  
  if (uniqueTeams.size >= 4) {
    strengths.push({
      area: 'Diversification',
      description: `Good team diversification across ${uniqueTeams.size} teams`,
      impact: 'Reduces correlation risk'
    });
  }
  
  // Check meta alignment
  const metaPlayerCount = players.filter(p => 
    metaInsights.playerInsights?.some(insight => 
      insight.player === p.name && insight.metaFit > 0.8
    )
  ).length;
  
  if (metaPlayerCount > players.length * 0.6) {
    strengths.push({
      area: 'Meta Alignment',
      description: 'Strong alignment with current meta trends',
      impact: 'Higher expected performance'
    });
  }
  
  return strengths;
}

function identifyImprovements(riskAnalysis, recommendations) {
  const improvements = [];
  
  // High priority recommendations become improvements
  recommendations.filter(r => r.priority === 'high').forEach(rec => {
    improvements.push({
      area: rec.type.replace('_', ' ').toUpperCase(),
      description: rec.message,
      priority: 'high',
      action: 'Apply recommendation from AI insights'
    });
  });
  
  // Risk-based improvements
  if (riskAnalysis.risk_score > 60) {
    improvements.push({
      area: 'Risk Management',
      description: 'Portfolio risk score is elevated',
      priority: 'high',
      action: 'Review concentration and correlation risks'
    });
  }
  
  return improvements;
}

function generateActionableTips(recommendations, metaInsights, riskAnalysis) {
  const tips = [];
  
  // Meta-based tips
  if (metaInsights.trends?.rising_champions?.length > 0) {
    tips.push({
      category: 'Meta Optimization',
      tip: `Consider increasing exposure to rising champions: ${metaInsights.trends.rising_champions.slice(0, 2).map(c => c.name).join(', ')}`,
      difficulty: 'Easy'
    });
  }
  
  // Risk-based tips
  if (riskAnalysis.overall_risk === 'high') {
    tips.push({
      category: 'Risk Reduction',
      tip: 'Reduce exposure to your highest-owned players to lower concentration risk',
      difficulty: 'Medium'
    });
  }
  
  // General strategy tips
  tips.push({
    category: 'Strategy',
    tip: 'Consider creating both safe and aggressive lineup variants for different contest types',
    difficulty: 'Advanced'
  });
  
  return tips;
}

function assessMetaAlignment(players, lineups, metaInsights) {
  const totalPlayers = players.length;
  const metaAlignedPlayers = players.filter(p => 
    metaInsights.playerInsights?.some(insight => 
      insight.player === p.name && insight.metaFit > 0.75
    )
  ).length;
  
  const alignmentPercentage = (metaAlignedPlayers / totalPlayers) * 100;
  
  let status = 'poor';
  if (alignmentPercentage > 70) status = 'excellent';
  else if (alignmentPercentage > 50) status = 'good';
  else if (alignmentPercentage > 30) status = 'moderate';
  
  return {
    status,
    percentage: alignmentPercentage,
    aligned_players: metaAlignedPlayers,
    total_players: totalPlayers,
    description: `${alignmentPercentage.toFixed(1)}% of your player pool aligns well with current meta`
  };
}

function generateNextSteps(recommendations, riskAnalysis) {
  const steps = [];
  
  // Immediate actions
  const highPriorityRecs = recommendations.filter(r => r.priority === 'high');
  if (highPriorityRecs.length > 0) {
    steps.push({
      timeframe: 'Immediate',
      action: `Apply ${highPriorityRecs.length} high-priority recommendations`,
      description: 'Address the most impactful optimization opportunities'
    });
  }
  
  // Short-term actions
  if (riskAnalysis.risk_score > 50) {
    steps.push({
      timeframe: 'Short-term',
      action: 'Review and optimize portfolio risk',
      description: 'Analyze concentration and correlation risks'
    });
  }
  
  // Long-term strategy
  steps.push({
    timeframe: 'Ongoing',
    action: 'Monitor meta trends and player performance',
    description: 'Continuously adapt strategy based on evolving meta'
  });
  
  return steps;
}

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
server.listen(PORT, async () => {
  console.log(`🤖 AI Service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);
  
  // Initialize DataSyncService
  try {
    await dataSyncService.initialize();
  } catch (error) {
    console.error('Failed to initialize DataSyncService:', error.message);
  }
  
  // Initialize background tasks
  startBackgroundTasks();
});

module.exports = { app, io };