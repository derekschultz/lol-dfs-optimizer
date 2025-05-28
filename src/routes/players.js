/**
 * Player Routes
 * Handles all player-related API endpoints
 */

const express = require("express");
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");

const {
  validatePlayerData,
  validateId,
  validateFileUpload,
} = require("../middleware/validation");
const { catchAsync, AppError } = require("../middleware/errorHandler");

const router = express.Router();

// Set up file upload
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    const dir = path.join(__dirname, "../../uploads");
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

// GET /players - Get all players
router.get(
  "/",
  catchAsync(async (req, res) => {
    const playerService = req.app.get("services").player;
    const players = await playerService.getAllPlayers();
    res.json({
      success: true,
      data: players,
      message: `Retrieved ${players.length} players`,
    });
  })
);

// GET /players/projections - Get all players
router.get(
  "/projections",
  catchAsync(async (req, res) => {
    const playerService = req.app.get("services").player;
    const players = await playerService.getAllPlayers();
    res.json(players);
  })
);

// GET /players/:id - Get player by ID
router.get(
  "/:id",
  validateId,
  catchAsync(async (req, res) => {
    const playerService = req.app.get("services").player;
    const player = await playerService.getPlayerById(req.params.id);
    res.json({
      success: true,
      data: player,
    });
  })
);

// POST /players - Create new player
router.post(
  "/",
  validatePlayerData,
  catchAsync(async (req, res) => {
    const playerService = req.app.get("services").player;
    const newPlayer = await playerService.createPlayer(req.body);
    res.status(201).json({
      success: true,
      message: "Player created successfully",
      data: newPlayer,
    });
  })
);

// PUT /players/:id - Update player
router.put(
  "/:id",
  validateId,
  validatePlayerData,
  catchAsync(async (req, res) => {
    const playerService = req.app.get("services").player;
    const updatedPlayer = await playerService.updatePlayer(
      req.params.id,
      req.body
    );
    res.json({
      success: true,
      message: "Player updated successfully",
      data: updatedPlayer,
    });
  })
);

// DELETE /players/bulk - Delete multiple players
router.delete(
  "/bulk",
  catchAsync(async (req, res) => {
    const playerService = req.app.get("services").player;
    const { playerIds } = req.body;

    if (!playerIds || !Array.isArray(playerIds) || playerIds.length === 0) {
      throw new AppError(
        "playerIds array is required and must not be empty",
        400
      );
    }

    const result = await playerService.deletePlayers(playerIds);
    res.json({
      success: true,
      message: `Deleted ${result.deletedPlayers.length} players successfully`,
      data: result,
    });
  })
);

// DELETE /players/:id - Delete single player
router.delete(
  "/:id",
  validateId,
  catchAsync(async (req, res) => {
    const playerService = req.app.get("services").player;
    const result = await playerService.deletePlayer(req.params.id);
    res.json({
      success: true,
      message: "Player deleted successfully",
      data: result,
    });
  })
);

// GET /players/team/:team - Get players by team
router.get(
  "/team/:team",
  catchAsync(async (req, res) => {
    const playerService = req.app.get("services").player;
    const players = await playerService.getPlayersByTeam(req.params.team);
    res.json({
      success: true,
      data: players,
    });
  })
);

// GET /players/position/:position - Get players by position
router.get(
  "/position/:position",
  catchAsync(async (req, res) => {
    const playerService = req.app.get("services").player;
    const players = await playerService.getPlayersByPosition(
      req.params.position
    );
    res.json({
      success: true,
      data: players,
    });
  })
);

// POST /players/projections/upload - Upload player projections CSV
router.post(
  "/projections/upload",
  upload.single("file"),
  validateFileUpload,
  catchAsync(async (req, res) => {
    const playerService = req.app.get("services").player;
    const playerRepository = req.app.get("repositories").player;
    const filePath = req.file.path;

    try {
      // Parse CSV file
      const csvData = [];
      await new Promise((resolve, reject) => {
        fs.createReadStream(filePath)
          .pipe(csv())
          .on("data", (data) => csvData.push(data))
          .on("end", resolve)
          .on("error", reject);
      });

      if (csvData.length === 0) {
        throw new AppError("No valid player data found in the file", 400);
      }

      // Process the CSV data
      const processedPlayers = await playerService.processPlayersCsv(csvData);

      if (processedPlayers.length === 0) {
        throw new AppError(
          "No valid player data found in the file after processing",
          400
        );
      }

      // Replace all existing players with new data
      await playerRepository.replaceAll(processedPlayers);

      res.json({
        success: true,
        message: `Loaded ${processedPlayers.length} player projections successfully`,
        data: {
          playersCount: processedPlayers.length,
        },
      });
    } catch (error) {
      if (error.statusCode) throw error;
      throw new AppError("Error processing player projections file", 500);
    } finally {
      // Clean up uploaded file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  })
);

// GET /players/stats/teams - Get team statistics
router.get(
  "/stats/teams",
  catchAsync(async (req, res) => {
    const playerService = req.app.get("services").player;
    const teamStats = await playerService.getTeamStats();
    res.json({
      success: true,
      data: teamStats,
    });
  })
);

// GET /players/stats/overview - Get player overview statistics
router.get(
  "/stats/overview",
  catchAsync(async (req, res) => {
    const playerRepository = req.app.get("repositories").player;
    const [positionCounts, teamCounts, averageStats, totalCount] =
      await Promise.all([
        playerRepository.getPositionCounts(),
        playerRepository.getTeamCounts(),
        playerRepository.getAverageStats(),
        playerRepository.count(),
      ]);

    res.json({
      success: true,
      data: {
        totalPlayers: totalCount,
        positionBreakdown: positionCounts,
        teamBreakdown: teamCounts,
        averageStats,
      },
    });
  })
);

// POST /players/search - Search players with filters
router.post(
  "/search",
  catchAsync(async (req, res) => {
    const playerRepository = req.app.get("repositories").player;
    const filters = req.body;
    const players = await playerRepository.search(filters);

    res.json({
      success: true,
      message: `Found ${players.length} players matching filters`,
      data: {
        count: players.length,
        players,
      },
    });
  })
);

module.exports = { router };
