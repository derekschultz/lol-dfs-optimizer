/**
 * Champion Performance Tracking System
 * Tracks and analyzes champion performance using Riot Games API
 */

const RiotGamesAPI = require('./RiotGamesAPI');
const fs = require('fs').promises;
const path = require('path');

class ChampionPerformanceTracker {
    constructor(riotApiKey) {
        this.riotAPI = new RiotGamesAPI(riotApiKey);
        this.championStats = new Map();
        this.playerChampionStats = new Map();
        this.playerPerformanceCache = new Map();
        this.recentFormData = new Map(); // Player -> recent game trends
        this.matchHistory = [];
        this.lastUpdate = null;
        
        // Pro player mappings will be loaded from configuration
        this.proPlayerMappings = new Map();
        
        // Initialize with empty data
        this.initialize();
    }
    
    async initialize() {
        console.log('🏆 Initializing Champion Performance Tracker...');
        // Load player mappings
        await this.loadProPlayerMappings();
        // Load data in background to not block startup
        setTimeout(() => this.updateStats(), 5000);
    }
    
    /**
     * Load pro player mappings from configuration
     */
    async loadProPlayerMappings(mappingsFile = null) {
        try {
            if (mappingsFile && await this.fileExists(mappingsFile)) {
                // Load from provided file
                const mappings = JSON.parse(await fs.readFile(mappingsFile, 'utf8'));
                this.proPlayerMappings = new Map(Object.entries(mappings));
            } else {
                // Default mappings for common pro players
                // Format: DFS Name -> { puuid, summonerName, region, team }
                this.proPlayerMappings = new Map([
                    // LCK Teams
                    ['Faker', { summonerName: 'Hide on bush', region: 'KR', team: 'T1' }],
                    ['Zeus', { summonerName: 'T1 Zeus', region: 'KR', team: 'T1' }],
                    ['Oner', { summonerName: 'T1 Oner', region: 'KR', team: 'T1' }],
                    ['Gumayusi', { summonerName: 'T1 Gumayusi', region: 'KR', team: 'T1' }],
                    ['Keria', { summonerName: 'T1 Keria', region: 'KR', team: 'T1' }],
                    ['Chovy', { summonerName: 'Gen G Chovy', region: 'KR', team: 'GEN' }],
                    ['Peanut', { summonerName: 'Gen G Peanut', region: 'KR', team: 'GEN' }],
                    ['Doran', { summonerName: 'Gen G Doran', region: 'KR', team: 'GEN' }],
                    ['Peyz', { summonerName: 'Gen G Peyz', region: 'KR', team: 'GEN' }],
                    ['Lehends', { summonerName: 'Gen G Lehends', region: 'KR', team: 'GEN' }],
                    
                    // LEC Teams - Using professional in-game names
                    ['Caps', { summonerName: 'G2 Caps', region: 'EUW', team: 'G2', altNames: ['Caps', 'FNC Caps'] }],
                    ['BrokenBlade', { summonerName: 'G2 BrokenBlade', region: 'EUW', team: 'G2', altNames: ['BrokenBlade', 'TSM BrokenBlade'] }],
                    ['Yike', { summonerName: 'G2 Yike', region: 'EUW', team: 'G2', altNames: ['Yike'] }],
                    ['Hans sama', { summonerName: 'G2 Hans sama', region: 'EUW', team: 'G2', altNames: ['Hans sama', 'TL Hans sama'] }],
                    ['Mikyx', { summonerName: 'G2 Mikyx', region: 'EUW', team: 'G2', altNames: ['Mikyx', 'MSF Mikyx'] }],
                    
                    // Fnatic
                    ['Razork', { summonerName: 'FNC Razork', region: 'EUW', team: 'FNC', altNames: ['Razork'] }],
                    ['Humanoid', { summonerName: 'FNC Humanoid', region: 'EUW', team: 'FNC', altNames: ['Humanoid', 'MAD Humanoid'] }],
                    ['Noah', { summonerName: 'FNC Noah', region: 'EUW', team: 'FNC', altNames: ['Noah'] }],
                    ['Jun', { summonerName: 'FNC Jun', region: 'EUW', team: 'FNC', altNames: ['Jun'] }],
                    
                    // Team Heretics
                    ['Jankos', { summonerName: 'TH Jankos', region: 'EUW', team: 'TH', altNames: ['Jankos', 'G2 Jankos'] }],
                    
                    // LCS Teams
                    ['Blaber', { summonerName: 'C9 Blaber', region: 'NA', team: 'C9' }],
                    ['Jensen', { summonerName: 'C9 Jensen', region: 'NA', team: 'C9' }],
                    ['Berserker', { summonerName: 'C9 Berserker', region: 'NA', team: 'C9' }],
                    
                    // LPL Teams (harder to track due to server restrictions)
                    // Add more mappings as needed
                ]);
            }
            
            // Fetch PUUIDs for players
            let fetchedCount = 0;
            for (const [dfsName, mapping] of this.proPlayerMappings) {
                if (!mapping.puuid && mapping.summonerName) {
                    try {
                        let summoner;
                        let attemptedNames = [mapping.summonerName];
                        
                        // Add alternative names if available
                        if (mapping.altNames) {
                            attemptedNames = attemptedNames.concat(mapping.altNames);
                        }
                        
                        // Try each summoner name
                        for (const nameToTry of attemptedNames) {
                            try {
                                // Try with tagline first (new Riot ID system)
                                if (mapping.region === 'EUW' || mapping.region === 'NA') {
                                    const taglines = ['EUW', 'EUNE', 'NA1', 'LEC', 'LCS', mapping.region, 'G2', 'FNC', 'TH'];
                                    for (const tag of taglines) {
                                        try {
                                            summoner = await this.riotAPI.getSummonerByName(nameToTry, mapping.region, tag);
                                            console.log(`✅ Found ${dfsName} (${nameToTry}) with tag: ${tag}`);
                                            break;
                                        } catch (tagError) {
                                            // Try next tag
                                        }
                                    }
                                }
                                
                                // If Riot ID approach failed, try old summoner name method
                                if (!summoner) {
                                    summoner = await this.riotAPI.getSummonerByName(nameToTry, mapping.region);
                                    console.log(`✅ Found ${dfsName} (${nameToTry}) with legacy API`);
                                }
                                
                                if (summoner) break; // Success, exit name loop
                                
                            } catch (nameError) {
                                // Try next name
                                console.log(`⚠️ Failed ${nameToTry} for ${dfsName}: ${nameError.response?.status || nameError.message}`);
                            }
                        }
                        
                        if (summoner) {
                            mapping.puuid = summoner.puuid;
                            mapping.accountId = summoner.accountId;
                            mapping.id = summoner.id;
                            mapping.resolvedName = summoner.name; // Store what actually worked
                            fetchedCount++;
                            console.log(`✅ Successfully mapped ${dfsName} -> ${summoner.name}`);
                        }
                        
                        // Rate limit respect
                        await new Promise(resolve => setTimeout(resolve, 1500));
                    } catch (error) {
                        console.warn(`❌ Failed to get PUUID for ${dfsName} (${mapping.summonerName}):`, error.response?.status || error.message);
                        
                        // For 403 errors, suggest the player might need a different approach
                        if (error.response?.status === 403) {
                            console.warn(`   💡 ${dfsName} might need manual PUUID lookup or different summoner name`);
                        }
                    }
                }
            }
            
            console.log(`✅ Loaded ${this.proPlayerMappings.size} player mappings, fetched ${fetchedCount} PUUIDs`);
            
            // Save mappings with PUUIDs for future use
            await this.savePlayerMappings();
        } catch (error) {
            console.error('Error loading player mappings:', error);
        }
    }
    
    /**
     * Save player mappings to file
     */
    async savePlayerMappings() {
        try {
            const mappingsPath = path.join(__dirname, '../../data/player-mappings.json');
            const mappingsObj = {};
            
            for (const [name, data] of this.proPlayerMappings) {
                mappingsObj[name] = data;
            }
            
            await fs.mkdir(path.dirname(mappingsPath), { recursive: true });
            await fs.writeFile(mappingsPath, JSON.stringify(mappingsObj, null, 2));
        } catch (error) {
            console.warn('Failed to save player mappings:', error.message);
        }
    }
    
    /**
     * Check if file exists
     */
    async fileExists(filePath) {
        try {
            await fs.access(filePath);
            return true;
        } catch {
            return false;
        }
    }
    
    /**
     * Update champion statistics from player match histories
     */
    async updateStats(playerNames = null, matchCount = 20) {
        try {
            console.log(`📊 Updating champion stats from player match histories...`);
            
            // Clear current stats for fresh calculation
            this.championStats.clear();
            this.playerChampionStats.clear();
            this.matchHistory = [];
            
            // Get list of players to process
            const playersToProcess = playerNames || Array.from(this.proPlayerMappings.keys());
            
            // Process each player
            for (const playerName of playersToProcess) {
                const mapping = this.proPlayerMappings.get(playerName);
                if (!mapping || !mapping.puuid) {
                    console.warn(`No mapping found for ${playerName}`);
                    continue;
                }
                
                try {
                    // Get match history
                    const matchIds = await this.riotAPI.getMatchHistory(mapping.puuid, mapping.region, matchCount);
                    
                    // Process each match
                    let processedCount = 0;
                    for (const matchId of matchIds.slice(0, matchCount)) {
                        const matchData = await this.riotAPI.processMatchForStats(matchId, mapping.region);
                        if (matchData) {
                            this.processMatchData(matchData, playerName, mapping.team);
                            processedCount++;
                        }
                        
                        // Rate limit respect
                        await new Promise(resolve => setTimeout(resolve, 100));
                    }
                    
                    // Cache player performance data
                    this.playerPerformanceCache.set(playerName, {
                        lastUpdate: Date.now(),
                        matchCount: processedCount
                    });
                    
                    console.log(`✅ Processed ${processedCount} matches for ${playerName}`);
                } catch (error) {
                    console.warn(`Failed to process matches for ${playerName}:`, error.message);
                }
            }
            
            // Calculate averages and recent form
            this.calculateAverages();
            this.calculateRecentForm();
            
            this.lastUpdate = new Date();
            console.log(`✅ Updated stats from ${this.matchHistory.length} games across ${playersToProcess.length} players`);
            
            return this.getStats();
        } catch (error) {
            console.error('Error updating champion stats:', error);
            throw error;
        }
    }
    
    /**
     * Process match data from Riot API
     */
    processMatchData(matchData, playerName, team) {
        const { matchId, championStats, playerStats } = matchData;
        
        // Find the specific player's stats
        const playerData = playerStats.find(p => {
            const mapping = this.proPlayerMappings.get(playerName);
            return p.puuid === mapping.puuid;
        });
        
        if (!playerData) return;
        
        const stats = playerData.stats;
        const championName = stats.championName;
        
        // Update champion stats
        if (!this.championStats.has(championName)) {
            this.championStats.set(championName, {
                picks: 0,
                wins: 0,
                totalKills: 0,
                totalDeaths: 0,
                totalAssists: 0,
                totalCS: 0,
                totalGold: 0,
                totalDamage: 0,
                totalFantasyPoints: 0,
                games: []
            });
        }
        
        const champStats = this.championStats.get(championName);
        champStats.picks++;
        if (stats.win) champStats.wins++;
        champStats.totalKills += stats.kills;
        champStats.totalDeaths += stats.deaths;
        champStats.totalAssists += stats.assists;
        champStats.totalCS += stats.cs;
        champStats.totalGold += stats.gold;
        champStats.totalDamage += stats.damage;
        champStats.totalFantasyPoints += stats.fantasyPoints;
        champStats.games.push({
            matchId,
            playerName,
            team,
            stats: stats
        });
        
        // Update player-champion stats
        const playerChampKey = `${playerName}_${championName}`;
        if (!this.playerChampionStats.has(playerChampKey)) {
            this.playerChampionStats.set(playerChampKey, {
                player: playerName,
                team: team,
                champion: championName,
                games: 0,
                wins: 0,
                totalFantasyPoints: 0,
                kills: 0,
                deaths: 0,
                assists: 0,
                cs: 0,
                recentGames: []
            });
        }
        
        const playerChampStats = this.playerChampionStats.get(playerChampKey);
        playerChampStats.games++;
        if (stats.win) playerChampStats.wins++;
        playerChampStats.totalFantasyPoints += stats.fantasyPoints;
        playerChampStats.kills += stats.kills;
        playerChampStats.deaths += stats.deaths;
        playerChampStats.assists += stats.assists;
        playerChampStats.cs += stats.cs;
        
        // Keep last 10 games for recent form analysis
        playerChampStats.recentGames.push({
            matchId,
            fantasyPoints: stats.fantasyPoints,
            win: stats.win,
            kda: (stats.kills + stats.assists) / Math.max(1, stats.deaths),
            timestamp: matchData.gameCreation
        });
        if (playerChampStats.recentGames.length > 10) {
            playerChampStats.recentGames.shift();
        }
        
        // Add to match history
        this.matchHistory.push({
            matchId,
            playerName,
            team,
            champion: championName,
            stats,
            timestamp: matchData.gameCreation
        });
    }
    
    /**
     * Calculate averages for all stats
     */
    calculateAverages() {
        // Champion averages
        for (const [championName, stats] of this.championStats) {
            if (stats.picks > 0) {
                stats.winRate = stats.wins / stats.picks;
                stats.avgFantasyPoints = stats.totalFantasyPoints / stats.picks;
                stats.avgKills = stats.totalKills / stats.picks;
                stats.avgDeaths = stats.totalDeaths / stats.picks;
                stats.avgAssists = stats.totalAssists / stats.picks;
                stats.avgCS = stats.totalCS / stats.picks;
                stats.avgGold = stats.totalGold / stats.picks;
                stats.avgDamage = stats.totalDamage / stats.picks;
                stats.avgKDA = (stats.avgKills + stats.avgAssists) / Math.max(1, stats.avgDeaths);
            }
        }
        
        // Player-champion averages
        for (const [key, stats] of this.playerChampionStats) {
            if (stats.games > 0) {
                stats.avgFantasyPoints = stats.totalFantasyPoints / stats.games;
                stats.winRate = stats.wins / stats.games;
                stats.avgKills = stats.kills / stats.games;
                stats.avgDeaths = stats.deaths / stats.games;
                stats.avgAssists = stats.assists / stats.games;
                stats.avgCS = stats.cs / stats.games;
                stats.avgKDA = (stats.avgKills + stats.avgAssists) / Math.max(1, stats.avgDeaths);
            }
        }
    }
    
    /**
     * Calculate recent form trends with enhanced hot/cold streak detection
     */
    calculateRecentForm() {
        const playerForms = new Map();
        
        // Group matches by player
        for (const match of this.matchHistory) {
            if (!playerForms.has(match.playerName)) {
                playerForms.set(match.playerName, []);
            }
            playerForms.get(match.playerName).push(match);
        }
        
        // Calculate form for each player
        for (const [playerName, matches] of playerForms) {
            // Sort by timestamp descending (most recent first)
            matches.sort((a, b) => b.timestamp - a.timestamp);
            
            // Calculate trends with different time windows
            const last5Games = matches.slice(0, 5);
            const last10Games = matches.slice(0, 10);
            const olderGames = matches.slice(10, 20);
            
            if (last5Games.length >= 3) {
                // Recent performance metrics
                const recent5Avg = last5Games.reduce((sum, m) => sum + m.stats.fantasyPoints, 0) / last5Games.length;
                const recent10Avg = last10Games.reduce((sum, m) => sum + m.stats.fantasyPoints, 0) / last10Games.length;
                const olderAvg = olderGames.length > 0 
                    ? olderGames.reduce((sum, m) => sum + m.stats.fantasyPoints, 0) / olderGames.length
                    : recent10Avg;
                
                const recentWinRate = last5Games.filter(m => m.stats.win).length / last5Games.length;
                const recent10WinRate = last10Games.filter(m => m.stats.win).length / last10Games.length;
                
                // Streak detection
                const streak = this.calculateStreak(last10Games);
                
                // Variance analysis
                const variance = this.calculateVariance(last10Games.map(m => m.stats.fantasyPoints));
                const consistency = variance < 5 ? 'high' : variance < 15 ? 'medium' : 'low';
                
                // Momentum calculation (recent 5 vs previous 5)
                const momentum = recent5Avg - (last10Games.slice(5, 10).reduce((sum, m) => sum + m.stats.fantasyPoints, 0) / Math.max(1, last10Games.slice(5, 10).length));
                
                // Form rating with multiple factors
                const trendStrength = Math.abs(recent5Avg - olderAvg) / olderAvg;
                const formRating = (recent5Avg / Math.max(olderAvg, 15)) * recentWinRate * (1 + trendStrength * 0.5);
                
                // Determine overall trend
                let trend = 'stable';
                if (recent5Avg > olderAvg * 1.1) trend = 'hot';
                else if (recent5Avg < olderAvg * 0.9) trend = 'cold';
                else if (momentum > 2) trend = 'improving';
                else if (momentum < -2) trend = 'declining';
                
                this.recentFormData.set(playerName, {
                    // Basic stats
                    recentAvgFantasy: recent5Avg,
                    recent10AvgFantasy: recent10Avg,
                    olderAvgFantasy: olderAvg,
                    recentWinRate,
                    recent10WinRate,
                    
                    // Advanced metrics
                    trend,
                    momentum,
                    consistency,
                    variance,
                    streak,
                    formRating,
                    
                    // Meta analysis
                    hotStreak: streak.type === 'win' && streak.count >= 3,
                    coldStreak: streak.type === 'loss' && streak.count >= 3,
                    
                    // Projection adjustment factor (±20% max)
                    projectionMultiplier: Math.max(0.8, Math.min(1.2, formRating)),
                    
                    lastUpdated: Date.now()
                });
            }
        }
    }
    
    /**
     * Calculate win/loss streak
     */
    calculateStreak(games) {
        if (games.length === 0) return { type: 'none', count: 0 };
        
        const mostRecent = games[0].stats.win;
        let count = 1;
        
        for (let i = 1; i < games.length; i++) {
            if (games[i].stats.win === mostRecent) {
                count++;
            } else {
                break;
            }
        }
        
        return {
            type: mostRecent ? 'win' : 'loss',
            count: count
        };
    }
    
    /**
     * Calculate variance in fantasy points
     */
    calculateVariance(values) {
        if (values.length < 2) return 0;
        
        const mean = values.reduce((sum, val) => sum + val, 0) / values.length;
        const squaredDiffs = values.map(val => Math.pow(val - mean, 2));
        return squaredDiffs.reduce((sum, val) => sum + val, 0) / values.length;
    }
    
    /**
     * Get champion performance stats
     */
    getChampionStats(championName) {
        return this.championStats.get(championName) || {
            picks: 0,
            winRate: 0.5,
            avgFantasyPoints: 20,
            games: 0,
            avgKDA: 3.0
        };
    }
    
    /**
     * Get player's performance on specific champion
     */
    getPlayerChampionStats(playerName, championName) {
        const key = `${playerName}_${championName}`;
        return this.playerChampionStats.get(key) || null;
    }
    
    /**
     * Get player's recent form
     */
    getPlayerForm(playerName) {
        return this.recentFormData.get(playerName) || {
            recentAvgFantasy: 20,
            trend: 'stable',
            formRating: 1.0
        };
    }
    
    /**
     * Get all stats summary
     */
    getStats() {
        const champions = Array.from(this.championStats.entries())
            .map(([name, stats]) => ({ championName: name, ...stats }))
            .sort((a, b) => b.avgFantasyPoints - a.avgFantasyPoints);
            
        const playerStats = Array.from(this.playerChampionStats.entries())
            .map(([key, stats]) => ({ key, ...stats }))
            .sort((a, b) => b.avgFantasyPoints - a.avgFantasyPoints);
            
        const forms = Array.from(this.recentFormData.entries())
            .map(([player, form]) => ({ player, ...form }))
            .sort((a, b) => b.formRating - a.formRating);
            
        return {
            champions,
            playerChampionStats: playerStats,
            recentForms: forms,
            totalGames: this.matchHistory.length,
            lastUpdate: this.lastUpdate
        };
    }
    
    /**
     * Get top performing champions
     */
    getTopChampions(limit = 10) {
        return Array.from(this.championStats.entries())
            .filter(([_, stats]) => stats.picks >= 3) // Min 3 games
            .map(([championName, stats]) => ({
                championName,
                ...stats
            }))
            .sort((a, b) => b.avgFantasyPoints - a.avgFantasyPoints)
            .slice(0, limit);
    }
    
    /**
     * Get champion tier (S, A, B, C, D)
     */
    getChampionTier(championName) {
        const stats = this.getChampionStats(championName);
        
        if (stats.picks < 3) return 'C'; // Not enough data
        
        const score = (stats.avgFantasyPoints / 25) * 0.4 + 
                     stats.winRate * 0.3 + 
                     (stats.avgKDA / 4) * 0.3;
        
        if (score >= 0.9) return 'S';
        if (score >= 0.75) return 'A';
        if (score >= 0.6) return 'B';
        if (score >= 0.4) return 'C';
        return 'D';
    }
    
    /**
     * Get matchup analysis between two players or teams
     */
    async getMatchupAnalysis(player1Name, player2Name) {
        const player1Mapping = this.proPlayerMappings.get(player1Name);
        const player2Mapping = this.proPlayerMappings.get(player2Name);
        
        if (!player1Mapping || !player2Mapping) {
            return null;
        }
        
        // Get their recent forms
        const player1Form = this.getPlayerForm(player1Name);
        const player2Form = this.getPlayerForm(player2Name);
        
        // Analyze champion overlap and strengths
        const player1ChampStats = Array.from(this.playerChampionStats.entries())
            .filter(([key]) => key.startsWith(player1Name + '_'))
            .map(([key, stats]) => ({ champion: key.split('_')[1], ...stats }));
            
        const player2ChampStats = Array.from(this.playerChampionStats.entries())
            .filter(([key]) => key.startsWith(player2Name + '_'))
            .map(([key, stats]) => ({ champion: key.split('_')[1], ...stats }));
        
        // Find common champions
        const commonChampions = player1ChampStats.filter(p1Champ => 
            player2ChampStats.some(p2Champ => p2Champ.champion === p1Champ.champion)
        ).map(p1Champ => {
            const p2Champ = player2ChampStats.find(p2 => p2.champion === p1Champ.champion);
            return {
                champion: p1Champ.champion,
                player1Stats: {
                    avgFantasy: p1Champ.avgFantasyPoints,
                    winRate: p1Champ.winRate,
                    games: p1Champ.games
                },
                player2Stats: {
                    avgFantasy: p2Champ.avgFantasyPoints,
                    winRate: p2Champ.winRate,
                    games: p2Champ.games
                },
                advantage: p1Champ.avgFantasyPoints > p2Champ.avgFantasyPoints ? player1Name : player2Name,
                fantasyDifferential: Math.abs(p1Champ.avgFantasyPoints - p2Champ.avgFantasyPoints)
            };
        });
        
        // Calculate positional advantage (if same position)
        const positionalAdvantage = this.calculatePositionalAdvantage(player1Name, player2Name, player1Form, player2Form);
        
        return {
            matchup: {
                player1: {
                    name: player1Name,
                    team: player1Mapping.team,
                    form: player1Form,
                    championPool: player1ChampStats.length,
                    bestChampions: player1ChampStats
                        .sort((a, b) => b.avgFantasyPoints - a.avgFantasyPoints)
                        .slice(0, 3)
                        .map(c => ({ champion: c.champion, avgFantasy: c.avgFantasyPoints?.toFixed(1) }))
                },
                player2: {
                    name: player2Name,
                    team: player2Mapping.team,
                    form: player2Form,
                    championPool: player2ChampStats.length,
                    bestChampions: player2ChampStats
                        .sort((a, b) => b.avgFantasyPoints - a.avgFantasyPoints)
                        .slice(0, 3)
                        .map(c => ({ champion: c.champion, avgFantasy: c.avgFantasyPoints?.toFixed(1) }))
                }
            },
            analysis: {
                formAdvantage: player1Form.formRating > player2Form.formRating ? player1Name : player2Name,
                formDifferential: Math.abs(player1Form.formRating - player2Form.formRating),
                commonChampions: commonChampions,
                positionalAdvantage: positionalAdvantage,
                recommendation: this.generateMatchupRecommendation(player1Name, player2Name, player1Form, player2Form, commonChampions)
            }
        };
    }
    
    /**
     * Calculate positional advantage between players
     */
    calculatePositionalAdvantage(player1Name, player2Name, player1Form, player2Form) {
        // Simple analysis based on consistency and recent performance
        const p1Consistency = player1Form.consistency === 'high' ? 2 : player1Form.consistency === 'medium' ? 1 : 0;
        const p2Consistency = player2Form.consistency === 'high' ? 2 : player2Form.consistency === 'medium' ? 1 : 0;
        
        const p1Score = (player1Form.recentAvgFantasy || 0) + p1Consistency + (player1Form.hotStreak ? 3 : 0);
        const p2Score = (player2Form.recentAvgFantasy || 0) + p2Consistency + (player2Form.hotStreak ? 3 : 0);
        
        return {
            leader: p1Score > p2Score ? player1Name : player2Name,
            score_differential: Math.abs(p1Score - p2Score),
            factors: {
                consistency: p1Consistency > p2Consistency ? player1Name : p2Consistency > p1Consistency ? player2Name : 'tied',
                recent_form: (player1Form.recentAvgFantasy || 0) > (player2Form.recentAvgFantasy || 0) ? player1Name : player2Name,
                momentum: Math.abs(player1Form.momentum || 0) > Math.abs(player2Form.momentum || 0) ? player1Name : player2Name
            }
        };
    }
    
    /**
     * Generate matchup recommendation
     */
    generateMatchupRecommendation(player1Name, player2Name, player1Form, player2Form, commonChampions) {
        const formDiff = Math.abs(player1Form.formRating - player2Form.formRating);
        const strongFormAdvantage = formDiff > 0.3;
        
        if (strongFormAdvantage) {
            const leader = player1Form.formRating > player2Form.formRating ? player1Name : player2Name;
            return `Strong advantage to ${leader} based on recent form and performance trends`;
        }
        
        if (commonChampions.length > 0) {
            const championAdvantages = commonChampions.filter(c => c.fantasyDifferential > 3);
            if (championAdvantages.length > 0) {
                return `Champion-specific advantages detected - analyze champion picks for optimal exposure`;
            }
        }
        
        if (player1Form.hotStreak && !player2Form.hotStreak) {
            return `${player1Name} on hot streak - consider increased exposure`;
        }
        
        if (player2Form.hotStreak && !player1Form.hotStreak) {
            return `${player2Name} on hot streak - consider increased exposure`;
        }
        
        return `Evenly matched - base decisions on salary and ownership considerations`;
    }
    
    /**
     * Get team vs team analysis
     */
    async getTeamMatchupAnalysis(team1, team2) {
        const team1Players = Array.from(this.proPlayerMappings.entries())
            .filter(([name, mapping]) => mapping.team === team1)
            .map(([name]) => name);
            
        const team2Players = Array.from(this.proPlayerMappings.entries())
            .filter(([name, mapping]) => mapping.team === team2)
            .map(([name]) => name);
        
        if (team1Players.length === 0 || team2Players.length === 0) {
            return null;
        }
        
        // Calculate team form averages
        const team1Forms = team1Players.map(p => this.getPlayerForm(p)).filter(f => f.trend !== 'stable');
        const team2Forms = team2Players.map(p => this.getPlayerForm(p)).filter(f => f.trend !== 'stable');
        
        const team1AvgForm = team1Forms.reduce((sum, f) => sum + (f.formRating || 1), 0) / Math.max(1, team1Forms.length);
        const team2AvgForm = team2Forms.reduce((sum, f) => sum + (f.formRating || 1), 0) / Math.max(1, team2Forms.length);
        
        return {
            teams: {
                team1: {
                    name: team1,
                    players: team1Players,
                    avgFormRating: team1AvgForm,
                    playersInForm: team1Forms.length,
                    hotStreaks: team1Forms.filter(f => f.hotStreak).length
                },
                team2: {
                    name: team2,
                    players: team2Players,
                    avgFormRating: team2AvgForm,
                    playersInForm: team2Forms.length,
                    hotStreaks: team2Forms.filter(f => f.hotStreak).length
                }
            },
            analysis: {
                formAdvantage: team1AvgForm > team2AvgForm ? team1 : team2,
                formDifferential: Math.abs(team1AvgForm - team2AvgForm),
                stackRecommendation: this.generateTeamStackRecommendation(team1, team2, team1AvgForm, team2AvgForm, team1Forms, team2Forms)
            }
        };
    }
    
    /**
     * Generate team stack recommendation
     */
    generateTeamStackRecommendation(team1, team2, team1Avg, team2Avg, team1Forms, team2Forms) {
        const formDiff = Math.abs(team1Avg - team2Avg);
        
        if (formDiff > 0.2) {
            const strongerTeam = team1Avg > team2Avg ? team1 : team2;
            const strongerForms = team1Avg > team2Avg ? team1Forms : team2Forms;
            const hotPlayers = strongerForms.filter(f => f.hotStreak).length;
            
            return `${strongerTeam} showing superior team form${hotPlayers > 0 ? ` with ${hotPlayers} players on hot streaks` : ''} - consider heavy stack exposure`;
        }
        
        const team1Hot = team1Forms.filter(f => f.hotStreak).length;
        const team2Hot = team2Forms.filter(f => f.hotStreak).length;
        
        if (team1Hot > team2Hot + 1) {
            return `${team1} has more players on hot streaks - moderate stack preference`;
        }
        
        if (team2Hot > team1Hot + 1) {
            return `${team2} has more players on hot streaks - moderate stack preference`;
        }
        
        return `Teams evenly matched - diversify stacks or base on game total/pace expectations`;
    }
}

module.exports = ChampionPerformanceTracker;