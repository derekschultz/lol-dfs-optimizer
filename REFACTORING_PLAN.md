# 🏗️ LoL DFS Optimizer Refactoring Implementation Plan

## 📋 Overview

Transform the monolithic codebase into a maintainable, scalable, and testable architecture through 5 phases of systematic refactoring.

**Status**: Planning Phase Complete ✅  
**Created**: 2025-01-27  
**Estimated Duration**: 11 weeks  
**Current Phase**: Not Started

## 🎯 Success Metrics

- Reduce file complexity (target: <300 lines per file)
- Improve test coverage (target: >80%)
- Enhance performance (target: <2s page loads)
- Increase developer velocity (faster feature development)

## 🚨 Current Technical Debt Assessment

### Critical Issues Identified:

1. **Massive Monolithic Files**

   - server.js: 2,300+ lines (API routes, business logic, file processing, optimization)
   - App.js: 1,460+ lines (React component managing multiple concerns)

2. **No Clear Architecture Pattern**

   - Mixed concerns everywhere (UI, business logic, data persistence)
   - In-memory data storage in production server (not scalable)
   - Tightly coupled microservices

3. **Complex State Management**

   - React state scattered across multiple concerns
   - No centralized state management
   - Props drilling and complex callback chains

4. **Multiple Optimization Algorithms**
   - AdvancedOptimizer, HybridOptimizer, GeneticOptimizer, SimulatedAnnealingOptimizer
   - Unclear relationships and responsibilities
   - Duplicate logic across different optimizers

---

## 🚀 Phase 1: Backend Service Extraction (Weeks 1-2)

### 1.1 Extract API Routes from server.js

**Priority: CRITICAL**  
**Status**: ⏳ Pending

**Current Problem**: 2,300+ line monolithic server file

**New Structure:**

```
src/
├── routes/
│   ├── index.js              # Main router
│   ├── players.js            # Player CRUD operations
│   ├── lineups.js            # Lineup management
│   ├── teams.js              # Team/stack operations
│   ├── optimizer.js          # Optimization endpoints
│   ├── simulation.js         # Monte Carlo simulation
│   ├── upload.js             # File upload handlers
│   └── data.js               # Data export/import
├── services/
│   ├── PlayerService.js      # Player business logic
│   ├── LineupService.js      # Lineup operations
│   ├── OptimizationService.js # Optimization coordination
│   ├── FileProcessingService.js # CSV/JSON processing
│   └── ExposureService.js    # Exposure calculations
├── middleware/
│   ├── auth.js               # Authentication (future)
│   ├── validation.js         # Request validation
│   ├── errorHandler.js       # Global error handling
│   └── upload.js             # File upload middleware
└── utils/
    ├── csvParser.js          # CSV parsing utilities
    ├── validators.js         # Data validation
    └── generators.js         # ID generation, etc.
```

**Implementation Tasks:**

1. ✅ Create router structure and extract routes
2. ✅ Extract business logic into service classes
3. ✅ Add input validation middleware
4. ✅ Implement proper error handling
5. ✅ Add comprehensive logging

### 1.2 Extract Data Access Layer

**Create repository pattern for data operations:**

```javascript
// repositories/PlayerRepository.js
class PlayerRepository {
  constructor(dataStore) {
    this.dataStore = dataStore;
  }

  async findAll() {
    /* implementation */
  }
  async findById(id) {
    /* implementation */
  }
  async create(playerData) {
    /* implementation */
  }
  async update(id, playerData) {
    /* implementation */
  }
  async delete(id) {
    /* implementation */
  }
  async findByTeam(team) {
    /* implementation */
  }
  async findByPosition(position) {
    /* implementation */
  }
}
```

**Deliverables:**

- [ ] PlayerRepository.js
- [ ] LineupRepository.js
- [ ] TeamStackRepository.js
- [ ] ContestRepository.js

---

## 🗄️ Phase 2: Database Implementation (Weeks 3-4)

### 2.1 Database Selection & Setup

**Priority: HIGH**  
**Status**: ⏳ Pending  
**Choice**: PostgreSQL (relational data, ACID compliance, JSON support)

**Schema Design:**

```sql
-- Core tables
CREATE TABLE players (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100) NOT NULL,
  team VARCHAR(50) NOT NULL,
  position VARCHAR(10) NOT NULL,
  salary INTEGER NOT NULL,
  projected_points DECIMAL(8,2) NOT NULL,
  ownership DECIMAL(5,2),
  draftkings_id VARCHAR(20),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE team_stacks (
  id SERIAL PRIMARY KEY,
  team VARCHAR(50) NOT NULL,
  stack_positions TEXT[] NOT NULL,
  stack_plus DECIMAL(8,2) DEFAULT 0,
  stack_plus_wins DECIMAL(8,2) DEFAULT 0,
  stack_plus_losses DECIMAL(8,2) DEFAULT 0,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE lineups (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  captain_player_id INTEGER REFERENCES players(id),
  players JSONB NOT NULL, -- Array of player objects
  nexus_score DECIMAL(8,2),
  projected_points DECIMAL(8,2),
  total_salary INTEGER,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE TABLE contests (
  id SERIAL PRIMARY KEY,
  draftkings_id VARCHAR(50),
  name VARCHAR(200),
  entry_fee DECIMAL(8,2),
  field_size INTEGER,
  contest_type VARCHAR(50),
  created_at TIMESTAMP DEFAULT NOW()
);
```

### 2.2 Database Integration

**Technology Stack:**

- **ORM**: Prisma or TypeORM
- **Migration**: Database migration system
- **Connection**: Connection pooling

**Implementation:**

```javascript
// config/database.js
const { Pool } = require("pg");

const pool = new Pool({
  user: process.env.DB_USER,
  host: process.env.DB_HOST,
  database: process.env.DB_NAME,
  password: process.env.DB_PASSWORD,
  port: process.env.DB_PORT,
  max: 20, // Connection pool size
});

module.exports = pool;
```

**Deliverables:**

- [ ] Database schema and migrations
- [ ] ORM setup and configuration
- [ ] Data migration scripts from in-memory to database
- [ ] Connection pooling and environment configuration

---

## ⚛️ Phase 3: Frontend Architecture Refactor (Weeks 5-7)

### 3.1 Break Down App.js Monolith

**Priority: MEDIUM**  
**Status**: ⏳ Pending  
**Current Problem**: 1,460+ line React component

**New Structure:**

```
src/
├── components/
│   ├── common/
│   │   ├── Header.jsx
│   │   ├── Navigation.jsx
│   │   ├── LoadingSpinner.jsx
│   │   └── NotificationSystem.jsx
│   ├── players/
│   │   ├── PlayerList.jsx
│   │   ├── PlayerForm.jsx
│   │   └── PlayerManager.jsx
│   ├── lineups/
│   │   ├── LineupGrid.jsx
│   │   ├── LineupCard.jsx
│   │   └── LineupActions.jsx
│   ├── optimization/
│   │   ├── OptimizerConfiguration.jsx
│   │   ├── ExposureSettings.jsx
│   │   └── StackConfiguration.jsx
│   └── analytics/
│       ├── PerformanceCharts.jsx
│       └── InsightsDashboard.jsx
├── hooks/
│   ├── usePlayerData.js
│   ├── useLineupGeneration.js
│   ├── useExposureSettings.js
│   └── useNotifications.js
├── services/
│   ├── api.js               # Centralized API client
│   ├── playerService.js     # Player API calls
│   ├── lineupService.js     # Lineup API calls
│   └── optimizerService.js  # Optimization API calls
├── store/
│   ├── index.js             # Store configuration
│   ├── slices/
│   │   ├── playersSlice.js  # Player state
│   │   ├── lineupsSlice.js  # Lineup state
│   │   ├── exposureSlice.js # Exposure settings
│   │   └── uiSlice.js       # UI state (loading, notifications)
└── utils/
    ├── calculations.js      # NexusScore, exposure calculations
    ├── formatters.js        # Data formatting utilities
    └── validators.js        # Client-side validation
```

### 3.2 State Management Implementation

**Technology**: Redux Toolkit

```javascript
// store/slices/playersSlice.js
import { createSlice, createAsyncThunk } from "@reduxjs/toolkit";
import playerService from "../services/playerService";

export const fetchPlayers = createAsyncThunk(
  "players/fetchPlayers",
  async (_, { rejectWithValue }) => {
    try {
      return await playerService.getAll();
    } catch (error) {
      return rejectWithValue(error.message);
    }
  }
);

const playersSlice = createSlice({
  name: "players",
  initialState: {
    items: [],
    loading: false,
    error: null,
  },
  reducers: {
    addPlayer: (state, action) => {
      state.items.push(action.payload);
    },
    updatePlayer: (state, action) => {
      const index = state.items.findIndex((p) => p.id === action.payload.id);
      if (index !== -1) {
        state.items[index] = action.payload;
      }
    },
    removePlayer: (state, action) => {
      state.items = state.items.filter((p) => p.id !== action.payload);
    },
  },
  extraReducers: (builder) => {
    builder
      .addCase(fetchPlayers.pending, (state) => {
        state.loading = true;
        state.error = null;
      })
      .addCase(fetchPlayers.fulfilled, (state, action) => {
        state.loading = false;
        state.items = action.payload;
      })
      .addCase(fetchPlayers.rejected, (state, action) => {
        state.loading = false;
        state.error = action.payload;
      });
  },
});

export const { addPlayer, updatePlayer, removePlayer } = playersSlice.actions;
export default playersSlice.reducer;
```

### 3.3 Custom Hooks Implementation

```javascript
// hooks/usePlayerData.js
import { useEffect } from "react";
import { useSelector, useDispatch } from "react-redux";
import {
  fetchPlayers,
  addPlayer,
  updatePlayer,
  removePlayer,
} from "../store/slices/playersSlice";

export const usePlayerData = () => {
  const dispatch = useDispatch();
  const {
    items: players,
    loading,
    error,
  } = useSelector((state) => state.players);

  useEffect(() => {
    if (players.length === 0 && !loading) {
      dispatch(fetchPlayers());
    }
  }, [dispatch, players.length, loading]);

  const handleAddPlayer = (playerData) => {
    dispatch(addPlayer(playerData));
  };

  const handleUpdatePlayer = (id, playerData) => {
    dispatch(updatePlayer({ id, ...playerData }));
  };

  const handleRemovePlayer = (id) => {
    dispatch(removePlayer(id));
  };

  return {
    players,
    loading,
    error,
    addPlayer: handleAddPlayer,
    updatePlayer: handleUpdatePlayer,
    removePlayer: handleRemovePlayer,
  };
};
```

**Deliverables:**

- [ ] Component extraction and organization
- [ ] Redux Toolkit store setup
- [ ] Custom hooks for business logic
- [ ] API service layer
- [ ] Component testing suite

---

## 🔗 Phase 4: Service Architecture Improvement (Weeks 8-9)

### 4.1 Event-Driven Architecture

**Priority**: MEDIUM  
**Status**: ⏳ Pending  
**Replace REST polling with WebSocket events:**

```javascript
// services/EventBus.js
class EventBus {
  constructor() {
    this.events = new Map();
  }

  subscribe(event, callback) {
    if (!this.events.has(event)) {
      this.events.set(event, []);
    }
    this.events.get(event).push(callback);
  }

  emit(event, data) {
    if (this.events.has(event)) {
      this.events.get(event).forEach((callback) => callback(data));
    }
  }

  unsubscribe(event, callback) {
    if (this.events.has(event)) {
      const callbacks = this.events.get(event);
      const index = callbacks.indexOf(callback);
      if (index > -1) {
        callbacks.splice(index, 1);
      }
    }
  }
}

module.exports = new EventBus();
```

### 4.2 Service Communication Layer

```javascript
// services/ServiceRegistry.js
class ServiceRegistry {
  constructor() {
    this.services = new Map();
  }

  register(name, service) {
    this.services.set(name, service);
  }

  get(name) {
    return this.services.get(name);
  }

  async initializeAll() {
    for (const [name, service] of this.services) {
      if (service.initialize) {
        await service.initialize();
      }
    }
  }
}

module.exports = new ServiceRegistry();
```

**Deliverables:**

- [ ] Event bus implementation
- [ ] Service registry pattern
- [ ] WebSocket integration
- [ ] Service health monitoring
- [ ] API contract definitions

---

## 🧠 Phase 5: Optimization Algorithm Unification (Weeks 10-11)

### 5.1 Strategy Pattern Implementation

**Priority**: MEDIUM  
**Status**: ⏳ Pending

```javascript
// optimization/strategies/BaseStrategy.js
class BaseOptimizationStrategy {
  constructor(name, config) {
    this.name = name;
    this.config = config;
  }

  async optimize(players, constraints, settings) {
    throw new Error("optimize method must be implemented");
  }

  validateInputs(players, constraints) {
    // Common validation logic
  }
}

// optimization/strategies/AdvancedStrategy.js
class AdvancedOptimizationStrategy extends BaseOptimizationStrategy {
  constructor(config) {
    super("advanced", config);
  }

  async optimize(players, constraints, settings) {
    // Advanced optimizer implementation
  }
}

// optimization/OptimizationEngine.js
class OptimizationEngine {
  constructor() {
    this.strategies = new Map();
  }

  registerStrategy(strategy) {
    this.strategies.set(strategy.name, strategy);
  }

  async optimize(strategyName, players, constraints, settings) {
    const strategy = this.strategies.get(strategyName);
    if (!strategy) {
      throw new Error(`Strategy ${strategyName} not found`);
    }
    return await strategy.optimize(players, constraints, settings);
  }
}
```

**Deliverables:**

- [ ] Strategy pattern implementation
- [ ] Unified optimization engine
- [ ] Algorithm comparison framework
- [ ] Performance benchmarking
- [ ] Strategy selection logic

---

## 📊 Implementation Timeline

| Phase | Duration | Key Deliverables                       | Risk Level | Status     |
| ----- | -------- | -------------------------------------- | ---------- | ---------- |
| 1     | 2 weeks  | Service extraction, API routes         | Medium     | ⏳ Pending |
| 2     | 2 weeks  | Database integration, data persistence | High       | ⏳ Pending |
| 3     | 3 weeks  | Frontend refactor, state management    | Medium     | ⏳ Pending |
| 4     | 2 weeks  | Event-driven architecture              | Low        | ⏳ Pending |
| 5     | 2 weeks  | Optimization unification               | Low        | ⏳ Pending |

**Total Duration**: 11 weeks

---

## 🛡️ Risk Mitigation

### High-Risk Areas:

1. **Database Migration**: Potential data loss

   - **Mitigation**: Implement comprehensive backup strategy
   - **Rollback Plan**: Keep in-memory system as fallback

2. **Frontend State Management**: Breaking existing functionality

   - **Mitigation**: Incremental migration with feature flags
   - **Testing**: Comprehensive E2E testing suite

3. **Service Dependencies**: Breaking AI service integration
   - **Mitigation**: Maintain backward compatibility during transition
   - **Monitoring**: Health checks and service monitoring

---

## ✅ Quality Assurance

### Testing Strategy:

- **Unit Tests**: 80%+ coverage for new services
- **Integration Tests**: API endpoint testing
- **E2E Tests**: Critical user journeys
- **Performance Tests**: Load testing for optimization algorithms

### Code Quality:

- **ESLint/Prettier**: Consistent code formatting
- **SonarQube**: Code quality metrics
- **Husky**: Pre-commit hooks for quality gates

---

## 🚀 Getting Started

### Immediate Next Steps:

1. **Set up development environment** with new folder structure
2. **Create feature branch** for Phase 1 work
3. **Extract first API route** (players.js) as proof of concept
4. **Implement basic service layer** for player operations
5. **Add comprehensive testing** for extracted components

### Environment Setup:

```bash
# 1. Create new branch for refactoring
git checkout -b refactor/phase1-service-extraction

# 2. Install additional dependencies
npm install prisma @prisma/client redis socket.io-client @reduxjs/toolkit react-redux

# 3. Create new folder structure
mkdir -p src/{routes,services,middleware,utils,repositories}
mkdir -p client/src/{store,hooks,services,utils}
mkdir -p client/src/components/{common,players,lineups,optimization,analytics}
mkdir -p client/src/store/slices

# 4. Set up testing framework
npm install --save-dev jest supertest @testing-library/react @testing-library/jest-dom
```

---

## 📝 Progress Tracking

### Phase 1 Progress:

- [ ] Extract player routes
- [ ] Extract lineup routes
- [ ] Extract optimizer routes
- [ ] Create service layer
- [ ] Add middleware
- [ ] Implement error handling
- [ ] Add comprehensive logging
- [ ] Write unit tests

### Phase 2 Progress:

- [ ] Database schema design
- [ ] Prisma setup
- [ ] Migration scripts
- [ ] Repository pattern implementation
- [ ] Data migration testing
- [ ] Connection pooling setup

### Phase 3 Progress:

- [ ] Component breakdown planning
- [ ] Redux store setup
- [ ] Custom hooks implementation
- [ ] API service layer
- [ ] Component migration (batch 1)
- [ ] Component migration (batch 2)
- [ ] State management testing

### Phase 4 Progress:

- [ ] Event bus implementation
- [ ] WebSocket setup
- [ ] Service registry
- [ ] Health monitoring
- [ ] API contracts

### Phase 5 Progress:

- [ ] Strategy pattern design
- [ ] Algorithm extraction
- [ ] Optimization engine
- [ ] Performance benchmarking
- [ ] Strategy selection logic

---

## 📞 Support & Documentation

### Key Resources:

- **Technical Architecture**: See `docs/ARCHITECTURE.md`
- **API Documentation**: See `docs/API.md`
- **Database Schema**: See `docs/DATABASE.md`
- **Testing Guidelines**: See `docs/TESTING.md`

### Team Communication:

- **Daily Standups**: Progress updates and blockers
- **Weekly Reviews**: Phase completion and quality gates
- **Architecture Reviews**: Major design decisions

---

_This plan transforms the monolithic codebase into a maintainable, scalable, and testable architecture while preserving all existing functionality. Each phase builds upon the previous one, ensuring minimal disruption to ongoing development._

**Last Updated**: 2025-01-27  
**Next Review**: TBD  
**Owner**: Development Team
