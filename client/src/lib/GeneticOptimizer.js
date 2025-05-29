/**
 * Genetic Algorithm Optimizer for LoL DFS
 *
 * Uses evolutionary principles to find optimal lineups:
 * - Population-based search
 * - Crossover breeding of successful lineups
 * - Mutation for exploration
 * - Selection pressure toward better NexusScores
 *
 * Best for: Complex exposure constraints, tournament play, contrarian strategies
 */

const AdvancedOptimizer = require("./AdvancedOptimizer");

class GeneticOptimizer extends AdvancedOptimizer {
  constructor(config = {}) {
    super(config);

    // Genetic algorithm specific configuration
    this.geneticConfig = {
      populationSize: 100, // Number of lineups in each generation
      generations: 50, // Number of evolution cycles
      elitePercentage: 0.2, // Top 20% automatically survive
      crossoverRate: 0.7, // 70% of offspring from crossover
      mutationRate: 0.15, // 15% chance of mutation per gene
      tournamentSize: 5, // Tournament selection size
      diversityWeight: 0.3, // Weight for maintaining diversity
      maxStagnation: 10, // Generations without improvement before restart
      ...config.genetic,
    };

    // Evolution tracking
    this.currentGeneration = 0;
    this.bestFitness = -Infinity;
    this.stagnationCount = 0;
    this.populationHistory = [];
    this.fitnessHistory = [];
  }

  /**
   * Main genetic algorithm entry point
   */
  async runGeneticOptimization(count = 100) {
    if (!this.optimizerReady) {
      throw new Error("Optimizer not initialized. Call initialize() first.");
    }

    this.resetCancel();
    this.updateStatus("Starting genetic algorithm optimization...");
    this.updateProgress(0, "initializing_genetic");
    this.debugLog(`Running genetic optimization for ${count} lineups...`);

    try {
      // Phase 1: Initialize population (20% of progress)
      this.updateStatus("Creating initial population...");
      let population = await this._initializePopulation();
      this.updateProgress(20, "population_created");

      // Phase 2: Evolution cycles (60% of progress)
      for (
        let generation = 0;
        generation < this.geneticConfig.generations;
        generation++
      ) {
        if (this.isCancelled) throw new Error("Genetic optimization cancelled");

        this.currentGeneration = generation;

        // Evaluate fitness for all individuals
        await this._evaluatePopulation(population);

        // Track best fitness
        const currentBest = Math.max(...population.map((ind) => ind.fitness));
        if (currentBest > this.bestFitness) {
          this.bestFitness = currentBest;
          this.stagnationCount = 0;
        } else {
          this.stagnationCount++;
        }

        // Check for stagnation and restart if needed
        if (this.stagnationCount >= this.geneticConfig.maxStagnation) {
          this.debugLog(
            `Restarting due to stagnation at generation ${generation}`
          );
          population = await this._restartPopulation(population);
          this.stagnationCount = 0;
        }

        // Generate next generation
        population = await this._evolveGeneration(population);

        // Update progress
        const evolutionProgress =
          20 + ((generation + 1) / this.geneticConfig.generations) * 60;
        this.updateProgress(evolutionProgress, "evolving");
        this.updateStatus(
          `Evolution: Generation ${generation + 1}/${
            this.geneticConfig.generations
          } (Best: ${currentBest.toFixed(1)})`
        );

        // Store history
        this.fitnessHistory.push({
          generation,
          bestFitness: currentBest,
          avgFitness:
            population.reduce((sum, ind) => sum + ind.fitness, 0) /
            population.length,
          diversity: this._calculatePopulationDiversity(population),
        });

        await this.yieldToUI();
      }

      // Phase 3: Final selection and simulation (20% of progress)
      this.updateStatus("Selecting final lineups...");
      this.updateProgress(80, "final_selection");

      // Sort by fitness and select top lineups
      population.sort((a, b) => b.fitness - a.fitness);
      const selectedLineups = population
        .slice(0, count)
        .map((ind) => ind.lineup);

      // Run full Monte Carlo simulation on selected lineups
      this.updateStatus("Running final simulation...");
      const simulatedResults = [];

      for (let i = 0; i < selectedLineups.length; i++) {
        if (this.isCancelled) throw new Error("Genetic optimization cancelled");

        const result = await this._simulateLineup(selectedLineups[i]);
        simulatedResults.push(result);

        const simProgress = 80 + ((i + 1) / selectedLineups.length) * 20;
        this.updateProgress(simProgress, "final_simulation");
      }

      // Calculate NexusScores and final ranking
      simulatedResults.forEach((result) => {
        const nexusResult = this._calculateNexusScore(result);
        result.nexusScore = nexusResult.score;
        result.scoreComponents = nexusResult.components;
      });

      // Sort by combined genetic fitness and simulation results
      simulatedResults.sort((a, b) => {
        // Combine NexusScore with genetic fitness for final ranking
        const aScore = a.nexusScore * 0.7 + (a.geneticFitness || 0) * 0.3;
        const bScore = b.nexusScore * 0.7 + (b.geneticFitness || 0) * 0.3;
        return bScore - aScore;
      });

      this.updateProgress(100, "completed");
      this.updateStatus(
        `Genetic optimization completed: ${simulatedResults.length} lineups`
      );

      return {
        lineups: simulatedResults,
        summary: this._getGeneticSummary(simulatedResults),
        evolution: {
          generations: this.currentGeneration,
          fitnessHistory: this.fitnessHistory,
          finalDiversity: this._calculatePopulationDiversity(
            population.slice(0, count)
          ),
        },
      };
    } catch (error) {
      this.updateStatus(`Error: ${error.message}`);
      this.updateProgress(100, "error");
      this.debugLog(`Genetic optimization error: ${error.message}`);
      throw error;
    }
  }

  /**
   * Initialize the starting population
   */
  async _initializePopulation() {
    const population = [];
    const populationSize = this.geneticConfig.populationSize;

    // Create diverse initial population
    for (let i = 0; i < populationSize; i++) {
      if (this.isCancelled)
        throw new Error("Population initialization cancelled");

      try {
        // Use different strategies for initial diversity
        const strategy = this._getInitializationStrategy(i, populationSize);
        const lineup = await this._generateLineupWithStrategy(strategy);

        // Only add to population if lineup was successfully generated
        if (lineup && lineup.cpt && lineup.players) {
          population.push({
            lineup,
            fitness: 0,
            age: 0,
            strategy: strategy.name,
          });
        } else {
          // Retry this index if lineup generation failed
          this.debugLog(
            `Invalid lineup generated for individual ${i}, retrying...`
          );
          i--; // Retry this index
        }
      } catch (error) {
        // If lineup generation fails, try again with relaxed constraints
        this.debugLog(`Failed to generate individual ${i}, retrying...`);
        i--; // Retry this index
      }

      // Update progress occasionally
      if (i % 10 === 0) {
        const initProgress = (i / populationSize) * 20;
        this.updateProgress(initProgress, "creating_population");
        this.updateStatus(`Creating population: ${i}/${populationSize}`);
        await this.yieldToUI();
      }
    }

    this.debugLog(
      `Created initial population of ${population.length} individuals`
    );
    return population;
  }

  /**
   * Get initialization strategy for diversity
   */
  _getInitializationStrategy(index, totalSize) {
    const strategies = [
      { name: "projection_focused", leverageMultiplier: 0.3, randomness: 0.1 },
      { name: "leverage_focused", leverageMultiplier: 1.2, randomness: 0.2 },
      { name: "contrarian", leverageMultiplier: 1.5, randomness: 0.4 },
      { name: "balanced", leverageMultiplier: 0.7, randomness: 0.3 },
      {
        name: "stack_heavy",
        leverageMultiplier: 0.8,
        randomness: 0.2,
        stackBias: "large",
      },
      {
        name: "stack_light",
        leverageMultiplier: 0.6,
        randomness: 0.3,
        stackBias: "small",
      },
    ];

    // Distribute strategies evenly across population
    const strategyIndex = index % strategies.length;
    return strategies[strategyIndex];
  }

  /**
   * Generate lineup with specific strategy
   */
  async _generateLineupWithStrategy(strategy) {
    // Temporarily modify config for this strategy
    const originalConfig = { ...this.config };

    this.config.leverageMultiplier = strategy.leverageMultiplier;
    this.config.randomness = strategy.randomness;

    try {
      const lineup = await this._buildLineup([]);
      return lineup;
    } finally {
      // Restore original config
      this.config = originalConfig;
    }
  }

  /**
   * Evaluate fitness for entire population
   */
  async _evaluatePopulation(population) {
    // Filter out individuals with null lineups before evaluation
    const validIndividuals = population.filter(
      (individual) =>
        individual &&
        individual.lineup &&
        individual.lineup.cpt &&
        individual.lineup.players
    );

    const batchSize = 10;
    const batches = Math.ceil(validIndividuals.length / batchSize);

    for (let batch = 0; batch < batches; batch++) {
      if (this.isCancelled) throw new Error("Population evaluation cancelled");

      const startIdx = batch * batchSize;
      const endIdx = Math.min(startIdx + batchSize, validIndividuals.length);

      // Evaluate batch in parallel
      await Promise.all(
        validIndividuals.slice(startIdx, endIdx).map(async (individual) => {
          individual.fitness = await this._calculateGeneticFitness(
            individual.lineup
          );
          individual.lineup.geneticFitness = individual.fitness;
        })
      );

      await this.yieldToUI();
    }

    // Set fitness to 0 for invalid individuals that weren't evaluated
    population.forEach((individual) => {
      if (
        !individual ||
        !individual.lineup ||
        !individual.lineup.cpt ||
        !individual.lineup.players
      ) {
        individual.fitness = 0;
      }
    });
  }

  /**
   * Calculate genetic-specific fitness (faster than full Monte Carlo)
   */
  async _calculateGeneticFitness(lineup) {
    // Quick fitness evaluation based on:
    // 1. Base projection
    // 2. Ownership leverage
    // 3. Team synergy
    // 4. Position impact
    // 5. Constraint satisfaction

    // Check for null lineup or missing components
    if (!lineup || !lineup.cpt || !lineup.players) {
      return 0; // Return 0 fitness for invalid lineups
    }

    let fitness = 0;

    // 1. Base projection score
    let totalProjection = 0;
    const cptPlayer = this.playerPool.find((p) => p.id === lineup.cpt.id);
    if (cptPlayer) {
      totalProjection +=
        this._safeParseFloat(cptPlayer.projectedPoints, 0) * 1.5;
    }

    lineup.players.forEach((player) => {
      if (player && player.id) {
        const poolPlayer = this.playerPool.find((p) => p.id === player.id);
        if (poolPlayer) {
          totalProjection += this._safeParseFloat(
            poolPlayer.projectedPoints,
            0
          );
        }
      }
    });

    fitness += totalProjection * 10; // Scale projection to fitness points

    // 2. Ownership leverage bonus
    let totalOwnership = 0;
    let playerCount = 0;

    if (cptPlayer) {
      totalOwnership += this._safeParseFloat(cptPlayer.ownership, 0);
      playerCount++;
    }

    lineup.players.forEach((player) => {
      const poolPlayer = this.playerPool.find((p) => p.id === player.id);
      if (poolPlayer) {
        totalOwnership += this._safeParseFloat(poolPlayer.ownership, 0);
        playerCount++;
      }
    });

    const avgOwnership = playerCount > 0 ? totalOwnership / playerCount : 50;
    const leverageBonus = Math.max(0, (30 - avgOwnership) * 2); // Bonus for low ownership
    fitness += leverageBonus;

    // 3. Team synergy bonus
    const teamCounts = {};
    if (lineup.cpt && lineup.cpt.team) {
      teamCounts[lineup.cpt.team] = 1;
    }

    lineup.players.forEach((player) => {
      if (player.team) {
        teamCounts[player.team] = (teamCounts[player.team] || 0) + 1;
      }
    });

    // Exponential bonus for larger stacks
    let synergyBonus = 0;
    Object.values(teamCounts).forEach((count) => {
      if (count >= 3) {
        synergyBonus += Math.pow(count - 2, 1.5) * 15;
      }
    });
    fitness += synergyBonus;

    // 4. Position impact bonus
    let positionBonus = 0;
    const positionImpact = {
      MID: 2,
      ADC: 1.8,
      JNG: 1.5,
      TOP: 1.2,
      SUP: 1.0,
      TEAM: 0.8,
    };

    if (cptPlayer && positionImpact[cptPlayer.position]) {
      positionBonus += positionImpact[cptPlayer.position] * 10;
    }

    fitness += positionBonus;

    // 5. Constraint satisfaction bonus
    const constraintBonus = this._calculateConstraintSatisfaction(lineup);
    fitness += constraintBonus;

    return Math.round(fitness * 10) / 10;
  }

  /**
   * Calculate how well lineup satisfies exposure constraints
   */
  _calculateConstraintSatisfaction(lineup) {
    let bonus = 0;

    // Player exposure satisfaction
    const allPlayerIds = [];
    if (lineup.cpt && lineup.cpt.id) {
      allPlayerIds.push(lineup.cpt.id);
    }
    if (lineup.players) {
      allPlayerIds.push(
        ...lineup.players.filter((p) => p && p.id).map((p) => p.id)
      );
    }
    allPlayerIds.forEach((playerId) => {
      const exposure = this.playerExposures.find((pe) => pe.id === playerId);
      if (exposure) {
        // Bonus for using players that need more exposure
        const currentCount = this.exposureTracking.players.get(playerId) || 0;
        const totalLineups =
          this.generatedLineups.length + this.existingLineups.length;
        const currentExposure =
          totalLineups > 0 ? currentCount / totalLineups : 0;

        if (exposure.min > 0 && currentExposure < exposure.min) {
          bonus += (exposure.min - currentExposure) * 50; // Bonus for underexposed players
        }
      }
    });

    return bonus;
  }

  /**
   * Evolve to next generation
   */
  async _evolveGeneration(population) {
    const newPopulation = [];
    const populationSize = this.geneticConfig.populationSize;

    // Sort by fitness
    population.sort((a, b) => b.fitness - a.fitness);

    // Elitism - keep top performers
    const eliteCount = Math.floor(
      populationSize * this.geneticConfig.elitePercentage
    );
    const elite = population.slice(0, eliteCount).map((ind) => ({
      ...ind,
      age: ind.age + 1,
    }));
    newPopulation.push(...elite);

    // Generate offspring to fill rest of population
    while (newPopulation.length < populationSize) {
      if (this.isCancelled) throw new Error("Generation evolution cancelled");

      if (Math.random() < this.geneticConfig.crossoverRate) {
        // Crossover
        const parent1 = this._tournamentSelection(population);
        const parent2 = this._tournamentSelection(population);

        try {
          const offspring = await this._crossover(parent1, parent2);

          // Check if offspring is valid (not null due to stack constraints)
          if (offspring === null) {
            throw new Error("Invalid stack pattern in offspring");
          }

          // Mutation
          if (Math.random() < this.geneticConfig.mutationRate) {
            await this._mutate(offspring);
          }

          // Only add if offspring is valid
          if (offspring && offspring.cpt && offspring.players) {
            newPopulation.push({
              lineup: offspring,
              fitness: 0,
              age: 0,
              strategy: "crossover",
            });
          }
        } catch (error) {
          // If crossover fails, add a random individual
          try {
            const randomLineup = await this._buildLineup([]);
            // Only add if random lineup is valid
            if (randomLineup && randomLineup.cpt && randomLineup.players) {
              newPopulation.push({
                lineup: randomLineup,
                fitness: 0,
                age: 0,
                strategy: "random",
              });
            }
          } catch (randomError) {
            // Skip if we can't generate anything
            continue;
          }
        }
      } else {
        // Random individual for diversity
        try {
          const randomLineup = await this._buildLineup([]);
          // Only add if random lineup is valid
          if (randomLineup && randomLineup.cpt && randomLineup.players) {
            newPopulation.push({
              lineup: randomLineup,
              fitness: 0,
              age: 0,
              strategy: "random",
            });
          }
        } catch (error) {
          // Skip if generation fails
          continue;
        }
      }
    }

    // Trim to exact population size
    return newPopulation.slice(0, populationSize);
  }

  /**
   * Tournament selection for parent selection
   */
  _tournamentSelection(population) {
    const tournamentSize = Math.min(
      this.geneticConfig.tournamentSize,
      population.length
    );
    const tournament = [];

    // Select random individuals for tournament
    for (let i = 0; i < tournamentSize; i++) {
      const randomIndex = Math.floor(Math.random() * population.length);
      tournament.push(population[randomIndex]);
    }

    // Return fittest individual from tournament
    tournament.sort((a, b) => b.fitness - a.fitness);
    return tournament[0];
  }

  /**
   * Crossover two parent lineups
   */
  async _crossover(parent1, parent2) {
    // Check for valid parents
    if (
      !parent1?.lineup?.cpt ||
      !parent2?.lineup?.cpt ||
      !parent1?.lineup?.players ||
      !parent2?.lineup?.players
    ) {
      return null;
    }

    const offspring = {
      id: `genetic_${Date.now()}_${Math.random()}`,
      name: `Genetic Lineup ${this.currentGeneration}`,
      cpt: null,
      players: [],
    };

    // Captain selection - choose from either parent
    offspring.cpt =
      Math.random() < 0.5
        ? { ...parent1.lineup.cpt }
        : { ...parent2.lineup.cpt };

    // Position-wise crossover
    const positions = ["TOP", "JNG", "MID", "ADC", "SUP"];
    positions.forEach((position) => {
      const p1Player = parent1.lineup.players.find(
        (p) => p.position === position
      );
      const p2Player = parent2.lineup.players.find(
        (p) => p.position === position
      );

      if (p1Player && p2Player) {
        // Choose player from either parent
        const selectedPlayer = Math.random() < 0.5 ? p1Player : p2Player;
        offspring.players.push({ ...selectedPlayer });
      } else if (p1Player) {
        offspring.players.push({ ...p1Player });
      } else if (p2Player) {
        offspring.players.push({ ...p2Player });
      }
    });

    // Handle TEAM position if present
    const p1Team = parent1.lineup.players.find((p) => p.position === "TEAM");
    const p2Team = parent2.lineup.players.find((p) => p.position === "TEAM");

    if (p1Team || p2Team) {
      const teamPlayer =
        p1Team && p2Team
          ? Math.random() < 0.5
            ? p1Team
            : p2Team
          : p1Team || p2Team;
      offspring.players.push({ ...teamPlayer });
    }

    // Validate and fix if necessary
    return await this._validateAndFixLineup(offspring);
  }

  /**
   * Mutate a lineup
   */
  async _mutate(individual) {
    // Check for valid individual
    if (!individual || !individual.cpt || !individual.players) {
      return;
    }

    const mutationTypes = ["swap_player", "swap_captain", "swap_team_stack"];
    const mutationType =
      mutationTypes[Math.floor(Math.random() * mutationTypes.length)];

    try {
      switch (mutationType) {
        case "swap_player":
          await this._mutateSwapPlayer(individual);
          break;
        case "swap_captain":
          await this._mutateSwapCaptain(individual);
          break;
        case "swap_team_stack":
          await this._mutateSwapTeamStack(individual);
          break;
      }
    } catch (error) {
      this.debugLog(`Mutation failed: ${error.message}`);
      // Mutation failure is not critical - individual remains unchanged
    }
  }

  /**
   * Mutate by swapping one player
   */
  async _mutateSwapPlayer(individual) {
    const positions = individual.players.map((p) => p.position);
    const randomPosition =
      positions[Math.floor(Math.random() * positions.length)];

    // Find alternative players for this position
    const alternatives = this.playerPool.filter(
      (player) =>
        player.position === randomPosition &&
        player.id !== individual.cpt.id &&
        !individual.players.some((p) => p.id === player.id)
    );

    if (alternatives.length > 0) {
      const newPlayer =
        alternatives[Math.floor(Math.random() * alternatives.length)];
      const playerIndex = individual.players.findIndex(
        (p) => p.position === randomPosition
      );

      individual.players[playerIndex] = {
        id: newPlayer.id,
        name: newPlayer.name,
        position: newPlayer.position,
        team: newPlayer.team,
        opponent: this._getTeamOpponent(newPlayer.team),
        salary: this._safeParseFloat(newPlayer.salary, 0),
      };
    }
  }

  /**
   * Mutate by swapping captain
   */
  async _mutateSwapCaptain(individual) {
    const captainEligible = individual.players.filter((p) =>
      ["TOP", "MID", "ADC", "JNG"].includes(p.position)
    );

    if (captainEligible.length > 0) {
      const newCaptain =
        captainEligible[Math.floor(Math.random() * captainEligible.length)];
      const oldCaptain = individual.cpt;

      // Swap captain with player
      individual.cpt = {
        id: newCaptain.id,
        name: newCaptain.name,
        position: "CPT",
        team: newCaptain.team,
        opponent: this._getTeamOpponent(newCaptain.team),
        salary: Math.round(this._safeParseFloat(newCaptain.salary, 0) * 1.5),
      };

      // Replace the player with old captain
      const playerIndex = individual.players.findIndex(
        (p) => p.id === newCaptain.id
      );
      individual.players[playerIndex] = {
        id: oldCaptain.id,
        name: oldCaptain.name,
        position:
          oldCaptain.position === "CPT"
            ? newCaptain.position
            : oldCaptain.position,
        team: oldCaptain.team,
        opponent: this._getTeamOpponent(oldCaptain.team),
        salary: Math.round(oldCaptain.salary / 1.5), // Convert back from captain salary
      };
    }
  }

  /**
   * Mutate by changing team stack composition
   */
  async _mutateSwapTeamStack(individual) {
    // Find the most represented team
    const teamCounts = {};
    [individual.cpt, ...individual.players].forEach((player) => {
      if (player.team) {
        teamCounts[player.team] = (teamCounts[player.team] || 0) + 1;
      }
    });

    const stackTeam = Object.entries(teamCounts).sort(
      (a, b) => b[1] - a[1]
    )[0]?.[0];

    if (stackTeam) {
      // Try to replace a non-stack player with a stack player
      const nonStackPlayers = individual.players.filter(
        (p) => p.team !== stackTeam
      );
      const stackAlternatives = this.playerPool.filter(
        (player) =>
          player.team === stackTeam &&
          player.id !== individual.cpt.id &&
          !individual.players.some((p) => p.id === player.id)
      );

      if (nonStackPlayers.length > 0 && stackAlternatives.length > 0) {
        const targetPlayer =
          nonStackPlayers[Math.floor(Math.random() * nonStackPlayers.length)];
        const replacement = stackAlternatives.find(
          (p) => p.position === targetPlayer.position
        );

        if (replacement) {
          const playerIndex = individual.players.findIndex(
            (p) => p.id === targetPlayer.id
          );
          individual.players[playerIndex] = {
            id: replacement.id,
            name: replacement.name,
            position: replacement.position,
            team: replacement.team,
            opponent: this._getTeamOpponent(replacement.team),
            salary: this._safeParseFloat(replacement.salary, 0),
          };
        }
      }
    }
  }

  /**
   * Validate and fix lineup constraints
   */
  async _validateAndFixLineup(lineup) {
    // Check for duplicates
    const playerIds = [];
    if (lineup.cpt && lineup.cpt.id) {
      playerIds.push(lineup.cpt.id);
    }
    if (lineup.players) {
      playerIds.push(
        ...lineup.players.filter((p) => p && p.id).map((p) => p.id)
      );
    }
    const uniqueIds = new Set(playerIds);

    if (uniqueIds.size !== playerIds.length) {
      // Fix duplicates by replacing with random players
      const seenIds = new Set();

      // Check captain
      if (seenIds.has(lineup.cpt.id)) {
        const alternatives = this.playerPool.filter(
          (p) =>
            ["TOP", "MID", "ADC", "JNG"].includes(p.position) &&
            !seenIds.has(p.id)
        );
        if (alternatives.length > 0) {
          const replacement =
            alternatives[Math.floor(Math.random() * alternatives.length)];
          lineup.cpt = {
            id: replacement.id,
            name: replacement.name,
            position: "CPT",
            team: replacement.team,
            opponent: this._getTeamOpponent(replacement.team),
            salary: Math.round(
              this._safeParseFloat(replacement.salary, 0) * 1.5
            ),
          };
        }
      }
      seenIds.add(lineup.cpt.id);

      // Check players
      for (let i = 0; i < lineup.players.length; i++) {
        if (seenIds.has(lineup.players[i].id)) {
          const alternatives = this.playerPool.filter(
            (p) =>
              p.position === lineup.players[i].position && !seenIds.has(p.id)
          );
          if (alternatives.length > 0) {
            const replacement =
              alternatives[Math.floor(Math.random() * alternatives.length)];
            lineup.players[i] = {
              id: replacement.id,
              name: replacement.name,
              position: replacement.position,
              team: replacement.team,
              opponent: this._getTeamOpponent(replacement.team),
              salary: this._safeParseFloat(replacement.salary, 0),
            };
          }
        }
        seenIds.add(lineup.players[i].id);
      }
    }

    // Check stack type constraints (only allow 4-3 and 4-2-1 stacks)
    const teamCounts = {};
    if (lineup.cpt && lineup.cpt.team) {
      teamCounts[lineup.cpt.team] = 1;
    }
    lineup.players.forEach((player) => {
      if (player.team) {
        teamCounts[player.team] = (teamCounts[player.team] || 0) + 1;
      }
    });

    const counts = Object.values(teamCounts).sort((a, b) => b - a);
    const stackPattern = counts.join("-");

    // Must be exactly 4-3 or 4-2-1 pattern
    const isValid43Stack =
      counts.length === 2 && counts[0] === 4 && counts[1] === 3;
    const isValid421Stack =
      counts.length === 3 &&
      counts[0] === 4 &&
      counts[1] === 2 &&
      counts[2] === 1;

    if (!isValid43Stack && !isValid421Stack) {
      this.debugLog(
        `GeneticOptimizer: Invalid stack pattern ${stackPattern}, attempting to fix...`
      );
      // For now, return null to indicate this lineup should be discarded
      // A more sophisticated fix could be implemented later
      return null;
    }

    // Check DraftKings rule: players must be from at least 2 games (no full game stacks)
    const games = new Set();

    // Add captain's game
    if (lineup.cpt && lineup.cpt.team) {
      const captainOpponent = this._getTeamOpponent(lineup.cpt.team);
      if (captainOpponent) {
        // Create a game identifier using alphabetically sorted team names
        const gameTeams = [lineup.cpt.team, captainOpponent].sort();
        games.add(gameTeams.join(" vs "));
      }
    }

    // Add players' games
    lineup.players.forEach((player) => {
      if (player && player.team) {
        const playerOpponent = this._getTeamOpponent(player.team);
        if (playerOpponent) {
          // Create a game identifier using alphabetically sorted team names
          const gameTeams = [player.team, playerOpponent].sort();
          games.add(gameTeams.join(" vs "));
        }
      }
    });

    if (games.size < 2) {
      this.debugLog(
        `GeneticOptimizer: players from only ${games.size} game(s) (DraftKings requires at least 2 games)`
      );
      return null;
    }

    return lineup;
  }

  /**
   * Restart population when stagnant
   */
  async _restartPopulation(currentPopulation) {
    // Keep top 20% of current population
    const keepCount = Math.floor(currentPopulation.length * 0.2);
    const survivors = currentPopulation.slice(0, keepCount);

    // Generate new individuals for the rest
    const newCount = currentPopulation.length - keepCount;
    const newIndividuals = [];

    for (let i = 0; i < newCount; i++) {
      try {
        const strategy = this._getInitializationStrategy(i, newCount);
        const lineup = await this._generateLineupWithStrategy(strategy);

        // Only add if lineup is valid
        if (lineup && lineup.cpt && lineup.players) {
          newIndividuals.push({
            lineup,
            fitness: 0,
            age: 0,
            strategy: strategy.name,
          });
        }
      } catch (error) {
        // Skip failed generations
        continue;
      }
    }

    return [...survivors, ...newIndividuals];
  }

  /**
   * Calculate population diversity metric
   */
  _calculatePopulationDiversity(population) {
    if (population.length < 2) return 0;

    // Filter out individuals with null or invalid lineups
    const validIndividuals = population.filter(
      (individual) =>
        individual &&
        individual.lineup &&
        individual.lineup.cpt &&
        individual.lineup.players
    );

    if (validIndividuals.length < 2) return 0;

    let totalDistance = 0;
    let comparisons = 0;

    for (let i = 0; i < validIndividuals.length; i++) {
      for (let j = i + 1; j < validIndividuals.length; j++) {
        const distance = this._calculateLineupDistance(
          validIndividuals[i].lineup,
          validIndividuals[j].lineup
        );
        totalDistance += distance;
        comparisons++;
      }
    }

    return comparisons > 0 ? totalDistance / comparisons : 0;
  }

  /**
   * Calculate distance between two lineups
   */
  _calculateLineupDistance(lineup1, lineup2) {
    // Check for null lineups
    if (!lineup1 || !lineup2) {
      return 1; // Maximum distance for null lineups
    }

    // Safely extract player IDs with null checks
    const getPlayerIds = (lineup) => {
      const ids = [];
      if (lineup.cpt && lineup.cpt.id) {
        ids.push(lineup.cpt.id);
      }
      if (lineup.players) {
        ids.push(...lineup.players.filter((p) => p && p.id).map((p) => p.id));
      }
      return ids;
    };

    const ids1 = new Set(getPlayerIds(lineup1));
    const ids2 = new Set(getPlayerIds(lineup2));

    const intersection = new Set([...ids1].filter((id) => ids2.has(id)));
    const union = new Set([...ids1, ...ids2]);

    // Jaccard distance (1 - Jaccard similarity)
    return 1 - intersection.size / union.size;
  }

  /**
   * Generate genetic algorithm summary
   */
  _getGeneticSummary(results) {
    const baseSummary = this._getSimulationSummary();

    return {
      ...baseSummary,
      algorithm: "genetic",
      generations: this.currentGeneration,
      finalBestFitness: this.bestFitness,
      averageGeneticFitness:
        results.reduce((sum, r) => sum + (r.geneticFitness || 0), 0) /
        results.length,
      diversityScore: this._calculatePopulationDiversity(
        results.map((r) => ({ lineup: r }))
      ),
      evolutionEfficiency:
        this.fitnessHistory.length > 0
          ? (this.bestFitness - this.fitnessHistory[0].bestFitness) /
            this.fitnessHistory.length
          : 0,
    };
  }
}

module.exports = GeneticOptimizer;
