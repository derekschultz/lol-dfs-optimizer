#!/usr/bin/env node

/**
 * Edge Case Testing for Stack Exposure System
 * Tests various edge cases and scenarios for the stack exposure tracking and targeting system
 */

const AdvancedOptimizer = require('./client/src/lib/AdvancedOptimizer');

// Mock player data for testing - match real data format
const generateMockPlayerData = (teams = ['KT', 'T1', 'GEN', 'HLE']) => {
  const positions = ['TOP', 'JNG', 'MID', 'ADC', 'SUP', 'TEAM'];
  const players = [];
  
  teams.forEach(team => {
    positions.forEach(position => {
      // Generate 2-3 players per position per team to ensure diversity
      const playerCount = position === 'TEAM' ? 1 : 3;
      for (let i = 1; i <= playerCount; i++) {
        players.push({
          id: `${team}_${position}_${i}`,
          name: `${team} ${position} ${i}`,
          position: position,
          team: team,
          salary: Math.floor(Math.random() * 1000) + 6000, // 6000-7000 (fits 50k salary cap)
          projectedPoints: Math.random() * 20 + 40, // 40-60 points (more realistic)
          ownership: 0
        });
      }
    });
  });
  
  console.log(`Generated ${players.length} mock players for teams: ${teams.join(', ')}`);
  return players;
};

// Generate basic team stacks for testing - match real format
const generateMockTeamStacks = (teams = ['KT', 'T1', 'GEN', 'HLE']) => {
  const stacks = [];
  teams.forEach(team => {
    stacks.push({
      team: team,
      stackSize: 3,
      weight: 1
    });
  });
  return stacks;
};

// Test case generator
const createTestCase = (name, description, exposureSettings, expectedBehavior) => ({
  name,
  description,
  exposureSettings,
  expectedBehavior,
  results: null
});

// Edge case test scenarios
const testCases = [
  createTestCase(
    "Multiple Team Targets",
    "Multiple teams with different target exposures",
    {
      teams: [
        { team: 'KT', target: 27, min: 0, max: 100 },
        { team: 'T1', target: 20, min: 0, max: 100 },
        { team: 'GEN', target: 15, min: 0, max: 100 },
        { team: 'HLE', target: 10, min: 0, max: 100 }
      ]
    },
    "Should distribute exposure approximately: KT~27%, T1~20%, GEN~15%, HLE~10%"
  ),

  createTestCase(
    "Very High Target",
    "Single team with very high exposure target",
    {
      teams: [
        { team: 'KT', target: 80, min: 0, max: 100 }
      ]
    },
    "Should reach ~80% without breaking pattern constraints"
  ),

  createTestCase(
    "Very Low Target",
    "Single team with very low exposure target",
    {
      teams: [
        { team: 'KT', target: 5, min: 0, max: 15 }
      ]
    },
    "Should limit KT to ~5% and distribute rest among other teams"
  ),

  createTestCase(
    "Impossible Targets",
    "Multiple teams with targets that sum to >100%",
    {
      teams: [
        { team: 'KT', target: 60, min: 0, max: 100 },
        { team: 'T1', target: 50, min: 0, max: 100 },
        { team: 'GEN', target: 40, min: 0, max: 100 }
      ]
    },
    "Should gracefully handle impossible constraints, likely proportionally scaling down"
  ),

  createTestCase(
    "Min/Max Constraints",
    "Teams with strict min/max bounds",
    {
      teams: [
        { team: 'KT', target: 25, min: 20, max: 30 },
        { team: 'T1', target: 15, min: 10, max: 20 }
      ]
    },
    "Should respect both target and min/max bounds"
  ),

  createTestCase(
    "Zero Target",
    "Team with 0% target (should be avoided)",
    {
      teams: [
        { team: 'KT', target: 0, min: 0, max: 5 },
        { team: 'T1', target: 50, min: 0, max: 100 }
      ]
    },
    "Should avoid KT entirely and heavily favor T1"
  ),

  createTestCase(
    "Small Lineup Count",
    "Test with very few lineups (edge case for percentage calculation)",
    {
      teams: [
        { team: 'KT', target: 33, min: 0, max: 100 }
      ]
    },
    "Should handle rounding with small sample sizes (test with 3 lineups)"
  ),

  createTestCase(
    "Large Lineup Count", 
    "Test with many lineups for precision",
    {
      teams: [
        { team: 'KT', target: 27, min: 0, max: 100 }
      ]
    },
    "Should maintain precision over large sample size (test with 100 lineups)"
  )
];

// Run individual test case
async function runTestCase(testCase, lineupCount = 20) {
  console.log(`🧪 Testing: ${testCase.name}`);
  console.log(`📝 Description: ${testCase.description}`);
  console.log(`🎯 Expected: ${testCase.expectedBehavior}`);
  
  try {
    const optimizer = new AdvancedOptimizer({
      positions: {
        TOP: 1, JNG: 1, MID: 1, ADC: 1, SUP: 1, TEAM: 1
      },
      debugMode: false
    });

    // Generate mock data - use simpler settings for testing
    const playerData = generateMockPlayerData();
    const teamStacks = generateMockTeamStacks();
    
    // Convert test case exposure settings to optimizer format
    const optimizerSettings = {
      stackExposureTargets: {}
    };
    
    if (testCase.exposureSettings.teams) {
      testCase.exposureSettings.teams.forEach(teamConfig => {
        const teamKey = teamConfig.team;
        if (teamConfig.target !== undefined) {
          optimizerSettings.stackExposureTargets[`${teamKey}_4_target`] = teamConfig.target;
        }
        if (teamConfig.min !== undefined) {
          optimizerSettings.stackExposureTargets[`${teamKey}_4_min`] = teamConfig.min;
        }
        if (teamConfig.max !== undefined) {
          optimizerSettings.stackExposureTargets[`${teamKey}_4_max`] = teamConfig.max;
        }
      });
    }
    
    // Initialize optimizer with team stacks
    await optimizer.initialize(playerData, optimizerSettings, []);
    
    // Set team stacks in the optimizer
    optimizer.teamStacks = teamStacks;
    
    // Generate lineups
    console.log(`⚙️  Generating ${lineupCount} lineups...`);
    const startTime = Date.now();
    const result = await optimizer.runSimulation(lineupCount);
    const endTime = Date.now();
    
    if (!result || !result.lineups || result.lineups.length === 0) {
      throw new Error("No lineups generated");
    }
    
    // Analyze results
    const analysis = analyzeExposureResults(result.lineups, testCase.exposureSettings);
    
    // Store results
    testCase.results = {
      success: true,
      lineupCount: result.lineups.length,
      generationTime: endTime - startTime,
      analysis: analysis,
      timestamp: new Date().toISOString()
    };
    
    // Display results
    console.log(`✅ Generated ${result.lineups.length} lineups in ${endTime - startTime}ms`);
    displayExposureAnalysis(analysis);
    
    return testCase.results;
    
  } catch (error) {
    console.log(`❌ Test failed: ${error.message}`);
    testCase.results = {
      success: false,
      error: error.message,
      timestamp: new Date().toISOString()
    };
    return testCase.results;
  }
}

// Analyze exposure results
function analyzeExposureResults(lineups, exposureSettings) {
  const teamExposures = {};
  const totalLineups = lineups.length;
  
  // Count 4-man stack exposures for each team
  lineups.forEach(lineup => {
    const teamCounts = {};
    
    // Count captain
    if (lineup.cpt && lineup.cpt.team) {
      teamCounts[lineup.cpt.team] = (teamCounts[lineup.cpt.team] || 0) + 1;
    }
    
    // Count regular players
    if (lineup.players) {
      lineup.players.forEach(player => {
        if (player.team) {
          teamCounts[player.team] = (teamCounts[player.team] || 0) + 1;
        }
      });
    }
    
    // Track teams with 4+ players (4-man stacks)
    Object.entries(teamCounts).forEach(([team, count]) => {
      if (count >= 4) {
        teamExposures[team] = (teamExposures[team] || 0) + 1;
      }
    });
  });
  
  // Convert to percentages
  const exposurePercentages = {};
  Object.entries(teamExposures).forEach(([team, count]) => {
    exposurePercentages[team] = ((count / totalLineups) * 100).toFixed(1);
  });
  
  return {
    totalLineups,
    teamExposures,
    exposurePercentages,
    targetComparison: compareToTargets(exposurePercentages, exposureSettings)
  };
}

// Compare actual exposures to targets
function compareToTargets(actualExposures, exposureSettings) {
  const comparison = {};
  
  if (exposureSettings.teams) {
    exposureSettings.teams.forEach(teamConfig => {
      const team = teamConfig.team;
      const actual = parseFloat(actualExposures[team] || 0);
      const target = teamConfig.target || 0;
      const difference = actual - target;
      
      comparison[team] = {
        target: target,
        actual: actual,
        difference: difference,
        withinRange: Math.abs(difference) <= 5 // 5% tolerance
      };
    });
  }
  
  return comparison;
}

// Display exposure analysis
function displayExposureAnalysis(analysis) {
  console.log(`📊 Exposure Analysis (${analysis.totalLineups} lineups):`);
  
  Object.entries(analysis.exposurePercentages).forEach(([team, percentage]) => {
    const target = analysis.targetComparison[team];
    if (target) {
      const status = target.withinRange ? '✅' : '❌';
      console.log(`   ${team}: ${percentage}% (target: ${target.target}%) ${status}`);
    } else {
      console.log(`   ${team}: ${percentage}%`);
    }
  });
}

// Main test runner
async function runAllTests() {
  console.log('🚀 Starting Stack Exposure Edge Case Testing');
  console.log('============================================================\n');
  
  let passedTests = 0;
  let failedTests = 0;
  const failedTestNames = [];
  
  for (const testCase of testCases) {
    // Determine lineup count based on test case
    let lineupCount = 20;
    if (testCase.name === "Small Lineup Count") {
      lineupCount = 3;
    } else if (testCase.name === "Large Lineup Count") {
      lineupCount = 100;
    }
    
    const results = await runTestCase(testCase, lineupCount);
    
    if (results.success) {
      passedTests++;
    } else {
      failedTests++;
      failedTestNames.push(testCase.name);
    }
    
    console.log(''); // Empty line between tests
  }
  
  // Summary
  console.log('🏁 TEST SUMMARY');
  console.log('============================================================');
  console.log(`✅ Passed: ${passedTests}`);
  console.log(`❌ Failed: ${failedTests}`);
  console.log(`📊 Success Rate: ${((passedTests / testCases.length) * 100).toFixed(1)}%`);
  
  if (failedTestNames.length > 0) {
    console.log('\n❌ Failed Tests:');
    failedTestNames.forEach(name => {
      const testCase = testCases.find(t => t.name === name);
      console.log(`  - ${name}: ${testCase.results.error}`);
    });
  }
  
  return {
    passed: passedTests,
    failed: failedTests,
    total: testCases.length,
    successRate: (passedTests / testCases.length) * 100
  };
}

// Run tests if called directly
if (require.main === module) {
  runAllTests().catch(console.error);
}

module.exports = {
  runAllTests,
  runTestCase,
  testCases,
  generateMockPlayerData,
  generateMockTeamStacks
};