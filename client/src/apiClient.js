// apiClient.js
// Client for communicating with the LoL DFS simulation server

const API_BASE_URL = 'http://localhost:3001/api';

/**
 * API client for the LoL DFS Optimizer
 */
class ApiClient {
  /**
   * Upload a file to the server
   * @param {File} file - The file to upload
   * @returns {Promise} - API response
   */
  static async uploadFile(file) {
    const formData = new FormData();
    formData.append('file', file);

    // Ensure we preserve the exact original filename, including any version numbers like (31)
    const response = await fetch(`${API_BASE_URL}/upload`, {
      method: 'POST',
      body: formData
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to upload file');
    }

    return response.json();
  }

  /**
   * Convert DraftKings entries file to lineups
   * @param {string} filename - The filename of the uploaded DK entries file
   * @returns {Promise} - API response with converted lineups
   */
  static async convertDkEntries(filename) {
    const response = await fetch(`${API_BASE_URL}/convert-dk-entries`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ filename })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to convert DK entries');
    }

    return response.json();
  }

  /**
   * Initialize the simulation engine with settings
   * @param {Object} settings - Simulation settings
   * @returns {Promise} - API response
   */
  static async initSimulation(settings) {
    const response = await fetch(`${API_BASE_URL}/init-simulation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(settings)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to initialize simulation');
    }

    return response.json();
  }

  /**
   * Run the simulation on lineups
   * @param {Array} lineups - Optional lineup data (if not provided, will use server's lineups.json)
   * @returns {Promise} - API response with simulation results
   */
  static async runSimulation(lineups = null) {
    const payload = lineups ? { lineups } : {};

    const response = await fetch(`${API_BASE_URL}/run-simulation`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(payload)
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to run simulation');
    }

    return response.json();
  }

  /**
   * Generate optimal lineups
   * @param {number} count - Number of lineups to generate
   * @returns {Promise} - API response with generated lineups
   */
  static async generateLineups(count = 5) {
    const response = await fetch(`${API_BASE_URL}/generate-lineups`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ count })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate lineups');
    }

    return response.json();
  }

  /**
   * Generate tournament portfolio
   * @param {number} entries - Number of entries
   * @param {number} budget - Optional budget cap
   * @returns {Promise} - API response with tournament portfolio
   */
  static async generateTournament(entries = 20, budget = null) {
    const response = await fetch(`${API_BASE_URL}/generate-tournament`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json'
      },
      body: JSON.stringify({ entries, budget })
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to generate tournament portfolio');
    }

    return response.json();
  }
}

export default ApiClient;