const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const http = require("http");
const socketIo = require("socket.io");
require("dotenv").config();

// Import AI services
const RecommendationEngine = require("./services/RecommendationEngine");
const MetaDetector = require("./services/MetaDetector");
const PlayerPredictor = require("./services/PlayerPredictor");
const RiskAssessor = require("./services/RiskAssessor");
const DataSyncService = require("./services/DataSyncService");
const BackgroundDataCollector = require("./services/BackgroundDataCollector");
// Removed LoL Esports API - using Riot API only
const MLModelService = require("./services/MLModelService");
const ChampionPerformanceTracker = require("./services/ChampionPerformanceTracker");

const app = express();
const server = http.createServer(app);
const io = socketIo(server, {
  cors: {
    origin: "http://localhost:3000", // React app
    methods: ["GET", "POST"],
  },
});

const PORT = process.env.AI_PORT || 3002;

// Middleware
app.use(cors());
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Initialize shared services first
const mlModelService = new MLModelService();
const championTracker = new ChampionPerformanceTracker(
  process.env.RIOT_API_KEY
);

// Initialize AI services with shared dependencies
const recommendationEngine = new RecommendationEngine(mlModelService);
const metaDetector = new MetaDetector(championTracker);
const playerPredictor = new PlayerPredictor(mlModelService, championTracker);
const riskAssessor = new RiskAssessor(mlModelService);
const dataSyncService = new DataSyncService();
const backgroundDataCollector = new BackgroundDataCollector(
  process.env.RIOT_API_KEY,
  championTracker
);

// Start background data collection
backgroundDataCollector.startAutoCollection();

// API key debug endpoint
app.get("/debug/api-key", (req, res) => {
  res.json({
    hasApiKey: !!process.env.RIOT_API_KEY,
    apiKeyLength: process.env.RIOT_API_KEY?.length || 0,
    apiKeyPrefix: process.env.RIOT_API_KEY?.substring(0, 10) || "none",
  });
});

// Test single API call endpoint
app.get("/debug/test-api-call", async (req, res) => {
  try {
    const testResult =
      await backgroundDataCollector.dataCollector.riotAPI.getSummonerByName(
        "Canyon",
        "KR",
        "KR1"
      );
    res.json({
      success: true,
      result: testResult,
      message: "API call successful",
    });
  } catch (error) {
    res.json({
      success: false,
      error: error.message,
      status: error.status,
      details: error.details,
      stack: error.stack,
      apiKeyUsed:
        backgroundDataCollector.dataCollector.riotAPI.apiKey?.substring(0, 10) +
        "...",
      apiKeyLength:
        backgroundDataCollector.dataCollector.riotAPI.apiKey?.length,
    });
  }
});

// Health check
app.get("/health", (req, res) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    services: {
      recommendations: recommendationEngine.isReady(),
      meta_detection: metaDetector.isReady(),
      player_prediction: playerPredictor.isReady(),
      risk_assessment: riskAssessor.isReady(),
      data_sync: dataSyncService.isRunning,
    },
  });
});

// Test Riot API integration
app.get("/api/ai/test-riot-api", async (req, res) => {
  try {
    if (!process.env.RIOT_API_KEY) {
      return res.json({
        success: false,
        error: "RIOT_API_KEY not configured in .env file",
      });
    }

    const RiotGamesAPI = require("./services/RiotGamesAPI");
    const riotAPI = new RiotGamesAPI(process.env.RIOT_API_KEY);

    // Test with an active NA account
    const summonerName = "GeneralSnivy"; // You can change this to any active player
    const region = "NA";

    // Get summoner
    const summoner = await riotAPI.getSummonerByName(summonerName, region);

    // Get recent matches
    const matchIds = await riotAPI.getMatchHistory(summoner.puuid, region, 5);

    // Get details for first match
    let matchData = null;
    if (matchIds.length > 0) {
      matchData = await riotAPI.processMatchForStats(matchIds[0], region);
    }

    res.json({
      success: true,
      summoner: {
        name: summoner.name,
        level: summoner.summonerLevel,
        puuid: summoner.puuid,
      },
      recent_matches: matchIds.length,
      sample_match: matchData
        ? {
            matchId: matchData.matchId,
            duration: Math.round(matchData.gameDuration / 60) + " minutes",
            player_stats:
              matchData.playerStats.find((p) => p.puuid === summoner.puuid)
                ?.stats || null,
          }
        : null,
    });
  } catch (error) {
    console.error("Error testing Riot API:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Test endpoint for ML scaling
app.post("/api/ai/test-ml-scaling", async (req, res) => {
  try {
    const { player } = req.body;

    if (!player || !player.projectedPoints) {
      return res.status(400).json({
        success: false,
        error: "Player with projectedPoints required",
      });
    }

    // Test ML prediction
    const playerFeatures = mlModelService.extractPlayerFeatures(player, {});
    const mlPrediction = await mlModelService.predictPlayerPerformance(
      playerFeatures,
      player
    );

    res.json({
      success: true,
      input: {
        player_name: player.name,
        base_projection: player.projectedPoints,
      },
      ml_prediction: mlPrediction,
      adjustment: {
        points_added: mlPrediction.fantasyPoints - player.projectedPoints,
        percentage:
          (
            ((mlPrediction.fantasyPoints - player.projectedPoints) /
              player.projectedPoints) *
            100
          ).toFixed(1) + "%",
      },
    });
  } catch (error) {
    console.error("Error testing ML scaling:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Update champion data from Riot API
app.post("/api/ai/update-riot-data", async (req, res) => {
  try {
    if (!process.env.RIOT_API_KEY) {
      return res.json({
        success: false,
        error: "RIOT_API_KEY not configured",
      });
    }

    // Trigger update with specific players
    await championTracker.updateStats();

    const stats = championTracker.getStats();
    res.json({
      success: true,
      message: "Champion data update initiated",
      stats: {
        totalGames: stats.totalGames,
        champions: stats.champions.length,
        players: stats.recentForms.length,
      },
    });
  } catch (error) {
    console.error("Error updating Riot data:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Test endpoint for champion performance
app.get("/api/ai/champion-stats", async (req, res) => {
  try {
    const topChampions = championTracker.getTopChampions(15);
    const totalChampions = championTracker.championStats.size;

    res.json({
      success: true,
      champion_data: {
        total_champions: totalChampions,
        last_update: championTracker.lastUpdate
          ? new Date(championTracker.lastUpdate).toISOString()
          : null,
        top_performers: topChampions.map((champ) => ({
          championName: champ.championName,
          tier: championTracker.getChampionTier(champ.championName),
          avgFantasyPoints: champ.avgFantasyPoints?.toFixed(2),
          winRate: champ.winRate
            ? (champ.winRate * 100).toFixed(1) + "%"
            : "N/A",
          picks: champ.picks,
          avgKDA: champ.avgKDA?.toFixed(2) || "N/A",
        })),
      },
    });
  } catch (error) {
    console.error("Error getting champion stats:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Player form analysis endpoints
app.get("/api/ai/player-form", async (req, res) => {
  try {
    const { player } = req.query;

    if (player) {
      // Get specific player form
      const form = championTracker.getPlayerForm(player);
      if (!form || form.trend === "stable") {
        return res.status(404).json({
          success: false,
          error: `No form data available for player: ${player}`,
        });
      }

      res.json({
        success: true,
        player_form: {
          player,
          ...form,
        },
      });
    } else {
      // Get all player forms
      const stats = championTracker.getStats();
      const hotPlayers = stats.recentForms.filter(
        (f) => f.hotStreak || f.trend === "hot"
      );
      const coldPlayers = stats.recentForms.filter(
        (f) => f.coldStreak || f.trend === "cold"
      );

      res.json({
        success: true,
        form_analysis: {
          hot_players: hotPlayers.slice(0, 5),
          cold_players: coldPlayers.slice(0, 5),
          all_forms: stats.recentForms,
          last_updated: championTracker.lastUpdate,
        },
      });
    }
  } catch (error) {
    console.error("Error getting player form:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/api/ai/streaks", async (req, res) => {
  try {
    const stats = championTracker.getStats();
    const forms = stats.recentForms;

    const winStreaks = forms
      .filter((f) => f.streak?.type === "win" && f.streak.count >= 2)
      .sort((a, b) => b.streak.count - a.streak.count);

    const lossStreaks = forms
      .filter((f) => f.streak?.type === "loss" && f.streak.count >= 2)
      .sort((a, b) => b.streak.count - a.streak.count);

    res.json({
      success: true,
      streaks: {
        win_streaks: winStreaks.map((f) => ({
          player: f.player,
          streak_count: f.streak.count,
          recent_fantasy_avg: f.recentAvgFantasy?.toFixed(1),
          form_rating: f.formRating?.toFixed(2),
        })),
        loss_streaks: lossStreaks.map((f) => ({
          player: f.player,
          streak_count: f.streak.count,
          recent_fantasy_avg: f.recentAvgFantasy?.toFixed(1),
          form_rating: f.formRating?.toFixed(2),
        })),
        summary: {
          players_on_win_streaks: winStreaks.length,
          players_on_loss_streaks: lossStreaks.length,
          longest_win_streak: winStreaks[0]?.streak?.count || 0,
          longest_loss_streak: lossStreaks[0]?.streak?.count || 0,
        },
      },
    });
  } catch (error) {
    console.error("Error getting streaks:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Player mapping management endpoints
app.get("/api/ai/player-mappings", (req, res) => {
  try {
    const mappings = Array.from(
      championTracker.proPlayerMappings.entries()
    ).map(([name, data]) => ({
      dfsName: name,
      ...data,
      hasPuuid: !!data.puuid,
    }));

    const successful = mappings.filter((m) => m.hasPuuid);
    const failed = mappings.filter((m) => !m.hasPuuid);

    res.json({
      success: true,
      player_mappings: {
        total: mappings.length,
        successful: successful.length,
        failed: failed.length,
        mappings: mappings,
        successful_players: successful.map((p) => p.dfsName),
        failed_players: failed.map((p) => ({
          name: p.dfsName,
          summoner: p.summonerName,
          region: p.region,
        })),
      },
    });
  } catch (error) {
    console.error("Error getting player mappings:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.post("/api/ai/test-player-lookup", async (req, res) => {
  try {
    const { summonerName, region, tagLine } = req.body;

    if (!summonerName || !region) {
      return res.status(400).json({
        success: false,
        error: "summonerName and region are required",
      });
    }

    const RiotGamesAPI = require("./services/RiotGamesAPI");
    const riotAPI = new RiotGamesAPI(process.env.RIOT_API_KEY);

    try {
      const summoner = await riotAPI.getSummonerByName(
        summonerName,
        region,
        tagLine
      );

      res.json({
        success: true,
        summoner_found: true,
        data: {
          name: summoner.name,
          level: summoner.summonerLevel,
          puuid: summoner.puuid,
          accountId: summoner.accountId,
          id: summoner.id,
        },
      });
    } catch (lookupError) {
      res.json({
        success: false,
        summoner_found: false,
        error: lookupError.response?.status || lookupError.message,
        attempted: {
          summonerName,
          region,
          tagLine: tagLine || "none",
        },
      });
    }
  } catch (error) {
    console.error("Error testing player lookup:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.get("/api/ai/matchup", async (req, res) => {
  try {
    const { player1, player2, team1, team2 } = req.query;

    if (team1 && team2) {
      // Team vs team analysis
      const analysis = await championTracker.getTeamMatchupAnalysis(
        team1,
        team2
      );
      if (!analysis) {
        return res.status(404).json({
          success: false,
          error: `No data available for teams: ${team1} vs ${team2}`,
        });
      }

      res.json({
        success: true,
        matchup_type: "team",
        ...analysis,
      });
    } else if (player1 && player2) {
      // Player vs player analysis
      const analysis = await championTracker.getMatchupAnalysis(
        player1,
        player2
      );
      if (!analysis) {
        return res.status(404).json({
          success: false,
          error: `No data available for players: ${player1} vs ${player2}`,
        });
      }

      res.json({
        success: true,
        matchup_type: "player",
        ...analysis,
      });
    } else {
      res.status(400).json({
        success: false,
        error:
          "Please provide either player1 & player2 or team1 & team2 parameters",
      });
    }
  } catch (error) {
    console.error("Error getting matchup analysis:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// Comprehensive AI insights endpoint
app.get("/api/ai/insights", async (req, res) => {
  try {
    const stats = championTracker.getStats();
    const metaInsights = await metaDetector.getCurrentMetaInsights();

    // Get hot/cold players
    const hotPlayers = stats.recentForms
      .filter((f) => f.hotStreak || f.trend === "hot")
      .slice(0, 5);
    const coldPlayers = stats.recentForms
      .filter((f) => f.coldStreak || f.trend === "cold")
      .slice(0, 5);

    // Get top performing champions
    const topChampions = championTracker.getTopChampions(10);

    // Get streak information
    const winStreaks = stats.recentForms
      .filter((f) => f.streak?.type === "win" && f.streak.count >= 2)
      .sort((a, b) => b.streak.count - a.streak.count)
      .slice(0, 3);

    const lossStreaks = stats.recentForms
      .filter((f) => f.streak?.type === "loss" && f.streak.count >= 2)
      .sort((a, b) => b.streak.count - a.streak.count)
      .slice(0, 3);

    // Calculate team form averages
    const teamForms = new Map();
    stats.recentForms.forEach((form) => {
      const mapping = championTracker.proPlayerMappings.get(form.player);
      if (mapping && mapping.team) {
        if (!teamForms.has(mapping.team)) {
          teamForms.set(mapping.team, {
            players: [],
            avgForm: 0,
            hotPlayers: 0,
          });
        }
        const team = teamForms.get(mapping.team);
        team.players.push(form);
        team.hotPlayers += form.hotStreak ? 1 : 0;
      }
    });

    // Calculate team averages
    for (const [teamName, team] of teamForms) {
      team.avgForm =
        team.players.reduce((sum, p) => sum + (p.formRating || 1), 0) /
        team.players.length;
    }

    const topTeams = Array.from(teamForms.entries())
      .sort(([, a], [, b]) => b.avgForm - a.avgForm)
      .slice(0, 5)
      .map(([name, data]) => ({
        team: name,
        avgFormRating: data.avgForm.toFixed(2),
        playersInForm: data.players.length,
        hotPlayers: data.hotPlayers,
      }));

    res.json({
      success: true,
      ai_insights: {
        data_status: {
          total_games_analyzed: stats.totalGames,
          champions_tracked: stats.champions.length,
          players_analyzed: stats.recentForms.length,
          last_update: championTracker.lastUpdate,
          ml_models_ready: mlModelService.isReady,
        },

        player_insights: {
          hot_players: hotPlayers.map((p) => ({
            player: p.player,
            trend: p.trend,
            recent_avg: p.recentAvgFantasy?.toFixed(1),
            streak: p.streak,
            form_rating: p.formRating?.toFixed(2),
            projection_multiplier: p.projectionMultiplier?.toFixed(2),
          })),

          cold_players: coldPlayers.map((p) => ({
            player: p.player,
            trend: p.trend,
            recent_avg: p.recentAvgFantasy?.toFixed(1),
            streak: p.streak,
            form_rating: p.formRating?.toFixed(2),
            projection_multiplier: p.projectionMultiplier?.toFixed(2),
          })),

          win_streaks: winStreaks.map((p) => ({
            player: p.player,
            streak_count: p.streak.count,
            recent_fantasy_avg: p.recentAvgFantasy?.toFixed(1),
          })),

          loss_streaks: lossStreaks.map((p) => ({
            player: p.player,
            streak_count: p.streak.count,
            recent_fantasy_avg: p.recentAvgFantasy?.toFixed(1),
          })),
        },

        champion_insights: {
          top_performers: topChampions.slice(0, 5).map((c) => ({
            champion: c.championName,
            tier: championTracker.getChampionTier(c.championName),
            avg_fantasy: c.avgFantasyPoints?.toFixed(1),
            win_rate: c.winRate ? (c.winRate * 100).toFixed(1) + "%" : "N/A",
            games: c.picks,
          })),

          meta_trends: metaInsights.trends?.rising_champions?.slice(0, 3) || [],
        },

        team_insights: {
          top_form_teams: topTeams,
          team_analysis: metaInsights.teamInsights || [],
        },

        recommendations: {
          captain_candidates: hotPlayers.slice(0, 3).map((p) => ({
            player: p.player,
            reason: `${p.trend} form with ${p.recentAvgFantasy?.toFixed(1)} avg fantasy points`,
          })),

          avoid_players: coldPlayers.slice(0, 2).map((p) => ({
            player: p.player,
            reason: `${p.trend} trend with ${p.streak?.type === "loss" ? p.streak.count + " game loss streak" : "declining performance"}`,
          })),

          stack_recommendations: topTeams.slice(0, 2).map((t) => ({
            team: t.team,
            reason: `${t.avgFormRating} avg form rating with ${t.hotPlayers} players in hot form`,
          })),
        },
      },
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error generating comprehensive insights:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

// AI Insights Endpoints
app.get("/api/ai/recommendations/live", async (req, res) => {
  try {
    console.log("Fetching live data using DataSyncService...");

    // Get live data from DataSyncService
    const players = dataSyncService.getPlayers();
    const lineups = dataSyncService.getLineups();
    const exposures = dataSyncService.getExposures();
    const contest = dataSyncService.getContest();

    if (!players.length && !lineups.length) {
      return res.status(404).json({
        success: false,
        error: "No data available from main server",
        message: "Please upload player projections and generate lineups first",
      });
    }

    console.log("Generating recommendations from synced data...");

    const recommendations = await recommendationEngine.generateRecommendations({
      lineups: lineups,
      playerData: players,
      contestData: contest,
      exposureData: exposures,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      source: "live_sync",
      live_data: true,
      recommendations,
      data_summary: {
        players_count: players.length,
        lineups_count: lineups.length,
        contest_data: !!contest,
        exposures_configured: Object.keys(exposures.team || {}).length > 0,
      },
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error generating live recommendations:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate live recommendations",
      details: error.message,
    });
  }
});

app.post("/api/ai/recommendations", async (req, res) => {
  try {
    const { lineups, playerData, contestData, forceRefresh } = req.body;

    console.log(
      "Generating AI recommendations for",
      lineups?.length || 0,
      "lineups",
      forceRefresh ? "(force refresh)" : ""
    );

    const recommendations = await recommendationEngine.generateRecommendations({
      lineups,
      playerData,
      contestData,
      forceRefresh,
      timestamp: new Date().toISOString(),
    });

    res.json({
      success: true,
      recommendations,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error generating recommendations:", error);
    res.status(500).json({
      success: false,
      error: "Failed to generate recommendations",
      details: error.message,
    });
  }
});

app.get("/api/ai/meta-insights", async (req, res) => {
  try {
    const insights = await metaDetector.getCurrentMetaInsights();

    res.json({
      success: true,
      meta_insights: insights,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error getting meta insights:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get meta insights",
      details: error.message,
    });
  }
});

// Removed second LoL Esports API test endpoint - using Riot API only

// ML Model information endpoint
app.get("/api/ai/ml-models", async (req, res) => {
  try {
    const modelInfo = {
      status: mlModelService.isReady ? "ready" : "initializing",
      models: mlModelService.isReady ? mlModelService.getModelInfo() : {},
      tensorflow_backend: require("@tensorflow/tfjs").getBackend(),
      features: {
        player_performance_prediction: mlModelService.isReady,
        lineup_scoring: mlModelService.isReady,
        risk_assessment: mlModelService.isReady,
      },
      generated_at: new Date().toISOString(),
    };

    res.json({
      success: true,
      ml_service: modelInfo,
    });
  } catch (error) {
    console.error("Error getting ML model info:", error);
    res.status(500).json({
      success: false,
      error: error.message,
    });
  }
});

app.post("/api/ai/player-predictions", async (req, res) => {
  try {
    const { players, matchContext } = req.body;

    const predictions = await playerPredictor.predictPlayerPerformance(
      players,
      matchContext
    );

    res.json({
      success: true,
      predictions,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error predicting player performance:", error);
    res.status(500).json({
      success: false,
      error: "Failed to predict player performance",
      details: error.message,
    });
  }
});

app.post("/api/ai/risk-assessment", async (req, res) => {
  try {
    const { lineups, exposureData } = req.body;

    const riskAnalysis = await riskAssessor.assessPortfolioRisk(
      lineups,
      exposureData
    );

    res.json({
      success: true,
      risk_analysis: riskAnalysis,
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error assessing risk:", error);
    res.status(500).json({
      success: false,
      error: "Failed to assess risk",
      details: error.message,
    });
  }
});

app.get("/api/ai/sync-status", (req, res) => {
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
          exposures: {
            configured: Object.keys(exposures.team || {}).length > 0,
          },
          contest: { configured: !!contest.metadata },
        },
      },
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error getting sync status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get sync status",
      details: error.message,
    });
  }
});

// Clear cache endpoint
app.post("/api/ai/clear-cache", (req, res) => {
  try {
    console.log("Clearing AI service cache...");
    dataSyncService.clearCache();

    res.json({
      success: true,
      message: "Cache cleared successfully",
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error clearing cache:", error);
    res.status(500).json({
      success: false,
      error: "Failed to clear cache",
      details: error.message,
    });
  }
});

// Force refresh endpoint
app.post("/api/ai/force-refresh", async (req, res) => {
  try {
    console.log("Force refreshing all data...");
    const result = await dataSyncService.forceRefreshAll();

    res.json({
      success: true,
      message: "Data refreshed successfully",
      data_summary: {
        players: result.players?.length || 0,
        lineups: result.lineups?.length || 0,
        has_exposures: !!result.exposures,
        has_contest: !!result.contest,
      },
      timestamp: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error force refreshing data:", error);
    res.status(500).json({
      success: false,
      error: "Failed to refresh data",
      details: error.message,
    });
  }
});

// Get cached data (instant response)
app.get("/api/ai/collect-data", async (req, res) => {
  try {
    console.log("📋 Serving cached data...");

    const cachedData = backgroundDataCollector.getCachedData();

    if (cachedData.success) {
      res.json({
        success: true,
        message: "Cached data retrieved successfully",
        data: {
          matches: {
            total: cachedData.data.matches?.total || 0,
            source: cachedData.data.matches?.source || "cached",
          },
          players: {
            total: cachedData.data.players?.total || 0,
            source: cachedData.data.players?.source || "cached",
          },
          ownership: {
            total: cachedData.data.ownership?.total || 0,
            source: "cached",
          },
          meta: {
            available: !!cachedData.data.meta,
            source: "cached",
          },
          errors: cachedData.data.errors || [],
          timestamp: cachedData.data.timestamp,
          lastUpdated: cachedData.lastUpdated,
          fromCache: true,
        },
      });
    } else {
      res.status(404).json({
        success: false,
        error: "No cached data available",
        message:
          "Background collection may still be running. Try again in a few minutes.",
        fromCache: true,
      });
    }
  } catch (error) {
    console.error("❌ Failed to get cached data:", error);
    res.status(500).json({
      success: false,
      error: "Failed to retrieve cached data",
      details: error.message,
    });
  }
});

// Manual trigger for background collection (for testing/forcing updates)
app.post("/api/ai/collect-data", async (req, res) => {
  try {
    console.log("🔄 Manual background collection triggered...");

    // Check if already collecting
    const status = backgroundDataCollector.getStatus();
    if (status.isCollecting) {
      return res.json({
        success: false,
        error: "Collection already in progress",
        message: "Background collection is currently running",
        status: status,
      });
    }

    // Check if data collector is ready
    if (!backgroundDataCollector.dataCollector.isReady()) {
      console.warn("⚠️ Data collector not ready - may be missing API key");
      return res.json({
        success: false,
        error: "Data collector not ready",
        message:
          "Data collector is not initialized. Check if RIOT_API_KEY is set.",
        hasApiKey: !!process.env.RIOT_API_KEY,
      });
    }

    // Check for player data
    try {
      const liveData =
        await backgroundDataCollector.dataCollector.fetchLiveData();
      if (
        !liveData.success ||
        !liveData.players ||
        liveData.players.length === 0
      ) {
        return res.json({
          success: false,
          error: "No player data available",
          message:
            "No player data found. Please upload player projections first.",
          liveData: liveData,
        });
      }
      console.log(
        `📊 Found ${liveData.players.length} players - proceeding with collection`
      );
    } catch (checkError) {
      console.error("❌ Error checking for player data:", checkError);
      return res.json({
        success: false,
        error: "Failed to check player data",
        message: checkError.message,
      });
    }

    // Start collection (non-blocking)
    backgroundDataCollector
      .collectAllData()
      .then((result) => {
        console.log(
          "✅ Manual collection completed:",
          result.success ? "SUCCESS" : "FAILED"
        );
        if (!result.success) {
          console.error("Collection error:", result.error);
        }
      })
      .catch((error) => {
        console.error("❌ Manual collection failed:", error);
      });

    res.json({
      success: true,
      message: "Background collection started",
      note: "Collection is running in background. Use GET /api/ai/collect-data to get cached results.",
      status: backgroundDataCollector.getStatus(),
    });
  } catch (error) {
    console.error("❌ Failed to start background collection:", error);
    res.status(500).json({
      success: false,
      error: "Failed to start background collection",
      details: error.message,
    });
  }
});

// Get collection status and progress
app.get("/api/ai/collection-status", async (req, res) => {
  try {
    const status = backgroundDataCollector.getStatus();
    const progress = backgroundDataCollector.getProgress();

    res.json({
      success: true,
      status: {
        ...status,
        nextCollection: status.lastCollection
          ? new Date(
              status.lastCollection.getTime() + 30 * 60 * 1000
            ).toISOString()
          : "Soon",
      },
      progress: progress,
    });
  } catch (error) {
    console.error("❌ Failed to get collection status:", error);
    res.status(500).json({
      success: false,
      error: "Failed to get collection status",
      details: error.message,
    });
  }
});

app.get("/api/ai/coach", async (req, res) => {
  try {
    console.log("Generating AI coach recommendations...");

    // Get current data
    const players = dataSyncService.getPlayers();
    const lineups = dataSyncService.getLineups();
    const exposures = dataSyncService.getExposures();

    if (!players.length || !lineups.length) {
      return res.status(404).json({
        success: false,
        error: "Insufficient data for coaching",
        message: "Please upload player projections and generate lineups first",
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
        exposureData: cleanExposures,
      }),
      metaDetector.getCurrentMetaInsights(),
      riskAssessor.assessPortfolioRisk(cleanLineups, cleanExposures),
    ]);

    // Get top players by projected points and generate predictions
    const topPlayers = cleanPlayers
      .sort((a, b) => (b.projectedPoints || 0) - (a.projectedPoints || 0))
      .slice(0, 10); // Top 10 players

    let playerPredictions = [];
    try {
      const predictions = await playerPredictor.predictPlayerPerformance(
        topPlayers,
        {}
      );
      playerPredictions = predictions.predictions || [];
    } catch (error) {
      console.warn("Failed to generate player predictions:", error.message);
    }

    // Generate coaching summary
    const coachingSummary = {
      portfolio_grade: calculatePortfolioGrade(riskAnalysis, recommendations),
      key_strengths: identifyStrengths(
        cleanLineups,
        cleanPlayers,
        metaInsights
      ),
      areas_for_improvement: identifyImprovements(
        riskAnalysis,
        recommendations
      ),
      actionable_tips: generateActionableTips(
        recommendations,
        metaInsights,
        riskAnalysis
      ),
      meta_alignment: assessMetaAlignment(
        cleanPlayers,
        cleanLineups,
        metaInsights
      ),
      next_steps: generateNextSteps(recommendations, riskAnalysis),
    };

    res.json({
      success: true,
      coaching: coachingSummary,
      player_predictions: playerPredictions.map((pred) => ({
        player: pred.player,
        projected: pred.predictions.projected_points,
        ceiling: pred.predictions.ceiling,
        floor: pred.predictions.floor,
        confidence: pred.confidence,
        factors: pred.factors,
      })),
      supporting_data: {
        recommendations_count: recommendations.length,
        risk_score: riskAnalysis.risk_score,
        meta_strength: metaInsights.metaStrength,
      },
      generated_at: new Date().toISOString(),
    });
  } catch (error) {
    console.error("Error generating coach insights:", error);

    // Check if it's a circular reference error
    if (error.message && error.message.includes("circular")) {
      console.error("Circular reference detected in data");
      return res.status(500).json({
        success: false,
        error: "Data processing error - circular reference detected",
        details:
          "The lineup data contains circular references. Please refresh the page and try again.",
      });
    }

    res.status(500).json({
      success: false,
      error: "Failed to generate coach insights",
      details: error.message,
    });
  }
});

// Helper functions for AI Coach
function calculatePortfolioGrade(riskAnalysis, recommendations) {
  let grade = "A";
  let score = 85;

  // Deduct points for high risk
  if (riskAnalysis.risk_score > 70) {
    grade = "C";
    score = 65;
  } else if (riskAnalysis.risk_score > 50) {
    grade = "B";
    score = 75;
  }

  // Add points for good recommendations
  const highPriorityRecs = recommendations.filter(
    (r) => r.priority === "high"
  ).length;
  if (highPriorityRecs === 0) {
    score += 10;
    if (score >= 90) grade = "A+";
  }

  return { grade, score, description: getGradeDescription(grade) };
}

function getGradeDescription(grade) {
  const descriptions = {
    "A+": "Exceptional portfolio construction with optimal diversification",
    A: "Strong portfolio with good risk/reward balance",
    B: "Solid portfolio with some areas for improvement",
    C: "Portfolio needs significant optimization",
    D: "High-risk portfolio requiring major adjustments",
  };
  return descriptions[grade] || "Portfolio assessment unavailable";
}

function identifyStrengths(lineups, players, metaInsights) {
  const strengths = [];

  // Check diversification
  const uniqueTeams = new Set();
  lineups.forEach((lineup) => {
    if (lineup.players) {
      lineup.players.forEach((player) => uniqueTeams.add(player.team));
    }
  });

  if (uniqueTeams.size >= 4) {
    strengths.push({
      area: "Diversification",
      description: `Good team diversification across ${uniqueTeams.size} teams`,
      impact: "Reduces correlation risk",
    });
  }

  // Check meta alignment
  const metaPlayerCount = players.filter((p) =>
    metaInsights.playerInsights?.some(
      (insight) => insight.player === p.name && insight.metaFit > 0.8
    )
  ).length;

  if (metaPlayerCount > players.length * 0.6) {
    strengths.push({
      area: "Meta Alignment",
      description: "Strong alignment with current meta trends",
      impact: "Higher expected performance",
    });
  }

  return strengths;
}

function identifyImprovements(riskAnalysis, recommendations) {
  const improvements = [];

  // High priority recommendations become improvements
  recommendations
    .filter((r) => r.priority === "high")
    .forEach((rec) => {
      improvements.push({
        area: rec.type.replace("_", " ").toUpperCase(),
        description: rec.message,
        priority: "high",
        action: "Apply recommendation from AI insights",
      });
    });

  // Risk-based improvements
  if (riskAnalysis.risk_score > 60) {
    improvements.push({
      area: "Risk Management",
      description: "Portfolio risk score is elevated",
      priority: "high",
      action: "Review concentration and correlation risks",
    });
  }

  return improvements;
}

function generateActionableTips(recommendations, metaInsights, riskAnalysis) {
  const tips = [];

  // Meta-based tips
  if (metaInsights.trends?.rising_champions?.length > 0) {
    tips.push({
      category: "Meta Optimization",
      tip: `Consider increasing exposure to rising champions: ${metaInsights.trends.rising_champions
        .slice(0, 2)
        .map((c) => c.name)
        .join(", ")}`,
      difficulty: "Easy",
    });
  }

  // Risk-based tips
  if (riskAnalysis.overall_risk === "high") {
    tips.push({
      category: "Risk Reduction",
      tip: "Reduce exposure to your highest-owned players to lower concentration risk",
      difficulty: "Medium",
    });
  }

  // General strategy tips
  tips.push({
    category: "Strategy",
    tip: "Consider creating both safe and aggressive lineup variants for different contest types",
    difficulty: "Advanced",
  });

  return tips;
}

function assessMetaAlignment(players, lineups, metaInsights) {
  const totalPlayers = players.length;
  const metaAlignedPlayers = players.filter((p) =>
    metaInsights.playerInsights?.some(
      (insight) => insight.player === p.name && insight.metaFit > 0.75
    )
  ).length;

  const alignmentPercentage = (metaAlignedPlayers / totalPlayers) * 100;

  let status = "poor";
  if (alignmentPercentage > 70) status = "excellent";
  else if (alignmentPercentage > 50) status = "good";
  else if (alignmentPercentage > 30) status = "moderate";

  return {
    status,
    percentage: alignmentPercentage,
    aligned_players: metaAlignedPlayers,
    total_players: totalPlayers,
    description: `${alignmentPercentage.toFixed(1)}% of your player pool aligns well with current meta`,
  };
}

function generateNextSteps(recommendations, riskAnalysis) {
  const steps = [];

  // Immediate actions
  const highPriorityRecs = recommendations.filter((r) => r.priority === "high");
  if (highPriorityRecs.length > 0) {
    steps.push({
      timeframe: "Immediate",
      action: `Apply ${highPriorityRecs.length} high-priority recommendations`,
      description: "Address the most impactful optimization opportunities",
    });
  }

  // Short-term actions
  if (riskAnalysis.risk_score > 50) {
    steps.push({
      timeframe: "Short-term",
      action: "Review and optimize portfolio risk",
      description: "Analyze concentration and correlation risks",
    });
  }

  // Long-term strategy
  steps.push({
    timeframe: "Ongoing",
    action: "Monitor meta trends and player performance",
    description: "Continuously adapt strategy based on evolving meta",
  });

  return steps;
}

// Real-time updates via WebSocket
io.on("connection", (socket) => {
  console.log("Client connected for AI updates:", socket.id);

  socket.on("subscribe_to_insights", (data) => {
    console.log("Client subscribed to AI insights:", data);

    // Send immediate insights if available
    socket.emit("ai_insights_update", {
      type: "welcome",
      message: "Connected to AI insights service",
      timestamp: new Date().toISOString(),
    });
  });

  socket.on("request_live_recommendations", async (data) => {
    try {
      const recommendations =
        await recommendationEngine.generateRecommendations(data);
      socket.emit("live_recommendations", {
        recommendations,
        timestamp: new Date().toISOString(),
      });
    } catch (error) {
      socket.emit("ai_error", {
        error: "Failed to generate live recommendations",
        details: error.message,
      });
    }
  });

  socket.on("disconnect", () => {
    console.log("Client disconnected:", socket.id);
  });
});

// Background data collection and model updates
const startBackgroundTasks = () => {
  // Collect data every hour
  setInterval(
    async () => {
      try {
        console.log("Running background data collection...");
        await backgroundDataCollector.dataCollector.collectLatestData();

        // Notify connected clients of data updates
        io.emit("data_update", {
          type: "background_collection",
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Background data collection failed:", error);
      }
    },
    60 * 60 * 1000
  ); // Every hour

  // Update meta insights every 30 minutes
  setInterval(
    async () => {
      try {
        console.log("Updating meta insights...");
        const insights = await metaDetector.updateMetaInsights();

        // Notify clients of meta changes
        io.emit("meta_update", {
          insights,
          timestamp: new Date().toISOString(),
        });
      } catch (error) {
        console.error("Meta update failed:", error);
      }
    },
    30 * 60 * 1000
  ); // Every 30 minutes
};

// Cleanup function
const cleanup = async () => {
  console.log("\n🔄 AI Service shutting down...");

  try {
    // Clear cached data
    dataSyncService.clearCache();
    console.log("✅ Cleared data sync cache");

    // Clear collection cache
    const fs = require("fs").promises;
    const path = require("path");
    const cacheDir = path.join(__dirname, "cache");

    // Remove collection-progress.json
    try {
      await fs.unlink(path.join(cacheDir, "collection-progress.json"));
      console.log("✅ Cleared collection progress cache");
    } catch (err) {
      // File might not exist
    }

    // Clear latest-data.json but keep player mappings
    try {
      const emptyData = {
        timestamp: new Date().toISOString(),
        players: [],
        matches: [],
        ownership: [],
        meta: {},
        collection_summary: { total_matches: 0, total_players: 0 },
        errors: [],
      };
      await fs.writeFile(
        path.join(cacheDir, "latest-data.json"),
        JSON.stringify(emptyData, null, 2)
      );
      console.log("✅ Reset latest data cache");
    } catch (err) {
      console.error("Failed to reset latest data:", err.message);
    }

    // Stop background tasks
    if (dataSyncService.isRunning) {
      dataSyncService.stop();
    }

    console.log("✅ Cleanup completed");
  } catch (error) {
    console.error("❌ Cleanup error:", error.message);
  }

  process.exit(0);
};

// Handle termination signals
process.on("SIGTERM", cleanup);
process.on("SIGINT", cleanup);

// Start server
server.listen(PORT, async () => {
  console.log(`🤖 AI Service running on port ${PORT}`);
  console.log(`Health check: http://localhost:${PORT}/health`);

  // Initialize DataSyncService
  try {
    await dataSyncService.initialize();
  } catch (error) {
    console.error("Failed to initialize DataSyncService:", error.message);
  }

  // Initialize background tasks
  startBackgroundTasks();
});

module.exports = { app, io };
