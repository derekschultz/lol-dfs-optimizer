/**
 * Team/Stack Routes
 * Handles all team and stack-related API endpoints
 */

const express = require("express");
const multer = require("multer");
const csv = require("csv-parser");
const fs = require("fs");
const path = require("path");

const { validateId, validateFileUpload } = require("../middleware/validation");
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

// Team stack validation middleware
const validateTeamStackData = (req, res, next) => {
  const { team, stack, stackPlus } = req.body;
  const errors = [];

  if (
    !team ||
    typeof team !== "string" ||
    team.length < 1 ||
    team.length > 50
  ) {
    errors.push("Team must be a string between 1 and 50 characters");
  }

  if (!Array.isArray(stack) || stack.length === 0) {
    errors.push("Stack must be a non-empty array of positions");
  } else {
    // Validate all positions in stack
    const validPositions = ["TOP", "JNG", "MID", "ADC", "SUP", "TEAM"];
    for (const position of stack) {
      if (!validPositions.includes(position)) {
        errors.push(`Invalid position in stack: ${position}`);
      }
    }
  }

  if (
    stackPlus !== undefined &&
    (typeof stackPlus !== "number" || isNaN(stackPlus))
  ) {
    errors.push("Stack+ rating must be a valid number");
  }

  if (errors.length > 0) {
    return next(
      new AppError(`Team stack validation failed: ${errors.join(", ")}`, 400)
    );
  }

  next();
};

// GET /teams - Get all teams/stacks
router.get(
  "/",
  catchAsync(async (req, res) => {
    const teamStackService = req.app.get("services").teamStack;
    const stacks = await teamStackService.getAllStacks();
    res.json({
      success: true,
      data: stacks,
      message: `Retrieved ${stacks.length} team stacks`,
    });
  })
);

// GET /teams/stacks - Get all team stacks (enhanced with player data)
router.get(
  "/stacks",
  catchAsync(async (req, res) => {
    const teamStackService = req.app.get("services").teamStack;
    const enhancedStacks = await teamStackService.getEnhancedStacks();
    res.json(enhancedStacks);
  })
);

// GET /teams/stacks/raw - Get raw team stacks (without enhancement)
router.get(
  "/stacks/raw",
  catchAsync(async (req, res) => {
    const teamStackService = req.app.get("services").teamStack;
    const stacks = await teamStackService.getAllStacks();
    res.json({
      success: true,
      data: stacks,
    });
  })
);

// GET /teams/stacks/:id - Get team stack by ID
router.get(
  "/stacks/:id",
  validateId,
  catchAsync(async (req, res) => {
    const teamStackService = req.app.get("services").teamStack;
    const stack = await teamStackService.getStackById(req.params.id);
    res.json({
      success: true,
      data: stack,
    });
  })
);

// GET /teams/:team/stacks - Get stacks for specific team
router.get(
  "/:team/stacks",
  catchAsync(async (req, res) => {
    const teamStackService = req.app.get("services").teamStack;
    const stacks = await teamStackService.getStacksByTeam(req.params.team);
    res.json({
      success: true,
      data: stacks,
    });
  })
);

// POST /teams/stacks - Create new team stack
router.post(
  "/stacks",
  validateTeamStackData,
  catchAsync(async (req, res) => {
    const teamStackService = req.app.get("services").teamStack;
    const newStack = await teamStackService.createStack(req.body);
    res.status(201).json({
      success: true,
      message: "Team stack created successfully",
      data: newStack,
    });
  })
);

// PUT /teams/stacks/:id - Update team stack
router.put(
  "/stacks/:id",
  validateId,
  validateTeamStackData,
  catchAsync(async (req, res) => {
    const teamStackService = req.app.get("services").teamStack;
    const updatedStack = await teamStackService.updateStack(
      req.params.id,
      req.body
    );
    res.json({
      success: true,
      message: "Team stack updated successfully",
      data: updatedStack,
    });
  })
);

// DELETE /teams/stacks/:id - Delete single team stack
router.delete(
  "/stacks/:id",
  validateId,
  catchAsync(async (req, res) => {
    const teamStackService = req.app.get("services").teamStack;
    const result = await teamStackService.deleteStack(req.params.id);
    res.json({
      success: true,
      message: "Team stack deleted successfully",
      data: result,
    });
  })
);

// DELETE /teams/stacks/bulk - Delete multiple team stacks
router.delete(
  "/stacks/bulk",
  catchAsync(async (req, res) => {
    const teamStackService = req.app.get("services").teamStack;
    const { stackIds } = req.body;

    if (!stackIds || !Array.isArray(stackIds) || stackIds.length === 0) {
      throw new AppError(
        "stackIds array is required and must not be empty",
        400
      );
    }

    const result = await teamStackService.deleteStacks(stackIds);
    res.json({
      success: true,
      message: `Deleted ${stackIds.length} team stacks successfully`,
      data: result,
    });
  })
);

// POST /teams/stacks/search - Search team stacks with filters
router.post(
  "/stacks/search",
  catchAsync(async (req, res) => {
    const teamStackService = req.app.get("services").teamStack;
    const filters = req.body;
    const result = await teamStackService.searchStacks(filters);
    res.json({
      success: true,
      data: result,
    });
  })
);

// GET /teams/stacks/stats/overview - Get team stack statistics
router.get(
  "/stacks/stats/overview",
  catchAsync(async (req, res) => {
    const teamStackService = req.app.get("services").teamStack;
    const stats = await teamStackService.getStackStats();
    res.json({
      success: true,
      data: stats,
    });
  })
);

// GET /teams/stacks/top/:limit? - Get top performing stacks
router.get(
  "/stacks/top/:limit?",
  catchAsync(async (req, res) => {
    const teamStackService = req.app.get("services").teamStack;
    const limit = parseInt(req.params.limit) || 10;
    const topStacks = await teamStackService.getTopStacks(limit);
    res.json({
      success: true,
      message: `Top ${limit} performing stacks`,
      data: {
        limit,
        stacks: topStacks,
      },
    });
  })
);

// GET /teams/stacks/tiers - Get stacks organized by performance tiers
router.get(
  "/stacks/tiers",
  catchAsync(async (req, res) => {
    const teamStackService = req.app.get("services").teamStack;
    const stacksByTier = await teamStackService.getStacksByTier();
    res.json({
      success: true,
      data: stacksByTier,
    });
  })
);

// POST /teams/stacks/export - Export team stacks in various formats
router.post(
  "/stacks/export",
  catchAsync(async (req, res) => {
    const teamStackService = req.app.get("services").teamStack;
    const { format = "csv", stackIds = [] } = req.body;

    const exportData = await teamStackService.exportStacks(format, stackIds);

    let contentType, filename;
    switch (format.toLowerCase()) {
      case "json":
        contentType = "application/json";
        filename = `team_stacks_${Date.now()}.json`;
        break;
      default:
        contentType = "text/csv";
        filename = `team_stacks_${Date.now()}.csv`;
    }

    res.setHeader("Content-Type", contentType);
    res.setHeader("Content-Disposition", `attachment; filename="${filename}"`);
    res.send(exportData);
  })
);

// POST /teams/stacks/upload - Upload team stacks CSV
router.post(
  "/stacks/upload",
  upload.single("file"),
  validateFileUpload,
  catchAsync(async (req, res) => {
    const teamStackService = req.app.get("services").teamStack;
    const teamStackRepository = req.app.get("repositories").teamStack;
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
        throw new AppError("No team stack data found in the file", 400);
      }

      // Process the CSV data
      const processedStacks = await teamStackService.processStacksCsv(csvData);

      if (processedStacks.length === 0) {
        console.warn(
          "No stacks found in file. This is unusual but proceeding anyway."
        );
      }

      // Replace all existing stacks with new data
      await teamStackRepository.replaceAll(processedStacks);

      res.json({
        success: true,
        message: `Loaded ${processedStacks.length} team stacks successfully`,
        data: {
          stacksCount: processedStacks.length,
          stacks: processedStacks,
        },
      });
    } catch (error) {
      if (error.statusCode) throw error;
      throw new AppError("Error processing team stacks file", 500);
    } finally {
      // Clean up uploaded file
      if (fs.existsSync(filePath)) {
        fs.unlinkSync(filePath);
      }
    }
  })
);

module.exports = { router };
