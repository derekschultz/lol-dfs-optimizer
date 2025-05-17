// optimal-lineup-generator.js
// Advanced tool to generate optimized lineups based on simulation results

const fs = require('fs');

/**
 * Optimized Lineup Generator
 * Creates optimal new lineups based on simulation insights and portfolio theory
 */
class OptimalLineupGenerator {
  constructor(simulationResults, playerProjections, teamProjections, existingLineups) {
    this.results = simulationResults;
    this.playerProjections = playerProjections;
    this.teamProjections = teamProjections;
    this.existingLineups = existingLineups || [];
    
    // Position groups for lineup construction
    this.positions = ["ADC", "MID", "JNG", "TOP", "SUP", "TEAM"];
    
    // Initialize player pools by position
    this.playerPools = this.initializePlayerPools();
    
    // Initialize team stacks
    this.teamStacks = this.initializeTeamStacks();
  }
  
  // Initialize player pools by position
  initializePlayerPools() {
    const pools = {
      "ADC": [],
      "MID": [],
      "JNG": [],
      "TOP": [],
      "SUP": [],
      "TEAM": []
    };
    
    // Fill the player pools
    Object.keys(this.playerProjections).forEach(playerName => {
      const player = this.playerProjections[playerName];
      if (pools[player.position]) {
        pools[player.position].push({
          name: playerName,
          position: player.position,
          team: player.team,
          opponent: player.opponent,
          salary: player.salary,
          ownership: player.ownership || 1,
          median: player.median || 0,
          ceiling: player.ceiling || 0,
          floor: player.floor || 0,
          leverage: player.levX || 1
        });
      }
    });
    
    // Sort each pool by projected median points (descending)
    Object.keys(pools).forEach(pos => {
      pools[pos].sort((a, b) => b.median - a.median);
    });
    
    return pools;
  }
  
  // Initialize team stacks
  initializeTeamStacks() {
    const stacks = [];
    
    Object.keys(this.teamProjections).forEach(team => {
      const teamInfo = this.teamProjections[team];
      
      stacks.push({
        team: team,
        opponent: teamInfo.opponent,
        odds: teamInfo.odds,
        stackPlus: teamInfo.stackPlus || 0,
        projectedFantasy: teamInfo.fantasy || 0,
        isFavorite: teamInfo.odds < 0,
        sweepProbability: this.calculateSweepProbability(teamInfo.odds)
      });
    });
    
    // Sort stacks by stackPlus (descending)
    stacks.sort((a, b) => b.stackPlus - a.stackPlus);
    
    return stacks;
  }
  
  // Calculate sweep probability
  calculateSweepProbability(odds) {
    // Convert moneyline odds to implied probability
    let impliedProb;
    if (odds < 0) {
      impliedProb = Math.abs(odds) / (Math.abs(odds) + 100);
    } else {
      impliedProb = 100 / (odds + 100);
    }
    
    // Apply momentum factor (teams that win game 1 are more likely to win game 2)
    return Math.pow(impliedProb, 1.8);
  }
  
  // Generate a new optimized lineup
  generateOptimalLineup(optimizationTarget = "balanced") {
    // Different optimization targets
    const targets = {
      "balanced": { // Balanced ROI and first place equity
        ceilingWeight: 0.5,
        valueWeight: 0.3,
        leverageWeight: 0.2
      },
      "firstPlace": { // Maximum first place probability
        ceilingWeight: 0.7,
        valueWeight: 0.1,
        leverageWeight: 0.2
      },
      "cashGame": { // Maximum min-cash rate
        ceilingWeight: 0.3,
        valueWeight: 0.6,
        leverageWeight: 0.1
      },
      "contrarian": { // Maximum leverage vs field
        ceilingWeight: 0.4,
        valueWeight: 0.1,
        leverageWeight: 0.5
      }
    };
    
    // Get weights for the selected optimization target
    const weights = targets[optimizationTarget] || targets["balanced"];
    
    // Step 1: Select optimal stack structure based on simulation results
    const stackStructure = this.selectOptimalStackStructure(weights);
    
    // Step 2: Select captain based on optimization target
    const captain = this.selectOptimalCaptain(stackStructure.primaryTeam, weights);
    
    // Step 3: Fill in primary stack
    const primaryPlayers = this.fillPrimaryStack(stackStructure.primaryTeam, captain, 3);
    
    // Step 4: Fill in secondary stack
    const secondaryPlayers = this.fillSecondaryStack(stackStructure.secondaryTeam, 3);
    
    // Step 5: Adjust for lineup rules and constraints
    const finalLineup = this.finalizeLineup({
      captain: captain,
      primaryPlayers: primaryPlayers,
      secondaryPlayers: secondaryPlayers,
      remainingSlots: 6 - (primaryPlayers.length + secondaryPlayers.length)
    });
    
    // Step 6: Check for uniqueness versus existing lineups
    const uniqueness = this.calculateLineupUniqueness(finalLineup);
    
    // Return the optimized lineup with metadata
    return {
      lineup: finalLineup,
      stackStructure: stackStructure,
      optimizationTarget: optimizationTarget,
      uniquenessScore: uniqueness,
      projectedScore: this.calculateProjectedScore(finalLineup)
    };
  }
  
  // Select optimal stack structure based on simulation results
  selectOptimalStackStructure(weights) {
    // Analyze existing top-performing lineups
    const topLineups = this.results.slice(0, 3); // Top 3 lineups
    
    // Count team occurrences in top lineups
    const teamCounts = {};
    
    topLineups.forEach(result => {
      const lineup = result.lineup;
      const allPlayers = [lineup.cpt, ...lineup.players];
      
      // Count team occurrences
      allPlayers.forEach(player => {
        if (!teamCounts[player.team]) teamCounts[player.team] = 0;
        teamCounts[player.team]++;
      });
    });
    
    // Sort teams by count (descending)
    const topTeams = Object.entries(teamCounts)
      .sort((a, b) => b[1] - a[1])
      .map(([team, count]) => team);
    
    // Select primary team candidates (top teams + high stack+ teams)
    const primaryTeamCandidates = new Set([
      ...topTeams.slice(0, 2), // Top 2 teams from existing lineups
      ...this.teamStacks.slice(0, 3).map(stack => stack.team) // Top 3 stack+ teams
    ]);
    
    // Score each potential primary team
    const teamScores = {};
    
    primaryTeamCandidates.forEach(team => {
      const teamInfo = this.teamStacks.find(stack => stack.team === team);
      if (!teamInfo) return;
      
      // Calculate team score based on weighted factors
      const stackPlusScore = teamInfo.stackPlus / 100;
      const fantasyScore = teamInfo.projectedFantasy / 30;
      const sweepScore = teamInfo.sweepProbability;
      
      // Calculate weighted score based on optimization target
      teamScores[team] = (
        (stackPlusScore * 0.4) +
        (fantasyScore * 0.4) +
        (sweepScore * 0.2)
      );
      
      // Adjust for contrarian target
      if (weights.leverageWeight > 0.3) {
        // Reduce score for chalk teams, boost score for contrarian teams
        const teamPlayerPool = [
          ...this.playerPools.ADC.filter(p => p.team === team),
          ...this.playerPools.MID.filter(p => p.team === team),
          ...this.playerPools.JNG.filter(p => p.team === team),
          ...this.playerPools.TOP.filter(p => p.team === team),
          ...this.playerPools.SUP.filter(p => p.team === team),
          ...this.playerPools.TEAM.filter(p => p.team === team)
        ];
        
        const avgOwnership = teamPlayerPool.reduce((sum, p) => sum + p.ownership, 0) / teamPlayerPool.length;
        
        // Adjust score based on ownership (lower ownership = higher score for contrarian)
        teamScores[team] *= (1 - (avgOwnership / 100) * weights.leverageWeight);
      }
    });
    
    // Select primary team based on highest score
    const primaryTeam = Object.entries(teamScores)
      .sort((a, b) => b[1] - a[1])[0][0];
    
    // Find opponent for game correlation
    const primaryTeamInfo = this.teamStacks.find(stack => stack.team === primaryTeam);
    const opponent = primaryTeamInfo?.opponent;
    
    // Check if opponent is a good secondary stack candidate
    const opponentInfo = this.teamStacks.find(stack => stack.team === opponent);
    const useOpponent = opponentInfo && Math.random() < 0.4; // 40% chance to use opponent for game correlation
    
    // Select second team (either opponent or another strong team)
    let secondaryTeam;
    
    if (useOpponent) {
      secondaryTeam = opponent;
    } else {
      // Remove primary team from candidates
      const secondaryTeamCandidates = this.teamStacks
        .filter(stack => stack.team !== primaryTeam)
        .slice(0, 3); // Top 3 remaining teams
      
      // Randomly select from top candidates with bias toward higher stack+
      const totalStackPlus = secondaryTeamCandidates.reduce((sum, team) => sum + team.stackPlus, 0);
      let randVal = Math.random() * totalStackPlus;
      
      for (const team of secondaryTeamCandidates) {
        randVal -= team.stackPlus;
        if (randVal <= 0) {
          secondaryTeam = team.team;
          break;
        }
      }
      
      // Fallback
      if (!secondaryTeam) {
        secondaryTeam = secondaryTeamCandidates[0]?.team;
      }
    }
    
    return {
      primaryTeam: primaryTeam,
      secondaryTeam: secondaryTeam,
      structure: "4-3", // Standard 4-3 stack
      useGameCorrelation: useOpponent
    };
  }
  
  // Select optimal captain based on optimization target
  selectOptimalCaptain(team, weights) {
    // Get all players from the team (excluding TEAM position)
    const teamPlayers = [
      ...this.playerPools.ADC.filter(p => p.team === team),
      ...this.playerPools.MID.filter(p => p.team === team),
      ...this.playerPools.JNG.filter(p => p.team === team),
      ...this.playerPools.TOP.filter(p => p.team === team),
      ...this.playerPools.SUP.filter(p => p.team === team)
    ];
    
    // Score each potential captain
    const captainScores = {};
    
    teamPlayers.forEach(player => {
      // Calculate player score based on weighted factors
      const ceilingScore = player.ceiling / 200; // Normalize ceiling
      const valueScore = (player.median / player.salary) * 1000; // Points per $1000
      const leverageScore = player.leverage / 10; // Normalize leverage
      
      // Position adjustment (higher ceiling positions = better captains)
      const positionFactor = 
        player.position === "ADC" ? 1.2 :
        player.position === "MID" ? 1.15 :
        player.position === "JNG" ? 1.1 :
        player.position === "TOP" ? 0.9 :
        player.position === "SUP" ? 0.7 : 1.0;
      
      // Calculate weighted score based on optimization target
      captainScores[player.name] = (
        (ceilingScore * weights.ceilingWeight * positionFactor) +
        (valueScore * weights.valueWeight) +
        (leverageScore * weights.leverageWeight)
      );
    });
    
    // Select captain based on highest score
    const captainName = Object.entries(captainScores)
      .sort((a, b) => b[1] - a[1])[0][0];
    
    // Find the selected captain's details
    const captain = teamPlayers.find(p => p.name === captainName);
    
    // Format captain object for the lineup
    return {
      name: captain.name,
      position: captain.position,
      team: captain.team,
      salary: Math.round(captain.salary * 1.5) // CPT costs 1.5x
    };
  }
  
  // Fill primary stack (3 more players from primary team)
  fillPrimaryStack(team, captain, count) {
    // Get all players from the team
    const teamPlayers = [
      ...this.playerPools.ADC.filter(p => p.team === team),
      ...this.playerPools.MID.filter(p => p.team === team),
      ...this.playerPools.JNG.filter(p => p.team === team),
      ...this.playerPools.TOP.filter(p => p.team === team),
      ...this.playerPools.SUP.filter(p => p.team === team),
      ...this.playerPools.TEAM.filter(p => p.team === team)
    ];
    
    // Remove captain from candidates
    const candidates = teamPlayers.filter(p => p.name !== captain.name);
    
    // Prioritize position correlations
    const correlationPriorities = {
      "MID": captain.position === "JNG" ? 5 : 1,
      "JNG": captain.position === "MID" ? 5 : 1,
      "ADC": captain.position === "SUP" ? 5 : 1,
      "SUP": captain.position === "ADC" ? 5 : 1,
      "TOP": captain.position === "JNG" ? 3 : 1,
      "TEAM": 0.5 // Lower priority for TEAM
    };
    
    // Score each candidate
    candidates.forEach(player => {
      player.stackScore = (
        (player.median * 0.7) + // Base value from projection
        (player.median * 0.3 * (correlationPriorities[player.position] || 1)) // Correlation bonus
      );
    });
    
    // Sort by stack score (descending)
    candidates.sort((a, b) => b.stackScore - a.stackScore);
    
    // Select top players, but ensure we have a TEAM
    const selectedPlayers = [];
    const hasTeam = candidates.slice(0, count).some(p => p.position === "TEAM");
    
    if (hasTeam) {
      // If we naturally have a TEAM in top players, just take top count
      selectedPlayers.push(...candidates.slice(0, count));
    } else {
      // If no TEAM in top players, force include team and take top count-1
      const teamPlayer = candidates.find(p => p.position === "TEAM");
      if (teamPlayer) {
        selectedPlayers.push(teamPlayer);
        selectedPlayers.push(...candidates.filter(p => p !== teamPlayer).slice(0, count - 1));
      } else {
        // If no TEAM player found, just take top count
        selectedPlayers.push(...candidates.slice(0, count));
      }
    }
    
    // Format players for the lineup
    return selectedPlayers.map(player => ({
      name: player.name,
      position: player.position,
      team: player.team,
      salary: player.salary
    }));
  }
  
  // Fill secondary stack (players from secondary team)
  fillSecondaryStack(team, maxCount) {
    // Get all players from the team
    const teamPlayers = [
      ...this.playerPools.ADC.filter(p => p.team === team),
      ...this.playerPools.MID.filter(p => p.team === team),
      ...this.playerPools.JNG.filter(p => p.team === team),
      ...this.playerPools.TOP.filter(p => p.team === team),
      ...this.playerPools.SUP.filter(p => p.team === team),
      ...this.playerPools.TEAM.filter(p => p.team === team)
    ];
    
    // Score each player
    teamPlayers.forEach(player => {
      player.stackScore = player.median; // Simple scoring for secondary stack
    });
    
    // Sort by stack score (descending)
    teamPlayers.sort((a, b) => b.stackScore - a.stackScore);
    
    // Select top players
    const selectedPlayers = teamPlayers.slice(0, maxCount);
    
    // Format players for the lineup
    return selectedPlayers.map(player => ({
      name: player.name,
      position: player.position,
      team: player.team,
      salary: player.salary
    }));
  }
  
  // Finalize lineup with adjustments for constraints
  finalizeLineup(draft) {
    const lineup = {
      cpt: draft.captain,
      players: []
    };
    
    // Check if we have all required positions
    const requiredPositions = new Set(["ADC", "MID", "JNG", "TOP", "SUP", "TEAM"]);
    const draftedPositions = new Set();
    
    // Add captain position
    draftedPositions.add(draft.captain.position);
    
    // Add primary and secondary player positions
    [...draft.primaryPlayers, ...draft.secondaryPlayers].forEach(player => {
      draftedPositions.add(player.position);
      lineup.players.push(player);
    });
    
    // Find missing positions
    const missingPositions = [...requiredPositions].filter(pos => !draftedPositions.has(pos));
    
    // If missing positions, remove flexible players and add required positions
    if (missingPositions.length > 0) {
      // Sort current players by replaceability (median / ownership)
      const replaceabilityScores = {};
      
      lineup.players.forEach(player => {
        const playerInfo = this.playerProjections[player.name];
        if (playerInfo) {
          replaceabilityScores[player.name] = (playerInfo.median || 10) / (playerInfo.ownership || 10);
        } else {
          replaceabilityScores[player.name] = 1; // Default score
        }
      });
      
      // Sort players by replaceability (ascending)
      lineup.players.sort((a, b) => replaceabilityScores[a.name] - replaceabilityScores[b.name]);
      
      // Remove players to make room for missing positions
      const playersToRemove = missingPositions.length;
      const removedPlayers = lineup.players.splice(0, playersToRemove);
      
      // Add players for missing positions
      missingPositions.forEach(pos => {
        // Get top player for this position that isn't already in lineup
        const existingPlayers = new Set([
          draft.captain.name,
          ...lineup.players.map(p => p.name)
        ]);
        
        const candidatesForPosition = this.playerPools[pos].filter(p => !existingPlayers.has(p.name));
        
        if (candidatesForPosition.length > 0) {
          const topPlayer = candidatesForPosition[0];
          
          lineup.players.push({
            name: topPlayer.name,
            position: topPlayer.position,
            team: topPlayer.team,
            salary: topPlayer.salary
          });
        }
      });
    }
    
    // Calculate total salary
    const totalSalary = lineup.cpt.salary + lineup.players.reduce((sum, player) => sum + player.salary, 0);
    
    // If over salary cap, adjust
    if (totalSalary > 50000) {
      this.adjustForSalaryCap(lineup);
    }
    
    // Sort players for display
    lineup.players.sort((a, b) => {
      const posOrder = {"TOP": 0, "JNG": 1, "MID": 2, "ADC": 3, "SUP": 4, "TEAM": 5};
      return posOrder[a.position] - posOrder[b.position];
    });
    
    return lineup;
  }
  
  // Adjust lineup to meet salary cap
  adjustForSalaryCap(lineup) {
    // Calculate how much we need to save
    const currentSalary = lineup.cpt.salary + lineup.players.reduce((sum, player) => sum + player.salary, 0);
    const targetSavings = currentSalary - 50000;
    
    if (targetSavings <= 0) return; // Already under cap
    
    // Calculate value ratio for each player
    lineup.players.forEach(player => {
      const playerInfo = this.playerProjections[player.name];
      if (playerInfo) {
        player.valueRatio = (playerInfo.median || 10) / player.salary;
      } else {
        player.valueRatio = 0.01; // Low default value
      }
    });
    
    // Sort by value ratio (ascending) - replace lowest value players first
    lineup.players.sort((a, b) => a.valueRatio - b.valueRatio);
    
    let savedSoFar = 0;
    
    // Try to replace players until we save enough
    for (let i = 0; i < lineup.players.length && savedSoFar < targetSavings; i++) {
      const currentPlayer = lineup.players[i];
      
      // Find cheaper replacement with same position
      const replacementCandidates = this.playerPools[currentPlayer.position]
        .filter(p => {
          // Must be cheaper
          const savings = currentPlayer.salary - p.salary;
          
          // Must not already be in lineup
          const inLineup = [lineup.cpt.name, ...lineup.players.map(p => p.name)].includes(p.name);
          
          return savings > 0 && !inLineup;
        })
        .sort((a, b) => b.median - a.median); // Sort by projection (descending)
      
      if (replacementCandidates.length > 0) {
        const replacement = replacementCandidates[0];
        savedSoFar += (currentPlayer.salary - replacement.salary);
        
        // Replace the player
        lineup.players[i] = {
          name: replacement.name,
          position: replacement.position,
          team: replacement.team,
          salary: replacement.salary
        };
      }
    }
    
    // If we still haven't saved enough, try replacing captain
    if (savedSoFar < targetSavings) {
      const captainInfo = this.playerProjections[lineup.cpt.name];
      if (captainInfo) {
        // Find cheaper captain replacement
        const captainCandidates = this.playerPools[captainInfo.position]
          .filter(p => {
            // Must be cheaper
            const savings = lineup.cpt.salary - Math.round(p.salary * 1.5);
            
            // Must not already be in lineup
            const inLineup = lineup.players.map(p => p.name).includes(p.name);
            
            return savings > 0 && !inLineup;
          })
          .sort((a, b) => b.ceiling - a.ceiling); // Sort by ceiling (descending)
        
        if (captainCandidates.length > 0) {
          const replacement = captainCandidates[0];
          const newSalary = Math.round(replacement.salary * 1.5);
          savedSoFar += (lineup.cpt.salary - newSalary);
          
          // Replace the captain
          lineup.cpt = {
            name: replacement.name,
            position: replacement.position,
            team: replacement.team,
            salary: newSalary
          };
        }
      }
    }
    
    // Remove valueRatio property as it's no longer needed
    lineup.players.forEach(player => {
      delete player.valueRatio;
    });
  }
  
  // Calculate uniqueness vs existing lineups
  calculateLineupUniqueness(lineup) {
    if (this.existingLineups.length === 0) return 10; // Max uniqueness if no existing lineups
    
    const newPlayers = new Set([lineup.cpt.name, ...lineup.players.map(p => p.name)]);
    
    // Calculate similarity to each existing lineup
    const similarities = this.existingLineups.map(existing => {
      const existingPlayers = new Set([existing.cpt.name, ...existing.players.map(p => p.name)]);
      
      // Count shared players
      let sharedCount = 0;
      newPlayers.forEach(player => {
        if (existingPlayers.has(player)) sharedCount++;
      });
      
      // Calculate similarity (0-1)
      return sharedCount / 7; // 7 players total
    });
    
    // Average similarity
    const avgSimilarity = similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length;
    
    // Uniqueness score (0-10)
    return (1 - avgSimilarity) * 10;
  }
  
  // Calculate projected score for the lineup
  calculateProjectedScore(lineup) {
    let totalProj = 0;
    
    // Captain projection (1.5x)
    const cptInfo = this.playerProjections[lineup.cpt.name];
    if (cptInfo) {
      totalProj += cptInfo.median * 1.5;
    }
    
    // Regular players
    lineup.players.forEach(player => {
      const playerInfo = this.playerProjections[player.name];
      if (playerInfo) {
        totalProj += playerInfo.median;
      }
    });
    
    return totalProj;
  }
  
  // Generate multiple optimized lineups
  generateMultipleLineups(count, targetDistribution = {}) {
    const lineups = [];
    
    // Default distribution if not specified
    const distribution = targetDistribution.balanced ? targetDistribution : {
      balanced: 0.4,    // 40%
      firstPlace: 0.3,  // 30%
      cashGame: 0.1,    // 10%
      contrarian: 0.2   // 20%
    };
    
    // Convert distribution to counts
    const targetCounts = {
      balanced: Math.round(count * distribution.balanced),
      firstPlace: Math.round(count * distribution.firstPlace),
      cashGame: Math.round(count * distribution.cashGame),
      contrarian: Math.round(count * distribution.contrarian)
    };
    
    // Adjust to ensure we generate exactly the requested count
    let totalTargeted = Object.values(targetCounts).reduce((sum, c) => sum + c, 0);
    while (totalTargeted < count) {
      // Add extra lineups to balanced category
      targetCounts.balanced++;
      totalTargeted++;
    }
    while (totalTargeted > count) {
      // Remove from lowest priority category with count > 0
      for (const target of ['contrarian', 'cashGame', 'firstPlace', 'balanced']) {
        if (targetCounts[target] > 0) {
          targetCounts[target]--;
          totalTargeted--;
          break;
        }
      }
    }
    
    // Generate lineups for each target type
    for (const [target, targetCount] of Object.entries(targetCounts)) {
      for (let i = 0; i < targetCount; i++) {
        const existingLineups = [...this.existingLineups, ...lineups.map(l => l.lineup)];
        const result = this.generateOptimalLineup(target);
        
        // Check uniqueness vs all lineups (existing + already generated)
        const uniqueness = this.calculateUniquenessWithAllLineups(result.lineup, existingLineups);
        
        // Only add if unique enough
        if (uniqueness >= 3) { // Minimum uniqueness threshold (0-10 scale)
          result.uniquenessScore = uniqueness;
          lineups.push(result);
        } else {
          // If not unique enough, try again with different target (more contrarian)
          const retryResult = this.generateOptimalLineup('contrarian');
          retryResult.uniquenessScore = this.calculateUniquenessWithAllLineups(
            retryResult.lineup, existingLineups
          );
          lineups.push(retryResult);
        }
      }
    }
    
    // Sort by projected score
    lineups.sort((a, b) => b.projectedScore - a.projectedScore);
    
    return lineups;
  }
  
  // Calculate uniqueness with all lineups (existing + new)
  calculateUniquenessWithAllLineups(lineup, allLineups) {
    if (allLineups.length === 0) return 10; // Max uniqueness if no other lineups
    
    const newPlayers = new Set([lineup.cpt.name, ...lineup.players.map(p => p.name)]);
    
    // Calculate similarity to each lineup
    const similarities = allLineups.map(existing => {
      const existingPlayers = new Set([existing.cpt.name, ...existing.players.map(p => p.name)]);
      
      // Count shared players
      let sharedCount = 0;
      newPlayers.forEach(player => {
        if (existingPlayers.has(player)) sharedCount++;
      });
      
      // Calculate similarity (0-1)
      return sharedCount / 7; // 7 players total
    });
    
    // Average similarity
    const avgSimilarity = similarities.reduce((sum, sim) => sum + sim, 0) / similarities.length;
    
    // Uniqueness score (0-10)
    return (1 - avgSimilarity) * 10;
  }
  
  // Generate lineups for a full tournament portfolio
  generateTournamentPortfolio(totalEntries, budget = null) {
    // Default distribution for different contest types
    const distribution = {
      balanced: 0.5,    // 50% balanced
      firstPlace: 0.3,  // 30% first place focus
      cashGame: 0.0,    // 0% cash game (not relevant for tournaments)
      contrarian: 0.2   // 20% contrarian
    };
    
    // Calculate how many lineups to generate
    let lineupsToGenerate = totalEntries;
    
    // If budget constraint, calculate max entries based on budget
    if (budget !== null) {
      const entryFee = 5; // Assume $5 entry fee
      const maxEntriesFromBudget = Math.floor(budget / entryFee);
      lineupsToGenerate = Math.min(lineupsToGenerate, maxEntriesFromBudget);
    }
    
    // Generate the lineups
    return this.generateMultipleLineups(lineupsToGenerate, distribution);
  }
  
  // Save generated lineups to file
  saveLineupsToFile(lineups, filepath) {
    const jsonData = JSON.stringify(lineups, null, 2);
    fs.writeFileSync(filepath, jsonData);
    return filepath;
  }
}

module.exports = OptimalLineupGenerator;
