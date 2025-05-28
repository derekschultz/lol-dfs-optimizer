const express = require("express");
const { catchAsync } = require("../middleware/errorHandler");

const router = express.Router();

// Get all settings
router.get(
  "/",
  catchAsync(async (req, res) => {
    const settingsService = req.app.get("services").settings;

    const settings = await settingsService.getSettings();

    res.json({
      success: true,
      data: settings,
      message: "Settings retrieved successfully",
    });
  })
);

// Update settings
router.post(
  "/",
  catchAsync(async (req, res) => {
    const settingsService = req.app.get("services").settings;
    const newSettings = req.body;

    const settings = await settingsService.updateSettings(newSettings);

    res.json({
      success: true,
      data: settings,
      message: "Settings updated successfully",
    });
  })
);

// Reset settings to defaults
router.post(
  "/reset",
  catchAsync(async (req, res) => {
    const settingsService = req.app.get("services").settings;

    const settings = await settingsService.resetSettings();

    res.json({
      success: true,
      data: settings,
      message: "Settings reset to defaults",
    });
  })
);

// Get specific setting category
router.get(
  "/category/:category",
  catchAsync(async (req, res) => {
    const settingsService = req.app.get("services").settings;
    const { category } = req.params;

    const categorySettings = await settingsService.getSettingCategory(category);

    res.json({
      success: true,
      data: categorySettings,
      message: `${category} settings retrieved`,
    });
  })
);

// Update specific setting category
router.put(
  "/category/:category",
  catchAsync(async (req, res) => {
    const settingsService = req.app.get("services").settings;
    const { category } = req.params;
    const categorySettings = req.body;

    const updatedSettings = await settingsService.updateSettingCategory(
      category,
      categorySettings
    );

    res.json({
      success: true,
      data: updatedSettings,
      message: `${category} settings updated successfully`,
    });
  })
);

// Get settings schema
router.get(
  "/schema",
  catchAsync(async (req, res) => {
    const settingsService = req.app.get("services").settings;

    const schema = settingsService.getSettingsSchema();

    res.json({
      success: true,
      data: schema,
      message: "Settings schema retrieved",
    });
  })
);

// Export settings
router.get(
  "/export",
  catchAsync(async (req, res) => {
    const settingsService = req.app.get("services").settings;

    const exportData = await settingsService.exportSettings();

    res.setHeader("Content-Type", "application/json");
    res.setHeader(
      "Content-Disposition",
      'attachment; filename="optimizer-settings.json"'
    );
    res.json(exportData);
  })
);

// Import settings
router.post(
  "/import",
  catchAsync(async (req, res) => {
    const settingsService = req.app.get("services").settings;
    const importData = req.body;

    const settings = await settingsService.importSettings(importData);

    res.json({
      success: true,
      data: settings,
      message: "Settings imported successfully",
    });
  })
);

// Get default settings
router.get(
  "/defaults",
  catchAsync(async (req, res) => {
    const settingsService = req.app.get("services").settings;

    const defaults = settingsService.getDefaultSettings();

    res.json({
      success: true,
      data: defaults,
      message: "Default settings retrieved",
    });
  })
);

module.exports = router;
