const axios = require('axios');

class DataSyncService {
  constructor() {
    this.mainServerUrl = 'http://127.0.0.1:3001';
    this.cache = {
      players: { data: null, timestamp: null },
      lineups: { data: null, timestamp: null },
      exposures: { data: null, timestamp: null },
      contest: { data: null, timestamp: null }
    };
    this.cacheTTL = 30000; // 30 seconds TTL
    this.syncInterval = null;
    this.isRunning = false;
    this.retryAttempts = 3;
    this.retryDelay = 1000; // 1 second
  }

  // Helper method for retry logic
  async fetchWithRetry(url, dataType) {
    let lastError = null;
    
    for (let attempt = 1; attempt <= this.retryAttempts; attempt++) {
      try {
        const response = await axios.get(url, {
          timeout: 5000 // 5 second timeout
        });
        
        if (response.data.success) {
          return response.data;
        }
        throw new Error(`Failed to fetch ${dataType}`);
      } catch (error) {
        lastError = error;
        
        if (attempt < this.retryAttempts) {
          await new Promise(resolve => setTimeout(resolve, this.retryDelay * attempt));
        }
      }
    }
    
    throw lastError;
  }

  async initialize() {
    console.log('📊 Initializing Data Sync Service...');
    
    // Initial sync
    await this.syncAllData();
    
    // Set up periodic sync every 30 seconds
    this.syncInterval = setInterval(() => {
      this.syncAllData().catch(err => {
        console.error('❌ Periodic sync failed:', err.message);
      });
    }, this.cacheTTL);
    
    this.isRunning = true;
    console.log('✅ Data Sync Service initialized');
  }

  async syncAllData() {
    try {
      // Fetch all data in parallel
      const [players, lineups, exposures, contest] = await Promise.all([
        this.fetchPlayers(),
        this.fetchLineups(),
        this.fetchExposures(),
        this.fetchContest()
      ]);
      
      console.log('✅ Data sync completed');
      return { players, lineups, exposures, contest };
    } catch (error) {
      console.error('❌ Data sync failed:', error.message);
      throw error;
    }
  }

  async fetchPlayers() {
    try {
      const response = await this.fetchWithRetry(`${this.mainServerUrl}/api/data/players`, 'players');
      
      this.cache.players = {
        data: response.data,
        timestamp: new Date()
      };
      return response.data;
    } catch (error) {
      // Return cached data if available
      if (this.cache.players.data) {
        return this.cache.players.data;
      }
      return [];
    }
  }

  async fetchLineups() {
    try {
      const response = await this.fetchWithRetry(`${this.mainServerUrl}/api/data/lineups`, 'lineups');
      
      this.cache.lineups = {
        data: response.data,
        timestamp: new Date()
      };
      return response.data;
    } catch (error) {
      // Return cached data if available
      if (this.cache.lineups.data) {
        return this.cache.lineups.data;
      }
      return [];
    }
  }

  async fetchExposures() {
    try {
      const response = await axios.get(`${this.mainServerUrl}/api/data/exposures`);
      if (response.data.success) {
        this.cache.exposures = {
          data: response.data.data,
          timestamp: new Date()
        };
        return response.data.data;
      }
      throw new Error('Failed to fetch exposure data');
    } catch (error) {
      // Return cached data if available
      if (this.cache.exposures.data) {
        return this.cache.exposures.data;
      }
      return { team: {}, position: {} };
    }
  }

  async fetchContest() {
    try {
      const response = await axios.get(`${this.mainServerUrl}/api/data/contest`);
      if (response.data.success) {
        this.cache.contest = {
          data: response.data.data,
          timestamp: new Date()
        };
        return response.data.data;
      }
      throw new Error('Failed to fetch contest data');
    } catch (error) {
      // Return cached data if available
      if (this.cache.contest.data) {
        return this.cache.contest.data;
      }
      return { metadata: null, teamStacks: [], settings: {} };
    }
  }

  // Get cached data with freshness check
  getCachedData(dataType) {
    const cacheEntry = this.cache[dataType];
    if (!cacheEntry || !cacheEntry.data) {
      return null;
    }
    
    // Check if cache is still fresh
    const age = Date.now() - cacheEntry.timestamp.getTime();
    if (age > this.cacheTTL) {
      console.log(`Cache expired for ${dataType}, fetching fresh data...`);
      // Trigger async refresh but return stale data for now
      this[`fetch${dataType.charAt(0).toUpperCase() + dataType.slice(1)}`]();
    }
    
    return cacheEntry.data;
  }

  getPlayers() {
    return this.getCachedData('players') || [];
  }

  getLineups() {
    return this.getCachedData('lineups') || [];
  }

  getExposures() {
    return this.getCachedData('exposures') || { team: {}, position: {} };
  }

  getContest() {
    return this.getCachedData('contest') || { metadata: null, teamStacks: [], settings: {} };
  }

  // Force refresh of specific data type
  async refreshData(dataType) {
    switch (dataType) {
      case 'players':
        return await this.fetchPlayers();
      case 'lineups':
        return await this.fetchLineups();
      case 'exposures':
        return await this.fetchExposures();
      case 'contest':
        return await this.fetchContest();
      default:
        throw new Error(`Unknown data type: ${dataType}`);
    }
  }

  // Cleanup
  stop() {
    if (this.syncInterval) {
      clearInterval(this.syncInterval);
      this.syncInterval = null;
    }
    this.isRunning = false;
    console.log('Data Sync Service stopped');
  }
}

module.exports = DataSyncService;