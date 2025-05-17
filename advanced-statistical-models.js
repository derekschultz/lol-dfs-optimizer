// advanced-statistical-models.js
// This module implements advanced statistical models for the simulation

/**
 * Enhanced Bayesian Fantasy Score Projection Model
 * - Uses prior distributions based on position and matchup
 * - Adjusts for historical performance variance
 * - Models team-dependent performance correlations
 */
class BayesianScoreProjection {
  constructor(playerProjections, teamProjections) {
    this.playerProjections = playerProjections;
    this.teamProjections = teamProjections;
    this.positionPriors = this.buildPositionPriors();
    this.matchupModels = this.buildMatchupModels();
  }
  
  // Build position-specific prior distributions
  buildPositionPriors() {
    const priors = {
      "ADC": { 
        baseVariance: 0.28, 
        skewFactor: 1.3,
        ceilingFactor: 1.45,
        winBonus: 0.18,
        lossReduction: 0.15
      },
      "MID": { 
        baseVariance: 0.32, 
        skewFactor: 1.25,
        ceilingFactor: 1.5,
        winBonus: 0.16,
        lossReduction: 0.18
      },
      "JNG": { 
        baseVariance: 0.26, 
        skewFactor: 1.2,
        ceilingFactor: 1.4,
        winBonus: 0.15,
        lossReduction: 0.2
      },
      "SUP": { 
        baseVariance: 0.22, 
        skewFactor: 1.1,
        ceilingFactor: 1.3,
        winBonus: 0.12,
        lossReduction: 0.1
      },
      "TOP": { 
        baseVariance: 0.3, 
        skewFactor: 1.15,
        ceilingFactor: 1.35,
        winBonus: 0.14,
        lossReduction: 0.16
      },
      "TEAM": { 
        baseVariance: 0.18, 
        skewFactor: 1.05,
        ceilingFactor: 1.25,
        winBonus: 0.5,
        lossReduction: 0.4
      }
    };
    
    return priors;
  }
  
  // Build matchup-specific models based on team attributes
  buildMatchupModels() {
    const matchups = {};
    
    Object.keys(this.teamProjections).forEach(team => {
      const opponent = this.teamProjections[team].opponent;
      if (!opponent) return;
      
      // Convert odds to win probability
      let winProb;
      const odds = this.teamProjections[team].odds;
      if (odds < 0) {
        winProb = Math.abs(odds) / (Math.abs(odds) + 100);
      } else {
        winProb = 100 / (odds + 100);
      }
      
      // Calculate volatility based on team's stack+ metrics
      const teamStackPlus = this.teamProjections[team].stackPlus || 100;
      const volatility = Math.sqrt(teamStackPlus / 100);
      
      // Create matchup model
      matchups[`${team} vs ${opponent}`] = {
        winProbability: winProb,
        volatility: volatility,
        expectedKillsPerWin: this.teamProjections[team].avgValue * 8 || 20,
        expectedDeathsPerLoss: this.teamProjections[opponent].oppKillsAllowed || 12,
        gamePace: this.calculateGamePace(team, opponent)
      };
    });
    
    return matchups;
  }
  
  // Calculate expected game pace for a matchup
  calculateGamePace(team1, team2) {
    const team1Fantasy = this.teamProjections[team1]?.fantasy || 25;
    const team2Fantasy = this.teamProjections[team2]?.fantasy || 25;
    
    // Higher combined fantasy projection = faster game pace
    return (team1Fantasy + team2Fantasy) / 50;
  }
  
  // Generate a fantasy score based on Bayesian model
  generateScore(player, teamWon, isSweep, slateEnv) {
    const playerProj = this.playerProjections[player.name];
    if (!playerProj) {
      return this.generateFallbackScore(player, teamWon);
    }
    
    const position = player.position;
    const positionPrior = this.positionPriors[position];
    const teamMatchup = `${player.team} vs ${playerProj.opponent}`;
    const matchupModel = this.matchupModels[teamMatchup] || this.getDefaultMatchup();
    
    // Get base distribution parameters
    const min = playerProj.floor || 0;
    const median = playerProj.median || 20;
    const max = playerProj.ceiling || 40;
    
    // Apply Bayesian model with position and matchup priors
    const score = this.sampleFromDistribution(
      min, median, max, 
      positionPrior.baseVariance, 
      positionPrior.skewFactor,
      matchupModel.volatility,
      slateEnv.globalKillFactor
    );
    
    // Apply win/loss adjustments with position-specific factors
    let adjustedScore = score;
    if (teamWon) {
      adjustedScore *= (1 + positionPrior.winBonus + (Math.random() * 0.08));
    } else {
      adjustedScore *= (1 - positionPrior.lossReduction - (Math.random() * 0.05));
    }
    
    // Apply GNP+ bonus - with team-specific boost for positions that benefit more
    if (teamWon && isSweep) {
      const baseGnpBonus = 20;
      const positionGnpFactor = position === "TEAM" ? 1.2 : 
                               (position === "TOP" ? 0.9 : 1.0);
      adjustedScore += (baseGnpBonus * positionGnpFactor);
    }
    
    // Apply game pace factor
    adjustedScore *= Math.pow(matchupModel.gamePace, 0.5);
    
    // Apply slate environment and position factors
    const teamFactor = slateEnv.teamFactors[player.team] || 1;
    adjustedScore *= teamFactor;
    
    // Position benefits in high-kill environments
    if (slateEnv.highKillPositions.includes(position)) {
      adjustedScore *= (1.05 + (Math.random() * 0.1));
    }
    
    // Model "pop-off" games with position-specific ceiling
    if (Math.random() < 0.05) { // 5% chance
      adjustedScore *= positionPrior.ceilingFactor;
    }
    
    return adjustedScore;
  }
  
  // Sample from advanced statistical distribution
  sampleFromDistribution(min, median, max, baseVariance, skew, volatility, globalFactor) {
    // Use generalized logistic distribution with adjustable parameters
    // This models the fat-tailed nature of fantasy scores better than normal distribution
    const location = median;
    const scale = (max - min) / 6.0 * volatility * globalFactor;
    
    // Generate logistic sample
    const u = Math.random();
    let sample;
    
    // Using either skewed logistic or Frechet distribution based on position characteristics
    if (Math.random() < 0.7) {
      // Skewed logistic for most samples
      const t = u / (1 - u);
      sample = location + scale * Math.log(Math.pow(t, 1/skew));
    } else {
      // Frechet (extreme value) distribution for modeling fat upper tail properly
      const alpha = 3.0; // Shape parameter - lower = fatter tail
      sample = location + scale * Math.pow(-Math.log(u), -1/alpha);
    }
    
    // Bound the score within reasonable limits
    return Math.max(min * 0.7, Math.min(max * 1.3, sample));
  }
  
  // Fallback if no projection data exists
  generateFallbackScore(player, teamWon) {
    const position = player.position;
    const positionPrior = this.positionPriors[position];
    
    // Generate reasonable fallback based on position
    const baseScore = 20 * (
      position === "ADC" ? 1.2 :
      position === "MID" ? 1.15 :
      position === "JNG" ? 1.1 :
      position === "TOP" ? 1.0 :
      position === "SUP" ? 0.8 :
      position === "TEAM" ? 0.5 : 1.0
    );
    
    // Apply win/loss adjustments
    if (teamWon) {
      return baseScore * (1 + positionPrior.winBonus);
    } else {
      return baseScore * (1 - positionPrior.lossReduction);
    }
  }
  
  // Get default matchup model when data is missing
  getDefaultMatchup() {
    return {
      winProbability: 0.5,
      volatility: 1.0,
      expectedKillsPerWin: 20,
      expectedDeathsPerLoss: 12,
      gamePace: 1.0
    };
  }
}

/**
 * Advanced Game Script Simulator
 * Models realistic Bo3 series outcomes with momentum and kill timings
 */
class GameScriptSimulator {
  constructor(teamProjections) {
    this.teamProjections = teamProjections;
    this.momentumFactor = 1.4; // How much winning game 1 affects game 2 probability
  }
  
  // Simulate full Bo3 series outcome with detailed game script
  simulateSeriesWithGameScript(team, opponent) {
    const teamInfo = this.teamProjections[team];
    const oppInfo = this.teamProjections[opponent];
    
    if (!teamInfo || !oppInfo) {
      return this.simulateGenericSeries(team);
    }
    
    // Convert moneyline odds to win probability
    let baseWinProb;
    if (teamInfo.odds < 0) {
      baseWinProb = Math.abs(teamInfo.odds) / (Math.abs(teamInfo.odds) + 100);
    } else {
      baseWinProb = 100 / (teamInfo.odds + 100);
    }
    
    // Game 1 simulation
    const game1Win = Math.random() < baseWinProb;
    
    // Game 2 simulation with momentum effect
    let game2WinProb;
    if (game1Win) {
      // Increased probability due to momentum
      game2WinProb = Math.min(0.95, baseWinProb * this.momentumFactor);
    } else {
      // Decreased probability after a loss
      game2WinProb = Math.max(0.05, baseWinProb / this.momentumFactor);
    }
    const game2Win = Math.random() < game2WinProb;
    
    // Determine if a game 3 is needed
    let game3Win = false;
    let needsGame3 = game1Win !== game2Win;
    
    if (needsGame3) {
      // Game 3 simulation with stronger momentum effect
      let game3WinProb;
      if (game2Win) {
        // Even stronger momentum after winning game 2
        game3WinProb = Math.min(0.97, baseWinProb * (this.momentumFactor * 1.2));
      } else {
        // Reduced momentum after losing game 2
        game3WinProb = Math.max(0.03, baseWinProb / (this.momentumFactor * 1.2));
      }
      game3Win = Math.random() < game3WinProb;
    }
    
    // Determine series outcome
    const seriesWin = needsGame3 ? game3Win : game2Win;
    const isSweep = seriesWin && !needsGame3;
    let scoreline;
    
    if (seriesWin) {
      scoreline = isSweep ? "2-0" : "2-1";
    } else {
      scoreline = needsGame3 ? "1-2" : "0-2";
    }
    
    // Generate detailed game script
    const gameDetails = {
      game1: {
        win: game1Win,
        killCount: this.generateGameKills(team, opponent, game1Win),
        duration: this.generateGameDuration(team, opponent, game1Win)
      }
    };
    
    gameDetails.game2 = {
      win: game2Win,
      killCount: this.generateGameKills(team, opponent, game2Win, gameDetails.game1),
      duration: this.generateGameDuration(team, opponent, game2Win, gameDetails.game1)
    };
    
    if (needsGame3) {
      gameDetails.game3 = {
        win: game3Win,
        killCount: this.generateGameKills(team, opponent, game3Win, gameDetails.game2),
        duration: this.generateGameDuration(team, opponent, game3Win, gameDetails.game2)
      };
    }
    
    return {
      wins: seriesWin,
      isSweep: isSweep,
      scoreline: scoreline,
      gameDetails: gameDetails
    };
  }
  
  // Generate realistic kill count for a game
  generateGameKills(team, opponent, didWin, previousGame = null) {
    const teamInfo = this.teamProjections[team];
    const oppInfo = this.teamProjections[opponent];
    
    // Base kill range adjusted by team quality
    const teamKillFactor = teamInfo?.avgValue || 1;
    const oppKillsAllowed = oppInfo?.oppKillsAllowed || 12;
    
    // Winners get more kills
    let baseKills;
    if (didWin) {
      baseKills = oppKillsAllowed * (0.9 + (Math.random() * 0.5)); // 90-140% of expected
    } else {
      baseKills = oppKillsAllowed * (0.3 + (Math.random() * 0.4)); // 30-70% of expected
    }
    
    // Apply team-specific factor
    baseKills *= teamKillFactor;
    
    // Apply momentum from previous game (if exists)
    if (previousGame) {
      if (previousGame.win === didWin) {
        // Consistent result - momentum carries
        baseKills *= 1.1;
      } else {
        // Bounce-back/fall-off game
        baseKills *= 0.9;
      }
    }
    
    // Round to integer
    return Math.round(baseKills);
  }
  
  // Generate realistic game duration
  generateGameDuration(team, opponent, didWin, previousGame = null) {
    const teamInfo = this.teamProjections[team];
    const oppInfo = this.teamProjections[opponent];
    
    // Base duration range (in minutes)
    let baseDuration;
    if (didWin) {
      // Winners tend to have shorter games
      baseDuration = 25 + (Math.random() * 10); // 25-35 minutes
    } else {
      // Losers tend to have longer games (if they're competitive)
      baseDuration = 30 + (Math.random() * 8); // 30-38 minutes
    }
    
    // Adjust based on team's play style (using stackPlus as a proxy for aggression)
    const teamStackPlus = teamInfo?.stackPlus || 100;
    const stackPlusFactor = teamStackPlus / 100;
    
    // More aggressive teams (higher stackPlus) tend to have shorter games
    baseDuration /= Math.pow(stackPlusFactor, 0.25);
    
    // Apply momentum from previous game (if exists)
    if (previousGame) {
      if (previousGame.win === didWin) {
        // Consistent result - momentum leads to faster games
        baseDuration *= 0.9;
      } else {
        // Bounce-back/fall-off game - teams play more cautiously
        baseDuration *= 1.1;
      }
    }
    
    // Stomps are shorter, close games are longer
    if (didWin && Math.random() < 0.3) {
      // 30% chance of a stomp when winning
      baseDuration *= 0.8;
    } else if (!didWin && Math.random() < 0.7) {
      // 70% chance of a longer game when losing (but not completely stomped)
      baseDuration *= 1.1;
    }
    
    // Round to nearest minute
    return Math.round(baseDuration);
  }
  
  // Fallback for missing team data
  simulateGenericSeries(team) {
    // Use 50% win probability
    const game1Win = Math.random() < 0.5;
    const game2Win = Math.random() < 0.5;
    let game3Win = false;
    let needsGame3 = game1Win !== game2Win;
    
    if (needsGame3) {
      game3Win = Math.random() < 0.5;
    }
    
    const seriesWin = needsGame3 ? game3Win : game2Win;
    const isSweep = seriesWin && !needsGame3;
    let scoreline;
    
    if (seriesWin) {
      scoreline = isSweep ? "2-0" : "2-1";
    } else {
      scoreline = needsGame3 ? "1-2" : "0-2";
    }
    
    return {
      wins: seriesWin,
      isSweep: isSweep,
      scoreline: scoreline
    };
  }
}

/**
 * Advanced Correlation System using Copula functions for more realistic correlation
 */
class CopulaCorrelationSystem {
  constructor() {
    // Enhanced position correlations based on gameplay patterns
    this.positionCorrelations = {
      "MID-JNG": 0.68,  // Strong synergy in early-mid game
      "ADC-SUP": 0.74,  // Strongest correlation in bot lane
      "TOP-JNG": 0.45,  // Moderate for early ganks
      "MID-ADC": 0.33,  // Moderate for team fights
      "TOP-MID": 0.28,  // Weak direct correlation
      "JNG-SUP": 0.37,  // Moderate for roaming and vision
      "TOP-ADC": 0.22,  // Weak correlation
      "TOP-SUP": 0.19,  // Weak correlation
      "MID-SUP": 0.31,  // Moderate for roaming and vision
      "JNG-ADC": 0.34   // Moderate for objectives and ganks
    };
    
    // Game phase correlations (early, mid, late)
    this.phaseCorrelations = {
      "JNG": [0.7, 0.6, 0.4],  // Strongest early, weakens late
      "MID": [0.5, 0.7, 0.6],  // Peaks in mid-game
      "ADC": [0.3, 0.6, 0.8],  // Weakest early, strongest late
      "SUP": [0.6, 0.5, 0.4],  // Strong early, weakens late
      "TOP": [0.6, 0.4, 0.5]   // Strong early, mixed later
    };
    
    // Team role allocations (what % of resources each position gets)
    this.teamResourceAllocation = {
      "standard": {
        "ADC": 0.30,
        "MID": 0.25,
        "TOP": 0.20,
        "JNG": 0.15,
        "SUP": 0.10
      },
      "mid-focused": {
        "MID": 0.35,
        "ADC": 0.25,
        "TOP": 0.15,
        "JNG": 0.15,
        "SUP": 0.10
      },
      "top-focused": {
        "TOP": 0.30,
        "MID": 0.25,
        "ADC": 0.20,
        "JNG": 0.15,
        "SUP": 0.10
      }
    };
  }
  
  // Generate correlated random values using Gaussian Copula
  generateCorrelatedValues(n, correlation) {
    // Generate standard normal variables
    const z1 = this.normalRandom();
    const z2Array = Array(n).fill(0).map(() => this.normalRandom());
    
    // Apply correlation using Cholesky decomposition approach
    return z2Array.map(z2 => {
      const correlatedZ = correlation * z1 + Math.sqrt(1 - correlation * correlation) * z2;
      // Convert back to uniform using normal CDF
      return this.normalCDF(correlatedZ);
    });
  }
  
  // Standard normal CDF approximation
  normalCDF(x) {
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp(-x * x / 2);
    let prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
    if (x > 0) prob = 1 - prob;
    return prob;
  }
  
  // Standard normal random number generator using Box-Muller transform
  normalRandom() {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }
  
  // Create team-level correlation structure
  generateTeamCorrelation(players, teamOutcome, slateEnv) {
    const teamWin = teamOutcome.wins;
    const teamSize = players.length;
    
    // Base team correlation - higher in victories
    const baseCorrelation = teamWin ? 0.75 : 0.65;
    
    // Generate base team correlation values
    const teamCorrelationValues = this.generateCorrelatedValues(teamSize, baseCorrelation);
    
    // Adjust for game details if available
    if (teamOutcome.gameDetails) {
      // Shorter, high-kill games produce higher correlations
      const game1 = teamOutcome.gameDetails.game1;
      if (game1.win && game1.duration < 28 && game1.killCount > 15) {
        // Apply stronger correlation for stomps
        for (let i = 0; i < teamCorrelationValues.length; i++) {
          teamCorrelationValues[i] = Math.pow(teamCorrelationValues[i], 0.8); // Higher correlation
        }
      }
    }
    
    return teamCorrelationValues;
  }
  
  // Apply position-specific correlations
  applyPositionCorrelations(simResults, allPlayers) {
    // Generate correlation groups
    const positionPairs = [];
    
    for (let i = 0; i < allPlayers.length; i++) {
      for (let j = i + 1; j < allPlayers.length; j++) {
        const player1 = allPlayers[i];
        const player2 = allPlayers[j];
        
        // Skip if they're on different teams
        if (player1.team !== player2.team) continue;
        
        // Get positions in alphabetical order for consistent lookup
        const positions = [player1.position, player2.position].sort().join('-');
        const correlation = this.positionCorrelations[positions];
        
        if (correlation > 0.2) { // Only consider significant correlations
          positionPairs.push({
            player1: player1.name,
            player2: player2.name,
            correlation: correlation
          });
        }
      }
    }
    
    // Apply position correlations using Copula approach
    positionPairs.forEach(pair => {
      const player1 = pair.player1;
      const player2 = pair.player2;
      const correlation = pair.correlation;
      
      if (!simResults[player1] || !simResults[player2]) return;
      
      // Generate correlated adjustment factor
      const [u1, u2] = this.generateCorrelatedValues(2, correlation);
      
      // Apply Copula to make correlations more realistic
      // This creates non-linear dependencies that better match game dynamics
      const copulaFactor = u1 * u2 * correlation;
      
      // Apply to both players with adjustments based on their base scores
      const total = simResults[player1].base + simResults[player2].base;
      if (total > 0) {
        const adjustmentScale = total * 0.15 * copulaFactor;
        const p1Share = simResults[player1].base / total;
        const p2Share = simResults[player2].base / total;
        
        simResults[player1].final += adjustmentScale * p2Share;
        simResults[player2].final += adjustmentScale * p1Share;
      }
    });
    
    return simResults;
  }
}

// Export the enhanced models
module.exports = {
  BayesianScoreProjection,
  GameScriptSimulator,
  CopulaCorrelationSystem
};
