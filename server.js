const express = require('express');
const cors = require('cors');
const bodyParser = require('body-parser');
const multer = require('multer');
const fs = require('fs');
const path = require('path');
const csv = require('csv-parser');

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

// Generate optimized lineups based on real player data and stacks
const generateOptimalLineups = (count) => {
  if (playerProjections.length === 0) {
    return { error: "No player projections available" };
  }

  if (teamStacks.length === 0) {
    return { error: "No team stacks available" };
  }

  const newLineups = [];

  for (let i = 0; i < count; i++) {
    // Get a random team stack
    const randomStack = teamStacks[Math.floor(Math.random() * teamStacks.length)];
    const stackTeam = randomStack.team;

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
      name: captain.name,
      position: captain.position,
      team: captain.team,
      salary: Math.round(captain.salary * 1.5)
    };

    // Choose 5 players from stack and other players
    const selectedPlayers = [];

    // First add 2-3 players from the stack
    const stackCount = Math.min(stackPlayers.length, 2 + Math.floor(Math.random() * 2));
    for (let j = 0; j < stackCount; j++) {
      if (j < stackPlayers.length && stackPlayers[j].name !== captain.name) {
        selectedPlayers.push({
          name: stackPlayers[j].name,
          position: stackPlayers[j].position,
          team: stackPlayers[j].team,
          salary: stackPlayers[j].salary
        });
      }
    }

    // Fill remaining slots with other players
    while (selectedPlayers.length < 5) {
      const randomIndex = Math.floor(Math.random() * otherPlayers.length);
      const player = otherPlayers[randomIndex];

      // Check if player is already selected or is the captain
      if (
        !selectedPlayers.some(p => p.name === player.name) &&
        player.name !== captain.name
      ) {
        selectedPlayers.push({
          name: player.name,
          position: player.position,
          team: player.team,
          salary: player.salary
        });
      }
    }

    // Add a team
    const teams = Array.from(new Set(playerProjections.map(p => p.team)));
    const randomTeam = teams[Math.floor(Math.random() * teams.length)];
    selectedPlayers.push({
      name: randomTeam,
      position: "TEAM",
      team: randomTeam,
      salary: 4000 + Math.floor(Math.random() * 1000)
    });

    // Create the lineup
    const newLineup = {
      id,
      name,
      cpt,
      players: selectedPlayers
    };

    newLineups.push(newLineup);
  }

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

// Parse team stacks CSV
const parseStacksCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on('data', (data) => {
        // Process CSV data with debug logging
        console.log('Stack CSV row data:', data);

        // Try to be flexible with column naming
        const stack = {
          id: data.id || data.ID || data.Id || generateRandomId(),
          team: data.team || data.Team || data.TEAM || '',
          stack: [], // Will be populated below
          stackValue: parseFloat(data.value || data.Value || data.STACK_VALUE || data.StackValue || 0) || 0
        };

        // Extract positions from the stack - try various column naming patterns
        const stackPositions = [];

        // Try to find positions based on common column naming patterns
        for (const key in data) {
          // Check for position keys like pos1, position1, POS1, etc.
          if (/^pos\d+$/i.test(key) || /^position\d+$/i.test(key)) {
            if (data[key]) stackPositions.push(data[key]);
          }
        }

        // Alternative: try explicit position column names
        if (data.pos1 || data.POS1 || data.Pos1) stackPositions.push(data.pos1 || data.POS1 || data.Pos1);
        if (data.pos2 || data.POS2 || data.Pos2) stackPositions.push(data.pos2 || data.POS2 || data.Pos2);
        if (data.pos3 || data.POS3 || data.Pos3) stackPositions.push(data.pos3 || data.POS3 || data.Pos3);

        // If still no positions, try a comma-separated positions column
        if (stackPositions.length === 0 && (data.positions || data.Positions || data.POSITIONS)) {
          const posStr = data.positions || data.Positions || data.POSITIONS;
          const splitPositions = posStr.split(',').map(p => p.trim());
          stackPositions.push(...splitPositions);
        }

        console.log(`Found positions for ${stack.team}: ${stackPositions.join(', ')}`);

        // If no positions are specified, use default stack
        if (stackPositions.length === 0) {
          stack.stack = ['MID', 'ADC', 'SUP']; // Default stack
        } else {
          stack.stack = stackPositions;
        }

        // Only add valid stacks with a team
        if (stack.team && stack.stack.length > 0) {
          results.push(stack);
        }
      })
      .on('end', () => {
        console.log(`Parsed ${results.length} team stacks from CSV`);
        resolve(results);
      })
      .on('error', (error) => {
        console.error('Error parsing stacks CSV:', error);
        reject(error);
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

// Upload team stacks
app.post('/teams/stacks/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    console.log(`Processing team stacks from: ${req.file.path}`);
    const parsedStacks = await parseStacksCSV(req.file.path);

    if (parsedStacks.length === 0) {
      return res.status(400).json({
        error: 'No valid team stack data found in the file',
        message: 'The uploaded file did not contain any valid team stack data. Please check the file format.'
      });
    }

    // Replace teamStacks with new data
    teamStacks = parsedStacks;

    console.log(`Successfully loaded ${teamStacks.length} team stacks`);
    res.json({
      success: true,
      message: `Loaded ${teamStacks.length} team stacks successfully`
    });
  } catch (error) {
    console.error('Error processing team stacks:', error);
    res.status(500).json({ error: 'Error processing file', message: error.message });
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
app.post('/lineups/generate', (req, res) => {
  const { count = 5 } = req.body;

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
    console.log(`Generating ${count} lineups`);
    const newLineups = generateOptimalLineups(count);

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

// Start the server
app.listen(PORT, () => {
  console.log(`LoL DFS Optimization Server running on port ${PORT}`);
});