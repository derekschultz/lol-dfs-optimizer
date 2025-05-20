const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const multer = require("multer");
const fs = require("fs");
const path = require("path");
const csv = require("csv-parser");

// Import the AdvancedOptimizer class
const AdvancedOptimizer = require("./client/src/lib/AdvancedOptimizer");

const initializeUploadCleanup = require("./uploadCleanup");
// Initialize cleanup utility
const cleanup = initializeUploadCleanup();

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
let settings = {
  iterations: 2000,
  fieldSize: 1176,
  entryFee: 5,
  outputDir: "./output",
  maxWorkers: 4,
};

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
        TEAM: 1,
      },
      iterations: settings.iterations || 2000,
      randomness: 0.2,
      targetTop: 0.1,
      leverageMultiplier: 0.7,
      debugMode: true, // Enable for detailed logging
    });

    // Initialize the optimizer with player data
    const initSuccess = await optimizer.initialize(
      playerProjections,
      {},
      lineups // Existing lineups to consider
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
          // We know the exact column names: Team and Stack+
          const stack = {
            id: generateRandomId(),
            team: data.Team || "",
            stack: [], // Will be populated below
            stackPlus: parseFloat(data["Stack+"] || 0) || 0,
            stackPlusValue: parseFloat(data["Stack+"] || 0) || 0,
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

        // Process results into lineups
        const extractedLineups = [];

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

// API Routes
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

// Get settings
app.get("/settings", (req, res) => {
  res.json(settings);
});

// Save settings
app.post("/settings", (req, res) => {
  settings = req.body;
  res.json({ success: true, message: "Settings saved successfully" });
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

      // Replace playerProjections with new data
      playerProjections = parsedPlayers;

      console.log(`Successfully loaded ${playerProjections.length} players`);
      res.json({
        success: true,
        message: `Loaded ${playerProjections.length} player projections successfully`,
      });
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

// Generate lineups
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

// Start the server
app.listen(PORT, () => {
  console.log(`LoL DFS Optimization Server running on port ${PORT}`);
});
