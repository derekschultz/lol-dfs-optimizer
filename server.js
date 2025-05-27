const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

// Import optimizer classes
const AdvancedOptimizer = require("./client/src/lib/AdvancedOptimizer");
const HybridOptimizer = require("./client/src/lib/HybridOptimizer");
const DataValidator = require("./client/src/lib/DataValidator");


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
    const dir = path.join(__dirname, "uploads");
    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: (req, file, cb) => {
    cb(null, `${Date.now()}-${file.originalname}`);
  },
});

const upload = multer({ storage });

// In-memory data stores
let playerProjections = [];
let teamStacks = [];
let lineups = [];
let contestMetadata = null; // Store contest info from DraftKings import
let playerIdMapping = new Map(); // Map player names to DraftKings IDs

// Progress tracking for Server-Sent Events
const progressSessions = new Map(); // sessionId -> { res, progress, status, isActive }
const progressCallbacks = new Map(); // sessionId -> { progressCallback, statusCallback }
let contestEntryIds = []; // Store actual Entry IDs from DraftKings contest
let settings = {
  iterations: 2000,
  fieldSize: 1176,
  entryFee: 5,
  outputDir: "./output",
  maxWorkers: 4,
};

// Hybrid optimizer instance
let hybridOptimizer = null;
let optimizerInitialized = false;

// Helper functions
const generateRandomId = () => Date.now() + Math.floor(Math.random() * 1000);

// Calculate exposure for team and position
const calculateExposures = (lineupList) => {
  const teamExposure = {};
  const positionExposure = {};
  let totalPlayers = 0;

  // Initialize position counters
  ["TOP", "JNG", "MID", "ADC", "SUP", "TEAM"].forEach((pos) => {
    positionExposure[pos] = 0;
  });

  lineupList.forEach((lineup) => {
    // Count CPT team
    const cptTeam = lineup.cpt.team;
    teamExposure[cptTeam] = (teamExposure[cptTeam] || 0) + 1;

    // Count CPT position
    const cptPos = lineup.cpt.position;
    positionExposure[cptPos] = (positionExposure[cptPos] || 0) + 1;

    totalPlayers++;

    // Count players
    lineup.players.forEach((player) => {
      teamExposure[player.team] = (teamExposure[player.team] || 0) + 1;
      positionExposure[player.position] =
        (positionExposure[player.position] || 0) + 1;
      totalPlayers++;
    });
  });

  // Convert counts to percentages
  Object.keys(teamExposure).forEach((team) => {
    teamExposure[team] = (teamExposure[team] / totalPlayers) * 100;
  });

  Object.keys(positionExposure).forEach((pos) => {
    positionExposure[pos] = (positionExposure[pos] / totalPlayers) * 100;
  });

  return { team: teamExposure, position: positionExposure };
};

// Simulate lineup performance based on player projections
const simulateLineups = (lineupIds, simSettings) => {
  const selectedLineups = lineups.filter((lineup) =>
    lineupIds.includes(lineup.id)
  );

  if (selectedLineups.length === 0) {
    return { error: "No valid lineups found" };
  }

  // Calculate exposures
  const exposures = calculateExposures(selectedLineups);

  // Generate performance metrics based on player projections
  const lineupPerformance = selectedLineups.map((lineup) => {
    // Calculate base projected points using actual player data
    let baseProjection = 0;
    const cptProj = playerProjections.find((p) => p.name === lineup.cpt.name);
    if (cptProj) {
      baseProjection += cptProj.projectedPoints * 1.5; // CPT gets 1.5x points
    }

    lineup.players.forEach((player) => {
      const playerProj = playerProjections.find((p) => p.name === player.name);
      if (playerProj) {
        baseProjection += playerProj.projectedPoints;
      }
    });

    // Add some variance to the projection
    const minCashPct = 20 + Math.random() * 15;
    const top10Pct = 5 + Math.random() * 10;
    const firstPlacePct = Math.random() * 3;

    // Calculate ROI based on placement chances
    const minCashMultiplier = 2;
    const top10Multiplier = 5;
    const firstPlaceMultiplier = 100;

    const roi = (
      (minCashPct / 100) * minCashMultiplier +
      (top10Pct / 100) * top10Multiplier +
      (firstPlacePct / 100) * firstPlaceMultiplier
    ).toFixed(2);

    return {
      id: lineup.id,
      name: lineup.name,
      roi: roi,
      firstPlace: firstPlacePct.toFixed(2),
      top10: top10Pct.toFixed(2),
      minCash: minCashPct.toFixed(2),
      averagePayout: (roi * simSettings.entryFee).toFixed(2),
      projectedPoints: baseProjection.toFixed(1),
    };
  });

  // Sort by ROI descending
  lineupPerformance.sort((a, b) => parseFloat(b.roi) - parseFloat(a.roi));

  // Generate score distributions based on projected points
  const scoreDistributions = lineupPerformance.map((perf) => {
    const projectedPoints = parseFloat(perf.projectedPoints);

    // Create distribution around the projected points
    return {
      lineup: perf.id,
      p10: (projectedPoints * 0.8).toFixed(1), // 10th percentile (20% below projection)
      p25: (projectedPoints * 0.9).toFixed(1), // 25th percentile (10% below projection)
      p50: projectedPoints.toFixed(1), // Median (projected points)
      p75: (projectedPoints * 1.1).toFixed(1), // 75th percentile (10% above projection)
      p90: (projectedPoints * 1.2).toFixed(1), // 90th percentile (20% above projection)
    };
  });

  return {
    lineupPerformance,
    exposures,
    scoreDistributions,
  };
};

// Generate optimized lineups using the AdvancedOptimizer
const generateOptimalLineups = async (count, options = {}) => {
  if (playerProjections.length === 0) {
    return { error: "No player projections available" };
  }

  if (teamStacks.length === 0) {
    return { error: "No team stacks available" };
  }

  try {
    // Extract stack exposure targets from options
    const stackExposureTargets = options.stackExposureTargets || {};
    console.log("==== STACK EXPOSURE DEBUGGING ====");
    console.log("Raw stack exposure targets received:", JSON.stringify(stackExposureTargets, null, 2));
    console.log("Number of stack targets:", Object.keys(stackExposureTargets).length);
    
    // Debug: Log available teams to check if KT exists
    const availableTeams = [...new Set(playerProjections.map(p => p.team))].filter(Boolean);
    
    // Log each target individually for debugging
    Object.entries(stackExposureTargets).forEach(([key, value]) => {
      const parts = key.split('_');
      console.log(`Stack target: ${key} = ${value}%`, {
        team: parts.slice(0, -2).join('_'),
        stackSize: parts[parts.length - 2],
        type: parts[parts.length - 1]
      });
    });
    
    // Create an instance of the advanced optimizer with settings
    const optimizer = new AdvancedOptimizer({
      salaryCap: 50000,
      debugMode: true, // Enable debug logging to troubleshoot KT issue
      positionRequirements: {
        CPT: 1,
        TOP: 1,
        JNG: 1,
        MID: 1,
        ADC: 1,
        SUP: 1,
        TEAM: 1,
      },
      iterations: settings.iterations || 2000,
      randomness: 0.2,
      targetTop: 0.1,
      leverageMultiplier: 0.7,
      debugMode: true, // Enable for detailed logging
      stackExposureTargets, // Pass stack exposure targets to optimizer
    });

    // Initialize the optimizer with player data
    const initSuccess = await optimizer.initialize(
      playerProjections,
      {},
      lineups, // Existing lineups to consider
      teamStacks // Team stacks for Stack+ ratings
    );

    if (!initSuccess) {
      throw new Error("Failed to initialize optimizer");
    }

    // Generate optimized lineups
    const result = await optimizer.runSimulation(count);

    // Format lineups to match our expected structure
    const formattedLineups = result.lineups.map((lineup) => {
      return {
        id: lineup.id || generateRandomId(),
        name: lineup.name || `Optimized Lineup ${generateRandomId()}`,
        cpt: {
          id: lineup.cpt.id,
          name: lineup.cpt.name,
          position: "CPT", // Ensure position is CPT
          team: lineup.cpt.team,
          salary: lineup.cpt.salary,
        },
        players: lineup.players.map((player) => ({
          id: player.id,
          name: player.name,
          position: player.position,
          team: player.team,
          salary: player.salary,
        })),
      };
    });

    return formattedLineups;
  } catch (error) {
    console.error("Error using advanced optimizer:", error);
    return { error: "Error generating lineups", message: error.message };
  }
};

// Parse players CSV
const parsePlayersCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    const results = [];

    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (data) => {
        // Extract data with flexible column naming
        const player = {
          id: data.id || data.ID || data.Id || generateRandomId(),
          name: data.name || data.Name || data.PLAYER || data.Player || "",
          team: data.team || data.Team || data.TEAM || "",
          position:
            data.position || data.Position || data.POS || data.Pos || "",
          projectedPoints:
            parseFloat(
              data.projectedPoints ||
                data.Proj ||
                data.FPTS ||
                data.Projection ||
                data.Median ||
                0
            ) || 0,
          ownership:
            parseFloat(
              data.Own ||
                data.OWN ||
                data.own ||
                data.Ownership ||
                data.OWNERSHIP ||
                data.ownership ||
                0
            ) || 0,
          salary: parseInt(data.salary || data.Salary || data.SALARY || 0) || 0,
          value: 0, // Calculate value
        };

        // Only add valid players with a name and projectedPoints > 0
        if (player.name && player.projectedPoints > 0) {
          // Calculate value (points per $1000)
          player.value =
            player.salary > 0
              ? (player.projectedPoints / (player.salary / 1000)).toFixed(2)
              : 0;
          results.push(player);
        }
      })
      .on("end", () => {
        console.log(`Parsed ${results.length} players from CSV`);
        resolve(results);
      })
      .on("error", (error) => {
        console.error("Error parsing player CSV:", error);
        reject(error);
      });
  });
};

const parseStacksCSV = (filePath) => {
  return new Promise((resolve, reject) => {
    // First, read the file content to log raw data and detect headers
    fs.readFile(filePath, "utf8", (err, fileContent) => {
      if (err) {
        console.error("Error reading file for preview:", err);
        reject(err);
        return;
      }

      // Check for common CSV issues
      if (fileContent.length === 0) {
        console.error("CSV file is empty");
        reject(new Error("CSV file is empty"));
        return;
      }

      // Begin the actual parsing
      const results = [];

      fs.createReadStream(filePath)
        .pipe(
          csv({
            skipLines: 0,
            strict: false,
            trim: true,
            skipEmptyLines: true,
          })
        )
        .on("data", (data) => {
          // Parse all Stack+ columns
          const stack = {
            id: generateRandomId(),
            team: data.Team || "",
            stack: [], // Will be populated below
            stackPlus: parseFloat(data["Stack+"] || 0) || 0,
            stackPlusValue: parseFloat(data["Stack+"] || 0) || 0,
            stackPlusAllWins: parseFloat(data["Stack+ All Wins"] || 0) || 0,
            stackPlusAllLosses: parseFloat(data["Stack+ All Losses"] || 0) || 0,
          };

          // If no team found, skip this row
          if (!stack.team) {
            return;
          }

          // Extract positions for stacks
          const positions = ["TOP", "JNG", "MID", "ADC", "SUP"];
          const stackPositions = [];

          // Check if positions are directly present in the row
          positions.forEach((pos) => {
            if (
              data[pos] &&
              (data[pos] === "1" || data[pos] === "true" || data[pos] === "yes")
            ) {
              stackPositions.push(pos);
            }
          });

          // Default to 3-stack if no positions found
          if (stackPositions.length === 0) {
            stack.stack = ["MID", "JNG", "TOP"]; // Default 3-stack
          } else {
            stack.stack = stackPositions;
          }

          // Only add valid stacks with a team
          if (stack.team && stack.stack.length > 0) {
            results.push(stack);
          }
        })
        .on("end", () => {
          console.log(`Parsed ${results.length} team stacks from CSV`);
          resolve(results);
        })
        .on("error", (error) => {
          console.error("Error parsing stacks CSV:", error);
          reject(error);
        });
    });
  });
};

// Process CSV data from DraftKings entries
const processDraftKingsFile = (filePath) => {
  return new Promise((resolve, reject) => {
    // Read the file content first to check format
    const fileContent = fs.readFileSync(filePath, "utf-8");

    // Check if it's a League of Legends format file
    const hasLolPositions =
      fileContent.includes("TOP") &&
      fileContent.includes("JNG") &&
      fileContent.includes("MID") &&
      fileContent.includes("ADC") &&
      fileContent.includes("SUP");

    if (!hasLolPositions) {
      return reject(
        new Error(
          "The file does not appear to be a League of Legends DraftKings file. Expected positions (TOP, JNG, MID, ADC, SUP) were not found."
        )
      );
    }

    const results = [];

    // Now parse the file properly
    fs.createReadStream(filePath)
      .pipe(csv())
      .on("data", (row) => {
        results.push(row);
      })
      .on("end", () => {
        console.log(`Read ${results.length} rows from CSV`);

        // Extract player pool data and contest metadata
        const extractedPlayers = new Map(); // Use Map to avoid duplicates
        const extractedLineups = [];
        let contestMetadata = null;

        for (let i = 0; i < results.length; i++) {
          try {
            const row = results[i];

            // Skip if this is a header row
            if (
              row["Entry ID"] === "Entry ID" ||
              !row["Entry ID"] ||
              isNaN(row["Entry ID"])
            ) {
              continue;
            }

            // Generate ID from Entry ID if available, otherwise random
            const id = row["Entry ID"] || generateRandomId().toString();
            const name = `DK Lineup ${id}`;

            // Extract CPT player
            let cpt = null;
            if (row["CPT"]) {
              const cptName = extractPlayerName(row["CPT"]);
              const cptId = extractPlayerId(row["CPT"]);
              cpt = {
                name: cptName,
                id: cptId,
                position: "CPT",
                salary: 0, // Will be filled from player projections if available
              };
            }

            // Skip if no captain
            if (!cpt) {
              continue;
            }

            // Extract position players for League of Legends
            const players = [];

            // Add TOP player
            if (row["TOP"]) {
              players.push({
                name: extractPlayerName(row["TOP"]),
                id: extractPlayerId(row["TOP"]),
                position: "TOP",
                salary: 0,
              });
            }

            // Add JNG player
            if (row["JNG"]) {
              players.push({
                name: extractPlayerName(row["JNG"]),
                id: extractPlayerId(row["JNG"]),
                position: "JNG",
                salary: 0,
              });
            }

            // Add MID player
            if (row["MID"]) {
              players.push({
                name: extractPlayerName(row["MID"]),
                id: extractPlayerId(row["MID"]),
                position: "MID",
                salary: 0,
              });
            }

            // Add ADC player
            if (row["ADC"]) {
              players.push({
                name: extractPlayerName(row["ADC"]),
                id: extractPlayerId(row["ADC"]),
                position: "ADC",
                salary: 0,
              });
            }

            // Add SUP player
            if (row["SUP"]) {
              players.push({
                name: extractPlayerName(row["SUP"]),
                id: extractPlayerId(row["SUP"]),
                position: "SUP",
                salary: 0,
              });
            }

            // Add TEAM if available
            if (row["TEAM"]) {
              players.push({
                name: extractPlayerName(row["TEAM"]),
                id: extractPlayerId(row["TEAM"]),
                position: "TEAM",
                salary: 0,
              });
            }

            // Only create valid lineups with at least CPT and 2 players
            if (cpt && players.length >= 2) {
              // Try to fill in team info from player projections
              if (playerProjections.length > 0) {
                // Match captain
                const cptProj = playerProjections.find(
                  (p) => p.name === cpt.name
                );
                if (cptProj) {
                  cpt.team = cptProj.team;
                  cpt.salary = cptProj.salary || 0;
                }

                // Match players
                players.forEach((player) => {
                  const playerProj = playerProjections.find(
                    (p) => p.name === player.name
                  );
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
                players,
              });
            }
          } catch (error) {
            console.error(`Error processing row ${i}:`, error);
            // Continue with other entries
          }
        }

        console.log(
          `Successfully extracted ${extractedLineups.length} lineups`
        );
        resolve(extractedLineups);
      })
      .on("error", (error) => {
        console.error("CSV parsing error:", error);
        reject(error);
      });
  });
};

// Helper function to extract player name from DraftKings format
function extractPlayerName(playerStr) {
  if (!playerStr) return "";

  // Extract player name (everything before the ID parentheses)
  const nameMatch = playerStr.match(/^(.*?)(?:\s+\(|$)/);
  return nameMatch ? nameMatch[1].trim() : playerStr.trim();
}

// Helper function to extract player ID from DraftKings format
function extractPlayerId(playerStr) {
  if (!playerStr) return "";

  // Extract player ID if present in parentheses
  const idMatch = playerStr.match(/\((\d+)\)$/);
  return idMatch ? idMatch[1] : "";
}

// Helper function to format player for DraftKings export
function formatPlayerForDraftKings(player) {
  if (!player) return "";
  
  // Format: "Player Name (Player ID)"
  const name = player.name || "";
  
  // Look up DraftKings ID from stored mapping if not present on player object
  let id = player.draftKingsId || player.id || "";
  
  if (!player.draftKingsId && playerIdMapping && playerIdMapping.size > 0) {
    // Try to find DraftKings ID by name and position (trim whitespace)
    const cleanName = name.trim();
    const mappedId = playerIdMapping.get(`${cleanName}_${player.position}`) || 
                     playerIdMapping.get(cleanName);
    if (mappedId) {
      id = mappedId;
      // Debug: Log when we successfully map an ID
      if (player.name === "Doran" || player.name === "Faker") {
        console.log(`Mapped ${cleanName} to DraftKings ID: ${mappedId}`);
      }
    }
  }
  
  // Debug: Log what IDs are being used
  if (player.name === "Doran" || player.name === "Faker") {
    console.log(`Formatting ${player.name}: final ID=${id}`);
  }
  
  if (id) {
    return `${name} (${id})`;
  }
  return name;
}

// Generate DraftKings CSV content from lineups
function generateDraftKingsCSV(lineupsToExport) {
  if (!lineupsToExport || lineupsToExport.length === 0) {
    throw new Error("No lineups provided for export");
  }

  console.log("Generating DraftKings CSV with contest metadata:", contestMetadata);

  // CSV header for DraftKings format
  const headers = [
    "Entry ID",
    "Contest Name", 
    "Contest ID",
    "Entry Fee",
    "CPT",
    "TOP", 
    "JNG",
    "MID",
    "ADC", 
    "SUP",
    "TEAM"
  ];

  // Generate CSV rows
  const rows = [headers.join(",")];
  
  lineupsToExport.forEach((lineup, index) => {
    // Use actual Entry IDs from imported contest data if available
    let entryId;
    if (contestEntryIds && contestEntryIds.length > 0 && index < contestEntryIds.length) {
      entryId = contestEntryIds[index];
    } else {
      // Fallback to sequential generation if no Entry IDs available
      const baseEntryId = 4732704849;
      entryId = baseEntryId + index;
    }
    
    // Use stored contest metadata if available
    const contestName = contestMetadata?.contestName || "";
    const contestId = contestMetadata?.contestId || "";
    const entryFee = contestMetadata?.entryFee || "";
    
    // Debug logging for first lineup
    if (index === 0) {
      console.log("Export - Contest Name:", contestName);
      console.log("Export - Contest ID:", contestId);
      console.log("Export - Entry Fee:", entryFee);
    }
    
    // Format captain
    const cpt = formatPlayerForDraftKings(lineup.cpt);
    
    // Initialize position slots
    let top = "", jng = "", mid = "", adc = "", sup = "", team = "";
    
    // Fill position slots from players array
    if (lineup.players) {
      lineup.players.forEach(player => {
        const formattedPlayer = formatPlayerForDraftKings(player);
        
        switch (player.position) {
          case "TOP":
            top = formattedPlayer;
            break;
          case "JNG":
            jng = formattedPlayer;
            break;
          case "MID":
            mid = formattedPlayer;
            break;
          case "ADC":
            adc = formattedPlayer;
            break;
          case "SUP":
            sup = formattedPlayer;
            break;
          case "TEAM":
            team = formattedPlayer;
            break;
        }
      });
    }
    
    // Create CSV row
    const row = [
      entryId,
      `"${contestName}"`,
      contestId,
      entryFee,
      `"${cpt}"`,
      `"${top}"`,
      `"${jng}"`,
      `"${mid}"`,
      `"${adc}"`,
      `"${sup}"`,
      `"${team}"`
    ];
    
    rows.push(row.join(","));
  });
  
  return rows.join("\n");
}

// API Routes

// Server-Sent Events endpoint for real-time progress updates
app.get("/optimizer/progress/:sessionId", (req, res) => {
  const sessionId = req.params.sessionId;
  
  // Set SSE headers
  res.writeHead(200, {
    'Content-Type': 'text/event-stream',
    'Cache-Control': 'no-cache',
    'Connection': 'keep-alive',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Cache-Control'
  });

  // Store the session
  progressSessions.set(sessionId, {
    res: res,
    progress: 0,
    status: 'Connecting...',
    isActive: true
  });
  

  // Send initial connection message
  res.write(`data: ${JSON.stringify({ progress: 0, status: 'Connected to progress stream' })}\n\n`);

  // Handle client disconnect
  req.on('close', () => {
    progressSessions.delete(sessionId);
    progressCallbacks.delete(sessionId);
  });

  req.on('end', () => {
    console.log(`SSE session ${sessionId} ended`);
    progressSessions.delete(sessionId);
    progressCallbacks.delete(sessionId);
  });
});

// Function to send progress updates to a specific session
function sendProgressUpdate(sessionId, progress, status) {
  const session = progressSessions.get(sessionId);
  if (session && session.isActive) {
    try {
      const updateData = { progress };
      if (status !== undefined) {
        updateData.status = status;
        session.status = status;
      }
      const data = JSON.stringify(updateData);
      session.res.write(`data: ${data}\n\n`);
      session.progress = progress;
    } catch (error) {
      console.error(`Error sending progress to session ${sessionId}:`, error);
      progressSessions.delete(sessionId);
    }
  }
}

// Function to create progress callbacks for a session
function createProgressCallbacks(sessionId) {
  const progressCallback = (progress, stage) => {
    sendProgressUpdate(sessionId, progress);
  };

  const statusCallback = (status) => {
    const session = progressSessions.get(sessionId);
    if (session && session.isActive) {
      sendProgressUpdate(sessionId, session.progress, status);
    }
  };

  progressCallbacks.set(sessionId, { progressCallback, statusCallback });
  return { progressCallback, statusCallback };
}

// Get player projections
app.get("/players/projections", (req, res) => {
  res.json(playerProjections);
});

// Get team stacks
app.get("/teams/stacks", (req, res) => {
  // If we have player data, enhance the stack data with projections
  if (playerProjections.length > 0 && teamStacks.length > 0) {
    const enhancedStacks = teamStacks.map((stack) => {
      // Get all players for this team
      const teamPlayers = playerProjections.filter(
        (p) => p.team === stack.team
      );

      // Calculate total projection for the team
      const totalProjection = teamPlayers.reduce(
        (sum, p) => sum + Number(p.projectedPoints || 0),
        0
      );

      // Get stack-specific players
      const stackPlayers = teamPlayers.filter(
        (player) => stack.stack && stack.stack.includes(player.position)
      );

      // Calculate stack-specific projections
      const stackProjection = stackPlayers.reduce(
        (sum, player) => sum + Number(player.projectedPoints || 0),
        0
      );

      // Calculate ownership data
      const avgTeamOwnership =
        teamPlayers.length > 0
          ? teamPlayers.reduce((sum, p) => sum + Number(p.ownership || 0), 0) /
            teamPlayers.length
          : 0;

      const avgStackOwnership =
        stackPlayers.length > 0
          ? stackPlayers.reduce((sum, p) => sum + Number(p.ownership || 0), 0) /
            stackPlayers.length
          : 0;

      // Add time info (for UI display)
      const times = ["1:00 AM", "2:00 AM", "4:00 AM", "11:00 PM"];
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
        status: "—", // Default status
      };
    });

    // Sort by total projection
    enhancedStacks.sort((a, b) => b.totalProjection - a.totalProjection);
    return res.json(enhancedStacks);
  }

  // Fall back to returning raw stacks
  res.json(teamStacks);
});

// Get lineups
app.get("/lineups", (req, res) => {
  res.json(lineups);
});

// Export lineups in various formats
app.post("/lineups/export", (req, res) => {
  try {
    const { format = "csv", lineupIds = [] } = req.body;
    
    // If no specific lineup IDs provided, export all lineups
    let lineupsToExport = lineups;
    if (lineupIds && lineupIds.length > 0) {
      lineupsToExport = lineups.filter(lineup => lineupIds.includes(lineup.id));
    }
    
    if (lineupsToExport.length === 0) {
      return res.status(400).json({ error: "No lineups found to export" });
    }
    
    let content, filename, contentType;
    
    switch (format.toLowerCase()) {
      case "draftkings":
      case "dk":
        content = generateDraftKingsCSV(lineupsToExport);
        filename = `lineups_draftkings_${Date.now()}.csv`;
        contentType = "text/csv";
        break;
        
      case "csv":
        // Generate simple CSV format
        const csvHeaders = ["ID", "Name", "CPT", "TOP", "JNG", "MID", "ADC", "SUP", "TEAM", "Total Salary"];
        const csvRows = [csvHeaders.join(",")];
        
        lineupsToExport.forEach(lineup => {
          const players = lineup.players || [];
          const totalSalary = (lineup.cpt?.salary || 0) + players.reduce((sum, p) => sum + (p.salary || 0), 0);
          
          const row = [
            lineup.id || "",
            `"${lineup.name || ""}"`,
            `"${lineup.cpt?.name || ""}"`,
            `"${players.find(p => p.position === "TOP")?.name || ""}"`,
            `"${players.find(p => p.position === "JNG")?.name || ""}"`,
            `"${players.find(p => p.position === "MID")?.name || ""}"`,
            `"${players.find(p => p.position === "ADC")?.name || ""}"`,
            `"${players.find(p => p.position === "SUP")?.name || ""}"`,
            `"${players.find(p => p.position === "TEAM")?.name || ""}"`,
            totalSalary
          ];
          csvRows.push(row.join(","));
        });
        
        content = csvRows.join("\n");
        filename = `lineups_${Date.now()}.csv`;
        contentType = "text/csv";
        break;
        
      case "json":
        content = JSON.stringify(lineupsToExport, null, 2);
        filename = `lineups_${Date.now()}.json`;
        contentType = "application/json";
        break;
        
      default:
        return res.status(400).json({ error: "Unsupported export format. Use: csv, json, or draftkings" });
    }
    
    // Set headers for file download
    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(content);
    
  } catch (error) {
    console.error("Export error:", error.message);
    res.status(500).json({ error: error.message });
  }
});

// Get settings
app.get("/settings", (req, res) => {
  res.json(settings);
});

// Save settings
app.post("/settings", (req, res) => {
  settings = req.body;
  res.json({ success: true, message: "Settings saved successfully" });
});


// AI Service Data Endpoints
// Get all player data with calculated exposures for AI analysis
app.get("/api/data/players", (req, res) => {
  try {
    // Calculate actual exposures for each player
    const playerExposureMap = new Map();
    
    lineups.forEach(lineup => {
      // Count captain
      if (lineup.cpt) {
        const key = `${lineup.cpt.name}_${lineup.cpt.team}`;
        playerExposureMap.set(key, (playerExposureMap.get(key) || 0) + 1);
      }
      
      // Count regular players
      if (lineup.players) {
        lineup.players.forEach(player => {
          const key = `${player.name}_${player.team}`;
          playerExposureMap.set(key, (playerExposureMap.get(key) || 0) + 1);
        });
      }
    });
    
    // Enhance player data with exposure information
    const enhancedPlayerData = playerProjections.map(player => {
      const key = `${player.name}_${player.team}`;
      const exposureCount = playerExposureMap.get(key) || 0;
      const exposurePercentage = lineups.length > 0 ? (exposureCount / lineups.length) * 100 : 0;
      
      return {
        ...player,
        exposure: exposurePercentage,
        exposureCount: exposureCount,
        totalLineups: lineups.length
      };
    });
    
    res.json({
      success: true,
      data: enhancedPlayerData,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error fetching player data for AI:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get current lineups with metadata for AI analysis
app.get("/api/data/lineups", (req, res) => {
  try {
    // Add metadata to lineups
    const lineupsWithMetadata = lineups.map(lineup => {
      // Calculate total salary
      const captainSalary = lineup.cpt?.salary || 0;
      const playersSalary = lineup.players?.reduce((sum, p) => sum + (p.salary || 0), 0) || 0;
      const totalSalary = captainSalary + playersSalary;
      
      // Get team composition
      const teamComposition = {};
      if (lineup.cpt) {
        teamComposition[lineup.cpt.team] = (teamComposition[lineup.cpt.team] || 0) + 1;
      }
      lineup.players?.forEach(player => {
        teamComposition[player.team] = (teamComposition[player.team] || 0) + 1;
      });
      
      return {
        ...lineup,
        totalSalary,
        teamComposition,
        playerCount: 1 + (lineup.players?.length || 0)
      };
    });
    
    res.json({
      success: true,
      data: lineupsWithMetadata,
      count: lineups.length,
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error fetching lineups for AI:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get aggregated exposure data for AI analysis
app.get("/api/data/exposures", (req, res) => {
  try {
    const exposures = calculateExposures(lineups);
    
    res.json({
      success: true,
      data: {
        team: exposures.teamExposure,
        position: exposures.positionExposure,
        totalLineups: lineups.length,
        averageSalary: lineups.reduce((sum, l) => sum + (l.salary || 0), 0) / (lineups.length || 1),
        averageProjection: lineups.reduce((sum, l) => sum + (l.projectedPoints || 0), 0) / (lineups.length || 1)
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error calculating exposures for AI:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});

// Get contest metadata and team stacks for AI
app.get("/api/data/contest", (req, res) => {
  try {
    res.json({
      success: true,
      data: {
        metadata: contestMetadata,
        teamStacks: teamStacks,
        settings: settings,
        entryIds: contestEntryIds
      },
      timestamp: new Date().toISOString()
    });
  } catch (error) {
    console.error("Error fetching contest data for AI:", error);
    res.status(500).json({ success: false, error: error.message });
  }
});


// Upload player projections
app.post(
  "/players/projections/upload",
  upload.single("file"),
  async (req, res) => {
    if (!req.file) {
      return res.status(400).json({ error: "No file uploaded" });
    }

    try {
      console.log(`Processing player projections from: ${req.file.path}`);
      const parsedPlayers = await parsePlayersCSV(req.file.path);

      if (parsedPlayers.length === 0) {
        return res.status(400).json({
          error: "No valid player data found in the file",
          message:
            "The uploaded file did not contain any valid player data. Please check the file format.",
        });
      }

      // Enhanced data validation with new validator
      const validator = new DataValidator();
      const validationResult = validator.validatePlayerPool(parsedPlayers);
      
      if (!validationResult.isValid) {
        return res.status(400).json({
          error: "Data validation failed",
          message: "The uploaded data contains errors that prevent optimization",
          details: validationResult.errors,
          warnings: validationResult.warnings
        });
      }

      // Replace playerProjections with new data
      playerProjections = parsedPlayers;
      
      // Reset optimizer when new data is loaded
      optimizerInitialized = false;
      hybridOptimizer = null;

      console.log(`Successfully loaded ${playerProjections.length} players`);
      
      const response = {
        success: true,
        message: `Loaded ${playerProjections.length} player projections successfully`,
        validation: validator.generateReport(validationResult)
      };
      
      // Include warnings if any
      if (validationResult.warnings.length > 0) {
        response.warnings = validationResult.warnings;
      }
      
      res.json(response);
    } catch (error) {
      console.error("Error processing player projections:", error);
      res
        .status(500)
        .json({ error: "Error processing file", message: error.message });
    }
  }
);

// Team stacks upload endpoint
app.post("/teams/stacks/upload", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    console.log(`Processing team stacks from: ${req.file.path}`);
    const parsedStacks = await parseStacksCSV(req.file.path);
    console.log(`Parsed ${parsedStacks.length} stacks from CSV`);

    if (parsedStacks.length === 0) {
      // Use a warning instead of a hard error
      console.warn(
        "No stacks found in file. This is unusual but proceeding anyway."
      );
    }

    // Enhanced stacks processing - add more useful data for the UI
    if (playerProjections.length > 0) {
      console.log("Enhancing stacks with player data");
      // Get team stats to enhance the stacks
      const teamGroups = {};

      // Group players by team
      playerProjections.forEach((player) => {
        if (!player.team) return;

        if (!teamGroups[player.team]) {
          teamGroups[player.team] = {
            players: [],
            totalProjection: 0,
          };
        }

        teamGroups[player.team].players.push(player);
        teamGroups[player.team].totalProjection += Number(
          player.projectedPoints || 0
        );
      });

      // Calculate additional stats for each stack
      parsedStacks.forEach((stack) => {
        const teamData = teamGroups[stack.team];

        if (teamData) {
          // Get players in this stack
          const stackPlayers = teamData.players.filter((player) =>
            stack.stack.includes(player.position)
          );

          // Calculate stack-specific projections
          const stackProjection = stackPlayers.reduce(
            (sum, player) => sum + Number(player.projectedPoints || 0),
            0
          );

          // Calculate ownership for the stack
          const avgStackOwnership =
            stackPlayers.length > 0
              ? stackPlayers.reduce(
                  (sum, p) => sum + Number(p.ownership || 0),
                  0
                ) / stackPlayers.length
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
      stacks: teamStacks,
    });
  } catch (error) {
    console.error("Error processing team stacks:", error);
    res.status(500).json({
      error: "Error processing file",
      message: error.message,
    });
  }
});

// Import DraftKings player pool and contest info
app.post("/draftkings/import", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    console.log(`Processing DraftKings player pool from: ${req.file.path}`);
    
    const results = [];
    
    // Parse CSV
    await new Promise((resolve, reject) => {
      fs.createReadStream(req.file.path)
        .pipe(csv())
        .on("data", (row) => {
          results.push(row);
        })
        .on("end", () => resolve())
        .on("error", reject);
    });
    
    console.log(`Read ${results.length} rows from DraftKings CSV`);
    
    // Extract contest metadata and player ID mapping
    let extractedContestMetadata = null;
    const tempPlayerMapping = new Map();
    const tempEntryIds = [];
    
    for (const row of results) {
      // Store contest metadata from first valid row
      if (!extractedContestMetadata && row["Contest Name"] && row["Contest ID"]) {
        extractedContestMetadata = {
          contestName: row["Contest Name"],
          contestId: row["Contest ID"],
          entryFee: row["Entry Fee"]
        };
      }
      
      // Extract Entry IDs from contest lineup rows
      if (row["Entry ID"] && !isNaN(row["Entry ID"])) {
        const entryId = parseInt(row["Entry ID"]);
        if (!tempEntryIds.includes(entryId)) {
          tempEntryIds.push(entryId);
        }
      }
      
      const rowIndex = results.indexOf(row);
      
      // Check if this is a DraftKings salaries file format (has Position, Name + ID, Name, ID columns)
      if (row["Position"] && row["Name + ID"] && row["Name"] && row["ID"]) {
        const position = row["Position"];
        const nameAndId = row["Name + ID"];
        const playerName = row["Name"];
        const playerId = row["ID"];
        
        if (playerName && playerId) {
          // Trim whitespace from player names
          const cleanPlayerName = playerName.trim();
          // Map by name and position for precise matching
          tempPlayerMapping.set(`${cleanPlayerName}_${position}`, playerId);
          // Also map by name alone for fallback
          tempPlayerMapping.set(cleanPlayerName, playerId);
        }
      }
      // Fall back to extracting from lineup rows if not salaries format
      else if (rowIndex >= 0 && rowIndex < 20 && row["CPT"]) {
        const positions = ["CPT", "TOP", "JNG", "MID", "ADC", "SUP", "TEAM"];
        
        positions.forEach(position => {
          const playerData = row[position];
          if (playerData && playerData.includes("(") && playerData.includes(")")) {
            // Extract player name and ID from format "PlayerName (PlayerID)"
            const playerName = extractPlayerName(playerData);
            const playerId = extractPlayerId(playerData);
            
            if (playerName && playerId) {
              // Map by name and position for precise matching
              tempPlayerMapping.set(`${playerName}_${position}`, playerId);
              // Also map by name alone for fallback
              tempPlayerMapping.set(playerName, playerId);
            }
          }
        });
      }
    }
    
    // Store globally - preserve existing contest metadata if this is a salaries file
    if (extractedContestMetadata) {
      contestMetadata = extractedContestMetadata;
      contestEntryIds = tempEntryIds.sort((a, b) => a - b); // Sort Entry IDs
    }
    
    // Always update player ID mapping
    if (tempPlayerMapping.size > 0) {
      // Merge with existing mapping to preserve previous mappings
      tempPlayerMapping.forEach((value, key) => {
        playerIdMapping.set(key, value);
      });
    }
    
    // Update existing player projections with DraftKings IDs
    let mappedCount = 0;
    playerProjections.forEach(player => {
      const dkId = playerIdMapping.get(`${player.name}_${player.position}`) || 
                  playerIdMapping.get(player.name);
      if (dkId) {
        player.draftKingsId = dkId;
        mappedCount++;
      }
    });
    
    console.log(`Mapped ${mappedCount}/${playerProjections.length} players to DraftKings IDs`);
    if (extractedContestMetadata) {
      console.log(`Contest: ${extractedContestMetadata.contestName} (ID: ${extractedContestMetadata.contestId})`);
    }
    if (contestEntryIds.length > 0) {
      console.log(`Loaded ${contestEntryIds.length} Entry IDs`);
    }
    
    // Debug: Show which players failed to map
    if (mappedCount < playerProjections.length) {
      console.log("\nPlayers from ROO that couldn't be mapped:");
      playerProjections.forEach(player => {
        if (!player.draftKingsId) {
          console.log(`- ROO: "${player.name}" (${player.position})`);
        }
      });
      
      console.log("\nFirst few DraftKings players found:");
      let count = 0;
      for (const [key, value] of tempPlayerMapping) {
        if (count < 10) {
          console.log(`- DK: "${key}" -> ${value}`);
          count++;
        }
      }
    }
    
    res.json({
      success: true,
      message: `Imported DraftKings contest data successfully`,
      contestMetadata: extractedContestMetadata,
      playersWithIds: mappedCount,
      totalPlayers: playerProjections.length
    });
    
  } catch (error) {
    console.error("Error processing DraftKings import:", error);
    res.status(500).json({ 
      error: "Error processing file", 
      message: error.message 
    });
  }
});

// Upload DraftKings entries
app.post("/lineups/dkentries", upload.single("file"), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    console.log(`Processing DraftKings entries from: ${req.file.path}`);
    const extractedLineups = await processDraftKingsFile(req.file.path);

    if (extractedLineups.length === 0) {
      return res.status(400).json({
        error: "No valid lineup data found in the file",
        message:
          "The uploaded file did not contain any valid lineup data. Please check the file format.",
      });
    }

    // Add new lineups to our store
    lineups = [...lineups, ...extractedLineups];

    console.log(`Successfully imported ${extractedLineups.length} lineups`);
    res.json({
      success: true,
      lineups: extractedLineups,
      message: `Imported ${extractedLineups.length} lineups successfully`,
    });
  } catch (error) {
    console.error("Error processing DraftKings file:", error);
    res
      .status(500)
      .json({ error: "Error processing file", message: error.message });
  }
});

// Import JSON lineups
app.post("/lineups/import", upload.single("file"), (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: "No file uploaded" });
  }

  try {
    console.log(`Processing JSON lineups from: ${req.file.path}`);
    const fileContent = fs.readFileSync(req.file.path, "utf8");
    let importedLineups;

    try {
      importedLineups = JSON.parse(fileContent);
    } catch (parseError) {
      return res.status(400).json({
        error: "Invalid JSON format",
        message:
          "The uploaded file is not valid JSON. Please check the file format.",
      });
    }

    if (!Array.isArray(importedLineups)) {
      return res.status(400).json({
        error: "Invalid lineup format",
        message: "The JSON file must contain an array of lineups.",
      });
    }

    if (importedLineups.length === 0) {
      return res.status(400).json({
        error: "No lineups found",
        message: "The JSON file contains an empty array. No lineups to import.",
      });
    }

    // Add IDs if missing
    const processedLineups = importedLineups.map((lineup) => ({
      ...lineup,
      id: lineup.id || generateRandomId(),
    }));

    // Add new lineups to our store
    lineups = [...lineups, ...processedLineups];

    console.log(
      `Successfully imported ${processedLineups.length} lineups from JSON`
    );
    res.json({
      success: true,
      lineups: processedLineups,
      message: `Imported ${processedLineups.length} lineups successfully`,
    });
  } catch (error) {
    console.error("Error importing JSON lineups:", error);
    res
      .status(500)
      .json({ error: "Error processing file", message: error.message });
  }
});

// Initialize hybrid optimizer
app.post("/optimizer/initialize", async (req, res) => {
  try {
    const { exposureSettings = {}, contestInfo = {} } = req.body;
    
    // Check if we have necessary data
    if (playerProjections.length === 0) {
      return res.status(400).json({
        error: "No player projections available",
        message: "Please upload player projections data before initializing optimizer.",
      });
    }

    // Create new hybrid optimizer instance
    hybridOptimizer = new HybridOptimizer({
      fieldSizes: {
        cash: contestInfo.fieldSize || 100,
        double_up: contestInfo.fieldSize || 200,
        gpp: contestInfo.fieldSize || 1000,
        tournament: contestInfo.fieldSize || 1000,
        single_entry: contestInfo.fieldSize || 150000,
      }
    });

    // Set up progress callbacks if needed (for WebSocket or Server-Sent Events)
    hybridOptimizer.setProgressCallback((progress, stage) => {
      // Could emit progress updates via WebSocket here
    });

    hybridOptimizer.setStatusCallback((status) => {
      // Could emit status updates via WebSocket here
    });

    // Initialize with current data - don't pass existing lineups for fresh generation
    const initResult = await hybridOptimizer.initialize(
      playerProjections,
      exposureSettings,
      [], // Empty array for fresh lineup generation
      contestInfo
    );

    optimizerInitialized = true;

    res.json({
      success: true,
      message: "Hybrid optimizer initialized successfully",
      ...initResult
    });

  } catch (error) {
    console.error("Error initializing hybrid optimizer:", error);
    res.status(500).json({
      error: "Error initializing optimizer",
      message: error.message
    });
  }
});

// Get available optimization strategies
app.get("/optimizer/strategies", (req, res) => {
  if (!hybridOptimizer) {
    return res.status(400).json({
      error: "Optimizer not initialized",
      message: "Please initialize the optimizer first"
    });
  }

  try {
    const strategies = hybridOptimizer.getStrategies();
    res.json({
      success: true,
      strategies,
      stats: hybridOptimizer.getStats()
    });
  } catch (error) {
    console.error("Error getting strategies:", error);
    res.status(500).json({
      error: "Error retrieving strategies",
      message: error.message
    });
  }
});

// Generate lineups with hybrid optimizer
app.post("/lineups/generate-hybrid", async (req, res) => {
  const { 
    count = 5, 
    strategy = 'recommended', 
    customConfig = {},
    saveToLineups = true,
    exposureSettings = {},  // Add exposureSettings from request body
    stackExposureTargets = {}, // Add stack exposure targets from request body
    progressSessionId = null  // Session ID for progress updates
  } = req.body;
  
  
  // Debug: Log available teams
  const availableTeams = [...new Set(playerProjections.map(p => p.team))].filter(Boolean);
  
  

  try {
    // Check if optimizer is initialized
    if (!hybridOptimizer || !optimizerInitialized) {
      return res.status(400).json({
        error: "Optimizer not initialized",
        message: "Please initialize the hybrid optimizer first"
      });
    }

    // Calculate actual lineup count for generation (portfolio needs bulk generation)
    const bulkMultiplier = customConfig.bulkGenerationMultiplier || 1;
    const candidateCount = strategy === 'portfolio' ? count * bulkMultiplier : count;
    

    // Use the same method as Advanced Optimizer - runSimulation
    // Create an AdvancedOptimizer instance for lineup generation
    const AdvancedOptimizer = require("./client/src/lib/AdvancedOptimizer");
    const lineupOptimizer = new AdvancedOptimizer({
      salaryCap: 50000,
      debugMode: true, // Enable debug logging to see alerts
      positionRequirements: {
        CPT: 1, TOP: 1, JNG: 1, MID: 1, ADC: 1, SUP: 1, TEAM: 1
      },
      iterations: 10000,
      randomness: 0.4,  // Higher randomness for uniqueness
      targetTop: 0.2,
      leverageMultiplier: 1.0,
      fieldSize: 1000,
      debugMode: false
    });

    // Set up progress callbacks - use real SSE if session ID provided
    let progressCallback, statusCallback;
    
    if (progressSessionId && progressSessions.has(progressSessionId)) {
      const callbacks = createProgressCallbacks(progressSessionId);
      progressCallback = callbacks.progressCallback;
      statusCallback = callbacks.statusCallback;
    } else {
      progressCallback = (percent, stage) => {
        console.log(`Progress: ${percent}% - ${stage}`);
      };
      statusCallback = (status) => {
        console.log(`Status: ${status}`);
      };
    }

    lineupOptimizer.setProgressCallback(progressCallback);
    lineupOptimizer.setStatusCallback(statusCallback);

    // Initialize the lineup optimizer
    await lineupOptimizer.initialize(playerProjections, exposureSettings, [], teamStacks);
    
    // Generate lineups using the working runSimulation method
    const result = await lineupOptimizer.runSimulation(candidateCount);

    if (result && result.lineups) {
      
      // For portfolio strategy, select the best lineups from candidates
      let selectedLineups = result.lineups;
      
      
      if (strategy === 'portfolio' && result.lineups.length > count) {
        // Use balanced selection that considers both score and team diversity
        // Use actual stack exposure targets instead of equal distribution
        const teamCounts = {};
        const teamTargets = {};
        
        // Parse stack exposure targets to get team-specific limits
        Object.keys(stackExposureTargets).forEach(key => {
          if (key.includes('_target')) {
            const team = key.split('_')[0];
            const targetPct = stackExposureTargets[key] / 100; // Convert percentage to decimal
            teamTargets[team] = Math.round(count * targetPct); // Calculate target lineup count
          }
        });
        
        
        selectedLineups = result.lineups
          .sort((a, b) => {
            const scoreA = (a.nexusScore || 0) + (a.roi || 0) * 0.1;
            const scoreB = (b.nexusScore || 0) + (b.roi || 0) * 0.1;
            return scoreB - scoreA;
          })
          .filter(lineup => {
            const team = lineup._primaryStackTeam || 'Unknown';
            const target = teamTargets[team] || Math.ceil(count / 4); // Fallback to equal distribution
            if ((teamCounts[team] || 0) < target) {
              teamCounts[team] = (teamCounts[team] || 0) + 1;
              return true;
            }
            return false;
          })
          .slice(0, count);
        
      }
      
      
      // Format lineups to match existing structure
      const formattedLineups = selectedLineups.map((lineup) => ({
        id: lineup.id || generateRandomId(),
        name: lineup.name || `Hybrid Lineup ${generateRandomId()}`,
        cpt: {
          id: lineup.cpt.id,
          name: lineup.cpt.name,
          position: "CPT",
          team: lineup.cpt.team,
          salary: lineup.cpt.salary,
        },
        players: lineup.players.map((player) => ({
          id: player.id,
          name: player.name,
          position: player.position,
          team: player.team,
          salary: player.salary,
        })),
        // Include optimization metadata
        nexusScore: lineup.nexusScore,
        roi: lineup.roi,
        sourceAlgorithm: lineup.sourceAlgorithm,
        projectedPoints: lineup.projectedPoints
      }));

      // Add to lineups store if requested
      if (saveToLineups) {
        // Replace lineups instead of accumulating for fresh generation
        lineups = formattedLineups;
      }

      
      // Send final progress update if using SSE
      if (progressSessionId && progressSessions.has(progressSessionId)) {
        statusCallback('Completed successfully');
        progressCallback(100, 'Generation complete');
        
        // Clean up the session after a short delay
        setTimeout(() => {
          if (progressSessions.has(progressSessionId)) {
            const session = progressSessions.get(progressSessionId);
            if (session.res && !session.res.destroyed) {
              session.res.end();
            }
            progressSessions.delete(progressSessionId);
            progressCallbacks.delete(progressSessionId);
          }
        }, 1000);
      }
      
      res.json({
        success: true,
        lineups: formattedLineups,
        message: `Generated ${formattedLineups.length} unique lineups successfully`,
        strategy: { name: strategy, algorithm: 'advanced_optimizer' },
        summary: {
          algorithm: 'advanced_optimizer',
          averageROI: result.summary?.averageROI || 0,
          averageNexusScore: result.summary?.averageNexusScore || 0,
          uniqueLineups: formattedLineups.length,
          diversityScore: result.summary?.diversityScore || 0
        },
        recommendations: []
      });
    } else {
      // Handle error case for SSE
      if (progressSessionId && progressSessions.has(progressSessionId)) {
        statusCallback('Failed - no results generated');
        progressCallback(0, 'Generation failed');
        
        setTimeout(() => {
          if (progressSessions.has(progressSessionId)) {
            const session = progressSessions.get(progressSessionId);
            if (session.res && !session.res.destroyed) {
              session.res.end();
            }
            progressSessions.delete(progressSessionId);
            progressCallbacks.delete(progressSessionId);
          }
        }, 1000);
      }
      
      res.status(400).json({
        error: "Error generating lineups",
        message: "Hybrid optimizer returned no results"
      });
    }
  } catch (error) {
    console.error("Error generating hybrid lineups:", error);
    
    // Handle error case for SSE
    if (progressSessionId && progressSessions.has(progressSessionId)) {
      statusCallback('Failed with error');
      progressCallback(0, `Error: ${error.message}`);
      
      setTimeout(() => {
        if (progressSessions.has(progressSessionId)) {
          const session = progressSessions.get(progressSessionId);
          if (session.res && !session.res.destroyed) {
            session.res.end();
          }
          progressSessions.delete(progressSessionId);
          progressCallbacks.delete(progressSessionId);
        }
      }, 1000);
    }
    
    res.status(500).json({
      error: "Error generating lineups",
      message: error.message
    });
  }
});

// Get optimizer statistics and performance
app.get("/optimizer/stats", (req, res) => {
  if (!hybridOptimizer) {
    return res.status(400).json({
      error: "Optimizer not initialized",
      message: "Please initialize the optimizer first"
    });
  }

  try {
    const stats = hybridOptimizer.getStats();
    res.json({
      success: true,
      stats
    });
  } catch (error) {
    console.error("Error getting optimizer stats:", error);
    res.status(500).json({
      error: "Error retrieving stats",
      message: error.message
    });
  }
});

// Validate data endpoint
app.post("/data/validate", (req, res) => {
  try {
    const { players, teamStacks } = req.body;
    
    if (!players || !Array.isArray(players)) {
      return res.status(400).json({
        error: "Invalid request",
        message: "Players array is required"
      });
    }

    const validator = new DataValidator();
    
    // Validate player pool
    const playerValidation = validator.validatePlayerPool(players);
    const response = {
      success: playerValidation.isValid,
      players: validator.generateReport(playerValidation)
    };

    // Validate team stacks if provided
    if (teamStacks && Array.isArray(teamStacks)) {
      const stackValidation = validator.validateTeamStacks(teamStacks, players);
      response.teamStacks = stackValidation;
    }

    res.json(response);
  } catch (error) {
    console.error("Error validating data:", error);
    res.status(500).json({
      error: "Error validating data",
      message: error.message
    });
  }
});

// Generate lineups (legacy endpoint - keep for backward compatibility)
app.post("/lineups/generate", async (req, res) => {
  const { count = 5, settings: reqSettings = {} } = req.body;
  

  // Check if we have necessary data
  if (playerProjections.length === 0) {
    return res.status(400).json({
      error: "No player projections available",
      message:
        "Please upload player projections data before generating lineups.",
    });
  }

  if (teamStacks.length === 0) {
    return res.status(400).json({
      error: "No team stacks available",
      message: "Please upload team stacks data before generating lineups.",
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
        ...reqSettings,
      },
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
        message: `Generated ${newLineups.length} lineups successfully`,
      });
    } else {
      // Error occurred during lineup generation
      res.status(400).json({
        error: newLineups.error || "Error generating lineups",
        message:
          newLineups.message || "An error occurred during lineup generation.",
      });
    }
  } catch (error) {
    console.error("Error generating lineups:", error);
    res
      .status(500)
      .json({ error: "Error generating lineups", message: error.message });
  }
});

// Run simulation
app.post("/simulation/run", (req, res) => {
  const { settings: simSettings, lineups: lineupIds } = req.body;

  // Validate inputs
  if (!lineupIds || !Array.isArray(lineupIds) || lineupIds.length === 0) {
    return res.status(400).json({
      error: "No lineups selected",
      message: "Please select at least one lineup to run the simulation.",
    });
  }

  if (playerProjections.length === 0) {
    return res.status(400).json({
      error: "No player projections available",
      message:
        "Please upload player projections data before running a simulation.",
    });
  }

  // Run simulation
  try {
    console.log(`Running simulation for ${lineupIds.length} lineups`);
    const results = simulateLineups(lineupIds, simSettings || settings);

    if (results.error) {
      return res.status(400).json({
        error: results.error,
        message: results.message || "An error occurred during simulation.",
      });
    }

    console.log("Simulation completed successfully");
    res.json(results);
  } catch (error) {
    console.error("Error running simulation:", error);
    res
      .status(500)
      .json({ error: "Error running simulation", message: error.message });
  }
});

// Delete lineup
app.delete("/lineups/:id", (req, res) => {
  const id = parseInt(req.params.id) || req.params.id;

  // Find the lineup
  const index = lineups.findIndex((lineup) => lineup.id == id);

  if (index === -1) {
    return res.status(404).json({
      error: "Lineup not found",
      message: `No lineup with ID ${id} was found.`,
    });
  }

  // Remove the lineup
  lineups.splice(index, 1);

  console.log(`Deleted lineup with ID: ${id}`);
  res.json({
    success: true,
    message: "Lineup deleted successfully",
  });
});

// Delete multiple players (must come before single player route)
app.delete("/players/bulk", (req, res) => {
  const { playerIds } = req.body;

  if (!playerIds || !Array.isArray(playerIds) || playerIds.length === 0) {
    return res.status(400).json({
      error: "Invalid request",
      message: "playerIds array is required and must not be empty",
    });
  }

  const deletedPlayers = [];
  const notFoundIds = [];

  // Process each player ID
  playerIds.forEach(id => {
    const index = playerProjections.findIndex((player) => player.id == id);
    
    if (index === -1) {
      notFoundIds.push(id);
    } else {
      const player = playerProjections[index];
      deletedPlayers.push({
        id: player.id,
        name: player.name,
        team: player.team,
        position: player.position
      });
      playerProjections.splice(index, 1);
    }
  });

  // Reset optimizer when player data changes
  if (deletedPlayers.length > 0) {
    optimizerInitialized = false;
    hybridOptimizer = null;
  }

  console.log(`Deleted ${deletedPlayers.length} players. Not found: ${notFoundIds.length}`);
  
  res.json({
    success: true,
    message: `Deleted ${deletedPlayers.length} players successfully`,
    deletedPlayers,
    notFoundIds: notFoundIds.length > 0 ? notFoundIds : undefined
  });
});

// Delete single player
app.delete("/players/:id", (req, res) => {
  const id = req.params.id;

  // Find the player
  const index = playerProjections.findIndex((player) => player.id == id);

  if (index === -1) {
    return res.status(404).json({
      error: "Player not found",
      message: `No player with ID ${id} was found.`,
    });
  }

  // Get player info for logging
  const player = playerProjections[index];

  // Remove the player
  playerProjections.splice(index, 1);

  // Reset optimizer when player data changes
  optimizerInitialized = false;
  hybridOptimizer = null;

  console.log(`Deleted player: ${player.name} (${player.team} - ${player.position})`);
  res.json({
    success: true,
    message: "Player deleted successfully",
    deletedPlayer: {
      id: player.id,
      name: player.name,
      team: player.team,
      position: player.position
    }
  });
});

// Add a new endpoint to calculate team stats
app.get("/teams/stats", (req, res) => {
  try {
    // Validate that we have the necessary data
    if (playerProjections.length === 0) {
      return res.status(400).json({
        error: "No player projections available",
        message: "Please upload player projections data first.",
      });
    }

    // Group players by team
    const teamMap = {};

    playerProjections.forEach((player) => {
      if (!player.team) return;

      if (!teamMap[player.team]) {
        teamMap[player.team] = {
          name: player.team,
          players: [],
          totalProjection: 0,
          totalSalary: 0,
          avgOwnership: 0,
        };
      }

      teamMap[player.team].players.push(player);
      teamMap[player.team].totalProjection += Number(
        player.projectedPoints || 0
      );
      teamMap[player.team].totalSalary += Number(player.salary || 0);
    });

    // Calculate averages and additional stats
    const teamStats = Object.values(teamMap).map((team) => {
      const playerCount = team.players.length;
      const ownerships = team.players
        .map((p) => Number(p.ownership || 0))
        .filter((o) => !isNaN(o));

      const avgOwnership =
        ownerships.length > 0
          ? ownerships.reduce((sum, o) => sum + o, 0) / ownerships.length
          : 0;

      // Add positions breakdown
      const positionCounts = {
        TOP: 0,
        JNG: 0,
        MID: 0,
        ADC: 0,
        SUP: 0,
      };

      team.players.forEach((player) => {
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
        positionCounts,
      };
    });

    // Sort by total projection (descending)
    teamStats.sort((a, b) => b.totalProjection - a.totalProjection);

    res.json(teamStats);
  } catch (error) {
    console.error("Error calculating team stats:", error);
    res.status(500).json({
      error: "Error processing team stats",
      message: error.message,
    });
  }
});

// NexusScore formula endpoints
app.post("/nexusscore/formula", async (req, res) => {
  try {
    const formulaData = req.body;

    // Save the formula to a file
    const formulaPath = path.join(__dirname, "data", "nexusscore-formula.json");

    // Create the data directory if it doesn't exist
    if (!fs.existsSync(path.join(__dirname, "data"))) {
      fs.mkdirSync(path.join(__dirname, "data"), { recursive: true });
    }

    // Write the formula to the file
    fs.writeFileSync(formulaPath, JSON.stringify(formulaData, null, 2));

    res.json({ success: true, message: "Formula saved successfully" });
  } catch (error) {
    console.error("Error saving NexusScore formula:", error);
    res.status(500).json({ error: error.message });
  }
});

// Cleanup function
const cleanup = () => {
  console.log('\nReceived SIGTERM. Starting cleanup...');
  
  // Clean up uploads directory
  const uploadDir = path.join(__dirname, 'uploads');
  if (fs.existsSync(uploadDir)) {
    try {
      const files = fs.readdirSync(uploadDir);
      files.forEach(file => {
        fs.unlinkSync(path.join(uploadDir, file));
      });
      console.log('Cleaning up uploads directory...');
    } catch (err) {
      console.error('Error cleaning uploads:', err.message);
    }
  }
  
  // Clear in-memory data
  players = [];
  teamStacks = [];
  playerHash = {};
  stackHash = {};
  savedLineups = [];
  customLineups = [];
  lastUploadedCSV = null;
  entryExposures = {};
  
  console.log('Upload cleanup completed');
  console.log('Cleanup completed. Exiting...');
  process.exit(0);
};

// Handle termination signals
process.on('SIGTERM', cleanup);
process.on('SIGINT', cleanup);

// Start the server
app.listen(PORT, () => {
  console.log(`LoL DFS Optimization Server running on port ${PORT}`);
});
