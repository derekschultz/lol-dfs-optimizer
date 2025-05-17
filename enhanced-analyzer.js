// enhanced-analyzer-fixed.js - Enhanced analyzer with null check fixes

const fs = require('fs');
const path = require('path');

/**
 * Enhanced Simulation Analyzer with advanced metrics
 * - Provides deeper statistical insight into lineup performance
 * - Calculates advanced tournament metrics and correlations
 * - Generates visualization-ready data structures
 */
class EnhancedSimulationAnalyzer {
  constructor(simulationResults, playerProjections, teamProjections) {
    this.results = simulationResults;
    this.playerProjections = playerProjections;
    this.teamProjections = teamProjections;

    // Initialize additional metrics
    this.initializeMetrics();
  }

  // Initialize advanced metrics
  initializeMetrics() {
    // Tournament-specific metrics
    this.tournamentMetrics = {
      expectedValue: {},   // Expected $ value by lineup
      sharpeRatio: {},     // Risk-adjusted ROI
      probabilityMatrix: {}, // Probability of finishing at each position
      scoreDistribution: {},  // Full distribution, not just quantiles
      tail: {},             // Tail analysis (frequencies of extreme outcomes)
      diversificationIndex: 0, // How diversified the portfolio is
      gameExposure: {},       // Exposure to each game
      teamExposure: {},       // Exposure to each team
      positionExposure: {},   // Exposure by position
      leverage: {},           // Ownership leverage vs field
      correlationMatrix: [],  // Correlation between lineups
      uniquenessScore: [],    // How unique each lineup is vs the field
      maxPositiveSkew: {},    // Which lineups have the most positive skew
      valueVsOwn: {},         // Value compared to ownership
    };

    // Initialize lineup-specific metrics
    this.results.forEach(result => {
      const lineupId = result.lineup.id;

      // Create empty data structures for each lineup
      this.tournamentMetrics.expectedValue[lineupId] = 0;
      this.tournamentMetrics.sharpeRatio[lineupId] = 0;
      this.tournamentMetrics.probabilityMatrix[lineupId] = {};
      this.tournamentMetrics.scoreDistribution[lineupId] = {};
      this.tournamentMetrics.tail[lineupId] = {
        highOutliers: 0,
        lowOutliers: 0,
        skewness: 0,
        kurtosis: 0
      };
    });
  }

  // Calculate all enhanced metrics
  calculateAllMetrics() {
    this.calculateExpectedValue();
    this.calculateRiskMetrics();
    this.calculateProbabilityMatrix();
    this.calculateScoreDistributions();
    this.analyzeTailBehavior();
    this.calculateDiversification();
    this.calculateExposureMetrics();
    this.calculateLeverageMetrics();
    this.calculateCorrelations();
    this.calculateUniquenessScores();
    this.calculateValueOwnershipRatio();

    return this.tournamentMetrics;
  }

  // Calculate expected value with confidence intervals
  calculateExpectedValue() {
    this.results.forEach(result => {
      const lineupId = result.lineup.id;
      const ev = result.averagePayout;

      // Calculate 95% confidence interval
      const n = result.payouts && result.payouts.length > 0 ? result.payouts.length : 0;
      const stdDev = n > 0 ? Math.sqrt(this.variance(result.payouts)) : 0;
      const marginOfError = n > 0 ? 1.96 * (stdDev / Math.sqrt(n)) : 0;

      this.tournamentMetrics.expectedValue[lineupId] = {
        ev: ev || 0,
        lower95: Math.max(0, (ev || 0) - marginOfError),
        upper95: (ev || 0) + marginOfError,
        stdDev: stdDev
      };
    });
  }

  // Calculate risk-adjusted metrics (Sharpe ratio)
  calculateRiskMetrics() {
    this.results.forEach(result => {
      const lineupId = result.lineup.id;
      const entryFee = 5; // Assume $5 entry
      const ev = result.averagePayout || 0;
      const payouts = result.payouts || [];

      // Calculate Sharpe ratio (risk-adjusted return)
      const excess = ev - entryFee;
      const stdDev = Math.sqrt(this.variance(payouts));
      const sharpe = stdDev > 0 ? excess / stdDev : 0;

      // Calculate downside deviation (semi-deviation)
      const downside = this.calculateDownsideDeviation(payouts, entryFee);

      // Calculate Sortino ratio (using downside risk only)
      const sortino = downside > 0 ? excess / downside : 0;

      this.tournamentMetrics.sharpeRatio[lineupId] = {
        sharpe: sharpe,
        sortino: sortino,
        downside: downside
      };
    });
  }

  // Calculate probability of finishing at each position
  calculateProbabilityMatrix() {
    this.results.forEach(result => {
      const lineupId = result.lineup.id;
      const placements = result.placements || [];
      const n = placements.length;

      // Initialize empty probability matrix
      const probMatrix = {};

      // Count occurrences of each placement
      placements.forEach(place => {
        if (!probMatrix[place]) probMatrix[place] = 0;
        probMatrix[place]++;
      });

      // Convert to probabilities
      Object.keys(probMatrix).forEach(place => {
        probMatrix[place] = probMatrix[place] / n;
      });

      this.tournamentMetrics.probabilityMatrix[lineupId] = probMatrix;
    });
  }

  // Calculate full score distributions (not just percentiles)
  calculateScoreDistributions() {
    this.results.forEach(result => {
      const lineupId = result.lineup.id;
      const scores = result.scores || [];

      // Create histogram with 20-point bins
      const histogram = {};
      const binSize = 20;

      scores.forEach(score => {
        const bin = Math.floor(score / binSize) * binSize;
        if (!histogram[bin]) histogram[bin] = 0;
        histogram[bin]++;
      });

      // Convert to probabilities
      const n = scores.length;
      Object.keys(histogram).forEach(bin => {
        histogram[bin] = histogram[bin] / n;
      });

      this.tournamentMetrics.scoreDistribution[lineupId] = histogram;
    });
  }

  // Analyze tail behavior (extreme outcomes)
  analyzeTailBehavior() {
    this.results.forEach(result => {
      const lineupId = result.lineup.id;
      const scores = result.scores || [];
      const n = scores.length;

      if (n === 0) {
        this.tournamentMetrics.tail[lineupId] = {
          highOutliers: 0,
          lowOutliers: 0,
          skewness: 0,
          kurtosis: 0,
          mean: 0,
          stdDev: 0
        };
        return;
      }

      // Calculate mean and standard deviation
      const mean = scores.reduce((sum, score) => sum + score, 0) / n;
      const variance = scores.reduce((sum, score) => sum + Math.pow(score - mean, 2), 0) / n;
      const stdDev = Math.sqrt(variance);

      // Calculate skewness
      const skewness = this.calculateSkewness(scores, mean, stdDev);

      // Calculate kurtosis
      const kurtosis = this.calculateKurtosis(scores, mean, stdDev);

      // Calculate frequency of high outliers (>2 std dev above mean)
      const highThreshold = mean + (2 * stdDev);
      const highOutliers = scores.filter(score => score > highThreshold).length / n;

      // Calculate frequency of low outliers (<2 std dev below mean)
      const lowThreshold = mean - (2 * stdDev);
      const lowOutliers = scores.filter(score => score < lowThreshold).length / n;

      this.tournamentMetrics.tail[lineupId] = {
        highOutliers: highOutliers,
        lowOutliers: lowOutliers,
        skewness: skewness,
        kurtosis: kurtosis,
        mean: mean,
        stdDev: stdDev
      };
    });
  }

  // Calculate portfolio diversification index
  calculateDiversification() {
    // Get all lineups
    const lineups = this.results.map(result => result.lineup);

    // Calculate pairwise similarity
    const similarities = [];
    for (let i = 0; i < lineups.length; i++) {
      for (let j = i + 1; j < lineups.length; j++) {
        const similarity = this.calculateLineupSimilarity(lineups[i], lineups[j]);
        similarities.push(similarity);
      }
    }

    // Average similarity
    const avgSimilarity = similarities.length > 0
      ? similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length
      : 0;

    // Diversification index (0 = identical lineups, 1 = completely different)
    this.tournamentMetrics.diversificationIndex = 1 - avgSimilarity;
  }

  // Calculate exposure metrics by game, team, and position
  calculateExposureMetrics() {
    // Get all lineups
    const lineups = this.results.map(result => result.lineup);

    // Initialize counters
    const gameExposure = {};
    const teamExposure = {};
    const positionExposure = {};

    // Count occurrences
    lineups.forEach(lineup => {
      const allPlayers = lineup ? [lineup.cpt, ...lineup.players].filter(Boolean) : [];

      // Team exposure
      allPlayers.forEach(player => {
        if (!player) return;
        const team = player.team;
        if (team) {
          if (!teamExposure[team]) teamExposure[team] = 0;
          teamExposure[team]++;
        }
      });

      // Position exposure
      allPlayers.forEach(player => {
        if (!player) return;
        const position = player.position;
        if (position) {
          if (!positionExposure[position]) positionExposure[position] = 0;
          positionExposure[position]++;
        }
      });

      // Game exposure
      allPlayers.forEach(player => {
        if (!player) return;
        const team = player.team;
        if (!team) return;

        const opponent = this.teamProjections && this.teamProjections[team] ? this.teamProjections[team].opponent : null;
        if (opponent) {
          const game = `${team} vs ${opponent}`;
          if (!gameExposure[game]) gameExposure[game] = { count: 0, teams: new Set() };
          gameExposure[game].count++;
          gameExposure[game].teams.add(team);
        }
      });
    });

    // Convert to percentages
    const totalPlayers = lineups.reduce((sum, lineup) => {
      if (!lineup) return sum;
      const playerCount = lineup.cpt && lineup.players ? 1 + lineup.players.length : 0;
      return sum + playerCount;
    }, 0);

    if (totalPlayers > 0) {
      Object.keys(teamExposure).forEach(team => {
        teamExposure[team] = (teamExposure[team] / totalPlayers) * 100;
      });

      Object.keys(positionExposure).forEach(position => {
        positionExposure[position] = (positionExposure[position] / totalPlayers) * 100;
      });

      Object.keys(gameExposure).forEach(game => {
        gameExposure[game].percentage = (gameExposure[game].count / totalPlayers) * 100;
        gameExposure[game].bothSides = gameExposure[game].teams.size > 1;
      });
    }

    this.tournamentMetrics.teamExposure = teamExposure;
    this.tournamentMetrics.positionExposure = positionExposure;
    this.tournamentMetrics.gameExposure = gameExposure;
  }

  // Calculate leverage vs field
  calculateLeverageMetrics() {
    this.results.forEach(result => {
      if (!result || !result.lineup) return;

      const lineupId = result.lineup.id;
      const lineup = result.lineup;

      // Calculate average ownership
      let totalOwnership = 0;
      let playerCount = 0;

      const allPlayers = lineup.cpt ? [lineup.cpt, ...(lineup.players || [])].filter(Boolean) : [];

      allPlayers.forEach(player => {
        if (!player) return;
        const playerProj = this.playerProjections && player.name ? this.playerProjections[player.name] : null;
        if (playerProj && playerProj.ownership !== undefined) {
          totalOwnership += playerProj.ownership;
          playerCount++;
        }
      });

      const averageOwnership = playerCount > 0 ? totalOwnership / playerCount : 0;

      // Calculate average leverage
      let totalLeverage = 0;
      let leverageCount = 0;

      allPlayers.forEach(player => {
        if (!player) return;
        const playerProj = this.playerProjections && player.name ? this.playerProjections[player.name] : null;
        if (playerProj && playerProj.levX !== undefined) {
          totalLeverage += playerProj.levX;
          leverageCount++;
        }
      });

      const averageLeverage = leverageCount > 0 ? totalLeverage / leverageCount : 0;

      // Calculate net leverage
      this.tournamentMetrics.leverage[lineupId] = {
        averageOwnership: averageOwnership,
        averageLeverage: averageLeverage,
        netLeverage: averageLeverage / (averageOwnership > 0 ? averageOwnership : 1)
      };
    });
  }

  // Calculate correlations between lineups
  calculateCorrelations() {
    const n = this.results.length;
    const correlationMatrix = Array(n).fill(0).map(() => Array(n).fill(1)); // Diagonal is 1

    // Calculate correlations of placements
    for (let i = 0; i < n; i++) {
      for (let j = i + 1; j < n; j++) {
        const result1 = this.results[i];
        const result2 = this.results[j];

        if (!result1 || !result2 || !result1.placements || !result2.placements) {
          correlationMatrix[i][j] = 0;
          correlationMatrix[j][i] = 0;
          continue;
        }

        // Calculate correlation coefficient for placements
        const correlation = this.calculateCorrelationCoefficient(
          result1.placements,
          result2.placements
        );

        correlationMatrix[i][j] = correlation;
        correlationMatrix[j][i] = correlation; // Matrix is symmetric
      }
    }

    this.tournamentMetrics.correlationMatrix = correlationMatrix;
  }

  // Calculate uniqueness scores compared to field
  calculateUniquenessScores() {
    this.results.forEach(result => {
      if (!result || !result.lineup) return;

      const lineupId = result.lineup.id;
      const lineup = result.lineup;

      // Calculate uniqueness based on player ownership
      let uniquenessScore = 0;
      let playerCount = 0;

      const allPlayers = lineup.cpt ? [lineup.cpt, ...(lineup.players || [])].filter(Boolean) : [];

      allPlayers.forEach(player => {
        if (!player) return;
        const playerProj = this.playerProjections && player.name ? this.playerProjections[player.name] : null;
        if (playerProj && playerProj.ownership !== undefined) {
          // Players with lower ownership contribute more to uniqueness
          uniquenessScore += (100 - playerProj.ownership) / 100;
          playerCount++;
        } else {
          uniquenessScore += 0.95; // Assume very unique if no ownership data
          playerCount++;
        }
      });

      // Normalize score (0-10 scale)
      const normalizedScore = playerCount > 0 ? (uniquenessScore / playerCount) * 10 : 0;

      this.tournamentMetrics.uniquenessScore[lineupId] = normalizedScore;
    });
  }

  // Calculate value to ownership ratio
  calculateValueOwnershipRatio() {
    this.results.forEach(result => {
      if (!result || !result.lineup) return;

      const lineupId = result.lineup.id;
      const lineup = result.lineup;

      // Calculate projected value
      let totalProjection = 0;

      // Captain gets 1.5x points
      if (lineup.cpt) {
        const cptProj = this.playerProjections && lineup.cpt.name ? this.playerProjections[lineup.cpt.name] : null;
        if (cptProj && cptProj.median !== undefined) {
          totalProjection += cptProj.median * 1.5;
        }
      }

      // Regular players
      if (lineup.players) {
        lineup.players.forEach(player => {
          if (!player) return;
          const playerProj = this.playerProjections && player.name ? this.playerProjections[player.name] : null;
          if (playerProj && playerProj.median !== undefined) {
            totalProjection += playerProj.median;
          }
        });
      }

      // Calculate average ownership
      let totalOwnership = 0;
      let playerCount = 0;

      const allPlayers = lineup.cpt ? [lineup.cpt, ...(lineup.players || [])].filter(Boolean) : [];

      allPlayers.forEach(player => {
        if (!player) return;
        const playerProj = this.playerProjections && player.name ? this.playerProjections[player.name] : null;
        if (playerProj && playerProj.ownership !== undefined) {
          totalOwnership += playerProj.ownership;
          playerCount++;
        }
      });

      const averageOwnership = playerCount > 0 ? totalOwnership / playerCount : 0;

      // Calculate value/ownership ratio (higher is better)
      const valueRatio = averageOwnership > 0 ? totalProjection / averageOwnership : totalProjection;

      this.tournamentMetrics.valueVsOwn[lineupId] = {
        projectedValue: totalProjection,
        averageOwnership: averageOwnership,
        valueRatio: valueRatio
      };
    });
  }

  // Calculate lineup similarity (0-1)
  calculateLineupSimilarity(lineup1, lineup2) {
    if (!lineup1 || !lineup2) return 0;

    const players1 = new Set();
    if (lineup1.cpt) players1.add(lineup1.cpt.name);
    if (lineup1.players) {
      lineup1.players.forEach(p => {
        if (p && p.name) players1.add(p.name);
      });
    }

    const players2 = new Set();
    if (lineup2.cpt) players2.add(lineup2.cpt.name);
    if (lineup2.players) {
      lineup2.players.forEach(p => {
        if (p && p.name) players2.add(p.name);
      });
    }

    // Count shared players
    let sharedCount = 0;
    players1.forEach(player => {
      if (players2.has(player)) sharedCount++;
    });

    // Calculate similarity (0-1)
    const totalPlayers = Math.max(players1.size, players2.size);
    return totalPlayers > 0 ? sharedCount / totalPlayers : 0;
  }

  // Utility: Calculate variance
  variance(array) {
    const n = array ? array.length : 0;
    if (n === 0) return 0;
    const mean = array.reduce((sum, val) => sum + val, 0) / n;
    return array.reduce((sum, val) => sum + Math.pow(val - mean, 2), 0) / n;
  }

  // Utility: Calculate downside deviation
  calculateDownsideDeviation(array, threshold) {
    const n = array ? array.length : 0;
    if (n === 0) return 0;

    // Sum squared deviations below threshold
    const sumSquaredDownside = array.reduce((sum, val) => {
      const deviation = threshold - val;
      return sum + (deviation > 0 ? Math.pow(deviation, 2) : 0);
    }, 0);

    return Math.sqrt(sumSquaredDownside / n);
  }

  // Utility: Calculate correlation coefficient
  calculateCorrelationCoefficient(array1, array2) {
    const n = Math.min(array1 ? array1.length : 0, array2 ? array2.length : 0);
    if (n === 0) return 0;

    // Calculate means
    const mean1 = array1.reduce((sum, val) => sum + val, 0) / n;
    const mean2 = array2.reduce((sum, val) => sum + val, 0) / n;

    // Calculate covariance and standard deviations
    let covariance = 0;
    let variance1 = 0;
    let variance2 = 0;

    for (let i = 0; i < n; i++) {
      const diff1 = array1[i] - mean1;
      const diff2 = array2[i] - mean2;

      covariance += diff1 * diff2;
      variance1 += diff1 * diff1;
      variance2 += diff2 * diff2;
    }

    covariance /= n;
    variance1 /= n;
    variance2 /= n;

    // Calculate correlation coefficient
    const stdDev1 = Math.sqrt(variance1);
    const stdDev2 = Math.sqrt(variance2);

    if (stdDev1 === 0 || stdDev2 === 0) return 0;

    return covariance / (stdDev1 * stdDev2);
  }

  // Utility: Calculate skewness
  calculateSkewness(array, mean, stdDev) {
    const n = array ? array.length : 0;
    if (n === 0 || stdDev === 0) return 0;

    // Calculate third moment
    const thirdMoment = array.reduce((sum, val) => {
      const diff = val - mean;
      return sum + Math.pow(diff, 3);
    }, 0) / n;

    return thirdMoment / Math.pow(stdDev, 3);
  }

  // Utility: Calculate kurtosis
  calculateKurtosis(array, mean, stdDev) {
    const n = array ? array.length : 0;
    if (n === 0 || stdDev === 0) return 0;

    // Calculate fourth moment
    const fourthMoment = array.reduce((sum, val) => {
      const diff = val - mean;
      return sum + Math.pow(diff, 4);
    }, 0) / n;

    return fourthMoment / Math.pow(stdDev, 4) - 3; // Excess kurtosis (normal = 0)
  }

  // Generate a comprehensive analysis report
  generateAnalysisReport() {
    // Make sure metrics are calculated
    this.calculateAllMetrics();

    // Create report structure
    const report = {
      summary: this.generateSummary(),
      lineupAnalysis: this.generateLineupAnalysis(),
      portfolioAnalysis: this.generatePortfolioAnalysis(),
      exposureAnalysis: this.generateExposureAnalysis(),
      tournamentStrategy: this.generateTournamentStrategy(),
    };

    return report;
  }

  // Generate executive summary
  generateSummary() {
    const results = [...this.results].filter(Boolean).sort((a, b) => (b.roi || 0) - (a.roi || 0));

    return {
      topLineups: results.map(result => {
        if (!result || !result.lineup) return null;
        return {
          id: result.lineup.id,
          name: result.lineup.name,
          roi: result.roi || 0,
          firstPlacePercentage: result.firstPlacePercentage || 0,
          minCashPercentage: result.minCashPercentage || 0
        };
      }).filter(Boolean),
      diversificationIndex: this.tournamentMetrics.diversificationIndex,
      overallEV: results.length > 0 ? results.reduce((sum, result) => sum + (result.roi || 0), 0) / results.length : 0
    };
  }

  // Generate detailed lineup analysis
  generateLineupAnalysis() {
    const lineupAnalysis = {};

    this.results.forEach(result => {
      if (!result || !result.lineup) return;

      const lineupId = result.lineup.id;
      const lineup = result.lineup;

      // Gather all lineup metrics
      lineupAnalysis[lineupId] = {
        lineup: {
          id: lineupId,
          name: result.lineup.name,
          captain: result.lineup.cpt,
          players: result.lineup.players
        },
        performance: {
          roi: result.roi || 0,
          firstPlacePercentage: result.firstPlacePercentage || 0,
          top5Percentage: result.top5Percentage || 0,
          minCashPercentage: result.minCashPercentage || 0,
          averagePayout: result.averagePayout || 0
        },
        riskMetrics: this.tournamentMetrics.sharpeRatio[lineupId] || { sharpe: 0, sortino: 0, downside: 0 },
        distribution: {
          median: result.scoreDistribution ? result.scoreDistribution.p50 : 0,
          p10: result.scoreDistribution ? result.scoreDistribution.p10 : 0,
          p90: result.scoreDistribution ? result.scoreDistribution.p90 : 0,
          skewness: this.tournamentMetrics.tail[lineupId] ? this.tournamentMetrics.tail[lineupId].skewness : 0,
          outlierFrequency: this.tournamentMetrics.tail[lineupId] ? this.tournamentMetrics.tail[lineupId].highOutliers : 0
        },
        leverage: this.tournamentMetrics.leverage[lineupId] || { averageOwnership: 0, averageLeverage: 0, netLeverage: 0 },
        uniqueness: this.tournamentMetrics.uniquenessScore[lineupId] || 0,
        valueRatio: this.tournamentMetrics.valueVsOwn[lineupId] || { valueRatio: 0 }
      };
    });

    return lineupAnalysis;
  }

  // Generate portfolio analysis
  generatePortfolioAnalysis() {
    return {
      diversification: this.tournamentMetrics.diversificationIndex,
      correlationMatrix: this.tournamentMetrics.correlationMatrix,
      lineupUniqueness: this.tournamentMetrics.uniquenessScore
    };
  }

  // Generate exposure analysis
  generateExposureAnalysis() {
    return {
      teamExposure: this.tournamentMetrics.teamExposure,
      gameExposure: this.tournamentMetrics.gameExposure,
      positionExposure: this.tournamentMetrics.positionExposure
    };
  }

  // Generate tournament strategy recommendations
  generateTournamentStrategy() {
    const results = [...this.results].filter(Boolean).sort((a, b) => (b.roi || 0) - (a.roi || 0));

    // Calculate optimal allocations
    const totalROI = results.reduce((sum, result) => sum + (result.roi || 0), 0);
    const allocations = results.map(result => {
      if (!result || !result.lineup) return null;
      return {
        lineupId: result.lineup.id,
        allocation: totalROI > 0 ? (result.roi || 0) / totalROI * 100 : 0
      };
    }).filter(Boolean);

    // Determine best lineup for different contest types
    const bestLineupId = results.length > 0 && results[0] && results[0].lineup ? results[0].lineup.id : null;

    const firstPlaceResults = [...this.results].filter(Boolean)
      .sort((a, b) => (b.firstPlacePercentage || 0) - (a.firstPlacePercentage || 0));
    const bestFirstPlaceLineupId = firstPlaceResults.length > 0 && firstPlaceResults[0] && firstPlaceResults[0].lineup ?
      firstPlaceResults[0].lineup.id : null;

    const cashResults = [...this.results].filter(Boolean)
      .sort((a, b) => (b.minCashPercentage || 0) - (a.minCashPercentage || 0));
    const bestCashLineupId = cashResults.length > 0 && cashResults[0] && cashResults[0].lineup ?
      cashResults[0].lineup.id : null;

    return {
      singleEntry: bestLineupId,
      threeMax: results.slice(0, 3).map(result => result && result.lineup ? result.lineup.id : null).filter(Boolean),
      tenMax: allocations,
      maxFirstPlace: bestFirstPlaceLineupId,
      maxCash: bestCashLineupId
    };
  }

  // Save analysis to file
  saveAnalysisToFile(filepath) {
    const report = this.generateAnalysisReport();
    fs.writeFileSync(filepath, JSON.stringify(report, null, 2));
    return filepath;
  }
}

/**
 * Enhanced Report Generator for creating beautiful reports from analysis data
 */
class EnhancedReportGenerator {
  constructor(analysisData, playerProjections, teamProjections) {
    this.analysis = analysisData;
    this.playerProjections = playerProjections;
    this.teamProjections = teamProjections;
  }

  // Helper function to safely format values
  safeFormat(value, decimals = 2) {
    if (value === undefined || value === null) return 'N/A';
    return typeof value === 'number' ? value.toFixed(decimals) : value;
  }

  // Generate comprehensive markdown report
  generateMarkdownReport() {
    let report = `# Advanced League of Legends DFS Analysis\n\n`;

    // Add executive summary
    report += this.generateSummarySection();

    // Add lineup analysis section
    report += this.generateLineupAnalysisSection();

    // Add portfolio analysis section
    report += this.generatePortfolioSection();

    // Add tournament strategy section
    report += this.generateStrategySection();

    // Add appendix
    report += this.generateAppendix();

    return report;
  }

  // Generate executive summary section
  generateSummarySection() {
    const summary = this.analysis.summary || { topLineups: [], diversificationIndex: 0, overallEV: 0 };

    let section = `## Executive Summary\n\n`;

    // Add top lineups table
    section += `### Lineup Rankings by ROI\n\n`;
    section += `| Rank | Lineup | ROI | First Place % | Min Cash % |\n`;
    section += `|------|--------|-----|--------------|------------|\n`;

    if (summary.topLineups && summary.topLineups.length > 0) {
      summary.topLineups.forEach((lineup, index) => {
        if (!lineup) return;
        section += `| ${index + 1} | Lineup ${lineup.id} | ${this.safeFormat(lineup.roi)}x | ${this.safeFormat(lineup.firstPlacePercentage)}% | ${this.safeFormat(lineup.minCashPercentage)}% |\n`;
      });
    } else {
      section += `| - | No lineups available | - | - | - |\n`;
    }

    // Add portfolio summary
    section += `\n### Portfolio Overview\n\n`;
    section += `- **Portfolio Diversity Score:** ${this.safeFormat((summary.diversificationIndex || 0) * 10)}/10\n`;
    section += `- **Average ROI Multiple:** ${this.safeFormat(summary.overallEV)}x\n`;

    return section + `\n`;
  }

  // Generate lineup analysis section
  generateLineupAnalysisSection() {
    const lineupAnalysis = this.analysis.lineupAnalysis || {};

    let section = `## Detailed Lineup Analysis\n\n`;

    // Generate a subsection for each lineup
    Object.keys(lineupAnalysis).forEach(lineupId => {
      const analysis = lineupAnalysis[lineupId];
      if (!analysis || !analysis.lineup) return;

      const lineup = analysis.lineup;

      section += `### Lineup ${lineupId}: ${lineup.name || 'Unnamed'}\n\n`;

      // Composition
      section += `#### Lineup Composition\n\n`;
      if (lineup.captain) {
        section += `- **CPT:** ${lineup.captain.name} (${lineup.captain.position} - ${lineup.captain.team})\n`;
      }

      if (lineup.players) {
        lineup.players.forEach(player => {
          if (!player) return;
          section += `- **${player.position}:** ${player.name} (${player.team})\n`;
        });
      }

      // Performance metrics
      section += `\n#### Performance Metrics\n\n`;
      section += `- **ROI Multiple:** ${this.safeFormat(analysis.performance.roi)}x\n`;
      section += `- **First Place %:** ${this.safeFormat(analysis.performance.firstPlacePercentage)}%\n`;
      section += `- **Top 5 %:** ${this.safeFormat(analysis.performance.top5Percentage)}%\n`;
      section += `- **Min Cash %:** ${this.safeFormat(analysis.performance.minCashPercentage)}%\n`;
      section += `- **Average Payout:** $${this.safeFormat(analysis.performance.averagePayout)}\n`;

      // Risk metrics
      section += `\n#### Risk Profile\n\n`;
      section += `- **Sharpe Ratio:** ${this.safeFormat(analysis.riskMetrics.sharpe)}\n`;
      section += `- **Sortino Ratio:** ${this.safeFormat(analysis.riskMetrics.sortino)}\n`;
      section += `- **Downside Risk:** ${this.safeFormat(analysis.riskMetrics.downside)}\n`;

      // Distribution metrics
      section += `\n#### Score Distribution\n\n`;
      section += `- **Median Score:** ${this.safeFormat(analysis.distribution.median)}\n`;
      section += `- **10th Percentile:** ${this.safeFormat(analysis.distribution.p10)}\n`;
      section += `- **90th Percentile:** ${this.safeFormat(analysis.distribution.p90)}\n`;
      section += `- **Skewness:** ${this.safeFormat(analysis.distribution.skewness)} ${analysis.distribution.skewness !== undefined ? (analysis.distribution.skewness > 0 ? '(Positive)' : '(Negative)') : ''}\n`;
      section += `- **Ceiling Game Frequency:** ${analysis.distribution.outlierFrequency !== undefined ? (analysis.distribution.outlierFrequency * 100).toFixed(2) : 'N/A'}%\n`;

      // Leverage and uniqueness
      section += `\n#### Tournament Leverage\n\n`;
      section += `- **Average Ownership:** ${this.safeFormat(analysis.leverage.averageOwnership)}%\n`;
      section += `- **Average Leverage:** ${this.safeFormat(analysis.leverage.averageLeverage)}x\n`;
      section += `- **Net Leverage Score:** ${this.safeFormat(analysis.leverage.netLeverage)}\n`;
      section += `- **Uniqueness Score:** ${this.safeFormat(analysis.uniqueness)}/10\n`;
      section += `- **Value-to-Ownership Ratio:** ${this.safeFormat(analysis.valueRatio.valueRatio)}\n`;

      section += `\n---\n\n`;
    });

    return section;
  }

  // Generate portfolio analysis section
  generatePortfolioSection() {
    const exposure = this.analysis.exposureAnalysis || { teamExposure: {}, gameExposure: {}, positionExposure: {} };

    let section = `## Portfolio Analysis\n\n`;

    // Team exposure
    section += `### Team Exposure\n\n`;
    section += `| Team | Exposure % |\n`;
    section += `|------|------------|\n`;

    const teamEntries = Object.entries(exposure.teamExposure || {});
    if (teamEntries.length > 0) {
      teamEntries
        .sort((a, b) => b[1] - a[1])
        .forEach(([team, percentage]) => {
          section += `| ${team} | ${this.safeFormat(percentage)}% |\n`;
        });
    } else {
      section += `| - | No team exposure data |\n`;
    }

    // Game exposure
    section += `\n### Game Exposure\n\n`;
    section += `| Matchup | Exposure % | Both Sides |\n`;
    section += `|---------|------------|------------|\n`;

    const gameEntries = Object.entries(exposure.gameExposure || {});
    if (gameEntries.length > 0) {
      gameEntries
        .sort((a, b) => (b[1].percentage || 0) - (a[1].percentage || 0))
        .forEach(([game, data]) => {
          section += `| ${game} | ${this.safeFormat(data.percentage || 0)}% | ${data.bothSides ? '✓' : '✗'} |\n`;
        });
    } else {
      section += `| - | No game exposure data | - |\n`;
    }

    // Position exposure
    section += `\n### Position Exposure\n\n`;
    section += `| Position | Exposure % |\n`;
    section += `|----------|------------|\n`;

    const positionEntries = Object.entries(exposure.positionExposure || {});
    if (positionEntries.length > 0) {
      positionEntries
        .sort((a, b) => b[1] - a[1])
        .forEach(([position, percentage]) => {
          section += `| ${position} | ${this.safeFormat(percentage)}% |\n`;
        });
    } else {
      section += `| - | No position exposure data |\n`;
    }

    return section + `\n`;
  }

  // Generate tournament strategy section
  generateStrategySection() {
    const strategy = this.analysis.tournamentStrategy || {};

    let section = `## Tournament Strategy Recommendations\n\n`;

    // Single entry
    section += `### Single Entry Contests\n\n`;
    if (strategy.singleEntry) {
      section += `Use **Lineup ${strategy.singleEntry}** for best overall ROI.\n\n`;
    } else {
      section += `No optimal lineup available for single entry contests.\n\n`;
    }

    // 3-max
    section += `### 3-Max Contests\n\n`;
    if (strategy.threeMax && strategy.threeMax.length > 0) {
      section += `Use these lineups in order of priority:\n\n`;
      strategy.threeMax.forEach((lineupId, index) => {
        if (lineupId) {
          section += `${index + 1}. Lineup ${lineupId}\n`;
        }
      });
    } else {
      section += `No optimal lineup recommendations available for 3-max contests.\n\n`;
    }

    // 10-max and larger fields
    section += `\n### 10-Max and Larger Contests\n\n`;
    if (strategy.tenMax && strategy.tenMax.length > 0) {
      section += `Allocate entries according to this distribution:\n\n`;
      section += `| Lineup | Allocation % |\n`;
      section += `|--------|-------------|\n`;

      strategy.tenMax.forEach(alloc => {
        if (alloc) {
          section += `| Lineup ${alloc.lineupId} | ${Math.round(alloc.allocation)}% |\n`;
        }
      });
    } else {
      section += `No allocation recommendations available for multi-entry contests.\n\n`;
    }

    // Specialized strategy
    section += `\n### Specialized Contest Strategy\n\n`;
    if (strategy.maxFirstPlace) {
      section += `- **For Top-Heavy Contests:** Focus on Lineup ${strategy.maxFirstPlace} (highest first place equity)\n`;
    }
    if (strategy.maxCash) {
      section += `- **For Cash Games:** Focus on Lineup ${strategy.maxCash} (highest min-cash rate)\n`;
    }

    return section + `\n`;
  }

  // Generate appendix
  generateAppendix() {
    let appendix = `## Appendix: Statistical Methodology\n\n`;

    appendix += `### Simulation Parameters\n\n`;
    appendix += `- **Iterations:** 2,000\n`;
    appendix += `- **Field Size:** 1,176 entries\n`;
    appendix += `- **Statistical Model:** Bayesian projections with enhanced correlation modeling\n`;
    appendix += `- **Game Script Modeling:** Full Bo3 simulation with momentum effects\n`;
    appendix += `- **Correlation Method:** Position-specific Gaussian Copula functions\n`;
    appendix += `- **Distribution Model:** Skewed logistic with fat tails for proper ceiling modeling\n`;

    appendix += `\n### Advanced Metrics Explained\n\n`;
    appendix += `- **Sharpe Ratio:** Risk-adjusted return metric (higher = better risk-adjusted ROI)\n`;
    appendix += `- **Sortino Ratio:** Similar to Sharpe but only considers downside risk\n`;
    appendix += `- **Skewness:** Measures asymmetry of score distribution (positive = more ceiling games)\n`;
    appendix += `- **Uniqueness Score:** How different a lineup is from the expected field (higher = more unique)\n`;
    appendix += `- **Value-to-Ownership Ratio:** Projected points relative to ownership (higher = better value)\n`;

    return appendix;
  }

  // Save report to file
  saveReportToFile(filepath) {
    const report = this.generateMarkdownReport();
    fs.writeFileSync(filepath, report);
    return filepath;
  }
}

module.exports = {
  EnhancedSimulationAnalyzer,
  EnhancedReportGenerator
};