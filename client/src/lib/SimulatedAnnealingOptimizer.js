/**
 * Simulated Annealing Optimizer for LoL DFS
 * 
 * Uses physics-inspired cooling process to find optimal lineups:
 * - Starts with high "temperature" accepting bad moves
 * - Gradually "cools" to focus on improvements only  
 * - Escapes local optima through controlled randomness
 * - Systematic neighborhood exploration
 * 
 * Best for: Complex constraint satisfaction, exposure balancing, fine-tuning
 */

const AdvancedOptimizer = require('./AdvancedOptimizer');

class SimulatedAnnealingOptimizer extends AdvancedOptimizer {
  constructor(config = {}) {
    super(config);
    
    // Simulated annealing specific configuration
    this.annealingConfig = {
      initialTemperature: 1000,     // Starting temperature
      finalTemperature: 0.1,       // Ending temperature  
      coolingRate: 0.95,           // Temperature reduction factor
      maxIterations: 10000,        // Maximum iterations
      maxStagnation: 500,          // Iterations without improvement before reheat
      reheatFactor: 2.0,           // Temperature multiplier for reheating
      neighborhoodSize: 5,         // Number of neighbors to try per iteration
      acceptanceThreshold: 0.01,   // Minimum acceptance probability
      ...config.annealing
    };

    // Annealing state tracking
    this.currentTemperature = this.annealingConfig.initialTemperature;
    this.currentIteration = 0;
    this.bestSolution = null;
    this.bestScore = -Infinity;
    this.currentSolution = null;
    this.currentScore = 0;
    this.stagnationCount = 0;
    this.temperatureHistory = [];
    this.scoreHistory = [];
    this.acceptanceHistory = [];
  }

  /**
   * Main simulated annealing entry point
   */
  async runSimulatedAnnealing(count = 100) {
    if (!this.optimizerReady) {
      throw new Error("Optimizer not initialized. Call initialize() first.");
    }

    this.resetCancel();
    this.updateStatus("Starting simulated annealing optimization...");
    this.updateProgress(0, "initializing_annealing");
    this.debugLog(`Running simulated annealing for ${count} lineups...`);

    try {
      const solutions = [];
      
      // Run multiple annealing processes for diversity
      const parallelRuns = Math.min(count, 10); // Max 10 parallel runs
      const lineupsPerRun = Math.ceil(count / parallelRuns);
      
      for (let run = 0; run < parallelRuns; run++) {
        if (this.isCancelled) throw new Error("Simulated annealing cancelled");
        
        this.updateStatus(`Annealing run ${run + 1}/${parallelRuns}...`);
        
        // Reset for new run
        this._resetAnnealingState();
        
        // Phase 1: Generate initial solution (10% of run progress)
        const initialSolution = await this._generateInitialSolution();
        this.currentSolution = initialSolution;
        this.currentScore = await this._evaluateLineup(initialSolution);
        this.bestSolution = { ...initialSolution };
        this.bestScore = this.currentScore;
        
        const runProgressStart = (run / parallelRuns) * 80;
        this.updateProgress(runProgressStart + 2, "initial_solution");
        
        // Phase 2: Annealing process (80% of run progress)
        await this._performAnnealing(runProgressStart + 2, runProgressStart + 16);
        
        // Phase 3: Generate multiple solutions from best (10% of run progress)
        const runSolutions = await this._generateVariationsFromBest(lineupsPerRun);
        solutions.push(...runSolutions);
        
        this.updateProgress(runProgressStart + 18, `run_${run}_completed`);
        await this.yieldToUI();
      }
      
      // Final phase: Simulate and rank all solutions (20% of total progress)
      this.updateStatus("Running final simulation on all solutions...");
      this.updateProgress(80, "final_simulation");
      
      const simulatedResults = [];
      for (let i = 0; i < Math.min(solutions.length, count); i++) {
        if (this.isCancelled) throw new Error("Simulated annealing cancelled");
        
        const result = await this._simulateLineup(solutions[i]);
        simulatedResults.push(result);
        
        const simProgress = 80 + ((i + 1) / Math.min(solutions.length, count)) * 20;
        this.updateProgress(simProgress, "final_simulation");
      }
      
      // Calculate NexusScores and final ranking
      simulatedResults.forEach(result => {
        const nexusResult = this._calculateNexusScore(result);
        result.nexusScore = nexusResult.score;
        result.scoreComponents = nexusResult.components;
        result.roi = (result.nexusScore / 100) * 200 - 50;
      });
      
      // Sort by combined annealing score and simulation results
      simulatedResults.sort((a, b) => {
        const aScore = a.nexusScore * 0.6 + (a.annealingScore || 0) * 0.4;
        const bScore = b.nexusScore * 0.6 + (b.annealingScore || 0) * 0.4;
        return bScore - aScore;
      });
      
      this.updateProgress(100, "completed");
      this.updateStatus(`Simulated annealing completed: ${simulatedResults.length} lineups`);
      
      return {
        lineups: simulatedResults.slice(0, count),
        summary: this._getAnnealingSummary(simulatedResults),
        annealing: {
          iterations: this.currentIteration,
          temperatureHistory: this.temperatureHistory,
          scoreHistory: this.scoreHistory,
          acceptanceRate: this._calculateAcceptanceRate(),
          convergenceEfficiency: this._calculateConvergenceEfficiency()
        }
      };
      
    } catch (error) {
      this.updateStatus(`Error: ${error.message}`);
      this.updateProgress(100, "error");
      this.debugLog(`Simulated annealing error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Reset annealing state for new run
   */
  _resetAnnealingState() {
    this.currentTemperature = this.annealingConfig.initialTemperature;
    this.currentIteration = 0;
    this.bestSolution = null;
    this.bestScore = -Infinity;
    this.currentSolution = null;
    this.currentScore = 0;
    this.stagnationCount = 0;
    this.temperatureHistory = [];
    this.scoreHistory = [];
    this.acceptanceHistory = [];
  }

  /**
   * Generate initial solution using existing lineup generation
   */
  async _generateInitialSolution() {
    // Use current optimizer to generate a good starting lineup
    const lineup = await this._buildLineup([]);
    return lineup;
  }

  /**
   * Main annealing loop
   */
  async _performAnnealing(progressStart, progressEnd) {
    const maxIterations = this.annealingConfig.maxIterations;
    const progressRange = progressEnd - progressStart;
    
    while (this.currentIteration < maxIterations && 
           this.currentTemperature > this.annealingConfig.finalTemperature) {
      
      if (this.isCancelled) throw new Error("Annealing process cancelled");
      
      // Generate and evaluate neighbors
      const neighbors = await this._generateNeighbors(this.currentSolution);
      let bestNeighbor = null;
      let bestNeighborScore = -Infinity;
      
      for (const neighbor of neighbors) {
        const score = await this._evaluateLineup(neighbor);
        if (score > bestNeighborScore) {
          bestNeighbor = neighbor;
          bestNeighborScore = score;
        }
      }
      
      if (bestNeighbor) {
        // Decide whether to accept the neighbor
        const accepted = this._acceptanceCriterion(
          this.currentScore, 
          bestNeighborScore, 
          this.currentTemperature
        );
        
        this.acceptanceHistory.push({
          iteration: this.currentIteration,
          oldScore: this.currentScore,
          newScore: bestNeighborScore,
          temperature: this.currentTemperature,
          accepted
        });
        
        if (accepted) {
          this.currentSolution = bestNeighbor;
          this.currentScore = bestNeighborScore;
          
          // Update best solution if this is better
          if (bestNeighborScore > this.bestScore) {
            this.bestSolution = { ...bestNeighbor };
            this.bestScore = bestNeighborScore;
            this.stagnationCount = 0;
          } else {
            this.stagnationCount++;
          }
        } else {
          this.stagnationCount++;
        }
      }
      
      // Check for stagnation and reheat if necessary
      if (this.stagnationCount >= this.annealingConfig.maxStagnation) {
        this.currentTemperature *= this.annealingConfig.reheatFactor;
        this.stagnationCount = 0;
        this.debugLog(`Reheating temperature to ${this.currentTemperature} at iteration ${this.currentIteration}`);
      }
      
      // Cool down
      this.currentTemperature *= this.annealingConfig.coolingRate;
      this.currentIteration++;
      
      // Record history
      this.temperatureHistory.push({
        iteration: this.currentIteration,
        temperature: this.currentTemperature,
        currentScore: this.currentScore,
        bestScore: this.bestScore
      });
      
      this.scoreHistory.push({
        iteration: this.currentIteration,
        score: this.currentScore,
        bestScore: this.bestScore
      });
      
      // Update progress occasionally
      if (this.currentIteration % 100 === 0) {
        const iterationProgress = (this.currentIteration / maxIterations) * progressRange;
        this.updateProgress(progressStart + iterationProgress, "annealing");
        this.updateStatus(`Annealing: T=${this.currentTemperature.toFixed(1)}, Best=${this.bestScore.toFixed(1)}`);
        await this.yieldToUI();
      }
    }
    
    this.debugLog(`Annealing completed after ${this.currentIteration} iterations`);
  }

  /**
   * Generate neighbor solutions
   */
  async _generateNeighbors(solution) {
    const neighbors = [];
    const neighborhoodSize = this.annealingConfig.neighborhoodSize;
    
    for (let i = 0; i < neighborhoodSize; i++) {
      try {
        const neighbor = await this._generateSingleNeighbor(solution);
        if (neighbor && this._isValidLineup(neighbor, [])) {
          neighbors.push(neighbor);
        }
      } catch (error) {
        // Skip failed neighbor generation
        continue;
      }
    }
    
    return neighbors;
  }

  /**
   * Generate a single neighbor by making small changes
   */
  async _generateSingleNeighbor(solution) {
    const neighbor = JSON.parse(JSON.stringify(solution)); // Deep copy
    
    // Choose type of neighborhood move
    const moveTypes = [
      'swap_player',
      'swap_captain', 
      'change_stack',
      'optimize_salary',
      'balance_exposure'
    ];
    
    const moveType = moveTypes[Math.floor(Math.random() * moveTypes.length)];
    
    switch (moveType) {
      case 'swap_player':
        await this._neighborSwapPlayer(neighbor);
        break;
      case 'swap_captain':
        await this._neighborSwapCaptain(neighbor);
        break;
      case 'change_stack':
        await this._neighborChangeStack(neighbor);
        break;
      case 'optimize_salary':
        await this._neighborOptimizeSalary(neighbor);
        break;
      case 'balance_exposure':
        await this._neighborBalanceExposure(neighbor);
        break;
    }
    
    return neighbor;
  }

  /**
   * Neighbor move: swap one player with better alternative
   */
  async _neighborSwapPlayer(lineup) {
    const positions = lineup.players.map(p => p.position);
    const randomPosition = positions[Math.floor(Math.random() * positions.length)];
    
    // Find current player in that position
    const currentPlayer = lineup.players.find(p => p.position === randomPosition);
    if (!currentPlayer) return;
    
    // Find better alternatives
    const usedIds = new Set([lineup.cpt.id, ...lineup.players.map(p => p.id)]);
    const alternatives = this.playerPool.filter(player => 
      player.position === randomPosition &&
      !usedIds.has(player.id) &&
      this._safeParseFloat(player.projectedPoints, 0) >= 
        this._safeParseFloat(currentPlayer.projectedPoints || 0, 0) * 0.8 // At least 80% of current projection
    );
    
    if (alternatives.length > 0) {
      // Weight alternatives by projection advantage
      const weights = alternatives.map(alt => {
        const currentProj = this._safeParseFloat(currentPlayer.projectedPoints || 0, 0);
        const altProj = this._safeParseFloat(alt.projectedPoints, 0);
        return Math.max(0.1, altProj - currentProj + 5); // +5 base weight
      });
      
      const selectedAlt = this._weightedRandom(alternatives, weights);
      
      if (selectedAlt) {
        const playerIndex = lineup.players.findIndex(p => p.position === randomPosition);
        lineup.players[playerIndex] = {
          id: selectedAlt.id,
          name: selectedAlt.name,
          position: selectedAlt.position,
          team: selectedAlt.team,
          opponent: this._getTeamOpponent(selectedAlt.team),
          salary: this._safeParseFloat(selectedAlt.salary, 0)
        };
      }
    }
  }

  /**
   * Neighbor move: swap captain with high-ceiling player
   */
  async _neighborSwapCaptain(lineup) {
    const captainEligible = lineup.players.filter(p => 
      ['TOP', 'MID', 'ADC', 'JNG'].includes(p.position)
    );
    
    if (captainEligible.length > 0) {
      // Find player with highest ceiling potential
      const bestCandidate = captainEligible.reduce((best, player) => {
        const playerData = this.playerPool.find(p => p.id === player.id);
        const bestData = this.playerPool.find(p => p.id === best.id);
        
        if (!playerData || !bestData) return best;
        
        const playerCeiling = this._safeParseFloat(playerData.projectedPoints, 0) * 1.5; // Captain multiplier
        const bestCeiling = this._safeParseFloat(bestData.projectedPoints, 0) * 1.5;
        
        return playerCeiling > bestCeiling ? player : best;
      });
      
      if (bestCandidate) {
        const oldCaptain = lineup.cpt;
        
        // Make the player captain
        lineup.cpt = {
          id: bestCandidate.id,
          name: bestCandidate.name,
          position: 'CPT',
          team: bestCandidate.team,
          opponent: this._getTeamOpponent(bestCandidate.team),
          salary: Math.round(bestCandidate.salary * 1.5)
        };
        
        // Replace the player with old captain
        const playerIndex = lineup.players.findIndex(p => p.id === bestCandidate.id);
        const originalPlayer = this.playerPool.find(p => p.id === bestCandidate.id);
        
        lineup.players[playerIndex] = {
          id: oldCaptain.id,
          name: oldCaptain.name,
          position: originalPlayer ? originalPlayer.position : bestCandidate.position,
          team: oldCaptain.team,
          opponent: this._getTeamOpponent(oldCaptain.team),
          salary: Math.round(oldCaptain.salary / 1.5)
        };
      }
    }
  }

  /**
   * Neighbor move: optimize team stacking
   */
  async _neighborChangeStack(lineup) {
    // Count current team distribution
    const teamCounts = {};
    [lineup.cpt, ...lineup.players].forEach(player => {
      if (player.team) {
        teamCounts[player.team] = (teamCounts[player.team] || 0) + 1;
      }
    });
    
    // Find teams with potential for better stacking
    const stackableTeams = Object.entries(teamCounts)
      .filter(([team, count]) => count >= 2 && count <= 4)
      .map(([team]) => team);
    
    if (stackableTeams.length > 0) {
      const targetTeam = stackableTeams[Math.floor(Math.random() * stackableTeams.length)];
      
      // Try to replace a non-stack player with a stack player
      const nonStackPlayers = lineup.players.filter(p => p.team !== targetTeam);
      const stackCandidates = this.playerPool.filter(player => 
        player.team === targetTeam &&
        player.id !== lineup.cpt.id &&
        !lineup.players.some(p => p.id === player.id)
      );
      
      if (nonStackPlayers.length > 0 && stackCandidates.length > 0) {
        const targetPlayer = nonStackPlayers[Math.floor(Math.random() * nonStackPlayers.length)];
        const replacement = stackCandidates.find(p => p.position === targetPlayer.position);
        
        if (replacement) {
          const playerIndex = lineup.players.findIndex(p => p.id === targetPlayer.id);
          lineup.players[playerIndex] = {
            id: replacement.id,
            name: replacement.name,
            position: replacement.position,
            team: replacement.team,
            opponent: this._getTeamOpponent(replacement.team),
            salary: this._safeParseFloat(replacement.salary, 0)
          };
        }
      }
    }
  }

  /**
   * Neighbor move: optimize salary usage
   */
  async _neighborOptimizeSalary(lineup) {
    // Calculate current salary usage
    const currentSalary = lineup.cpt.salary + 
      lineup.players.reduce((sum, p) => sum + (p.salary || 0), 0);
    const remainingSalary = this.config.salaryCap - currentSalary;
    
    if (remainingSalary > 1000) {
      // Try to upgrade a player with remaining salary
      const upgradeablePositions = lineup.players.filter(player => {
        const upgrades = this.playerPool.filter(p => 
          p.position === player.position &&
          p.id !== player.id &&
          p.id !== lineup.cpt.id &&
          !lineup.players.some(lp => lp.id === p.id) &&
          this._safeParseFloat(p.salary, 0) > (player.salary || 0) &&
          this._safeParseFloat(p.salary, 0) - (player.salary || 0) <= remainingSalary
        );
        return upgrades.length > 0;
      });
      
      if (upgradeablePositions.length > 0) {
        const targetPlayer = upgradeablePositions[Math.floor(Math.random() * upgradeablePositions.length)];
        const upgrades = this.playerPool.filter(p => 
          p.position === targetPlayer.position &&
          p.id !== targetPlayer.id &&
          p.id !== lineup.cpt.id &&
          !lineup.players.some(lp => lp.id === p.id) &&
          this._safeParseFloat(p.salary, 0) > (targetPlayer.salary || 0) &&
          this._safeParseFloat(p.salary, 0) - (targetPlayer.salary || 0) <= remainingSalary
        );
        
        // Choose best upgrade by value
        const bestUpgrade = upgrades.reduce((best, upgrade) => {
          const upgradeValue = this._safeParseFloat(upgrade.projectedPoints, 0) / 
            Math.max(1, this._safeParseFloat(upgrade.salary, 1) / 1000);
          const bestValue = this._safeParseFloat(best.projectedPoints, 0) / 
            Math.max(1, this._safeParseFloat(best.salary, 1) / 1000);
          return upgradeValue > bestValue ? upgrade : best;
        });
        
        if (bestUpgrade) {
          const playerIndex = lineup.players.findIndex(p => p.id === targetPlayer.id);
          lineup.players[playerIndex] = {
            id: bestUpgrade.id,
            name: bestUpgrade.name,
            position: bestUpgrade.position,
            team: bestUpgrade.team,
            opponent: this._getTeamOpponent(bestUpgrade.team),
            salary: this._safeParseFloat(bestUpgrade.salary, 0)
          };
        }
      }
    }
  }

  /**
   * Neighbor move: balance exposure constraints
   */
  async _neighborBalanceExposure(lineup) {
    // Find players that are over their max exposure
    const overexposedPlayers = [];
    const underexposedPlayers = [];
    
    [lineup.cpt, ...lineup.players].forEach(player => {
      const exposure = this.playerExposures.find(pe => pe.id === player.id);
      if (exposure) {
        const totalLineups = this.generatedLineups.length + this.existingLineups.length;
        const playerCount = this.exposureTracking.players.get(player.id) || 0;
        const currentExposure = totalLineups > 0 ? playerCount / totalLineups : 0;
        
        if (exposure.max < 1 && currentExposure > exposure.max) {
          overexposedPlayers.push({ player, currentExposure, constraint: exposure });
        } else if (exposure.min > 0 && currentExposure < exposure.min) {
          underexposedPlayers.push({ player, currentExposure, constraint: exposure });
        }
      }
    });
    
    // Try to swap overexposed player with underexposed alternative
    if (overexposedPlayers.length > 0) {
      const overexposedPlayer = overexposedPlayers[Math.floor(Math.random() * overexposedPlayers.length)];
      
      // Find alternatives for this position
      const alternatives = this.playerPool.filter(p => 
        p.position === overexposedPlayer.player.position &&
        p.id !== lineup.cpt.id &&
        !lineup.players.some(lp => lp.id === p.id)
      );
      
      // Prefer underexposed alternatives
      const underexposedAlts = alternatives.filter(alt => {
        const altExposure = this.playerExposures.find(pe => pe.id === alt.id);
        if (!altExposure) return true; // No constraint = available
        
        const totalLineups = this.generatedLineups.length + this.existingLineups.length;
        const altCount = this.exposureTracking.players.get(alt.id) || 0;
        const altCurrentExposure = totalLineups > 0 ? altCount / totalLineups : 0;
        
        return altCurrentExposure < altExposure.max;
      });
      
      if (underexposedAlts.length > 0) {
        const replacement = underexposedAlts[Math.floor(Math.random() * underexposedAlts.length)];
        
        if (overexposedPlayer.player.position === 'CPT') {
          lineup.cpt = {
            id: replacement.id,
            name: replacement.name,
            position: 'CPT',
            team: replacement.team,
            opponent: this._getTeamOpponent(replacement.team),
            salary: Math.round(this._safeParseFloat(replacement.salary, 0) * 1.5)
          };
        } else {
          const playerIndex = lineup.players.findIndex(p => p.id === overexposedPlayer.player.id);
          lineup.players[playerIndex] = {
            id: replacement.id,
            name: replacement.name,
            position: replacement.position,
            team: replacement.team,
            opponent: this._getTeamOpponent(replacement.team),
            salary: this._safeParseFloat(replacement.salary, 0)
          };
        }
      }
    }
  }

  /**
   * Acceptance criterion for simulated annealing
   */
  _acceptanceCriterion(currentScore, newScore, temperature) {
    // Always accept improvements
    if (newScore > currentScore) {
      return true;
    }
    
    // Accept worse solutions with probability based on temperature
    const scoreDelta = newScore - currentScore;
    const acceptanceProbability = Math.exp(scoreDelta / temperature);
    
    // Don't accept if probability is too low
    if (acceptanceProbability < this.annealingConfig.acceptanceThreshold) {
      return false;
    }
    
    return Math.random() < acceptanceProbability;
  }

  /**
   * Evaluate lineup using annealing-specific scoring
   */
  async _evaluateLineup(lineup) {
    // Fast evaluation similar to genetic fitness but optimized for annealing
    let score = 0;
    
    // Base projection
    let totalProjection = 0;
    const cptPlayer = this.playerPool.find(p => p.id === lineup.cpt.id);
    if (cptPlayer) {
      totalProjection += this._safeParseFloat(cptPlayer.projectedPoints, 0) * 1.5;
    }
    
    lineup.players.forEach(player => {
      const poolPlayer = this.playerPool.find(p => p.id === player.id);
      if (poolPlayer) {
        totalProjection += this._safeParseFloat(poolPlayer.projectedPoints, 0);
      }
    });
    
    score += totalProjection * 10;
    
    // Constraint satisfaction bonus (weighted heavily for annealing)
    const constraintScore = this._calculateConstraintSatisfactionScore(lineup);
    score += constraintScore * 3; // 3x weight for constraints
    
    // Stack synergy
    const synergyScore = this._calculateStackSynergyScore(lineup);
    score += synergyScore;
    
    // Salary efficiency
    const salaryScore = this._calculateSalaryEfficiencyScore(lineup);
    score += salaryScore;
    
    // Store the score in the lineup for later use
    lineup.annealingScore = score;
    
    return score;
  }

  /**
   * Calculate constraint satisfaction score
   */
  _calculateConstraintSatisfactionScore(lineup) {
    let score = 0;
    const totalLineups = this.generatedLineups.length + this.existingLineups.length + 1;
    
    // Player exposure constraints
    [lineup.cpt, ...lineup.players].forEach(player => {
      const exposure = this.playerExposures.find(pe => pe.id === player.id);
      if (exposure) {
        const currentCount = this.exposureTracking.players.get(player.id) || 0;
        const projectedExposure = (currentCount + 1) / totalLineups;
        
        // Bonus for staying within constraints
        if (projectedExposure >= exposure.min && projectedExposure <= exposure.max) {
          score += 20;
        }
        
        // Penalty for violating constraints
        if (projectedExposure < exposure.min) {
          score -= (exposure.min - projectedExposure) * 50;
        }
        if (projectedExposure > exposure.max) {
          score -= (projectedExposure - exposure.max) * 100; // Higher penalty for max violations
        }
      }
    });
    
    return score;
  }

  /**
   * Calculate stack synergy score
   */
  _calculateStackSynergyScore(lineup) {
    const teamCounts = {};
    [lineup.cpt, ...lineup.players].forEach(player => {
      if (player.team) {
        teamCounts[player.team] = (teamCounts[player.team] || 0) + 1;
      }
    });
    
    let synergyScore = 0;
    Object.values(teamCounts).forEach(count => {
      if (count >= 3) {
        synergyScore += Math.pow(count - 2, 1.8) * 25; // Exponential bonus for larger stacks
      }
    });
    
    return synergyScore;
  }

  /**
   * Calculate salary efficiency score
   */
  _calculateSalaryEfficiencyScore(lineup) {
    const totalSalary = lineup.cpt.salary + 
      lineup.players.reduce((sum, p) => sum + (p.salary || 0), 0);
    const salaryUsage = totalSalary / this.config.salaryCap;
    
    // Bonus for using 95-100% of salary cap
    if (salaryUsage >= 0.95) {
      return (salaryUsage - 0.95) * 200; // Up to 10 point bonus
    } else if (salaryUsage >= 0.90) {
      return (salaryUsage - 0.90) * 100; // Up to 5 point bonus  
    } else {
      return -(0.90 - salaryUsage) * 50; // Penalty for underusing salary
    }
  }

  /**
   * Generate variations from best solution
   */
  async _generateVariationsFromBest(count) {
    const variations = [];
    
    if (!this.bestSolution) {
      return variations;
    }
    
    // Add the best solution itself
    variations.push({ ...this.bestSolution });
    
    // Generate variations by applying small modifications
    for (let i = 1; i < count; i++) {
      try {
        const variation = JSON.parse(JSON.stringify(this.bestSolution));
        
        // Apply 1-2 random modifications
        const modCount = Math.random() < 0.7 ? 1 : 2;
        for (let mod = 0; mod < modCount; mod++) {
          await this._generateSingleNeighbor(variation);
        }
        
        if (this._isValidLineup(variation, variations)) {
          variations.push(variation);
        }
      } catch (error) {
        // Skip failed variations
        continue;
      }
    }
    
    return variations;
  }

  /**
   * Calculate acceptance rate from history
   */
  _calculateAcceptanceRate() {
    if (this.acceptanceHistory.length === 0) return 0;
    
    const acceptedCount = this.acceptanceHistory.filter(h => h.accepted).length;
    return acceptedCount / this.acceptanceHistory.length;
  }

  /**
   * Calculate convergence efficiency
   */
  _calculateConvergenceEfficiency() {
    if (this.scoreHistory.length < 10) return 0;
    
    const initialScore = this.scoreHistory[0].bestScore;
    const finalScore = this.bestScore;
    const iterations = this.currentIteration;
    
    // Efficiency = improvement per iteration
    return iterations > 0 ? (finalScore - initialScore) / iterations : 0;
  }

  /**
   * Generate annealing summary
   */
  _getAnnealingSummary(results) {
    const baseSummary = this._getSimulationSummary();
    
    return {
      ...baseSummary,
      algorithm: 'simulated_annealing',
      iterations: this.currentIteration,
      finalTemperature: this.currentTemperature,
      bestAnnealingScore: this.bestScore,
      averageAnnealingScore: results.reduce((sum, r) => sum + (r.annealingScore || 0), 0) / results.length,
      acceptanceRate: this._calculateAcceptanceRate(),
      convergenceEfficiency: this._calculateConvergenceEfficiency(),
      temperatureDecay: this.annealingConfig.coolingRate
    };
  }
}

module.exports = SimulatedAnnealingOptimizer;