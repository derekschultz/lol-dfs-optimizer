/**
 * Riot Games League of Legends API Integration
 * Official API with complete match and player statistics
 */

const axios = require('axios');

class RiotGamesAPI {
    constructor(apiKey) {
        this.apiKey = apiKey;
        this.regions = {
            'NA': 'na1.api.riotgames.com',
            'EUW': 'euw1.api.riotgames.com',
            'KR': 'kr.api.riotgames.com',
            'EUN': 'eun1.api.riotgames.com',
            'BR': 'br1.api.riotgames.com',
            'CN': 'oc1.api.riotgames.com', // China uses Oceania API endpoint
            'OCE': 'oc1.api.riotgames.com',
            'JP': 'jp1.api.riotgames.com',
            'TR': 'tr1.api.riotgames.com',
            'RU': 'ru.api.riotgames.com',
            'LAN': 'la1.api.riotgames.com',
            'LAS': 'la2.api.riotgames.com'
        };
        
        // Regional routing values for match-v5
        this.regionalRoutes = {
            'NA': 'americas',
            'BR': 'americas',
            'LAN': 'americas',
            'LAS': 'americas',
            'EUW': 'europe',
            'EUN': 'europe',
            'TR': 'europe',
            'RU': 'europe',
            'KR': 'asia',
            'JP': 'asia',
            'CN': 'sea', // China uses SEA routing
            'OCE': 'sea',
            'PH': 'sea',
            'SG': 'sea',
            'TH': 'sea',
            'TW': 'sea',
            'VN': 'sea'
        };
        
        this.defaultRegion = 'NA';
        this.cache = new Map();
        this.cacheTTL = 60 * 60 * 1000; // 1 hour
        
        // Rate limiting for Personal API Key (100 requests/2min, 20 requests/1sec)
        this.requestQueue = [];
        this.lastRequestTime = 0;
        this.requestsInLastSecond = 0;
        this.requestsInLastTwoMinutes = [];
        this.minDelayBetweenRequests = 1200; // 1.2 seconds to stay under 20/sec
    }
    
    /**
     * Rate limiting enforcement
     */
    async enforceRateLimit() {
        const now = Date.now();
        
        // Clean old requests from 2-minute window
        this.requestsInLastTwoMinutes = this.requestsInLastTwoMinutes.filter(
            time => now - time < 120000 // 2 minutes
        );
        
        // Check 2-minute limit (100 requests)
        if (this.requestsInLastTwoMinutes.length >= 95) { // Leave buffer
            const oldestRequest = Math.min(...this.requestsInLastTwoMinutes);
            const waitTime = 120000 - (now - oldestRequest) + 1000; // Wait + 1 sec buffer
            console.log(`⏳ Rate limit: waiting ${waitTime}ms for 2-minute window`);
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        // Check minimum delay between requests (1.2 seconds)
        const timeSinceLastRequest = now - this.lastRequestTime;
        if (timeSinceLastRequest < this.minDelayBetweenRequests) {
            const waitTime = this.minDelayBetweenRequests - timeSinceLastRequest;
            await new Promise(resolve => setTimeout(resolve, waitTime));
        }
        
        // Record this request
        this.lastRequestTime = Date.now();
        this.requestsInLastTwoMinutes.push(this.lastRequestTime);
    }

    /**
     * Make API request with rate limit handling
     */
    async makeRequest(url) {
        const cacheKey = url;
        
        // Check cache
        if (this.cache.has(cacheKey)) {
            const cached = this.cache.get(cacheKey);
            if (Date.now() - cached.timestamp < this.cacheTTL) {
                return cached.data;
            }
        }
        
        // Enforce rate limiting
        await this.enforceRateLimit();
        
        try {
            // Debug logging (can be removed in production)
            // console.log(`🔍 API Request: ${url}`);
            
            const response = await axios.get(url, {
                headers: {
                    'X-Riot-Token': this.apiKey
                },
                timeout: 10000
            });
            
            // Cache the response
            this.cache.set(cacheKey, {
                data: response.data,
                timestamp: Date.now()
            });
            
            return response.data;
        } catch (error) {
            if (error.response?.status === 429) {
                // Extract retry-after header if available
                const retryAfter = error.response.headers['retry-after'];
                const waitTime = retryAfter ? parseInt(retryAfter) * 1000 : 10000;
                
                console.warn(`⚠️ Rate limit exceeded (429), waiting ${waitTime}ms...`);
                await new Promise(resolve => setTimeout(resolve, waitTime));
                
                // Reset rate limit tracking to be more conservative
                this.lastRequestTime = Date.now();
                this.requestsInLastTwoMinutes = [];
                
                return this.makeRequest(url); // Retry
            }
            
            // Handle 403 Forbidden errors specifically
            if (error.response?.status === 403) {
                const errorMsg = `Riot API access forbidden (403). This usually means:
                - API key is invalid or expired
                - API key lacks required permissions
                - Request violates API usage policies
                - Summoner name doesn't exist
                Original URL: ${url}`;
                
                const customError = new Error('Request failed with status code 403');
                customError.isApiKeyIssue = true;
                customError.status = 403;
                customError.details = errorMsg;
                throw customError;
            }
            
            // Handle other HTTP errors
            if (error.response?.status) {
                const customError = new Error(`Request failed with status code ${error.response.status}`);
                customError.status = error.response.status;
                customError.response = error.response;
                throw customError;
            }
            
            throw error;
        }
    }
    
    /**
     * Get summoner by name (using Riot ID)
     */
    async getSummonerByName(summonerName, region = this.defaultRegion, tagLine = null) {
        // First get account by Riot ID
        const routing = this.regionalRoutes[region];
        const tag = tagLine || region + '1'; // Default tagline
        const accountUrl = `https://${routing}.api.riotgames.com/riot/account/v1/accounts/by-riot-id/${encodeURIComponent(summonerName)}/${encodeURIComponent(tag)}`;
        
        try {
            const account = await this.makeRequest(accountUrl);
            
            // Then get summoner data by PUUID
            const baseUrl = `https://${this.regions[region]}`;
            const summonerUrl = `${baseUrl}/lol/summoner/v4/summoners/by-puuid/${account.puuid}`;
            const summoner = await this.makeRequest(summonerUrl);
            
            // Merge account and summoner data
            return {
                ...summoner,
                gameName: account.gameName,
                tagLine: account.tagLine
            };
        } catch (error) {
            // Only fallback to old endpoint for specific errors (like 404 not found)
            if (error.response?.status === 404) {
                console.log(`🔍 Riot ID not found for ${summonerName}#${tag}, trying legacy endpoint...`);
                try {
                    const baseUrl = `https://${this.regions[region]}`;
                    const url = `${baseUrl}/lol/summoner/v4/summoners/by-name/${encodeURIComponent(summonerName)}`;
                    return await this.makeRequest(url);
                } catch (legacyError) {
                    // If legacy endpoint also fails with 403/404, treat as player not found
                    if (legacyError.response?.status === 403 || legacyError.response?.status === 404) {
                        const notFoundError = new Error(`Player not found: ${summonerName}#${tag}`);
                        notFoundError.code = 'PLAYER_NOT_FOUND';
                        notFoundError.status = 404;
                        throw notFoundError;
                    }
                    throw legacyError;
                }
            }
            
            // For other errors (403, 429, etc.), throw them instead of falling back
            throw error;
        }
    }
    
    /**
     * Get match IDs for a player
     */
    async getMatchHistory(puuid, region = this.defaultRegion, count = 20) {
        const routing = this.regionalRoutes[region];
        const url = `https://${routing}.api.riotgames.com/lol/match/v5/matches/by-puuid/${puuid}/ids?start=0&count=${count}`;
        return await this.makeRequest(url);
    }
    
    /**
     * Get detailed match data
     */
    async getMatch(matchId, region = this.defaultRegion) {
        const routing = this.regionalRoutes[region];
        const url = `https://${routing}.api.riotgames.com/lol/match/v5/matches/${matchId}`;
        return await this.makeRequest(url);
    }
    
    /**
     * Get match timeline (detailed events)
     */
    async getMatchTimeline(matchId, region = this.defaultRegion) {
        const routing = this.regionalRoutes[region];
        const url = `https://${routing}.api.riotgames.com/lol/match/v5/matches/${matchId}/timeline`;
        return await this.makeRequest(url);
    }
    
    /**
     * Process match for champion stats (similar to our LoL Esports processing)
     */
    async processMatchForStats(matchId, region = this.defaultRegion) {
        try {
            const match = await this.getMatch(matchId, region);
            
            if (!match || !match.info || !match.info.participants) {
                return null;
            }
            
            const championStats = [];
            const playerStats = [];
            
            for (const participant of match.info.participants) {
                const stats = {
                    // Player info
                    summonerName: participant.summonerName,
                    puuid: participant.puuid,
                    championId: participant.championId,
                    championName: participant.championName,
                    
                    // Game outcome
                    win: participant.win,
                    
                    // Core stats for fantasy
                    kills: participant.kills,
                    deaths: participant.deaths,
                    assists: participant.assists,
                    cs: participant.totalMinionsKilled + participant.neutralMinionsKilled,
                    
                    // Additional stats
                    gold: participant.goldEarned,
                    damage: participant.totalDamageDealtToChampions,
                    visionScore: participant.visionScore,
                    wardsPlaced: participant.wardsPlaced,
                    wardsKilled: participant.wardsKilled,
                    
                    // Game info
                    gameDuration: match.info.gameDuration,
                    gameVersion: match.info.gameVersion
                };
                
                // Calculate fantasy points using DraftKings scoring
                stats.fantasyPoints = this.calculateFantasyPoints(stats);
                
                championStats.push({
                    championId: stats.championId,
                    championName: stats.championName,
                    stats: stats
                });
                
                playerStats.push({
                    summonerName: stats.summonerName,
                    puuid: stats.puuid,
                    championId: stats.championId,
                    stats: stats
                });
            }
            
            return {
                matchId: matchId,
                gameCreation: match.info.gameCreation,
                gameDuration: match.info.gameDuration,
                championStats: championStats,
                playerStats: playerStats
            };
        } catch (error) {
            console.error(`Error processing match ${matchId}:`, error.message);
            return null;
        }
    }
    
    /**
     * Calculate fantasy points using DraftKings scoring
     */
    calculateFantasyPoints(stats) {
        const points = (stats.kills * 3) + 
                      (stats.deaths * -1) + 
                      (stats.assists * 2) + 
                      (stats.cs * 0.01) +
                      (stats.win ? 2 : 0);
        
        return Math.max(0, points);
    }
    
    /**
     * Get current game info (if player is in game)
     */
    async getCurrentGame(summonerId, region = this.defaultRegion) {
        const baseUrl = `https://${this.regions[region]}`;
        const url = `${baseUrl}/lol/spectator/v4/active-games/by-summoner/${summonerId}`;
        
        try {
            return await this.makeRequest(url);
        } catch (error) {
            if (error.response?.status === 404) {
                return null; // Not in game
            }
            throw error;
        }
    }
    
    /**
     * Get champion mastery for a player
     */
    async getChampionMastery(summonerId, region = this.defaultRegion) {
        const baseUrl = `https://${this.regions[region]}`;
        const url = `${baseUrl}/lol/champion-mastery/v4/champion-masteries/by-summoner/${summonerId}`;
        return await this.makeRequest(url);
    }
    
    /**
     * Get league entries (rank info) for a player
     */
    async getLeagueEntries(summonerId, region = this.defaultRegion) {
        const baseUrl = `https://${this.regions[region]}`;
        const url = `${baseUrl}/lol/league/v4/entries/by-summoner/${summonerId}`;
        return await this.makeRequest(url);
    }
}

module.exports = RiotGamesAPI;