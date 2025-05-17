// index.js - Main entry point for the Ultimate LoL DFS Simulation System

const fs = require('fs');
const path = require('path');
const { fork } = require('child_process');
const os = require('os');
const Papa = require('papaparse');

// Import core modules
const { BayesianScoreProjection, GameScriptSimulator, CopulaCorrelationSystem } = require('./advanced-statistical-models');
const { EnhancedSimulationAnalyzer, EnhancedReportGenerator } = require('./enhanced-analyzer');
const OptimalLineupGenerator = require('./optimal-lineup-generator');

/**
 * Ultimate League of Legends DFS Simulation System
 * - Integrates all advanced components
 * - Provides a unified interface for simulation, analysis, and optimization
 */
class UltimateLoLDFSSystem {
  constructor(options = {}) {
    this.options = {
      simulationIterations: options.simulationIterations || 2000,
      fieldSize: options.fieldSize || 1176,
      entryFee: options.entryFee || 5,
      dataDir: options.dataDir || './data',
      outputDir: options.outputDir || './output',
      maxWorkers: options.maxWorkers || Math.min(os.cpus().length, 4),
      ...options
    };

    // Create output directory if it doesn't exist
    if (!fs.existsSync(this.options.outputDir)) {
      fs.mkdirSync(this.options.outputDir, { recursive: true });
    }

    // Initialize components
    this.analyzer = null;
    this.generator = null;
    this.simulationResults = null;
    this.playerProjections = null;
    this.teamProjections = null;
  }

  /**
   * Run the simulation and analysis pipeline
   * @param {Array} lineups - The lineups to analyze
   * @param {Object} options - Additional options
   * @returns {Object} The comprehensive analysis results
   */
  async runSimulationPipeline(lineups, options = {}) {
    console.log("=== Starting Ultimate LoL DFS Simulation Pipeline ===");
    console.time('Total Pipeline Time');

    // Load and parse data
    await this.loadData(options.playerDataFile, options.teamDataFile);

    // Run the simulation
    console.log(`Running advanced parallel Monte Carlo simulation with ${this.options.simulationIterations} iterations...`);
    console.time('Simulation Time');
    this.simulationResults = await this.runParallelSimulation(lineups);
    console.timeEnd('Simulation Time');

    // Run enhanced analysis
    console.log("Performing enhanced statistical analysis...");
    console.time('Analysis Time');
    this.analyzer = new EnhancedSimulationAnalyzer(
      this.simulationResults,
      this.playerProjections,
      this.teamProjections
    );
    const analysis = this.analyzer.calculateAllMetrics();
    console.timeEnd('Analysis Time');

    // Generate detailed report
    console.log("Generating comprehensive analysis report...");
    console.time('Report Generation Time');
    const reportGenerator = new EnhancedReportGenerator(
      this.analyzer.generateAnalysisReport(),
      this.playerProjections,
      this.teamProjections
    );

    // Save report to file
    const reportFilePath = path.join(this.options.outputDir, 'advanced_analysis_report.md');
    reportGenerator.saveReportToFile(reportFilePath);
    console.log(`Saved detailed analysis report to: ${reportFilePath}`);
    console.timeEnd('Report Generation Time');

    // Initialize the lineup generator
    this.generator = new OptimalLineupGenerator(
      this.simulationResults,
      this.playerProjections,
      this.teamProjections,
      lineups
    );

    console.timeEnd('Total Pipeline Time');
    console.log("=== Simulation Pipeline Complete ===");

    return {
      simulationResults: this.simulationResults,
      analysis: analysis,
      reportPath: reportFilePath
    };
  }

 /**
 * Load and parse player and team data
 * @param {string} playerDataFile - Path to player data CSV
 * @param {string} teamDataFile - Path to team data CSV
 */
async loadData(playerDataFile, teamDataFile) {
  console.log("Loading data files...");

  // Use provided file paths or find files by pattern
  let playerFilePath;
  let teamFilePath;

  if (playerDataFile) {
    // Use exact provided file path
    playerFilePath = playerDataFile;
  } else {
    // Find files matching the pattern in the data directory
    const dataDir = this.options.dataDir;
    const files = fs.readdirSync(dataDir);

    // Look for ROO_export files
    const rooFiles = files.filter(file => /LOL_ROO_export(?:\s*\(\d+\))?.csv/i.test(file));

    if (rooFiles.length > 0) {
      // Use the most recent file (assuming higher numbers in parentheses are more recent)
      rooFiles.sort((a, b) => {
        const getVersionNumber = (filename) => {
          const match = filename.match(/\((\d+)\)/);
          return match ? parseInt(match[1]) : 0;
        };
        return getVersionNumber(b) - getVersionNumber(a);
      });

      playerFilePath = path.join(dataDir, rooFiles[0]);
      console.log(`Found player data file: ${rooFiles[0]}`);
    } else {
      playerFilePath = path.join(dataDir, 'LOL_ROO_export.csv');
    }
  }

  if (teamDataFile) {
    // Use exact provided file path
    teamFilePath = teamDataFile;
  } else {
    // Find files matching the pattern in the data directory
    const dataDir = this.options.dataDir;
    const files = fs.readdirSync(dataDir);

    // Look for Stacks_export files
    const stacksFiles = files.filter(file => /LOL_Stacks_export(?:\s*\(\d+\))?.csv/i.test(file));

    if (stacksFiles.length > 0) {
      // Use the most recent file (assuming higher numbers in parentheses are more recent)
      stacksFiles.sort((a, b) => {
        const getVersionNumber = (filename) => {
          const match = filename.match(/\((\d+)\)/);
          return match ? parseInt(match[1]) : 0;
        };
        return getVersionNumber(b) - getVersionNumber(a);
      });

      teamFilePath = path.join(dataDir, stacksFiles[0]);
      console.log(`Found team data file: ${stacksFiles[0]}`);
    } else {
      teamFilePath = path.join(dataDir, 'LOL_Stacks_export.csv');
    }
  }

  // Load player data
  const playersData = await this.readAndParseCSV(playerFilePath);

  // Load team data
  const stacksData = await this.readAndParseCSV(teamFilePath);

  // Process player data
  this.playerProjections = {};
  playersData.forEach(player => {
    this.playerProjections[player.Player] = {
      position: player.Position,
      team: player.Team,
      opponent: player.Opp,
      salary: player.Salary,
      floor: player.Floor,
      median: player.Median,
      ceiling: player.Ceiling,
      ownership: player.Own,
      levX: player.LevX
    };
  });

  // Process team data
  this.teamProjections = {};
  stacksData.forEach(team => {
    this.teamProjections[team.Team] = {
      opponent: team.Opponent,
      odds: team.Odds,
      avgSalary: team["Avg Salary"],
      fantasy: team.Fantasy,
      avgValue: team["Avg Value"],
      stackPlus: team["Stack+"],
      stackPlusWins: team["Stack+ All Wins"],
      stackPlusLosses: team["Stack+ All Losses"],
      oppKillsAllowed: team["Opp Kills Allowed"]
    };
  });

  console.log(`Loaded ${Object.keys(this.playerProjections).length} players and ${Object.keys(this.teamProjections).length} teams`);
}

  /**
   * Read and parse a CSV file
   * @param {string} filename - Path to CSV file
   * @returns {Array} Parsed CSV data
   */
  async readAndParseCSV(filename) {
    try {
      const content = await fs.promises.readFile(filename, { encoding: 'utf8' });

      const parsed = Papa.parse(content, {
        header: true,
        dynamicTyping: true,
        skipEmptyLines: true
      });

      return parsed.data;
    } catch (error) {
      console.error(`Error reading ${filename}:`, error);
      return [];
    }
  }

  /**
   * Run parallel Monte Carlo simulation
   * @param {Array} lineups - The lineups to simulate
   * @returns {Array} Simulation results
   */
  async runParallelSimulation(lineups) {
    try {
      // Generate opponent field
      console.log(`Generating opponent field of ${this.options.fieldSize} lineups...`);
      const fieldLineups = this.generateOpponentField(this.options.fieldSize);

      // Save field lineups to disk to reduce worker memory usage
      const fieldFilePath = path.join(this.options.outputDir, 'field_lineups.json');
      fs.writeFileSync(fieldFilePath, JSON.stringify(fieldLineups));

      // Determine iterations per worker
      const numWorkers = this.options.maxWorkers;
      const iterationsPerWorker = Math.ceil(this.options.simulationIterations / numWorkers);

      console.log(`Using ${numWorkers} worker threads with ${iterationsPerWorker} iterations each`);

      // Create workers and assign iterations
      const workers = [];
      const batchResults = [];

      // Create a promise to collect results from all workers
      const simulationPromise = new Promise((resolve, reject) => {
        for (let i = 0; i < numWorkers; i++) {
          const startIdx = i * iterationsPerWorker;
          const endIdx = Math.min((i + 1) * iterationsPerWorker, this.options.simulationIterations);

          // Create a worker
          const worker = fork(path.join(__dirname, 'worker.js'));
          workers.push(worker);

          // Handle messages from worker
          worker.on('message', (message) => {
            if (message.results) {
              batchResults.push(message.results);

              // Update progress
              console.log(`Worker ${i+1} completed ${endIdx - startIdx} iterations (${(batchResults.length / numWorkers * 100).toFixed(1)}% complete)`);

              // Check if all workers are done
              if (batchResults.length === numWorkers) {
                resolve(batchResults);
              }
            }
          });

          // Handle worker errors
          worker.on('error', (error) => {
            console.error(`Worker error: ${error}`);
            reject(error);
          });

          // Handle worker exit
          worker.on('exit', (code) => {
            if (code !== 0) {
              reject(new Error(`Worker exited with code ${code}`));
            }
          });

          // Start the worker with its batch of iterations
          worker.send({
            lineups,
            iterations: endIdx - startIdx,
            startIdx,
            endIdx,
            playerProjections: this.playerProjections,
            teamProjections: this.teamProjections,
            fieldLineups
          });
        }
      });

      // Wait for all workers to complete
      const results = await simulationPromise;

      // Clean up workers
      workers.forEach(worker => worker.kill());

      // Process and combine results from all workers
      console.log('Processing final results...');
      const finalResults = this.calculateFinalStats(batchResults);

      return finalResults;
    } catch (error) {
      console.error('Simulation error:', error);
      return [];
    }
  }

  /**
   * Generate opponent field for simulation
   * @param {number} fieldSize - Size of the field
   * @returns {Array} Generated field lineups
   */
  generateOpponentField(fieldSize) {
    // Create position-specific player pools
    const playerPools = {
      "ADC": [],
      "MID": [],
      "JNG": [],
      "TOP": [],
      "SUP": [],
      "TEAM": []
    };

    // Fill the player pools
    Object.entries(this.playerProjections).forEach(([name, player]) => {
      if (playerPools[player.position]) {
        playerPools[player.position].push({
          name: name,
          position: player.position,
          team: player.team,
          opponent: player.opponent,
          salary: player.salary,
          ownership: player.ownership || 1,
          median: player.median || 0,
          ceiling: player.ceiling || 0
        });
      }
    });

    // Mock implementation for field generation
    // In a real implementation, this would use weighted random selection based on ownership
    const field = [];
    for (let i = 0; i < fieldSize; i++) {
      const lineup = {
        id: i + 1,
        name: `Field Lineup ${i + 1}`,
        cpt: this.getRandomPlayerFromPool(playerPools, true),
        players: []
      };

      // Add one player from each position
      for (const position of Object.keys(playerPools)) {
        if (position !== lineup.cpt.position || position === "TEAM") {
          lineup.players.push(this.getRandomPlayerFromPool(playerPools));
        }
      }

      field.push(lineup);
    }

    return field;
  }

  /**
   * Helper to get a random player from a pool for field generation
   * @param {Object} pools - Player pools by position
   * @param {boolean} isCaptain - Whether this is for captain selection
   * @returns {Object} Selected player
   */
  getRandomPlayerFromPool(pools, isCaptain = false) {
    // For demonstration - in real implementation, this would use weighted random based on ownership
    const position = Object.keys(pools)[Math.floor(Math.random() * Object.keys(pools).length)];
    const pool = pools[position];
    const player = {...pool[Math.floor(Math.random() * pool.length)]};

    if (isCaptain) {
      player.salary = Math.round(player.salary * 1.5); // CPT costs 1.5x
    }

    return player;
  }

  /**
   * Process batch results and calculate final statistics
   * @param {Array} batchResults - Results from all workers
   * @returns {Array} Processed simulation results
   */
  calculateFinalStats(batchResults) {
    // Make sure we have valid results
    if (!batchResults || batchResults.length === 0) {
      console.warn("Warning: No batch results to process");
      return [];
    }

    // Get our lineup count from the first batch
    const lineupCount = batchResults[0]?.length || 0;
    if (lineupCount === 0) {
      console.warn("Warning: Empty batch results");
      return [];
    }

    // Create results structure for each lineup
    const results = Array(lineupCount).fill(0).map((_, i) => {
      // Find the lineup in the first batch to get structure
      const lineupData = batchResults[0]?.[i]?.lineup;

      if (!lineupData) {
        console.warn(`Warning: Missing lineup data for index ${i}`);
        return {
          lineup: { id: i+1, name: `Lineup ${i+1}`, cpt: {}, players: [] },
          placements: [],
          payouts: [],
          scores: [],
          firstPlaceCount: 0,
          top5Count: 0,
          top10Count: 0,
          minCashCount: 0,
          roi: 0,
          averagePayout: 0,
          averagePlace: 0,
          scoreDistribution: {
            p10: 0, p25: 0, p50: 0, p75: 0, p90: 0
          }
        };
      }

      return {
        lineup: lineupData,
        placements: [],
        payouts: [],
        scores: [],
        firstPlaceCount: 0,
        top5Count: 0,
        top10Count: 0,
        minCashCount: 0
      };
    });

    // Combine data from all batches
    batchResults.forEach(batch => {
      if (!Array.isArray(batch)) return;

      batch.forEach((lineupResult, lineupIndex) => {
        if (lineupIndex >= results.length) return;

        if (lineupResult.placements) results[lineupIndex].placements.push(...lineupResult.placements);
        if (lineupResult.payouts) results[lineupIndex].payouts.push(...lineupResult.payouts);
        if (lineupResult.scores) results[lineupIndex].scores.push(...lineupResult.scores);
        results[lineupIndex].firstPlaceCount += lineupResult.firstPlaceCount || 0;
        results[lineupIndex].top5Count += lineupResult.top5Count || 0;
        results[lineupIndex].top10Count += lineupResult.top10Count || 0;
        results[lineupIndex].minCashCount += lineupResult.minCashCount || 0;
      });
    });

    // Calculate final metrics for each lineup
    const entryFee = this.options.entryFee || 5;
    const iterations = this.options.simulationIterations || 2000;

    results.forEach(result => {
      // Make sure arrays exist
      result.placements = result.placements || [];
      result.payouts = result.payouts || [];
      result.scores = result.scores || [];

      // Sort scores for percentile calculations
      const sortedScores = [...result.scores].sort((a, b) => a - b);
      const scoreCount = sortedScores.length;

      // Calculate score distribution
      if (scoreCount > 0) {
        result.scoreDistribution = {
          p10: sortedScores[Math.floor(scoreCount * 0.1)] || 0,
          p25: sortedScores[Math.floor(scoreCount * 0.25)] || 0,
          p50: sortedScores[Math.floor(scoreCount * 0.5)] || 0, // median
          p75: sortedScores[Math.floor(scoreCount * 0.75)] || 0,
          p90: sortedScores[Math.floor(scoreCount * 0.9)] || 0
        };
      } else {
        result.scoreDistribution = { p10: 0, p25: 0, p50: 0, p75: 0, p90: 0 };
      }

      // Calculate average placement
      result.averagePlace = result.placements.length > 0
        ? result.placements.reduce((sum, place) => sum + place, 0) / result.placements.length
        : 0;

      // Calculate average payout
      result.averagePayout = result.payouts.length > 0
        ? result.payouts.reduce((sum, payout) => sum + payout, 0) / result.payouts.length
        : 0;

      // Calculate ROI
      result.roi = result.averagePayout / entryFee;

      // Convert counts to percentages
      const actualIterations = result.placements.length || iterations;
      result.firstPlacePercentage = (result.firstPlaceCount / actualIterations) * 100;
      result.top5Percentage = (result.top5Count / actualIterations) * 100;
      result.top10Percentage = (result.top10Count / actualIterations) * 100;
      result.minCashPercentage = (result.minCashCount / actualIterations) * 100;
    });

    // Sort results by ROI (descending)
    results.sort((a, b) => b.roi - a.roi);

    return results;
  }

  /**
   * Generate optimal new lineups based on simulation insights
   * @param {number} count - Number of lineups to generate
   * @param {Object} options - Generation options
   * @returns {Array} Generated lineups
   */
  generateOptimalLineups(count, options = {}) {
    if (!this.generator) {
      throw new Error("Must run simulation pipeline before generating lineups");
    }

    console.log(`Generating ${count} optimal lineups...`);
    console.time('Lineup Generation Time');

    // Generate lineups with specified distribution
    const distribution = options.distribution || {
      balanced: 0.4,
      firstPlace: 0.3,
      cashGame: 0.1,
      contrarian: 0.2
    };

    const lineups = this.generator.generateMultipleLineups(count, distribution);

    // Save lineups to file
    const lineupsFilePath = path.join(this.options.outputDir, 'optimal_lineups.json');
    this.generator.saveLineupsToFile(lineups, lineupsFilePath);
    console.log(`Saved ${lineups.length} optimal lineups to: ${lineupsFilePath}`);

    console.timeEnd('Lineup Generation Time');
    return lineups;
  }

  /**
   * Generate a full tournament portfolio
   * @param {number} totalEntries - Number of entries
   * @param {number} budget - Maximum budget (null for no limit)
   * @returns {Array} Generated tournament lineups
   */
  generateTournamentPortfolio(totalEntries, budget = null) {
    if (!this.generator) {
      throw new Error("Must run simulation pipeline before generating tournament portfolio");
    }

    console.log(`Generating tournament portfolio with ${totalEntries} entries...`);
    console.time('Portfolio Generation Time');

    const portfolio = this.generator.generateTournamentPortfolio(totalEntries, budget);

    // Save portfolio to file
    const portfolioFilePath = path.join(this.options.outputDir, 'tournament_portfolio.json');
    this.generator.saveLineupsToFile(portfolio, portfolioFilePath);
    console.log(`Saved tournament portfolio with ${portfolio.length} lineups to: ${portfolioFilePath}`);

    console.timeEnd('Portfolio Generation Time');
    return portfolio;
  }
}

// Export the main system class
module.exports = UltimateLoLDFSSystem;