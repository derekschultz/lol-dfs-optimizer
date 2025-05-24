# Stack+ Rating Integration Design Document

## Overview

Stack+ is a proprietary rating system that evaluates the historical performance of team stack combinations in DFS contests. This document outlines the integration of Stack+ ratings into the LoL DFS Optimizer to improve team synergy evaluation and stack selection while preserving individual player projection integrity.

## Core Principle

**Stack+ enhances team synergy evaluation only - individual player projections remain unchanged.**

Player projections already factor in individual performance. Stack+ provides additional insight into how well players perform together as a team unit, capturing chemistry and coordination effects that individual projections cannot measure.

## Understanding Stack+ Ratings

### Rating Scale
- **Elite Tier (200+)**: Exceptional team synergy (e.g., T1: 205.68)
- **Strong Tier (100-199)**: Above-average team coordination (e.g., HLE: 145.46)
- **Average Tier (10-99)**: Standard team performance (e.g., DK: 12.51)
- **Below Average (0-9)**: Poor team synergy (e.g., DNF: 9.65)

### Rating Components
- **Stack+**: Overall team synergy rating
- **Stack+ All Wins**: Team performance in winning lineups
- **Stack+ All Losses**: Team performance in losing lineups
- **Win/Loss Differential**: Indicates team consistency and reliability

## Implementation Strategy

### 1. Core Functions

#### Stack Rating Modifier
```javascript
function getStackRatingModifier(stackPlus) {
  if (stackPlus >= 200) return 1.15;  // Elite synergy - 15% boost
  if (stackPlus >= 150) return 1.10;  // Very Strong - 10% boost
  if (stackPlus >= 100) return 1.07;  // Strong - 7% boost
  if (stackPlus >= 50) return 1.04;   // Above Average - 4% boost
  if (stackPlus >= 20) return 1.02;   // Slightly Above - 2% boost
  if (stackPlus >= 10) return 1.00;   // Average - No modification
  if (stackPlus >= 5) return 0.98;    // Below Average - 2% penalty
  return 0.95;                         // Poor synergy - 5% penalty
}
```

#### Team Consistency Analysis
```javascript
function getTeamConsistency(stackPlusWins, stackPlusLosses) {
  const differential = stackPlusWins - stackPlusLosses;
  
  if (differential > 200) return 1.05;  // Very consistent - 5% bonus
  if (differential > 150) return 1.03;  // Consistent - 3% bonus
  if (differential > 100) return 1.01;  // Slight bonus - 1% bonus
  return 1.00;                          // No consistency bonus
}
```

#### Combined Team Modifier
```javascript
function getStackModifier(teamStack) {
  const synergyModifier = getStackRatingModifier(teamStack.stackPlus);
  const consistencyBonus = getTeamConsistency(teamStack.stackPlusWins, teamStack.stackPlusLosses);
  
  return synergyModifier * consistencyBonus;
}
```

### 2. Integration Points

#### A. NexusScore Stack Bonus Enhancement
Apply Stack+ modifier only to the team synergy component:
```javascript
// In NexusScore calculation
const baseStackBonus = calculateBaseStackBonus(lineup);
const primaryTeamStack = identifyPrimaryStack(lineup);
const stackSynergyModifier = getStackModifier(primaryTeamStack);
const enhancedStackBonus = baseStackBonus * stackSynergyModifier;

nexusScore = baseProjection * leverageFactor * consistencyFactor 
           + enhancedStackBonus + positionBonus;
```

#### B. Stack Selection Priority
Prioritize team stacks during lineup building:
```javascript
// Sort available stacks by Stack+ rating for selection priority
const prioritizedStacks = teamStacks
  .sort((a, b) => b.stackPlus - a.stackPlus)
  .map(stack => ({
    ...stack,
    synergyScore: getStackModifier(stack)
  }));
```

#### C. Team Correlation Enhancement
Apply Stack+ to team correlation bonuses in Monte Carlo simulations:
```javascript
// Enhance same-team correlation based on Stack+ rating
function calculateTeamCorrelation(player1, player2, teamStack) {
  const baseCorrelation = 0.65; // Default same-team correlation
  const synergyModifier = getStackModifier(teamStack);
  return baseCorrelation * synergyModifier;
}
```

#### D. Exposure Management
Set dynamic stack exposure targets based on synergy ratings:
```javascript
function calculateStackExposureTarget(teamStack, baseExposure = 25) {
  const synergyModifier = getStackModifier(teamStack);
  const adjustedExposure = Math.round(baseExposure * synergyModifier);
  
  // Cap exposure between 10% and 50%
  return Math.max(10, Math.min(50, adjustedExposure));
}
```

### 3. Contest-Type Adjustments

#### GPP (Tournament) Mode
Emphasize upside potential using Stack+ All Wins:
```javascript
function getGPPStackModifier(teamStack) {
  const winSynergy = teamStack.stackPlusWins;
  const winModifier = Math.min(1.2, winSynergy / 200); // Cap at 20% boost
  return Math.max(0.9, winModifier); // Floor at 10% penalty
}
```

#### Cash Game Mode
Focus on consistency using base Stack+ and loss performance:
```javascript
function getCashStackModifier(teamStack) {
  const baseSynergy = teamStack.stackPlus;
  const lossPerformance = teamStack.stackPlusLosses;
  const consistencyFactor = Math.min(1.0, lossPerformance / 50); // Higher losses = more consistent floor
  
  return (baseSynergy / 150) * (1 + consistencyFactor * 0.1);
}
```

### 4. Stack Size Scaling

Apply different weights based on stack size:
```javascript
function getScaledStackModifier(teamStack, stackSize) {
  const baseModifier = getStackModifier(teamStack);
  const scaleFactors = { 
    4: 1.0,   // Full team synergy effect
    3: 0.75,  // Reduced synergy with missing players
    2: 0.5    // Minimal synergy effect
  };
  
  const scaleFactor = scaleFactors[stackSize] || 1.0;
  return 1 + (baseModifier - 1) * scaleFactor;
}
```

### 5. Primary Stack Identification

Determine which team stack drives the synergy bonus:
```javascript
function identifyPrimaryStack(lineup) {
  const teamCounts = {};
  
  // Count captain's team
  if (lineup.cpt?.team) {
    teamCounts[lineup.cpt.team] = (teamCounts[lineup.cpt.team] || 0) + 1;
  }
  
  // Count players' teams
  lineup.players.forEach(player => {
    if (player?.team) {
      teamCounts[player.team] = (teamCounts[player.team] || 0) + 1;
    }
  });
  
  // Find team with most players
  const primaryTeam = Object.entries(teamCounts)
    .sort(([,a], [,b]) => b - a)[0][0];
  
  return teamStacks.find(stack => stack.team === primaryTeam);
}
```

## Implementation Priority

### Phase 1: Core Synergy Integration (High Priority)
1. Add Stack+ modifier functions to AdvancedOptimizer
2. Integrate into NexusScore stack bonus calculation
3. Implement primary stack identification
4. Add stack size scaling

### Phase 2: Selection & Exposure (Medium Priority)
5. Stack selection priority system
6. Dynamic exposure management
7. Contest-type specific adjustments
8. Team correlation enhancement

### Phase 3: Polish & Analytics (Low Priority)
9. Debug logging and performance tracking
10. UI display of synergy ratings
11. Historical synergy performance analytics
12. A/B testing framework

## Expected Impact

### Positive Outcomes
- **Better Team Selection**: Favor teams with proven synergy
- **Improved Stack Quality**: Higher-performing team combinations
- **Risk Management**: Avoid teams with poor coordination
- **Strategic Edge**: Leverage team chemistry data competitors miss

### Metrics to Track
- Synergy bonus impact on lineup scores
- Win rate by Stack+ tier
- Exposure accuracy to synergy-based targets
- Team correlation effectiveness

## Testing Strategy

1. **Unit Tests**: Verify synergy modifier calculations
2. **Integration Tests**: Ensure NexusScore enhancement works correctly
3. **Performance Tests**: Measure optimization speed impact
4. **Quality Tests**: Compare lineups with/without Stack+ synergy
5. **Historical Backtesting**: Validate against past contest results

## Key Constraints

- **NO modification of individual player projections**
- **Apply only to team synergy/correlation effects**
- **Preserve existing correlation baselines**
- **Maintain lineup generation speed**
- **Ensure backwards compatibility**

## Future Enhancements

- Machine learning to predict synergy rating changes
- Real-time synergy updates based on recent team performance
- Opponent-adjusted synergy ratings
- Meta-game considerations for team coordination
- Player role synergy within team stacks