# AI-Powered Features Documentation

## Overview

The LoL DFS Optimizer now includes comprehensive AI-powered features that enhance lineup optimization using real Riot Games API data and machine learning models.

## 🚀 Core AI Services

### 1. Champion Performance Tracker
- **Real-time data**: Pulls match history from Riot API for 18+ pro players
- **Fantasy scoring**: Uses DraftKings scoring system (K×3 + A×2 - D + CS×0.01 + Win×2)
- **Champion analysis**: Tracks performance across all champions with tier rankings (S, A, B, C, D)

### 2. Player Form Analysis
- **Recent performance**: Analyzes last 5-10 games vs historical performance
- **Hot/Cold streaks**: Detects 3+ win/loss streaks automatically
- **Momentum tracking**: Compares recent 5 games vs previous 5 games
- **Consistency metrics**: Variance analysis for reliability assessment
- **Projection multipliers**: Provides ±20% max adjustments to base projections

### 3. Matchup Analysis
- **Player vs Player**: Head-to-head form comparison with champion pool analysis
- **Team vs Team**: Full team form analysis with stack recommendations
- **Champion-specific**: Performance on common champions between players
- **Positional advantages**: Multi-factor scoring for same-position matchups

### 4. Meta Detection
- **Real-time meta trends**: Uses actual match data for champion priority
- **Rising/declining picks**: Identifies trending champions by fantasy value
- **Team strategy analysis**: Late game scaling vs early aggression trends

## 📊 API Endpoints

### Health & Status
```bash
GET /health                    # Service health check
GET /api/ai/player-mappings    # Player mapping status
GET /api/ai/champion-stats     # Champion performance data
```

### Player Analysis
```bash
GET /api/ai/player-form        # All player forms or specific player (?player=Faker)
GET /api/ai/streaks            # Win/loss streak analysis
```

### Matchup Analysis
```bash
GET /api/ai/matchup?player1=Faker&player2=Chovy    # Player vs player
GET /api/ai/matchup?team1=T1&team2=GEN              # Team vs team
```

### Comprehensive Insights
```bash
GET /api/ai/insights           # Complete AI analysis summary
GET /api/ai/meta-insights      # Meta trends and champion insights
```

### Testing & Debug
```bash
POST /api/ai/test-player-lookup    # Test individual player PUUID lookup
GET /api/ai/test-riot-api          # Riot API connectivity test
```

## 🎯 Player Form Metrics

### Form Rating Calculation
- **Base**: (Recent 5 avg / Older avg) × Recent win rate
- **Trend bonus**: +50% for strong upward trends
- **Streak bonus**: +3 points for hot streaks
- **Result**: 0.8 - 1.2 multiplier for projections

### Trend Categories
- **Hot**: Recent avg >110% of historical + positive momentum
- **Cold**: Recent avg <90% of historical + negative momentum  
- **Improving**: Positive momentum >2 fantasy points
- **Declining**: Negative momentum <-2 fantasy points
- **Stable**: Minimal change between periods

### Consistency Levels
- **High**: Variance <5 fantasy points (reliable)
- **Medium**: Variance 5-15 fantasy points (moderate)
- **Low**: Variance >15 fantasy points (volatile)

## 🏆 Champion Tier System

### Tier Rankings (S, A, B, C, D)
- **S Tier**: Score ≥0.9 (Elite performance)
- **A Tier**: Score 0.75-0.89 (Strong picks)
- **B Tier**: Score 0.6-0.74 (Solid options)
- **C Tier**: Score 0.4-0.59 (Situational)
- **D Tier**: Score <0.4 (Avoid)

### Scoring Formula
```
Score = (Avg Fantasy Points / 25) × 0.4 + Win Rate × 0.3 + (Avg KDA / 4) × 0.3
```

## 🤖 Machine Learning Models

### TensorFlow.js Neural Networks
1. **Player Performance Model**
   - Input: 12 features (recent stats, form, champion data)
   - Output: Fantasy points adjustment, variance, ceiling, floor
   - Activation: Sigmoid (bounded 0-1 for controlled adjustments)

2. **Lineup Score Model**  
   - Input: 20 lineup features (correlations, exposure, value)
   - Output: Lineup quality score
   - Use case: Ranking generated lineups

3. **Risk Assessment Model**
   - Input: 15 features (exposure, correlation, variance)
   - Output: Portfolio risk metrics
   - Use case: Diversification analysis

## 📈 Integration with DFS Optimizer

### Projection Adjustments
- **Form multipliers**: Applied to base projections (±20% max)
- **ML adjustments**: Additional neural network refinements (±10% max)
- **Confidence intervals**: Ceiling/floor estimates for simulation

### Stack Recommendations
- **Team form analysis**: Average form rating across all players
- **Hot streak detection**: Teams with multiple players in hot form
- **Meta alignment**: Teams performing well in current game meta

### Captain Selection
- **Hot streak priority**: Players on 3+ win streaks
- **Form trend weighting**: Recent performance vs historical
- **Ownership considerations**: Low-owned players with strong form

## 🗂️ Player Mappings

### Supported Regions
- **LCK**: T1 (5 players), GEN (5 players) ✅ 
- **LEC**: G2 (5 players), FNC (4 players), TH (1 player) ✅
- **LCS**: C9 (3 players) ✅

### Mapping Format
```json
{
  "Faker": {
    "summonerName": "Hide on bush",
    "region": "KR", 
    "team": "T1",
    "puuid": "...",
    "altNames": ["T1 Faker", "SKT T1 Faker"]
  }
}
```

### Auto-Discovery
- **Riot ID support**: Tests multiple taglines (LEC, LCS, team names)
- **Fallback names**: Tries alternative summoner names
- **Rate limiting**: 1.5s delays between requests
- **Caching**: Saves successful mappings to `/data/player-mappings.json`

## 🚨 Error Handling

### Common Issues
- **403 Errors**: Player summoner name incorrect or region mismatch
- **Rate Limits**: Automatic retry with exponential backoff
- **Missing Data**: Graceful fallback to simulated data
- **API Downtime**: Uses cached data when available

### Debugging Tools
- **Player lookup test**: Verify individual player PUUIDs
- **Mapping status**: Check which players are successfully mapped
- **Health checks**: Verify all services are operational

## 🔄 Data Flow

1. **Initialization**: Load player mappings and fetch PUUIDs
2. **Data Collection**: Pull last 20 games per player from Riot API
3. **Analysis**: Calculate form trends, streaks, champion performance
4. **ML Training**: Train models on historical performance data
5. **Insights Generation**: Combine all analysis for recommendations
6. **API Serving**: Provide real-time insights via REST endpoints

## 📋 Usage Examples

### Get Hot Players
```javascript
const response = await fetch('/api/ai/player-form');
const hotPlayers = response.data.form_analysis.hot_players;
// Use hot players as captain candidates
```

### Team Matchup Analysis
```javascript  
const response = await fetch('/api/ai/matchup?team1=T1&team2=GEN');
const recommendation = response.analysis.stackRecommendation;
// Apply team stacking strategy
```

### Comprehensive Insights
```javascript
const response = await fetch('/api/ai/insights');
const insights = response.ai_insights;
// Get captain candidates, avoid players, stack recommendations
```

## 🎛️ Configuration

### Environment Variables
```bash
RIOT_API_KEY=your_riot_api_key_here    # Required for player data
AI_PORT=3002                           # AI service port
```

### Customization
- **Player mappings**: Edit `/ai-service/services/ChampionPerformanceTracker.js`
- **Scoring weights**: Modify fantasy point calculations in `RiotGamesAPI.js`
- **Form thresholds**: Adjust hot/cold detection in `calculateRecentForm()`
- **ML model architecture**: Update neural network layers in `MLModelService.js`

---

*For technical support or feature requests, see the main project README.md*