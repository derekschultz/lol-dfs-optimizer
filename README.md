# League of Legends DFS Optimizer

A powerful web application for optimizing League of Legends Daily Fantasy Sports (DFS) lineups using advanced Monte Carlo simulations and optimization algorithms.

## Features

### Core Optimization

- **Advanced Optimizer**: Monte Carlo simulation engine with SaberSim-like functionality
- **Hybrid Optimizer v2.0**: Combines multiple optimization strategies for diversified lineup generation
- **Genetic Algorithm**: Evolutionary approach to lineup optimization
- **Simulated Annealing**: Temperature-based optimization for escaping local optima
- **NexusScore Algorithm**: Proprietary scoring system for comprehensive lineup evaluation

### Data Management

- **Player Projections**: Import and manage player statistical projections
- **Player Management**: Bulk operations for player data (view, edit, delete)
- **DraftKings Integration**: Import/export DraftKings contest data and salaries
- **Multiple Import Formats**: Support for CSV and JSON data formats

### Lineup Generation & Analysis

- **Portfolio Optimization**: Barbell strategy and diversified lineup selection
- **Monte Carlo Simulation**: Run thousands of simulations to test lineup performance
- **Duplicate Prevention**: Advanced algorithms to ensure unique lineup generation
- **Real-time Progress Tracking**: Server-Sent Events for live optimization updates
- **Export Options**: CSV, JSON, and DraftKings-ready formats

### Advanced Features

- **Correlation Modeling**: Account for player and team correlations
- **Ownership Leverage**: Factor in projected ownership for contrarian plays
- **Field Size Optimization**: Adjust strategies based on contest size

### AI-Powered Features 🤖

- **Live Data Integration**: Recent match data from Riot Games API with 30-minute automated updates
- **Smart Recommendations**: AI-driven lineup optimization with machine learning models
- **Portfolio Grading**: Instant A-F grading with detailed performance metrics
- **Player Form Analysis**: Track hot/cold streaks and recent performance trends
- **Champion Performance**: Tier-based champion rankings with fantasy scoring
- **Meta Analysis**: Real-time meta trends and champion priority insights
- **Risk Assessment**: Multi-dimensional portfolio risk and exposure analysis
- **Dynamic Player Discovery**: Intelligent mapping of players to live match data
- **Background Collection**: Automated data updates every 30 minutes with caching
- **One-Click Optimization**: Apply AI suggestions instantly

📖 **[AI Features User Guide](./AI_USER_GUIDE.md)** - Learn how to use the AI-powered features
📖 **[AI Technical Documentation](./docs/AI_FEATURES.md)** - Technical details and API reference

## Tech Stack

- **Backend**: Node.js, Express
- **Frontend**: React 18 with Hooks
- **AI Service**: Standalone Node.js service with TensorFlow.js
- **External APIs**: Riot Games API for live match data
- **Styling**: TailwindCSS with custom blue theme
- **Charts & Visualization**: Recharts
- **Build Tools**: react-app-rewired, customize-cra
- **File Processing**: multer, csv-parser, papaparse

## Quick Start

### Prerequisites

- Node.js (v14 or higher)
- npm
- Riot Games API Key (optional, for AI features)

### Installation

1. Clone the repository:

```bash
git clone https://github.com/derekschultz/lol-dfs-optimizer.git
cd lol-dfs-optimizer
```

2. Install all dependencies:

```bash
npm run install-all
```

3. Start the application:

```bash
npm start
```

This starts all services:

- Main server on port 3001
- React client on port 3000
- AI service on port 3002

For development without AI features:

```bash
npm run start-basic
```

### Configuration

To enable AI features, create a `.env` file in the `ai-service` directory:

```bash
RIOT_API_KEY=your_riot_api_key_here
```

## Application Structure

### Main Tabs

1. **Upload**: Import player projections, team stacks, and DraftKings data
2. **Player Management**: View, edit, and manage player data
3. **Lineups**: View, export, and manage generated lineups
4. **Stack Exposure**: Manage team stack exposure targets and constraints
5. **Hybrid Optimizer v2.0**: Advanced multi-strategy optimization
6. **Advanced Optimizer (Legacy)**: Original optimization engine
7. **NexusScore Test**: Test and validate the proprietary scoring algorithm

### Project Structure

```
lol-dfs-optimizer/
├── client/                 # React frontend
│   ├── src/
│   │   ├── components/     # UI components
│   │   │   ├── AdvancedOptimizerUI.js
│   │   │   ├── HybridOptimizerUI.js
│   │   │   ├── LineupList.js
│   │   │   ├── PlayerManagerUI.js
│   │   │   ├── AIInsights.js
│   │   │   └── NexusScoreTester.js
│   │   ├── lib/           # Optimization algorithms
│   │   │   ├── AdvancedOptimizer.js
│   │   │   ├── HybridOptimizer.js
│   │   │   ├── GeneticOptimizer.js
│   │   │   └── SimulatedAnnealingOptimizer.js
│   │   └── pages/         # Page components
├── ai-service/           # AI service (port 3002)
│   ├── services/         # AI modules
│   │   ├── BackgroundDataCollector.js
│   │   ├── ChampionPerformanceTracker.js
│   │   ├── DataCollector.js
│   │   ├── MLModelService.js
│   │   ├── MetaDetector.js
│   │   ├── PlayerPredictor.js
│   │   ├── RecommendationEngine.js
│   │   └── RiotGamesAPI.js
│   └── server.js         # AI service server
├── docs/                 # Documentation
│   └── AI_FEATURES.md    # Technical AI documentation
├── server.js             # Express server
└── uploads/              # File upload storage
```

## API Endpoints

### Player Data

- `GET/POST /players/projections` - Player projection data
- `DELETE /players/:id` - Delete single player
- `DELETE /players/bulk` - Delete multiple players

### Lineup Management

- `GET/POST /lineups` - Lineup operations
- `POST /lineups/generate` - Generate optimized lineups (legacy)
- `POST /lineups/generate-hybrid` - Generate with hybrid optimizer
- `POST /lineups/export` - Export lineups in various formats
- `DELETE /lineups/:id` - Delete lineup

### DraftKings Integration

- `POST /draftkings/import` - Import DraftKings contest data
- `POST /lineups/dkentries` - Import DraftKings entries
- `POST /lineups/import` - Import JSON lineups

### Optimization

- `POST /optimizer/initialize` - Initialize hybrid optimizer
- `GET /optimizer/strategies` - Get available strategies
- `GET /optimizer/stats` - Get optimizer performance stats
- `GET /optimizer/progress/:sessionId` - Real-time progress updates

### Analysis & Simulation

- `POST /simulation/run` - Run Monte Carlo simulations
- `POST /data/validate` - Validate data integrity
- `GET /teams/stats` - Calculate team statistics

### Settings & Configuration

- `GET/POST /settings` - Application settings
- `POST /nexusscore/formula` - Save NexusScore formula

### AI Service (Port 3002)

- `GET /health` - Service health check
- `POST /api/ai/recommendations` - Generate AI-powered lineup recommendations
- `GET /api/ai/meta-insights` - Get current meta trends and insights
- `POST /api/ai/player-predictions` - Get player performance predictions
- `POST /api/ai/risk-assessment` - Analyze portfolio risk
- `GET /api/ai/coach` - Get comprehensive coaching insights
- `GET /api/ai/collect-data` - Get cached data
- `POST /api/ai/collect-data` - Trigger background data collection
- `GET /api/ai/collection-status` - Check collection progress

## Advanced Features

### NexusScore Algorithm

Comprehensive lineup evaluation considering:

- Projected points with captain multiplier (1.5x)
- Ownership-based leverage calculations
- Team stacking bonuses with Stack+ ratings
- Correlation adjustments
- Field position optimization

### Stack+ Rating System

Advanced team synergy evaluation:

- **Stack+ Rating**: Overall team performance rating for stacking
- **Stack+ Wins**: Team performance when dominating (2-0, 3-0 sweeps)
- **Stack+ Losses**: Team resilience when losing
- **Contest-Specific**: Different weights for GPP vs Cash games
- **Dynamic Modifiers**: 2-15% lineup score adjustments based on team synergy

### Monte Carlo Simulation

- Runs thousands of iterations to test lineup performance
- Accounts for projection variance and randomness
- Calculates percentile outcomes and ROI projections
- Optimizes for different contest types

### Hybrid Optimization Strategies

- **Balanced**: Even distribution across all algorithms
- **Aggressive**: High-variance, tournament-focused lineups
- **Conservative**: Lower-variance, cash game optimization
- **Contrarian**: Leverage-based, low-ownership focused
- **Recommended**: Dynamic strategy based on contest analysis

### Portfolio Management

- Barbell strategy for risk distribution
- Correlation-aware lineup generation
- Duplicate prevention across multiple entries
- Exposure management for large contest entries

### AI Data Collection

- **Background Collection**: Automated data gathering every 30 minutes
- **Smart Caching**: Instant data access with cached results
- **Progress Monitoring**: Real-time collection status via UI
- **Dynamic Discovery**: Automatically maps players to Riot API data
- **Error Resilience**: Graceful handling of API limits and missing data

## Data Formats

### Player Projections CSV

Required columns: `Name`, `Team`, `Position`, `Salary`, `Projected Points`, `Ownership`

### DraftKings Contest CSV

Standard DraftKings export format with contest metadata and player IDs

### Team Stacks CSV

Format: `Team`, `Stack+` with position-specific stack definitions

## License

GNU Affero General Public License v3.0 - see LICENSE file for details

## Support

For issues and feature requests, please create an issue in the repository.
