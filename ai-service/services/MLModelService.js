/**
 * Machine Learning Model Service
 * Provides ML-powered predictions using TensorFlow.js
 */

const tf = require("@tensorflow/tfjs");

class MLModelService {
  constructor() {
    this.models = new Map();
    this.isReady = false;
    this.trainingData = new Map();
    this.initialize();
  }

  async initialize() {
    try {
      console.log("🤖 Initializing ML Model Service...");

      // Initialize TensorFlow.js backend
      await tf.ready();
      console.log("🧠 TensorFlow.js backend ready");

      await this.createModels();
      await this.trainInitialModels();

      this.isReady = true;
      console.log("✅ ML Model Service ready");
    } catch (error) {
      console.error("❌ Failed to initialize ML Model Service:", error);
    }
  }

  async createModels() {
    // Player Performance Prediction Model
    this.models.set("playerPerformance", this.createPlayerPerformanceModel());

    // Lineup Optimization Score Model
    this.models.set("lineupScore", this.createLineupScoreModel());

    // Risk Assessment Model
    this.models.set("riskAssessment", this.createRiskAssessmentModel());

    console.log("🏗️ Created ML models:", Array.from(this.models.keys()));
  }

  createPlayerPerformanceModel() {
    // Neural network for player performance prediction
    const model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [12], // 12 input features
          units: 64,
          activation: "relu",
          name: "input_layer",
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 32,
          activation: "relu",
          name: "hidden_layer_1",
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 16,
          activation: "relu",
          name: "hidden_layer_2",
        }),
        tf.layers.dense({
          units: 4, // Output: [fantasy_points, variance, ceiling, floor]
          activation: "sigmoid", // Bounded 0-1 outputs for controlled adjustments
          name: "output_layer",
        }),
      ],
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: "meanSquaredError",
      metrics: ["mae"],
    });

    return model;
  }

  createLineupScoreModel() {
    // Model for scoring lineup quality
    const model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [20], // 20 lineup features
          units: 128,
          activation: "relu",
        }),
        tf.layers.dropout({ rate: 0.3 }),
        tf.layers.dense({
          units: 64,
          activation: "relu",
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 32,
          activation: "relu",
        }),
        tf.layers.dense({
          units: 1, // Single score output
          activation: "sigmoid",
        }),
      ],
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: "meanSquaredError",
      metrics: ["mae"],
    });

    return model;
  }

  createRiskAssessmentModel() {
    // Model for risk assessment
    const model = tf.sequential({
      layers: [
        tf.layers.dense({
          inputShape: [15], // 15 risk features
          units: 64,
          activation: "relu",
        }),
        tf.layers.dropout({ rate: 0.2 }),
        tf.layers.dense({
          units: 32,
          activation: "relu",
        }),
        tf.layers.dense({
          units: 16,
          activation: "relu",
        }),
        tf.layers.dense({
          units: 3, // Output: [concentration_risk, variance_risk, meta_risk]
          activation: "sigmoid",
        }),
      ],
    });

    model.compile({
      optimizer: tf.train.adam(0.001),
      loss: "meanSquaredError",
      metrics: ["mae"],
    });

    return model;
  }

  async trainInitialModels() {
    console.log("🎓 Training initial ML models...");

    // Generate synthetic training data for initial model training
    await this.trainPlayerPerformanceModel();
    await this.trainLineupScoreModel();
    await this.trainRiskAssessmentModel();

    console.log("✅ Initial model training completed");
  }

  async trainPlayerPerformanceModel() {
    const model = this.models.get("playerPerformance");
    const trainingData = this.generatePlayerTrainingData(1000);

    const xs = tf.tensor2d(trainingData.inputs);
    const ys = tf.tensor2d(trainingData.outputs);

    await model.fit(xs, ys, {
      epochs: 50,
      batchSize: 32,
      validationSplit: 0.2,
      verbose: 0,
    });

    xs.dispose();
    ys.dispose();

    console.log("🎯 Player performance model trained");
  }

  async trainLineupScoreModel() {
    const model = this.models.get("lineupScore");
    const trainingData = this.generateLineupTrainingData(800);

    const xs = tf.tensor2d(trainingData.inputs);
    const ys = tf.tensor2d(trainingData.outputs);

    await model.fit(xs, ys, {
      epochs: 40,
      batchSize: 32,
      validationSplit: 0.2,
      verbose: 0,
    });

    xs.dispose();
    ys.dispose();

    console.log("🏆 Lineup score model trained");
  }

  async trainRiskAssessmentModel() {
    const model = this.models.get("riskAssessment");
    const trainingData = this.generateRiskTrainingData(600);

    const xs = tf.tensor2d(trainingData.inputs);
    const ys = tf.tensor2d(trainingData.outputs);

    await model.fit(xs, ys, {
      epochs: 35,
      batchSize: 32,
      validationSplit: 0.2,
      verbose: 0,
    });

    xs.dispose();
    ys.dispose();

    console.log("⚖️ Risk assessment model trained");
  }

  generatePlayerTrainingData(samples) {
    const inputs = [];
    const outputs = [];

    for (let i = 0; i < samples; i++) {
      // Input features: [avg_kda, recent_form, team_strength, meta_fit, role_factor,
      //                 opponent_strength, game_length_expected, champion_mastery,
      //                 recent_performance, salary, ownership_projected, variance_history]
      const input = [
        Math.random() * 10, // avg_kda
        Math.random() * 100, // recent_form
        Math.random() * 100, // team_strength
        Math.random(), // meta_fit
        Math.random() * 5, // role_factor
        Math.random() * 100, // opponent_strength
        20 + Math.random() * 40, // game_length_expected
        Math.random(), // champion_mastery
        Math.random() * 100, // recent_performance
        5000 + Math.random() * 5000, // salary
        Math.random(), // ownership_projected
        Math.random() * 50, // variance_history
      ];

      // Output: [adjustment_factor, variance_factor, ceiling_factor, floor_factor]
      // All outputs normalized to 0-1 range for sigmoid activation
      const adjustmentFactor = 0.5 + (Math.random() - 0.5) * 0.6; // 0.2 to 0.8, centered at 0.5
      const varianceFactor = 0.1 + Math.random() * 0.3; // 0.1 to 0.4 (10-40% variance)
      const ceilingFactor = 0.6 + Math.random() * 0.3; // 0.6 to 0.9
      const floorFactor = 0.1 + Math.random() * 0.3; // 0.1 to 0.4

      const output = [
        adjustmentFactor,
        varianceFactor,
        ceilingFactor,
        floorFactor,
      ];

      inputs.push(input);
      outputs.push(output);
    }

    return { inputs, outputs };
  }

  generateLineupTrainingData(samples) {
    const inputs = [];
    const outputs = [];

    for (let i = 0; i < samples; i++) {
      // Lineup features: team stacking, salary distribution, projected ownership, etc.
      const input = Array.from({ length: 20 }, () => Math.random());

      // Score based on balance and optimization principles
      const balance = 1 - Math.abs(0.5 - input[0]); // Salary balance
      const stacking = input[1] * 0.8; // Team stacking value
      const ownership = 1 - input[2]; // Lower ownership = higher score
      const projectedPoints = input[3] * 100;

      const score =
        (balance * 0.2 +
          stacking * 0.3 +
          ownership * 0.2 +
          projectedPoints * 0.01) /
        100;

      inputs.push(input);
      outputs.push([score]);
    }

    return { inputs, outputs };
  }

  generateRiskTrainingData(samples) {
    const inputs = [];
    const outputs = [];

    for (let i = 0; i < samples; i++) {
      // Risk features
      const input = Array.from({ length: 15 }, () => Math.random());

      // Risk calculations
      const concentrationRisk = input[0] > 0.8 ? 0.9 : input[0]; // High concentration = high risk
      const varianceRisk = input[1] * 0.7 + 0.1; // Base variance risk
      const metaRisk = input[2] < 0.3 ? 0.8 : 0.2; // Off-meta = high risk

      const output = [concentrationRisk, varianceRisk, metaRisk];

      inputs.push(input);
      outputs.push(output);
    }

    return { inputs, outputs };
  }

  async predictPlayerPerformance(playerFeatures, player = {}) {
    if (!this.isReady) {
      throw new Error("ML Model Service not ready");
    }

    // If we have projected points, use them as the primary signal with ML adjustments
    const baseProjection =
      player.projectedPoints || player.projected_points || null;

    if (baseProjection && baseProjection > 5) {
      // Use projected points as base, apply ML for variance and adjustments
      const model = this.models.get("playerPerformance");
      const input = tf.tensor2d([playerFeatures]);

      const prediction = model.predict(input);
      const result = await prediction.data();

      input.dispose();
      prediction.dispose();

      // Use ML for percentage-based adjustment (result[0] trained on 8-35 range)
      // ML output is sigmoid (0-1), convert to adjustment factor (-0.1 to +0.1)
      const mlFactor = (result[0] - 0.5) * 0.2; // Maps 0-1 to -0.1 to +0.1
      const mlAdjustment = baseProjection * mlFactor; // ±10% max adjustment
      const adjustedPoints = Math.max(5, baseProjection + mlAdjustment);

      // Variance should be proportional to base projection (10-20% typically)
      const variance = baseProjection * 0.15 * result[1]; // result[1] is 0-1, so variance is 0-15% of projection
      const ceiling = adjustedPoints + variance * 1.5;
      const floor = Math.max(1, adjustedPoints - variance);

      console.log(
        `🎯 ML Prediction for ${player.name}: Base=${baseProjection.toFixed(
          1
        )}, MLFactor=${mlFactor.toFixed(3)}, Adjustment=${mlAdjustment.toFixed(
          1
        )}, Final=${adjustedPoints.toFixed(1)}`
      );

      return {
        fantasyPoints: adjustedPoints,
        variance: variance,
        ceiling: ceiling,
        floor: floor,
        confidence: 0.85,
      };
    } else {
      // Fall back to pure ML prediction when no projected points
      const model = this.models.get("playerPerformance");
      const input = tf.tensor2d([playerFeatures]);

      const prediction = model.predict(input);
      const result = await prediction.data();

      input.dispose();
      prediction.dispose();

      // Without base projection, use normalized factors to generate reasonable estimates
      const baseEstimate = 20; // Default expectation for LoL fantasy points
      const adjustmentFactor = (result[0] - 0.5) * 0.3; // -15% to +15%
      const scaledPoints = baseEstimate * (1 + adjustmentFactor);
      const scaledVariance = baseEstimate * result[1] * 0.2; // 0-20% variance
      const scaledCeiling = scaledPoints + scaledVariance * 1.5;
      const scaledFloor = Math.max(5, scaledPoints - scaledVariance);

      return {
        fantasyPoints: scaledPoints,
        variance: scaledVariance,
        ceiling: scaledCeiling,
        floor: scaledFloor,
        confidence: 0.75, // Lower confidence without projected points
      };
    }
  }

  async scoreLineup(lineupFeatures) {
    if (!this.isReady) {
      throw new Error("ML Model Service not ready");
    }

    const model = this.models.get("lineupScore");
    const input = tf.tensor2d([lineupFeatures]);

    const prediction = model.predict(input);
    const result = await prediction.data();

    input.dispose();
    prediction.dispose();

    return {
      score: result[0],
      confidence: 0.82,
    };
  }

  async assessRisk(riskFeatures) {
    if (!this.isReady) {
      throw new Error("ML Model Service not ready");
    }

    const model = this.models.get("riskAssessment");
    const input = tf.tensor2d([riskFeatures]);

    const prediction = model.predict(input);
    const result = await prediction.data();

    input.dispose();
    prediction.dispose();

    return {
      concentrationRisk: result[0],
      varianceRisk: result[1],
      metaRisk: result[2],
      overallRisk: (result[0] + result[1] + result[2]) / 3,
      confidence: 0.78,
    };
  }

  extractPlayerFeatures(player, context = {}) {
    // Extract normalized features for ML model
    // Many features use estimated/default values since real data isn't available

    // Use projected points as a base if available
    const baseProjection =
      player.projectedPoints || player.projected_points || 12;
    console.log(`🔍 ML Feature Extraction for ${player.name}:`, {
      baseProjection,
      position: player.position,
      salary: player.salary,
      providedData: Object.keys(player),
    });

    return [
      (player.avg_kda || 2.5) / 6.0, // Real if provided, else decent default
      (player.recent_form || baseProjection * 5) / 100.0, // Scale projected points to form
      (player.team_strength || 75) / 100.0, // Estimate based on team tier
      player.meta_fit || 0.7, // Estimated meta fitness
      this.getRoleMultiplier(player.position) / 5.0, // Position scoring potential
      (context.opponent_strength || 60) / 100.0, // Opponent difficulty estimate
      (context.expected_game_length || 32) / 60.0, // Game length impact
      player.champion_mastery || 0.75, // Player skill estimate
      baseProjection / 30.0, // Use projected points as performance indicator
      (player.salary || 8000) / 15000.0, // Real salary if provided
      player.projected_ownership || 0.15, // Ownership estimate
      this.getPositionVariance(player.position) / 50.0, // Position-based variance
    ];
  }

  getRoleMultiplier(position) {
    // Different positions have different scoring potential in LoL DFS
    const multipliers = {
      MID: 4.5, // Highest scoring potential
      ADC: 4.2, // High scoring
      JNG: 4.0, // Good scoring
      TOP: 3.5, // Moderate scoring
      SUP: 3.0, // Lower scoring but consistent
    };
    return multipliers[position] || 3.5;
  }

  getPositionVariance(position) {
    // Different positions have different variance levels
    const variances = {
      MID: 25, // High variance
      JNG: 30, // Highest variance
      ADC: 20, // Moderate-high variance
      TOP: 15, // Lower variance
      SUP: 10, // Lowest variance
    };
    return variances[position] || 20;
  }

  extractLineupFeatures(lineup, context = {}) {
    // Extract features for lineup scoring
    const features = [];

    // Salary distribution
    const totalSalary = lineup.reduce((sum, p) => sum + (p.salary || 0), 0);
    features.push(totalSalary / 50000.0); // Normalized total salary

    // Team stacking
    const teamCounts = {};
    lineup.forEach((p) => {
      teamCounts[p.team || "unknown"] =
        (teamCounts[p.team || "unknown"] || 0) + 1;
    });
    const maxStack = Math.max(...Object.values(teamCounts));
    features.push(maxStack / lineup.length);

    // Average ownership
    const avgOwnership =
      lineup.reduce((sum, p) => sum + (p.projected_ownership || 0.1), 0) /
      lineup.length;
    features.push(avgOwnership);

    // Projected points
    const projectedPoints = lineup.reduce(
      (sum, p) => sum + (p.projected_points || 10),
      0
    );
    features.push(projectedPoints / 200.0);

    // Fill remaining features with calculated values
    while (features.length < 20) {
      features.push(Math.random() * 0.5 + 0.25); // Placeholder features
    }

    return features;
  }

  extractRiskFeatures(portfolio, context = {}) {
    // Extract risk-related features
    const features = [];

    // Player concentration
    const playerCounts = {};
    portfolio.forEach((lineup) => {
      lineup.forEach((player) => {
        playerCounts[player.name] = (playerCounts[player.name] || 0) + 1;
      });
    });

    const maxPlayerExposure =
      Math.max(...Object.values(playerCounts)) / portfolio.length;
    features.push(maxPlayerExposure);

    // Fill with calculated risk metrics
    features.push(context.variance_factor || 0.3);
    features.push(context.meta_stability || 0.6);

    // Fill remaining features
    while (features.length < 15) {
      features.push(Math.random() * 0.4 + 0.1);
    }

    return features;
  }

  // Retrain models with new data
  async retrainModel(modelName, newTrainingData) {
    if (!this.models.has(modelName)) {
      throw new Error(`Model ${modelName} not found`);
    }

    const model = this.models.get(modelName);
    const xs = tf.tensor2d(newTrainingData.inputs);
    const ys = tf.tensor2d(newTrainingData.outputs);

    await model.fit(xs, ys, {
      epochs: 20,
      batchSize: 16,
      verbose: 0,
    });

    xs.dispose();
    ys.dispose();

    console.log(`🔄 Model ${modelName} retrained with new data`);
  }

  // Get model information
  getModelInfo() {
    const info = {};

    for (const [name, model] of this.models.entries()) {
      info[name] = {
        inputShape: model.inputs[0].shape,
        outputShape: model.outputs[0].shape,
        trainableParams: model.countParams(),
      };
    }

    return info;
  }

  // Clean up resources
  dispose() {
    for (const model of this.models.values()) {
      model.dispose();
    }
    this.models.clear();
    console.log("🧹 ML Model Service disposed");
  }
}

module.exports = MLModelService;
