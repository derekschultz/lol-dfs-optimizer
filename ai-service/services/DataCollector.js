const axios = require("axios");
const RiotGamesAPI = require("./RiotGamesAPI");

class DataCollector {
  constructor(riotApiKey) {
    this.ready = false;
    this.riotAPI = riotApiKey ? new RiotGamesAPI(riotApiKey) : null;
    this.dataSources = {
      riotAPI: "https://americas.api.riotgames.com",
    };
    this.cache = new Map();
    this.initialize();
  }

  async initialize() {
    try {
      if (!this.riotAPI) {
        console.warn(
          "⚠️ No Riot API key provided - will use cached/fallback data"
        );
        console.warn(
          "💡 To enable live data collection, set RIOT_API_KEY environment variable"
        );
        console.warn(
          "💡 Get your API key from: https://developer.riotgames.com/"
        );
      }

      // Test API connection if available
      if (this.riotAPI) {
        try {
          // Test with a simple request
          const testSummoner = await this.riotAPI.getSummonerByName(
            "Faker",
            "KR",
            "KR1"
          );
          console.log("✅ Riot API connection verified");
          console.log("✅ API key is valid and has required permissions");
        } catch (error) {
          console.warn("⚠️ Riot API test failed:", error.message);

          if (error.status === 403) {
            console.error("❌ API KEY ISSUE: 403 Forbidden");
            console.error("   This usually means:");
            console.error("   - API key is invalid or expired");
            console.error("   - API key lacks required permissions");
            console.error("   - Request violates API usage policies");
            console.error(
              "   Please check your API key at: https://developer.riotgames.com/"
            );
          } else if (error.status === 401) {
            console.error("❌ API KEY ISSUE: 401 Unauthorized");
            console.error("   API key is missing or invalid");
          } else if (error.status === 429) {
            console.warn("⚠️ Rate limit exceeded during API test");
          }
        }
      }

      this.ready = true;
      console.log("✅ Data Collector ready");
    } catch (error) {
      console.error("❌ Failed to initialize Data Collector:", error);
    }
  }

  isReady() {
    return this.ready;
  }

  async collectLatestData() {
    if (!this.ready) {
      throw new Error("Data Collector not ready");
    }

    console.log("🔄 Starting data collection cycle...");
    console.log(`🔧 Riot API available: ${!!this.riotAPI}`);

    try {
      // Collect different types of data in parallel
      const [matchData, playerStats, ownershipData, metaData] =
        await Promise.allSettled([
          this.collectMatchData(),
          this.collectPlayerStats(),
          this.collectOwnershipData(),
          this.collectMetaData(),
        ]);

      const results = {
        timestamp: new Date().toISOString(),
        matches: matchData.status === "fulfilled" ? matchData.value : null,
        players: playerStats.status === "fulfilled" ? playerStats.value : null,
        ownership:
          ownershipData.status === "fulfilled" ? ownershipData.value : null,
        meta: metaData.status === "fulfilled" ? metaData.value : null,
        errors: this.extractErrors([
          matchData,
          playerStats,
          ownershipData,
          metaData,
        ]),
      };

      console.log("✅ Data collection completed");
      console.log(
        `📊 Results: ${
          results.matches?.matches?.length || results.matches?.total || 0
        } matches, ${
          results.players?.players?.length || results.players?.total || 0
        } players`
      );
      return results;
    } catch (error) {
      console.error("❌ Data collection failed:", error);
      throw error;
    }
  }

  async collectMatchData() {
    console.log("📅 Collecting recent match data...");

    if (!this.riotAPI) {
      console.warn("⚠️ No Riot API - returning fallback data");
      return this.getFallbackMatchData();
    }

    try {
      // Set overall timeout for match collection (60 seconds max for all data)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Match collection timeout")), 60000)
      );

      const collectMatches = async () => {
        const matches = [];

        // Get player data from main application
        const liveData = await this.fetchLiveData();
        console.log(
          `📥 Live data: ${liveData.players?.length || 0} players available`
        );

        if (
          !liveData.success ||
          !liveData.players ||
          liveData.players.length === 0
        ) {
          console.warn("⚠️ No player data from main app - using fallback");
          return this.getFallbackMatchData();
        }

        // Get ALL players with summoner info (no limit)
        const playersWithSummoners = liveData.players.filter(
          (p) => p.summonerName && p.region
        );

        console.log(
          `🎯 Found ${playersWithSummoners.length} players with summoner info`
        );

        for (const player of playersWithSummoners) {
          try {
            console.log(
              `🔍 Fetching matches for ${player.name} (${player.summonerName})...`
            );

            // Get summoner with timeout
            const summoner = await Promise.race([
              this.riotAPI.getSummonerByName(
                player.summonerName,
                player.region,
                player.tagLine
              ),
              new Promise((_, reject) =>
                setTimeout(
                  () => reject(new Error("Summoner lookup timeout")),
                  5000
                )
              ),
            ]);

            // Get match history with timeout
            const matchIds = await Promise.race([
              this.riotAPI.getMatchHistory(summoner.puuid, player.region, 3),
              new Promise((_, reject) =>
                setTimeout(
                  () => reject(new Error("Match history timeout")),
                  5000
                )
              ),
            ]);

            // Process up to 2 matches per player
            if (matchIds && matchIds.length > 0) {
              for (const matchId of matchIds.slice(0, 2)) {
                try {
                  const matchData = await Promise.race([
                    this.riotAPI.processMatchForStats(matchId, player.region),
                    new Promise((_, reject) =>
                      setTimeout(
                        () => reject(new Error("Match processing timeout")),
                        8000
                      )
                    ),
                  ]);

                  if (matchData) {
                    matches.push({
                      matchId: matchData.matchId,
                      date: new Date(matchData.gameCreation)
                        .toISOString()
                        .split("T")[0],
                      duration:
                        Math.round((matchData.gameDuration / 60) * 10) / 10,
                      patch:
                        matchData.championStats[0]?.stats?.gameVersion
                          ?.split(".")
                          .slice(0, 2)
                          .join(".") || "Unknown",
                      players: matchData.playerStats.map((p) => ({
                        name: player.name,
                        team: player.team,
                        position: player.position,
                        kills: p.stats.kills,
                        deaths: p.stats.deaths,
                        assists: p.stats.assists,
                        cs: p.stats.cs,
                        fantasyPoints: p.stats.fantasyPoints,
                      })),
                    });
                    console.log(
                      `✅ Added match ${matchId.slice(-8)} for ${player.name}`
                    );
                  }
                } catch (matchError) {
                  console.warn(
                    `⚠️ Failed to process match ${matchId.slice(-8)} for ${
                      player.name
                    }: ${matchError.message}`
                  );
                }
              }
            }

            // Rate limiting between players
            await new Promise((resolve) => setTimeout(resolve, 2000));
          } catch (error) {
            console.warn(
              `⚠️ Failed to fetch data for ${player.name}: ${error.message}`
            );
            // Continue with next player
          }
        }

        // Return real data if we got any, otherwise fallback
        if (matches.length > 0) {
          return {
            matches: matches,
            total: matches.length,
            lastUpdate: new Date().toISOString(),
            source: "riot_api",
          };
        } else {
          console.log("📋 No real matches collected, using fallback");
          return this.getFallbackMatchData();
        }
      };

      // Race collection against timeout
      return await Promise.race([collectMatches(), timeoutPromise]);
    } catch (error) {
      console.error(
        "❌ Match collection failed, using fallback:",
        error.message
      );
      return this.getFallbackMatchData();
    }
  }

  getFallbackMatchData() {
    const mockMatches = [
      {
        matchId: "CACHED_MATCH_001",
        date: new Date(Date.now() - 24 * 60 * 60 * 1000)
          .toISOString()
          .split("T")[0],
        duration: 34.5,
        patch: "14.24",
        players: [
          {
            name: "Faker",
            team: "T1",
            position: "MID",
            kills: 4,
            deaths: 2,
            assists: 8,
            cs: 245,
            fantasyPoints: 28.45,
          },
          {
            name: "Zeus",
            team: "T1",
            position: "TOP",
            kills: 2,
            deaths: 1,
            assists: 5,
            cs: 220,
            fantasyPoints: 21.2,
          },
        ],
      },
    ];

    return {
      matches: mockMatches,
      total: mockMatches.length,
      lastUpdate: new Date().toISOString(),
      source: "fallback",
    };
  }

  async collectPlayerStats() {
    console.log("👥 Collecting player statistics...");

    if (!this.riotAPI) {
      console.warn("⚠️ No Riot API - returning fallback stats");
      return this.getFallbackPlayerStats();
    }

    try {
      // Set overall timeout (45 seconds max for all stats)
      const timeoutPromise = new Promise((_, reject) =>
        setTimeout(() => reject(new Error("Player stats timeout")), 45000)
      );

      const collectStats = async () => {
        const playerStats = [];

        // Get player data from main application
        const liveData = await this.fetchLiveData();
        if (
          !liveData.success ||
          !liveData.players ||
          liveData.players.length === 0
        ) {
          console.warn("⚠️ No player data from main app - using fallback");
          return this.getFallbackPlayerStats();
        }

        // Get ALL players with summoner info (no limit)
        const playersWithSummoners = liveData.players.filter(
          (p) => p.summonerName && p.region
        );

        console.log(`📊 Analyzing ${playersWithSummoners.length} players...`);

        for (const player of playersWithSummoners) {
          try {
            console.log(`📈 Getting stats for ${player.name}...`);

            // Get summoner
            const summoner = await Promise.race([
              this.riotAPI.getSummonerByName(
                player.summonerName,
                player.region,
                player.tagLine
              ),
              new Promise((_, reject) =>
                setTimeout(() => reject(new Error("Summoner timeout")), 4000)
              ),
            ]);

            // Get recent matches (just 3 for speed)
            const matchIds = await Promise.race([
              this.riotAPI.getMatchHistory(summoner.puuid, player.region, 3),
              new Promise((_, reject) =>
                setTimeout(
                  () => reject(new Error("Match history timeout")),
                  4000
                )
              ),
            ]);

            let totalKills = 0,
              totalDeaths = 0,
              totalAssists = 0,
              totalCS = 0;
            let wins = 0;
            const recentForm = [];

            // Analyze matches quickly
            for (const matchId of matchIds.slice(0, 2)) {
              // Only 2 matches for speed
              try {
                const matchData = await Promise.race([
                  this.riotAPI.processMatchForStats(matchId, player.region),
                  new Promise((_, reject) =>
                    setTimeout(
                      () => reject(new Error("Match processing timeout")),
                      6000
                    )
                  ),
                ]);

                if (matchData) {
                  const playerMatch = matchData.playerStats.find(
                    (p) => p.puuid === summoner.puuid
                  );
                  if (playerMatch) {
                    if (playerMatch.stats.win) wins++;
                    totalKills += playerMatch.stats.kills;
                    totalDeaths += playerMatch.stats.deaths;
                    totalAssists += playerMatch.stats.assists;
                    totalCS += playerMatch.stats.cs;
                    recentForm.push(playerMatch.stats.fantasyPoints);
                  }
                }
              } catch (matchError) {
                console.warn(
                  `⚠️ Failed to process match for ${player.name}: ${matchError.message}`
                );
              }
            }

            const gamesPlayed = recentForm.length;
            if (gamesPlayed > 0) {
              playerStats.push({
                name: player.name,
                team: player.team,
                position: player.position,
                stats: {
                  gamesPlayed,
                  winRate: wins / gamesPlayed,
                  avgKills: totalKills / gamesPlayed,
                  avgDeaths: totalDeaths / gamesPlayed,
                  avgAssists: totalAssists / gamesPlayed,
                  avgCS: totalCS / gamesPlayed,
                  kdaRatio:
                    totalDeaths > 0
                      ? (totalKills + totalAssists) / totalDeaths
                      : totalKills + totalAssists,
                  recentForm: recentForm,
                  avgFantasyPoints:
                    recentForm.reduce((a, b) => a + b, 0) / recentForm.length,
                },
              });
              console.log(
                `✅ Added stats for ${player.name} (${gamesPlayed} games)`
              );
            }

            // Rate limit between players
            await new Promise((resolve) => setTimeout(resolve, 1500));
          } catch (error) {
            console.warn(
              `⚠️ Failed to get stats for ${player.name}: ${error.message}`
            );
          }
        }

        // Return real stats if we got any, otherwise fallback
        if (playerStats.length > 0) {
          return {
            players: playerStats,
            total: playerStats.length,
            lastUpdate: new Date().toISOString(),
            source: "riot_api",
          };
        } else {
          console.log("📋 No real stats collected, using fallback");
          return this.getFallbackPlayerStats();
        }
      };

      return await Promise.race([collectStats(), timeoutPromise]);
    } catch (error) {
      console.error(
        "❌ Player stats collection failed, using fallback:",
        error.message
      );
      return this.getFallbackPlayerStats();
    }
  }

  getFallbackPlayerStats() {
    const mockStats = [
      {
        name: "Faker",
        team: "T1",
        position: "MID",
        stats: {
          gamesPlayed: 15,
          winRate: 0.73,
          avgKills: 4.2,
          avgDeaths: 2.1,
          avgAssists: 7.8,
          avgCS: 234,
          kdaRatio: 5.7,
          recentForm: [8.2, 7.8, 9.1, 8.5, 7.9],
          avgFantasyPoints: 8.3,
        },
      },
      {
        name: "Chovy",
        team: "GEN",
        position: "MID",
        stats: {
          gamesPlayed: 14,
          winRate: 0.68,
          avgKills: 5.1,
          avgDeaths: 1.8,
          avgAssists: 6.9,
          avgCS: 245,
          kdaRatio: 6.7,
          recentForm: [9.0, 8.7, 8.9, 9.2, 8.8],
          avgFantasyPoints: 8.9,
        },
      },
    ];

    return {
      players: mockStats,
      total: mockStats.length,
      lastUpdate: new Date().toISOString(),
      source: "fallback",
    };
  }

  async collectOwnershipData() {
    console.log("📈 Collecting ownership data...");

    // Simulate DraftKings ownership data
    const mockOwnership = [
      {
        name: "Faker",
        team: "T1",
        position: "MID",
        ownership: 45.2,
        salary: 12000,
      },
      {
        name: "Chovy",
        team: "GEN",
        position: "MID",
        ownership: 38.7,
        salary: 12300,
      },
      {
        name: "Zeus",
        team: "T1",
        position: "TOP",
        ownership: 25.3,
        salary: 8400,
      },
      {
        name: "Ruler",
        team: "GEN",
        position: "ADC",
        ownership: 32.1,
        salary: 8000,
      },
      {
        name: "Canyon",
        team: "DRX",
        position: "JNG",
        ownership: 28.4,
        salary: 7900,
      },
    ];

    // Removed delay for fast response

    return {
      ownership: mockOwnership,
      total: mockOwnership.length,
      lastUpdate: new Date().toISOString(),
      contestInfo: {
        totalEntries: 12547,
        prizePool: 125000,
        topPayout: 25000,
      },
    };
  }

  async collectMetaData() {
    console.log("🎯 Collecting meta analysis data...");

    // Simulate champion pick/ban data and meta trends
    const mockMeta = {
      patch: "13.20",
      championTrends: [
        {
          name: "Azir",
          role: "MID",
          pickRate: 0.45,
          winRate: 0.52,
          trend: "rising",
        },
        {
          name: "Jinx",
          role: "ADC",
          pickRate: 0.38,
          winRate: 0.55,
          trend: "rising",
        },
        {
          name: "Thresh",
          role: "SUP",
          pickRate: 0.42,
          winRate: 0.48,
          trend: "stable",
        },
        {
          name: "Zeri",
          role: "ADC",
          pickRate: 0.12,
          winRate: 0.41,
          trend: "declining",
        },
      ],
      teamStrategies: [
        { name: "Late game scaling", prevalence: 0.65, effectiveness: 0.58 },
        { name: "Early aggression", prevalence: 0.35, effectiveness: 0.42 },
      ],
      avgGameLength: 32.4,
      killsPerGame: 15.8,
      lastUpdate: new Date().toISOString(),
    };

    // Removed delay for fast response

    return mockMeta;
  }

  extractErrors(results) {
    const errors = [];

    results.forEach((result, index) => {
      if (result.status === "rejected") {
        errors.push({
          source: ["matches", "players", "ownership", "meta"][index],
          error: result.reason.message,
          timestamp: new Date().toISOString(),
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
      timestamp: Date.now(),
    });
  }

  // Get specific data with caching
  async getRecentMatches(hours = 24) {
    const cacheKey = `matches_${hours}h`;
    let data = this.getCachedData(cacheKey);

    if (!data) {
      console.log(`🔄 Fetching recent matches (${hours}h)...`);
      const result = await this.collectMatchData();
      data = result.matches.filter((match) => {
        const matchDate = new Date(match.date);
        const hoursAgo = Date.now() - hours * 60 * 60 * 1000;
        return matchDate.getTime() > hoursAgo;
      });
      this.setCachedData(cacheKey, data);
    }

    return data;
  }

  async getPlayerPerformanceData(playerNames = []) {
    const cacheKey = `player_data_${playerNames.join("_")}`;
    let data = this.getCachedData(cacheKey);

    if (!data) {
      console.log("🔄 Fetching player performance data...");
      const result = await this.collectPlayerStats();
      data =
        playerNames.length > 0
          ? result.players.filter((p) => playerNames.includes(p.name))
          : result.players;
      this.setCachedData(cacheKey, data);
    }

    return data;
  }

  async getCurrentOwnership() {
    const cacheKey = "current_ownership";
    let data = this.getCachedData(cacheKey, 5); // Cache for 5 minutes

    if (!data) {
      console.log("🔄 Fetching current ownership data...");
      data = await this.collectOwnershipData();
      this.setCachedData(cacheKey, data);
    }

    return data;
  }

  async getMetaTrends() {
    const cacheKey = "meta_trends";
    let data = this.getCachedData(cacheKey, 30); // Cache for 30 minutes

    if (!data) {
      console.log("🔄 Fetching meta trends...");
      data = await this.collectMetaData();
      this.setCachedData(cacheKey, data);
    }

    return data;
  }

  async fetchLiveData() {
    if (!this.ready) {
      throw new Error("Data Collector not ready");
    }

    const MAIN_SERVER_URL = "http://127.0.0.1:3001";
    const cacheKey = "live_data";

    // Check cache first (cache for 2 minutes to avoid excessive calls)
    let data = this.getCachedData(cacheKey, 2);
    if (data) {
      console.log("🔄 Returning cached live data");
      return data;
    }

    try {
      console.log("📡 Fetching live data from main server...");

      // Fetch data from main server endpoints
      const [playersRes, lineupsRes, exposuresRes, contestRes] =
        await Promise.allSettled([
          axios.get(`${MAIN_SERVER_URL}/api/data/players`),
          axios.get(`${MAIN_SERVER_URL}/api/data/lineups`),
          axios.get(`${MAIN_SERVER_URL}/api/data/exposures`),
          axios.get(`${MAIN_SERVER_URL}/api/data/contest`),
        ]);

      // Process the results
      const players =
        playersRes.status === "fulfilled" && playersRes.value.data.success
          ? playersRes.value.data.data
          : [];

      const lineups =
        lineupsRes.status === "fulfilled" && lineupsRes.value.data.success
          ? lineupsRes.value.data.data
          : [];

      const exposures =
        exposuresRes.status === "fulfilled" && exposuresRes.value.data.success
          ? exposuresRes.value.data.data
          : {};

      const contest =
        contestRes.status === "fulfilled" && contestRes.value.data.success
          ? contestRes.value.data.data
          : {};

      const liveData = {
        success: true,
        players,
        lineups,
        exposures,
        contest,
        timestamp: new Date().toISOString(),
        source: "main_server",
      };

      // Cache the result
      this.setCachedData(cacheKey, liveData);

      console.log(
        `✅ Live data fetched: ${players.length} players, ${lineups.length} lineups`
      );
      return liveData;
    } catch (error) {
      console.error(
        "❌ Failed to fetch live data from main server:",
        error.message
      );

      // Return empty data structure
      return {
        success: false,
        error: "Failed to connect to main server",
        details: error.message,
        players: [],
        lineups: [],
        exposures: {},
        contest: {},
        timestamp: new Date().toISOString(),
      };
    }
  }
}

module.exports = DataCollector;
