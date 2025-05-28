/**
 * SettingsService
 * Handles optimizer settings and configuration management
 */

const fs = require('fs').promises;
const path = require('path');
const { AppError } = require('../middleware/errorHandler');

class SettingsService {
  constructor() {
    this.settingsPath = path.join(__dirname, '../../data/settings.json');
    this.defaultSettings = {
      iterations: 2000,
      fieldSize: 1176,
      entryFee: 5,
      outputDir: './output',
      maxExposure: 25,
      minPlayers: 5,
      maxPlayers: 6,
      salaryCapBuffer: 500,
      optimizationStrategy: 'advanced',
      enableStacking: true,
      stackSizes: [2, 3, 4],
      exposureSettings: {
        player: { min: 0, max: 100 },
        team: { min: 0, max: 60 },
        position: { min: 0, max: 100 }
      },
      constraintSettings: {
        salary: { min: 40000, max: 50000 },
        positions: {
          TOP: { min: 1, max: 1, required: true },
          JNG: { min: 1, max: 1, required: true },
          MID: { min: 1, max: 1, required: true },
          ADC: { min: 1, max: 1, required: true },
          SUP: { min: 1, max: 1, required: true },
          TEAM: { min: 1, max: 1, required: true }
        }
      },
      simulationSettings: {
        iterations: 1000,
        fieldSize: 1176,
        variance: 0.15,
        payoutStructure: null
      },
      advancedSettings: {
        enableVarianceOptimization: false,
        enableOwnershipConstraints: false,
        enableCorrelationAnalysis: false,
        maxIterationsPerOptimization: 10000,
        convergenceThreshold: 0.001
      },
      uiSettings: {
        theme: 'blue',
        autoRefresh: true,
        refreshInterval: 30000,
        showAdvancedOptions: false,
        defaultView: 'lineups'
      }
    };
    this.currentSettings = { ...this.defaultSettings };
    this.loaded = false;
  }

  /**
   * Load settings from file or use defaults
   */
  async loadSettings() {
    try {
      // Ensure data directory exists
      await this.ensureDataDirectory();

      // Try to load existing settings
      try {
        const data = await fs.readFile(this.settingsPath, 'utf8');
        const savedSettings = JSON.parse(data);
        
        // Merge with defaults to handle new settings
        this.currentSettings = this.mergeWithDefaults(savedSettings);
        this.loaded = true;
        
        return this.currentSettings;
      } catch (error) {
        // File doesn't exist or is invalid, use defaults
        this.currentSettings = { ...this.defaultSettings };
        await this.saveSettings(); // Create default settings file
        this.loaded = true;
        
        return this.currentSettings;
      }
    } catch (error) {
      throw new AppError(`Failed to load settings: ${error.message}`, 500);
    }
  }

  /**
   * Get current settings
   */
  async getSettings() {
    if (!this.loaded) {
      await this.loadSettings();
    }
    return { ...this.currentSettings };
  }

  /**
   * Update settings
   */
  async updateSettings(newSettings) {
    if (!this.loaded) {
      await this.loadSettings();
    }

    // Validate settings
    const validatedSettings = this.validateSettings(newSettings);
    
    // Merge with current settings
    this.currentSettings = {
      ...this.currentSettings,
      ...validatedSettings
    };

    // Save to file
    await this.saveSettings();

    return { ...this.currentSettings };
  }

  /**
   * Reset settings to defaults
   */
  async resetSettings() {
    this.currentSettings = { ...this.defaultSettings };
    await this.saveSettings();
    return { ...this.currentSettings };
  }

  /**
   * Get specific setting category
   */
  async getSettingCategory(category) {
    const settings = await this.getSettings();
    
    if (!settings[category]) {
      throw new AppError(`Settings category '${category}' not found`, 404);
    }

    return settings[category];
  }

  /**
   * Update specific setting category
   */
  async updateSettingCategory(category, categorySettings) {
    if (!this.loaded) {
      await this.loadSettings();
    }

    if (!this.currentSettings[category]) {
      throw new AppError(`Settings category '${category}' not found`, 404);
    }

    // Validate category settings
    const validatedSettings = this.validateCategorySettings(category, categorySettings);
    
    this.currentSettings[category] = {
      ...this.currentSettings[category],
      ...validatedSettings
    };

    await this.saveSettings();
    return this.currentSettings[category];
  }

  /**
   * Get settings schema/structure
   */
  getSettingsSchema() {
    return {
      iterations: { type: 'number', min: 100, max: 10000, description: 'Number of optimization iterations' },
      fieldSize: { type: 'number', min: 10, max: 10000, description: 'Contest field size' },
      entryFee: { type: 'number', min: 0.25, max: 1000, description: 'Entry fee amount' },
      outputDir: { type: 'string', description: 'Output directory for exported files' },
      maxExposure: { type: 'number', min: 1, max: 100, description: 'Maximum player exposure percentage' },
      minPlayers: { type: 'number', min: 3, max: 10, description: 'Minimum players in lineup' },
      maxPlayers: { type: 'number', min: 3, max: 10, description: 'Maximum players in lineup' },
      salaryCapBuffer: { type: 'number', min: 0, max: 5000, description: 'Salary cap buffer amount' },
      optimizationStrategy: { 
        type: 'enum', 
        values: ['advanced', 'hybrid', 'genetic', 'simulated_annealing'],
        description: 'Default optimization strategy'
      },
      enableStacking: { type: 'boolean', description: 'Enable team stacking' },
      stackSizes: { 
        type: 'array', 
        itemType: 'number',
        description: 'Allowed stack sizes'
      }
    };
  }

  /**
   * Export settings to JSON
   */
  async exportSettings() {
    const settings = await this.getSettings();
    return {
      exportedAt: new Date().toISOString(),
      version: '1.0',
      settings
    };
  }

  /**
   * Import settings from JSON
   */
  async importSettings(importData) {
    if (!importData.settings) {
      throw new AppError('Invalid import data: missing settings', 400);
    }

    const validatedSettings = this.validateSettings(importData.settings);
    this.currentSettings = this.mergeWithDefaults(validatedSettings);
    
    await this.saveSettings();
    return { ...this.currentSettings };
  }

  /**
   * Save settings to file
   */
  async saveSettings() {
    try {
      await this.ensureDataDirectory();
      
      const data = JSON.stringify(this.currentSettings, null, 2);
      await fs.writeFile(this.settingsPath, data, 'utf8');
      
      return true;
    } catch (error) {
      throw new AppError(`Failed to save settings: ${error.message}`, 500);
    }
  }

  /**
   * Ensure data directory exists
   */
  async ensureDataDirectory() {
    const dataDir = path.dirname(this.settingsPath);
    try {
      await fs.access(dataDir);
    } catch (error) {
      await fs.mkdir(dataDir, { recursive: true });
    }
  }

  /**
   * Merge settings with defaults
   */
  mergeWithDefaults(settings) {
    const merged = { ...this.defaultSettings };
    
    // Deep merge for nested objects
    Object.keys(settings).forEach(key => {
      if (typeof settings[key] === 'object' && !Array.isArray(settings[key]) && settings[key] !== null) {
        merged[key] = { ...merged[key], ...settings[key] };
      } else {
        merged[key] = settings[key];
      }
    });

    return merged;
  }

  /**
   * Validate settings
   */
  validateSettings(settings) {
    const validated = {};
    const schema = this.getSettingsSchema();

    Object.keys(settings).forEach(key => {
      if (key === 'exposureSettings' || key === 'constraintSettings' || 
          key === 'simulationSettings' || key === 'advancedSettings' || 
          key === 'uiSettings') {
        // Skip validation for nested objects (handled separately)
        validated[key] = settings[key];
        return;
      }

      const rule = schema[key];
      if (!rule) {
        // Unknown setting, skip or include based on policy
        validated[key] = settings[key];
        return;
      }

      const value = settings[key];

      switch (rule.type) {
        case 'number':
          if (typeof value === 'number' && 
              (!rule.min || value >= rule.min) && 
              (!rule.max || value <= rule.max)) {
            validated[key] = value;
          }
          break;
        
        case 'string':
          if (typeof value === 'string') {
            validated[key] = value;
          }
          break;
        
        case 'boolean':
          if (typeof value === 'boolean') {
            validated[key] = value;
          }
          break;
        
        case 'enum':
          if (rule.values.includes(value)) {
            validated[key] = value;
          }
          break;
        
        case 'array':
          if (Array.isArray(value)) {
            validated[key] = value;
          }
          break;
        
        default:
          validated[key] = value;
      }
    });

    return validated;
  }

  /**
   * Validate category-specific settings
   */
  validateCategorySettings(category, settings) {
    // Basic validation - could be expanded for each category
    if (typeof settings !== 'object' || settings === null) {
      throw new AppError('Category settings must be an object', 400);
    }

    return settings;
  }

  /**
   * Get default settings
   */
  getDefaultSettings() {
    return { ...this.defaultSettings };
  }
}

module.exports = SettingsService;