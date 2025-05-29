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

import React, { useState, useEffect } from "react";

const HybridOptimizerUI = ({
  API_BASE_URL,
  playerProjections,
  teamStacks,
  exposureSettings,
  onLineupsGenerated,
}) => {
  // State management
  const [isInitialized, setIsInitialized] = useState(false);
  const [isInitializing, setIsInitializing] = useState(false);
  const [isOptimizing, setIsOptimizing] = useState(false);
  const [strategies, setStrategies] = useState({});
  const [selectedStrategy, setSelectedStrategy] = useState("recommended");
  const [optimizationMode, setOptimizationMode] = useState("standard"); // 'standard' or 'portfolio'
  const [contestInfo, setContestInfo] = useState({
    type: "gpp",
    fieldSize: 1000,
    entryFee: 5,
  });
  const [lineupCount, setLineupCount] = useState(20);
  const [portfolioConfig, setPortfolioConfig] = useState({
    portfolioSize: 20,
    bulkMultiplier: 25,
    highFloor: 0.35,
    highCeiling: 0.35,
    balanced: 0.3,
    stack43Ratio: 0.6,
  });
  const [progress, setProgress] = useState(0);
  const [status, setStatus] = useState("Ready to initialize");
  const [optimizerStats, setOptimizerStats] = useState(null);
  const [lastResults, setLastResults] = useState(null);
  const [recommendations, setRecommendations] = useState([]);
  const [showAdvanced, setShowAdvanced] = useState(false);
  const [customConfig, setCustomConfig] = useState({});
  const [sessionId, setSessionId] = useState(null);
  const [currentLineupCount, setCurrentLineupCount] = useState(0);
  const [targetLineupCount, setTargetLineupCount] = useState(0);

  // Auto-initialize when data is available - simplified
  useEffect(() => {
    if (
      playerProjections &&
      playerProjections.length > 0 &&
      !isInitialized &&
      !isInitializing
    ) {
      // Fast initialize without heavy API calls
      fastInitialize();
    }
  }, [playerProjections, isInitialized, isInitializing]);

  /**
   * Fast initialize - minimal setup (UI only, not server)
   */
  const fastInitialize = () => {
    setIsInitializing(true);
    setStatus("Loading interface...");

    // Set default strategies without API call for UI display
    setStrategies({
      recommended: {
        name: "Recommended",
        description: "Smart algorithm selection",
        recommended: true,
      },
      balanced: {
        name: "Balanced",
        description: "Reliable lineups with good upside",
      },
      cash_game: {
        name: "Cash Game",
        description: "Consistent scoring for cash games",
      },
      tournament: {
        name: "Tournament/GPP",
        description: "High-ceiling lineups for tournaments",
      },
      contrarian: {
        name: "Contrarian",
        description: "Low-owned players for differentiation",
      },
      constraint_focused: {
        name: "Constraint Optimizer",
        description: "Perfect for complex exposure requirements",
      },
    });

    // Don't set isInitialized to true - that should only happen after server initialization
    setIsInitializing(false);
    setStatus("Ready to optimize (will initialize when needed)");
  };

  /**
   * Full initialize - only when needed for generation
   */
  const initializeOptimizer = async () => {
    setIsInitializing(true);
    setStatus("Initializing hybrid optimizer...");

    try {
      const response = await fetch(`${API_BASE_URL}/optimizer/initialize`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          exposureSettings: exposureSettings || {},
          contestInfo,
        }),
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `Initialize request failed: ${response.status} ${errorText}`
        );
      }

      const data = await response.json();

      if (data.success) {
        setIsInitialized(true);
        setStatus("Optimizer ready");

        // Store sessionId if provided and return it
        if (data.sessionId) {
          setSessionId(data.sessionId);
        }

        // Load available strategies
        await loadStrategies(data.sessionId);

        // Set recommended strategy
        if (data.recommendedStrategy) {
          setSelectedStrategy(data.recommendedStrategy);
        }

        // Return the sessionId so it can be used immediately
        return data.sessionId;
      } else {
        setStatus(`Initialization failed: ${data.message}`);
        throw new Error(data.message || "Initialization failed");
      }
    } catch (error) {
      setStatus(`Initialization error: ${error.message}`);
      throw error;
    } finally {
      setIsInitializing(false);
    }
  };

  /**
   * Load available strategies from the optimizer
   */
  const loadStrategies = async (sid = sessionId) => {
    try {
      const response = await fetch(
        `${API_BASE_URL}/optimizer/strategies?sessionId=${sid}`
      );
      const data = await response.json();

      if (data.success) {
        // Add algorithm property if missing (client-side fallback)
        const strategiesWithAlgorithm = {};
        Object.entries(data.strategies).forEach(([key, strategy]) => {
          const algorithm = strategy.algorithm || getDefaultAlgorithm(key);
          strategiesWithAlgorithm[key] = {
            ...strategy,
            algorithm,
            distribution:
              strategy.distribution || getDefaultDistribution(key, algorithm),
          };
        });

        setStrategies(strategiesWithAlgorithm);
        setOptimizerStats(data.stats);
      }
    } catch (error) {
      console.error("Error loading strategies:", error);
    }
  };

  /**
   * Get default algorithm for strategy key (fallback)
   */
  const getDefaultAlgorithm = (strategyKey) => {
    const algorithmMap = {
      recommended: "auto",
      balanced: "hybrid",
      cash_game: "monte_carlo",
      tournament: "genetic",
      contrarian: "genetic",
      constraint_focused: "simulated_annealing",
    };
    return algorithmMap[strategyKey] || "hybrid";
  };

  /**
   * Get default distribution for hybrid algorithms (fallback)
   */
  const getDefaultDistribution = (strategyKey, algorithm) => {
    if (algorithm !== "hybrid") return null;

    const distributionMap = {
      balanced: { monte_carlo: 0.6, genetic: 0.3, simulated_annealing: 0.1 },
      constraint_focused: {
        monte_carlo: 0.4,
        genetic: 0.4,
        simulated_annealing: 0.2,
      },
    };
    return (
      distributionMap[strategyKey] || {
        monte_carlo: 0.5,
        genetic: 0.3,
        simulated_annealing: 0.2,
      }
    );
  };

  /**
   * Generate lineups using hybrid optimizer
   */
  const generateLineups = async () => {
    if (!playerProjections || playerProjections.length === 0) {
      alert("Please load player data first");
      return;
    }

    setIsOptimizing(true);
    setProgress(0);
    setStatus("Starting optimization...");
    setCurrentLineupCount(0);
    setTargetLineupCount(
      optimizationMode === "portfolio"
        ? portfolioConfig.portfolioSize
        : lineupCount
    );

    // Initialize optimizer if not already done
    let currentSessionId = sessionId;
    if (!isInitialized) {
      try {
        currentSessionId = await initializeOptimizer();
      } catch (error) {
        setIsOptimizing(false);
        setStatus("Initialization failed");
        return;
      }
    }

    // Set up real-time progress tracking via Server-Sent Events
    // Use the actual sessionId from initialization
    const progressSessionId = currentSessionId || sessionId;
    let eventSource = null;
    let progressTimer = null;
    let sseReady = false;

    // Try to use real progress updates via SSE
    try {
      eventSource = new EventSource(
        `${API_BASE_URL}/optimizer/progress/${progressSessionId}`
      );

      eventSource.onmessage = (event) => {
        const data = JSON.parse(event.data);
        if (data.progress !== undefined && data.progress !== null) {
          setProgress(data.progress);
        }
        if (data.status) {
          setStatus(data.status);

          // Parse lineup counts from status messages
          const lineupMatch = data.status.match(/(\d+)\s+of\s+(\d+)/);
          const generatingMatch = data.status.match(
            /Running.*optimization.*\((\d+)\s+lineups\)/
          );
          const candidatesMatch = data.status.match(
            /Generating\s+(\d+)\s+lineup\s+candidates/
          );

          if (lineupMatch) {
            setCurrentLineupCount(parseInt(lineupMatch[1]));
            setTargetLineupCount(parseInt(lineupMatch[2]));
          } else if (generatingMatch) {
            setTargetLineupCount(parseInt(generatingMatch[1]));
            setCurrentLineupCount(0);
          } else if (candidatesMatch) {
            setTargetLineupCount(parseInt(candidatesMatch[1]));
            setCurrentLineupCount(0);
          }

          // Close connection only when we receive completion status
          if (
            data.status === "Simulation completed successfully" ||
            data.status.includes("optimization completed")
          ) {
            eventSource.close();
            if (progressTimer) {
              clearInterval(progressTimer);
            }
          }
        }
      };

      eventSource.onerror = (error) => {
        eventSource.close();
        startSimulatedProgress();
      };

      eventSource.onopen = () => {
        sseReady = true;
      };
    } catch (error) {
      startSimulatedProgress();
    }

    // Wait for SSE connection to be established before sending generation request
    if (eventSource) {
      let waitAttempts = 0;
      while (!sseReady && waitAttempts < 20) {
        // Wait up to 2 seconds
        await new Promise((resolve) => setTimeout(resolve, 100));
        waitAttempts++;
      }
    }

    // Fallback simulated progress function
    function startSimulatedProgress() {
      let currentLineup = 0;
      const targetLineups =
        optimizationMode === "portfolio"
          ? portfolioConfig.portfolioSize
          : lineupCount;
      const isPortfolio = optimizationMode === "portfolio";

      const updateInterval = isPortfolio ? 1200 : 600;
      const maxProgress = isPortfolio ? 75 : 85;

      progressTimer = setInterval(() => {
        setProgress((prev) => {
          if (prev >= maxProgress) return prev;

          const increment = isPortfolio
            ? Math.random() * 1.5 + 0.5
            : Math.random() * 2 + 1;

          const newProgress = Math.min(prev + increment, maxProgress);

          if (newProgress >= 15 && newProgress < maxProgress) {
            currentLineup = Math.floor(
              ((newProgress - 15) / (maxProgress - 15)) * targetLineups
            );
            currentLineup = Math.min(currentLineup, targetLineups - 1);
          }

          if (newProgress < 5) {
            setStatus("Initializing optimizer...");
          } else if (newProgress < 15) {
            setStatus("Setting up generation...");
          } else if (newProgress < maxProgress) {
            if (isPortfolio) {
              const candidateCount =
                portfolioConfig.portfolioSize * portfolioConfig.bulkMultiplier;
              const currentCandidate = Math.floor(
                ((newProgress - 15) / (maxProgress - 15)) * candidateCount
              );
              if (newProgress < 50) {
                setStatus(
                  `Generating candidates... ${currentCandidate} of ${candidateCount}`
                );
              } else if (newProgress < 65) {
                setStatus(
                  `Scoring candidates... ${currentCandidate} of ${candidateCount}`
                );
              } else {
                setStatus(
                  `Selecting top ${portfolioConfig.portfolioSize} lineups...`
                );
              }
            } else {
              setStatus(
                `Generating lineup ${currentLineup + 1} of ${targetLineups}...`
              );
            }
          } else {
            setStatus(
              isPortfolio ? "Finalizing portfolio..." : "Finalizing results..."
            );
          }

          return newProgress;
        });
      }, updateInterval);
    }

    try {
      const requestBody =
        optimizationMode === "portfolio"
          ? {
              count: portfolioConfig.portfolioSize,
              strategy: "portfolio",
              progressSessionId: progressSessionId,
              sessionId: currentSessionId,
              customConfig: {
                portfolioSize: portfolioConfig.portfolioSize,
                bulkGenerationMultiplier: portfolioConfig.bulkMultiplier,
                barbellDistribution: {
                  highFloor: portfolioConfig.highFloor,
                  highCeiling: portfolioConfig.highCeiling,
                  balanced: portfolioConfig.balanced,
                },
                stackTargets: {
                  "4-3": portfolioConfig.stack43Ratio,
                  "4-2-1": 1 - portfolioConfig.stack43Ratio,
                },
                ...customConfig,
              },
              saveToLineups: true,
              exposureSettings: exposureSettings || {},
              stackExposureTargets:
                exposureSettings?.stackExposureTargets || {},
              contestInfo: contestInfo,
            }
          : {
              count: lineupCount,
              strategy: selectedStrategy,
              progressSessionId: progressSessionId,
              customConfig,
              saveToLineups: true,
              exposureSettings: exposureSettings || {},
              stackExposureTargets:
                exposureSettings?.stackExposureTargets || {},
              contestInfo: contestInfo,
              sessionId: currentSessionId,
            };

      const response = await fetch(`${API_BASE_URL}/lineups/generate-hybrid`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(requestBody),
      });

      const data = await response.json();

      if (data.success) {
        setLastResults(data);
        setRecommendations(data.recommendations || []);
        setStatus(`Generated ${data.lineups.length} lineups successfully`);
        setProgress(100);

        // Pass lineups to parent component
        if (onLineupsGenerated) {
          onLineupsGenerated(data.lineups, {
            ...data,
            contestInfo: contestInfo,
          });
        }

        // Refresh stats and strategies
        await loadStrategies();
      } else {
        setProgress(100);
        setStatus(`Generation failed: ${data.message}`);
        console.error("Lineup generation failed:", data);
      }
    } catch (error) {
      // Clean up progress tracking on error
      if (eventSource) {
        eventSource.close();
      }
      if (progressTimer) {
        clearInterval(progressTimer);
      }
      setProgress(100);
      setStatus(`Generation error: ${error.message}`);
      console.error("Error generating lineups:", error);
    } finally {
      setTimeout(() => {
        setIsOptimizing(false);
        setProgress(0);
      }, 500);
    }
  };

  /**
   * Get human-readable algorithm description
   */
  const getAlgorithmDescription = (strategy) => {
    // Force algorithm based on strategy name as absolute fallback
    let algorithm = strategy.algorithm;
    if (!algorithm) {
      if (strategy.name === "Recommended") algorithm = "auto";
      else if (strategy.name === "Balanced") algorithm = "hybrid";
      else if (strategy.name === "Cash Game") algorithm = "monte_carlo";
      else if (strategy.name === "Tournament/GPP") algorithm = "genetic";
      else if (strategy.name === "Contrarian") algorithm = "genetic";
      else if (strategy.name === "Constraint Optimizer")
        algorithm = "simulated_annealing";
      else algorithm = "hybrid";
    }

    switch (algorithm) {
      case "auto":
        return "Auto-selects optimal algorithm";
      case "hybrid":
        const dist = strategy.distribution;
        if (dist) {
          const algorithms = Object.entries(dist)
            .filter(([, percentage]) => percentage > 0)
            .map(
              ([algo, percentage]) =>
                `${algo.replace("_", " ")} (${(percentage * 100).toFixed(0)}%)`
            )
            .join(", ");
          return `Hybrid: ${algorithms}`;
        }
        return "Hybrid optimization";
      case "monte_carlo":
        return "Monte Carlo simulation";
      case "genetic":
        return "Genetic algorithm";
      case "simulated_annealing":
        return "Simulated annealing";
      default:
        return algorithm.replace(/_/g, " ");
    }
  };

  /**
   * Render strategy card
   */
  const renderStrategyCard = (strategyKey, strategy) => {
    const isSelected = selectedStrategy === strategyKey;
    const isRecommended = strategy.recommended;
    const algorithmInfo = getAlgorithmDescription(strategy);

    return (
      <div
        key={strategyKey}
        className={`strategy-card ${isSelected ? "selected" : ""} ${
          isRecommended ? "recommended" : ""
        }`}
        onClick={() => setSelectedStrategy(strategyKey)}
        title={`Algorithm: ${algorithmInfo}`}
      >
        <div className="strategy-header">
          <h4>{strategy.name}</h4>
          {isRecommended && (
            <span className="recommended-badge">Recommended</span>
          )}
        </div>

        <p className="strategy-description">{strategy.description}</p>

        <div className="strategy-usage">
          <small>{strategy.usage}</small>
        </div>

        <div className="strategy-algorithm">
          <small>
            <strong>Algorithm:</strong> {algorithmInfo}
          </small>
        </div>

        {strategy.performance && strategy.performance.usage > 0 && (
          <div className="strategy-performance">
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
      <div className="contest-controls" style={{ paddingRight: "20px" }}>
        <div className="form-group">
          <label>Contest Type:</label>
          <select
            value={contestInfo.type}
            onChange={(e) => {
              const newContestInfo = { ...contestInfo, type: e.target.value };
              setContestInfo(newContestInfo);
              // No immediate re-initialization - just update the value
            }}
          >
            <option value="cash">Cash Game</option>
            <option value="double_up">Double Up</option>
            <option value="gpp">GPP/Tournament</option>
          </select>
        </div>

        <div className="form-group">
          <label>Field Size:</label>
          <input
            type="number"
            value={contestInfo.fieldSize}
            onChange={(e) => {
              const value = e.target.value;
              const newContestInfo = {
                ...contestInfo,
                fieldSize: value === "" ? "" : parseInt(value) || 1000,
              };
              setContestInfo(newContestInfo);
              // No immediate re-initialization - just update the value
            }}
            min="2"
            max="500000"
          />
        </div>

        <div className="form-group" style={{ marginLeft: "20px" }}>
          <label>Entry Fee:</label>
          <input
            type="number"
            value={contestInfo.entryFee}
            onChange={(e) => {
              const value = e.target.value;
              const newContestInfo = {
                ...contestInfo,
                entryFee: value === "" ? "" : parseFloat(value) || 5,
              };
              setContestInfo(newContestInfo);
            }}
            min="0.25"
            step="0.25"
          />
        </div>
      </div>
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
            {rec.type === "diversity" && (
              <button
                className="rec-action"
                onClick={() => setSelectedStrategy("contrarian")}
              >
                Try Contrarian
              </button>
            )}
            {rec.type === "constraints" && (
              <button
                className="rec-action"
                onClick={() => setSelectedStrategy("constraint_focused")}
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
   * Render enhanced progress bar
   */
  const renderProgress = () => {
    if (!isOptimizing && !isInitializing) return null;

    const isPortfolio = optimizationMode === "portfolio";
    const title = isPortfolio
      ? "🧬 Portfolio Optimization"
      : "🧬 Hybrid Optimization";

    return (
      <div className="loading-overlay">
        <div className="loading-card">
          <div className="loading-header">
            <h3 className="loading-title">{title}</h3>
            <div className="loading-meta">
              {targetLineupCount > 0 && (
                <div className="lineup-counter">
                  <span className="counter-current">{currentLineupCount}</span>
                  <span className="counter-separator">/</span>
                  <span className="counter-target">{targetLineupCount}</span>
                  <span className="counter-label">lineups</span>
                </div>
              )}
              <div className="progress-percentage">{Math.round(progress)}%</div>
            </div>
          </div>

          <div className="enhanced-progress-container">
            <div className="enhanced-progress-track">
              <div
                className="enhanced-progress-bar"
                style={{
                  width: `${Math.max(2, progress)}%`,
                  transition: "width 0.3s ease-out",
                }}
              >
                <div className="progress-shine"></div>
              </div>
            </div>
            <div className="progress-markers">
              <div className="marker" style={{ left: "25%" }}>
                25%
              </div>
              <div className="marker" style={{ left: "50%" }}>
                50%
              </div>
              <div className="marker" style={{ left: "75%" }}>
                75%
              </div>
            </div>
          </div>

          <div className="loading-status">
            <div className="status-text">
              {status || getProgressStatusMessage()}
            </div>
            {isPortfolio && (
              <div className="portfolio-info">
                Generating{" "}
                {portfolioConfig.portfolioSize * portfolioConfig.bulkMultiplier}{" "}
                candidates → Selecting top {portfolioConfig.portfolioSize}
              </div>
            )}
          </div>

          <button
            className="cancel-button"
            onClick={() => {
              setIsOptimizing(false);
              setIsInitializing(false);
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
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <label>Randomness Factor:</label>
              <div
                className="tooltip-container"
                style={{ position: "relative" }}
              >
                <span
                  className="tooltip-trigger"
                  style={{
                    cursor: "help",
                    fontSize: "14px",
                    color: "#90cdf4",
                    fontWeight: "bold",
                  }}
                >
                  ?
                </span>
                <div
                  className="tooltip"
                  style={{
                    visibility: "hidden",
                    opacity: 0,
                    position: "absolute",
                    bottom: "100%",
                    left: "50%",
                    transform: "translateX(-50%)",
                    backgroundColor: "#2d3748",
                    color: "white",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    width: "280px",
                    zIndex: 1000,
                    transition: "opacity 0.2s",
                    marginBottom: "5px",
                  }}
                >
                  Controls how much randomness is injected into lineup
                  construction. Higher values create more diverse lineups but
                  may sacrifice optimal scoring. Lower values create more chalk
                  lineups focused on top projections.
                </div>
              </div>
            </div>
            <input
              type="range"
              min="0.1"
              max="0.8"
              step="0.1"
              value={customConfig.randomness || 0.3}
              onChange={(e) =>
                setCustomConfig({
                  ...customConfig,
                  randomness: parseFloat(e.target.value),
                })
              }
            />
            <span>{customConfig.randomness || 0.3}</span>
          </div>

          <div className="form-group">
            <div style={{ display: "flex", alignItems: "center", gap: "5px" }}>
              <label>Leverage Multiplier:</label>
              <div
                className="tooltip-container"
                style={{ position: "relative" }}
              >
                <span
                  className="tooltip-trigger"
                  style={{
                    cursor: "help",
                    fontSize: "14px",
                    color: "#90cdf4",
                    fontWeight: "bold",
                  }}
                >
                  ?
                </span>
                <div
                  className="tooltip"
                  style={{
                    visibility: "hidden",
                    opacity: 0,
                    position: "absolute",
                    bottom: "100%",
                    left: "50%",
                    transform: "translateX(-50%)",
                    backgroundColor: "#2d3748",
                    color: "white",
                    padding: "8px 12px",
                    borderRadius: "4px",
                    fontSize: "12px",
                    width: "280px",
                    zIndex: 1000,
                    transition: "opacity 0.2s",
                    marginBottom: "5px",
                  }}
                >
                  Adjusts how much the optimizer favors low-owned players for
                  leverage. Values above 1.0 increase contrarian plays, values
                  below 1.0 reduce them. Set to 1.0 for ownership-neutral
                  optimization.
                </div>
              </div>
            </div>
            <input
              type="range"
              min="0.2"
              max="2.0"
              step="0.1"
              value={customConfig.leverageMultiplier || 1.0}
              onChange={(e) =>
                setCustomConfig({
                  ...customConfig,
                  leverageMultiplier: parseFloat(e.target.value),
                })
              }
            />
            <span>{customConfig.leverageMultiplier || 1.0}</span>
          </div>

          {selectedStrategy === "portfolio" && (
            <>
              <div className="form-group">
                <label>Portfolio Size:</label>
                <input
                  type="number"
                  min="5"
                  max="150"
                  value={customConfig.portfolioSize || 20}
                  onChange={(e) =>
                    setCustomConfig({
                      ...customConfig,
                      portfolioSize: parseInt(e.target.value),
                    })
                  }
                />
                <small>Number of lineups in final portfolio</small>
              </div>

              <div className="form-group">
                <label>Bulk Generation Multiplier:</label>
                <input
                  type="number"
                  min="5"
                  max="50"
                  value={customConfig.bulkGenerationMultiplier || 25}
                  onChange={(e) =>
                    setCustomConfig({
                      ...customConfig,
                      bulkGenerationMultiplier: parseInt(e.target.value),
                    })
                  }
                />
                <small>
                  Generate{" "}
                  {(customConfig.bulkGenerationMultiplier || 25) *
                    (customConfig.portfolioSize || 20)}{" "}
                  candidates to select top {customConfig.portfolioSize || 20}
                </small>
              </div>

              <div className="form-group">
                <label>High-Floor Weight:</label>
                <input
                  type="range"
                  min="0.1"
                  max="0.6"
                  step="0.05"
                  value={customConfig.barbellDistribution?.highFloor || 0.35}
                  onChange={(e) =>
                    setCustomConfig({
                      ...customConfig,
                      barbellDistribution: {
                        ...customConfig.barbellDistribution,
                        highFloor: parseFloat(e.target.value),
                      },
                    })
                  }
                />
                <span>
                  {Math.round(
                    (customConfig.barbellDistribution?.highFloor || 0.35) * 100
                  )}
                  %
                </span>
                <small>Safe chalk lineups</small>
              </div>

              <div className="form-group">
                <label>High-Ceiling Weight:</label>
                <input
                  type="range"
                  min="0.1"
                  max="0.6"
                  step="0.05"
                  value={customConfig.barbellDistribution?.highCeiling || 0.35}
                  onChange={(e) =>
                    setCustomConfig({
                      ...customConfig,
                      barbellDistribution: {
                        ...customConfig.barbellDistribution,
                        highCeiling: parseFloat(e.target.value),
                      },
                    })
                  }
                />
                <span>
                  {Math.round(
                    (customConfig.barbellDistribution?.highCeiling || 0.35) *
                      100
                  )}
                  %
                </span>
                <small>Contrarian leverage lineups</small>
              </div>

              <div className="form-group">
                <label>4-3 Stack Target:</label>
                <input
                  type="range"
                  min="0.2"
                  max="0.8"
                  step="0.05"
                  value={customConfig.stackTargets?.["4-3"] || 0.6}
                  onChange={(e) =>
                    setCustomConfig({
                      ...customConfig,
                      stackTargets: {
                        ...customConfig.stackTargets,
                        "4-3": parseFloat(e.target.value),
                        "4-2-1": 1 - parseFloat(e.target.value),
                      },
                    })
                  }
                />
                <span>
                  {Math.round(
                    (customConfig.stackTargets?.["4-3"] || 0.6) * 100
                  )}
                  %
                </span>
                <small>
                  Remaining{" "}
                  {Math.round(
                    (1 - (customConfig.stackTargets?.["4-3"] || 0.6)) * 100
                  )}
                  % will be 4-2-1 stacks
                </small>
              </div>
            </>
          )}

          {selectedStrategy === "genetic" && (
            <>
              <div className="form-group">
                <label>Population Size:</label>
                <input
                  type="number"
                  min="50"
                  max="200"
                  value={customConfig.genetic?.populationSize || 100}
                  onChange={(e) =>
                    setCustomConfig({
                      ...customConfig,
                      genetic: {
                        ...customConfig.genetic,
                        populationSize: parseInt(e.target.value),
                      },
                    })
                  }
                />
              </div>

              <div className="form-group">
                <label>Generations:</label>
                <input
                  type="number"
                  min="20"
                  max="100"
                  value={customConfig.genetic?.generations || 50}
                  onChange={(e) =>
                    setCustomConfig({
                      ...customConfig,
                      genetic: {
                        ...customConfig.genetic,
                        generations: parseInt(e.target.value),
                      },
                    })
                  }
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
    if (!lastResults || !lastResults.lineups) return null;

    const { summary = {}, strategy, algorithms = [] } = lastResults;

    return (
      <div className="results-summary">
        <h4>Latest Results</h4>
        <div className="results-grid">
          <div className="result-stat">
            <span className="stat-label">Strategy:</span>
            <span className="stat-value">
              {selectedStrategy || "recommended"}
            </span>
          </div>

          <div className="result-stat">
            <span className="stat-label">Algorithm:</span>
            <span className="stat-value">
              {algorithms.join(", ") || summary.algorithm || "hybrid"}
            </span>
          </div>

          <div className="result-stat">
            <span className="stat-label">Avg NexusScore:</span>
            <span className="stat-value">
              {summary.averageNexusScore?.toFixed(1) || "N/A"}
            </span>
          </div>

          <div className="result-stat">
            <span className="stat-label">Diversity:</span>
            <span className="stat-value">
              {summary.diversityScore
                ? `${(summary.diversityScore * 100).toFixed(1)}%`
                : "N/A"}
            </span>
          </div>

          <div className="result-stat">
            <span className="stat-label">Unique Lineups:</span>
            <span className="stat-value">
              {summary.uniqueLineups || lastResults.lineups?.length || 0}
            </span>
          </div>
        </div>
      </div>
    );
  };

  /**
   * Render optimization mode selector
   */
  const renderModeSelector = () => {
    return (
      <div style={{ marginBottom: "20px" }}>
        <h3>Optimization Mode</h3>
        <div style={{ display: "flex", gap: "15px", marginTop: "10px" }}>
          <div
            onClick={() => setOptimizationMode("standard")}
            style={{
              flex: 1,
              padding: "20px",
              border:
                optimizationMode === "standard"
                  ? "2px solid #007bff"
                  : "2px solid #ddd",
              borderRadius: "8px",
              cursor: "pointer",
              backgroundColor: "transparent",
              transition: "all 0.2s ease",
            }}
          >
            <div
              style={{
                fontWeight: "bold",
                textAlign: "center",
                marginBottom: "8px",
                fontSize: "16px",
              }}
            >
              Standard Optimization
            </div>
            <div
              style={{ fontSize: "14px", color: "#666", textAlign: "center" }}
            >
              Generate lineups using advanced algorithms (Monte Carlo, Genetic,
              Simulated Annealing)
            </div>
          </div>

          <div
            onClick={() => setOptimizationMode("portfolio")}
            style={{
              flex: 1,
              padding: "20px",
              border:
                optimizationMode === "portfolio"
                  ? "2px solid #007bff"
                  : "2px solid #ddd",
              borderRadius: "8px",
              cursor: "pointer",
              backgroundColor: "transparent",
              transition: "all 0.2s ease",
            }}
          >
            <div
              style={{
                fontWeight: "bold",
                textAlign: "center",
                marginBottom: "8px",
                fontSize: "16px",
              }}
            >
              Portfolio Optimizer
            </div>
            <div
              style={{ fontSize: "14px", color: "#666", textAlign: "center" }}
            >
              Generate a diversified portfolio with barbell strategy
              (high-floor, high-ceiling, balanced)
            </div>
          </div>
        </div>
      </div>
    );
  };

  /**
   * Render portfolio configuration
   */
  const renderPortfolioConfig = () => {
    return (
      <div
        style={{
          marginBottom: "20px",
          padding: "20px",
          border: "1px solid #ddd",
          borderRadius: "8px",
          backgroundColor: "transparent",
        }}
      >
        <h3>Portfolio Settings</h3>

        <div style={{ display: "flex", gap: "20px", marginBottom: "20px" }}>
          <div style={{ flex: 1 }}>
            <label
              style={{
                display: "block",
                fontWeight: "bold",
                marginBottom: "5px",
              }}
            >
              Portfolio Size
            </label>
            <input
              type="number"
              min="5"
              max="150"
              value={portfolioConfig.portfolioSize}
              onChange={(e) =>
                setPortfolioConfig({
                  ...portfolioConfig,
                  portfolioSize: parseInt(e.target.value),
                })
              }
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            />
            <small style={{ color: "#666" }}>
              Number of lineups in final portfolio
            </small>
          </div>

          <div style={{ flex: 1 }}>
            <label
              style={{
                display: "block",
                fontWeight: "bold",
                marginBottom: "5px",
              }}
            >
              Generation Multiplier
            </label>
            <input
              type="number"
              min="5"
              max="50"
              value={portfolioConfig.bulkMultiplier}
              onChange={(e) =>
                setPortfolioConfig({
                  ...portfolioConfig,
                  bulkMultiplier: parseInt(e.target.value),
                })
              }
              style={{
                width: "100%",
                padding: "8px",
                border: "1px solid #ccc",
                borderRadius: "4px",
              }}
            />
            <small style={{ color: "#666" }}>
              Generate{" "}
              {portfolioConfig.bulkMultiplier * portfolioConfig.portfolioSize}{" "}
              candidates to select top {portfolioConfig.portfolioSize}
            </small>
          </div>
        </div>

        <div style={{ marginBottom: "20px" }}>
          <h4>Barbell Distribution</h4>
          <div
            style={{ display: "flex", flexDirection: "column", gap: "15px" }}
          >
            <div>
              <label
                style={{
                  display: "block",
                  fontWeight: "bold",
                  marginBottom: "5px",
                }}
              >
                High-Floor (Safe Chalk) -{" "}
                {Math.round(portfolioConfig.highFloor * 100)}%
              </label>
              <input
                type="range"
                min="0.1"
                max="0.6"
                step="0.05"
                value={portfolioConfig.highFloor}
                onChange={(e) => {
                  const newValue = parseFloat(e.target.value);
                  const remaining = 1 - newValue - portfolioConfig.highCeiling;
                  setPortfolioConfig({
                    ...portfolioConfig,
                    highFloor: newValue,
                    balanced: Math.max(0.1, remaining),
                  });
                }}
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontWeight: "bold",
                  marginBottom: "5px",
                }}
              >
                High-Ceiling (Contrarian) -{" "}
                {Math.round(portfolioConfig.highCeiling * 100)}%
              </label>
              <input
                type="range"
                min="0.1"
                max="0.6"
                step="0.05"
                value={portfolioConfig.highCeiling}
                onChange={(e) => {
                  const newValue = parseFloat(e.target.value);
                  const remaining = 1 - newValue - portfolioConfig.highFloor;
                  setPortfolioConfig({
                    ...portfolioConfig,
                    highCeiling: newValue,
                    balanced: Math.max(0.1, remaining),
                  });
                }}
                style={{ width: "100%" }}
              />
            </div>

            <div>
              <label
                style={{
                  display: "block",
                  fontWeight: "bold",
                  marginBottom: "5px",
                }}
              >
                Balanced - {Math.round(portfolioConfig.balanced * 100)}%
              </label>
              <div
                style={{
                  padding: "8px",
                  backgroundColor: "#e9ecef",
                  borderRadius: "4px",
                  color: "#666",
                }}
              >
                {Math.round(portfolioConfig.balanced * 100)}% (auto-calculated)
              </div>
            </div>
          </div>
        </div>

        <div>
          <h4>Stack Distribution</h4>
          <div>
            <label
              style={{
                display: "block",
                fontWeight: "bold",
                marginBottom: "5px",
              }}
            >
              4-3 Stacks - {Math.round(portfolioConfig.stack43Ratio * 100)}%
            </label>
            <input
              type="range"
              min="0.2"
              max="0.8"
              step="0.05"
              value={portfolioConfig.stack43Ratio}
              onChange={(e) =>
                setPortfolioConfig({
                  ...portfolioConfig,
                  stack43Ratio: parseFloat(e.target.value),
                })
              }
              style={{ width: "100%" }}
            />
            <small style={{ color: "#666" }}>
              Remaining {Math.round((1 - portfolioConfig.stack43Ratio) * 100)}%
              will be 4-2-1 stacks
            </small>
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
            disabled={isOptimizing}
          >
            Refresh
          </button>

          <button
            className="btn btn-outline"
            onClick={() => setShowAdvanced(!showAdvanced)}
          >
            Advanced {showAdvanced ? "▼" : "▶"}
          </button>
        </div>
      </div>

      {/* Contest Configuration */}
      {renderContestSelector()}

      {/* Optimization Mode Selector */}
      {renderModeSelector()}

      {/* Portfolio Configuration */}
      {optimizationMode === "portfolio" && renderPortfolioConfig()}

      {/* Progress/Status */}
      {renderProgress()}

      {/* Strategy Selection - Only show in standard mode */}
      {optimizationMode === "standard" && (
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
          {optimizationMode === "standard" && (
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
          )}

          {optimizationMode === "portfolio" && (
            <div className="portfolio-summary">
              <div className="summary-stat">
                <span className="stat-label">Portfolio Size: </span>
                <span className="stat-value">
                  {portfolioConfig.portfolioSize} lineups
                </span>
              </div>
              <div className="summary-stat">
                <span className="stat-label">Candidates: </span>
                <span className="stat-value">
                  {portfolioConfig.portfolioSize *
                    portfolioConfig.bulkMultiplier}
                </span>
              </div>
              <div className="summary-stat">
                <span className="stat-label">Strategy: </span>
                <span className="stat-value">
                  {Math.round(portfolioConfig.highFloor * 100)}% Floor /
                  {Math.round(portfolioConfig.highCeiling * 100)}% Ceiling /
                  {Math.round(portfolioConfig.balanced * 100)}% Balanced
                </span>
              </div>
            </div>
          )}

          <button
            className="btn btn-primary btn-large"
            onClick={generateLineups}
            disabled={isOptimizing || !playerProjections?.length}
            style={{
              marginLeft: optimizationMode === "standard" ? "20px" : "0",
            }}
          >
            {isOptimizing
              ? optimizationMode === "portfolio"
                ? "Building Portfolio..."
                : "Optimizing..."
              : optimizationMode === "portfolio"
                ? "Generate Portfolio"
                : "Generate Lineups"}
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
          margin-bottom: 10px;
        }

        .strategy-algorithm {
          color: #495057;
          margin-bottom: 15px;
          font-size: 12px;
          background: rgba(0, 123, 255, 0.1);
          padding: 4px 8px;
          border-radius: 4px;
          border-left: 3px solid #007bff;
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

        /* Enhanced Loading Overlay Styles */
        .loading-overlay {
          position: fixed;
          top: 0;
          left: 0;
          width: 100%;
          height: 100%;
          background: rgba(0, 0, 0, 0.8);
          display: flex;
          justify-content: center;
          align-items: center;
          z-index: 9999;
          backdrop-filter: blur(4px);
        }

        .loading-card {
          background: #1a202c;
          border-radius: 12px;
          padding: 30px;
          box-shadow: 0 20px 40px rgba(0, 0, 0, 0.5);
          min-width: 500px;
          max-width: 600px;
          text-align: center;
          border: 1px solid #2d3748;
        }

        .loading-header {
          display: flex;
          justify-content: space-between;
          align-items: center;
          margin-bottom: 25px;
        }

        .loading-title {
          margin: 0;
          font-size: 20px;
          color: #e2e8f0;
          font-weight: 600;
        }

        .loading-meta {
          display: flex;
          align-items: center;
          gap: 15px;
        }

        .lineup-counter {
          display: flex;
          align-items: baseline;
          gap: 2px;
          font-family: 'SF Mono', 'Monaco', 'Inconsolata', monospace;
          background: #2d3748;
          padding: 4px 8px;
          border-radius: 6px;
          border: 1px solid #4a5568;
        }

        .counter-current {
          font-size: 18px;
          font-weight: 700;
          color: #63b3ed;
        }

        .counter-separator {
          font-size: 16px;
          color: #a0aec0;
          margin: 0 2px;
        }

        .counter-target {
          font-size: 16px;
          font-weight: 600;
          color: #cbd5e0;
        }

        .counter-label {
          font-size: 12px;
          color: #a0aec0;
          margin-left: 4px;
        }

        .progress-percentage {
          font-size: 18px;
          font-weight: 700;
          color: #63b3ed;
          background: #2d3748;
          padding: 6px 12px;
          border-radius: 6px;
          border: 1px solid #4a5568;
          min-width: 50px;
        }

        .enhanced-progress-container {
          position: relative;
          margin-bottom: 20px;
        }

        .enhanced-progress-track {
          width: 100%;
          height: 12px;
          background: linear-gradient(to right, #2d3748, #4a5568);
          border-radius: 8px;
          overflow: hidden;
          border: 1px solid #4a5568;
          box-shadow: inset 0 2px 4px rgba(0, 0, 0, 0.3);
        }

        .enhanced-progress-bar {
          height: 100%;
          background: linear-gradient(90deg, #4299e1, #3182ce, #2b6cb0);
          border-radius: 8px;
          position: relative;
          min-width: 2%;
          box-shadow: 0 2px 4px rgba(66, 153, 225, 0.3);
        }

        .progress-shine {
          position: absolute;
          top: 0;
          left: -50%;
          width: 50%;
          height: 100%;
          background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
          animation: shine 2s infinite;
        }

        @keyframes shine {
          0% { left: -50%; }
          100% { left: 150%; }
        }

        .progress-markers {
          position: absolute;
          top: 16px;
          left: 0;
          right: 0;
          height: 16px;
          pointer-events: none;
        }

        .marker {
          position: absolute;
          transform: translateX(-50%);
          font-size: 10px;
          color: #a0aec0;
          font-weight: 500;
        }

        .loading-status {
          margin-bottom: 20px;
        }

        .status-text {
          font-size: 14px;
          color: #cbd5e0;
          margin-bottom: 8px;
          font-weight: 500;
          min-height: 20px;
        }

        .portfolio-info {
          font-size: 12px;
          color: #a0aec0;
          font-style: italic;
          background: #2d3748;
          padding: 6px 12px;
          border-radius: 6px;
          border-left: 3px solid #4299e1;
        }

        .cancel-button {
          background: linear-gradient(135deg, #feb2b2, #fc8181);
          color: #742a2a;
          border: 1px solid #fc8181;
          padding: 8px 16px;
          border-radius: 6px;
          font-size: 12px;
          font-weight: 600;
          cursor: pointer;
          transition: all 0.2s ease;
        }

        .cancel-button:hover {
          background: linear-gradient(135deg, #fc8181, #f56565);
          transform: translateY(-1px);
          box-shadow: 0 4px 8px rgba(252, 129, 129, 0.3);
        }
      `}</style>
    </div>
  );
};

export default HybridOptimizerUI;
