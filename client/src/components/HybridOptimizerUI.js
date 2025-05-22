/**
 * Hybrid Optimizer UI Component v2.0
 * 
 * Advanced interface for the new hybrid optimization system featuring:
 * - Strategy preset selection with smart recommendations
 * - Real-time algorithm performance data
 * - Contest-aware optimization settings
 * - Learning system integration
 * - Progress tracking and status updates
 */

import React, { useState, useEffect, useRef } from 'react';

const HybridOptimizerUI = ({ playerProjections, teamStacks, exposureSettings, onLineupsGenerated }) => {
  // State management
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [strategies, setStrategies] = useState({});
  const [selectedStrategy, setSelectedStrategy] = useState('recommended');
  const [contestInfo, setContestInfo] = useState({
    type: 'gpp',
    fieldSize: 1000,
    entryFee: 5
  });
  const [lineupCount, setLineupCount] = useState(20);
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState('Ready to initialize');
  const [optimizerStats, setOptimizerStats] = useState(null);
  const [lastResults, setLastResults] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customConfig, setCustomConfig] = useState({});

  // Auto-initialize when data is available
  useEffect(() => {
    if (playerProjections && playerProjections.length > 0 && !isInitialized && !isInitializing) {
      initializeOptimizer();
    }
  }, [playerProjections, isInitialized, isInitializing]);

  /**
   * Initialize the hybrid optimizer
   */
  const initializeOptimizer = async () => {
    setIsInitializing(true);
    setStatus('Initializing hybrid optimizer...');

    try {
      const response = await fetch('/optimizer/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          exposureSettings: exposureSettings || {},
          contestInfo
        })
      });

      const data = await response.json();
      
      if (data.success) {
        setIsInitialized(true);
        setStatus('Optimizer ready');
        
        // Load available strategies
        await loadStrategies();
        
        // Set recommended strategy
        if (data.recommendedStrategy) {
          setSelectedStrategy(data.recommendedStrategy);
        }
        
      } else {
        setStatus(`Initialization failed: ${data.message}`);
        console.error('Optimizer initialization failed:', data);
      }
    } catch (error) {
      setStatus(`Initialization error: ${error.message}`);
      console.error('Error initializing optimizer:', error);
    } finally {
      setIsInitializing(false);
    }
  };

  /**
   * Load available strategies from the optimizer
   */
  const loadStrategies = async () => {
    try {
      const response = await fetch('/optimizer/strategies');
      const data = await response.json();
      
      if (data.success) {
        setStrategies(data.strategies);
        setOptimizerStats(data.stats);
      }
    } catch (error) {
      console.error('Error loading strategies:', error);
    }
  };

  /**
   * Generate lineups using hybrid optimizer
   */
  const generateLineups = async () => {
    if (!isInitialized) {
      await initializeOptimizer();
      return;
    }

    setIsOptimizing(true);
    setProgress(0);
    setStatus('Starting optimization...');

    // Simulate progress updates like Advanced Optimizer but slower and more conservative
    const progressTimer = setInterval(() => {
      setProgress(prev => {
        if (prev >= 85) return prev; // Cap at 85% until actually done to avoid getting ahead
        
        // Much smaller increments to stay behind actual progress
        const increment = Math.random() * 3 + 1; // Random increment between 1-4%
        const newProgress = Math.min(prev + increment, 85);
        
        // Update status based on progress like Advanced Optimizer
        if (newProgress < 10) {
          setStatus('Initializing...');
        } else if (newProgress < 45) {
          setStatus('Generating lineups...');
        } else if (newProgress < 75) {
          setStatus('Running simulations...');
        } else {
          setStatus('Calculating metrics...');
        }
        
        return newProgress;
      });
    }, 800); // Update every 800ms (slower updates)

    try {
      const response = await fetch('/lineups/generate-hybrid', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          count: lineupCount,
          strategy: selectedStrategy,
          customConfig,
          saveToLineups: true,
          exposureSettings: exposureSettings || {}
        })
      });

      const data = await response.json();
      
      // Clear the progress timer
      clearInterval(progressTimer);
      
      if (data.success) {
        setLastResults(data);
        setRecommendations(data.recommendations || []);
        setStatus(`Generated ${data.lineups.length} lineups successfully`);
        setProgress(100);
        
        // Pass lineups to parent component
        if (onLineupsGenerated) {
          onLineupsGenerated(data.lineups, data);
        }
        
        // Refresh stats and strategies
        await loadStrategies();
        
      } else {
        setProgress(100);
        setStatus(`Generation failed: ${data.message}`);
        console.error('Lineup generation failed:', data);
      }
    } catch (error) {
      clearInterval(progressTimer);
      setProgress(100);
      setStatus(`Generation error: ${error.message}`);
      console.error('Error generating lineups:', error);
    } finally {
      setTimeout(() => {
        setIsOptimizing(false);
        setProgress(0);
      }, 500);
    }
  };

  /**
   * Render strategy card
   */
  const renderStrategyCard = (strategyKey, strategy) => {
    const isSelected = selectedStrategy === strategyKey;
    const isRecommended = strategy.recommended;
    
    return (
      <div
        key={strategyKey}
        className={`strategy-card ${isSelected ? 'selected' : ''} ${isRecommended ? 'recommended' : ''}`}
        onClick={() => setSelectedStrategy(strategyKey)}
      >
        <div className="strategy-header">
          <h4>{strategy.name}</h4>
          {isRecommended && <span className="recommended-badge">Recommended</span>}
        </div>
        
        <p className="strategy-description">{strategy.description}</p>
        
        <div className="strategy-usage">
          <small>{strategy.usage}</small>
        </div>
        
        {strategy.performance && strategy.performance.usage > 0 && (
          <div className="strategy-performance">
            <div className="performance-stat">
              <span>Avg ROI:</span>
              <span className={strategy.performance.averageROI > 0 ? 'positive' : 'negative'}>
                {strategy.performance.averageROI.toFixed(1)}%
              </span>
            </div>
            <div className="performance-stat">
              <span>Uses:</span>
              <span>{strategy.performance.usage}</span>
            </div>
            <div className="performance-stat">
              <span>Last:</span>
              <span>{strategy.performance.lastUsed}</span>
            </div>
          </div>
        )}
      </div>
    );
  };

  /**
   * Render contest type selector
   */
  const renderContestSelector = () => (
    <div className="contest-selector">
      <h4>Contest Information</h4>
      <div className="contest-controls">
        <div className="form-group">
          <label>Contest Type:</label>
          <select 
            value={contestInfo.type} 
            onChange={(e) => {
              const newContestInfo = {...contestInfo, type: e.target.value};
              setContestInfo(newContestInfo);
              // Re-initialize optimizer with new contest info if already initialized
              if (isInitialized) {
                setIsInitialized(false);
                setTimeout(() => initializeOptimizer(), 100);
              }
            }}
          >
            <option value="cash">Cash Game</option>
            <option value="double_up">Double Up</option>
            <option value="gpp">GPP/Tournament</option>
            <option value="single_entry">Single Entry</option>
          </select>
        </div>
        
        <div className="form-group">
          <label>Field Size:</label>
          <input
            type="number"
            value={contestInfo.fieldSize}
            onChange={(e) => {
              const newContestInfo = {...contestInfo, fieldSize: parseInt(e.target.value) || 1000};
              setContestInfo(newContestInfo);
              // Re-initialize optimizer with new contest info if already initialized
              if (isInitialized) {
                setIsInitialized(false);
                setTimeout(() => initializeOptimizer(), 100);
              }
            }}
            min="2"
            max="500000"
          />
        </div>
        
        <div className="form-group">
          <label>Entry Fee:</label>
          <input
            type="number"
            value={contestInfo.entryFee}
            onChange={(e) => {
              const newContestInfo = {...contestInfo, entryFee: parseFloat(e.target.value) || 5};
              setContestInfo(newContestInfo);
            }}
            min="0.25"
            step="0.25"
          />
        </div>
      </div>
      
      {isInitialized && (
        <div className="contest-note">
          <small>💡 Contest type and field size changes will re-initialize the optimizer</small>
        </div>
      )}
    </div>
  );

  /**
   * Render recommendations
   */
  const renderRecommendations = () => {
    if (recommendations.length === 0) return null;
    
    return (
      <div className="recommendations">
        <h4>💡 Optimization Recommendations</h4>
        {recommendations.map((rec, index) => (
          <div key={index} className={`recommendation ${rec.severity}`}>
            <span className="rec-message">{rec.message}</span>
            {rec.type === 'diversity' && (
              <button 
                className="rec-action"
                onClick={() => setSelectedStrategy('contrarian')}
              >
                Try Contrarian
              </button>
            )}
            {rec.type === 'constraints' && (
              <button 
                className="rec-action"
                onClick={() => setSelectedStrategy('constraint_focused')}
              >
                Try Constraint Optimizer
              </button>
            )}
          </div>
        ))}
      </div>
    );
  };

  /**
   * Render progress bar
   */
  const renderProgress = () => {
    if (!isOptimizing && !isInitializing) return null;
    
    return (
      <div className="loading-overlay">
        <div className="loading-card">
          <h3 className="loading-title">Running Hybrid Optimization</h3>

          <div className="loading-progress">
            <div
              className="loading-bar"
              style={{ width: `${progress}%` }}
            ></div>
          </div>

          <p className="loading-text">
            {status || getProgressStatusMessage()}
          </p>

          <button
            onClick={() => {
              setIsOptimizing(false);
              setIsInitializing(false);
            }}
            style={{
              marginTop: "10px",
              padding: "4px 12px",
              background: "rgba(239, 68, 68, 0.2)",
              color: "#ef4444",
              border: "1px solid #ef4444",
              borderRadius: "4px",
              fontSize: "12px",
              cursor: "pointer",
            }}
          >
            Cancel
          </button>
        </div>
      </div>
    );
  };

  /**
   * Get progress status message (same as Advanced Optimizer)
   */
  const getProgressStatusMessage = () => {
    if (status) {
      return status;
    }

    if (progress < 5) {
      return "Initializing...";
    } else if (progress < 40) {
      return "Generating lineups...";
    } else if (progress < 70) {
      return "Running simulations...";
    } else if (progress < 90) {
      return "Calculating metrics...";
    } else {
      return "Finalizing results...";
    }
  };

  /**
   * Render advanced settings
   */
  const renderAdvancedSettings = () => {
    if (!showAdvanced) return null;
    
    return (
      <div className="advanced-settings">
        <h4>Advanced Configuration</h4>
        <div className="advanced-controls">
          <div className="form-group">
            <label>Randomness Factor:</label>
            <input
              type="range"
              min="0.1"
              max="0.8"
              step="0.1"
              value={customConfig.randomness || 0.3}
              onChange={(e) => setCustomConfig({...customConfig, randomness: parseFloat(e.target.value)})}
            />
            <span>{customConfig.randomness || 0.3}</span>
          </div>
          
          <div className="form-group">
            <label>Leverage Multiplier:</label>
            <input
              type="range"
              min="0.2"
              max="2.0"
              step="0.1"
              value={customConfig.leverageMultiplier || 1.0}
              onChange={(e) => setCustomConfig({...customConfig, leverageMultiplier: parseFloat(e.target.value)})}
            />
            <span>{customConfig.leverageMultiplier || 1.0}</span>
          </div>
          
          {selectedStrategy === 'genetic' && (
            <>
              <div className="form-group">
                <label>Population Size:</label>
                <input
                  type="number"
                  min="50"
                  max="200"
                  value={customConfig.genetic?.populationSize || 100}
                  onChange={(e) => setCustomConfig({
                    ...customConfig, 
                    genetic: {...customConfig.genetic, populationSize: parseInt(e.target.value)}
                  })}
                />
              </div>
              
              <div className="form-group">
                <label>Generations:</label>
                <input
                  type="number"
                  min="20"
                  max="100"
                  value={customConfig.genetic?.generations || 50}
                  onChange={(e) => setCustomConfig({
                    ...customConfig, 
                    genetic: {...customConfig.genetic, generations: parseInt(e.target.value)}
                  })}
                />
              </div>
            </>
          )}
        </div>
      </div>
    );
  };

  /**
   * Render results summary
   */
  const renderResultsSummary = () => {
    if (!lastResults) return null;
    
    const { summary, strategy } = lastResults;
    
    return (
      <div className="results-summary">
        <h4>Latest Results</h4>
        <div className="results-grid">
          <div className="result-stat">
            <span className="stat-label">Strategy:</span>
            <span className="stat-value">{strategy.name}</span>
          </div>
          
          <div className="result-stat">
            <span className="stat-label">Algorithm:</span>
            <span className="stat-value">{summary.algorithm}</span>
          </div>
          
          <div className="result-stat">
            <span className="stat-label">Avg ROI:</span>
            <span className={`stat-value ${summary.averageROI > 0 ? 'positive' : 'negative'}`}>
              {summary.averageROI?.toFixed(1)}%
            </span>
          </div>
          
          <div className="result-stat">
            <span className="stat-label">Avg NexusScore:</span>
            <span className="stat-value">{summary.averageNexusScore?.toFixed(1)}</span>
          </div>
          
          <div className="result-stat">
            <span className="stat-label">Diversity:</span>
            <span className="stat-value">{(summary.diversityScore * 100)?.toFixed(1)}%</span>
          </div>
          
          <div className="result-stat">
            <span className="stat-label">Unique Lineups:</span>
            <span className="stat-value">{summary.uniqueLineups}</span>
          </div>
        </div>
      </div>
    );
  };

  return (
    <div className="hybrid-optimizer-ui">
      <div className="optimizer-header">
        <h2>🧬 Hybrid Optimizer v2.0</h2>
        <div className="header-controls">
          <button 
            className="btn btn-secondary"
            onClick={loadStrategies}
            disabled={!isInitialized}
          >
            Refresh
          </button>
          
          <button 
            className="btn btn-outline"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            Advanced {showAdvanced ? '▼' : '▶'}
          </button>
        </div>
      </div>

      {/* Contest Configuration */}
      {renderContestSelector()}

      {/* Progress/Status */}
      {renderProgress()}

      {/* Strategy Selection */}
      {isInitialized && (
        <div className="strategy-selection">
          <h3>Optimization Strategy</h3>
          <div className="strategy-grid">
            {Object.entries(strategies).map(([key, strategy]) => 
              renderStrategyCard(key, strategy)
            )}
          </div>
        </div>
      )}

      {/* Advanced Settings */}
      {renderAdvancedSettings()}

      {/* Generation Controls */}
      <div className="generation-controls">
        <div className="controls-row">
          <div className="form-group">
            <label>Number of Lineups:</label>
            <input
              type="number"
              value={lineupCount}
              onChange={(e) => setLineupCount(parseInt(e.target.value))}
              min="1"
              max="150"
              disabled={isOptimizing}
            />
          </div>
          
          <button
            className="btn btn-primary btn-large"
            onClick={generateLineups}
            disabled={isOptimizing || isInitializing || !playerProjections?.length}
          >
            {isOptimizing ? '⚡ Optimizing...' : '🚀 Generate Lineups'}
          </button>
        </div>
      </div>

      {/* Results and Recommendations */}
      <div className="results-section">
        {renderResultsSummary()}
        {renderRecommendations()}
      </div>

      {/* Optimizer Stats */}
      {optimizerStats && (
        <div className="optimizer-stats">
          <h4>Optimizer Statistics</h4>
          <div className="stats-grid">
            <div className="stat-item">
              <span>Players Loaded:</span>
              <span>{optimizerStats.playerCount}</span>
            </div>
            <div className="stat-item">
              <span>Constraint Complexity:</span>
              <span>{optimizerStats.constraintComplexity}</span>
            </div>
            <div className="stat-item">
              <span>Recommended Strategy:</span>
              <span>{optimizerStats.recommendedStrategy}</span>
            </div>
            <div className="stat-item">
              <span>Performance History:</span>
              <span>{optimizerStats.performanceHistory} runs</span>
            </div>
          </div>
        </div>
      )}

      {/* Styles */}
      <style>{`
        .hybrid-optimizer-ui {
          max-width: 1200px;
          margin: 0 auto;
          padding: 20px;
          font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
        }

        .optimizer-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 30px;
          padding-bottom: 15px;
          border-bottom: 2px solid #e1e5e9;
        }

        .header-controls {
          display: flex;
          gap: 10px;
        }

        .contest-selector {
          background: transparent;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
          border: 1px solid #e1e5e9;
        }

        .contest-note {
          margin-top: 15px;
          padding: 8px 12px;
          background: rgba(0, 123, 255, 0.1);
          border-radius: 4px;
          border-left: 3px solid #007bff;
        }

        .contest-note small {
          color: #495057;
          font-style: italic;
        }

        .contest-controls {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin-top: 15px;
        }

        .form-group {
          display: flex;
          flex-direction: column;
          gap: 5px;
        }

        .form-group label {
          font-weight: 600;
          color: #495057;
        }

        .form-group input, .form-group select {
          padding: 8px;
          border: 1px solid #ced4da;
          border-radius: 4px;
          font-size: 14px;
        }

        .progress-container {
          margin: 20px 0;
        }

        .progress-bar {
          width: 100%;
          height: 8px;
          background: #e9ecef;
          border-radius: 4px;
          overflow: hidden;
        }

        .progress-fill {
          height: 100%;
          background: linear-gradient(90deg, #007bff, #0056b3);
          transition: width 0.3s ease;
        }

        .progress-status {
          text-align: center;
          margin-top: 10px;
          font-weight: 500;
          color: #495057;
        }

        .strategy-selection {
          margin: 30px 0;
        }

        .strategy-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(300px, 1fr));
          gap: 15px;
          margin-top: 20px;
        }

        .strategy-card {
          border: 2px solid #e1e5e9;
          border-radius: 8px;
          padding: 20px;
          cursor: pointer;
          transition: all 0.2s ease;
          background: transparent;
        }

        .strategy-card:hover {
          border-color: #007bff;
          transform: translateY(-2px);
          box-shadow: 0 4px 12px rgba(0,123,255,0.15);
        }

        .strategy-card.recommended {
          border-color: #28a745;
          background: rgba(40, 167, 69, 0.1);
        }

        .strategy-card.selected {
          border-color: #007bff !important;
          background: rgba(0, 123, 255, 0.1) !important;
        }

        .strategy-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 10px;
        }

        .recommended-badge {
          background: #28a745;
          color: white;
          padding: 2px 8px;
          border-radius: 12px;
          font-size: 12px;
          font-weight: 600;
        }

        .strategy-description {
          color: #6c757d;
          margin: 10px 0;
          line-height: 1.4;
        }

        .strategy-usage {
          font-style: italic;
          color: #868e96;
          margin-bottom: 15px;
        }

        .strategy-performance {
          display: grid;
          grid-template-columns: repeat(3, 1fr);
          gap: 10px;
          border-top: 1px solid #e9ecef;
          padding-top: 15px;
        }

        .performance-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 2px;
        }

        .performance-stat span:first-child {
          font-size: 12px;
          color: #6c757d;
        }

        .performance-stat span:last-child {
          font-weight: 600;
        }

        .positive { color: #28a745; }
        .negative { color: #dc3545; }

        .advanced-settings {
          background: transparent;
          padding: 20px;
          border-radius: 8px;
          margin: 20px 0;
          border: 1px solid #e1e5e9;
        }

        .advanced-controls {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(250px, 1fr));
          gap: 20px;
          margin-top: 15px;
        }

        .generation-controls {
          background: transparent;
          padding: 25px;
          border-radius: 8px;
          margin: 20px 0;
          border: 2px solid #007bff;
        }

        .controls-row {
          display: flex;
          align-items: end;
          gap: 20px;
          justify-content: center;
        }

        .btn {
          padding: 10px 20px;
          border: none;
          border-radius: 6px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
          text-decoration: none;
          display: inline-block;
        }

        .btn:disabled {
          opacity: 0.6;
          cursor: not-allowed;
        }

        .btn-primary {
          background: #007bff;
          color: white;
        }

        .btn-primary:hover:not(:disabled) {
          background: #0056b3;
        }

        .btn-large {
          padding: 15px 30px;
          font-size: 16px;
        }

        .btn-secondary {
          background: #6c757d;
          color: white;
        }

        .btn-outline {
          background: transparent;
          border: 1px solid #6c757d;
          color: #6c757d;
        }

        .results-section {
          margin: 30px 0;
        }

        .results-summary {
          background: transparent;
          padding: 20px;
          border-radius: 8px;
          margin-bottom: 20px;
          border: 1px solid #e1e5e9;
        }

        .results-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(150px, 1fr));
          gap: 15px;
          margin-top: 15px;
        }

        .result-stat {
          display: flex;
          flex-direction: column;
          align-items: center;
          gap: 5px;
        }

        .stat-label {
          font-size: 12px;
          color: #6c757d;
          text-transform: uppercase;
          font-weight: 600;
        }

        .stat-value {
          font-size: 18px;
          font-weight: 700;
        }

        .recommendations {
          background: transparent;
          border: 2px solid #ffc107;
          border-radius: 8px;
          padding: 20px;
          margin: 20px 0;
        }

        .recommendation {
          display: flex;
          justify-content: space-between;
          align-items: center;
          padding: 10px 0;
          border-bottom: 1px solid rgba(255, 193, 7, 0.3);
        }

        .recommendation:last-child {
          border-bottom: none;
        }

        .rec-action {
          background: #ffc107;
          border: none;
          padding: 5px 15px;
          border-radius: 4px;
          font-weight: 600;
          cursor: pointer;
        }

        .optimizer-stats {
          background: transparent;
          padding: 20px;
          border-radius: 8px;
          margin-top: 30px;
          border: 1px solid #e1e5e9;
        }

        .stats-grid {
          display: grid;
          grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
          gap: 15px;
          margin-top: 15px;
        }

        .stat-item {
          display: flex;
          justify-content: space-between;
          padding: 10px;
          background: transparent;
          border-radius: 4px;
          border: 1px solid rgba(0, 123, 255, 0.3);
          border-left: 4px solid #007bff;
        }
      `}</style>
    </div>
  );
};

export default HybridOptimizerUI;