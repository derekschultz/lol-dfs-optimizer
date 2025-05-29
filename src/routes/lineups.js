/**
 * Lineup Routes
 * Handles all lineup-related API endpoints
 */

const express = require("express");
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");

const serviceRegistry = require("../services/ServiceRegistry");
const { validateId, validateFileUpload } = require("../middleware/validation");
const { catchAsync, AppError } = require("../middleware/errorHandler");

const router = express.Router();

// Services will be accessed via req.app.get('services')

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

// Lineup validation middleware
const validateLineupData = (req, res, next) => {
  const { name, cpt, players } = req.body;
  const errors = [];

  if (
    !name ||
    typeof name !== "string" ||
    name.length < 1 ||
    name.length > 200
  ) {
    errors.push("Lineup name must be a string between 1 and 200 characters");
  }

  if (!cpt || !cpt.name || !cpt.position) {
    errors.push("Captain player is required with name and position");
  }

  if (!Array.isArray(players) || players.length < 5 || players.length > 6) {
    errors.push("Players array must contain 5-6 players");
  }

  // Validate position requirements
  if (Array.isArray(players)) {
    const positions = players.map((p) => p.position);
    const requiredPositions = ["TOP", "JNG", "MID", "ADC", "SUP"];

    for (const pos of requiredPositions) {
      if (!positions.includes(pos)) {
        errors.push(`Missing required position: ${pos}`);
      }
    }
  }

  if (errors.length > 0) {
    return next(
      new AppError(`Lineup validation failed: ${errors.join(", ")}`, 400)
    );
  }

  next();
};

// GET /lineups - Get all lineups
router.get(
  "/",
  catchAsync(async (req, res) => {
    const lineupService = req.app.get("services").lineup;
    const lineups = await lineupService.getAllLineups();
    res.json(lineups);
  })
);

// GET /lineups/:id - Get lineup by ID
router.get(
  "/:id",
  validateId,
  catchAsync(async (req, res) => {
    const lineupService = req.app.get("services").lineup;
    const lineup = await lineupService.getLineupById(req.params.id);
    res.json({
      success: true,
      data: lineup,
      message: "Lineup retrieved successfully",
    });
  })
);

// POST /lineups - Create new lineup
router.post(
  "/",
  validateLineupData,
  catchAsync(async (req, res) => {
    const lineupService = req.app.get("services").lineup;
    const newLineup = await lineupService.createLineup(req.body);
    res.status(201).json({
      success: true,
      data: newLineup,
      message: "Lineup created successfully",
    });
  })
);

// PUT /lineups/:id - Update lineup
router.put(
  "/:id",
  validateId,
  validateLineupData,
  catchAsync(async (req, res) => {
    const lineupService = req.app.get("services").lineup;
    const updatedLineup = await lineupService.updateLineup(
      req.params.id,
      req.body
    );
    res.json({
      success: true,
      data: updatedLineup,
      message: "Lineup updated successfully",
    });
  })
);

// DELETE /lineups/:id - Delete single lineup
router.delete(
  "/:id",
  validateId,
  catchAsync(async (req, res) => {
    const lineupService = req.app.get("services").lineup;
    const result = await lineupService.deleteLineup(req.params.id);
    res.json({
      success: true,
      data: result,
      message: "Lineup deleted successfully",
    });
  })
);

// DELETE /lineups/bulk - Delete multiple lineups
router.delete(
  "/bulk",
  catchAsync(async (req, res) => {
    const lineupService = req.app.get("services").lineup;
    const { lineupIds } = req.body;

    if (!lineupIds || !Array.isArray(lineupIds) || lineupIds.length === 0) {
      throw new AppError(
        "lineupIds array is required and must not be empty",
        400
      );
    }

    const result = await lineupService.deleteLineups(lineupIds);
    res.json({
      success: true,
      data: result,
      message: `Deleted ${lineupIds.length} lineups successfully`,
    });
  })
);

// POST /lineups/search - Search lineups with filters
router.post(
  "/search",
  catchAsync(async (req, res) => {
    const lineupService = req.app.get("services").lineup;
    const filters = req.body;
    const result = await lineupService.searchLineups(filters);
    res.json({
      success: true,
      data: result,
      message: "Search completed successfully",
    });
  })
);

// GET /lineups/stats/overview - Get lineup statistics
router.get(
  "/stats/overview",
  catchAsync(async (req, res) => {
    const lineupService = req.app.get("services").lineup;
    const stats = await lineupService.getLineupStats();
    res.json({
      success: true,
      data: stats,
      message: "Statistics retrieved successfully",
    });
  })
);

// POST /lineups/export - Export lineups in various formats
router.post(
  "/export",
  catchAsync(async (req, res) => {
    const lineupService = req.app.get("services").lineup;
    const { format = "csv", lineupIds = [] } = req.body;

    const exportData = await lineupService.exportLineups(format, lineupIds);

    let contentType, filename;
    switch (format.toLowerCase()) {
      case "json":
        contentType = "application/json";
        filename = `lineups_${Date.now()}.json`;
        break;
      case "draftkings":
      case "dk":
        contentType = "text/csv";
        filename = `lineups_draftkings_${Date.now()}.csv`;
        break;
      default:
        contentType = "text/csv";
        filename = `lineups_${Date.now()}.csv`;
    }

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(exportData);
  })
);

// POST /lineups/dkentries - Upload DraftKings entries
router.post(
  "/dkentries",
  upload.single("file"),
  validateFileUpload,
  catchAsync(async (req, res) => {
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
        throw new AppError("No valid lineup data found in the file", 400);
      }

      // Process the DraftKings entries
      const lineupService = req.app.get("services").lineup;
      const processedLineups =
        await lineupService.processFromDraftKingsEntries(csvData);

      if (processedLineups.length === 0) {
        throw new AppError(
          "No valid lineup data found in the file after processing",
          400
        );
      }

      // Create the lineups
      const newLineups = await lineupService.createLineups(processedLineups);

      res.json({
        success: true,
        message: `Imported ${newLineups.length} lineups successfully`,
        data: newLineups,
      });
    } catch (error) {
      if (error.statusCode) throw error;
      throw new AppError("Error processing DraftKings entries file", 500);
    } finally {
      // Clean up uploaded file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  })
);

// POST /lineups/import - Import JSON lineups
router.post(
  "/import",
  upload.single("file"),
  validateFileUpload,
  catchAsync(async (req, res) => {
    const filePath = req.file.path;

    try {
      const fileContent = fs.readFileSync(filePath, "utf8");
      let jsonData;

      try {
        jsonData = JSON.parse(fileContent);
      } catch (parseError) {
        throw new AppError("Invalid JSON format", 400);
      }

      // Process the JSON data
      const lineupService = req.app.get("services").lineup;
      const processedLineups = await lineupService.processFromJson(jsonData);

      if (processedLineups.length === 0) {
        throw new AppError("No lineups found in JSON file", 400);
      }

      // Create the lineups
      const newLineups = await lineupService.createLineups(processedLineups);

      res.json({
        success: true,
        message: `Imported ${newLineups.length} lineups from JSON successfully`,
        data: newLineups,
      });
    } catch (error) {
      if (error.statusCode) throw error;
      throw new AppError("Error processing JSON lineups file", 500);
    } finally {
      // Clean up uploaded file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  })
);

// POST /lineups/simulate - Run simulation on selected lineups
router.post(
  "/simulate",
  catchAsync(async (req, res) => {
    const lineupService = req.app.get("services").lineup;
    const { lineupIds, settings = {} } = req.body;

    if (!lineupIds || !Array.isArray(lineupIds) || lineupIds.length === 0) {
      throw new AppError(
        "lineupIds array is required and must not be empty",
        400
      );
    }

    const results = await lineupService.simulateLineups(lineupIds, settings);
    res.json({
      success: true,
      data: results,
      message: "Simulation completed successfully",
    });
  })
);

// POST /lineups/generate - Generate new lineups (placeholder for future optimization integration)
router.post(
  "/generate",
  catchAsync(async (req, res) => {
    // This endpoint will be implemented when we integrate the optimization services
    throw new AppError(
      "Lineup generation not yet implemented in refactored API. Use optimization service.",
      501
    );
  })
);

// POST /lineups/generate-hybrid - Generate lineups with hybrid optimizer
router.post(
  "/generate-hybrid",
  catchAsync(async (req, res) => {
    const {
      count = 5,
      strategy = "recommended",
      customConfig = {},
      saveToLineups = true,
      sessionId,
    } = req.body;

    const optimizationService = req.app.get("services").optimization;
    const lineupService = req.app.get("services").lineup;

    // If sessionId provided, check for existing optimizer instance
    if (sessionId) {
      // Import the optimizations router data
      const optimizationsRouter = require("./optimizations");
      const optimizerInstances = optimizationsRouter.optimizerInstances;
      const progressConnections = optimizationsRouter.progressConnections;

      if (optimizerInstances && optimizerInstances.has(sessionId)) {
        const instance = optimizerInstances.get(sessionId);
        const optimizer = instance.optimizer;

        // Progress callbacks should already be set up from the /optimizer/initialize endpoint
        // Don't override them here - they're connected to the SSE stream

        // Use the existing optimizer directly
        let result;
        if (strategy === "portfolio") {
          const portfolioStrategy = { config: customConfig || {} };
          result = await optimizer._runPortfolioOptimization(
            portfolioStrategy,
            customConfig || {}
          );
        } else {
          result = await optimizer.optimize(
            count,
            strategy || "recommended",
            customConfig || {}
          );
        }

        res.json({
          success: true,
          lineups: result.lineups,
          metadata: result.metadata,
          summary: result.summary,
          algorithms: result.algorithms,
          message: `Generated ${result.lineups.length} lineups using ${strategy} strategy`,
        });
        return;
      }
    }

    // Fallback to creating new optimizer if no session
    const playerRepository = req.app.get("repositories").player;
    const playerProjections = await playerRepository.findAll();
    if (playerProjections.length === 0) {
      throw new AppError("No player projections available", 400);
    }

    const result = await optimizationService.generateLineups({
      players: playerProjections,
      numLineups: count,
      algorithm: "hybrid",
      strategy: strategy,
      exposureLimits: customConfig.exposureSettings || {},
      contestInfo: customConfig.contestInfo || {},
      customConfig: customConfig, // Pass the full customConfig for portfolio settings
      sessionId,
    });

    res.json({
      success: true,
      lineups: result.lineups,
      metadata: result.metadata,
      summary: result.summary,
      algorithms: result.algorithms,
      message: `Generated ${result.lineups.length} lineups using ${strategy} strategy`,
    });
  })
);

module.exports = { router };
