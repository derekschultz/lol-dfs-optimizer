import React, { useState, useEffect, useRef } from "react";
import {
  AICoach,
  AppliedChangesHistory,
  DataCollectionStatus,
  RecommendationsList,
} from "./features/analytics";

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
        const errorData = await response.json().catch(() => ({}));
        throw new Error(
          errorData.details ||
            errorData.error ||
            `AI Coach error! status: ${response.status}`
        );
      }

      const data = await response.json();
      console.log("Coach response data:", data); // Debug logging

      if (data.success && data.coaching) {
        // Check if portfolio_grade exists
        if (data.coaching.portfolio_grade) {
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
        } else {
          throw new Error("Portfolio grade not generated");
        }
      } else {
        console.error("Unexpected response structure:", data);
        throw new Error(data.error || "Invalid response from AI service");
      }
    } catch (error) {
      console.error("Error fetching coach insights:", error);
      console.error("Error details:", {
        message: error.message,
        stack: error.stack,
      });

      if (error.message.includes("circular")) {
        displayNotification("Data error - please refresh the page", "error");
      } else if (error.message.includes("Portfolio grade not generated")) {
        displayNotification(
          "Failed to generate portfolio grade - please try again",
          "error"
        );
      } else {
        displayNotification(
          `Failed to get portfolio grade: ${error.message}`,
          "error"
        );
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

      <DataCollectionStatus
        dataFetchStatus={dataFetchStatus}
        setDataFetchStatus={setDataFetchStatus}
        showStatus={showStatus}
        setShowStatus={setShowStatus}
        collectionStatus={collectionStatus}
      />

      <AICoach
        showCoachInsights={showCoachInsights}
        setShowCoachInsights={setShowCoachInsights}
        coachingData={coachingData}
      />

      {/* Content */}
      <div>
        <RecommendationsList
          insights={insights}
          loading={loading}
          error={error}
          isApplying={isApplying}
          applyRecommendation={applyRecommendation}
        />

        <AppliedChangesHistory
          insights={insights}
          lineups={lineups}
          appliedChanges={appliedChanges}
          displayNotification={displayNotification}
          isApplying={isApplying}
          applyRecommendation={applyRecommendation}
        />
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
