const axios = require('axios');

class DataSyncService {
  constructor() {
    this.mainServerUrl = 'http://127.0.0.1:3000';
    this.cache = {
      players: { data: null, timestamp: null },
      lineups: { data: null, timestamp: null },
      exposures: { data: null, timestamp: null },
      contest: { data: null, timestamp: null }
    };
    this.cacheTTL = 30000; // 30 seconds TTL
    this.syncInterval = null;
    this.isRunning = false;
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
    console.log('🔄 Syncing data from main server...');
    
    try {
      // Fetch all data in parallel
      const [players, lineups, exposures, contest] = await Promise.all([
        this.fetchPlayers(),
        this.fetchLineups(),
        this.fetchExposures(),
        this.fetchContest()
      ]);
      
      console.log('✅ Data sync completed successfully');
      return { players, lineups, exposures, contest };
    } catch (error) {
      console.error('❌ Data sync failed:', error.message);
      throw error;
    }
  }

  async fetchPlayers() {
    try {
      console.log(`📡 Fetching players from ${this.mainServerUrl}/api/data/players`);
      const response = await axios.get(`${this.mainServerUrl}/api/data/players`);
      console.log('📊 Player data response:', {
        success: response.data.success,
        dataLength: response.data.data?.length || 0,
        timestamp: response.data.timestamp
      });
      
      if (response.data.success) {
        this.cache.players = {
          data: response.data.data,
          timestamp: new Date()
        };
        return response.data.data;
      }
      throw new Error('Failed to fetch player data');
    } catch (error) {
      console.error('❌ Error fetching players:', error.message);
      // Return cached data if available
      if (this.cache.players.data) {
        console.log('Using cached player data');
        return this.cache.players.data;
      }
      return [];
    }
  }

  async fetchLineups() {
    try {
      console.log(`📡 Fetching lineups from ${this.mainServerUrl}/api/data/lineups`);
      const response = await axios.get(`${this.mainServerUrl}/api/data/lineups`);
      console.log('🏆 Lineup data response:', {
        success: response.data.success,
        count: response.data.count || 0,
        dataLength: response.data.data?.length || 0,
        timestamp: response.data.timestamp
      });
      
      if (response.data.success) {
        this.cache.lineups = {
          data: response.data.data,
          timestamp: new Date()
        };
        return response.data.data;
      }
      throw new Error('Failed to fetch lineup data');
    } catch (error) {
      console.error('❌ Error fetching lineups:', error.message);
      // Return cached data if available
      if (this.cache.lineups.data) {
        console.log('Using cached lineup data');
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
      console.error('Error fetching exposures:', error.message);
      // Return cached data if available
      if (this.cache.exposures.data) {
        console.log('Using cached exposure data');
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
      console.error('Error fetching contest:', error.message);
      // Return cached data if available
      if (this.cache.contest.data) {
        console.log('Using cached contest data');
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