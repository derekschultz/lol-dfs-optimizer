const axios = require('axios');

class DataCollector {
  constructor() {
    this.ready = false;
    this.dataSources = {
      riotAPI: 'https://americas.api.riotgames.com',
      draftKings: 'https://api.draftkings.com', // Mock - would need real API
      leagueStats: 'https://lolesports.com/api' // Mock - would need real API
    };
    this.cache = new Map();
    this.initialize();
  }

  async initialize() {
    try {
      console.log('📊 Initializing Data Collector...');
      this.ready = true;
      console.log('✅ Data Collector ready');
    } catch (error) {
      console.error('❌ Failed to initialize Data Collector:', error);
    }
  }

  isReady() {
    return this.ready;
  }

  async collectLatestData() {
    if (!this.ready) {
      throw new Error('Data Collector not ready');
    }

    console.log('🔄 Starting data collection cycle...');

    try {
      // Collect different types of data in parallel
      const [
        matchData,
        playerStats,
        ownershipData,
        metaData
      ] = await Promise.allSettled([
        this.collectMatchData(),
        this.collectPlayerStats(),
        this.collectOwnershipData(),
        this.collectMetaData()
      ]);

      const results = {
        timestamp: new Date().toISOString(),
        matches: matchData.status === 'fulfilled' ? matchData.value : null,
        players: playerStats.status === 'fulfilled' ? playerStats.value : null,
        ownership: ownershipData.status === 'fulfilled' ? ownershipData.value : null,
        meta: metaData.status === 'fulfilled' ? metaData.value : null,
        errors: this.extractErrors([matchData, playerStats, ownershipData, metaData])
      };

      console.log('✅ Data collection completed');
      return results;

    } catch (error) {
      console.error('❌ Data collection failed:', error);
      throw error;
    }
  }

  async collectMatchData() {
    console.log('📅 Collecting recent match data...');
    
    // Simulate API call to get recent match results
    // In production, this would call actual APIs
    const mockMatches = [
      {
        matchId: 'ESPORTSTMNT01_2474893',
        date: '2024-12-15',
        teams: ['T1', 'GEN'],
        result: '2-1',
        duration: 34.5,
        patch: '13.20',
        players: [
          { name: 'Faker', team: 'T1', position: 'MID', kills: 4, deaths: 2, assists: 8, cs: 245 },
          { name: 'Zeus', team: 'T1', position: 'TOP', kills: 2, deaths: 1, assists: 5, cs: 220 },
          { name: 'Chovy', team: 'GEN', position: 'MID', kills: 3, deaths: 3, assists: 6, cs: 238 }
        ]
      },
      {
        matchId: 'ESPORTSTMNT01_2474894',
        date: '2024-12-14',
        teams: ['DK', 'DRX'],
        result: '2-0',
        duration: 28.2,
        patch: '13.20',
        players: [
          { name: 'ShowMaker', team: 'DK', position: 'MID', kills: 6, deaths: 1, assists: 4, cs: 201 },
          { name: 'Canyon', team: 'DRX', position: 'JNG', kills: 2, deaths: 4, assists: 8, cs: 145 }
        ]
      }
    ];

    // Simulate network delay
    await new Promise(resolve => setTimeout(resolve, 500));
    
    return {
      matches: mockMatches,
      total: mockMatches.length,
      lastUpdate: new Date().toISOString()
    };
  }

  async collectPlayerStats() {
    console.log('👥 Collecting player statistics...');
    
    // Simulate API call to get player stats
    const mockStats = [
      {
        name: 'Faker',
        team: 'T1',
        position: 'MID',
        stats: {
          gamesPlayed: 15,
          winRate: 0.73,
          avgKills: 4.2,
          avgDeaths: 2.1,
          avgAssists: 7.8,
          avgCS: 234,
          kdaRatio: 5.7,
          recentForm: [8.2, 7.8, 9.1, 8.5, 7.9] // Last 5 games fantasy points
        }
      },
      {
        name: 'Chovy',
        team: 'GEN',
        position: 'MID',
        stats: {
          gamesPlayed: 14,
          winRate: 0.68,
          avgKills: 5.1,
          avgDeaths: 1.8,
          avgAssists: 6.9,
          avgCS: 245,
          kdaRatio: 6.7,
          recentForm: [9.0, 8.7, 8.9, 9.2, 8.8]
        }
      },
      {
        name: 'Zeus',
        team: 'T1',
        position: 'TOP',
        stats: {
          gamesPlayed: 15,
          winRate: 0.73,
          avgKills: 2.8,
          avgDeaths: 2.3,
          avgAssists: 5.4,
          avgCS: 210,
          kdaRatio: 3.6,
          recentForm: [7.5, 9.2, 6.8, 8.1, 7.9]
        }
      }
    ];

    await new Promise(resolve => setTimeout(resolve, 300));
    
    return {
      players: mockStats,
      total: mockStats.length,
      lastUpdate: new Date().toISOString()
    };
  }

  async collectOwnershipData() {
    console.log('📈 Collecting ownership data...');
    
    // Simulate DraftKings ownership data
    const mockOwnership = [
      { name: 'Faker', team: 'T1', position: 'MID', ownership: 45.2, salary: 12000 },
      { name: 'Chovy', team: 'GEN', position: 'MID', ownership: 38.7, salary: 12300 },
      { name: 'Zeus', team: 'T1', position: 'TOP', ownership: 25.3, salary: 8400 },
      { name: 'Ruler', team: 'GEN', position: 'ADC', ownership: 32.1, salary: 8000 },
      { name: 'Canyon', team: 'DRX', position: 'JNG', ownership: 28.4, salary: 7900 }
    ];

    await new Promise(resolve => setTimeout(resolve, 400));
    
    return {
      ownership: mockOwnership,
      total: mockOwnership.length,
      lastUpdate: new Date().toISOString(),
      contestInfo: {
        totalEntries: 12547,
        prizePool: 125000,
        topPayout: 25000
      }
    };
  }

  async collectMetaData() {
    console.log('🎯 Collecting meta analysis data...');
    
    // Simulate champion pick/ban data and meta trends
    const mockMeta = {
      patch: '13.20',
      championTrends: [
        { name: 'Azir', role: 'MID', pickRate: 0.45, winRate: 0.52, trend: 'rising' },
        { name: 'Jinx', role: 'ADC', pickRate: 0.38, winRate: 0.55, trend: 'rising' },
        { name: 'Thresh', role: 'SUP', pickRate: 0.42, winRate: 0.48, trend: 'stable' },
        { name: 'Zeri', role: 'ADC', pickRate: 0.12, winRate: 0.41, trend: 'declining' }
      ],
      teamStrategies: [
        { name: 'Late game scaling', prevalence: 0.65, effectiveness: 0.58 },
        { name: 'Early aggression', prevalence: 0.35, effectiveness: 0.42 }
      ],
      avgGameLength: 32.4,
      killsPerGame: 15.8,
      lastUpdate: new Date().toISOString()
    };

    await new Promise(resolve => setTimeout(resolve, 600));
    
    return mockMeta;
  }

  extractErrors(results) {
    const errors = [];
    
    results.forEach((result, index) => {
      if (result.status === 'rejected') {
        errors.push({
          source: ['matches', 'players', 'ownership', 'meta'][index],
          error: result.reason.message,
          timestamp: new Date().toISOString()
        });
      }
    });

    return errors;
  }

  // Helper method to get cached data
  getCachedData(key, maxAgeMinutes = 15) {
    const cached = this.cache.get(key);
    if (!cached) return null;

    const ageMinutes = (Date.now() - cached.timestamp) / (1000 * 60);
    if (ageMinutes > maxAgeMinutes) {
      this.cache.delete(key);
      return null;
    }

    return cached.data;
  }

  // Helper method to cache data
  setCachedData(key, data) {
    this.cache.set(key, {
      data: data,
      timestamp: Date.now()
    });
  }

  // Get specific data with caching
  async getRecentMatches(hours = 24) {
    const cacheKey = `matches_${hours}h`;
    let data = this.getCachedData(cacheKey);
    
    if (!data) {
      console.log(`🔄 Fetching recent matches (${hours}h)...`);
      const result = await this.collectMatchData();
      data = result.matches.filter(match => {
        const matchDate = new Date(match.date);
        const hoursAgo = Date.now() - (hours * 60 * 60 * 1000);
        return matchDate.getTime() > hoursAgo;
      });
      this.setCachedData(cacheKey, data);
    }
    
    return data;
  }

  async getPlayerPerformanceData(playerNames = []) {
    const cacheKey = `player_data_${playerNames.join('_')}`;
    let data = this.getCachedData(cacheKey);
    
    if (!data) {
      console.log('🔄 Fetching player performance data...');
      const result = await this.collectPlayerStats();
      data = playerNames.length > 0 
        ? result.players.filter(p => playerNames.includes(p.name))
        : result.players;
      this.setCachedData(cacheKey, data);
    }
    
    return data;
  }

  async getCurrentOwnership() {
    const cacheKey = 'current_ownership';
    let data = this.getCachedData(cacheKey, 5); // Cache for 5 minutes
    
    if (!data) {
      console.log('🔄 Fetching current ownership data...');
      data = await this.collectOwnershipData();
      this.setCachedData(cacheKey, data);
    }
    
    return data;
  }

  async getMetaTrends() {
    const cacheKey = 'meta_trends';
    let data = this.getCachedData(cacheKey, 30); // Cache for 30 minutes
    
    if (!data) {
      console.log('🔄 Fetching meta trends...');
      data = await this.collectMetaData();
      this.setCachedData(cacheKey, data);
    }
    
    return data;
  }
}

module.exports = DataCollector;