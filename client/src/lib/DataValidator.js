/**
 * Comprehensive Data Validation Layer for LoL DFS Optimizer
 * 
 * Validates player projections, team stacks, and lineup data for:
 * - DraftKings format compliance
 * - Mathematical consistency
 * - LoL-specific constraints
 * - Optimization algorithm compatibility
 */

class DataValidator {
  constructor(config = {}) {
    this.config = {
      // LoL DFS constraints
      salaryCap: 50000,
      minSalary: 3000,
      maxSalary: 11000,
      maxProjection: 80,
      minProjection: 0,
      maxOwnership: 100,
      minOwnership: 0,
      requiredPositions: ['TOP', 'JNG', 'MID', 'ADC', 'SUP'],
      optionalPositions: ['TEAM'],
      minTeamsRequired: 2,
      maxPlayersPerTeam: 4,
      ...config
    };

    this.validationResults = {
      isValid: false,
      errors: [],
      warnings: [],
      playerCount: 0,
      teamCount: 0,
      positionBreakdown: {},
      ownershipStats: {},
      projectionStats: {}
    };
  }

  /**
   * Validate complete player pool data
   */
  validatePlayerPool(players) {
    this.resetValidation();
    
    if (!Array.isArray(players) || players.length === 0) {
      this.addError('Player pool must be a non-empty array');
      return this.getResults();
    }

    // Basic structure validation
    this.validatePlayerStructures(players);
    
    // Position requirements validation
    this.validatePositions(players);
    
    // Team balance validation
    this.validateTeamBalance(players);
    
    // Salary validation
    this.validateSalaries(players);
    
    // Projection validation
    this.validateProjections(players);
    
    // Ownership validation
    this.validateOwnership(players);
    
    // Cross-validation checks
    this.validateCrossConsistency(players);
    
    // Calculate summary statistics
    this.calculateStats(players);
    
    this.validationResults.isValid = this.validationResults.errors.length === 0;
    return this.getResults();
  }

  /**
   * Validate team stacks data
   */
  validateTeamStacks(stacks, playerPool) {
    const results = {
      isValid: false,
      errors: [],
      warnings: [],
      stackCount: 0,
      teamsWithStacks: new Set()
    };

    if (!Array.isArray(stacks)) {
      results.errors.push('Team stacks must be an array');
      return results;
    }

    if (stacks.length === 0) {
      results.warnings.push('No team stacks provided - optimizer will create default stacks');
      results.isValid = true;
      return results;
    }

    // Get available teams from player pool
    const availableTeams = new Set(
      playerPool.filter(p => p.team).map(p => p.team)
    );

    stacks.forEach((stack, index) => {
      // Validate stack structure
      if (!stack.team) {
        results.errors.push(`Stack ${index}: Missing team name`);
        return;
      }

      // Check if team exists in player pool
      if (!availableTeams.has(stack.team)) {
        results.errors.push(`Stack ${index}: Team '${stack.team}' not found in player pool`);
        return;
      }

      // Validate stack positions
      if (stack.stack && Array.isArray(stack.stack)) {
        const invalidPositions = stack.stack.filter(
          pos => !this.config.requiredPositions.includes(pos) && 
                 !this.config.optionalPositions.includes(pos)
        );
        
        if (invalidPositions.length > 0) {
          results.errors.push(
            `Stack ${index}: Invalid positions [${invalidPositions.join(', ')}]`
          );
        }
      }

      // Validate stack+ value
      if (stack.stackPlus !== undefined) {
        const stackPlusNum = parseFloat(stack.stackPlus);
        if (isNaN(stackPlusNum) || stackPlusNum < -10 || stackPlusNum > 10) {
          results.warnings.push(
            `Stack ${index}: Unusual Stack+ value (${stack.stackPlus})`
          );
        }
      }

      results.teamsWithStacks.add(stack.team);
    });

    results.stackCount = stacks.length;
    results.isValid = results.errors.length === 0;
    return results;
  }

  /**
   * Validate individual lineup structure
   */
  validateLineup(lineup) {
    const errors = [];
    
    if (!lineup) {
      errors.push('Lineup is null or undefined');
      return { isValid: false, errors };
    }

    // Validate captain
    if (!lineup.cpt) {
      errors.push('Lineup missing captain');
    } else {
      if (!lineup.cpt.id || !lineup.cpt.name) {
        errors.push('Captain missing id or name');
      }
      if (lineup.cpt.position !== 'CPT') {
        errors.push('Captain position must be CPT');
      }
    }

    // Validate players array
    if (!Array.isArray(lineup.players)) {
      errors.push('Lineup players must be an array');
    } else {
      // Check position requirements
      const positions = lineup.players.map(p => p.position);
      const positionCounts = {};
      
      positions.forEach(pos => {
        positionCounts[pos] = (positionCounts[pos] || 0) + 1;
      });

      // Check required positions
      this.config.requiredPositions.forEach(pos => {
        if ((positionCounts[pos] || 0) !== 1) {
          errors.push(`Must have exactly 1 ${pos} player, found ${positionCounts[pos] || 0}`);
        }
      });

      // Check for duplicates
      const playerIds = [lineup.cpt?.id, ...lineup.players.map(p => p.id)].filter(Boolean);
      if (new Set(playerIds).size !== playerIds.length) {
        errors.push('Lineup contains duplicate players');
      }
    }

    return { isValid: errors.length === 0, errors };
  }

  // Private validation methods
  resetValidation() {
    this.validationResults = {
      isValid: false,
      errors: [],
      warnings: [],
      playerCount: 0,
      teamCount: 0,
      positionBreakdown: {},
      ownershipStats: {},
      projectionStats: {}
    };
  }

  validatePlayerStructures(players) {
    players.forEach((player, index) => {
      // Required fields
      if (!player.name || typeof player.name !== 'string') {
        this.addError(`Player ${index}: Missing or invalid name`);
      }
      
      if (!player.id) {
        this.addError(`Player ${index}: Missing player ID`);
      }
      
      if (!player.position || typeof player.position !== 'string') {
        this.addError(`Player ${index}: Missing or invalid position`);
      }
      
      if (!player.team || typeof player.team !== 'string') {
        this.addError(`Player ${index}: Missing or invalid team`);
      }
      
      // Numeric fields
      if (player.projectedPoints === undefined || player.projectedPoints === null) {
        this.addError(`Player ${player.name}: Missing projected points`);
      }
      
      if (player.salary === undefined || player.salary === null) {
        this.addError(`Player ${player.name}: Missing salary`);
      }
      
      if (player.ownership === undefined || player.ownership === null) {
        this.addWarning(`Player ${player.name}: Missing ownership data`);
      }
    });
  }

  validatePositions(players) {
    const positionCounts = {};
    
    players.forEach(player => {
      if (player.position) {
        positionCounts[player.position] = (positionCounts[player.position] || 0) + 1;
      }
    });

    // Check required positions
    this.config.requiredPositions.forEach(position => {
      const count = positionCounts[position] || 0;
      if (count === 0) {
        this.addError(`No players found for required position: ${position}`);
      } else if (count < 2) {
        this.addWarning(`Only ${count} player(s) for position ${position} - limited lineup diversity`);
      }
    });

    // Check for invalid positions
    Object.keys(positionCounts).forEach(position => {
      if (!this.config.requiredPositions.includes(position) && 
          !this.config.optionalPositions.includes(position)) {
        this.addWarning(`Unknown position found: ${position}`);
      }
    });

    this.validationResults.positionBreakdown = positionCounts;
  }

  validateTeamBalance(players) {
    const teamCounts = {};
    const teams = new Set();
    
    players.forEach(player => {
      if (player.team) {
        teams.add(player.team);
        teamCounts[player.team] = (teamCounts[player.team] || 0) + 1;
      }
    });

    this.validationResults.teamCount = teams.size;

    if (teams.size < this.config.minTeamsRequired) {
      this.addError(`Need at least ${this.config.minTeamsRequired} teams, found ${teams.size}`);
    }

    // Check team balance
    Object.entries(teamCounts).forEach(([team, count]) => {
      if (count > this.config.maxPlayersPerTeam + 1) { // +1 for potential TEAM player
        this.addWarning(`Team ${team} has ${count} players - may cause stacking limitations`);
      }
      if (count < this.config.requiredPositions.length) {
        this.addWarning(`Team ${team} has only ${count} players - incomplete position coverage`);
      }
    });
  }

  validateSalaries(players) {
    players.forEach(player => {
      const salary = parseFloat(player.salary);
      
      if (isNaN(salary)) {
        this.addError(`Player ${player.name}: Invalid salary value (${player.salary})`);
        return;
      }
      
      if (salary < this.config.minSalary) {
        this.addWarning(`Player ${player.name}: Unusually low salary ($${salary})`);
      }
      
      if (salary > this.config.maxSalary) {
        this.addWarning(`Player ${player.name}: Unusually high salary ($${salary})`);
      }
    });

    // Check if lineups are mathematically possible
    const lowestSalaryLineup = this.calculateMinimumSalaryLineup(players);
    if (lowestSalaryLineup > this.config.salaryCap) {
      this.addError(`Impossible to create valid lineup - minimum salary (${lowestSalaryLineup}) exceeds cap (${this.config.salaryCap})`);
    }
  }

  validateProjections(players) {
    const projections = [];
    
    players.forEach(player => {
      const projection = parseFloat(player.projectedPoints);
      
      if (isNaN(projection)) {
        this.addError(`Player ${player.name}: Invalid projection value (${player.projectedPoints})`);
        return;
      }
      
      if (projection < this.config.minProjection) {
        this.addWarning(`Player ${player.name}: Negative projection (${projection})`);
      }
      
      if (projection > this.config.maxProjection) {
        this.addWarning(`Player ${player.name}: Unusually high projection (${projection})`);
      }
      
      projections.push(projection);
    });

    // Calculate projection statistics
    if (projections.length > 0) {
      projections.sort((a, b) => a - b);
      this.validationResults.projectionStats = {
        min: projections[0],
        max: projections[projections.length - 1],
        median: projections[Math.floor(projections.length / 2)],
        average: projections.reduce((sum, p) => sum + p, 0) / projections.length
      };
    }
  }

  validateOwnership(players) {
    const ownerships = [];
    let totalOwnership = 0;
    
    players.forEach(player => {
      const ownership = parseFloat(player.ownership);
      
      if (isNaN(ownership)) {
        this.addWarning(`Player ${player.name}: Invalid ownership value (${player.ownership})`);
        return;
      }
      
      if (ownership < this.config.minOwnership) {
        this.addWarning(`Player ${player.name}: Negative ownership (${ownership}%)`);
      }
      
      if (ownership > this.config.maxOwnership) {
        this.addWarning(`Player ${player.name}: Ownership over 100% (${ownership}%)`);
      }
      
      ownerships.push(ownership);
      totalOwnership += ownership;
    });

    // Calculate ownership statistics
    if (ownerships.length > 0) {
      ownerships.sort((a, b) => a - b);
      const avgOwnership = totalOwnership / ownerships.length;
      
      this.validationResults.ownershipStats = {
        min: ownerships[0],
        max: ownerships[ownerships.length - 1],
        average: avgOwnership,
        total: totalOwnership
      };

      // Check ownership distribution
      if (avgOwnership < 5) {
        this.addWarning('Very low average ownership - may indicate stale data');
      }
      if (avgOwnership > 25) {
        this.addWarning('Very high average ownership - may indicate chalk-heavy slate');
      }
    }
  }

  validateCrossConsistency(players) {
    // Check value calculations (points per $1000)
    players.forEach(player => {
      const projection = parseFloat(player.projectedPoints);
      const salary = parseFloat(player.salary);
      
      if (!isNaN(projection) && !isNaN(salary) && salary > 0) {
        const calculatedValue = (projection / (salary / 1000));
        const providedValue = parseFloat(player.value);
        
        if (!isNaN(providedValue)) {
          const valueDiff = Math.abs(calculatedValue - providedValue);
          if (valueDiff > 0.1) {
            this.addWarning(`Player ${player.name}: Value calculation mismatch (calculated: ${calculatedValue.toFixed(2)}, provided: ${providedValue})`);
          }
        }
      }
    });

    // Check for duplicate player names (potential data quality issue)
    const nameMap = new Map();
    players.forEach((player, index) => {
      if (nameMap.has(player.name)) {
        this.addWarning(`Duplicate player name found: ${player.name} (indices ${nameMap.get(player.name)}, ${index})`);
      } else {
        nameMap.set(player.name, index);
      }
    });
  }

  calculateMinimumSalaryLineup(players) {
    const byPosition = {};
    
    // Group players by position
    players.forEach(player => {
      if (!byPosition[player.position]) {
        byPosition[player.position] = [];
      }
      byPosition[player.position].push(parseFloat(player.salary) || Infinity);
    });

    // Sort each position by salary (ascending)
    Object.keys(byPosition).forEach(position => {
      byPosition[position].sort((a, b) => a - b);
    });

    // Calculate minimum possible lineup
    let minSalary = 0;
    
    // Add cheapest player from each required position
    this.config.requiredPositions.forEach(position => {
      if (byPosition[position] && byPosition[position].length > 0) {
        minSalary += byPosition[position][0]; // Cheapest player
      } else {
        minSalary += this.config.maxSalary; // Assume max if position missing
      }
    });

    // Add cheapest captain (1.5x multiplier)
    const captainEligible = ['TOP', 'JNG', 'MID', 'ADC', 'SUP'];
    let cheapestCaptain = Infinity;
    
    captainEligible.forEach(position => {
      if (byPosition[position] && byPosition[position].length > 0) {
        cheapestCaptain = Math.min(cheapestCaptain, byPosition[position][0] * 1.5);
      }
    });
    
    minSalary += cheapestCaptain === Infinity ? this.config.maxSalary * 1.5 : cheapestCaptain;

    // Add TEAM player if available
    if (byPosition['TEAM'] && byPosition['TEAM'].length > 0) {
      minSalary += byPosition['TEAM'][0];
    }

    return Math.round(minSalary);
  }

  calculateStats(players) {
    this.validationResults.playerCount = players.length;
  }

  addError(message) {
    this.validationResults.errors.push(message);
  }

  addWarning(message) {
    this.validationResults.warnings.push(message);
  }

  getResults() {
    return { ...this.validationResults };
  }

  /**
   * Generate validation report for UI display
   */
  generateReport(validationResults) {
    const report = {
      status: validationResults.isValid ? 'valid' : 'invalid',
      summary: this.generateSummary(validationResults),
      details: {
        errors: validationResults.errors,
        warnings: validationResults.warnings,
        statistics: {
          players: validationResults.playerCount,
          teams: validationResults.teamCount,
          positions: validationResults.positionBreakdown,
          projections: validationResults.projectionStats,
          ownership: validationResults.ownershipStats
        }
      }
    };

    return report;
  }

  generateSummary(results) {
    if (!results.isValid) {
      return `Validation failed: ${results.errors.length} error(s) found`;
    }
    
    const warnings = results.warnings.length > 0 ? ` (${results.warnings.length} warnings)` : '';
    return `✓ Data validated: ${results.playerCount} players from ${results.teamCount} teams${warnings}`;
  }
}

module.exports = DataValidator;