// worker.js - The thread worker for parallel simulations
const Papa = require('papaparse');
const fs = require('fs');

// Receive data from the main thread
process.on('message', async (message) => {
  const { 
    lineups, 
    iterations, 
    startIdx, 
    endIdx, 
    playerProjections, 
    teamProjections,
    fieldLineups
  } = message;

  // Run the assigned batch of simulations
  const results = await runSimulationBatch(
    lineups, 
    playerProjections, 
    teamProjections,
    fieldLineups,
    startIdx, 
    endIdx
  );

  // Send results back to main thread
  process.send({ results });
});

// Core simulation functions

// Generate skewed random value for better modeling of fantasy variance
function generateSkewedRandomValue(min, max, skew = 1) {
  let u = Math.random();
  if (skew !== 1) {
    u = Math.pow(u, skew);
  }
  return min + (max - min) * u;
}

// Function to generate correlated random values
function generateCorrelatedRandoms(n, correlation) {
  // Generate independent random values
  const independent = Array(n).fill(0).map(() => Math.random());
  
  // Generate a common random value
  const common = Math.random();
  
  // Mix independent and common values based on correlation
  return independent.map(ind => {
    // combine independent value with common value based on correlation
    return Math.sqrt(correlation) * common + Math.sqrt(1 - correlation) * ind;
  });
}

// Calculate probability of a 2-0 sweep based on odds
function calculateSweepProbability(teamOdds) {
  // Convert moneyline odds to implied probability
  let impliedProb;
  if (teamOdds < 0) {
    impliedProb = Math.abs(teamOdds) / (Math.abs(teamOdds) + 100);
  } else {
    impliedProb = 100 / (teamOdds + 100);
  }
  
  // Square the probability to get 2-0 sweep chance (accounting for momentum)
  return Math.pow(impliedProb, 1.8);
}

// Calculate GNP+ bonus based on series outcome
function calculateGNPBonus(teamWon, isSweep) {
  if (teamWon && isSweep) {
    return 20; // 20 points per game not played
  }
  return 0;
}

// Function to simulate series outcomes
function simulateSeriesOutcome(teamOdds) {
  // Convert moneyline odds to win probability
  let winProbability;
  if (teamOdds < 0) {
    winProbability = Math.abs(teamOdds) / (Math.abs(teamOdds) + 100);
  } else {
    winProbability = 100 / (teamOdds + 100);
  }
  
  // Determine if team wins the series
  const teamWins = Math.random() < winProbability;
  
  // If team wins, determine if it's a 2-0 sweep
  const sweepProbability = calculateSweepProbability(teamOdds);
  const isSweep = teamWins && (Math.random() < (sweepProbability / winProbability));
  
  return {
    wins: teamWins,
    isSweep: isSweep,
    scoreline: teamWins ? (isSweep ? "2-0" : "2-1") : (Math.random() < 0.7 ? "0-2" : "1-2")
  };
}

// Function to simulate player fantasy points
function simulatePlayerPoints(player, playerProj, teamWins, isSweep, slateEnv) {
  if (!playerProj) {
    return Math.random() * 20; // Fallback value
  }
  
  // Base distribution parameters
  const min = playerProj.floor || 0;
  const median = playerProj.median || 20;
  const max = playerProj.ceiling || 40;
  
  // Improved: Use logistic distribution for better modeling of fantasy scoring
  // This gives fatter tails compared to normal distribution
  const location = median;
  const scale = (max - min) / 6.0; // Scale parameter for logistic distribution
  
  // Generate base score using logistic distribution
  const u = Math.random();
  const logisticSample = location + scale * Math.log(u / (1 - u));
  
  // Apply skew toward ceiling
  const skewFactor = 1.2;
  let baseScore = min + ((logisticSample - min) * skewFactor);
  
  // Bound the score within reasonable limits
  baseScore = Math.max(min * 0.8, Math.min(max * 1.2, baseScore));
  
  // Adjust based on win/loss with improved modeling
  if (teamWins) {
    // Winners score more, but with diminishing returns
    const winBonus = 1.15 + (Math.random() * 0.1); // 15-25% boost
    baseScore *= winBonus;
  } else {
    // Losers score less but with a floor
    const lossPenalty = 0.8 + (Math.random() * 0.1); // 10-20% penalty
    baseScore *= lossPenalty;
  }
  
  // Apply GNP bonus if applicable
  const gnpBonus = calculateGNPBonus(teamWins, isSweep);
  if (gnpBonus > 0) {
    baseScore += gnpBonus;
  }
  
  // Apply improved slate environment factors
  const teamFactor = slateEnv.teamFactors[player.team] || 1;
  baseScore *= teamFactor;
  
  // Position-specific adjustments based on slate environment
  const positionFactor = (slateEnv.highKillPositions.includes(player.position)) ? 
    1.1 + (Math.random() * 0.1) : // High-kill positions have more variance
    1.0 + (Math.random() * 0.05); // Less variance for other positions
  
  baseScore *= positionFactor;
  
  // Add "pop-off" chance - rare ceiling games
  if (Math.random() < 0.05) { // 5% chance of pop-off
    const popOffMultiplier = 1.2 + (Math.random() * 0.3); // 20-50% boost
    baseScore *= popOffMultiplier;
  }
  
  return baseScore;
}

// Define position correlations - now with more realistic values
const positionCorrelations = {
  "MID-JNG": 0.65,  // Strong correlation - jungle+mid synergy
  "ADC-SUP": 0.72,  // Strongest correlation - bot lane duo
  "TOP-JNG": 0.42,  // Moderate correlation - ganks and early game
  "MID-ADC": 0.35,  // Moderate correlation - carry positions
  "TOP-MID": 0.28,  // Weaker correlation
  "JNG-SUP": 0.38,  // Moderate - roaming and objective control
  "TOP-ADC": 0.22,  // Weaker correlation
  "TOP-SUP": 0.18,  // Weak correlation
  "MID-SUP": 0.32,  // Moderate - roaming supports
  "JNG-ADC": 0.33   // Moderate - ganks and objectives
};

// Function to create correlated fantasy performances for a lineup
function simulateCorrelatedLineupPerformance(lineup, slateEnv, playerProjections, teamProjections) {
  // Group players by team for team-level correlation
  const teamGroups = {};
  
  // Add captain to appropriate team group
  const cptTeam = lineup.cpt.team;
  if (!teamGroups[cptTeam]) teamGroups[cptTeam] = [];
  teamGroups[cptTeam].push({...lineup.cpt, isCpt: true});
  
  // Add players to team groups
  lineup.players.forEach(player => {
    if (!teamGroups[player.team]) teamGroups[player.team] = [];
    teamGroups[player.team].push(player);
  });
  
  // Simulate series outcomes for each team
  const teamOutcomes = {};
  Object.keys(teamGroups).forEach(team => {
    const teamOdds = teamProjections[team]?.odds || 0;
    teamOutcomes[team] = simulateSeriesOutcome(teamOdds);
  });
  
  // Generate correlated fantasy performances within each team
  const simResults = {};
  
  Object.keys(teamGroups).forEach(team => {
    const players = teamGroups[team];
    const teamWins = teamOutcomes[team].wins;
    const isSweep = teamOutcomes[team].isSweep;
    
    // Improved: Create stronger team-level correlation
    const teamCorrelation = 0.7; // Strong team-level correlation
    const teamRands = generateCorrelatedRandoms(players.length, teamCorrelation);
    
    players.forEach((player, idx) => {
      const playerName = player.name;
      const playerProj = playerProjections[playerName];
      
      // Simulate initial points with team-correlated randomness
      const randFactor = teamRands[idx];
      let pts = simulatePlayerPoints(
        player, 
        playerProj, 
        teamWins, 
        isSweep, 
        slateEnv
      );
      
      // Apply CPT bonus if applicable
      if (player.isCpt) {
        pts *= 1.5; // CPT gets 1.5x points
      }
      
      simResults[playerName] = {
        base: pts,
        randFactor: randFactor,
        teamWins: teamWins,
        isSweep: isSweep,
        final: pts // Will be adjusted for position correlations
      };
    });
  });
  
  // Apply position-specific correlations
  // Create groups of position pairs in the lineup
  const positionPairs = [];
  
  // Include captain in position correlation
  const allPlayers = [lineup.cpt, ...lineup.players];
  
  for (let i = 0; i < allPlayers.length; i++) {
    for (let j = i + 1; j < allPlayers.length; j++) {
      const player1 = allPlayers[i];
      const player2 = allPlayers[j];
      
      // Skip if they're on different teams
      if (player1.team !== player2.team) continue;
      
      // Get positions in alphabetical order for consistent lookup
      const positions = [player1.position, player2.position].sort().join('-');
      const correlation = positionCorrelations[positions] || 0.1; // Default to weak correlation
      
      if (correlation > 0.2) { // Only consider significant correlations
        positionPairs.push({
          player1: player1.name,
          player2: player2.name,
          correlation: correlation
        });
      }
    }
  }
  
  // Apply position correlations
  positionPairs.forEach(pair => {
    const player1 = pair.player1;
    const player2 = pair.player2;
    const correlation = pair.correlation;
    
    // Generate correlated adjustment
    const correlationFactor = Math.random() * correlation;
    
    // Apply to both players (smaller effect to higher base performer)
    const total = simResults[player1].base + simResults[player2].base;
    if (total > 0) {
      const p1Share = simResults[player1].base / total;
      const p2Share = simResults[player2].base / total;
      
      simResults[player1].final += correlationFactor * simResults[player2].base * p2Share;
      simResults[player2].final += correlationFactor * simResults[player1].base * p1Share;
    }
  });
  
  // Calculate final lineup score
  let totalScore = 0;
  Object.keys(simResults).forEach(playerName => {
    totalScore += simResults[playerName].final;
  });
  
  // Add current points from the in-progress games
  if (lineup.currentPoints) {
    Object.keys(lineup.currentPoints).forEach(playerName => {
      totalScore += lineup.currentPoints[playerName];
    });
  }
  
  return {
    totalScore: totalScore,
    playerScores: simResults,
    teamOutcomes: teamOutcomes
  };
}

// Function to apply DraftKings payout structure
function getDraftKingsPayout(place, entryFee, entryCount) {
  if (entryFee === 5) {
    // $5 entry payout structure
    if (place === 1) return 1000;
    if (place <= 2) return 500;
    if (place <= 5) return 200;
    if (place <= 10) return 100;
    if (place <= 20) return 50;
    if (place <= 50) return 25;
    if (place <= Math.floor(entryCount * 0.2)) return 10; // Min cash (top 20%)
  } else if (entryFee === 20) {
    // $20 entry payout structure
    if (place === 1) return 5000;
    if (place === 2) return 2000;
    if (place === 3) return 1000;
    if (place <= 5) return 500;
    if (place <= 10) return 250;
    if (place <= 20) return 100;
    if (place <= 50) return 50;
    if (place <= 100) return 30;
    if (place <= Math.floor(entryCount * 0.2)) return 25; // Min cash (top 20%)
  }
  return 0; // No payout
}

// Main batch simulation function
async function runSimulationBatch(lineups, playerProjections, teamProjections, fieldLineups, startIdx, endIdx) {
  // Prepare results structure for each lineup
  const batchResults = lineups.map(lineup => ({
    lineup: lineup,
    placements: [],
    payouts: [],
    scores: [],
    firstPlaceCount: 0,
    top5Count: 0,
    top10Count: 0,
    minCashCount: 0
  }));
  
  const fieldSize = fieldLineups.length;
  const entryFee = 5; // Default entry fee
  
  // Run the assigned iterations
  for (let i = startIdx; i < endIdx; i++) {
    // Create a slate environment for this iteration
    const slateEnv = {
      // Global kill rate factor
      globalKillFactor: generateSkewedRandomValue(0.85, 1.2, 1.1),
      
      // Team factors
      teamFactors: {},
      
      // Positions that benefit in high-kill environments
      highKillPositions: ["ADC", "MID", "JNG"]
    };
    
    // Generate team factors
    Object.keys(teamProjections).forEach(team => {
      slateEnv.teamFactors[team] = generateSkewedRandomValue(0.85, 1.15, 1);
    });
    
    // Simulate scores for our lineups
    const ourLineupScores = [];
    for (let j = 0; j < lineups.length; j++) {
      const simResult = simulateCorrelatedLineupPerformance(
        lineups[j], 
        slateEnv, 
        playerProjections, 
        teamProjections
      );
      
      ourLineupScores.push({
        id: lineups[j].id,
        score: simResult.totalScore,
        details: simResult
      });
      
      // Store the score for this iteration
      batchResults[j].scores.push(simResult.totalScore);
    }
    
    // Simulate scores for opponent field
    const fieldScores = [];
    for (let j = 0; j < fieldLineups.length; j++) {
      const fieldLineup = fieldLineups[j];
      
      const simResult = simulateCorrelatedLineupPerformance(
        fieldLineup, 
        slateEnv, 
        playerProjections, 
        teamProjections
      );
      
      fieldScores.push({
        id: fieldLineup.id,
        score: simResult.totalScore,
        details: simResult
      });
    }
    
    // Combine our lineups and field lineups
    const allScores = [...ourLineupScores, ...fieldScores];
    
    // Sort by score in descending order
    allScores.sort((a, b) => b.score - a.score);
    
    // Calculate placements and payouts for our lineups
    for (let j = 0; j < lineups.length; j++) {
      const lineupId = lineups[j].id;
      const scoreEntry = allScores.find(entry => entry.id === lineupId);
      
      if (scoreEntry) {
        // Find placement (1-indexed)
        const placement = allScores.indexOf(scoreEntry) + 1;
        batchResults[j].placements.push(placement);
        
        // Calculate payout based on placement
        const payout = getDraftKingsPayout(placement, entryFee, fieldSize);
        batchResults[j].payouts.push(payout);
        
        // Update counts
        if (placement === 1) batchResults[j].firstPlaceCount++;
        if (placement <= 5) batchResults[j].top5Count++;
        if (placement <= 10) batchResults[j].top10Count++;
        if (placement <= Math.floor(fieldSize * 0.2)) batchResults[j].minCashCount++;
      }
    }
  }
  
  return batchResults;
}
