const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

// Import the AdvancedOptimizer class
const AdvancedOptimizer = require('./client/src/lib/AdvancedOptimizer');

// Create Express app
const app = express();
const PORT = 3001;

// Enable CORS for all routes
app.use(cors());

// Parse JSON bodies
app.use(bodyParser.json());
app.use(bodyParser.urlencoded({ extended: true }));

// Set up file upload storage
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, 'uploads');
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  }
});

const upload = multer({ storage });

// In-memory data stores (to be populated from actual file uploads)
let playerProjections = [];
let teamStacks = [];
let lineups = [];
let settings = {
  iterations: 2000,
  fieldSize: 1176,
  entryFee: 5,
  outputDir: './output',
  maxWorkers: 4
};

// Add exposure settings variable
let exposureSettings = {
  global: {
    globalMinExposure: 0,
    globalMaxExposure: 60,
    applyToNewLineups: true,
    prioritizeProjections: true
  },
  players: [],
  teams: [],
  positions: {
    TOP: { min: 0, max: 100, target: null },
    JNG: { min: 0, max: 100, target: null },
    MID: { min: 0, max: 100, target: null },
    ADC: { min: 0, max: 100, target: null },
    SUP: { min: 0, max: 100, target: null },
    CPT: { min: 0, max: 100, target: null }
  }
};

// Helper functions
const generateRandomId = () => Date.now() + Math.floor(Math.random() * 1000);

// Calculate exposure for team and position
const calculateExposures = (lineupList) => {
  const teamExposure = {};
  const positionExposure = {};
  let totalPlayers = 0;

  // Initialize position counters
  ['TOP', 'JNG', 'MID', 'ADC', 'SUP', 'TEAM'].forEach(pos => {
    positionExposure[pos] = 0;
  });

  lineupList.forEach(lineup => {
    // Count CPT team
    const cptTeam = lineup.cpt.team;
    teamExposure[cptTeam] = (teamExposure[cptTeam] || 0) + 1;

    // Count CPT position
    const cptPos = lineup.cpt.position;
    positionExposure[cptPos] = (positionExposure[cptPos] || 0) + 1;

    totalPlayers++;

    // Count players
    lineup.players.forEach(player => {
      teamExposure[player.team] = (teamExposure[player.team] || 0) + 1;
      positionExposure[player.position] = (positionExposure[player.position] || 0) + 1;
      totalPlayers++;
    });
  });

  // Convert counts to percentages
  Object.keys(teamExposure).forEach(team => {
    teamExposure[team] = (teamExposure[team] / totalPlayers) * 100;
  });

  Object.keys(positionExposure).forEach(pos => {
    positionExposure[pos] = (positionExposure[pos] / totalPlayers) * 100;
  });

  return { team: teamExposure, position: positionExposure };
};

// Simulate lineup performance based on player projections
const simulateLineups = (lineupIds, simSettings) => {
  const selectedLineups = lineups.filter(lineup => lineupIds.includes(lineup.id));

  if (selectedLineups.length === 0) {
    return { error: "No valid lineups found" };
  }

  // Calculate exposures
  const exposures = calculateExposures(selectedLineups);

  // Generate performance metrics based on player projections
  const lineupPerformance = selectedLineups.map(lineup => {
    // Calculate base projected points using actual player data
    let baseProjection = 0;
    const cptProj = playerProjections.find(p => p.name === lineup.cpt.name);
    if (cptProj) {
      baseProjection += cptProj.projectedPoints * 1.5; // CPT gets 1.5x points
    }

    lineup.players.forEach(player => {
      const playerProj = playerProjections.find(p => p.name === player.name);
      if (playerProj) {
        baseProjection += playerProj.projectedPoints;
      }
    });

    // Add some variance to the projection
    const variance = 0.2; // 20% variance
    const minCashPct = 20 + Math.random() * 15;
    const top10Pct = 5 + Math.random() * 10;
    const firstPlacePct = Math.random() * 3;

    // Calculate ROI based on placement chances
    const minCashMultiplier = 2;
    const top10Multiplier = 5;
    const firstPlaceMultiplier = 100;

    const roi = (
      (minCashPct / 100 * minCashMultiplier) +
      (top10Pct / 100 * top10Multiplier) +
      (firstPlacePct / 100 * firstPlaceMultiplier)
    ).toFixed(2);

    return {
      id: lineup.id,
      name: lineup.name,
      roi: roi,
      firstPlace: firstPlacePct.toFixed(2),
      top10: top10Pct.toFixed(2),
      minCash: minCashPct.toFixed(2),
      averagePayout: (roi * simSettings.entryFee).toFixed(2),
      projectedPoints: baseProjection.toFixed(1)
    };
  });

  // Sort by ROI descending
  lineupPerformance.sort((a, b) => parseFloat(b.roi) - parseFloat(a.roi));

  // Generate score distributions based on projected points
  const scoreDistributions = lineupPerformance.map(perf => {
    const projectedPoints = parseFloat(perf.projectedPoints);

    // Create distribution around the projected points
    return {
      lineup: perf.id,
      p10: (projectedPoints * 0.8).toFixed(1),  // 10th percentile (20% below projection)
      p25: (projectedPoints * 0.9).toFixed(1),  // 25th percentile (10% below projection)
      p50: projectedPoints.toFixed(1),          // Median (projected points)
      p75: (projectedPoints * 1.1).toFixed(1),  // 75th percentile (10% above projection)
      p90: (projectedPoints * 1.2).toFixed(1)   // 90th percentile (20% above projection)
    };
  });

  return {
    lineupPerformance,
    exposures,
    scoreDistributions
  };
};

// Generate optimized lineups using the AdvancedOptimizer
const generateOptimalLineups = async (count, options = {}) => {
  console.log("Generating lineups with options:", JSON.stringify(options, null, 2));

  if (playerProjections.length === 0) {
    return { error: "No player projections available" };
  }

  if (teamStacks.length === 0) {
    return { error: "No team stacks available" };
  }

  try {
    // Create an instance of the advanced optimizer with settings
    const optimizer = new AdvancedOptimizer({
      salaryCap: 50000,
      positionRequirements: {
        CPT: 1,
        TOP: 1,
        JNG: 1,
        MID: 1,
        ADC: 1,
        SUP: 1,
        TEAM: 1
      },
      iterations: settings.iterations || 2000,
      randomness: 0.2,
      targetTop: 0.1,
      leverageMultiplier: 0.7,
      debugMode: true  // Enable for detailed logging
    });

    console.log("Using Advanced Optimizer for lineup generation");

    // Process exposure settings including stack-specific constraints
    const mergedExposureSettings = options.exposureSettings || exposureSettings;

    // If a specific stack size is targeted in the options, add stack-specific constraints
    if (options.activeStackSize) {
      console.log(`Adding stack-specific constraints for ${options.activeStackSize}-stacks`);

      // Add stack-specific constraints for any teams being filtered
      if (options.preferredTeams && Array.isArray(options.preferredTeams)) {
        // Convert simple team names to objects with stack size if needed
        const processedTeams = options.preferredTeams.map(item => {
          // If it's already an object with team and stackSize
          if (typeof item === 'object' && item.team) {
            return item;
          }
          // If it's just a team name string
          return {
            team: typeof item === 'string' ? item : item.team || item.name,
            stackSize: options.activeStackSize
          };
        });

        // Update the exposure settings with stack-specific constraints
        if (!mergedExposureSettings.teams) {
          mergedExposureSettings.teams = [];
        }

        // Add or update stack-specific constraints
        processedTeams.forEach(team => {
          // Find if we already have a constraint for this team+stackSize
          const existingIndex = mergedExposureSettings.teams.findIndex(t =>
            t.team === team.team && t.stackSize === team.stackSize
          );

          if (existingIndex >= 0) {
            // Update existing constraint
            mergedExposureSettings.teams[existingIndex] = {
              ...mergedExposureSettings.teams[existingIndex],
              stackSize: team.stackSize,
              // If min exposure is set in the team object, use it, otherwise keep existing
              min: team.min !== undefined ? team.min : mergedExposureSettings.teams[existingIndex].min
            };
          } else {
            // Add new constraint
            mergedExposureSettings.teams.push({
              team: team.team,
              stackSize: team.stackSize,
              min: team.min || 25, // Default to 25% min exposure if not specified
              max: team.max || 100
            });
          }
        });
      }
    }

    // Initialize the optimizer with our enhanced exposure settings
    const initSuccess = await optimizer.initialize(
      playerProjections,
      mergedExposureSettings,
      lineups // Existing lineups to consider
    );

    if (!initSuccess) {
      throw new Error("Failed to initialize optimizer");
    }

    // Generate optimized lineups
    const result = await optimizer.runSimulation(count);
    console.log(`Generated ${result.lineups.length} optimized lineups`);

    // Format lineups to match our expected structure
    const formattedLineups = result.lineups.map(lineup => {
      return {
        id: lineup.id || generateRandomId(),
        name: lineup.name || `Optimized Lineup ${generateRandomId()}`,
        cpt: {
          id: lineup.cpt.id,
          name: lineup.cpt.name,
          position: 'CPT', // Ensure position is CPT
          team: lineup.cpt.team,
          salary: lineup.cpt.salary
        },
        players: lineup.players.map(player => ({
          id: player.id,
          name: player.name,
          position: player.position,
          team: player.team,
          salary: player.salary
        }))
      };
    });

    return formattedLineups;

  } catch (error) {
    console.error("Error using advanced optimizer:", error);
    return { error: "Error generating lineups", message: error.message };
  }
};

// Original implementation as a fallback
const fallbackGenerateLineups = (count, options = {}) => {
  console.log("Using fallback lineup generator with options:", options);

  const newLineups = [];
  const exposureSettings = options.exposureSettings || {};
  const teamExposures = exposureSettings.teams || [];
  const activeStackSize = options.activeStackSize || null;

  // Track exposures for stack-specific requirements
  const teamExposureCounts = {};

  // Initialize exposure tracking for all teams
  teamExposures.forEach(team => {
    // Create a unique key for each team+stackSize combination
    const key = team.stackSize ? `${team.team}_${team.stackSize}` : team.team;

    teamExposureCounts[key] = {
      team: team.team,
      stackSize: team.stackSize,
      count: 0,
      min: team.min || 0,
      max: team.max || 100,
      target: team.target || null,
      required: team.min > 0,
      // Track if this is a stack-specific exposure
      isStackSpecific: team.stackSize !== null && team.stackSize !== undefined
    };
  });

  console.log("Team exposure requirements:", teamExposureCounts);

  // Get appropriate stacks based on active stack size
  const getFilteredStacks = (stackSize = null) => {
    if (!stackSize) return teamStacks;

    return teamStacks.filter(stack => {
      if (!stack.stack) return false;
      if (Array.isArray(stack.stack)) {
        return stack.stack.length === stackSize;
      }
      if (typeof stack.stack === 'string') {
        return stack.stack.split(',').filter(Boolean).length === stackSize;
      }
      return false;
    });
  };

  // Get list of stacks to use
  let availableStacks = getFilteredStacks(activeStackSize);

  // If no stacks of the specific size, fall back to all stacks
  if (availableStacks.length === 0) {
    console.log(`No ${activeStackSize}-stacks found, using all stacks`);
    availableStacks = teamStacks;
  }

  console.log(`Using ${availableStacks.length} available stacks for lineup generation`);

  for (let i = 0; i < count; i++) {
    // Calculate current exposure percentages
    const currentExposures = {};
    Object.entries(teamExposureCounts).forEach(([key, data]) => {
      const currentPercentage = i > 0 ? (data.count / i) * 100 : 0;
      currentExposures[key] = {
        ...data,
        currentPercentage,
        // Check if this team needs more exposure
        needsExposure: data.required && currentPercentage < data.min
      };
    });

    // Find teams that haven't met their min exposure
    const unmetTeams = Object.entries(currentExposures)
      .filter(([key, data]) => data.needsExposure)
      .map(([key, data]) => ({
        key,
        team: data.team,
        stackSize: data.stackSize,
        currentPercentage: data.currentPercentage,
        target: data.min
      }));

    console.log(`Lineup ${i+1}: Teams needing more exposure:`,
      unmetTeams.length > 0 ? unmetTeams : "None");

    // Choose a team stack
    let randomStack;

    if (unmetTeams.length > 0) {
      // Prioritize a team that needs more exposure
      const teamToUse = unmetTeams[Math.floor(Math.random() * unmetTeams.length)];

      // Check if this team needs a specific stack size
      if (teamToUse.stackSize) {
        // Find stacks of the specific size for this team
        const sizeSpecificStacks = availableStacks.filter(stack =>
          stack.team === teamToUse.team &&
          ((Array.isArray(stack.stack) && stack.stack.length === teamToUse.stackSize) ||
           (typeof stack.stack === 'string' &&
            stack.stack.split(',').filter(Boolean).length === teamToUse.stackSize))
        );

        if (sizeSpecificStacks.length > 0) {
          randomStack = sizeSpecificStacks[Math.floor(Math.random() * sizeSpecificStacks.length)];
          console.log(`Using ${teamToUse.stackSize}-stack for team ${teamToUse.team}`);
        } else {
          // Fallback to any stack for this team if no specific size found
          const anyTeamStacks = availableStacks.filter(stack => stack.team === teamToUse.team);
          if (anyTeamStacks.length > 0) {
            randomStack = anyTeamStacks[Math.floor(Math.random() * anyTeamStacks.length)];
            console.log(`No ${teamToUse.stackSize}-stack found for ${teamToUse.team}, using available stack`);
          } else {
            // If no stacks for this team, pick a random stack
            randomStack = availableStacks[Math.floor(Math.random() * availableStacks.length)];
            console.log(`No stacks found for team ${teamToUse.team}, using random stack`);
          }
        }
      } else {
        // Just find any stack for this team
        const teamStacks = availableStacks.filter(stack => stack.team === teamToUse.team);
        if (teamStacks.length > 0) {
          randomStack = teamStacks[Math.floor(Math.random() * teamStacks.length)];
          console.log(`Using any stack for team ${teamToUse.team}`);
        } else {
          randomStack = availableStacks[Math.floor(Math.random() * availableStacks.length)];
          console.log(`No stacks found for team ${teamToUse.team}, using random stack`);
        }
      }
    } else {
      // Just pick a random stack
      randomStack = availableStacks[Math.floor(Math.random() * availableStacks.length)];
      console.log(`Using random stack for lineup ${i+1}`);
    }

    const stackTeam = randomStack.team;
    const stackSize = Array.isArray(randomStack.stack)
      ? randomStack.stack.length
      : (typeof randomStack.stack === 'string'
          ? randomStack.stack.split(',').filter(Boolean).length
          : null);

    console.log(`Using ${stackSize}-stack for team ${stackTeam} in lineup ${i+1}`);

    // Update exposure counts for this team
    // Check both standard team exposure and stack-specific exposure
    const teamKey = stackTeam;
    const stackSpecificKey = `${stackTeam}_${stackSize}`;

    if (teamExposureCounts[teamKey]) {
      teamExposureCounts[teamKey].count++;
    }

    if (teamExposureCounts[stackSpecificKey]) {
      teamExposureCounts[stackSpecificKey].count++;
    }

    // Filter players from the stack team and by positions in the stack
    const stackPlayers = playerProjections.filter(player =>
      player.team === stackTeam &&
      randomStack.stack.includes(player.position)
    );

    // Other players not from stack team
    const otherPlayers = playerProjections.filter(player =>
      player.team !== stackTeam ||
      !randomStack.stack.includes(player.position)
    );

    // Create lineup
    const id = generateRandomId();
    const name = `Generated Lineup ${id}`;

    // Choose captain (highest projected points from stack)
    const sortedStackPlayers = [...stackPlayers].sort((a, b) => b.projectedPoints - a.projectedPoints);
    const captain = sortedStackPlayers.length > 0 ? sortedStackPlayers[0] : playerProjections[0];

    // Add CPT with 1.5x salary
    const cpt = {
      id: captain.id || generateRandomId(),
      name: captain.name,
      position: 'CPT',
      team: captain.team,
      salary: Math.round(captain.salary * 1.5)
    };

    // Choose 5 players from stack and other players
    const selectedPlayers = [];
    const usedPlayerIds = new Set([captain.id]);

    // First add 2-3 players from the stack
    const stackCount = Math.min(stackPlayers.length, 2 + Math.floor(Math.random() * 2));
    for (let j = 0; j < stackCount; j++) {
      if (j < stackPlayers.length && !usedPlayerIds.has(stackPlayers[j].id)) {
        const player = stackPlayers[j];
        selectedPlayers.push({
          id: player.id || generateRandomId(),
          name: player.name,
          position: player.position,
          team: player.team,
          salary: player.salary
        });
        usedPlayerIds.add(player.id);
      }
    }

    // Fill remaining slots with other players
    while (selectedPlayers.length < 5) {
      const randomIndex = Math.floor(Math.random() * otherPlayers.length);
      const player = otherPlayers[randomIndex];

      // Check if player is already selected or is the captain
      if (
        !usedPlayerIds.has(player.id)
      ) {
        selectedPlayers.push({
          id: player.id || generateRandomId(),
          name: player.name,
          position: player.position,
          team: player.team,
          salary: player.salary
        });
        usedPlayerIds.add(player.id);
      }
    }

    // Create the lineup
    const newLineup = {
      id,
      name,
      cpt,
      players: selectedPlayers
    };

    newLineups.push(newLineup);

    // Log the current exposure status
    if ((i + 1) % 5 === 0 || i === count - 1) {
      const exposureStatus = {};
      Object.entries(teamExposureCounts).forEach(([key, data]) => {
        const currentPercentage = ((data.count / (i + 1)) * 100).toFixed(1);
        exposureStatus[key] = {
          count: data.count,
          percentage: `${currentPercentage}%`,
          min: `${data.min}%`,
          required: data.required
        };
      });

      console.log(`Exposure status after ${i+1} lineups:`, exposureStatus);
    }
  }

  // Final exposure report
  const finalExposures = {};
  Object.entries(teamExposureCounts).forEach(([key, data]) => {
    const pct = ((data.count / count) * 100).toFixed(1);
    finalExposures[key] = {
      team: data.team,
      stackSize: data.stackSize,
      exposurePercentage: `${pct}%`,
      count: data.count,
      minRequired: `${data.min}%`,
      met: parseFloat(pct) >= data.min
    };
  });

  console.log("Final lineup generation exposures:", finalExposures);

  return newLineups;
};

// Parse players CSV
const parsePlayersCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        // Process CSV data
        // Try to find column names in the file
        console.log('CSV row data:', data);

        // Extract data with flexible column naming
        const player = {
          id: data.id || data.ID || data.Id || generateRandomId(),
          name: data.name || data.Name || data.PLAYER || data.Player || '',
          team: data.team || data.Team || data.TEAM || '',
          position: data.position || data.Position || data.POS || data.Pos || '',
          projectedPoints: parseFloat(data.projectedPoints || data.Proj || data.FPTS || data.Projection || data.Median || 0) || 0,
          ownership: parseFloat(data.Own || data.OWN || data.own || data.Ownership || data.OWNERSHIP || data.ownership || 0) || 0,
          salary: parseInt(data.salary || data.Salary || data.SALARY || 0) || 0,
          value: 0 // Calculate value
        };

        // Log each row if it's causing issues
        console.log('Parsed player:', player);

        // Only add valid players with a name and projectedPoints > 0
        if (player.name && player.projectedPoints > 0) {
          // Calculate value (points per $1000)
          player.value = player.salary > 0 ?
            (player.projectedPoints / (player.salary / 1000)).toFixed(2) : 0;
          results.push(player);
        }
      })
      .on('end', () => {
        console.log(`Parsed ${results.length} players from CSV`);
        resolve(results);
      })
      .on('error', (error) => {
        console.error('Error parsing player CSV:', error);
        reject(error);
      });
  });
};

const parseStacksCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    // First, read the file content to log raw data and detect headers
    fs.readFile(filePath, 'utf8', (err, fileContent) => {
      if (err) {
        console.error('Error reading file for preview:', err);
        reject(err);
        return;
      }

      // Log a preview of the file content
      console.log('CSV file content preview (first 500 chars):', fileContent.substring(0, 500));

      // Check for common CSV issues
      if (fileContent.length === 0) {
        console.error('CSV file is empty');
        reject(new Error('CSV file is empty'));
        return;
      }

      // Count the number of comma-separated values in the first line
      const firstLineEnd = fileContent.indexOf('\n');
      const firstLine = fileContent.substring(0, firstLineEnd > 0 ? firstLineEnd : fileContent.length);
      const commaCount = (firstLine.match(/,/g) || []).length;
      console.log(`First line has ${commaCount + 1} potential columns`);

      // Log first few lines for debugging
      const lines = fileContent.split('\n').slice(0, 3);
      console.log('First few lines of CSV:');
      lines.forEach((line, i) => console.log(`Line ${i}: ${line}`));

      // Begin the actual parsing
      const results = [];
      const rawRowsForDebug = [];

      fs.createReadStream(filePath)
        .pipe(csv({
          // Force lowercase property names and preserve original keys
          mapHeaders: ({ header }) => {
            console.log(`Processing header: "${header}"`);
            return header; // Return just the original header string
          },
          // Add these options to make parsing more flexible
          skipLines: 0,       // Don't skip any lines (starts at line 0)
          strict: false,      // Don't be strict about column count
          trim: true,         // Trim whitespace from values
          skipEmptyLines: true // Skip empty lines
        }))
        .on('headers', (headers) => {
          // Log all headers to help debugging
          console.log('CSV HEADERS DETECTED:', headers);

          // Specifically look for team and stack-related columns
          const teamColumn = headers.find(h =>
            h.toLowerCase() === 'team' ||
            h.toLowerCase() === 'teams' ||
            h.toLowerCase() === 'teamname'
          );

          const stackColumns = headers.filter(h =>
            h.toLowerCase().includes('stack') ||
            h.toLowerCase().includes('stk') ||
            h.toLowerCase().includes('value') ||
            h.toLowerCase().includes('fan')
          );

          console.log('Team column found:', teamColumn || 'NOT FOUND');
          console.log('Stack-related columns found:', stackColumns.length ? stackColumns : 'NONE FOUND');
        })
        .on('data', (data) => {
          // Save a copy of the raw data for debugging
          rawRowsForDebug.push({...data});

          // Debug the actual object keys we've received for the first row
          if (rawRowsForDebug.length === 1) {
            console.log('First row keys:', Object.keys(data));
            console.log('First row raw data:', data);

            // Print all columns in the CSV
            console.log('All CSV columns:', Object.keys(data).join(', '));

            // Enhanced debug for Stack+ fields
            const stackRelatedKeys = Object.keys(data).filter(key =>
              key.toLowerCase().includes('stack') ||
              key.toLowerCase().includes('stk') ||
              key.toLowerCase().includes('value') ||
              key.toLowerCase().includes('fan')
            );

            if (stackRelatedKeys.length > 0) {
              console.log('Stack-related columns found:', stackRelatedKeys);
              stackRelatedKeys.forEach(key => {
                console.log(`Column "${key}" value:`, data[key]);
              });
            }
          }

          // Try to be flexible with column naming
          const stack = {
            id: generateRandomId(),
            team: null, // Will be filled below
            stack: [], // Will be populated below
            originalRow: {...data} // Store all original data
          };

          // First, find the team name in a flexible way
          // Try common variations of team column names
          const teamColumnNames = [
            'team', 'Team', 'TEAM', 'teamName', 'TeamName', 'TEAMNAME',
            'name', 'Name', 'NAME'
          ];

          for (const colName of teamColumnNames) {
            if (data[colName] !== undefined && data[colName] !== '') {
              stack.team = data[colName];
              console.log(`Found team name "${stack.team}" in column "${colName}"`);
              break;
            }
          }

          // If no team name found, try to find it in any column
          if (!stack.team) {
            for (const key in data) {
              const value = data[key];
              if (typeof value === 'string' && value.length > 0 &&
                  !key.toLowerCase().includes('stack') &&
                  !key.toLowerCase().includes('pos')) {
                stack.team = value;
                console.log(`Extracted team name "${stack.team}" from column "${key}"`);
                break;
              }
            }
          }

          // If still no team name, skip this row
          if (!stack.team) {
            console.log('Skipping row with no team name:', data);
            return;
          }

          // Extract all possible Stack+ values using various column names
          const stackPlusVariations = [
            data['Stack+'],
            data['stack+'],
            data.stackplus,
            data.StackPlus,
            data.stackPlus,
            // Add more ROO-specific column variations
            data['Stack_Plus'],
            data.Stack_Plus,
            data.stack_plus,
            data['stack_plus'],
            data['Stk+'],
            data.Stk,
            data.STK,
            data.stk,
            data.stk_plus,
            data.value,
            data.Value,
            data.VALUE,
            data['Stack Value'],
            data['stack value'],
            // More variations
            data.STACK,
            data.Stack,
            data.stack,
            // Raw number column possibilities
            data['1'],
            data['2'],
            data['3'],
            // Generic value columns
            data.val,
            data.Val,
            data.VAL,
            // Check Fantasy column which was in the error message
            data.Fantasy,
            data.fantasy,
            data.FANTASY
          ];

          // Log all potential values for debugging
          console.log(`Team ${stack.team} potential Stack+ values:`, stackPlusVariations
            .filter(v => v !== undefined)
            .map(v => typeof v === 'string' ? v.trim() : v));

          // Find first non-undefined, non-empty value
          const validStackPlus = stackPlusVariations.find(v =>
            v !== undefined && v !== '' && !isNaN(parseFloat(v))
          );

          stack.stackPlus = validStackPlus !== undefined ? parseFloat(validStackPlus) : 0;
          console.log(`Team ${stack.team} stackPlus value:`, stack.stackPlus);

          // Ensure Stack+ is available with both camelCase and original format
          stack['Stack+'] = stack.stackPlus;

          // Also set stackPlusValue for the frontend
          stack.stackPlusValue = stack.stackPlus;

          // Extract positions for stacks
          const positions = ['TOP', 'JNG', 'MID', 'ADC', 'SUP'];
          const stackPositions = [];

          // Method 1: Check if positions are column names with boolean/numeric values
          positions.forEach(pos => {
            // Check various formats (e.g., "TOP", "top", "Top")
            const variations = [pos, pos.toLowerCase(), pos.charAt(0) + pos.slice(1).toLowerCase()];

            for (const variant of variations) {
              if (data[variant] !== undefined) {
                const value = data[variant];
                // Accept various "true" values: "true", "1", "yes", etc.
                if (value === true || value === 1 || value === '1' ||
                    value === 'true' || value === 'yes' || value === 'y' ||
                    value === 'TRUE' || value === 'YES' || value === 'Y') {
                  stackPositions.push(pos);
                  console.log(`Position ${pos} found in column ${variant}`);
                  break;
                }
              }
            }
          });

          // Method 2: Try to find positions in specific position columns
          for (let i = 1; i <= 5; i++) {
            const posKeys = [`pos${i}`, `Pos${i}`, `POS${i}`, `position${i}`, `Position${i}`];

            for (const key of posKeys) {
              if (data[key]) {
                const posValue = String(data[key]).trim().toUpperCase();
                // Map position abbreviations
                let mappedPos = posValue;

                if (posValue === 'JUNGLE' || posValue === 'JG') mappedPos = 'JNG';
                else if (posValue === 'MIDDLE') mappedPos = 'MID';
                else if (posValue === 'BOT' || posValue === 'BOTTOM' || posValue === 'CARRY') mappedPos = 'ADC';
                else if (posValue === 'SUPPORT') mappedPos = 'SUP';

                if (positions.includes(mappedPos)) {
                  stackPositions.push(mappedPos);
                  console.log(`Found position ${mappedPos} in column ${key}`);
                }
              }
            }
          }

          // Default to 3-stack if no positions found
          if (stackPositions.length === 0) {
            stack.stack = ['MID', 'JNG', 'TOP']; // Default 3-stack
            console.log(`No positions found for team ${stack.team}, using default: MID,JNG,TOP`);
          } else {
            stack.stack = stackPositions;
            console.log(`Team ${stack.team} stack positions: ${stackPositions.join(',')}`);
          }

          // Only add valid stacks with a team
          if (stack.team && stack.stack.length > 0) {
            console.log(`Adding valid stack for team ${stack.team}`);
            results.push(stack);
          } else {
            console.log(`Skipping invalid stack for team ${stack.team || 'unknown'}`);
          }
        })
        .on('end', () => {
          console.log(`Parsed ${results.length} team stacks from CSV`);

          // Log the first few results for debugging
          if (results.length > 0) {
            console.log("First 3 parsed stacks with Stack+ values:");
            results.slice(0, 3).forEach((stack, i) => {
              console.log(`Stack ${i+1} - Team: ${stack.team} | Stack+: ${stack.stackPlus} | Display: ${stack.stackPlusValue}`);
              console.log("Original data for this stack:", stack.originalRow);
            });
          } else {
            console.log("*** NO STACKS WERE PARSED FROM THE CSV FILE ***");

            // Debug raw rows to understand why no stacks were parsed
            if (rawRowsForDebug.length > 0) {
              console.log(`The CSV had ${rawRowsForDebug.length} rows, but none were parsed as valid stacks.`);
              console.log("First row raw data:", rawRowsForDebug[0]);
            } else {
              console.log("The CSV parser did not read any rows from the file at all.");
            }
          }

          resolve(results);
        })
        .on('error', (error) => {
          console.error('Error parsing stacks CSV:', error);
          reject(error);
        });
    });
  });
};

// Process CSV data from DraftKings entries
// Replace the existing processDraftKingsFile function with this LoL-specific version
const processDraftKingsFile = (filePath) => {
  return new Promise((resolve, reject) => {
    // Read the file content first to check format
    const fileContent = fs.readFileSync(filePath, 'utf-8');
    console.log('File content preview:', fileContent.substring(0, 500) + '...');

    // Check if it's a League of Legends format file
    const hasLolPositions = fileContent.includes('TOP') &&
                           fileContent.includes('JNG') &&
                           fileContent.includes('MID') &&
                           fileContent.includes('ADC') &&
                           fileContent.includes('SUP');

    if (!hasLolPositions) {
      console.warn('File does not appear to be in LoL format');
      return reject(new Error('The file does not appear to be a League of Legends DraftKings file. Expected positions (TOP, JNG, MID, ADC, SUP) were not found.'));
    }

    console.log('Detected League of Legends DraftKings format');

    const results = [];

    // Now parse the file properly
    fs.createReadStream(filePath)
      .pipe(csv())
      .on('headers', (headers) => {
        console.log('CSV Headers:', headers);
      })
      .on('data', (row) => {
        results.push(row);
      })
      .on('end', () => {
        console.log(`Read ${results.length} rows from CSV`);

        // Process results into lineups
        const extractedLineups = [];

        for (let i = 0; i < results.length; i++) {
          try {
            const row = results[i];

            // Skip if this is a header row
            if (row['Entry ID'] === 'Entry ID' || !row['Entry ID'] || isNaN(row['Entry ID'])) {
              console.log('Skipping header or invalid row:', row);
              continue;
            }

            // Generate ID from Entry ID if available, otherwise random
            const id = row['Entry ID'] || generateRandomId().toString();
            const name = `DK Lineup ${id}`;

            // Extract CPT player
            let cpt = null;
            if (row['CPT']) {
              const cptName = extractPlayerName(row['CPT']);
              const cptId = extractPlayerId(row['CPT']);
              cpt = {
                name: cptName,
                id: cptId,
                position: 'CPT',
                salary: 0 // Will be filled from player projections if available
              };
            }

            // Skip if no captain
            if (!cpt) {
              console.warn(`No CPT found in row ${i}: ${JSON.stringify(row)}`);
              continue;
            }

            // Extract position players for League of Legends
            const players = [];

            // Add TOP player
            if (row['TOP']) {
              players.push({
                name: extractPlayerName(row['TOP']),
                id: extractPlayerId(row['TOP']),
                position: 'TOP',
                salary: 0
              });
            }

            // Add JNG player
            if (row['JNG']) {
              players.push({
                name: extractPlayerName(row['JNG']),
                id: extractPlayerId(row['JNG']),
                position: 'JNG',
                salary: 0
              });
            }

            // Add MID player
            if (row['MID']) {
              players.push({
                name: extractPlayerName(row['MID']),
                id: extractPlayerId(row['MID']),
                position: 'MID',
                salary: 0
              });
            }

            // Add ADC player
            if (row['ADC']) {
              players.push({
                name: extractPlayerName(row['ADC']),
                id: extractPlayerId(row['ADC']),
                position: 'ADC',
                salary: 0
              });
            }

            // Add SUP player
            if (row['SUP']) {
              players.push({
                name: extractPlayerName(row['SUP']),
                id: extractPlayerId(row['SUP']),
                position: 'SUP',
                salary: 0
              });
            }

            // Add TEAM if available
            if (row['TEAM']) {
              players.push({
                name: extractPlayerName(row['TEAM']),
                id: extractPlayerId(row['TEAM']),
                position: 'TEAM',
                salary: 0
              });
            }

            // Only create valid lineups with at least CPT and 2 players
            if (cpt && players.length >= 2) {
              // Try to fill in team info from player projections
              // (This is optional but helps with better data representation)
              if (playerProjections.length > 0) {
                // Match captain
                const cptProj = playerProjections.find(p => p.name === cpt.name);
                if (cptProj) {
                  cpt.team = cptProj.team;
                  cpt.salary = cptProj.salary || 0;
                }

                // Match players
                players.forEach(player => {
                  const playerProj = playerProjections.find(p => p.name === player.name);
                  if (playerProj) {
                    player.team = playerProj.team;
                    player.salary = playerProj.salary || 0;
                  }
                });
              }

              extractedLineups.push({
                id,
                name,
                cpt,
                players
              });
            } else {
              console.warn(`Skipping incomplete lineup in row ${i}: missing CPT or not enough players`);
            }
          } catch (error) {
            console.error(`Error processing row ${i}:`, error);
            // Continue with other entries
          }
        }

        console.log(`Successfully extracted ${extractedLineups.length} lineups`);
        if (extractedLineups.length > 0) {
          console.log('First lineup:', JSON.stringify(extractedLineups[0], null, 2));
        }

        resolve(extractedLineups);
      })
      .on('error', (error) => {
        console.error('CSV parsing error:', error);
        reject(error);
      });
  });
};

// Helper function to extract player name from DraftKings format
function extractPlayerName(playerStr) {
  if (!playerStr) return '';

  // Extract player name (everything before the ID parentheses)
  const nameMatch = playerStr.match(/^(.*?)(?:\s+\(|$)/);
  return nameMatch ? nameMatch[1].trim() : playerStr.trim();
}

// Helper function to extract player ID from DraftKings format
function extractPlayerId(playerStr) {
  if (!playerStr) return '';

  // Extract player ID if present in parentheses
  const idMatch = playerStr.match(/\((\d+)\)$/);
  return idMatch ? idMatch[1] : '';
}

// API Routes
// Get player projections
app.get('/players/projections', (req, res) => {
  res.json(playerProjections);
});

// Get team stacks
app.get('/teams/stacks', (req, res) => {
  console.log('GET /teams/stacks called, returning', teamStacks.length, 'stacks');

  // If we have player data, enhance the stack data with projections
  if (playerProjections.length > 0 && teamStacks.length > 0) {
    console.log('Enhancing stacks with player projection data');
    const enhancedStacks = teamStacks.map(stack => {
      // Get all players for this team
      const teamPlayers = playerProjections.filter(p => p.team === stack.team);

      // Calculate total projection for the team
      const totalProjection = teamPlayers.reduce((sum, p) =>
        sum + Number(p.projectedPoints || 0), 0);

      // Get stack-specific players
      const stackPlayers = teamPlayers.filter(player =>
        stack.stack && stack.stack.includes(player.position)
      );

      // Calculate stack-specific projections
      const stackProjection = stackPlayers.reduce((sum, player) =>
        sum + Number(player.projectedPoints || 0), 0);

      // Calculate ownership data
      const avgTeamOwnership = teamPlayers.length > 0
        ? teamPlayers.reduce((sum, p) => sum + Number(p.ownership || 0), 0) / teamPlayers.length
        : 0;

      const avgStackOwnership = stackPlayers.length > 0
        ? stackPlayers.reduce((sum, p) => sum + Number(p.ownership || 0), 0) / stackPlayers.length
        : 0;

      // Add time info (for UI display)
      const times = ['1:00 AM', '2:00 AM', '4:00 AM', '11:00 PM'];
      const randomTime = times[Math.floor(Math.random() * times.length)];

      // Return enhanced stack
      return {
        ...stack,
        totalProjection,
        stackProjection,
        avgTeamOwnership,
        avgStackOwnership,
        teamPlayerCount: teamPlayers.length,
        stackPlayerCount: stackPlayers.length,
        time: randomTime,
        status: '—'  // Default status
      };
    });

    // Sort by total projection
    enhancedStacks.sort((a, b) => b.totalProjection - a.totalProjection);

    console.log(`Returning ${enhancedStacks.length} enhanced stacks`);
    return res.json(enhancedStacks);
  }

  // Fall back to returning raw stacks
  console.log(`Returning ${teamStacks.length} raw stacks`);
  res.json(teamStacks);
});

// Get lineups
app.get('/lineups', (req, res) => {
  res.json(lineups);
});

// Get settings
app.get('/settings', (req, res) => {
  res.json(settings);
});

// Save settings
app.post('/settings', (req, res) => {
  settings = req.body;
  res.json({ success: true, message: 'Settings saved successfully' });
});

// Add the GET endpoint for exposure settings
app.get('/settings/exposure', (req, res) => {
  res.json(exposureSettings);
});

// Add the missing POST endpoint for exposure settings
app.post('/settings/exposure', (req, res) => {
  try {
    // Validate required fields
    const newSettings = req.body;
    if (!newSettings || !newSettings.global) {
      return res.status(400).json({
        message: 'Invalid exposure settings data structure'
      });
    }

    // Log statistics for debugging
    console.log(`Processing ${newSettings.players?.length || 0} player settings and ${newSettings.teams?.length || 0} team settings`);

    // Save the settings
    exposureSettings = newSettings;

    console.log('Exposure settings saved successfully');
    res.json({
      success: true,
      message: 'Exposure settings saved successfully'
    });
  } catch (error) {
    console.error('Error handling exposure settings:', error);
    res.status(500).json({
      message: `Error saving exposure settings: ${error.message}`
    });
  }
});

// Upload player projections
app.post('/players/projections/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    console.log(`Processing player projections from: ${req.file.path}`);
    const parsedPlayers = await parsePlayersCSV(req.file.path);

    if (parsedPlayers.length === 0) {
      return res.status(400).json({
        error: 'No valid player data found in the file',
        message: 'The uploaded file did not contain any valid player data. Please check the file format.'
      });
    }

    // Replace playerProjections with new data
    playerProjections = parsedPlayers;

    console.log(`Successfully loaded ${playerProjections.length} players`);
    res.json({
      success: true,
      message: `Loaded ${playerProjections.length} player projections successfully`
    });
  } catch (error) {
    console.error('Error processing player projections:', error);
    res.status(500).json({ error: 'Error processing file', message: error.message });
  }
});

// Team stacks upload endpoint with the original parsing logic but without default stack generation
app.post('/teams/stacks/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    console.log(`Processing team stacks from: ${req.file.path}`);

    // Check file size - but don't fail on it
    const stats = fs.statSync(req.file.path);
    console.log(`File size: ${stats.size} bytes`);

    // Preview file contents
    const fileContent = fs.readFileSync(req.file.path, 'utf8').slice(0, 500);
    console.log('File content preview:', fileContent);

    const parsedStacks = await parseStacksCSV(req.file.path);
    console.log(`Parsed ${parsedStacks.length} stacks from CSV`);

    if (parsedStacks.length === 0) {
      // Use a warning instead of a hard error
      console.warn("No stacks found in file. This is unusual but proceeding anyway.");
    }

    // Enhanced stacks processing - add more useful data for the UI
    if (playerProjections.length > 0) {
      console.log('Enhancing stacks with player data');
      // Get team stats to enhance the stacks
      const teamGroups = {};

      // Group players by team
      playerProjections.forEach(player => {
        if (!player.team) return;

        if (!teamGroups[player.team]) {
          teamGroups[player.team] = {
            players: [],
            totalProjection: 0,
            avgOwnership: 0
          };
        }

        teamGroups[player.team].players.push(player);
        teamGroups[player.team].totalProjection += Number(player.projectedPoints || 0);
      });

      // Calculate additional stats for each stack
      parsedStacks.forEach(stack => {
        const teamData = teamGroups[stack.team];

        if (teamData) {
          // Get players in this stack
          const stackPlayers = teamData.players.filter(player =>
            stack.stack.includes(player.position)
          );

          // Calculate stack-specific projections
          const stackProjection = stackPlayers.reduce((sum, player) =>
            sum + Number(player.projectedPoints || 0), 0);

          // Calculate ownership for the stack
          const avgStackOwnership = stackPlayers.length > 0
            ? stackPlayers.reduce((sum, p) => sum + Number(p.ownership || 0), 0) / stackPlayers.length
            : 0;

          // Add enhanced data to the stack
          stack.totalProjection = teamData.totalProjection;
          stack.stackProjection = stackProjection;
          stack.avgOwnership = avgStackOwnership;
          stack.playerCount = teamData.players.length;
          stack.stackPlayers = stackPlayers.length;
        }
      });
    }

    // Replace teamStacks with new data
    teamStacks = parsedStacks;

    console.log(`Successfully loaded ${teamStacks.length} team stacks`);
    res.json({
      success: true,
      message: `Loaded ${teamStacks.length} team stacks successfully`,
      stacks: teamStacks
    });
  } catch (error) {
    console.error('Error processing team stacks:', error);
    res.status(500).json({
      error: 'Error processing file',
      message: error.message
    });
  }
});

// Upload DraftKings entries
app.post('/lineups/dkentries', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    console.log(`Processing DraftKings entries from: ${req.file.path}`);
    const extractedLineups = await processDraftKingsFile(req.file.path);

    if (extractedLineups.length === 0) {
      return res.status(400).json({
        error: 'No valid lineup data found in the file',
        message: 'The uploaded file did not contain any valid lineup data. Please check the file format.'
      });
    }

    // Add new lineups to our store
    lineups = [...lineups, ...extractedLineups];

    console.log(`Successfully imported ${extractedLineups.length} lineups`);
    res.json({
      success: true,
      lineups: extractedLineups,
      message: `Imported ${extractedLineups.length} lineups successfully`
    });
  } catch (error) {
    console.error('Error processing DraftKings file:', error);
    res.status(500).json({ error: 'Error processing file', message: error.message });
  }
});

// Import JSON lineups
app.post('/lineups/import', upload.single('file'), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    console.log(`Processing JSON lineups from: ${req.file.path}`);
    const fileContent = fs.readFileSync(req.file.path, 'utf8');
    let importedLineups;

    try {
      importedLineups = JSON.parse(fileContent);
    } catch (parseError) {
      return res.status(400).json({
        error: 'Invalid JSON format',
        message: 'The uploaded file is not valid JSON. Please check the file format.'
      });
    }

    if (!Array.isArray(importedLineups)) {
      return res.status(400).json({
        error: 'Invalid lineup format',
        message: 'The JSON file must contain an array of lineups.'
      });
    }

    if (importedLineups.length === 0) {
      return res.status(400).json({
        error: 'No lineups found',
        message: 'The JSON file contains an empty array. No lineups to import.'
      });
    }

    // Add IDs if missing
    const processedLineups = importedLineups.map(lineup => ({
      ...lineup,
      id: lineup.id || generateRandomId()
    }));

    // Add new lineups to our store
    lineups = [...lineups, ...processedLineups];

    console.log(`Successfully imported ${processedLineups.length} lineups from JSON`);
    res.json({
      success: true,
      lineups: processedLineups,
      message: `Imported ${processedLineups.length} lineups successfully`
    });
  } catch (error) {
    console.error('Error importing JSON lineups:', error);
    res.status(500).json({ error: 'Error processing file', message: error.message });
  }
});

// Generate lineups
app.post('/lineups/generate', async (req, res) => {
  const { count = 5, settings: reqSettings = {}, exposureSettings: reqExposureSettings = {} } = req.body;

  // Check if we have necessary data
  if (playerProjections.length === 0) {
    return res.status(400).json({
      error: "No player projections available",
      message: "Please upload player projections data before generating lineups."
    });
  }

  if (teamStacks.length === 0) {
    return res.status(400).json({
      error: "No team stacks available",
      message: "Please upload team stacks data before generating lineups."
    });
  }

  // Generate lineups
  try {
    console.log(`Generating ${count} lineups with Advanced Optimizer`);

    // Create options object
    const options = {
      ...req.body,
      settings: {
        ...settings,
        ...reqSettings
      },
      exposureSettings: reqExposureSettings.teams ? reqExposureSettings : exposureSettings
    };

    // Generate lineups using the Advanced Optimizer
    const newLineups = await generateOptimalLineups(count, options);

    if (Array.isArray(newLineups)) {
      // Add to our store
      lineups = [...lineups, ...newLineups];

      console.log(`Successfully generated ${newLineups.length} lineups`);
      res.json({
        success: true,
        lineups: newLineups,
        message: `Generated ${newLineups.length} lineups successfully`
      });
    } else {
      // Error occurred during lineup generation
      res.status(400).json({
        error: newLineups.error || 'Error generating lineups',
        message: newLineups.message || 'An error occurred during lineup generation.'
      });
    }
  } catch (error) {
    console.error('Error generating lineups:', error);
    res.status(500).json({ error: 'Error generating lineups', message: error.message });
  }
});

// Run simulation
app.post('/simulation/run', (req, res) => {
  const { settings: simSettings, lineups: lineupIds } = req.body;

  // Validate inputs
  if (!lineupIds || !Array.isArray(lineupIds) || lineupIds.length === 0) {
    return res.status(400).json({
      error: 'No lineups selected',
      message: 'Please select at least one lineup to run the simulation.'
    });
  }

  if (playerProjections.length === 0) {
    return res.status(400).json({
      error: 'No player projections available',
      message: 'Please upload player projections data before running a simulation.'
    });
  }

  // Run simulation
  try {
    console.log(`Running simulation for ${lineupIds.length} lineups`);
    const results = simulateLineups(lineupIds, simSettings || settings);

    if (results.error) {
      return res.status(400).json({
        error: results.error,
        message: results.message || 'An error occurred during simulation.'
      });
    }

    console.log('Simulation completed successfully');
    res.json(results);
  } catch (error) {
    console.error('Error running simulation:', error);
    res.status(500).json({ error: 'Error running simulation', message: error.message });
  }
});

// Delete lineup
app.delete('/lineups/:id', (req, res) => {
  const id = parseInt(req.params.id) || req.params.id;

  // Find the lineup
  const index = lineups.findIndex(lineup => lineup.id == id);

  if (index === -1) {
    return res.status(404).json({
      error: 'Lineup not found',
      message: `No lineup with ID ${id} was found.`
    });
  }

  // Remove the lineup
  lineups.splice(index, 1);

  console.log(`Deleted lineup with ID: ${id}`);
  res.json({
    success: true,
    message: 'Lineup deleted successfully'
  });
});

// Add a new endpoint to calculate team stats
app.get('/teams/stats', (req, res) => {
  try {
    // Validate that we have the necessary data
    if (playerProjections.length === 0) {
      return res.status(400).json({
        error: 'No player projections available',
        message: 'Please upload player projections data first.'
      });
    }

    // Group players by team
    const teamMap = {};

    playerProjections.forEach(player => {
      if (!player.team) return;

      if (!teamMap[player.team]) {
        teamMap[player.team] = {
          name: player.team,
          players: [],
          totalProjection: 0,
          totalSalary: 0,
          avgOwnership: 0
        };
      }

      teamMap[player.team].players.push(player);
      teamMap[player.team].totalProjection += Number(player.projectedPoints || 0);
      teamMap[player.team].totalSalary += Number(player.salary || 0);
    });

    // Calculate averages and additional stats
    const teamStats = Object.values(teamMap).map(team => {
      const playerCount = team.players.length;
      const ownerships = team.players
        .map(p => Number(p.ownership || 0))
        .filter(o => !isNaN(o));

      const avgOwnership = ownerships.length > 0
        ? ownerships.reduce((sum, o) => sum + o, 0) / ownerships.length
        : 0;

      // Add positions breakdown
      const positionCounts = {
        TOP: 0, JNG: 0, MID: 0, ADC: 0, SUP: 0
      };

      team.players.forEach(player => {
        if (player.position && positionCounts[player.position] !== undefined) {
          positionCounts[player.position]++;
        }
      });

      return {
        ...team,
        playerCount,
        avgProjection: playerCount > 0 ? team.totalProjection / playerCount : 0,
        avgSalary: playerCount > 0 ? team.totalSalary / playerCount : 0,
        avgOwnership,
        positionCounts
      };
    });

    // Sort by total projection (descending)
    teamStats.sort((a, b) => b.totalProjection - a.totalProjection);

    res.json(teamStats);

  } catch (error) {
    console.error('Error calculating team stats:', error);
    res.status(500).json({
      error: 'Error processing team stats',
      message: error.message
    });
  }
});

// Start the server
app.listen(PORT, () => {
  console.log(`LoL DFS Optimization Server running on port ${PORT}`);
});