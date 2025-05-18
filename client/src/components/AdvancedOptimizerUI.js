import React, { useState, useEffect, useCallback, useRef } from 'react';
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
 * NexusScoreCard component to display and explain the NexusScore
 */
const NexusScoreCard = ({ score, components }) => {
  // Default values if components aren't available
  const {
    baseProjection = 0,
    leverageFactor = 1,
    avgOwnership = 0,
    fieldAvgOwnership = 0,
    stackBonus = 0,
    positionBonus = 0,
    teamStacks = ''
  } = components || {};

  // Format values for display
  const formattedLeverage = (leverageFactor * 100 - 100).toFixed(1);
  const ownershipDiff = ((fieldAvgOwnership - avgOwnership) * 100).toFixed(1);

  // Determine color based on score
  // Gradient from red (80) to yellow (120) to green (160+)
  let scoreColor = '#ef4444'; // Red for <100
  if (score >= 160) scoreColor = '#10b981'; // Green for 160+
  else if (score >= 140) scoreColor = '#22c55e'; // Light green for 140-160
  else if (score >= 120) scoreColor = '#84cc16'; // Lime for 120-140
  else if (score >= 100) scoreColor = '#eab308'; // Yellow for 100-120
  else if (score >= 80) scoreColor = '#f97316'; // Orange for 80-100

  return (
    <div className="nexus-score-card" style={{
      padding: '1rem',
      backgroundColor: 'rgba(30, 58, 138, 0.3)',
      borderRadius: '0.5rem',
      border: `1px solid ${scoreColor}`,
      position: 'relative',
      overflow: 'hidden'
    }}>
      {/* Glowing effect based on score */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: `radial-gradient(circle at center, ${scoreColor}22 0%, transparent 70%)`,
        opacity: 0.8,
        zIndex: 0
      }} />

      {/* Content */}
      <div style={{ position: 'relative', zIndex: 1 }}>
        <div className="flex-row" style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <div>
            <h3 style={{ color: '#4fd1c5', fontSize: '1.125rem', margin: '0 0 0.5rem 0' }}>NexusScore™</h3>
            <p style={{ margin: 0, color: '#90cdf4', fontSize: '0.875rem' }}>
              Comprehensive lineup strength rating
            </p>
          </div>
          <div style={{
            fontSize: '2.5rem',
            fontWeight: 'bold',
            color: scoreColor,
            textShadow: `0 0 10px ${scoreColor}44`
          }}>
            {Math.round(score)}
          </div>
        </div>

        <div style={{ marginTop: '1rem' }}>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
            <span style={{ color: '#90cdf4' }}>Base Projection</span>
            <span style={{ color: '#f7fafc' }}>{baseProjection.toFixed(1)} pts</span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
            <span style={{ color: '#90cdf4' }}>Leverage Factor</span>
            <span style={{ color: formattedLeverage > 0 ? '#10b981' : '#f56565' }}>
              {formattedLeverage > 0 ? '+' : ''}{formattedLeverage}%
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
            <span style={{ color: '#90cdf4' }}>Ownership Edge</span>
            <span style={{ color: ownershipDiff > 0 ? '#10b981' : '#f56565' }}>
              {ownershipDiff > 0 ? '+' : ''}{ownershipDiff}%
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem', marginBottom: '0.25rem' }}>
            <span style={{ color: '#90cdf4' }}>Stack Bonus</span>
            <span style={{ color: stackBonus > 0 ? '#10b981' : '#90cdf4' }}>
              {stackBonus > 0 ? '+' : ''}{stackBonus.toFixed(1)}
            </span>
          </div>

          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.875rem' }}>
            <span style={{ color: '#90cdf4' }}>Position Impact</span>
            <span style={{ color: positionBonus > 0 ? '#10b981' : '#90cdf4' }}>
              {positionBonus > 0 ? '+' : ''}{positionBonus.toFixed(1)}
            </span>
          </div>
        </div>

        {teamStacks && (
          <div style={{
            marginTop: '0.75rem',
            padding: '0.5rem',
            backgroundColor: 'rgba(42, 67, 101, 0.3)',
            borderRadius: '0.25rem',
            fontSize: '0.875rem',
            color: '#8b5cf6'
          }}>
            <strong style={{ color: '#4fd1c5' }}>Team Stacks:</strong> {teamStacks}
          </div>
        )}
      </div>
    </div>
  );
};

/**
 * NexusScoreExplainer component - educational modal about the NexusScore system
 */
const NexusScoreExplainer = ({ isOpen, onClose }) => {
  if (!isOpen) return null;

  return (
    <div className="nexus-score-explainer-modal" style={{
      position: 'fixed',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      backgroundColor: 'rgba(10, 15, 30, 0.9)',
      zIndex: 1000,
      display: 'flex',
      justifyContent: 'center',
      alignItems: 'center',
      padding: '2rem'
    }}>
      <div className="modal-content" style={{
        backgroundColor: '#1a365d',
        borderRadius: '0.5rem',
        maxWidth: '800px',
        width: '100%',
        maxHeight: '90vh',
        overflow: 'auto',
        boxShadow: '0 4px 20px rgba(0, 0, 0, 0.5)',
        border: '1px solid #2c5282',
        position: 'relative'
      }}>
        {/* Close button */}
        <button
          onClick={onClose}
          style={{
            position: 'absolute',
            top: '1rem',
            right: '1rem',
            background: 'none',
            border: 'none',
            color: '#90cdf4',
            fontSize: '1.5rem',
            cursor: 'pointer',
            zIndex: 10
          }}
        >
          ×
        </button>

        {/* Header */}
        <div style={{
          borderBottom: '1px solid #2c5282',
          padding: '1.5rem',
          background: 'linear-gradient(90deg, #1a365d 0%, #164e63 100%)'
        }}>
          <h2 style={{
            color: '#4fd1c5',
            margin: 0,
            fontSize: '1.5rem',
            display: 'flex',
            alignItems: 'center'
          }}>
            <span style={{
              backgroundColor: '#10b981',
              color: 'white',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              display: 'inline-flex',
              justifyContent: 'center',
              alignItems: 'center',
              marginRight: '0.75rem',
              fontWeight: 'bold'
            }}>N</span>
            Understanding NexusScore™
          </h2>
          <p style={{ color: '#90cdf4', margin: '0.5rem 0 0 0' }}>
            The comprehensive strength rating system for League of Legends DFS lineups
          </p>
        </div>

        {/* Content */}
        <div style={{ padding: '1.5rem' }}>
          <h3 style={{ color: '#4fd1c5', marginTop: 0 }}>What is NexusScore?</h3>
          <p style={{ color: '#e2e8f0' }}>
            NexusScore is an advanced metric that evaluates your lineup's strength beyond raw
            projected points. It incorporates game theory concepts and LoL-specific factors
            to give you a more accurate prediction of lineup performance.
          </p>

          <h3 style={{ color: '#4fd1c5' }}>Key Components</h3>

          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ color: '#8b5cf6', margin: '0.5rem 0' }}>Base Projection</h4>
            <p style={{ color: '#e2e8f0', margin: 0 }}>
              The foundation of NexusScore is your lineup's total projected points.
              This raw projection is then modified by the following factors.
            </p>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ color: '#8b5cf6', margin: '0.5rem 0' }}>Ownership Leverage</h4>
            <p style={{ color: '#e2e8f0', margin: 0 }}>
              NexusScore rewards lineups with lower projected ownership compared to their point
              potential. When you roster low-owned players who perform well, you gain leverage
              over the field.
            </p>
            <div style={{
              margin: '0.5rem 0',
              padding: '0.5rem',
              backgroundColor: 'rgba(44, 82, 130, 0.3)',
              borderRadius: '0.25rem',
              borderLeft: '3px solid #8b5cf6',
              fontSize: '0.875rem'
            }}>
              <strong style={{ color: '#8b5cf6' }}>Formula:</strong> <span style={{ color: '#e2e8f0' }}>
                NexusScore increases by up to 50% when your lineup has half the average ownership,
                and decreases by up to 50% when ownership is double the average.
              </span>
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ color: '#8b5cf6', margin: '0.5rem 0' }}>Team Stack Bonus</h4>
            <p style={{ color: '#e2e8f0', margin: 0 }}>
              In LoL DFS, team stacking is crucial since player performances correlate strongly.
              NexusScore awards bonus points for effective stacking strategies.
            </p>
            <div style={{
              margin: '0.5rem 0',
              padding: '0.5rem',
              backgroundColor: 'rgba(44, 82, 130, 0.3)',
              borderRadius: '0.25rem',
              borderLeft: '3px solid #8b5cf6',
              fontSize: '0.875rem'
            }}>
              <strong style={{ color: '#8b5cf6' }}>Bonus Scale:</strong> <br/>
              <span style={{ color: '#e2e8f0' }}>
                • 2-player stack: +1 point<br/>
                • 3-player stack: +3 points<br/>
                • 4-player stack: +8 points
              </span>
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ color: '#8b5cf6', margin: '0.5rem 0' }}>Position Impact</h4>
            <p style={{ color: '#e2e8f0', margin: 0 }}>
              Certain positions in LoL have higher ceilings and more potential for explosive
              performances. NexusScore weighs positions differently based on their typical impact.
            </p>
            <div style={{
              margin: '0.5rem 0',
              padding: '0.5rem',
              backgroundColor: 'rgba(44, 82, 130, 0.3)',
              borderRadius: '0.25rem',
              borderLeft: '3px solid #8b5cf6',
              fontSize: '0.875rem'
            }}>
              <strong style={{ color: '#8b5cf6' }}>Position Weights:</strong> <br/>
              <span style={{ color: '#e2e8f0' }}>
                • MID: 2.0x (highest ceiling)<br/>
                • ADC: 1.8x (high damage output)<br/>
                • JNG: 1.5x (game influence)<br/>
                • TOP: 1.2x (moderate impact)<br/>
                • SUP: 1.0x (utility focus)<br/>
                • TEAM: 0.8x (consistent but limited)
              </span>
            </div>
          </div>

          <div style={{ marginBottom: '1.5rem' }}>
            <h4 style={{ color: '#8b5cf6', margin: '0.5rem 0' }}>Consistency Factor</h4>
            <p style={{ color: '#e2e8f0', margin: 0 }}>
              NexusScore analyzes the projected volatility of your lineup. Some amount of
              variance is beneficial in tournaments, but extreme volatility can be risky.
            </p>
          </div>

          <h3 style={{ color: '#4fd1c5' }}>Interpreting Your Score</h3>

          <div style={{
            display: 'flex',
            margin: '1rem 0',
            backgroundColor: 'rgba(26, 54, 93, 0.5)',
            borderRadius: '0.5rem',
            padding: '1rem',
            flexWrap: 'wrap',
            gap: '1rem'
          }}>
            <div style={{ flex: '1 1 120px', textAlign: 'center', padding: '0.5rem' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#ef4444' }}>70-99</div>
              <div style={{ color: '#e2e8f0', fontSize: '0.875rem' }}>Below Average</div>
            </div>
            <div style={{ flex: '1 1 120px', textAlign: 'center', padding: '0.5rem' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#f97316' }}>100-119</div>
              <div style={{ color: '#e2e8f0', fontSize: '0.875rem' }}>Average</div>
            </div>
            <div style={{ flex: '1 1 120px', textAlign: 'center', padding: '0.5rem' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#eab308' }}>120-139</div>
              <div style={{ color: '#e2e8f0', fontSize: '0.875rem' }}>Good</div>
            </div>
            <div style={{ flex: '1 1 120px', textAlign: 'center', padding: '0.5rem' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#84cc16' }}>140-159</div>
              <div style={{ color: '#e2e8f0', fontSize: '0.875rem' }}>Excellent</div>
            </div>
            <div style={{ flex: '1 1 120px', textAlign: 'center', padding: '0.5rem' }}>
              <div style={{ fontSize: '1.5rem', fontWeight: 'bold', color: '#10b981' }}>160+</div>
              <div style={{ color: '#e2e8f0', fontSize: '0.875rem' }}>Elite</div>
            </div>
          </div>

          <p style={{ color: '#e2e8f0' }}>
            Generally, lineups with a NexusScore of 140+ should be prioritized for tournaments,
            while scores of 120+ are strong for cash games. Consider rebuilding lineups scoring
            below 100.
          </p>

          <div style={{
            marginTop: '1.5rem',
            padding: '0.75rem',
            backgroundColor: 'rgba(79, 209, 197, 0.1)',
            borderRadius: '0.5rem',
            borderLeft: '3px solid #4fd1c5'
          }}>
            <p style={{ color: '#e2e8f0', margin: 0 }}>
              <strong style={{ color: '#4fd1c5' }}>Pro Tip:</strong> Use NexusScore alongside ROI and
              First Place % metrics for a complete view of lineup potential. NexusScore is especially
              valuable when comparing lineups with similar projected points.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
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
  onGenerateLineups,
  activeTab,
  onChangeTab
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
  const [activeTabInternal, setActiveTabInternal] = useState(activeTab || 'settings');
  const [simulationProgress, setSimulationProgress] = useState(0);
  const [optimizerInstance, setOptimizerInstance] = useState(null);

  // Add state for NexusScore features
  const [showNexusExplainer, setShowNexusExplainer] = useState(false);
  const [sortBy, setSortBy] = useState('roi'); // Default sort by ROI
  const [selectedLineup, setSelectedLineup] = useState(null); // Track selected lineup

  // Handle external tab change
  useEffect(() => {
    if (activeTab && activeTab !== activeTabInternal) {
      setActiveTabInternal(activeTab);
    }
  }, [activeTab]);

  // Propagate internal tab change to parent
  useEffect(() => {
    if (onChangeTab && activeTabInternal !== activeTab) {
      onChangeTab(activeTabInternal);
    }
  }, [activeTabInternal, activeTab, onChangeTab]);

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

  // Helper function to get a sorted version of the lineups
  const getSortedLineups = useCallback(() => {
    if (!optimizationResults || !optimizationResults.lineups) {
      return [];
    }

    const lineups = [...optimizationResults.lineups]; // Create a copy to avoid mutation

    // Sort by the selected criteria
    if (sortBy === 'nexusScore') {
      return lineups.sort((a, b) => (b.nexusScore || 0) - (a.nexusScore || 0));
    } else if (sortBy === 'roi') {
      return lineups.sort((a, b) => parseFloat(b.roi) - parseFloat(a.roi));
    } else if (sortBy === 'firstPlace') {
      return lineups.sort((a, b) => parseFloat(b.firstPlace) - parseFloat(a.firstPlace));
    } else if (sortBy === 'projection') {
      return lineups.sort((a, b) => parseFloat(b.projectedPoints) - parseFloat(a.projectedPoints));
    } else if (sortBy === 'ownership') {
        return lineups.sort((a, b) => parseFloat(b.ownership) - parseFloat(a.ownership));
    }

    // Default to ROI sort
    return lineups.sort((a, b) => parseFloat(b.roi) - parseFloat(a.roi));
  }, [optimizationResults, sortBy]);

  // Set the first lineup as selected when results change
  useEffect(() => {
    if (optimizationResults && optimizationResults.lineups && optimizationResults.lineups.length > 0) {
      const sortedLineups = getSortedLineups();
      setSelectedLineup(sortedLineups[0]);
    }
  }, [optimizationResults, getSortedLineups]);

  // Function to update sort criteria
  const handleSortChange = (criteria) => {
    setSortBy(criteria);
  };

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

      // Add default NexusScore values if they're missing
      if (results && results.lineups) {
        results.lineups.forEach(lineup => {
          // If NexusScore isn't calculated by the backend, create a simulated one
          if (!lineup.nexusScore) {
            // Simple scoring formula based on available metrics
            const projPoints = parseFloat(lineup.projectedPoints) || 0;
            const roi = parseFloat(lineup.roi) || 0;
            const firstPlace = parseFloat(lineup.firstPlace) || 0;

            // Baseline score starts with projected points
            let baseScore = projPoints * 10;

            // Bonus for high ROI (50% weight)
            baseScore += (roi * 20);

            // Bonus for first place percentage (30% weight)
            baseScore += (firstPlace * 2);

            // Scale to 100-160 range
            lineup.nexusScore = Math.max(70, Math.min(180, baseScore));

            // Create components for display
            lineup.scoreComponents = {
              baseProjection: projPoints,
              leverageFactor: 1 + (roi / 5), // Simulate leverage based on ROI
              stackBonus: firstPlace * 0.5, // Simulate stack bonus
              positionBonus: 1.5, // Default position bonus
              avgOwnership: 10, // Default avg ownership
              fieldAvgOwnership: 15, // Default field avg ownership
              teamStacks: "Auto-generated" // Indicate this was auto-calculated
            };
          }
        });
      }

      // Process and store results
      setOptimizationResults(results);

      // Switch to results tab
      setActiveTabInternal('results');

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
        // Get sorted lineups based on current sort criteria
        const sortedLineups = getSortedLineups();

        // Format lineups for the parent component
        const formattedLineups = sortedLineups.map(lineup => ({
          id: lineup.id,
          name: `${sortBy === 'nexusScore' ? 'NexusScore' : 'Optimized'} ${
            sortBy === 'nexusScore'
              ? Math.round(lineup.nexusScore || 100)
              : formatNumber(lineup.roi)+'x'
          } (${formatNumber(lineup.projectedPoints, 1)} pts)`,
          cpt: lineup.cpt,
          players: lineup.players,
          projectedPoints: lineup.projectedPoints,
          roi: lineup.roi,
          nexusScore: lineup.nexusScore
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

    return getSortedLineups().map((lineup, index) => ({
      name: `L${index + 1}`,
      roi: lineup.roi,
      firstPlace: lineup.firstPlace,
      top10: lineup.top10,
      cashRate: lineup.cashRate,
      projectedPoints: lineup.projectedPoints,
      nexusScore: lineup.nexusScore || 100
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
                className={`tab ${activeTabInternal === tab ? 'active' : ''}`}
                onClick={() => setActiveTabInternal(tab)}
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
      {activeTabInternal === 'settings' && (
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
      {activeTabInternal === 'results' && optimizationResults && (
        <div className="grid grid-cols-1" style={{ gap: '1.5rem' }}>
          {/* Results Overview */}
          <div className="card">
            <div style={{
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              marginBottom: '1rem'
            }}>
              <h3 style={{ color: '#4fd1c5', margin: 0 }}>Simulation Results</h3>

              {/* Sort controls */}
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                <span style={{ color: '#90cdf4', fontSize: '0.875rem' }}>Sort by:</span>
                <div style={{ display: 'flex', backgroundColor: '#1a365d', borderRadius: '0.25rem' }}>
                  <button
                    className={`btn ${sortBy === 'nexusScore' ? 'active' : ''}`}
                    onClick={() => handleSortChange('nexusScore')}
                    style={{
                      backgroundColor: sortBy === 'nexusScore' ? '#3182ce' : 'transparent',
                      color: sortBy === 'nexusScore' ? 'white' : '#90cdf4',
                      border: 'none',
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.875rem',
                      borderRadius: '0.25rem',
                      cursor: 'pointer'
                    }}
                  >
                    NexusScore
                  </button>
                  <button
                    className={`btn ${sortBy === 'roi' ? 'active' : ''}`}
                    onClick={() => handleSortChange('roi')}
                    style={{
                      backgroundColor: sortBy === 'roi' ? '#3182ce' : 'transparent',
                      color: sortBy === 'roi' ? 'white' : '#90cdf4',
                      border: 'none',
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.875rem',
                      borderRadius: '0.25rem',
                      cursor: 'pointer'
                    }}
                  >
                    ROI
                  </button>
                  <button
                    className={`btn ${sortBy === 'firstPlace' ? 'active' : ''}`}
                    onClick={() => handleSortChange('firstPlace')}
                    style={{
                      backgroundColor: sortBy === 'firstPlace' ? '#3182ce' : 'transparent',
                      color: sortBy === 'firstPlace' ? 'white' : '#90cdf4',
                      border: 'none',
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.875rem',
                      borderRadius: '0.25rem',
                      cursor: 'pointer'
                    }}
                  >
                    First Place %
                  </button>
                  <button
                    className={`btn ${sortBy === 'projection' ? 'active' : ''}`}
                    onClick={() => handleSortChange('projection')}
                    style={{
                      backgroundColor: sortBy === 'projection' ? '#3182ce' : 'transparent',
                      color: sortBy === 'projection' ? 'white' : '#90cdf4',
                      border: 'none',
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.875rem',
                      borderRadius: '0.25rem',
                      cursor: 'pointer'
                    }}
                  >
                    Projection
                  </button>
                  <button
                    className={`btn ${sortBy === 'ownership' ? 'active' : ''}`}
                    onClick={() => handleSortChange('firstPlace')}
                    style={{
                      backgroundColor: sortBy === 'ownership' ? '#3182ce' : 'transparent',
                      color: sortBy === 'ownership' ? 'white' : '#90cdf4',
                      border: 'none',
                      padding: '0.25rem 0.5rem',
                      fontSize: '0.875rem',
                      borderRadius: '0.25rem',
                      cursor: 'pointer'
                    }}
                  >
                    Ownership
                  </button>
                </div>
              </div>
            </div>

            {/* Get top lineup based on current sort */}
            {(() => {
              const sortedLineups = getSortedLineups();
              // Use selected lineup if available, otherwise use top lineup
              const topLineup = selectedLineup || (sortedLineups.length > 0 ? sortedLineups[0] : null);

              return (
                <>
                  <div className="grid grid-cols-3" style={{ gap: '1rem', marginBottom: '1.5rem' }}>
                    <div className="stat-card">
                      <h4 style={{ color: '#90cdf4' }}>Top Lineup ROI</h4>
                      <p className="stat-value" style={{ color: '#10b981' }}>
                        {formatNumber(topLineup?.roi)}x
                      </p>
                    </div>

                    <div className="stat-card">
                      <h4 style={{ color: '#90cdf4' }}>First Place %</h4>
                      <p className="stat-value" style={{ color: '#8b5cf6' }}>
                        {formatNumber(topLineup?.firstPlace, 1)}%
                      </p>
                    </div>

                    <div className="stat-card">
                      <h4 style={{ color: '#90cdf4' }}>Projected Points</h4>
                      <p className="stat-value" style={{ color: '#f59e0b' }}>
                        {formatNumber(topLineup?.projectedPoints, 1)}
                      </p>
                    </div>
                  </div>

                  {/* About NexusScore button */}
                  <div style={{ textAlign: 'right', marginBottom: '0.5rem' }}>
                    <button
                      onClick={() => setShowNexusExplainer(true)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#4fd1c5',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                        display: 'inline-flex',
                        alignItems: 'center'
                      }}
                    >
                      <span style={{ marginRight: '0.25rem', fontWeight: 'bold' }}>?</span>
                      About NexusScore
                    </button>
                  </div>

                  {/* NexusScore Card for top lineup */}
                  <NexusScoreCard
                    score={topLineup?.nexusScore || 100}
                    components={topLineup?.scoreComponents}
                  />
                </>
              );
            })()}

            <div className="chart-container" style={{ height: '300px', marginTop: '1.5rem' }}>
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
                    <th>NexusScore</th>
                    <th>ROI</th>
                    <th>First %</th>
                    <th>Proj</th>
                    <th>Ownership</th>
                    {/* NEW COLUMN: Add Salary column */}
                    <th>Salary</th>
                    <th>Stack</th>
                    <th>Lineup</th>
                  </tr>
                </thead>
                <tbody>
                  {getSortedLineups().map((lineup, index) => {
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

                    // Calculate total ownership
                    let totalOwnership = 0;
                    // Get ownership from lineup's captain and players
                    const getPlayerOwnership = (playerId) => {
                      const player = playerData.find(p => p.id === playerId);
                      return player ? (player.ownership || 0) : 0;
                    };

                    // Captain ownership
                    totalOwnership += getPlayerOwnership(lineup.cpt.id);

                    // Players ownership
                    lineup.players.forEach(player => {
                      totalOwnership += getPlayerOwnership(player.id);
                    });

                    // Create color map for teams to visually identify stacks
                    const teams = Object.keys(teamCounts);
                    const teamColors = {
                      [teams[0]]: '#10b981', // Main team - teal color
                      [teams[1]]: '#8b5cf6', // Secondary team - purple color
                      [teams[2]]: '#f59e0b', // Third team - amber color
                      [teams[3]]: '#60a5fa', // Fourth team - blue color
                      [teams[4]]: '#ef4444'  // Fifth team - red color
                    };

                    // Determine color for NexusScore based on value
                    let scoreColor = '#ef4444'; // Red for <100
                    const nexusScore = lineup.nexusScore || 100;
                    if (nexusScore >= 160) scoreColor = '#10b981'; // Green for 160+
                    else if (nexusScore >= 140) scoreColor = '#22c55e'; // Light green for 140-160
                    else if (nexusScore >= 120) scoreColor = '#84cc16'; // Lime for 120-140
                    else if (nexusScore >= 100) scoreColor = '#eab308'; // Yellow for 100-120
                    else if (nexusScore >= 80) scoreColor = '#f97316'; // Orange for 80-100

                    // Check if this lineup is selected
                    const isSelected = selectedLineup && selectedLineup.id === lineup.id;

                    return (
                      <tr key={lineup.id}
                        onClick={() => setSelectedLineup(lineup)}
                        style={{
                          cursor: 'pointer',
                          backgroundColor: isSelected ? 'rgba(79, 209, 197, 0.1)' : 'transparent',
                          transition: 'background-color 0.2s'
                        }}
                        onMouseEnter={(e) => {
                          e.currentTarget.style.backgroundColor = isSelected
                            ? 'rgba(79, 209, 197, 0.15)'
                            : 'rgba(26, 54, 93, 0.3)';
                        }}
                        onMouseLeave={(e) => {
                          e.currentTarget.style.backgroundColor = isSelected
                            ? 'rgba(79, 209, 197, 0.1)'
                            : 'transparent';
                        }}
                      >
                        <td>{index + 1}</td>
                        <td style={{ fontWeight: 'bold', color: scoreColor }}>{Math.round(nexusScore)}</td>
                        <td style={{ fontWeight: 'bold', color: '#10b981' }}>{formatNumber(lineup.roi)}x</td>
                        <td style={{ color: '#8b5cf6' }}>{formatNumber(lineup.firstPlace, 1)}%</td>
                        <td style={{ color: '#f59e0b' }}>{formatNumber(lineup.projectedPoints, 1)}</td>
                        <td style={{ color: '#e84393' }}>{formatNumber(totalOwnership, 1)}%</td>

                        {/* NEW COLUMN: Calculate and display Total Salary */}
                        <td style={{ fontWeight: 'bold', color: '#38a169' }}>
                          ${(() => {
                            // Calculate total salary
                            const cptSalary = lineup.cpt?.salary || 0;
                            const playersSalary = lineup.players?.reduce((sum, p) => sum + (p.salary || 0), 0) || 0;
                            const totalSalary = cptSalary + playersSalary;
                            return totalSalary.toLocaleString();
                          })()}
                        </td>

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
      {activeTabInternal === 'lineup-details' && optimizationResults && (
        <div className="grid grid-cols-1" style={{ gap: '1.5rem' }}>
          {/* Score Distribution Chart */}
          <div className="card">
            <h3 style={{ color: '#4fd1c5', marginBottom: '1rem' }}>Score Distributions</h3>

            <div className="chart-container" style={{ height: '300px' }}>
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={getSortedLineups().slice(0, 5).map((lineup, index) => ({
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

      {/* NexusScore Explainer Modal */}
      <NexusScoreExplainer
        isOpen={showNexusExplainer}
        onClose={() => setShowNexusExplainer(false)}
      />
    </div>
  );
};

export default AdvancedOptimizerUI;