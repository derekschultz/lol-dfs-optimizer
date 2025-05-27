import React, { useState } from 'react';
import AdvancedOptimizer from '../lib/AdvancedOptimizer';

const PerformanceTest = ({ playerProjections, teamStacks }) => {
  const [results, setResults] = useState(null);
  const [isRunning, setIsRunning] = useState(false);
  const [currentTest, setCurrentTest] = useState('');
  const [debugMode, setDebugMode] = useState(false);

  const analyzeConstraints = () => {
    if (!playerProjections || playerProjections.length === 0) {
      return { error: 'No player data loaded' };
    }

    // Analyze player pool
    const positionCounts = {};
    const teamCounts = {};
    const salaryCounts = { under4k: 0, '4k-6k': 0, over6k: 0 };
    
    playerProjections.forEach(player => {
      // Count by position
      positionCounts[player.position] = (positionCounts[player.position] || 0) + 1;
      
      // Count by team
      teamCounts[player.team] = (teamCounts[player.team] || 0) + 1;
      
      // Count by salary range
      const salary = parseFloat(player.salary) || 0;
      if (salary < 4000) salaryCounts.under4k++;
      else if (salary <= 6000) salaryCounts['4k-6k']++;
      else salaryCounts.over6k++;
    });

    // Check minimum requirements
    const missingPositions = [];
    const requiredPositions = ['TOP', 'JNG', 'MID', 'ADC', 'SUP'];
    
    requiredPositions.forEach(pos => {
      if (!positionCounts[pos] || positionCounts[pos] < 2) {
        missingPositions.push(`${pos} (${positionCounts[pos] || 0} available, need at least 2)`);
      }
    });

    // Check team distribution for stacking
    const teamsWithEnoughPlayers = Object.entries(teamCounts)
      .filter(([team, count]) => count >= 4)
      .map(([team, count]) => `${team} (${count} players)`);

    // Calculate minimum possible salary
    const sortedBySalary = [...playerProjections].sort((a, b) => 
      (parseFloat(a.salary) || 0) - (parseFloat(b.salary) || 0)
    );
    
    let minLineupSalary = 0;
    const cheapestByPos = {};
    
    requiredPositions.forEach(pos => {
      const posPlayers = sortedBySalary.filter(p => p.position === pos);
      if (posPlayers.length > 0) {
        cheapestByPos[pos] = parseFloat(posPlayers[0].salary) || 0;
        minLineupSalary += cheapestByPos[pos];
      }
    });
    
    // Add captain (1.5x cheapest player)
    const cheapestPlayer = sortedBySalary[0];
    if (cheapestPlayer) {
      minLineupSalary += (parseFloat(cheapestPlayer.salary) || 0) * 1.5;
    }

    return {
      playerCount: playerProjections.length,
      positionCounts,
      teamCounts,
      salaryCounts,
      missingPositions,
      teamsWithEnoughPlayers,
      minLineupSalary,
      salaryCap: 50000,
      salaryCapSufficient: minLineupSalary <= 50000,
      canBuildLineups: missingPositions.length === 0 && teamsWithEnoughPlayers.length >= 2
    };
  };

  const runPerformanceTest = async () => {
    if (!playerProjections || playerProjections.length === 0) {
      alert('Please upload player data first!');
      return;
    }

    // Check data validation before starting
    const validation = analyzeConstraints();
    console.log('Data validation results:', validation);
    
    if (validation.error) {
      alert(validation.error);
      return;
    }
    
    if (!validation.canBuildLineups) {
      alert(`Cannot build lineups: Missing positions: ${validation.missingPositions.join(', ')}, Teams with enough players: ${validation.teamsWithEnoughPlayers.length}`);
      return;
    }

    setIsRunning(true);
    setResults(null);
    
    const testResults = {
      timestamp: new Date().toISOString(),
      tests: []
    };

    // Test different lineup counts
    const testCases = [10, 50, 100];
    
    for (const lineupCount of testCases) {
      setCurrentTest(`Testing ${lineupCount} lineups...`);
      
      try {
        // Create fresh optimizer instance
        const optimizer = new AdvancedOptimizer({
          salaryCap: 50000,
          fieldSize: 1000,
          iterations: 10000,
          debugMode: debugMode,
          verboseDebug: debugMode
        });
        
        // Initialize with current data
        await optimizer.initialize(playerProjections, teamStacks || []);
        
        // Log optimizer state
        console.log(`Optimizer initialized with ${playerProjections.length} players and ${teamStacks?.length || 0} team stacks`);
        
        // Measure performance
        console.log(`Starting test for ${lineupCount} lineups...`);
        const startTime = performance.now();
        const result = await optimizer.runSimulation(lineupCount);
        const endTime = performance.now();
        const duration = endTime - startTime;
        
        // Extract lineups from the result object
        const lineups = result?.lineups || [];
        console.log(`Completed ${lineupCount} lineups in ${duration}ms, actual lineups generated: ${lineups.length}`);
        
        // Log lineup details if no lineups were generated
        if (lineups.length === 0) {
          console.error('No lineups generated. Check optimizer constraints and player pool.');
        }
        
        const actualLineups = lineups.length;
        
        // Log detailed results
        if (actualLineups === 0) {
          console.warn(`WARNING: Generated 0 lineups for ${lineupCount} requested. Check optimizer constraints.`);
        }
        
        testResults.tests.push({
          lineupCount,
          actualLineups,
          duration: Math.round(duration),
          avgPerLineup: actualLineups > 0 ? (duration / actualLineups).toFixed(1) : 0,
          lineupsPerSecond: actualLineups > 0 ? (actualLineups / (duration / 1000)).toFixed(1) : '0'
        });
        
      } catch (error) {
        console.error(`Test failed for ${lineupCount} lineups:`, error);
        testResults.tests.push({
          lineupCount,
          error: error.message
        });
      }
    }
    
    setResults(testResults);
    setIsRunning(false);
    setCurrentTest('');
    
    // Log to console for easy copying
    console.log('Performance Test Results:', testResults);
  };

  const constraints = analyzeConstraints();

  return (
    <div className="performance-test-container" style={{ padding: '20px' }}>
      <h2>Optimizer Performance Test</h2>
      
      <div style={{ marginBottom: '20px' }}>
        <p>Test the optimizer's speed with different lineup counts.</p>
        <p>Players loaded: {playerProjections?.length || 0}</p>
        <p>Teams loaded: {teamStacks?.length || 0}</p>
      </div>
      
      {/* Constraint Analysis */}
      <div style={{ 
        marginBottom: '20px', 
        padding: '15px', 
        backgroundColor: constraints.canBuildLineups ? 'rgba(76, 175, 80, 0.1)' : 'rgba(244, 67, 54, 0.1)',
        borderRadius: '5px',
        border: `1px solid ${constraints.canBuildLineups ? '#4caf50' : '#f44336'}`
      }}>
        <h3>Constraint Analysis</h3>
        
        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '20px' }}>
          <div>
            <h4>Position Distribution:</h4>
            {Object.entries(constraints.positionCounts || {}).map(([pos, count]) => (
              <div key={pos} style={{ color: count < 2 ? 'red' : 'inherit' }}>
                {pos}: {count} players {count < 2 && '⚠️ Need at least 2'}
              </div>
            ))}
          </div>
          
          <div>
            <h4>Team Distribution (need 4+ for stacking):</h4>
            {Object.entries(constraints.teamCounts || {})
              .sort((a, b) => b[1] - a[1])
              .map(([team, count]) => (
                <div key={team} style={{ color: count >= 4 ? 'green' : 'orange' }}>
                  {team}: {count} players {count >= 4 ? '✓' : '⚠️'}
                </div>
              ))}
          </div>
        </div>
        
        <div style={{ marginTop: '10px' }}>
          <p><strong>Minimum possible lineup salary:</strong> ${constraints.minLineupSalary?.toFixed(0) || 'N/A'}</p>
          <p><strong>Salary cap:</strong> $50,000 {constraints.salaryCapSufficient ? '✓' : '✗'}</p>
          <p><strong>Can build lineups:</strong> {constraints.canBuildLineups ? 'Yes ✓' : 'No ✗'}</p>
          
          {constraints.missingPositions?.length > 0 && (
            <p style={{ color: 'red' }}>
              <strong>Missing positions:</strong> {constraints.missingPositions.join(', ')}
            </p>
          )}
          
          {constraints.teamsWithEnoughPlayers?.length < 2 && (
            <p style={{ color: 'red' }}>
              <strong>Not enough teams for stacking:</strong> Need at least 2 teams with 4+ players
            </p>
          )}
        </div>
      </div>
      
      <div style={{ marginBottom: '10px' }}>
        <label>
          <input 
            type="checkbox" 
            checked={debugMode} 
            onChange={(e) => setDebugMode(e.target.checked)}
            style={{ marginRight: '5px' }}
          />
          Enable Debug Mode (shows detailed logs in console)
        </label>
      </div>
      
      <button 
        onClick={runPerformanceTest}
        disabled={isRunning || !playerProjections || playerProjections.length === 0}
        className="btn btn-primary"
        style={{
          padding: '10px 20px',
          fontSize: '16px',
          backgroundColor: isRunning ? '#666' : '#007bff',
          color: 'white',
          border: 'none',
          borderRadius: '5px',
          cursor: isRunning ? 'not-allowed' : 'pointer'
        }}
      >
        {isRunning ? `Running... ${currentTest}` : 'Run Performance Test'}
      </button>
      
      {results && (
        <div style={{ marginTop: '30px' }}>
          <h3>Test Results</h3>
          <table style={{ width: '100%', borderCollapse: 'collapse' }}>
            <thead>
              <tr style={{ borderBottom: '2px solid #ddd' }}>
                <th style={{ padding: '10px', textAlign: 'left' }}>Lineups</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Time (ms)</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>ms/Lineup</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Lineups/sec</th>
                <th style={{ padding: '10px', textAlign: 'left' }}>Status</th>
              </tr>
            </thead>
            <tbody>
              {results.tests.map((test, idx) => (
                <tr key={idx} style={{ borderBottom: '1px solid #eee' }}>
                  <td style={{ padding: '10px' }}>{test.lineupCount}</td>
                  <td style={{ padding: '10px' }}>{test.error ? '-' : test.duration}</td>
                  <td style={{ padding: '10px' }}>{test.error ? '-' : test.avgPerLineup}</td>
                  <td style={{ padding: '10px' }}>{test.error ? '-' : test.lineupsPerSecond}</td>
                  <td style={{ padding: '10px', color: test.error ? 'red' : 'green' }}>
                    {test.error ? `Error: ${test.error}` : 'Success'}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          
          <div style={{ marginTop: '20px', padding: '10px', backgroundColor: 'rgba(255, 255, 255, 0.05)', borderRadius: '5px' }}>
            <h4>Summary</h4>
            {results.tests.filter(t => !t.error).length > 0 && (
              <>
                <p>Average performance: {
                  (results.tests
                    .filter(t => !t.error)
                    .reduce((sum, t) => sum + parseFloat(t.avgPerLineup), 0) / 
                   results.tests.filter(t => !t.error).length).toFixed(1)
                } ms per lineup</p>
                <p>Total lineups generated: {
                  results.tests
                    .filter(t => !t.error)
                    .reduce((sum, t) => sum + t.actualLineups, 0)
                }</p>
              </>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default PerformanceTest;