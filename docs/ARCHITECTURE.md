# LoL DFS Optimizer Architecture

## System Overview

**Service Ports:**

- Client (React): Port 3000
- Main Server (Express): Port 3001
- AI Service (Express): Port 3002

## High-Level Architecture

```mermaid
graph LR
    subgraph Frontend
        Client[React Client<br/>Port 3000]
    end

    subgraph Backend
        MainServer[Main Server<br/>Express<br/>Port 3001]
        AIService[AI Service<br/>Express<br/>Port 3002]
    end

    subgraph External
        Riot[Riot Games API]
        DK[DraftKings]
    end

    Client -->|HTTP| MainServer
    MainServer -->|Response| Client
    Client -->|HTTP| AIService
    AIService -->|Response| Client
    MainServer -->|Sync| AIService
    AIService -->|Data| MainServer
    AIService -->|API Calls| Riot
    Client -->|Import| DK

    style Client fill:#4A90E2,stroke:#333,stroke-width:3px,color:#fff
    style MainServer fill:#50C878,stroke:#333,stroke-width:3px,color:#fff
    style AIService fill:#9B59B6,stroke:#333,stroke-width:3px,color:#fff
    style Riot fill:#E74C3C,stroke:#333,stroke-width:3px,color:#fff
    style DK fill:#E74C3C,stroke:#333,stroke-width:3px,color:#fff
```

## Client Layer Architecture

**React Client - Port 3000**

```mermaid
graph TD
    subgraph ReactClient
        App[App.js<br/>Main Controller]

        subgraph Components
            Upload[Upload Component<br/>CSV/JSON Import]
            PlayerMgr[Player Manager<br/>CRUD Operations]
            Lineups[Lineup List<br/>View/Export]
            StackExp[Stack Exposure<br/>Team Constraints]
            HybridOpt[Hybrid Optimizer UI<br/>Multi-Strategy]
            AdvOpt[Advanced Optimizer UI<br/>Monte Carlo]
            NexusTest[NexusScore Tester<br/>Algorithm Testing]
            AIInsights[AI Insights<br/>Recommendations & Data]
        end

        subgraph Libraries
            AdvOptLib[AdvancedOptimizer.js<br/>Core Algorithm]
            HybridLib[HybridOptimizer.js<br/>Strategy Manager]
            GeneticLib[GeneticOptimizer.js<br/>Evolutionary]
            SimAnnealLib[SimulatedAnnealing.js<br/>Temperature-based]
            DataVal[DataValidator.js<br/>Input Validation]
        end
    end

    App --> Components
    HybridOpt --> HybridLib
    AdvOpt --> AdvOptLib
    HybridLib --> GeneticLib
    HybridLib --> SimAnnealLib
    Components --> DataVal

    style App fill:#4A90E2,stroke:#333,stroke-width:2px,color:#fff
    style Components fill:#6BB6FF,stroke:#333,stroke-width:2px,color:#fff
    style Libraries fill:#357ABD,stroke:#333,stroke-width:2px,color:#fff
```

## Main Server Architecture

**Express Server - Port 3001**

```mermaid
graph TD
    subgraph MainServer
        Express[Express Server<br/>REST API]

        subgraph DataLayer
            PlayerData[Player Projections<br/>In-Memory Store]
            TeamStacks[Team Stacks<br/>In-Memory Store]
            LineupsData[Lineups<br/>In-Memory Store]
            Settings[Settings<br/>In-Memory Store]
        end

        subgraph Processing
            FileProc[File Processor<br/>CSV/JSON Parser]
            OptEngine[Optimizer Engine<br/>Lineup Generation]
            SimEngine[Simulation Engine<br/>Monte Carlo]
            ExportProc[Export Processor<br/>DK/CSV/JSON]
        end

        subgraph RealTime
            SSE[SSE Manager<br/>Progress Updates]
            Sessions[Session Manager<br/>Progress Tracking]
        end
    end

    Express --> DataLayer
    Express --> Processing
    Express --> RealTime
    FileProc --> DataLayer
    OptEngine --> DataLayer
    SimEngine --> DataLayer
    SSE --> Sessions

    style Express fill:#50C878,stroke:#333,stroke-width:2px,color:#fff
    style DataLayer fill:#7DD99F,stroke:#333,stroke-width:2px,color:#fff
    style Processing fill:#45B565,stroke:#333,stroke-width:2px,color:#fff
    style RealTime fill:#36A14D,stroke:#333,stroke-width:2px,color:#fff
```

## AI Service Architecture

**AI Service - Port 3002**

```mermaid
graph TD
    subgraph AIServiceLayer
        AIExpress[Express Server<br/>AI REST API]

        subgraph DataCollection
            BGCollector[Background Collector<br/>30-min Auto Updates]
            DataSync[Data Sync Service<br/>Main Server Sync]
            Cache[File Cache<br/>TTL Storage]
        end

        subgraph Analytics
            ChampTracker[Champion Tracker<br/>Performance Analysis]
            MetaDetector[Meta Detector<br/>Trend Analysis]
            RiskAssessor[Risk Assessor<br/>Portfolio Analysis]
        end

        subgraph ML
            TensorFlow[TensorFlow.js<br/>Neural Networks]
            PlayerPredictor[Player Predictor<br/>Performance ML]
            RecEngine[Recommendation Engine<br/>Lineup Suggestions]
        end

        subgraph External
            RiotAPI[Riot Games API<br/>Match Data]
            RateLimiter[Rate Limiter<br/>API Management]
        end
    end

    AIExpress --> DataCollection
    AIExpress --> Analytics
    AIExpress --> ML
    BGCollector --> Cache
    BGCollector --> RiotAPI
    DataSync --> Cache
    ChampTracker --> Cache
    ChampTracker --> RiotAPI
    Analytics --> ML
    RecEngine --> TensorFlow
    PlayerPredictor --> TensorFlow
    RiotAPI --> RateLimiter

    style AIExpress fill:#9B59B6,stroke:#333,stroke-width:2px,color:#fff
    style DataCollection fill:#B47CC7,stroke:#333,stroke-width:2px,color:#fff
    style Analytics fill:#8E44AD,stroke:#333,stroke-width:2px,color:#fff
    style ML fill:#6C3483,stroke:#333,stroke-width:2px,color:#fff
    style External fill:#E74C3C,stroke:#333,stroke-width:2px,color:#fff
```

## Data Flow Sequences

### 1. Player Data Import Flow

```mermaid
sequenceDiagram
    participant User
    participant Client
    participant MainServer
    participant AIService

    User->>Client: Upload CSV/JSON
    Client->>MainServer: POST /players/projections
    MainServer->>MainServer: Parse & Validate
    MainServer->>MainServer: Store in Memory
    MainServer->>Client: Success Response
    Client->>AIService: Trigger Sync
    AIService->>MainServer: GET /api/data/players
    AIService->>AIService: Update Cache
    AIService->>Client: Sync Complete
```

### 2. Lineup Generation Flow

```mermaid
sequenceDiagram
    participant User
    participant Client
    participant MainServer
    participant SSE

    User->>Client: Generate Lineups
    Client->>MainServer: POST /lineups/generate-hybrid
    MainServer->>SSE: Create Session
    MainServer->>MainServer: Initialize Optimizer
    loop Generation Progress
        MainServer->>SSE: Progress Update
        SSE->>Client: Real-time Progress
    end
    MainServer->>MainServer: Store Lineups
    MainServer->>Client: Lineups Response
```

### 3. AI Enhancement Flow

```mermaid
sequenceDiagram
    participant User
    participant Client
    participant AIService
    participant Cache
    participant RiotAPI

    User->>Client: Request AI Insights
    Client->>AIService: GET /api/ai/coach
    AIService->>Cache: Check Cache
    alt Cache Hit
        Cache->>AIService: Return Cached Data
    else Cache Miss
        AIService->>RiotAPI: Fetch Match Data
        RiotAPI->>AIService: Match Results
        AIService->>Cache: Update Cache
    end
    AIService->>AIService: Run ML Models
    AIService->>Client: AI Recommendations
```

## Component Details

### Client Layer (Port 3000)

- **React UI**: Main user interface with tabbed navigation
- **AI Insights**: Real-time AI recommendations and data collection UI
- **Optimizer Components**: Hybrid and Advanced optimizer interfaces
- **Player Management**: CRUD operations for player data
- **Lineup Management**: View, export, and manage generated lineups
- **Stack Exposure**: Configure team stack exposure targets

### Main Server (Port 3001)

- **REST API**: Express server handling all core operations
- **In-Memory Data Store**: Stores player projections, lineups, and settings
- **Optimizer Engine**: Advanced Monte Carlo simulation engine
- **File Processor**: Handles CSV/JSON imports and exports
- **SSE Progress Updates**: Real-time optimization progress streaming

### AI Service (Port 3002)

- **AI REST API**: Dedicated API for AI features
- **Background Data Collector**: Automated 30-minute data collection
- **Champion Performance Tracker**: Dynamic player mapping and performance analysis
- **ML Models**: TensorFlow.js neural networks for predictions
- **Data Sync Service**: Synchronizes with main server data
- **Cache**: Stores collected data with TTL

### AI Components

- **Recommendation Engine**: Generates optimization suggestions
- **Meta Detector**: Analyzes current game meta trends
- **Player Predictor**: ML-based performance predictions
- **Risk Assessor**: Portfolio risk analysis
- **Data Collector**: Fetches and processes Riot API data

### External Services

- **Riot Games API**: Live match data and player statistics
- **DraftKings**: Contest data and player ID mappings

## Data Flow Patterns

### 1. Data Import Flow

```mermaid
graph LR
    A[User Upload] --> B[Main Server]
    B --> C[File Processor]
    C --> D[Data Store]
    D --> E[AI Service Sync]
```

### 2. Optimization Flow

```mermaid
graph LR
    A[User Request] --> B[Main Server]
    B --> C[Optimizer Engine]
    C --> D[SSE Updates]
    D --> E[Client UI]
```

### 3. AI Enhancement Flow

```mermaid
graph LR
    A[Client Request] --> B[AI Service]
    B --> C[ML Models/Analysis]
    C --> D[Recommendations]
    D --> E[Client UI]
```

### 4. Background Collection Flow

```mermaid
graph LR
    A[Timer 30min] --> B[Background Collector]
    B --> C[Riot API]
    C --> D[Cache]
    D --> E[Available for Queries]
```

### 5. Live Data Flow

```mermaid
graph LR
    A[AI Insights UI] --> B[AI Service]
    B --> C[Cached Data/Fresh Collection]
    C --> D[Progress Updates]
    D --> E[UI]
```

## Key Technologies

### Frontend

- React 18 with Hooks
- TailwindCSS
- Recharts for visualizations
- Server-Sent Events client

### Backend

- Node.js & Express
- Multer for file uploads
- CSV Parser
- Server-Sent Events

### AI Service

- TensorFlow.js
- Axios for HTTP requests
- Node-cron for scheduling
- File-based caching

### External APIs

- Riot Games API v4
- Rate limiting: 100 requests/2min, 20 requests/1s

## Communication Patterns

### REST API

- Main Server: Standard REST endpoints
- AI Service: Specialized AI endpoints
- Content-Type: application/json

### Server-Sent Events (SSE)

- Optimization progress updates
- Background collection status
- Real-time UI updates

### Data Synchronization

- AI Service polls Main Server for player/lineup data
- Cached for performance
- 5-minute sync intervals

## Deployment Considerations

### Development

- All services run locally
- `npm start` launches all services
- `npm run start-basic` for non-AI mode

### Production

- Services can be deployed independently
- AI Service optional (graceful degradation)
- Environment variables for configuration
- CORS enabled for cross-origin requests

### Scaling

- Main Server: Stateless, horizontally scalable
- AI Service: Single instance (background collector)
- Cache layer can be externalized (Redis)
- Rate limiting considerations for Riot API

## Security Considerations

- API keys stored in environment variables
- CORS configured for known origins
- Input validation on all endpoints
- Rate limiting on expensive operations
- No sensitive data in client state
