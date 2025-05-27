const fs = require("fs");
const path = require("path");
const DataCollector = require("./DataCollector");

class BackgroundDataCollector {
  constructor(riotApiKey, championTracker = null) {
    this.dataCollector = new DataCollector(riotApiKey);
    this.championTracker = championTracker; // Use shared championTracker instance
    this.cacheDir = path.join(__dirname, "../cache");
    this.isCollecting = false;
    this.lastCollection = null;
    this.collectionErrors = [];
    this.progressCallback = null;

    // Ensure cache directory exists
    if (!fs.existsSync(this.cacheDir)) {
      fs.mkdirSync(this.cacheDir, { recursive: true });
    }

    console.log("🔄 Background Data Collector initialized");
  }

  // Set callback for progress updates
  setProgressCallback(callback) {
    this.progressCallback = callback;
  }

  // Update progress
  updateProgress(phase, message, data = null) {
    const progress = {
      phase,
      message,
      timestamp: new Date().toISOString(),
      data,
    };

    console.log(`📊 ${phase}: ${message}`);

    if (this.progressCallback) {
      this.progressCallback(progress);
    }

    // Save progress to file
    const progressFile = path.join(this.cacheDir, "collection-progress.json");
    fs.writeFileSync(progressFile, JSON.stringify(progress, null, 2));
  }

  // Get current progress
  getProgress() {
    try {
      const progressFile = path.join(this.cacheDir, "collection-progress.json");
      if (fs.existsSync(progressFile)) {
        return JSON.parse(fs.readFileSync(progressFile, "utf8"));
      }
    } catch (error) {
      console.warn("Failed to read progress:", error.message);
    }
    return null;
  }

  // Check if collection is needed (every 30 minutes)
  needsCollection() {
    if (!this.lastCollection) return true;
    const thirtyMinutes = 30 * 60 * 1000;
    return Date.now() - this.lastCollection.getTime() > thirtyMinutes;
  }

  // Get cached data
  getCachedData() {
    try {
      const cacheFile = path.join(this.cacheDir, "latest-data.json");
      if (fs.existsSync(cacheFile)) {
        const data = JSON.parse(fs.readFileSync(cacheFile, "utf8"));
        return {
          success: true,
          data,
          fromCache: true,
          lastUpdated: data.timestamp,
        };
      }
    } catch (error) {
      console.warn("Failed to read cached data:", error.message);
    }

    return {
      success: false,
      error: "No cached data available",
      fromCache: true,
    };
  }

  // Main collection method - collects ALL player data
  async collectAllData() {
    if (this.isCollecting) {
      console.log("⚠️ Collection already in progress");
      return { success: false, error: "Collection already in progress" };
    }

    this.isCollecting = true;
    this.collectionErrors = [];

    try {
      this.updateProgress(
        "Starting",
        "Initializing complete data collection..."
      );

      // Wait for data collector to be ready
      while (!this.dataCollector.isReady()) {
        await new Promise((resolve) => setTimeout(resolve, 1000));
      }

      // Check if Riot API is available
      if (!this.dataCollector.riotAPI) {
        console.warn("⚠️ No Riot API available - collection will be limited");
        this.collectionErrors.push({
          player: "System",
          type: "api_unavailable",
          error: "Riot API key not configured - limited data collection",
        });
      }

      this.updateProgress(
        "fetching_players",
        "Getting player list from main server..."
      );

      // Get all players with summoner info
      const liveData = await this.dataCollector.fetchLiveData();
      if (!liveData.success || !liveData.players) {
        throw new Error("Failed to get player data from main server");
      }
      
      // Trigger player discovery if needed
      if (this.championTracker) {
        this.updateProgress(
          "discovering_players",
          "Discovering player mappings..."
        );
        await this.championTracker.discoverPlayerMappings();
      }

      // Get player mappings from champion tracker
      const mappings = this.championTracker?.proPlayerMappings || new Map();
      
      // Enhance players with summoner info from mappings
      const playersWithSummoners = liveData.players
        .map(player => {
          const mapping = mappings.get(player.name);
          if (mapping) {
            return {
              ...player,
              summonerName: mapping.summonerName,
              region: mapping.region,
              tagLine: mapping.tagLine
            };
          }
          return null;
        })
        .filter(p => p !== null);
      
      this.updateProgress(
        "players_found",
        `Found ${playersWithSummoners.length} players with summoner info`
      );

      // Collect data progressively
      const allMatches = [];
      const allPlayerStats = [];
      let successCount = 0;
      let errorCount = 0;

      this.updateProgress(
        "collecting_matches",
        "Starting match data collection...",
        {
          total: playersWithSummoners.length,
          completed: 0,
        }
      );

      // Collect match data for all players
      for (let i = 0; i < playersWithSummoners.length; i++) {
        const player = playersWithSummoners[i];

        try {
          this.updateProgress(
            "collecting_matches",
            `Collecting matches for ${player.name} (${i + 1}/${
              playersWithSummoners.length
            })`,
            {
              total: playersWithSummoners.length,
              completed: i,
              currentPlayer: player.name,
            }
          );

          const matches = await this.collectPlayerMatches(player);
          allMatches.push(...matches);
          successCount++;

          // Rate limiting handled by RiotGamesAPI class
          // await new Promise(resolve => setTimeout(resolve, 2000));
        } catch (error) {
          console.warn(
            `❌ Failed to collect matches for ${player.name}:`,
            error.message
          );

          let errorType = "matches";
          let errorMessage = error.message;

          // Special handling for different error types
          if (error.code === "PLAYER_NOT_FOUND" || error.status === 404) {
            // Skip adding to errors - player simply doesn't exist with this ID
            console.log(
              `⚠️ Player ${player.name} not found with Riot ID - skipping`
            );
            continue; // Skip to next player without adding error
          } else if (error.isApiKeyIssue || error.status === 403) {
            errorType = "api_auth";
            errorMessage = "API authentication failed - check API key";
          } else if (error.message.includes("timeout")) {
            errorType = "timeout";
            errorMessage = "Request timeout";
          }

          this.collectionErrors.push({
            player: player.name,
            type: errorType,
            error: errorMessage,
          });
          errorCount++;
        }
      }

      this.updateProgress(
        "collecting_stats",
        "Starting player stats collection...",
        {
          total: playersWithSummoners.length,
          completed: 0,
        }
      );

      // Collect player stats for all players
      for (let i = 0; i < playersWithSummoners.length; i++) {
        const player = playersWithSummoners[i];

        try {
          this.updateProgress(
            "collecting_stats",
            `Collecting stats for ${player.name} (${i + 1}/${
              playersWithSummoners.length
            })`,
            {
              total: playersWithSummoners.length,
              completed: i,
              currentPlayer: player.name,
            }
          );

          const stats = await this.collectPlayerStats(player);
          if (stats) {
            allPlayerStats.push(stats);
          }

          // Rate limiting handled by RiotGamesAPI class
          // await new Promise(resolve => setTimeout(resolve, 1500));
        } catch (error) {
          console.warn(
            `❌ Failed to collect stats for ${player.name}:`,
            error.message
          );

          let errorType = "stats";
          let errorMessage = error.message;

          // Special handling for different error types
          if (error.code === "PLAYER_NOT_FOUND" || error.status === 404) {
            // Skip adding to errors - player simply doesn't exist with this ID
            console.log(
              `⚠️ Player ${player.name} not found with Riot ID - skipping stats collection`
            );
            continue; // Skip to next player without adding error
          } else if (error.isApiKeyIssue || error.status === 403) {
            errorType = "api_auth";
            errorMessage = "API authentication failed - check API key";
          } else if (error.message.includes("timeout")) {
            errorType = "timeout";
            errorMessage = "Request timeout";
          }

          this.collectionErrors.push({
            player: player.name,
            type: errorType,
            error: errorMessage,
          });
        }
      }

      // Collect ownership and meta data (quick)
      this.updateProgress(
        "collecting_supplementary",
        "Collecting ownership and meta data..."
      );
      const ownershipData = await this.dataCollector.collectOwnershipData();
      const metaData = await this.dataCollector.collectMetaData();

      // Compile final results
      const finalResults = {
        timestamp: new Date().toISOString(),
        collection_summary: {
          total_players: playersWithSummoners.length,
          successful_players: successCount,
          failed_players: errorCount,
          total_matches: allMatches.length,
          total_player_stats: allPlayerStats.length,
        },
        matches: {
          matches: allMatches,
          total: allMatches.length,
          source: "riot_api_background",
        },
        players: {
          players: allPlayerStats,
          total: allPlayerStats.length,
          source: "riot_api_background",
        },
        ownership: ownershipData,
        meta: metaData,
        errors: this.collectionErrors,
      };

      // Save to cache
      const cacheFile = path.join(this.cacheDir, "latest-data.json");
      fs.writeFileSync(cacheFile, JSON.stringify(finalResults, null, 2));

      this.lastCollection = new Date();

      this.updateProgress(
        "Completed",
        `Collection completed! ${allMatches.length} matches, ${allPlayerStats.length} player stats`,
        {
          matches: allMatches.length,
          playerStats: allPlayerStats.length,
          errors: this.collectionErrors.length,
        }
      );

      return {
        success: true,
        data: finalResults,
        fromCache: false,
      };
    } catch (error) {
      console.error("❌ Background collection failed:", error);
      this.updateProgress("error", `Collection failed: ${error.message}`);

      return {
        success: false,
        error: error.message,
        fromCache: false,
      };
    } finally {
      this.isCollecting = false;
    }
  }

  // Helper function to clean summoner names
  cleanSummonerName(summonerName) {
    if (!summonerName) return summonerName;

    // Specific mappings for players with non-standard names
    const specificMappings = {
      "DRX PerfecT": "PERFECT",
      PerfecT: "PERFECT",
      "NS Calix": "CaliX", // Different region/tag needed
      Calix: "CaliX",
      "DRX Zeka": "DRX Zeka", // Keep the DRX prefix for this player
    };

    // Players that need special region/tag handling
    const specialRegionPlayers = {
      "NS Calix": { name: "CaliX", region: "NA", tagLine: "NA1" },
      Calix: { name: "CaliX", region: "NA", tagLine: "NA1" },
    };

    // Check specific mappings first
    if (specificMappings[summonerName]) {
      return specificMappings[summonerName];
    }

    // Remove common team prefixes
    const teamPrefixes = [
      "Gen G ",
      "GEN ",
      "T1 ",
      "KT ",
      "DRX ",
      "NS ",
      "Nongshim ",
      "FNC ",
      "G2 ",
      "C9 ",
      "TH ",
      "MSF ",
      "VIT ",
      "BDS ",
      "Gen.G ",
      "GenG ",
      "SK T1 ",
      "SK ",
      "TSM ",
      "TL ",
      "EG ",
    ];

    let cleaned = summonerName;
    for (const prefix of teamPrefixes) {
      if (cleaned.startsWith(prefix)) {
        cleaned = cleaned.substring(prefix.length);
        break;
      }
    }

    return cleaned.trim();
  }

  // Collect matches for a single player
  async collectPlayerMatches(player) {
    const matches = [];

    try {
      // Clean the summoner name to remove team prefixes
      const cleanedSummonerName = this.cleanSummonerName(player.summonerName);
      console.log(
        `🔧 Player ${player.name}: "${player.summonerName}" → "${cleanedSummonerName}"`
      );

      // Get summoner
      const summoner = await Promise.race([
        this.dataCollector.riotAPI.getSummonerByName(
          cleanedSummonerName,
          player.region,
          player.tagLine
        ),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Summoner lookup timeout")), 30000)
        ),
      ]);

      // Get match history (reduce to 3 matches to save API calls)
      const matchIds = await Promise.race([
        this.dataCollector.riotAPI.getMatchHistory(
          summoner.puuid,
          player.region,
          3
        ),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Match history timeout")), 30000)
        ),
      ]);

      // Process up to 2 matches per player to minimize API calls
      for (const matchId of matchIds.slice(0, 2)) {
        try {
          const matchData = await Promise.race([
            this.dataCollector.riotAPI.processMatchForStats(
              matchId,
              player.region
            ),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("Match processing timeout")),
                40000
              )
            ),
          ]);

          if (matchData) {
            matches.push({
              matchId: matchData.matchId,
              date: new Date(matchData.gameCreation)
                .toISOString()
                .split("T")[0],
              duration: Math.round((matchData.gameDuration / 60) * 10) / 10,
              patch:
                matchData.championStats[0]?.stats?.gameVersion
                  ?.split(".")
                  .slice(0, 2)
                  .join(".") || "Unknown",
              player: player.name,
              team: player.team,
              position: player.position,
              playerStats:
                matchData.playerStats.find((p) => p.puuid === summoner.puuid)
                  ?.stats || {},
              allPlayers: matchData.playerStats.map((p) => ({
                kills: p.stats.kills,
                deaths: p.stats.deaths,
                assists: p.stats.assists,
                cs: p.stats.cs,
                fantasyPoints: p.stats.fantasyPoints,
              })),
            });
          }
        } catch (matchError) {
          console.warn(
            `⚠️ Failed to process match ${matchId.slice(-8)} for ${
              player.name
            }:`,
            matchError.message
          );
        }
      }
    } catch (error) {
      throw new Error(
        `Failed to collect matches for ${player.name}: ${error.message}`
      );
    }

    return matches;
  }

  // Collect stats for a single player
  async collectPlayerStats(player) {
    try {
      // Clean the summoner name to remove team prefixes
      const cleanedSummonerName = this.cleanSummonerName(player.summonerName);
      console.log(
        `📊 Stats for ${player.name}: "${player.summonerName}" → "${cleanedSummonerName}"`
      );

      // Get summoner
      const summoner = await Promise.race([
        this.dataCollector.riotAPI.getSummonerByName(
          cleanedSummonerName,
          player.region,
          player.tagLine
        ),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Summoner timeout")), 25000)
        ),
      ]);

      // Get recent matches (reduced to minimize API calls)
      const matchIds = await Promise.race([
        this.dataCollector.riotAPI.getMatchHistory(
          summoner.puuid,
          player.region,
          3
        ),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error("Match history timeout")), 25000)
        ),
      ]);

      let totalKills = 0,
        totalDeaths = 0,
        totalAssists = 0,
        totalCS = 0;
      let wins = 0;
      const recentForm = [];

      // Analyze up to 3 matches for stats (reduced from 5)
      for (const matchId of matchIds.slice(0, 3)) {
        try {
          const matchData = await Promise.race([
            this.dataCollector.riotAPI.processMatchForStats(
              matchId,
              player.region
            ),
            new Promise((_, reject) =>
              setTimeout(
                () => reject(new Error("Match processing timeout")),
                40000
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
            `⚠️ Failed to process match for ${player.name}:`,
            matchError.message
          );
        }
      }

      const gamesPlayed = recentForm.length;
      if (gamesPlayed > 0) {
        return {
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
        };
      }
    } catch (error) {
      throw new Error(
        `Failed to collect stats for ${player.name}: ${error.message}`
      );
    }

    return null;
  }

  // Start automatic collection (every 30 minutes)
  startAutoCollection() {
    console.log("🔄 Starting automatic data collection service");

    // Check for data before running initial collection
    const checkAndCollect = async () => {
      try {
        // Check if we have player data from main server
        const liveData = await this.dataCollector.fetchLiveData();
        if (liveData.success && liveData.players && liveData.players.length > 0) {
          console.log(`📊 Found ${liveData.players.length} players - starting initial collection`);
          await this.collectAllData();
          return true;
        } else {
          console.log("⏳ No player data available yet for background collection - waiting...");
          return false;
        }
      } catch (error) {
        console.log("⏳ Main server not ready - waiting...");
        return false;
      }
    };

    // Try initial collection with retries
    let retryCount = 0;
    const maxRetries = 10; // Try for up to 5 minutes (10 * 30s)
    
    const tryInitialCollection = async () => {
      const success = await checkAndCollect();
      if (!success && retryCount < maxRetries) {
        retryCount++;
        console.log(`⏳ Background data collection retry ${retryCount}/${maxRetries} in 30 seconds...`);
        setTimeout(tryInitialCollection, 30000); // Retry every 30 seconds
      } else if (!success) {
        console.log("⚠️ No player data after 5 minutes - skipping initial collection");
        console.log("💡 Upload player data and use manual trigger or wait for scheduled collection");
      }
    };

    // Start trying after 10 seconds (give servers time to initialize)
    setTimeout(tryInitialCollection, 10000);

    // Set interval for every 30 minutes
    setInterval(async () => {
      if (this.needsCollection()) {
        // Also check for data before scheduled collection
        const liveData = await this.dataCollector.fetchLiveData();
        if (liveData.success && liveData.players && liveData.players.length > 0) {
          console.log("⏰ Starting scheduled data collection...");
          await this.collectAllData();
        } else {
          console.log("⏰ Scheduled collection skipped - no player data");
        }
      }
    }, 30 * 60 * 1000); // 30 minutes
  }

  // Get status of background collector
  getStatus() {
    return {
      isCollecting: this.isCollecting,
      lastCollection: this.lastCollection,
      needsCollection: this.needsCollection(),
      errors: this.collectionErrors,
      progress: this.getProgress(),
      cacheAvailable: fs.existsSync(
        path.join(this.cacheDir, "latest-data.json")
      ),
    };
  }
}

module.exports = BackgroundDataCollector;
