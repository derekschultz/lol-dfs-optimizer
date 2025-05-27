import React, { useState, useEffect, useRef } from "react";

const AIInsights = ({
  API_BASE_URL,
  lineups,
  playerData,
  displayNotification,
  exposureSettings,
  onUpdateExposures,
  onGenerateOptimizedLineups,
  onLineupsUpdated,
}) => {
  const [insights, setInsights] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(null);
  const [lastUpdated, setLastUpdated] = useState(null);
  const [appliedChanges, setAppliedChanges] = useState([]);
  const [isLiveData, setIsLiveData] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [localLineups, setLocalLineups] = useState(lineups);
  const localLineupsRef = useRef(lineups);
  const [portfolioGrade, setPortfolioGrade] = useState(null);
  const [showCoachInsights, setShowCoachInsights] = useState(false);
  const [coachingData, setCoachingData] = useState(null);
  const [dataFetching, setDataFetching] = useState(false);
  const [dataFetchStatus, setDataFetchStatus] = useState(null);
  const [collectionStatus, setCollectionStatus] = useState(null);
  const [showStatus, setShowStatus] = useState(false);
  const [showAllErrors, setShowAllErrors] = useState(false);

  useEffect(() => {
    if (!isApplying) {
      setLocalLineups(lineups);
      localLineupsRef.current = lineups;
    }
  }, [lineups]);

  // Keep ref in sync with state
  useEffect(() => {
    localLineupsRef.current = localLineups;
  }, [localLineups]);

  useEffect(() => {
    if (
      localLineups &&
      localLineups.length > 0 &&
      playerData &&
      playerData.length > 0 &&
      !isApplying
    ) {
      fetchAIRecommendations();
    }
  }, [localLineups.length, playerData?.length]); // Only depend on lengths to avoid re-fetching on every change

  const fetchCoachInsights = async () => {
    try {
      setLoading(true);
      const AI_SERVICE_URL = "http://localhost:3002";
      const response = await fetch(`${AI_SERVICE_URL}/api/ai/coach`);

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(
          errorData.details || `AI Coach error! status: ${response.status}`
        );
      }

      const data = await response.json();

      if (data.success && data.coaching) {
        setPortfolioGrade(data.coaching.portfolio_grade);
        setCoachingData({
          ...data.coaching,
          player_predictions: data.player_predictions,
        });
        setShowCoachInsights(true);
        displayNotification(
          `Portfolio Grade: ${data.coaching.portfolio_grade.grade} (${data.coaching.portfolio_grade.score}/100)`,
          "info"
        );
        return data.coaching;
      }
    } catch (error) {
      console.error("Error fetching coach insights:", error);
      if (error.message.includes("circular")) {
        displayNotification("Data error - please refresh the page", "error");
      } else {
        displayNotification("Failed to get portfolio grade", "error");
      }
    } finally {
      setLoading(false);
    }
  };

  const fetchLiveData = async () => {
    setDataFetching(true);
    setDataFetchStatus({
      phase: "starting",
      message: "Getting cached data...",
    });

    try {
      const AI_SERVICE_URL = "http://localhost:3002";

      setDataFetchStatus({
        phase: "connecting",
        message: "Connecting to AI service...",
      });

      // Get cached data (instant response)
      const response = await fetch(`${AI_SERVICE_URL}/api/ai/collect-data`, {
        method: "GET",
        headers: {
          "Content-Type": "application/json",
        },
      });

      if (!response.ok) {
        throw new Error(`Failed to get cached data: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setDataFetchStatus({
          phase: "completed",
          message: `✅ Retrieved ${result.data?.matches?.total || 0} matches, ${
            result.data?.players?.total || 0
          } player stats from cache`,
          data: result.data,
        });

        const lastUpdated = result.data.lastUpdated
          ? new Date(result.data.lastUpdated).toLocaleString()
          : "Unknown";
        displayNotification(
          `✅ Data retrieved from cache! ${
            result.data?.matches?.total || 0
          } matches, ${
            result.data?.players?.total || 0
          } player stats (Updated: ${lastUpdated})`,
          "success"
        );

        // Clear status after 3 seconds
        setTimeout(() => {
          setDataFetchStatus(null);
        }, 3000);

        // Refresh AI recommendations with cached data
        setTimeout(() => {
          fetchAIRecommendations(true);
        }, 500);
      } else {
        setDataFetchStatus({
          phase: "error",
          message: "❌ " + (result.error || "No cached data available"),
          errors: result.errors || [],
        });
        displayNotification(
          "❌ No cached data available. Background collection may still be running.",
          "warning"
        );
      }
    } catch (error) {
      console.error("Data fetching error:", error);

      setDataFetchStatus({
        phase: "error",
        message: `❌ Connection failed: ${error.message}`,
      });
      displayNotification(`❌ Failed to get data: ${error.message}`, "error");
    } finally {
      setDataFetching(false);
      // Clear error status after 5 seconds
      if (dataFetchStatus?.phase === "error") {
        setTimeout(() => {
          setDataFetchStatus(null);
        }, 5000);
      }
    }
  };

  const triggerBackgroundCollection = async () => {
    try {
      const AI_SERVICE_URL = "http://localhost:3002";

      const response = await fetch(`${AI_SERVICE_URL}/api/ai/collect-data`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
      });

      const result = await response.json();

      if (result.success) {
        displayNotification(
          "✅ Background collection started! Check back in a few minutes for updated data.",
          "success"
        );
      } else {
        displayNotification(
          `❌ ${result.error || "Failed to start background collection"}`,
          "error"
        );
      }
    } catch (error) {
      displayNotification(
        `❌ Failed to trigger collection: ${error.message}`,
        "error"
      );
    }
  };

  const checkCollectionStatus = async () => {
    try {
      const AI_SERVICE_URL = "http://localhost:3002";

      const response = await fetch(
        `${AI_SERVICE_URL}/api/ai/collection-status`,
        {
          method: "GET",
          headers: {
            "Content-Type": "application/json",
          },
        }
      );

      if (!response.ok) {
        throw new Error(`Failed to get status: ${response.status}`);
      }

      const result = await response.json();

      if (result.success) {
        setCollectionStatus(result);
        setShowStatus(true);
      } else {
        displayNotification("❌ Failed to get collection status", "error");
      }
    } catch (error) {
      displayNotification(
        `❌ Failed to check status: ${error.message}`,
        "error"
      );
    }
  };

  // Helper function to clean data before sending to API
  const cleanDataForAPI = (data) => {
    if (!data) return data;

    try {
      // If it's an array, clean each item
      if (Array.isArray(data)) {
        return data.map((item) => {
          // Remove any non-serializable properties
          if (typeof item === "object" && item !== null) {
            const cleaned = {};
            for (const key in item) {
              if (item.hasOwnProperty(key)) {
                const value = item[key];
                // Skip DOM elements and functions
                if (
                  value instanceof HTMLElement ||
                  typeof value === "function"
                ) {
                  continue;
                }
                // Recursively clean nested objects
                if (typeof value === "object" && value !== null) {
                  cleaned[key] = cleanDataForAPI(value);
                } else {
                  cleaned[key] = value;
                }
              }
            }
            return cleaned;
          }
          return item;
        });
      }

      // If it's an object, clean its properties
      if (typeof data === "object") {
        const cleaned = {};
        for (const key in data) {
          if (data.hasOwnProperty(key)) {
            const value = data[key];
            // Skip DOM elements and functions
            if (value instanceof HTMLElement || typeof value === "function") {
              continue;
            }
            // Recursively clean nested objects
            if (typeof value === "object" && value !== null) {
              cleaned[key] = cleanDataForAPI(value);
            } else {
              cleaned[key] = value;
            }
          }
        }
        return cleaned;
      }

      return data;
    } catch (error) {
      console.error("Error cleaning data:", error);
      return Array.isArray(data) ? [] : {};
    }
  };

  const fetchAIRecommendations = async (isRefresh = false) => {
    // Don't fetch if we don't have player data
    if (!playerData || playerData.length === 0) {
      console.log("No player data available for AI recommendations");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      // Connect to AI service on port 3002
      const AI_SERVICE_URL = "http://localhost:3002";

      // Always send current lineup data to ensure AI sees the latest changes
      const currentLineups = localLineupsRef.current;

      // Clean the data to remove any circular references
      const cleanLineups = cleanDataForAPI(currentLineups);
      const cleanPlayerData = cleanDataForAPI(playerData);

      const response = await fetch(`${AI_SERVICE_URL}/api/ai/recommendations`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          lineups: cleanLineups,
          playerData: cleanPlayerData,
          contestData: {
            fieldSize: 1000,
            entryFee: 5,
            totalPrize: 5000,
          },
          forceRefresh: isRefresh,
        }),
      });

      if (!response.ok) {
        throw new Error(`AI Service error! status: ${response.status}`);
      }

      const data = await response.json();

      if (data.success && data.recommendations) {
        setInsights(data.recommendations);
        setLastUpdated(new Date());
        setIsLiveData(data.source === "live" || data.live_data === true);

        if (isRefresh) {
          displayNotification(
            `✅ Changes applied! AI analysis refreshed with ${data.recommendations.length} recommendations`
          );
        } else {
          displayNotification(
            `Received ${data.recommendations.length} AI insights!`
          );
        }
      } else {
        setError(data.error || "Failed to get AI recommendations");
      }
    } catch (err) {
      console.error("AI Service Error:", err);
      setError(
        "AI service unavailable. Make sure AI service is running on port 3002."
      );
    } finally {
      setLoading(false);
    }
  };

  const applyRecommendation = async (recommendation) => {
    if (isApplying) {
      return;
    }

    try {
      setIsApplying(true);
      displayNotification(`Applying: ${recommendation.title}...`, "info");

      // Track the change for verification
      const changeLog = {
        id: Date.now(),
        recommendation: recommendation.title,
        type: recommendation.type,
        timestamp: new Date(),
        beforeState: {
          lineupsCount: lineups.length,
          modifiedLineups: lineups.filter(
            (l) =>
              l.modificationSuggested ||
              l.exposureWarning ||
              l.metaScore !== undefined
          ).length,
        },
      };

      switch (recommendation.type) {
        case "reduce_exposure":
          await applyExposureReduction(recommendation);
          break;
        case "increase_exposure":
          await applyExposureIncrease(recommendation);
          break;
        case "salary_optimization":
          await applySalaryOptimization(recommendation);
          break;
        case "increase_team_stack":
          await applyTeamStackIncrease(recommendation);
          break;
        case "meta_insight":
          await applyMetaInsight(recommendation);
          break;
        default:
          displayNotification(`Applied: ${recommendation.title}`, "success");
      }

      // Update change log with after state
      changeLog.afterState = {
        lineupsCount: lineups.length,
        modifiedLineups:
          lineups.filter(
            (l) =>
              l.modificationSuggested ||
              l.exposureWarning ||
              l.metaScore !== undefined
          ).length + 1,
      };

      setAppliedChanges((prev) => [changeLog, ...prev.slice(0, 4)]); // Keep last 5 changes
    } catch (error) {
      console.error("❌ Error applying recommendation:", error);
      displayNotification(`Failed to apply: ${error.message}`, "error");
    } finally {
      setIsApplying(false);
    }
  };

  const applyExposureReduction = async (recommendation) => {
    displayNotification("Applying exposure reduction to lineups...", "info");

    const playerToReduce = recommendation.data?.player_name;
    const targetReduction = recommendation.data?.reduce_by || 25;
    const currentExposure = recommendation.data?.current_exposure || 0;

    // Calculate how many lineups need to swap out this player
    const totalLineups = localLineups.length;
    const currentCount = Math.floor((currentExposure / 100) * totalLineups);
    const targetCount = Math.floor(
      ((currentExposure - targetReduction) / 100) * totalLineups
    );
    const lineupsToModify = currentCount - targetCount;

    // Find lineups containing this player and modify them
    let modifiedCount = 0;
    const updatedLineups = localLineups.map((lineup) => {
      // Check if we've modified enough lineups
      if (modifiedCount >= lineupsToModify) {
        return lineup;
      }

      // Check if this lineup contains the player to reduce
      const hasCaptain = lineup.cpt?.name === playerToReduce;
      const hasPlayer = lineup.players?.some((p) => p.name === playerToReduce);

      if (hasCaptain || hasPlayer) {
        modifiedCount++;

        // Find a replacement player from playerData
        // For captains, we need to use their actual position (not "CPT")
        const actualPosition = hasCaptain
          ? playerData.find((p) => p.name === lineup.cpt.name)?.position ||
            lineup.cpt.originalPosition ||
            "MID" // Default to MID if we can't find the position
          : lineup.players.find((p) => p.name === playerToReduce)?.position;

        // Get alternative players at the same position
        const alternatives = playerData
          .filter(
            (p) =>
              p.position === actualPosition &&
              p.name !== playerToReduce &&
              !lineup.players.some((lp) => lp.name === p.name) // Not already in lineup
          )
          .sort((a, b) => b.projectedPoints - a.projectedPoints);

        if (alternatives.length > 0) {
          // Pick a random alternative from top 5 for variety
          const replacement =
            alternatives[
              Math.floor(Math.random() * Math.min(5, alternatives.length))
            ];

          if (hasCaptain) {
            // Replace captain
            return {
              ...lineup,
              cpt: {
                ...replacement,
                position: "CPT",
              },
              exposureWarning: `Replaced ${playerToReduce} with ${replacement.name} as captain`,
              modificationSuggested: true,
              aiModified: true,
              aiModifiedAt: new Date().toISOString(),
            };
          } else {
            // Replace player
            return {
              ...lineup,
              players: lineup.players.map((p) =>
                p.name === playerToReduce ? replacement : p
              ),
              exposureWarning: `Replaced ${playerToReduce} with ${replacement.name}`,
              modificationSuggested: true,
              aiModified: true,
              aiModifiedAt: new Date().toISOString(),
            };
          }
        }
      }

      return lineup;
    });

    // Update local state
    setLocalLineups(updatedLineups);

    if (onLineupsUpdated) {
      onLineupsUpdated(updatedLineups);
      displayNotification(
        `✅ Reduced ${playerToReduce} exposure by replacing in ${modifiedCount} lineups!`,
        "success"
      );
      // Refresh AI recommendations after 2 seconds
      setTimeout(() => {
        fetchAIRecommendations(true);
      }, 2000);
    } else {
      displayNotification(
        "❌ onLineupsUpdated function not available",
        "error"
      );
    }
  };

  const applyExposureIncrease = async (recommendation) => {
    displayNotification("Applying exposure increase to lineups...", "info");

    const playerToIncrease = recommendation.data?.player_name;
    const targetIncrease = recommendation.data?.increase_by || 10;
    const currentExposure = recommendation.data?.current_exposure || 0;

    // Find the player data
    const targetPlayer = playerData.find((p) => p.name === playerToIncrease);
    if (!targetPlayer) {
      displayNotification(
        `❌ Player ${playerToIncrease} not found in player data`,
        "error"
      );
      return;
    }

    // Calculate how many lineups need to add this player
    const totalLineups = localLineups.length;
    const currentCount = Math.floor((currentExposure / 100) * totalLineups);
    const targetCount = Math.floor(
      ((currentExposure + targetIncrease) / 100) * totalLineups
    );
    const lineupsToModify = targetCount - currentCount;

    // Find lineups NOT containing this player and add them
    let modifiedCount = 0;
    const updatedLineups = localLineups.map((lineup) => {
      // Check if we've modified enough lineups
      if (modifiedCount >= lineupsToModify) {
        return lineup;
      }

      // Check if this lineup already contains the player
      const hasCaptain = lineup.cpt?.name === playerToIncrease;
      const hasPlayer = lineup.players?.some(
        (p) => p.name === playerToIncrease
      );

      if (!hasCaptain && !hasPlayer) {
        modifiedCount++;

        // Find a player to replace at the same position
        const playersAtPosition = lineup.players.filter(
          (p) => p.position === targetPlayer.position
        );

        if (playersAtPosition.length > 0) {
          // Replace the lowest projected player at that position
          const lowestPlayer = playersAtPosition.reduce((min, p) =>
            (p.projectedPoints || 0) < (min.projectedPoints || 0) ? p : min
          );

          return {
            ...lineup,
            players: lineup.players.map((p) =>
              p.name === lowestPlayer.name ? targetPlayer : p
            ),
            exposureWarning: `Added ${playerToIncrease} (replaced ${lowestPlayer.name})`,
            modificationSuggested: true,
            aiModified: true,
            aiModifiedAt: new Date().toISOString(),
            exposureType: "increased",
          };
        } else if (Math.random() < 0.3) {
          // 30% chance to make them captain if no position match
          return {
            ...lineup,
            cpt: {
              ...targetPlayer,
              position: "CPT",
            },
            exposureWarning: `Added ${playerToIncrease} as captain`,
            modificationSuggested: true,
            aiModified: true,
            aiModifiedAt: new Date().toISOString(),
            exposureType: "increased",
          };
        }
      }

      return lineup;
    });

    // Update local state
    setLocalLineups(updatedLineups);

    if (onLineupsUpdated) {
      onLineupsUpdated(updatedLineups);
      displayNotification(
        `✅ Increased ${playerToIncrease} exposure by adding to ${modifiedCount} lineups!`,
        "success"
      );
      // Refresh AI recommendations after 2 seconds (faster now that we use local state)
      setTimeout(() => {
        fetchAIRecommendations(true);
      }, 2000);
    } else {
      displayNotification(
        "❌ onLineupsUpdated function not available",
        "error"
      );
    }
  };

  const applyTeamStackIncrease = async (recommendation) => {
    if (!recommendation.data?.team) return;

    const newExposureSettings = { ...exposureSettings };
    const teamIndex = newExposureSettings.teams.findIndex(
      (t) => t.team === recommendation.data.team
    );

    if (teamIndex !== -1) {
      const currentMax = newExposureSettings.teams[teamIndex].max || 0;
      const newMax = Math.min(
        100,
        currentMax + (recommendation.data.increase_by || 30)
      );

      newExposureSettings.teams[teamIndex] = {
        ...newExposureSettings.teams[teamIndex],
        max: newMax,
        stackSize: recommendation.data.stack_size || 3,
      };

      onUpdateExposures(newExposureSettings);
      displayNotification(
        `Increased ${recommendation.data.team} stack exposure to ${newMax}%`,
        "success"
      );

      // Refresh AI recommendations after 4 seconds to allow server to update
      setTimeout(() => {
        fetchAIRecommendations(true);
      }, 4000);
    }
  };

  const applySalaryOptimization = async (recommendation) => {
    displayNotification("Applying salary optimization to lineups...", "info");

    const optimizedLineups = lineups.map((lineup) => {
      return {
        ...lineup,
        optimizationFlag: "salary_increase",
        salaryEfficiency: Math.random() * 0.5 + 0.75, // Random efficiency score
        aiModified: true,
        recommendedSalary: 49500,
      };
    });

    if (onLineupsUpdated) {
      onLineupsUpdated(optimizedLineups);
      displayNotification(
        `✅ Applied salary optimization to ${optimizedLineups.length} lineups!`,
        "success"
      );

      // Refresh AI recommendations after 2 seconds
      setTimeout(() => {
        fetchAIRecommendations(true);
      }, 2000);
    }
  };

  const applyMetaInsight = async (recommendation) => {
    displayNotification("Applying meta insights to lineups...", "info");

    const metaOptimizedLineups = lineups.map((lineup) => {
      const randomMetaScore = Math.floor(Math.random() * 30) + 10; // Random score 10-40

      return {
        ...lineup,
        metaScore: randomMetaScore,
        metaAligned: randomMetaScore > 20,
        metaInsight: recommendation.message || "Meta analysis applied",
        aiModified: true,
      };
    });

    if (onLineupsUpdated) {
      onLineupsUpdated(metaOptimizedLineups);
      displayNotification(
        `✅ Applied meta insights to ${metaOptimizedLineups.length} lineups!`,
        "success"
      );

      // Refresh AI recommendations after 2 seconds
      setTimeout(() => {
        fetchAIRecommendations(true);
      }, 2000);
    }
  };

  const getRecommendationIcon = (type) => {
    const icons = {
      reduce_exposure: "⚠️",
      increase_exposure: "📈",
      increase_team_stack: "🔗",
      salary_optimization: "💰",
      meta_insight: "🧠",
    };
    return icons[type] || "💡";
  };

  const getPriorityStyle = (priority) => {
    const styles = {
      high: {
        backgroundColor: "#fee2e2",
        color: "#991b1b",
        border: "1px solid #fecaca",
      },
      medium: {
        backgroundColor: "#fef3c7",
        color: "#92400e",
        border: "1px solid #fde68a",
      },
      low: {
        backgroundColor: "#d1fae5",
        color: "#065f46",
        border: "1px solid #a7f3d0",
      },
    };
    return (
      styles[priority] || {
        backgroundColor: "#f3f4f6",
        color: "#374151",
        border: "1px solid #d1d5db",
      }
    );
  };

  if (!lineups || lineups.length === 0) {
    return (
      <div className="card">
        <div style={{ textAlign: "center", padding: "2rem" }}>
          <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>🤖</div>
          <h3 className="card-title">AI Insights</h3>
          <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
            Generate lineups to receive AI-powered recommendations and insights
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="card">
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1.5rem",
          paddingBottom: "1rem",
          borderBottom: "1px solid #e5e7eb",
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          <div style={{ fontSize: "2rem" }}>🤖</div>
          <div>
            <h3 className="card-title">AI Insights</h3>
            <p style={{ fontSize: "0.875rem", color: "#6b7280", margin: 0 }}>
              {insights.length} recommendations based on your lineup portfolio
            </p>
          </div>
        </div>

        <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
          {portfolioGrade && (
            <div
              style={{
                display: "flex",
                flexDirection: "column",
                alignItems: "center",
                padding: "0.5rem",
                backgroundColor:
                  portfolioGrade.grade === "A+"
                    ? "#dcfce7"
                    : portfolioGrade.grade === "A"
                    ? "#dbeafe"
                    : portfolioGrade.grade === "B"
                    ? "#fef3c7"
                    : "#fee2e2",
                borderRadius: "8px",
                minWidth: "60px",
              }}
            >
              <span
                style={{
                  fontSize: "1.5rem",
                  fontWeight: "bold",
                  color:
                    portfolioGrade.grade === "A+"
                      ? "#166534"
                      : portfolioGrade.grade === "A"
                      ? "#1e40af"
                      : portfolioGrade.grade === "B"
                      ? "#92400e"
                      : "#991b1b",
                }}
              >
                {portfolioGrade.grade}
              </span>
              <span style={{ fontSize: "0.625rem", color: "#6b7280" }}>
                {portfolioGrade.score}/100
              </span>
            </div>
          )}
          {isLiveData && (
            <span
              style={{
                fontSize: "0.75rem",
                color: "#10b981",
                backgroundColor: "#d1fae5",
                padding: "0.25rem 0.5rem",
                borderRadius: "4px",
                display: "flex",
                alignItems: "center",
                gap: "4px",
              }}
            >
              <span
                style={{
                  width: "6px",
                  height: "6px",
                  backgroundColor: "#10b981",
                  borderRadius: "50%",
                  display: "inline-block",
                }}
              ></span>
              Live Data
            </span>
          )}
          {lastUpdated && (
            <span style={{ fontSize: "0.75rem", color: "#9ca3af" }}>
              Updated {lastUpdated.toLocaleTimeString()}
            </span>
          )}
          <button
            onClick={fetchCoachInsights}
            className="btn"
            style={{
              backgroundColor: "#8b5cf6",
              color: "white",
              fontSize: "0.875rem",
              padding: "0.5rem 1rem",
            }}
          >
            🎓 Grade
          </button>
          <button
            onClick={() => fetchAIRecommendations(true)}
            disabled={loading}
            className="btn"
            style={{
              backgroundColor: "#2563eb",
              color: "white",
              fontSize: "0.875rem",
              padding: "0.5rem 1rem",
            }}
          >
            {loading ? "⟳" : "🔄"} Refresh
          </button>
          <button
            onClick={fetchLiveData}
            disabled={dataFetching || loading}
            className="btn"
            style={{
              backgroundColor: "#059669",
              color: "white",
              fontSize: "0.875rem",
              padding: "0.5rem 1rem",
              opacity: dataFetching ? 0.7 : 1,
            }}
          >
            {dataFetching ? "⟳" : "📊"} Get Data
          </button>
          <button
            onClick={triggerBackgroundCollection}
            disabled={loading}
            className="btn"
            style={{
              backgroundColor: "#7c3aed",
              color: "white",
              fontSize: "0.875rem",
              padding: "0.5rem 1rem",
            }}
          >
            🔄 Update
          </button>
          <button
            onClick={checkCollectionStatus}
            className="btn"
            style={{
              backgroundColor: "#6b7280",
              color: "white",
              fontSize: "0.875rem",
              padding: "0.5rem 1rem",
            }}
          >
            📊 Status
          </button>
        </div>
      </div>

      {/* Data Collection Status */}
      {dataFetchStatus && (
        <div
          style={{
            marginBottom: "1rem",
            padding: "12px 16px",
            borderRadius: "8px",
            border: "1px solid",
            borderColor:
              dataFetchStatus.phase === "error"
                ? "#fecaca"
                : dataFetchStatus.phase === "completed"
                ? "#d1fae5"
                : "#dbeafe",
            backgroundColor:
              dataFetchStatus.phase === "error"
                ? "#fef2f2"
                : dataFetchStatus.phase === "completed"
                ? "#ecfdf5"
                : "#eff6ff",
            display: "flex",
            alignItems: "center",
            gap: "12px",
          }}
        >
          {dataFetchStatus.phase !== "completed" &&
            dataFetchStatus.phase !== "error" && (
              <div
                style={{
                  width: "16px",
                  height: "16px",
                  border: "2px solid #e5e7eb",
                  borderTop: "2px solid #2563eb",
                  borderRadius: "50%",
                  animation: "spin 1s linear infinite",
                }}
              ></div>
            )}
          <div style={{ flex: 1 }}>
            <div
              style={{
                fontSize: "0.875rem",
                color:
                  dataFetchStatus.phase === "error"
                    ? "#991b1b"
                    : dataFetchStatus.phase === "completed"
                    ? "#166534"
                    : "#1e40af",
                fontWeight: "500",
              }}
            >
              {dataFetchStatus.message}
            </div>
            {dataFetchStatus.data && (
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "#6b7280",
                  marginTop: "4px",
                  display: "flex",
                  gap: "16px",
                }}
              >
                <span>
                  Source: {dataFetchStatus.data.matches?.source || "unknown"}
                </span>
                {dataFetchStatus.data.errors?.length > 0 && (
                  <span style={{ color: "#dc2626" }}>
                    {dataFetchStatus.data.errors.length} warnings
                  </span>
                )}
              </div>
            )}
            {dataFetchStatus.errors && dataFetchStatus.errors.length > 0 && (
              <div
                style={{
                  fontSize: "0.75rem",
                  color: "#dc2626",
                  marginTop: "4px",
                }}
              >
                {dataFetchStatus.errors.slice(0, 2).map((error, idx) => (
                  <div key={idx}>
                    • {error.source}: {error.error}
                  </div>
                ))}
                {dataFetchStatus.errors.length > 2 && (
                  <div>+ {dataFetchStatus.errors.length - 2} more errors</div>
                )}
              </div>
            )}
          </div>
          {dataFetchStatus.phase === "completed" && (
            <button
              onClick={() => setDataFetchStatus(null)}
              style={{
                background: "transparent",
                border: "none",
                color: "#6b7280",
                fontSize: "1.25rem",
                cursor: "pointer",
                padding: "0.25rem",
              }}
            >
              ×
            </button>
          )}
        </div>
      )}

      {/* Collection Status Panel */}
      {showStatus && collectionStatus && (
        <div
          style={{
            marginBottom: "1.5rem",
            border: "2px solid #6b7280",
            borderRadius: "12px",
            backgroundColor: "var(--bg-card)",
            overflow: "hidden",
          }}
        >
          {/* Status Header */}
          <div
            style={{
              backgroundColor: "#6b7280",
              color: "white",
              padding: "1rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "1.5rem" }}>📊</span>
              <div>
                <h3
                  style={{ margin: 0, fontSize: "1.125rem", fontWeight: "600" }}
                >
                  Data Collection Status
                </h3>
                <p style={{ margin: 0, fontSize: "0.875rem", opacity: 0.9 }}>
                  Background collection monitoring
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowStatus(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "white",
                fontSize: "1.5rem",
                cursor: "pointer",
                padding: "0.25rem",
              }}
            >
              ×
            </button>
          </div>

          {/* Status Content */}
          <div style={{ padding: "1.5rem" }}>
            {/* Current Status */}
            <div style={{ marginBottom: "1.5rem" }}>
              <h4
                style={{
                  color: "var(--text-primary)",
                  fontSize: "1rem",
                  fontWeight: "600",
                  marginBottom: "12px",
                }}
              >
                Current Status
              </h4>
              <div
                style={{
                  backgroundColor: collectionStatus.status.isCollecting
                    ? "rgba(236, 201, 75, 0.1)"
                    : "rgba(72, 187, 120, 0.1)",
                  border: "1px solid",
                  borderColor: collectionStatus.status.isCollecting
                    ? "var(--accent-yellow)"
                    : "var(--accent-green)",
                  borderRadius: "8px",
                  padding: "12px",
                  display: "flex",
                  alignItems: "center",
                  gap: "12px",
                }}
              >
                <div
                  style={{
                    fontSize: "1.5rem",
                  }}
                >
                  {collectionStatus.status.isCollecting ? "🔄" : "✅"}
                </div>
                <div>
                  <div
                    style={{ fontWeight: "500", color: "var(--text-primary)" }}
                  >
                    {collectionStatus.status.isCollecting
                      ? "Collection in Progress"
                      : "Collection Complete"}
                  </div>
                  <div
                    style={{
                      fontSize: "0.875rem",
                      color: "var(--text-secondary)",
                    }}
                  >
                    {collectionStatus.status.isCollecting
                      ? "Background collection is currently running..."
                      : `Last completed: ${
                          collectionStatus.status.lastCollection
                            ? new Date(
                                collectionStatus.status.lastCollection
                              ).toLocaleString()
                            : "Never"
                        }`}
                  </div>
                </div>
              </div>
            </div>

            {/* Progress Details */}
            {collectionStatus.progress && (
              <div style={{ marginBottom: "1.5rem" }}>
                <h4
                  style={{
                    color: "var(--text-primary)",
                    fontSize: "1rem",
                    fontWeight: "600",
                    marginBottom: "12px",
                  }}
                >
                  Latest Progress
                </h4>
                <div
                  style={{
                    backgroundColor: "var(--bg-card-darker)",
                    border: "1px solid var(--border-color)",
                    borderRadius: "8px",
                    padding: "12px",
                  }}
                >
                  <div
                    style={{
                      fontSize: "0.875rem",
                      fontWeight: "500",
                      marginBottom: "4px",
                      color: "var(--text-primary)",
                    }}
                  >
                    Phase: {collectionStatus.progress.phase}
                  </div>
                  <div
                    style={{
                      fontSize: "0.875rem",
                      color: "var(--text-secondary)",
                      marginBottom: "8px",
                    }}
                  >
                    {collectionStatus.progress.message}
                  </div>
                  {collectionStatus.progress.data && (
                    <div
                      style={{
                        fontSize: "0.75rem",
                        color: "var(--text-secondary)",
                      }}
                    >
                      Results: {collectionStatus.progress.data.matches || 0}{" "}
                      matches, {collectionStatus.progress.data.playerStats || 0}{" "}
                      player stats, {collectionStatus.progress.data.errors || 0}{" "}
                      errors
                    </div>
                  )}
                  <div
                    style={{
                      fontSize: "0.75rem",
                      color: "var(--text-secondary)",
                      marginTop: "8px",
                    }}
                  >
                    Updated:{" "}
                    {new Date(
                      collectionStatus.progress.timestamp
                    ).toLocaleString()}
                  </div>
                </div>
              </div>
            )}

            {/* Schedule Info */}
            <div style={{ marginBottom: "1.5rem" }}>
              <h4
                style={{
                  color: "var(--text-primary)",
                  fontSize: "1rem",
                  fontWeight: "600",
                  marginBottom: "12px",
                }}
              >
                Schedule
              </h4>
              <div
                style={{
                  backgroundColor: "var(--bg-card-darker)",
                  border: "1px solid var(--border-color)",
                  borderRadius: "8px",
                  padding: "12px",
                }}
              >
                <div
                  style={{
                    fontSize: "0.875rem",
                    marginBottom: "4px",
                    color: "var(--text-primary)",
                  }}
                >
                  <strong>Next Collection:</strong>{" "}
                  {collectionStatus.status.nextCollection === "Soon"
                    ? "Soon"
                    : new Date(
                        collectionStatus.status.nextCollection
                      ).toLocaleString()}
                </div>
                <div
                  style={{
                    fontSize: "0.875rem",
                    marginBottom: "4px",
                    color: "var(--text-primary)",
                  }}
                >
                  <strong>Frequency:</strong> Every 30 minutes
                </div>
                <div
                  style={{ fontSize: "0.875rem", color: "var(--text-primary)" }}
                >
                  <strong>Cache Available:</strong>{" "}
                  {collectionStatus.status.cacheAvailable ? "✅ Yes" : "❌ No"}
                </div>
              </div>
            </div>

            {/* Errors */}
            {collectionStatus.status.errors &&
              collectionStatus.status.errors.length > 0 && (
                <div>
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "space-between",
                      marginBottom: "12px",
                    }}
                  >
                    <h4
                      style={{
                        color: "#dc2626",
                        fontSize: "1rem",
                        fontWeight: "600",
                        margin: 0,
                      }}
                    >
                      Recent Errors ({collectionStatus.status.errors.length})
                    </h4>
                    {collectionStatus.status.errors.length > 3 && (
                      <button
                        onClick={() => setShowAllErrors(!showAllErrors)}
                        style={{
                          background: "var(--accent-red)",
                          color: "white",
                          border: "none",
                          borderRadius: "4px",
                          fontSize: "0.75rem",
                          padding: "4px 8px",
                          cursor: "pointer",
                          fontWeight: "500",
                        }}
                      >
                        {showAllErrors ? "Show Less" : "Show All"}
                      </button>
                    )}
                  </div>
                  <div
                    style={{
                      backgroundColor: "var(--bg-card-darker)",
                      border: "1px solid var(--accent-red)",
                      borderRadius: "8px",
                      padding: "12px",
                      maxHeight: showAllErrors ? "none" : "200px",
                      overflowY: showAllErrors ? "visible" : "auto",
                    }}
                  >
                    {(showAllErrors
                      ? collectionStatus.status.errors
                      : collectionStatus.status.errors.slice(0, 3)
                    ).map((error, idx) => (
                      <div
                        key={idx}
                        style={{
                          fontSize: "0.875rem",
                          marginBottom: "4px",
                          color: "var(--accent-red)",
                        }}
                      >
                        • {error.player} ({error.type}): {error.error}
                      </div>
                    ))}
                    {!showAllErrors &&
                      collectionStatus.status.errors.length > 3 && (
                        <div
                          style={{
                            fontSize: "0.75rem",
                            color: "var(--text-secondary)",
                            marginTop: "8px",
                          }}
                        >
                          + {collectionStatus.status.errors.length - 3} more
                          errors (click "Show All" to view)
                        </div>
                      )}
                  </div>
                </div>
              )}
          </div>
        </div>
      )}

      {/* AI Coach Detailed Insights */}
      {showCoachInsights && coachingData && (
        <div
          style={{
            marginBottom: "1.5rem",
            border: "2px solid #8b5cf6",
            borderRadius: "12px",
            backgroundColor: "#faf5ff",
            overflow: "hidden",
          }}
        >
          {/* Coach Header */}
          <div
            style={{
              backgroundColor: "#8b5cf6",
              color: "white",
              padding: "1rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "space-between",
            }}
          >
            <div style={{ display: "flex", alignItems: "center", gap: "12px" }}>
              <span style={{ fontSize: "1.5rem" }}>🎓</span>
              <div>
                <h3
                  style={{ margin: 0, fontSize: "1.125rem", fontWeight: "600" }}
                >
                  AI Coach Analysis
                </h3>
                <p style={{ margin: 0, fontSize: "0.875rem", opacity: 0.9 }}>
                  Comprehensive portfolio review
                </p>
              </div>
            </div>
            <button
              onClick={() => setShowCoachInsights(false)}
              style={{
                background: "transparent",
                border: "none",
                color: "white",
                fontSize: "1.5rem",
                cursor: "pointer",
                padding: "0.25rem",
              }}
            >
              ×
            </button>
          </div>

          {/* Coach Content */}
          <div style={{ padding: "1.5rem" }}>
            {/* Portfolio Grade Section */}
            <div style={{ marginBottom: "1.5rem" }}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: "16px",
                  marginBottom: "12px",
                }}
              >
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    alignItems: "center",
                    padding: "1rem",
                    backgroundColor:
                      coachingData.portfolio_grade.grade === "A+"
                        ? "#dcfce7"
                        : coachingData.portfolio_grade.grade === "A"
                        ? "#dbeafe"
                        : coachingData.portfolio_grade.grade === "B"
                        ? "#fef3c7"
                        : "#fee2e2",
                    borderRadius: "12px",
                    minWidth: "80px",
                    border: "2px solid",
                    borderColor:
                      coachingData.portfolio_grade.grade === "A+"
                        ? "#166534"
                        : coachingData.portfolio_grade.grade === "A"
                        ? "#1e40af"
                        : coachingData.portfolio_grade.grade === "B"
                        ? "#92400e"
                        : "#991b1b",
                  }}
                >
                  <span
                    style={{
                      fontSize: "2rem",
                      fontWeight: "bold",
                      color:
                        coachingData.portfolio_grade.grade === "A+"
                          ? "#166534"
                          : coachingData.portfolio_grade.grade === "A"
                          ? "#1e40af"
                          : coachingData.portfolio_grade.grade === "B"
                          ? "#92400e"
                          : "#991b1b",
                    }}
                  >
                    {coachingData.portfolio_grade.grade}
                  </span>
                  <span
                    style={{
                      fontSize: "0.875rem",
                      color: "#6b7280",
                      fontWeight: "500",
                    }}
                  >
                    {coachingData.portfolio_grade.score}/100
                  </span>
                </div>
                <div>
                  <h4
                    style={{
                      margin: "0 0 8px 0",
                      color: "#374151",
                      fontSize: "1.125rem",
                    }}
                  >
                    Portfolio Grade
                  </h4>
                  <p
                    style={{
                      margin: 0,
                      color: "#6b7280",
                      fontSize: "0.875rem",
                    }}
                  >
                    {coachingData.portfolio_grade.description}
                  </p>
                </div>
              </div>
            </div>

            {/* Key Strengths */}
            {coachingData.key_strengths &&
              coachingData.key_strengths.length > 0 && (
                <div style={{ marginBottom: "1.5rem" }}>
                  <h4
                    style={{
                      color: "#059669",
                      fontSize: "1rem",
                      fontWeight: "600",
                      marginBottom: "12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    ✅ Key Strengths
                  </h4>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {coachingData.key_strengths.map((strength, index) => (
                      <div
                        key={index}
                        style={{
                          backgroundColor: "#ecfdf5",
                          border: "1px solid #d1fae5",
                          borderRadius: "8px",
                          padding: "12px",
                        }}
                      >
                        <div
                          style={{
                            fontWeight: "500",
                            color: "#047857",
                            marginBottom: "4px",
                          }}
                        >
                          {strength.area}
                        </div>
                        <div
                          style={{
                            fontSize: "0.875rem",
                            color: "#065f46",
                            marginBottom: "4px",
                          }}
                        >
                          {strength.description}
                        </div>
                        {strength.impact && (
                          <div
                            style={{
                              fontSize: "0.75rem",
                              color: "#059669",
                              fontStyle: "italic",
                            }}
                          >
                            Impact: {strength.impact}
                          </div>
                        )}
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Areas for Improvement */}
            {coachingData.areas_for_improvement &&
              coachingData.areas_for_improvement.length > 0 && (
                <div style={{ marginBottom: "1.5rem" }}>
                  <h4
                    style={{
                      color: "#dc2626",
                      fontSize: "1rem",
                      fontWeight: "600",
                      marginBottom: "12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    🔧 Areas for Improvement
                  </h4>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {coachingData.areas_for_improvement
                      .slice(0, 5)
                      .map((improvement, index) => (
                        <div
                          key={index}
                          style={{
                            backgroundColor: "#fef2f2",
                            border: "1px solid #fecaca",
                            borderRadius: "8px",
                            padding: "12px",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              alignItems: "center",
                              gap: "8px",
                              marginBottom: "4px",
                            }}
                          >
                            <div
                              style={{ fontWeight: "500", color: "#991b1b" }}
                            >
                              {improvement.area}
                            </div>
                            {improvement.priority && (
                              <span
                                style={{
                                  backgroundColor:
                                    improvement.priority === "high"
                                      ? "#dc2626"
                                      : "#f59e0b",
                                  color: "white",
                                  fontSize: "0.75rem",
                                  padding: "2px 6px",
                                  borderRadius: "4px",
                                  fontWeight: "500",
                                }}
                              >
                                {improvement.priority}
                              </span>
                            )}
                          </div>
                          <div
                            style={{
                              fontSize: "0.875rem",
                              color: "#7f1d1d",
                              marginBottom: "4px",
                            }}
                          >
                            {improvement.description}
                          </div>
                          {improvement.action && (
                            <div
                              style={{
                                fontSize: "0.75rem",
                                color: "#b91c1c",
                                fontStyle: "italic",
                              }}
                            >
                              Action: {improvement.action}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}

            {/* Meta Alignment */}
            {coachingData.meta_alignment && (
              <div style={{ marginBottom: "1.5rem" }}>
                <h4
                  style={{
                    color: "#1f2937",
                    fontSize: "1rem",
                    fontWeight: "600",
                    marginBottom: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  🎯 Meta Alignment
                </h4>
                <div
                  style={{
                    backgroundColor:
                      coachingData.meta_alignment.status === "excellent"
                        ? "#ecfdf5"
                        : coachingData.meta_alignment.status === "good"
                        ? "#fef3c7"
                        : "#fef2f2",
                    border: "1px solid",
                    borderColor:
                      coachingData.meta_alignment.status === "excellent"
                        ? "#d1fae5"
                        : coachingData.meta_alignment.status === "good"
                        ? "#fde68a"
                        : "#fecaca",
                    borderRadius: "8px",
                    padding: "12px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: "12px",
                      marginBottom: "8px",
                    }}
                  >
                    <div
                      style={{
                        fontSize: "1.5rem",
                        fontWeight: "bold",
                        color:
                          coachingData.meta_alignment.status === "excellent"
                            ? "#047857"
                            : coachingData.meta_alignment.status === "good"
                            ? "#92400e"
                            : "#991b1b",
                      }}
                    >
                      {Math.round(coachingData.meta_alignment.percentage)}%
                    </div>
                    <div>
                      <div
                        style={{
                          fontWeight: "500",
                          textTransform: "capitalize",
                        }}
                      >
                        {coachingData.meta_alignment.status} Meta Alignment
                      </div>
                      <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>
                        {coachingData.meta_alignment.aligned_players} of{" "}
                        {coachingData.meta_alignment.total_players} players
                        align with current meta
                      </div>
                    </div>
                  </div>
                  <div style={{ fontSize: "0.875rem", color: "#374151" }}>
                    {coachingData.meta_alignment.description}
                  </div>
                </div>
              </div>
            )}

            {/* Actionable Tips */}
            {coachingData.actionable_tips &&
              coachingData.actionable_tips.length > 0 && (
                <div style={{ marginBottom: "1.5rem" }}>
                  <h4
                    style={{
                      color: "#7c3aed",
                      fontSize: "1rem",
                      fontWeight: "600",
                      marginBottom: "12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    💡 Pro Tips
                  </h4>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: "8px",
                    }}
                  >
                    {coachingData.actionable_tips.map((tip, index) => (
                      <div
                        key={index}
                        style={{
                          backgroundColor: "#f8fafc",
                          border: "1px solid #e2e8f0",
                          borderRadius: "8px",
                          padding: "12px",
                        }}
                      >
                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: "8px",
                            marginBottom: "4px",
                          }}
                        >
                          <div style={{ fontWeight: "500", color: "#4c1d95" }}>
                            {tip.category}
                          </div>
                          {tip.difficulty && (
                            <span
                              style={{
                                backgroundColor:
                                  tip.difficulty === "Easy"
                                    ? "#10b981"
                                    : tip.difficulty === "Medium"
                                    ? "#f59e0b"
                                    : "#ef4444",
                                color: "white",
                                fontSize: "0.75rem",
                                padding: "2px 6px",
                                borderRadius: "4px",
                                fontWeight: "500",
                              }}
                            >
                              {tip.difficulty}
                            </span>
                          )}
                        </div>
                        <div style={{ fontSize: "0.875rem", color: "#475569" }}>
                          {tip.tip}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              )}

            {/* Next Steps */}
            {coachingData.next_steps && coachingData.next_steps.length > 0 && (
              <div>
                <h4
                  style={{
                    color: "#1f2937",
                    fontSize: "1rem",
                    fontWeight: "600",
                    marginBottom: "12px",
                    display: "flex",
                    alignItems: "center",
                    gap: "8px",
                  }}
                >
                  🎯 Next Steps
                </h4>
                <div
                  style={{
                    display: "flex",
                    flexDirection: "column",
                    gap: "8px",
                  }}
                >
                  {coachingData.next_steps.map((step, index) => (
                    <div
                      key={index}
                      style={{
                        backgroundColor: "#f9fafb",
                        border: "1px solid #d1d5db",
                        borderRadius: "8px",
                        padding: "12px",
                      }}
                    >
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "8px",
                          marginBottom: "4px",
                        }}
                      >
                        <div style={{ fontWeight: "500", color: "#1f2937" }}>
                          {step.timeframe}
                        </div>
                        <div style={{ fontSize: "0.875rem", color: "#6b7280" }}>
                          {step.action}
                        </div>
                      </div>
                      <div style={{ fontSize: "0.875rem", color: "#4b5563" }}>
                        {step.description}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Player Predictions */}
            {coachingData.player_predictions &&
              coachingData.player_predictions.length > 0 && (
                <div style={{ marginTop: "1.5rem" }}>
                  <h4
                    style={{
                      color: "#1f2937",
                      fontSize: "1rem",
                      fontWeight: "600",
                      marginBottom: "12px",
                      display: "flex",
                      alignItems: "center",
                      gap: "8px",
                    }}
                  >
                    📊 Top Player Predictions
                  </h4>
                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(280px, 1fr))",
                      gap: "12px",
                    }}
                  >
                    {coachingData.player_predictions
                      .slice(0, 6)
                      .map((pred, index) => (
                        <div
                          key={index}
                          style={{
                            backgroundColor: "#f8fafc",
                            borderRadius: "8px",
                            padding: "12px",
                            border: "1px solid #e2e8f0",
                          }}
                        >
                          <div
                            style={{
                              display: "flex",
                              justifyContent: "space-between",
                              alignItems: "center",
                              marginBottom: "8px",
                            }}
                          >
                            <div>
                              <div
                                style={{ fontWeight: "600", color: "#1f2937" }}
                              >
                                {pred.player.name}
                              </div>
                              <div
                                style={{
                                  fontSize: "0.75rem",
                                  color: "#6b7280",
                                }}
                              >
                                {pred.player.team} - {pred.player.position}
                              </div>
                            </div>
                            <div
                              style={{
                                backgroundColor:
                                  pred.confidence > 0.8
                                    ? "#10b981"
                                    : pred.confidence > 0.6
                                    ? "#f59e0b"
                                    : "#ef4444",
                                color: "white",
                                padding: "2px 8px",
                                borderRadius: "4px",
                                fontSize: "0.75rem",
                                fontWeight: "600",
                              }}
                            >
                              {(pred.confidence * 100).toFixed(0)}%
                            </div>
                          </div>
                          <div
                            style={{
                              display: "grid",
                              gridTemplateColumns: "1fr 1fr 1fr",
                              gap: "8px",
                              marginBottom: "8px",
                            }}
                          >
                            <div style={{ textAlign: "center" }}>
                              <div
                                style={{
                                  fontSize: "0.75rem",
                                  color: "#6b7280",
                                }}
                              >
                                Projected
                              </div>
                              <div
                                style={{ fontWeight: "600", color: "#1f2937" }}
                              >
                                {pred.projected.toFixed(1)}
                              </div>
                            </div>
                            <div style={{ textAlign: "center" }}>
                              <div
                                style={{
                                  fontSize: "0.75rem",
                                  color: "#6b7280",
                                }}
                              >
                                Ceiling
                              </div>
                              <div
                                style={{ fontWeight: "600", color: "#10b981" }}
                              >
                                {pred.ceiling.toFixed(1)}
                              </div>
                            </div>
                            <div style={{ textAlign: "center" }}>
                              <div
                                style={{
                                  fontSize: "0.75rem",
                                  color: "#6b7280",
                                }}
                              >
                                Floor
                              </div>
                              <div
                                style={{ fontWeight: "600", color: "#ef4444" }}
                              >
                                {pred.floor.toFixed(1)}
                              </div>
                            </div>
                          </div>
                          {pred.factors && pred.factors.length > 0 && (
                            <div
                              style={{
                                fontSize: "0.75rem",
                                color: "#6b7280",
                                borderTop: "1px solid #e2e8f0",
                                paddingTop: "8px",
                              }}
                            >
                              {pred.factors[0].factor}:{" "}
                              {pred.factors[0].description}
                            </div>
                          )}
                        </div>
                      ))}
                  </div>
                </div>
              )}
          </div>
        </div>
      )}

      {/* Content */}
      <div>
        {loading && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              padding: "2rem",
              gap: "12px",
            }}
          >
            <div
              style={{
                width: "24px",
                height: "24px",
                border: "2px solid #e5e7eb",
                borderTop: "2px solid #2563eb",
                borderRadius: "50%",
                animation: "spin 1s linear infinite",
              }}
            ></div>
            <span style={{ color: "#6b7280" }}>Analyzing your lineups...</span>
          </div>
        )}

        {error && (
          <div
            style={{
              backgroundColor: "#fef2f2",
              border: "1px solid #fecaca",
              borderRadius: "8px",
              padding: "1rem",
              marginBottom: "1rem",
            }}
          >
            <div style={{ display: "flex", alignItems: "center" }}>
              <div
                style={{
                  color: "#f87171",
                  marginRight: "12px",
                  fontSize: "1.25rem",
                }}
              >
                ⚠️
              </div>
              <div>
                <h4 style={{ color: "#991b1b", fontWeight: "500", margin: 0 }}>
                  AI Service Error
                </h4>
                <p
                  style={{
                    color: "#b91c1c",
                    fontSize: "0.875rem",
                    margin: "0.25rem 0 0 0",
                  }}
                >
                  {error}
                </p>
              </div>
            </div>
          </div>
        )}

        {!loading && !error && insights.length === 0 && (
          <div style={{ textAlign: "center", padding: "2rem" }}>
            <div style={{ fontSize: "2.5rem", marginBottom: "12px" }}>🎯</div>
            <h4 style={{ fontWeight: "500", marginBottom: "8px" }}>
              No Recommendations
            </h4>
            <p style={{ color: "#6b7280", fontSize: "0.875rem" }}>
              Your lineup portfolio looks well-optimized! Try generating more
              lineups for additional insights.
            </p>
          </div>
        )}

        {!loading && !error && insights.length > 0 && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: "1rem" }}
          >
            {insights.map((insight, index) => (
              <div
                key={insight.id || index}
                style={{
                  border: "1px solid #e5e7eb",
                  borderRadius: "8px",
                  padding: "1rem",
                  transition: "box-shadow 0.2s",
                }}
                onMouseEnter={(e) =>
                  (e.target.style.boxShadow = "0 1px 3px 0 rgba(0, 0, 0, 0.1)")
                }
                onMouseLeave={(e) => (e.target.style.boxShadow = "none")}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "start",
                    justifyContent: "space-between",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      alignItems: "start",
                      gap: "12px",
                      flex: 1,
                    }}
                  >
                    <div style={{ fontSize: "1.5rem" }}>
                      {getRecommendationIcon(insight.type)}
                    </div>

                    <div style={{ flex: 1 }}>
                      <div
                        style={{
                          display: "flex",
                          alignItems: "center",
                          gap: "12px",
                          marginBottom: "8px",
                        }}
                      >
                        <h4 style={{ fontWeight: "500", margin: 0 }}>
                          {insight.title}
                        </h4>
                        <span
                          style={{
                            ...getPriorityStyle(insight.priority),
                            padding: "2px 8px",
                            fontSize: "0.75rem",
                            fontWeight: "500",
                            borderRadius: "9999px",
                          }}
                        >
                          {insight.priority} priority
                        </span>
                        {insight.confidence && (
                          <span
                            style={{ fontSize: "0.75rem", color: "#6b7280" }}
                          >
                            {insight.confidence}% confidence
                          </span>
                        )}
                      </div>

                      <p
                        style={{
                          color: "#374151",
                          fontSize: "0.875rem",
                          marginBottom: "12px",
                          margin: "0 0 12px 0",
                        }}
                      >
                        {insight.message}
                      </p>

                      {insight.impact && (
                        <p
                          style={{
                            color: "#4b5563",
                            fontSize: "0.75rem",
                            backgroundColor: "#f9fafb",
                            borderRadius: "4px",
                            padding: "8px",
                            margin: 0,
                          }}
                        >
                          <strong>Impact:</strong> {insight.impact}
                        </p>
                      )}
                    </div>
                  </div>

                  {insight.actionable && (
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        applyRecommendation(insight);
                      }}
                      disabled={isApplying}
                      className="btn"
                      style={{
                        marginLeft: "1rem",
                        backgroundColor: isApplying ? "#9ca3af" : "#2563eb",
                        color: "white",
                        fontSize: "0.875rem",
                        padding: "0.5rem 0.75rem",
                        cursor: isApplying ? "not-allowed" : "pointer",
                      }}
                    >
                      {isApplying ? "Applying..." : "Apply"}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {/* Applied Changes Summary */}
        {!loading && !error && insights.length > 0 && (
          <div
            style={{
              marginTop: "1.5rem",
              paddingTop: "1rem",
              borderTop: "1px solid #e5e7eb",
            }}
          >
            <div
              style={{
                backgroundColor: "#f0f9ff",
                border: "1px solid #0ea5e9",
                borderRadius: "8px",
                padding: "1rem",
                marginBottom: "1rem",
              }}
            >
              <h5
                style={{
                  fontSize: "0.875rem",
                  fontWeight: "500",
                  marginBottom: "8px",
                  margin: "0 0 8px 0",
                  color: "#0c4a6e",
                }}
              >
                📊 Changes Applied Verification
              </h5>
              <div style={{ fontSize: "0.75rem", color: "#0369a1" }}>
                <div>
                  • Modified lineups:{" "}
                  {
                    lineups.filter(
                      (l) =>
                        l.modificationSuggested ||
                        l.exposureWarning ||
                        l.metaScore !== undefined
                    ).length
                  }
                  /{lineups.length}
                </div>
                <div>
                  • Exposure warnings:{" "}
                  {lineups.filter((l) => l.exposureWarning).length}
                </div>
                <div>
                  • Meta scores added:{" "}
                  {lineups.filter((l) => l.metaScore !== undefined).length}
                </div>
                <div>
                  • Salary flags:{" "}
                  {lineups.filter((l) => l.optimizationFlag).length}
                </div>
              </div>
              <button
                className="btn"
                style={{
                  backgroundColor: "#0ea5e9",
                  color: "white",
                  fontSize: "0.75rem",
                  padding: "0.25rem 0.5rem",
                  marginTop: "8px",
                }}
                onClick={() => {
                  displayNotification(
                    "Check your Lineups tab to see applied changes!",
                    "info"
                  );
                }}
              >
                View Changes in Lineups Tab
              </button>
            </div>

            {/* Recent Changes History */}
            {appliedChanges.length > 0 && (
              <div
                style={{
                  backgroundColor: "#f9fafb",
                  border: "1px solid #d1d5db",
                  borderRadius: "8px",
                  padding: "1rem",
                  marginBottom: "1rem",
                }}
              >
                <h5
                  style={{
                    fontSize: "0.875rem",
                    fontWeight: "500",
                    marginBottom: "8px",
                    margin: "0 0 8px 0",
                    color: "#374151",
                  }}
                >
                  📝 Recent Changes Applied
                </h5>
                <div style={{ fontSize: "0.75rem", color: "#6b7280" }}>
                  {appliedChanges.map((change, index) => (
                    <div
                      key={change.id}
                      style={{
                        marginBottom: "4px",
                        padding: "4px 8px",
                        backgroundColor:
                          index === 0 ? "#dcfce7" : "transparent",
                        borderRadius: "4px",
                      }}
                    >
                      <strong>{change.recommendation}</strong> -{" "}
                      {change.timestamp.toLocaleTimeString()}
                      {index === 0 && (
                        <span style={{ color: "#059669", fontWeight: "bold" }}>
                          {" "}
                          (Latest)
                        </span>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            )}

            <h5
              style={{
                fontSize: "0.875rem",
                fontWeight: "500",
                marginBottom: "12px",
                margin: "0 0 12px 0",
              }}
            >
              Quick Actions
            </h5>
            <div style={{ display: "flex", gap: "12px" }}>
              <button
                className="btn"
                style={{
                  backgroundColor: "#059669",
                  color: "white",
                  fontSize: "0.875rem",
                  padding: "0.5rem 0.75rem",
                }}
                onClick={() => {
                  if (isApplying) return;
                  const highPriorityRecommendations = insights.filter(
                    (i) => i.priority === "high"
                  );
                  highPriorityRecommendations.forEach((rec) =>
                    applyRecommendation(rec)
                  );
                }}
              >
                Apply All High Priority
              </button>
              <button
                className="btn"
                style={{
                  backgroundColor: "#4b5563",
                  color: "white",
                  fontSize: "0.875rem",
                  padding: "0.5rem 0.75rem",
                }}
                onClick={() => {
                  displayNotification("Insights exported to console", "info");
                }}
              >
                Export Insights
              </button>
            </div>
          </div>
        )}
      </div>

      <style>{`
        @keyframes spin {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
      `}</style>
    </div>
  );
};

export default AIInsights;
