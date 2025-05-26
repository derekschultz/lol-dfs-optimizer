# Stack+ Rating Integration Design Document

## Overview

Stack+ is a proprietary rating system that evaluates team performance in League of Legends matches and their corresponding fantasy scoring patterns. This document outlines the integration of Stack+ ratings into the LoL DFS Optimizer to improve team stack evaluation based on match outcome scenarios.

## Core Principle

**Stack+ enhances team synergy evaluation based on match outcomes - individual player projections remain unchanged.**

Player projections already factor in individual performance. Stack+ provides additional insight into how teams perform in different match scenarios (sweeps vs competitive series), capturing the fantasy scoring patterns that emerge from different game states.

## Understanding Stack+ Ratings

### Rating Components
- **Stack+**: Overall team performance rating across all match outcomes
- **Stack+ All Wins**: Team performance when winning all games (2-0 in Bo3, 3-0 in Bo5)
- **Stack+ All Losses**: Team performance when losing all games (0-2 in Bo3, 0-3 in Bo5)

### Match Outcome Context
In League of Legends, match outcomes significantly impact fantasy scoring:
- **Sweeps (2-0, 3-0)**: Often produce higher fantasy scores due to:
  - Shorter game times leading to higher kills per minute
  - Snowball victories with stat padding
  - Clean games with bonus objectives
- **Getting Swept (0-2, 0-3)**: Typically results in very low fantasy scores
- **Competitive Series**: More balanced scoring but less upside

### Example Ratings
- **T1**: Stack+ 205.68, All Wins 211.60, All Losses 3.18
  - Elite performance when sweeping opponents
  - Minimal fantasy value when swept
- **DK**: Stack+ 12.51, All Wins 195.51, All Losses 2.70
  - Strong sweep potential despite lower base rating
  - Also collapses when swept

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

#### Match Dominance Analysis
```javascript
function getMatchDominanceFactor(stackPlusAllWins, stackPlusAllLosses) {
  // High sweep rating indicates exceptional performance when dominant
  if (stackPlusAllWins >= 200) return 1.10;  // Elite sweep teams
  if (stackPlusAllWins >= 180) return 1.07;  // Strong sweep teams
  if (stackPlusAllWins >= 150) return 1.04;  // Above average sweeps
  
  // Most teams score poorly when swept (this is normal)
  if (stackPlusAllLosses < 5) return 1.00;   // Expected pattern
  
  // Unusual: teams that maintain decent scores even when swept
  if (stackPlusAllLosses > 50) return 1.05;  // Resilient teams
  
  return 1.00;
}
```

#### Combined Team Modifier
```javascript
function getStackModifier(teamStack, contestType = null) {
  // GPP/Tournament: Emphasize sweep potential
  if (contestType === 'gpp' || contestType === 'tournament') {
    const sweepRating = teamStack.stackPlusAllWins || teamStack.stackPlus;
    const sweepModifier = getStackRatingModifier(sweepRating);
    const dominanceFactor = getMatchDominanceFactor(
      teamStack.stackPlusAllWins, 
      teamStack.stackPlusAllLosses
    );
    return sweepModifier * dominanceFactor;
  }
  
  // Cash games: Focus on consistency
  if (contestType === 'cash') {
    const baseModifier = getStackRatingModifier(teamStack.stackPlus);
    const resilienceFactor = teamStack.stackPlusAllLosses > 10 ? 1.02 : 1.00;
    return baseModifier * resilienceFactor;
  }
  
  // Default: Balanced approach
  return getStackRatingModifier(teamStack.stackPlus) * 
         getMatchDominanceFactor(teamStack.stackPlusAllWins, teamStack.stackPlusAllLosses);
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

### 3. Contest-Type Strategy

#### GPP/Tournament Mode
For tournaments, we prioritize teams with high sweep potential:
- **Focus on Stack+ All Wins rating** - Teams that dominate when winning 2-0/3-0
- **Reward match dominance** - Bonus for teams with elite sweep ratings (200+)
- **Accept volatility** - These teams may score poorly when swept, but upside matters more

Example: T1 with 211.60 All Wins rating gets maximum boost in GPPs

#### Cash Game Mode
For cash games, we prioritize consistency:
- **Use base Stack+ rating** - Overall performance across all match outcomes
- **Small resilience bonus** - Teams that don't completely collapse when swept
- **Avoid extreme volatility** - Prefer steady performers over boom/bust teams

Example: Teams with Stack+ All Losses > 10 get a small bonus for maintaining some floor

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
- **Better Match Outcome Prediction**: Favor teams likely to sweep in GPPs
- **Improved Stack Quality**: Select teams based on contest-appropriate metrics
- **Risk Management**: Avoid teams that collapse when losing
- **Strategic Edge**: Leverage match outcome patterns competitors may miss

### Key Insights from Stack+ Data
1. **Most teams score poorly when swept** - Stack+ All Losses < 5 is normal
2. **Elite teams dominate when sweeping** - Stack+ All Wins > 200 indicates exceptional sweep performance
3. **Contest type matters** - GPPs benefit from sweep upside, cash games need consistency
4. **Stack size scaling preserves balance** - 4-stacks get full effect, 2-stacks get 50%

### Metrics to Track
- Sweep rate correlation with Stack+ All Wins rating
- Fantasy scoring in 2-0 vs 2-1 vs 0-2 scenarios
- ROI improvement by contest type
- Exposure optimization based on match outcome probability

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