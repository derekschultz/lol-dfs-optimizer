import React, { useState, useEffect, useRef } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, LineChart, Line } from 'recharts';
import AdvancedOptimizer from '../lib/AdvancedOptimizer'; // Import the optimizer

// Helper function to safely format numeric values that might be strings
const formatNumber = (value, decimals = 2) => {
  // If it's already a string, try to parse it
  if (typeof value === 'string') {
    // Try to parse and format, but fall back to the original string if it fails
    try {
      return parseFloat(value).toFixed(decimals);
    } catch (e) {
      return value; // Return original string if parsing fails
    }
  }

  // If it's a number, format it
  if (typeof value === 'number') {
    return value.toFixed(decimals);
  }

  // Fall back to 0 if the value is undefined or null
  return (0).toFixed(decimals);
};

/**
 * AdvancedOptimizerUI component implements a SaberSim-like interface
 * for the League of Legends DFS optimizer
 */
const AdvancedOptimizerUI = ({
  API_BASE_URL,
  playerData,
  lineups,
  exposureSettings,
  onUpdateExposures,
  onGenerateLineups
}) => {
  // State variables
  const [isLoading, setIsLoading] = useState(false);
  const [optimizerReady, setOptimizerReady] = useState(false);
  const [optimizerSettings, setOptimizerSettings] = useState({
    iterations: 10000,
    randomness: 0.15, // Reduced from 0.3 to favor projections more
    targetTop: 0.2,
    leverageMultiplier: 0.7, // Reduced from 1.0 to reduce ownership leverage
    simCount: 10
  });
  const [optimizationResults, setOptimizationResults] = useState(null);
  const [activeTab, setActiveTab] = useState('settings');
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [optimizerInstance, setOptimizerInstance] = useState(null);
  const [slateInfo, setSlateInfo] = useState({
    title: 'Current LoL Slate',
    totalPlayers: playerData.length,
    avgSalary: playerData.length > 0
      ? Math.round(playerData.reduce((sum, p) => sum + (p.salary || 0), 0) / playerData.length)
      : 0,
    avgProjection: playerData.length > 0
      ? (playerData.reduce((sum, p) => sum + (p.projectedPoints || 0), 0) / playerData.length).toFixed(1)
      : 0,
    topTeams: []
  });

  // Create a ref for the optimizer
  const optimizerRef = useRef(null);

  // Initialize the optimizer when component mounts
  useEffect(() => {
    if (playerData.length > 0 && !optimizerInstance) {
      initializeOptimizer();
    }
  }, [playerData]);

  // Calculate slate info when player data changes
  useEffect(() => {
    if (playerData.length > 0) {
      // Calculate top teams by projected points
      const teams = {};
      playerData.forEach(player => {
        if (player.team) {
          if (!teams[player.team]) {
            teams[player.team] = { name: player.team, totalProjection: 0, count: 0 };
          }
          teams[player.team].totalProjection += (player.projectedPoints || 0);
          teams[player.team].count++;
        }
      });

      // Convert to array and sort by projection
      const topTeams = Object.values(teams)
        .map(team => ({
          ...team,
          avgProjection: team.count > 0 ? team.totalProjection / team.count : 0
        }))
        .sort((a, b) => b.totalProjection - a.totalProjection)
        .slice(0, 5);

      setSlateInfo({
        title: 'Current LoL Slate',
        totalPlayers: playerData.length,
        avgSalary: Math.round(playerData.reduce((sum, p) => sum + (p.salary || 0), 0) / playerData.length),
        avgProjection: (playerData.reduce((sum, p) => sum + (p.projectedPoints || 0), 0) / playerData.length).toFixed(1),
        topTeams
      });
    }
  }, [playerData]);

  /**
   * Initialize the advanced optimizer with better error handling
   */
  const initializeOptimizer = async () => {
    try {
      setIsLoading(true);

      console.log("Creating new optimizer instance...");
      // Make sure we clear any previous instance first
      optimizerRef.current = null;

      // Updated optimizer settings to favor higher projections
      const optimizer = new AdvancedOptimizer({
        iterations: optimizerSettings.iterations,
        randomness: optimizerSettings.randomness, // 0.15 now
        targetTop: optimizerSettings.targetTop,
        leverageMultiplier: optimizerSettings.leverageMultiplier, // 0.7 now
        // Add custom correlation settings to improve lineup quality
        correlation: {
          sameTeam: 0.7,            // Increased correlation for same team
          opposingTeam: -0.15,      // Same negative correlation
          sameTeamSamePosition: 0.2, // Same as before
          captain: 0.9              // Increased captain correlation
        }
      });

      // Store in ref for persistence
      optimizerRef.current = optimizer;
      setOptimizerInstance(optimizer);

      // Add delay to ensure the optimizer instance is set
      await new Promise(resolve => setTimeout(resolve, 100));

      console.log("Initializing optimizer with:", {
        playerCount: playerData.length,
        lineupsCount: lineups.length,
        hasExposureSettings: !!exposureSettings
      });

      if (!playerData || playerData.length === 0) {
        throw new Error("No player data available. Please upload player projections first.");
      }

      // Log first player for debugging
      if (playerData.length > 0) {
        console.log("Sample player data:", {
          name: playerData[0].name,
          position: playerData[0].position,
          points: playerData[0].projectedPoints
        });
      }

      const initResult = await optimizer.initialize(playerData, exposureSettings, lineups);

      // Check if initialization was successful
      if (!initResult) {
        throw new Error("Optimizer initialization failed. Please check console for details.");
      }

      setOptimizerReady(true);
    } catch (error) {
      console.error("Error initializing optimizer:", error);
      alert("Error initializing optimizer: " + error.message);
      setOptimizerReady(false);
    } finally {
      setIsLoading(false);
    }
  };

  /**
   * Run the optimizer with better error handling and initialization checks
   */
  const runOptimizer = async () => {
    console.log("Running optimizer, ready state:", optimizerReady,
                "optimizer instance:", optimizerRef.current ? "exists" : "missing");

    // If we have player data but optimizer isn't ready, try initializing again
    if (!optimizerReady && playerData.length > 0) {
      console.log("Optimizer not ready, attempting initialization...");
      await initializeOptimizer();

      // Check if initialization succeeded
      if (!optimizerReady) {
        alert("Optimizer could not be initialized. Please check the console for errors.");
        return;
      }
    }

    if (!optimizerRef.current) {
      alert("Optimizer not initialized. Please initialize the optimizer first.");
      return;
    }

    try {
      setIsLoading(true);
      setSimulationProgress(0);

      // Check explicitly if the optimizer is ready
      if (!optimizerRef.current.optimizerReady) {
        console.log("Optimizer exists but not ready, attempting to reinitialize...");

        // Try reinitializing directly on the instance
        const initResult = await optimizerRef.current.initialize(playerData, exposureSettings, lineups);

        if (!initResult) {
          throw new Error("Failed to initialize optimizer. Please try refreshing the page.");
        }
      }

      // Progress simulation
      const interval = setInterval(() => {
        setSimulationProgress(prev => {
          const newValue = prev + (100 - prev) * 0.1;
          return Math.min(newValue, 95);
        });
      }, 500);

      // Run simulation
      const results = await optimizerRef.current.runSimulation(optimizerSettings.simCount);

      // Stop progress simulation
      clearInterval(interval);
      setSimulationProgress(100);

      // Process and store results
      setOptimizationResults(results);

      // Switch to results tab
      setActiveTab('results');

      // Delay to show 100% progress
      setTimeout(() => {
        setIsLoading(false);
        setSimulationProgress(0);
      }, 500);
    } catch (error) {
      console.error("Error running optimizer:", error);
      setIsLoading(false);
      setSimulationProgress(0);
      alert("Error running optimizer: " + error.message);
    }
  };

  /**
   * Generate lineups from optimization results
   */
  const generateLineupsFromResults = async () => {
    if (!optimizationResults) {
      alert("No optimization results available. Please run the optimizer first.");
      return;
    }

    try {
      setIsLoading(true);

      // Call the parent's function to generate lineups
      if (onGenerateLineups) {
        // Format lineups for the parent component
        const formattedLineups = optimizationResults.lineups.map(lineup => ({
          id: lineup.id,
          name: `Optimized ${formatNumber(lineup.roi)}x ROI (${lineup.projectedPoints} pts)`,
          cpt: lineup.cpt,
          players: lineup.players,
          projectedPoints: lineup.projectedPoints,
          roi: lineup.roi
        }));

        // Call the parent function
        await onGenerateLineups(formattedLineups.length, {
          exposureSettings,
          lineups: formattedLineups
        });

        setIsLoading(false);

        // Show success message
        alert(`Generated ${formattedLineups.length} optimized lineups!`);
      } else {
        alert('Lineup generation function not available');
        setIsLoading(false);
      }
    } catch (error) {
      console.error("Error generating lineups:", error);
      setIsLoading(false);
      alert("Error generating lineups: " + error.message);
    }
  };

  /**
   * Update optimizer settings
   */
  const updateOptimizerSettings = (key, value) => {
    setOptimizerSettings(prev => ({
      ...prev,
      [key]: value
    }));
  };

  /**
   * Format a number as a percentage
   */
  const formatPercent = (value) => {
    return `${value}%`;
  };

  /**
   * Get lineup performance data for charts
   */
  const getLineupPerformanceData = () => {
    if (!optimizationResults) return [];

    return optimizationResults.lineups.map((lineup, index) => ({
      name: `L${index + 1}`,
      roi: lineup.roi,
      firstPlace: lineup.firstPlace,
      top10: lineup.top10,
      cashRate: lineup.cashRate,
      projectedPoints: lineup.projectedPoints
    }));
  };

  return (
    <div className="advanced-optimizer">
      {/* Header */}
      <div className="card" style={{ marginBottom: '1.5rem' }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <h2 className="card-title" style={{ margin: 0 }}>Advanced Monte Carlo Optimizer</h2>

          <div>
            {optimizerReady ? (
              <span style={{ color: '#10b981', fontWeight: 'bold', marginRight: '1rem' }}>
                Optimizer Ready
              </span>
            ) : (
              <span style={{ color: '#f59e0b', fontWeight: 'bold', marginRight: '1rem' }}>
                Initializing...
              </span>
            )}

            <button
              className={`btn ${optimizerReady ? 'btn-primary' : 'btn-disabled'}`}
              onClick={runOptimizer}
              disabled={!optimizerReady || isLoading}
            >
              {isLoading ? 'Running...' : 'Run Optimizer'}
            </button>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="tabs-container">
        <ul style={{ listStyle: 'none', display: 'flex' }}>
          {['settings', 'results', 'lineup-details'].map(tab => (
            <li key={tab} style={{ marginRight: '0.5rem' }}>
              <button
                className={`tab ${activeTab === tab ? 'active' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab === 'settings' ? 'Optimizer Settings' :
                tab === 'results' ? 'Simulation Results' :
                'Lineup Details'}
              </button>
            </li>
          ))}
        </ul>
      </div>

      {/* Settings Tab */}
      {activeTab === 'settings' && (
        <div className="grid grid-cols-2" style={{ gap: '1.5rem' }}>
          {/* Settings Card */}
          <div className="card">
            <h3 style={{ color: '#4fd1c5', marginBottom: '1rem' }}>Simulation Settings</h3>

            <div className="grid grid-cols-1" style={{ gap: '1rem' }}>
              <div>
                <label className="form-label">Simulation Iterations</label>
                <input
                  type="number"
                  min="1000"
                  max="50000"
                  step="1000"
                  value={optimizerSettings.iterations}
                  onChange={(e) => updateOptimizerSettings('iterations', parseInt(e.target.value))}
                />
                <p style={{ color: '#90cdf4', fontSize: '0.875rem' }}>
                  Higher values provide more accurate results but take longer to process.
                </p>
              </div>

              <div>
                <label className="form-label">Randomness Factor (0-1)</label>
                <input
                  type="range"
                  min="0"
                  max="1"
                  step="0.05"
                  value={optimizerSettings.randomness}
                  onChange={(e) => updateOptimizerSettings('randomness', parseFloat(e.target.value))}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#90cdf4', fontSize: '0.875rem' }}>
                    Projection Heavy
                  </span>
                  <span style={{ color: '#90cdf4', fontSize: '0.875rem', textAlign: 'right' }}>
                    More Random
                  </span>
                </div>
                <p style={{ color: '#90cdf4', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                  Current value: {optimizerSettings.randomness.toFixed(2)}
                </p>
              </div>

              <div>
                <label className="form-label">Leverage Multiplier</label>
                <input
                  type="range"
                  min="0"
                  max="2"
                  step="0.1"
                  value={optimizerSettings.leverageMultiplier}
                  onChange={(e) => updateOptimizerSettings('leverageMultiplier', parseFloat(e.target.value))}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#90cdf4', fontSize: '0.875rem' }}>
                    Ignore Ownership
                  </span>
                  <span style={{ color: '#90cdf4', fontSize: '0.875rem', textAlign: 'right' }}>
                    Max Leverage
                  </span>
                </div>
                <p style={{ color: '#90cdf4', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                  Current value: {optimizerSettings.leverageMultiplier.toFixed(1)}
                </p>
              </div>

              <div>
                <label className="form-label">Target Top Percentile</label>
                <input
                  type="range"
                  min="0.01"
                  max="0.5"
                  step="0.01"
                  value={optimizerSettings.targetTop}
                  onChange={(e) => updateOptimizerSettings('targetTop', parseFloat(e.target.value))}
                />
                <div style={{ display: 'flex', justifyContent: 'space-between' }}>
                  <span style={{ color: '#90cdf4', fontSize: '0.875rem' }}>
                    Top 1%
                  </span>
                  <span style={{ color: '#90cdf4', fontSize: '0.875rem', textAlign: 'right' }}>
                    Top 50%
                  </span>
                </div>
                <p style={{ color: '#90cdf4', fontSize: '0.875rem', marginTop: '0.5rem' }}>
                  Current value: Top {(optimizerSettings.targetTop * 100).toFixed(0)}%
                </p>
              </div>

              <div>
                <label className="form-label">Lineups to Generate</label>
                <input
                  type="number"
                  min="1"
                  max="150"
                  value={optimizerSettings.simCount}
                  onChange={(e) => updateOptimizerSettings('simCount', parseInt(e.target.value))}
                />
                <p style={{ color: '#90cdf4', fontSize: '0.875rem' }}>
                  Number of optimized lineups to create.
                </p>
              </div>

              <div style={{ marginTop: '1rem' }}>
                <button
                  className="btn btn-primary"
                  onClick={initializeOptimizer}
                  disabled={isLoading}
                >
                  {optimizerReady ? 'Reinitialize Optimizer' : 'Initialize Optimizer'}
                </button>
              </div>
            </div>
          </div>

          {/* Slate Info Card */}
          <div className="card">
            <h3 style={{ color: '#4fd1c5', marginBottom: '1rem' }}>{slateInfo.title}</h3>

            <div className="grid grid-cols-2" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="stat-card">
                <h4 style={{ color: '#90cdf4' }}>Total Players</h4>
                <p className="stat-value">{slateInfo.totalPlayers}</p>
              </div>

              <div className="stat-card">
                <h4 style={{ color: '#90cdf4' }}>Average Salary</h4>
                <p className="stat-value">${slateInfo.avgSalary.toLocaleString()}</p>
              </div>

              <div className="stat-card">
                <h4 style={{ color: '#90cdf4' }}>Avg Projection</h4>
                <p className="stat-value">{slateInfo.avgProjection}</p>
              </div>

              <div className="stat-card">
                <h4 style={{ color: '#90cdf4' }}>Uploaded Lineups</h4>
                <p className="stat-value">{lineups.length}</p>
              </div>
            </div>

            <h4 style={{ color: '#4fd1c5', marginBottom: '0.5rem' }}>Top Teams by Projection</h4>
            <div className="table-container" style={{ maxHeight: '200px', overflow: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Team</th>
                    <th>Total Projection</th>
                    <th>Avg Per Player</th>
                  </tr>
                </thead>
                <tbody>
                  {slateInfo.topTeams.map(team => (
                    <tr key={team.name}>
                      <td>{team.name}</td>
                      <td style={{ color: '#10b981' }}>{team.totalProjection.toFixed(1)}</td>
                      <td>{team.avgProjection.toFixed(1)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div style={{ marginTop: '1.5rem' }}>
              <h4 style={{ color: '#4fd1c5', marginBottom: '0.5rem' }}>About This Optimizer</h4>
              <p style={{ color: '#90cdf4', fontSize: '0.875rem' }}>
                This optimizer uses advanced Monte Carlo simulation to generate lineups with the highest ROI potential.
                It considers player correlations, ownership leverage, and simulates thousands of potential outcomes
                to find the best lineups for tournaments.
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Results Tab with Team Stack Visualization */}
      {activeTab === 'results' && optimizationResults && (
        <div className="grid grid-cols-1" style={{ gap: '1.5rem' }}>
          {/* Results Overview */}
          <div className="card">
            <h3 style={{ color: '#4fd1c5', marginBottom: '1rem' }}>Simulation Results</h3>

            <div className="grid grid-cols-3" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
              <div className="stat-card">
                <h4 style={{ color: '#90cdf4' }}>Top Lineup ROI</h4>
                <p className="stat-value" style={{ color: '#10b981' }}>
                  {formatNumber(optimizationResults.lineups[0]?.roi)}x
                </p>
              </div>

              <div className="stat-card">
                <h4 style={{ color: '#90cdf4' }}>First Place %</h4>
                <p className="stat-value" style={{ color: '#8b5cf6' }}>
                  {formatNumber(optimizationResults.lineups[0]?.firstPlace, 1)}%
                </p>
              </div>

              <div className="stat-card">
                <h4 style={{ color: '#90cdf4' }}>Projected Points</h4>
                <p className="stat-value" style={{ color: '#f59e0b' }}>
                  {optimizationResults.lineups[0]?.projectedPoints}
                </p>
              </div>
            </div>

            <div className="chart-container" style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={getLineupPerformanceData()}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a4365" />
                  <XAxis dataKey="name" stroke="#90cdf4" />
                  <YAxis yAxisId="left" orientation="left" stroke="#10b981" />
                  <YAxis yAxisId="right" orientation="right" stroke="#8b5cf6" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a365d', border: '1px solid #2c5282', color: 'white' }}
                  />
                  <Legend />
                  <Bar yAxisId="left" dataKey="roi" name="ROI" fill="#10b981" />
                  <Bar yAxisId="right" dataKey="firstPlace" name="1st %" fill="#8b5cf6" />
                </BarChart>
              </ResponsiveContainer>
            </div>

            <div style={{ display: 'flex', justifyContent: 'flex-end', marginTop: '1rem' }}>
              <button
                className="btn btn-primary"
                onClick={generateLineupsFromResults}
                disabled={isLoading}
              >
                Import These Lineups
              </button>
            </div>
          </div>

          {/* Compact Lineups Table with Stack Information */}
          <div className="card">
            <h3 style={{ color: '#4fd1c5', marginBottom: '1rem' }}>Optimized Lineups</h3>

            <div className="table-container" style={{ maxHeight: '400px', overflow: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Rank</th>
                    <th>ROI</th>
                    <th>First %</th>
                    <th>Proj</th>
                    <th>Stack</th>
                    <th>Lineup</th>
                  </tr>
                </thead>
                <tbody>
                  {optimizationResults.lineups.map((lineup, index) => {
                    // Count players per team for stack info
                    const teamCounts = {};
                    [lineup.cpt.team, ...lineup.players.map(p => p.team)].forEach(team => {
                      teamCounts[team] = (teamCounts[team] || 0) + 1;
                    });

                    // Format stack info
                    const stackInfo = Object.entries(teamCounts)
                      .sort((a, b) => b[1] - a[1])
                      .map(([team, count]) => `${count} (${team})`)
                      .join(' - ');

                    // Get players by position
                    const playersByPos = {
                      CPT: lineup.cpt,
                      TOP: lineup.players.find(p => p.position === 'TOP'),
                      JNG: lineup.players.find(p => p.position === 'JNG'),
                      MID: lineup.players.find(p => p.position === 'MID'),
                      ADC: lineup.players.find(p => p.position === 'ADC'),
                      SUP: lineup.players.find(p => p.position === 'SUP'),
                      TEAM: lineup.players.find(p => p.position === 'TEAM')
                    };

                    // Create color map for teams to visually identify stacks
                    const teams = Object.keys(teamCounts);
                    const teamColors = {
                      [teams[0]]: '#10b981', // Main team - teal color
                      [teams[1]]: '#8b5cf6', // Secondary team - purple color
                      [teams[2]]: '#f59e0b', // Third team - amber color
                      [teams[3]]: '#60a5fa', // Fourth team - blue color
                      [teams[4]]: '#ef4444'  // Fifth team - red color
                    };

                    return (
                      <tr key={lineup.id}>
                        <td>{index + 1}</td>
                        <td style={{ fontWeight: 'bold', color: '#10b981' }}>{formatNumber(lineup.roi)}x</td>
                        <td style={{ color: '#8b5cf6' }}>{formatNumber(lineup.firstPlace, 1)}%</td>
                        <td style={{ color: '#f59e0b' }}>{formatNumber(lineup.projectedPoints, 1)}</td>
                        <td>
                          {/* Stack information */}
                          <div style={{
                            fontWeight: 'bold',
                            color: '#8b5cf6',
                            whiteSpace: 'nowrap'
                          }}>
                            {stackInfo}
                          </div>
                        </td>
                        <td>
                          {/* Compact lineup display with team-colored chips */}
                          <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.25rem' }}>
                            {/* CPT */}
                            <div style={{
                              backgroundColor: `${teamColors[playersByPos.CPT.team]}22`, // 22 is hex for 13% opacity
                              border: `1px solid ${teamColors[playersByPos.CPT.team]}`,
                              color: teamColors[playersByPos.CPT.team],
                              borderRadius: '0.25rem',
                              padding: '0.1rem 0.3rem',
                              fontSize: '0.75rem',
                              fontWeight: 'bold',
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center'
                            }}>
                              CPT: {playersByPos.CPT.name}
                            </div>

                            {/* TOP */}
                            {playersByPos.TOP && (
                              <div style={{
                                backgroundColor: `${teamColors[playersByPos.TOP.team]}22`,
                                border: `1px solid ${teamColors[playersByPos.TOP.team]}`,
                                color: teamColors[playersByPos.TOP.team],
                                borderRadius: '0.25rem',
                                padding: '0.1rem 0.3rem',
                                fontSize: '0.75rem',
                                fontWeight: 'bold'
                              }}>
                                TOP: {playersByPos.TOP.name}
                              </div>
                            )}

                            {/* JNG */}
                            {playersByPos.JNG && (
                              <div style={{
                                backgroundColor: `${teamColors[playersByPos.JNG.team]}22`,
                                border: `1px solid ${teamColors[playersByPos.JNG.team]}`,
                                color: teamColors[playersByPos.JNG.team],
                                borderRadius: '0.25rem',
                                padding: '0.1rem 0.3rem',
                                fontSize: '0.75rem',
                                fontWeight: 'bold'
                              }}>
                                JNG: {playersByPos.JNG.name}
                              </div>
                            )}

                            {/* MID */}
                            {playersByPos.MID && (
                              <div style={{
                                backgroundColor: `${teamColors[playersByPos.MID.team]}22`,
                                border: `1px solid ${teamColors[playersByPos.MID.team]}`,
                                color: teamColors[playersByPos.MID.team],
                                borderRadius: '0.25rem',
                                padding: '0.1rem 0.3rem',
                                fontSize: '0.75rem',
                                fontWeight: 'bold'
                              }}>
                                MID: {playersByPos.MID.name}
                              </div>
                            )}

                            {/* ADC */}
                            {playersByPos.ADC && (
                              <div style={{
                                backgroundColor: `${teamColors[playersByPos.ADC.team]}22`,
                                border: `1px solid ${teamColors[playersByPos.ADC.team]}`,
                                color: teamColors[playersByPos.ADC.team],
                                borderRadius: '0.25rem',
                                padding: '0.1rem 0.3rem',
                                fontSize: '0.75rem',
                                fontWeight: 'bold'
                              }}>
                                ADC: {playersByPos.ADC.name}
                              </div>
                            )}

                            {/* SUP */}
                            {playersByPos.SUP && (
                              <div style={{
                                backgroundColor: `${teamColors[playersByPos.SUP.team]}22`,
                                border: `1px solid ${teamColors[playersByPos.SUP.team]}`,
                                color: teamColors[playersByPos.SUP.team],
                                borderRadius: '0.25rem',
                                padding: '0.1rem 0.3rem',
                                fontSize: '0.75rem',
                                fontWeight: 'bold'
                              }}>
                                SUP: {playersByPos.SUP.name}
                              </div>
                            )}

                            {/* TEAM */}
                            {playersByPos.TEAM && (
                            <div style={{
                                backgroundColor: `${teamColors[playersByPos.TEAM.team]}22`,
                                border: `1px solid ${teamColors[playersByPos.TEAM.team]}`,
                                color: teamColors[playersByPos.TEAM.team],
                                borderRadius: '0.25rem',
                                padding: '0.1rem 0.3rem',
                                fontSize: '0.75rem',
                                fontWeight: 'bold'
                            }}>
                                TEAM: {playersByPos.TEAM.name}
                            </div>
                            )}
                          </div>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Lineup Details Tab */}
      {activeTab === 'lineup-details' && optimizationResults && (
        <div className="grid grid-cols-1" style={{ gap: '1.5rem' }}>
          {/* Score Distribution Chart */}
          <div className="card">
            <h3 style={{ color: '#4fd1c5', marginBottom: '1rem' }}>Score Distributions</h3>

            <div className="chart-container" style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={optimizationResults.lineups.slice(0, 5).map((lineup, index) => ({
                  name: `L${index + 1}`,
                  min: lineup.min,
                  p10: lineup.p10,
                  p25: lineup.p25,
                  median: lineup.median,
                  p75: lineup.p75,
                  p90: lineup.p90,
                  max: lineup.max
                }))}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#2a4365" />
                  <XAxis dataKey="name" stroke="#90cdf4" />
                  <YAxis stroke="#90cdf4" />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#1a365d', border: '1px solid #2c5282', color: 'white' }}
                  />
                  <Legend />
                  <Line type="monotone" dataKey="p10" stroke="#f56565" name="10th Percentile" />
                  <Line type="monotone" dataKey="p25" stroke="#ed8936" name="25th Percentile" />
                  <Line type="monotone" dataKey="median" stroke="#3b82f6" name="Median" strokeWidth={2} />
                  <Line type="monotone" dataKey="p75" stroke="#10b981" name="75th Percentile" />
                  <Line type="monotone" dataKey="p90" stroke="#8b5cf6" name="90th Percentile" />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </div>

          {/* Player Exposures */}
          <div className="card">
            <h3 style={{ color: '#4fd1c5', marginBottom: '1rem' }}>Player Exposures in Optimized Lineups</h3>

            <div className="table-container" style={{ maxHeight: '400px', overflow: 'auto' }}>
              <table>
                <thead>
                  <tr>
                    <th>Player</th>
                    <th>Position</th>
                    <th>Team</th>
                    <th>Exposure</th>
                  </tr>
                </thead>
                <tbody>
                  {optimizationResults.summary.playerExposures
                    .filter(player => player.exposure > 0)
                    .slice(0, 30)
                    .map(player => (
                      <tr key={player.id}>
                        <td>{player.name}</td>
                        <td style={{ color: '#4fd1c5' }}>{player.position}</td>
                        <td>{player.team}</td>
                        <td style={{ fontWeight: 'bold', color: '#10b981' }}>{player.exposure}%</td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      )}

      {/* Loading overlay */}
      {isLoading && (
        <div className="loading-overlay">
          <div className="loading-card">
            <h3 className="loading-title">Running Advanced Simulation</h3>
            <div className="loading-progress">
              <div
                className="loading-bar"
                style={{ width: `${simulationProgress}%` }}
              ></div>
            </div>
            <p className="loading-text">
              {simulationProgress < 100
                ? `Processing simulation iterations (${Math.round(simulationProgress)}%)`
                : 'Finalizing results...'}
            </p>
          </div>
        </div>
      )}
    </div>
  );
};

export default AdvancedOptimizerUI;