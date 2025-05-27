const MLModelService = require("./MLModelService");
const ChampionPerformanceTracker = require("./ChampionPerformanceTracker");

class PlayerPredictor {
  constructor(mlService = null, championTracker = null) {
    this.ready = false;
    this.models = {};
    this.cache = new Map();
    this.mlService = mlService || new MLModelService();
    this.championTracker = championTracker;
    this.initialize();
  }

  async initialize() {
    try {
      console.log("🔮 Initializing Player Predictor...");
      await this.loadModels();
      this.ready = true;
      console.log("✅ Player Predictor ready");
    } catch (error) {
      console.error("❌ Failed to initialize Player Predictor:", error);
    }
  }

  isReady() {
    return this.ready;
  }

  async loadModels() {
    // In production, these would be trained ML models
    // For now, we'll simulate with statistical models
    this.models = {
      performance: this.createPerformanceModel(),
      variance: this.createVarianceModel(),
      ceiling: this.createCeilingModel(),
      floor: this.createFloorModel(),
    };
  }

  async predictPlayerPerformance(players, matchContext = {}) {
    if (!this.ready) {
      throw new Error("Player Predictor not ready");
    }

    const predictions = [];

    for (const player of players) {
      const prediction = await this.predictSinglePlayer(player, matchContext);
      predictions.push(prediction);
    }

    return {
      predictions,
      context: matchContext,
      generated_at: new Date().toISOString(),
      model_version: "1.0.0",
    };
  }

  async predictSinglePlayer(player, matchContext) {
    const cacheKey = `${player.name}_${player.team}_${JSON.stringify(
      matchContext
    )}`;

    if (this.cache.has(cacheKey)) {
      return this.cache.get(cacheKey);
    }

    try {
      // Use ML model if available, otherwise fallback to statistical model
      let mlPrediction = null;

      console.log(
        `🔍 PlayerPredictor: ML Service Ready = ${this.mlService.isReady}, Player = ${player.name}`
      );

      if (this.mlService.isReady) {
        const playerFeatures = this.mlService.extractPlayerFeatures(
          player,
          matchContext
        );
        mlPrediction = await this.mlService.predictPlayerPerformance(
          playerFeatures,
          player
        );
        console.log(`✅ ML Prediction completed for ${player.name}`);
      }

      // Feature engineering for statistical model
      const features = this.extractFeatures(player, matchContext);

      // Generate predictions (ML if available, otherwise statistical)
      const basePrediction = mlPrediction
        ? mlPrediction.fantasyPoints
        : this.models.performance.predict(features);
      const variance = mlPrediction
        ? mlPrediction.variance
        : this.models.variance.predict(features);
      const ceiling = mlPrediction
        ? mlPrediction.ceiling
        : this.models.ceiling.predict(features);
      const floor = mlPrediction
        ? mlPrediction.floor
        : this.models.floor.predict(features);

      const prediction = {
        player: {
          name: player.name,
          team: player.team,
          position: player.position,
        },
        predictions: {
          projected_points: basePrediction,
          confidence_interval: {
            lower: basePrediction - variance,
            upper: basePrediction + variance,
          },
          ceiling: ceiling,
          floor: floor,
          variance: variance,
        },
        factors: this.generateExplanation(features, player),
        confidence: mlPrediction
          ? mlPrediction.confidence
          : this.calculateConfidence(features),
        model_used: mlPrediction ? "ml_neural_network" : "statistical",
        last_updated: new Date().toISOString(),
      };

      // Cache for 15 minutes
      this.cache.set(cacheKey, prediction);
      setTimeout(() => this.cache.delete(cacheKey), 15 * 60 * 1000);

      return prediction;
    } catch (error) {
      console.warn("Error in ML prediction, using fallback:", error.message);

      // Fallback to basic statistical prediction
      const features = this.extractFeatures(player, matchContext);
      const basePrediction = this.models.performance.predict(features);

      return {
        player: {
          name: player.name,
          team: player.team,
          position: player.position,
        },
        predictions: {
          projected_points: basePrediction,
          confidence_interval: {
            lower: basePrediction - 3,
            upper: basePrediction + 3,
          },
          ceiling: basePrediction + 5,
          floor: Math.max(0, basePrediction - 5),
          variance: 3,
        },
        factors: this.generateExplanation(features, player),
        confidence: 0.65,
        model_used: "fallback",
        last_updated: new Date().toISOString(),
      };
    }
  }

  extractFeatures(player, matchContext) {
    // Get champion performance data if available
    const championId = matchContext.championId || player.championId;
    const championStats = championId
      ? this.championTracker.getChampionStats(championId)
      : null;
    const championTier = championId
      ? this.championTracker.getChampionTier(championId)
      : "C";

    const baseFeatures = {
      // Player characteristics
      current_form: this.calculateRecentForm(player),
      season_average: player.projectedPoints || 20.0,
      position_strength: this.getPositionStrength(player.position),

      // Team factors
      team_strength: this.getTeamStrength(player.team),
      team_synergy: this.getTeamSynergy(player.team),

      // Match context
      opponent_strength: matchContext.opponent
        ? this.getTeamStrength(matchContext.opponent)
        : 0.5,
      match_importance: matchContext.importance || "regular",
      expected_game_length: matchContext.expectedLength || 32,

      // Meta factors
      meta_fit: this.getMetaFit(player),
      champion_pool_strength: this.getChampionPoolStrength(player),

      // Champion performance (NEW - using real data)
      champion_win_rate: championStats?.winRate || 0.5,
      champion_avg_fantasy: championStats?.avgFantasyPoints || 20,
      champion_pick_rate: championStats?.pickRate || 0.1,
      champion_tier:
        championTier === "S"
          ? 1.0
          : championTier === "A"
          ? 0.8
          : championTier === "B"
          ? 0.6
          : championTier === "C"
          ? 0.4
          : 0.2,

      // Historical performance
      vs_opponent_history: this.getOpponentHistory(
        player,
        matchContext.opponent
      ),
      recent_variance: this.calculateVariance(player),
    };

    return baseFeatures;
  }

  calculateRecentForm(player) {
    // Simulate recent form calculation
    const recentGames = [8.2, 7.8, 9.1, 8.5, 7.9]; // Mock data
    return recentGames.reduce((a, b) => a + b, 0) / recentGames.length;
  }

  getPositionStrength(position) {
    const strengths = {
      TOP: 0.7,
      JNG: 0.8,
      MID: 0.9,
      ADC: 0.85,
      SUP: 0.6,
    };
    return strengths[position] || 0.7;
  }

  getTeamStrength(team) {
    const strengths = {
      T1: 0.95,
      GEN: 0.88,
      DK: 0.75,
      DRX: 0.7,
      KT: 0.65,
    };
    return strengths[team] || 0.6;
  }

  getTeamSynergy(team) {
    const synergies = {
      T1: 0.92,
      GEN: 0.85,
      DK: 0.78,
      DRX: 0.82,
      KT: 0.75,
    };
    return synergies[team] || 0.7;
  }

  getMetaFit(player) {
    // Players who fit current meta well
    const metaFits = {
      Faker: 0.88,
      Chovy: 0.92,
      Zeus: 0.85,
      Canyon: 0.9,
      Ruler: 0.87,
    };
    return metaFits[player.name] || 0.75;
  }

  getChampionPoolStrength(player) {
    // Champion pool strength in current meta
    const poolStrengths = {
      Faker: 0.9,
      Chovy: 0.95,
      ShowMaker: 0.85,
      Zeus: 0.88,
      Kiin: 0.82,
    };
    return poolStrengths[player.name] || 0.8;
  }

  getOpponentHistory(player, opponent) {
    if (!opponent) return 0.5;

    // Simulate historical matchup data
    const historicalPerformance = Math.random() * 0.4 + 0.3; // 0.3 to 0.7
    return historicalPerformance;
  }

  calculateVariance(player) {
    // Players with higher variance
    const variances = {
      Faker: 0.8, // Lower variance (consistent)
      Zeus: 1.2, // Higher variance (boom/bust)
      Chovy: 0.7, // Very consistent
      Canyon: 1.0, // Moderate variance
    };
    return variances[player.name] || 1.0;
  }

  createPerformanceModel() {
    return {
      predict: (features) => {
        // Weighted combination of features
        let prediction = features.season_average * 0.3;
        prediction += features.current_form * 0.25;
        prediction += features.team_strength * 2.0;
        prediction += features.meta_fit * 1.5;
        prediction += features.position_strength * 1.0;

        // Opponent adjustment
        prediction +=
          (features.team_strength - features.opponent_strength) * 0.5;

        // Match importance adjustment
        if (features.match_importance === "playoff") prediction *= 1.1;
        if (features.match_importance === "finals") prediction *= 1.15;

        return Math.max(4.0, Math.min(12.0, prediction));
      },
    };
  }

  createVarianceModel() {
    return {
      predict: (features) => {
        let variance = features.recent_variance || 1.0;

        // Higher variance for:
        // - Weaker opponents (blowout potential)
        // - Important matches (pressure)
        // - Poor meta fit (inconsistent performance)

        if (features.opponent_strength < 0.5) variance *= 1.2;
        if (features.match_importance === "playoff") variance *= 1.15;
        if (features.meta_fit < 0.7) variance *= 1.1;

        return Math.max(0.5, Math.min(2.5, variance));
      },
    };
  }

  createCeilingModel() {
    return {
      predict: (features) => {
        const base = this.models.performance.predict(features);
        const variance = this.models.variance.predict(features);

        // Ceiling is base + (variance * ceiling_multiplier)
        let ceilingMultiplier = 2.0;

        // Higher ceiling for:
        if (features.opponent_strength < 0.6) ceilingMultiplier *= 1.2; // Weak opponents
        if (features.meta_fit > 0.85) ceilingMultiplier *= 1.1; // Good meta fit

        return base + variance * ceilingMultiplier;
      },
    };
  }

  createFloorModel() {
    return {
      predict: (features) => {
        const base = this.models.performance.predict(features);
        const variance = this.models.variance.predict(features);

        // Floor is base - (variance * floor_multiplier)
        let floorMultiplier = 1.5;

        // Lower floor for:
        if (features.opponent_strength > 0.8) floorMultiplier *= 1.2; // Strong opponents
        if (features.meta_fit < 0.7) floorMultiplier *= 1.1; // Poor meta fit

        return Math.max(2.0, base - variance * floorMultiplier);
      },
    };
  }

  generateExplanation(features, player) {
    const factors = [];

    if (features.current_form > features.season_average + 0.5) {
      factors.push({
        factor: "Recent Form",
        impact: "positive",
        description: "Strong recent performances boost projection",
      });
    }

    if (features.meta_fit > 0.85) {
      factors.push({
        factor: "Meta Alignment",
        impact: "positive",
        description: "Champion pool fits current meta perfectly",
      });
    }

    if (features.team_strength > 0.85) {
      factors.push({
        factor: "Team Strength",
        impact: "positive",
        description: "Playing for top-tier team with strong support",
      });
    }

    if (features.opponent_strength < 0.6) {
      factors.push({
        factor: "Favorable Matchup",
        impact: "positive",
        description: "Facing weaker opponent creates upside opportunity",
      });
    }

    if (features.recent_variance > 1.5) {
      factors.push({
        factor: "High Variance",
        impact: "neutral",
        description: "Inconsistent recent performances create uncertainty",
      });
    }

    return factors;
  }

  calculateConfidence(features) {
    let confidence = 0.7; // Base confidence

    // Higher confidence for:
    if (features.recent_variance < 1.0) confidence += 0.1; // Consistent players
    if (features.meta_fit > 0.8) confidence += 0.1; // Good meta fit
    if (features.team_strength > 0.8) confidence += 0.05; // Strong teams

    // Lower confidence for:
    if (features.recent_variance > 1.5) confidence -= 0.1; // Inconsistent players
    if (features.meta_fit < 0.6) confidence -= 0.1; // Poor meta fit

    return Math.max(0.3, Math.min(0.95, confidence));
  }
}

module.exports = PlayerPredictor;
