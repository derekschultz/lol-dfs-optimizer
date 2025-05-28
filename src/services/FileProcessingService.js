/**
 * FileProcessingService
 * Handles all file processing operations (CSV, JSON parsing and generation)
 */

const fs = require("fs");
const csv = require("csv-parser");
const { generateRandomId, generateLineupId } = require("../utils/generators");
const { AppError } = require("../middleware/errorHandler");

class FileProcessingService {
  constructor() {
    this.supportedFormats = ["csv", "json"];
    this.csvOptions = {
      skipLines: 0,
      strict: false,
      trim: true,
      skipEmptyLines: true,
    };
  }

  // Generic CSV parser
  async parseCSV(filePath, options = {}) {
    const csvOptions = { ...this.csvOptions, ...options };

    return new Promise((resolve, reject) => {
      // First check if file exists and is readable
      if (!fs.existsSync(filePath)) {
        return reject(new AppError("File not found", 404));
      }

      // Check file content
      fs.readFile(filePath, "utf8", (err, fileContent) => {
        if (err) {
          return reject(new AppError("Error reading file", 500));
        }

        if (fileContent.length === 0) {
          return reject(new AppError("CSV file is empty", 400));
        }

        // Parse the CSV
        const results = [];
        fs.createReadStream(filePath)
          .pipe(csv(csvOptions))
          .on("data", (data) => results.push(data))
          .on("end", () => resolve(results))
          .on("error", (error) =>
            reject(new AppError(`CSV parsing error: ${error.message}`, 400))
          );
      });
    });
  }

  // Parse players CSV (extracted from original parsePlayersCSV)
  async parsePlayersCSV(filePath) {
    try {
      const csvData = await this.parseCSV(filePath);
      const processedPlayers = [];

      for (const data of csvData) {
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
          opp:
            data.opp ||
            data.OPP ||
            data.Opp ||
            data.opponent ||
            data.Opponent ||
            "",
        };

        // Only add valid players with a name and projectedPoints > 0
        if (player.name && player.projectedPoints > 0) {
          // Calculate value (points per $1000)
          player.value =
            player.salary > 0
              ? (player.projectedPoints / (player.salary / 1000)).toFixed(2)
              : 0;

          processedPlayers.push(player);
        }
      }

      return processedPlayers;
    } catch (error) {
      if (error.statusCode) throw error;
      throw new AppError("Failed to parse players CSV", 500);
    }
  }

  // Parse team stacks CSV (extracted from original parseStacksCSV)
  async parseStacksCSV(filePath) {
    try {
      const csvData = await this.parseCSV(filePath);
      const processedStacks = [];

      for (const data of csvData) {
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
          continue;
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
          processedStacks.push(stack);
        }
      }

      return processedStacks;
    } catch (error) {
      if (error.statusCode) throw error;
      throw new AppError("Failed to parse team stacks CSV", 500);
    }
  }

  // Parse DraftKings entries CSV (extracted from original processDraftKingsFile)
  async parseDraftKingsCSV(filePath) {
    try {
      // Check if it's a League of Legends format file
      const fileContent = fs.readFileSync(filePath, "utf-8");
      const hasLolPositions =
        fileContent.includes("TOP") &&
        fileContent.includes("JNG") &&
        fileContent.includes("MID") &&
        fileContent.includes("ADC") &&
        fileContent.includes("SUP");

      if (!hasLolPositions) {
        throw new AppError(
          "The file does not appear to be a League of Legends DraftKings file. Expected positions (TOP, JNG, MID, ADC, SUP) were not found.",
          400
        );
      }

      const csvData = await this.parseCSV(filePath);
      const extractedLineups = [];

      for (const row of csvData) {
        try {
          // Skip header rows or invalid entries
          if (
            row["Entry ID"] === "Entry ID" ||
            !row["Entry ID"] ||
            isNaN(row["Entry ID"])
          ) {
            continue;
          }

          // Generate lineup from DraftKings format
          const lineup = this.parseDraftKingsEntry(row);
          if (lineup) {
            extractedLineups.push(lineup);
          }
        } catch (error) {
          console.warn("Failed to process DraftKings entry:", error.message);
          continue;
        }
      }

      return extractedLineups;
    } catch (error) {
      if (error.statusCode) throw error;
      throw new AppError("Failed to parse DraftKings CSV", 500);
    }
  }

  // Parse DraftKings salaries/contest CSV for player ID mapping
  async parseDraftKingsPlayerMappingCSV(filePath) {
    try {
      const csvData = await this.parseCSV(filePath);
      const contestMetadata = null;
      const playerMapping = new Map();
      const entryIds = [];

      for (const row of csvData) {
        // Extract contest metadata from first valid row
        let extractedContestMetadata = null;
        if (
          !extractedContestMetadata &&
          row["Contest Name"] &&
          row["Contest ID"]
        ) {
          extractedContestMetadata = {
            contestName: row["Contest Name"],
            contestId: row["Contest ID"],
            entryFee: row["Entry Fee"],
          };
        }

        // Extract Entry IDs from contest lineup rows
        if (row["Entry ID"] && !isNaN(row["Entry ID"])) {
          const entryId = parseInt(row["Entry ID"]);
          if (!entryIds.includes(entryId)) {
            entryIds.push(entryId);
          }
        }

        // Check if this is a DraftKings salaries file format
        if (row["Position"] && row["Name + ID"] && row["Name"] && row["ID"]) {
          const position = row["Position"];
          const playerName = row["Name"];
          const playerId = row["ID"];

          if (playerName && playerId) {
            const cleanPlayerName = playerName.trim();
            playerMapping.set(`${cleanPlayerName}_${position}`, playerId);
            playerMapping.set(cleanPlayerName, playerId);
          }
        }
        // Fall back to extracting from lineup rows
        else if (row["CPT"]) {
          const positions = ["CPT", "TOP", "JNG", "MID", "ADC", "SUP", "TEAM"];

          positions.forEach((position) => {
            const playerData = row[position];
            if (
              playerData &&
              playerData.includes("(") &&
              playerData.includes(")")
            ) {
              const playerName = this.extractPlayerName(playerData);
              const playerId = this.extractPlayerId(playerData);

              if (playerName && playerId) {
                playerMapping.set(`${playerName}_${position}`, playerId);
                playerMapping.set(playerName, playerId);
              }
            }
          });
        }
      }

      return {
        contestMetadata: extractedContestMetadata,
        playerMapping,
        entryIds: entryIds.sort((a, b) => a - b),
      };
    } catch (error) {
      if (error.statusCode) throw error;
      throw new AppError("Failed to parse DraftKings player mapping CSV", 500);
    }
  }

  // Parse JSON file
  async parseJSON(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        throw new AppError("File not found", 404);
      }

      const fileContent = fs.readFileSync(filePath, "utf8");

      if (fileContent.length === 0) {
        throw new AppError("JSON file is empty", 400);
      }

      let jsonData;
      try {
        jsonData = JSON.parse(fileContent);
      } catch (parseError) {
        throw new AppError("Invalid JSON format", 400);
      }

      return jsonData;
    } catch (error) {
      if (error.statusCode) throw error;
      throw new AppError("Failed to parse JSON file", 500);
    }
  }

  // Generate CSV content from data
  generateCSV(data, headers) {
    try {
      if (!Array.isArray(data) || data.length === 0) {
        throw new AppError("No data provided for CSV generation", 400);
      }

      const csvRows = [];

      // Add headers if provided
      if (headers && Array.isArray(headers)) {
        csvRows.push(headers.join(","));
      }

      // Add data rows
      data.forEach((row) => {
        if (Array.isArray(row)) {
          csvRows.push(row.join(","));
        } else if (typeof row === "object") {
          // Convert object to CSV row based on headers or object keys
          const keys = headers || Object.keys(row);
          const values = keys.map((key) => {
            const value = row[key];
            // Handle values that need quoting
            if (
              typeof value === "string" &&
              (value.includes(",") || value.includes('"'))
            ) {
              return `"${value.replace(/"/g, '""')}"`;
            }
            return value || "";
          });
          csvRows.push(values.join(","));
        }
      });

      return csvRows.join("\n");
    } catch (error) {
      if (error.statusCode) throw error;
      throw new AppError("Failed to generate CSV", 500);
    }
  }

  // Generate JSON content from data
  generateJSON(data, pretty = true) {
    try {
      return pretty ? JSON.stringify(data, null, 2) : JSON.stringify(data);
    } catch (error) {
      throw new AppError("Failed to generate JSON", 500);
    }
  }

  // Validate file format
  validateFileFormat(filename, allowedFormats = this.supportedFormats) {
    const fileExt = filename.toLowerCase().split(".").pop();

    if (!allowedFormats.includes(fileExt)) {
      throw new AppError(
        `Invalid file format. Allowed formats: ${allowedFormats.join(", ")}`,
        400
      );
    }

    return fileExt;
  }

  // Validate file size
  validateFileSize(filePath, maxSizeBytes = 10 * 1024 * 1024) {
    // 10MB default
    const stats = fs.statSync(filePath);

    if (stats.size > maxSizeBytes) {
      throw new AppError(
        `File too large. Maximum size is ${maxSizeBytes / 1024 / 1024}MB`,
        400
      );
    }

    return stats.size;
  }

  // Clean up uploaded file
  cleanupFile(filePath) {
    try {
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
        return true;
      }
      return false;
    } catch (error) {
      console.warn(`Failed to cleanup file ${filePath}:`, error.message);
      return false;
    }
  }

  // Helper methods (extracted from original server.js)
  parseDraftKingsEntry(row) {
    const id = row["Entry ID"] || generateLineupId();
    const name = `DK Lineup ${id}`;

    // Extract CPT player
    let cpt = null;
    if (row["CPT"]) {
      const cptName = this.extractPlayerName(row["CPT"]);
      const cptId = this.extractPlayerId(row["CPT"]);
      cpt = {
        name: cptName,
        id: cptId,
        position: "CPT",
        salary: 0,
      };
    }

    if (!cpt) {
      return null; // Skip invalid entries
    }

    // Extract position players
    const players = [];
    const positions = ["TOP", "JNG", "MID", "ADC", "SUP", "TEAM"];

    positions.forEach((position) => {
      if (row[position]) {
        players.push({
          name: this.extractPlayerName(row[position]),
          id: this.extractPlayerId(row[position]),
          position: position,
          salary: 0,
        });
      }
    });

    if (players.length < 2) {
      return null; // Skip invalid lineups
    }

    return {
      id,
      name,
      cpt,
      players,
    };
  }

  extractPlayerName(playerStr) {
    if (!playerStr) return "";
    const nameMatch = playerStr.match(/^(.*?)(?:\s+\(|$)/);
    return nameMatch ? nameMatch[1].trim() : playerStr.trim();
  }

  extractPlayerId(playerStr) {
    if (!playerStr) return "";
    const idMatch = playerStr.match(/\((\d+)\)$/);
    return idMatch ? idMatch[1] : "";
  }

  // Detect file type based on content
  async detectFileType(filePath) {
    try {
      const fileContent = fs.readFileSync(filePath, "utf-8");

      // Check for DraftKings contest file
      if (
        fileContent.includes("Entry ID") &&
        (fileContent.includes("Contest ID") ||
          fileContent.includes("Contest Name"))
      ) {
        return "draftkings-contest";
      }

      // Check for DraftKings salaries file
      if (
        fileContent.includes("Position") &&
        fileContent.includes("Name + ID") &&
        fileContent.includes("Salary")
      ) {
        return "draftkings-salaries";
      }

      // Check for ROO projections file
      if (
        fileContent.includes("Median") &&
        (fileContent.includes("Floor") || fileContent.includes("Ceiling"))
      ) {
        return "roo-projections";
      }

      // Check for team stacks file
      if (
        fileContent.includes("Stack+") ||
        (fileContent.includes("Team") && fileContent.includes("Stack"))
      ) {
        return "team-stacks";
      }

      // Check for LoL format (general)
      if (
        fileContent.includes("TOP") &&
        fileContent.includes("JNG") &&
        fileContent.includes("MID") &&
        fileContent.includes("ADC") &&
        fileContent.includes("SUP")
      ) {
        return "lol-format";
      }

      return "unknown";
    } catch (error) {
      throw new AppError("Failed to detect file type", 500);
    }
  }
}

module.exports = FileProcessingService;
