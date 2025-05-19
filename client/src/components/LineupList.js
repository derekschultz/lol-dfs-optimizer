import React, { useState, useMemo, useEffect } from "react";
import NexusScoreLineup from "./NexusScoreLineup";

const LineupList = ({
  lineups = [],
  playerData = [],
  onDelete,
  onEdit,
  onRunSimulation,
  onExport,
}) => {
  const [sortBy, setSortBy] = useState("nexusScore");
  const [sortDirection, setSortDirection] = useState("desc");
  const [starredLineups, setStarredLineups] = useState({});
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [selectedRank, setSelectedRank] = useState(1);

  // Global stats calculations
  const [globalStats, setGlobalStats] = useState({
    avgProjection: 0,
    avgOwnership: 0,
    avgSalary: 0,
    avgGeomean: 0,
  });

  // Calculate and process lineup metrics
  const lineupsWithMetrics = useMemo(() => {
    if (!lineups || lineups.length === 0) {
      return [];
    }

    const processedLineups = lineups.map((lineup) => {
      // Get all players in the lineup including CPT
      const allPlayers = lineup.cpt
        ? [lineup.cpt, ...(lineup.players || [])]
        : lineup.players || [];

      // Get complete player data with projections and ownership
      const playersWithData = allPlayers.map((player) => {
        const fullData =
          playerData.find(
            (p) => p.id === player.id || p.name === player.name
          ) || {};
        return {
          ...player,
          projectedPoints:
            player.projectedPoints || fullData.projectedPoints || 0,
          ownership: player.ownership || fullData.ownership || 0,
        };
      });

      // Calculate total points (CPT gets 1.5x)
      let totalProj = 0;
      if (lineup.cpt) {
        const cptProj =
          playersWithData.find((p) => p.id === lineup.cpt.id)
            ?.projectedPoints || 0;
        totalProj += cptProj * 1.5; // CPT is 1.5x
      }

      // Add regular players' points
      totalProj += playersWithData
        .filter((p) => p.position !== "CPT") // Skip CPT as we already counted it
        .reduce((sum, p) => sum + (p.projectedPoints || 0), 0);

      // Calculate average ownership
      const totalOwnership = playersWithData.reduce(
        (sum, p) => sum + (p.ownership || 0),
        0
      );
      const avgOwn =
        playersWithData.length > 0
          ? totalOwnership / playersWithData.length
          : 0;

      // Calculate total salary
      const totalSalary = allPlayers.reduce(
        (sum, p) => sum + (p.salary || 0),
        0
      );

      // Calculate geomean (geometric mean of projections)
      const validProjs = playersWithData
        .map((p) => p.projectedPoints)
        .filter((p) => p > 0);
      const geomean =
        validProjs.length > 0
          ? Math.pow(
              validProjs.reduce((product, p) => product * Math.max(0.1, p), 1),
              1 / validProjs.length
            )
          : 0;

      // Calculate stack info - count by team
      const teamCounts = {};
      allPlayers.forEach((player) => {
        if (player.team) {
          teamCounts[player.team] = (teamCounts[player.team] || 0) + 1;
        }
      });

      // Format stack info string (e.g. "4|2" for 4 players from one team, 2 from another)
      const stackString = Object.values(teamCounts)
        .filter((count) => count > 1)
        .sort((a, b) => b - a)
        .join("|");

      // Calculate NexusScore (equivalent to SaberScore in the concept)
      const ownership = Math.max(0.1, avgOwn / 100); // Convert to decimal with min value
      const leverageFactor = Math.min(1.5, Math.max(0.6, 1 / ownership)); // More points for less owned lineups

      // Calculate stack bonus
      let stackBonus = 0;
      Object.values(teamCounts).forEach((count) => {
        if (count >= 3) stackBonus += (count - 2) * 3; // Bonus for 3+ stacks
      });

      // Calculate NexusScore
      const nexusScore = (totalProj * leverageFactor + stackBonus) / 7;

      // Calculate ROI - using formula or real data if available
      const roi =
        lineup.roi !== undefined
          ? lineup.roi
          : ((nexusScore / 100) * 2 - 1) * 100 + Math.random() * 50; // Modified to be percentage-based with potential negative values

      return {
        ...lineup,
        metrics: {
          projectedPoints: totalProj,
          avgOwnership: avgOwn,
          totalSalary,
          geomean,
          nexusScore,
          stackInfo: stackString,
          roi,
          firstPlace: lineup.firstPlace || (nexusScore / 400).toFixed(2), // Derive from NexusScore if not available
        },
      };
    });

    return processedLineups;
  }, [lineups, playerData]);

  // Update global stats whenever lineupsWithMetrics changes
  useEffect(() => {
    if (lineupsWithMetrics.length > 0) {
      const avgProj =
        lineupsWithMetrics.reduce(
          (sum, l) => sum + l.metrics.projectedPoints,
          0
        ) / lineupsWithMetrics.length;
      const avgOwn =
        lineupsWithMetrics.reduce((sum, l) => sum + l.metrics.avgOwnership, 0) /
        lineupsWithMetrics.length;
      const avgSal =
        lineupsWithMetrics.reduce((sum, l) => sum + l.metrics.totalSalary, 0) /
        lineupsWithMetrics.length;
      const avgGeo =
        lineupsWithMetrics.reduce(
          (sum, l) => sum + (l.metrics.geomean || 0),
          0
        ) / lineupsWithMetrics.length;

      setGlobalStats({
        avgProjection: avgProj,
        avgOwnership: avgOwn,
        avgSalary: avgSal,
        avgGeomean: avgGeo,
      });
    }
  }, [lineupsWithMetrics]);

  // Sort lineups based on current sort criteria
  const sortedLineups = useMemo(() => {
    let filtered = lineupsWithMetrics;

    // Apply starred filter if enabled
    if (showStarredOnly) {
      filtered = filtered.filter((lineup) => starredLineups[lineup.id]);
    }

    // Sort by selected metric
    return filtered.sort((a, b) => {
      let valueA, valueB;

      // Determine what values to compare based on sortBy
      switch (sortBy) {
        case "nexusScore":
          valueA = a.metrics.nexusScore;
          valueB = b.metrics.nexusScore;
          break;
        case "projection":
          valueA = a.metrics.projectedPoints;
          valueB = b.metrics.projectedPoints;
          break;
        case "ownership":
          valueA = a.metrics.avgOwnership;
          valueB = b.metrics.avgOwnership;
          break;
        case "salary":
          valueA = a.metrics.totalSalary;
          valueB = b.metrics.totalSalary;
          break;
        case "roi":
          valueA = a.metrics.roi;
          valueB = b.metrics.roi;
          break;
        case "firstPlace":
          valueA = a.metrics.firstPlace;
          valueB = b.metrics.firstPlace;
          break;
        default:
          valueA = a.metrics.nexusScore;
          valueB = b.metrics.nexusScore;
      }

      // Apply sort direction
      return sortDirection === "desc" ? valueB - valueA : valueA - valueB;
    });
  }, [
    lineupsWithMetrics,
    sortBy,
    sortDirection,
    starredLineups,
    showStarredOnly,
  ]);

  // Toggle star status for a lineup
  const handleToggleStar = (lineup) => {
    setStarredLineups((prev) => ({
      ...prev,
      [lineup.id]: !prev[lineup.id],
    }));
  };

  // No lineups available
  if (!lineups || lineups.length === 0) {
    return (
      <div
        style={{
          backgroundColor: "#10141e",
          padding: "2rem",
          borderRadius: "4px",
          textAlign: "center",
          color: "#a0aec0",
        }}
      >
        <h3 style={{ color: "#4fd1c5", marginBottom: "1rem" }}>
          No Lineups Available
        </h3>
        <p>Import lineups or generate new ones to get started.</p>
      </div>
    );
  }

  return (
    <div
      className="lineup-list"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      {/* Header */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
          backgroundColor: "#10141e",
          padding: "0.75rem 1rem",
          borderRadius: "4px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <div style={{ display: "flex", alignItems: "center" }}>
            <span
              style={{
                marginRight: "0.5rem",
                color: "#a0aec0",
                fontSize: "0.875rem",
              }}
            >
              My Lineups ({lineups.length})
            </span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#a0aec0"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
              style={{ marginRight: "0.25rem" }}
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>

          <div
            style={{
              borderLeft: "1px solid #1a202c",
              height: "24px",
              margin: "0 1rem",
            }}
          ></div>

          <div style={{ display: "flex", alignItems: "center" }}>
            <span
              style={{
                marginRight: "0.5rem",
                color: "#a0aec0",
                fontSize: "0.875rem",
              }}
            >
              Unique Rank
            </span>
            <div
              style={{
                display: "flex",
                alignItems: "center",
                backgroundColor: "#1a202c",
                padding: "0.25rem 0.5rem",
                borderRadius: "4px",
                cursor: "pointer",
              }}
            >
              <span style={{ color: "#e2e8f0", fontSize: "0.875rem" }}>
                {selectedRank}
              </span>
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="#a0aec0"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
                style={{ marginLeft: "0.25rem" }}
              >
                <polyline points="6 9 12 15 18 9"></polyline>
              </svg>
            </div>
          </div>

          <div
            style={{
              borderLeft: "1px solid #1a202c",
              height: "24px",
              margin: "0 1rem",
            }}
          ></div>

          <div style={{ display: "flex", alignItems: "center" }}>
            <span
              style={{
                marginRight: "0.5rem",
                color: "#a0aec0",
                fontSize: "0.875rem",
              }}
            >
              NexusScore
            </span>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#a0aec0"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polyline points="6 9 12 15 18 9"></polyline>
            </svg>
          </div>
        </div>

        <div style={{ display: "flex", gap: "0.5rem" }}>
          <div
            style={{
              backgroundColor: "#1a202c",
              padding: "0.25rem 0.5rem",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#a0aec0"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <rect x="3" y="3" width="7" height="7"></rect>
              <rect x="14" y="3" width="7" height="7"></rect>
              <rect x="14" y="14" width="7" height="7"></rect>
              <rect x="3" y="14" width="7" height="7"></rect>
            </svg>
          </div>
          <div
            style={{
              backgroundColor: "#1a202c",
              padding: "0.25rem 0.5rem",
              borderRadius: "4px",
              cursor: "pointer",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="#a0aec0"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <line x1="8" y1="6" x2="21" y2="6"></line>
              <line x1="8" y1="12" x2="21" y2="12"></line>
              <line x1="8" y1="18" x2="21" y2="18"></line>
              <line x1="3" y1="6" x2="3.01" y2="6"></line>
              <line x1="3" y1="12" x2="3.01" y2="12"></line>
              <line x1="3" y1="18" x2="3.01" y2="18"></line>
            </svg>
          </div>
        </div>
      </div>

      {/* Global Stats Overview */}
      <div
        id="global-stats-panel"
        style={{
          marginBottom: "1.5rem",
          backgroundColor: "#0d1829",
          padding: "1rem",
          borderRadius: "0.5rem",
          border: "1px solid #2d3748",
          boxShadow: "0 4px 6px rgba(0, 0, 0, 0.1)",
          position: "relative",
          zIndex: 10,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            marginBottom: "0.75rem",
          }}
        >
          <h3
            style={{
              color: "#4fd1c5",
              margin: 0,
              fontSize: "1rem",
              fontWeight: "bold",
            }}
          >
            Global Lineup Statistics
          </h3>
        </div>

        <div
          style={{
            display: "flex",
            gap: "1rem",
            color: "#d1d5db",
            fontSize: "0.875rem",
          }}
        >
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <span style={{ color: "#90cdf4", marginBottom: "0.25rem" }}>
              Average Projection
            </span>
            <span
              style={{
                color: "#48bb78",
                fontWeight: "bold",
                fontSize: "1.125rem",
              }}
            >
              {globalStats.avgProjection.toFixed(2)}
            </span>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <span style={{ color: "#90cdf4", marginBottom: "0.25rem" }}>
              Average Ownership
            </span>
            <span
              style={{
                color: "#f56565",
                fontWeight: "bold",
                fontSize: "1.125rem",
              }}
            >
              {globalStats.avgOwnership.toFixed(1)}%
            </span>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <span style={{ color: "#90cdf4", marginBottom: "0.25rem" }}>
              Average Salary
            </span>
            <span
              style={{
                color: "#ecc94b",
                fontWeight: "bold",
                fontSize: "1.125rem",
              }}
            >
              ${Math.round(globalStats.avgSalary).toLocaleString()}
            </span>
          </div>
          <div style={{ flex: 1, display: "flex", flexDirection: "column" }}>
            <span style={{ color: "#90cdf4", marginBottom: "0.25rem" }}>
              Average Geomean
            </span>
            <span
              style={{
                color: "#4299e1",
                fontWeight: "bold",
                fontSize: "1.125rem",
              }}
            >
              {globalStats.avgGeomean.toFixed(2)}
            </span>
          </div>
        </div>
      </div>

      {/* Lineup actions */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
          backgroundColor: "#10141e",
          padding: "0.75rem 1rem",
          borderRadius: "4px",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <span
            style={{
              color: "#a0aec0",
              marginRight: "0.5rem",
              fontSize: "0.875rem",
            }}
          >
            Lineups
          </span>
          <div
            style={{
              backgroundColor: "#1a202c",
              padding: "0.25rem 0.5rem",
              borderRadius: "4px",
              color: "#e2e8f0",
              fontSize: "0.875rem",
              fontWeight: "500",
            }}
          >
            {lineups.length}
          </div>
        </div>

        <div style={{ display: "flex", gap: "1rem" }}>
          <button
            onClick={() => onExport && onExport("csv")}
            style={{
              background: "none",
              border: "none",
              color: "#4fd1c5",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"></path>
              <polyline points="7 10 12 15 17 10"></polyline>
              <line x1="12" y1="15" x2="12" y2="3"></line>
            </svg>
            <span>Export</span>
          </button>

          <button
            onClick={() => setShowStarredOnly(!showStarredOnly)}
            style={{
              background: "none",
              border: "none",
              color: showStarredOnly ? "#f59e0b" : "#4fd1c5",
              cursor: "pointer",
              display: "flex",
              alignItems: "center",
              gap: "0.25rem",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill={showStarredOnly ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
            <span>{showStarredOnly ? "All Lineups" : "Starred Only"}</span>
          </button>
        </div>
      </div>

      {/* Sort controls */}
      <div
        style={{
          display: "flex",
          justifyContent: "flex-end",
          marginBottom: "1rem",
        }}
      >
        <div
          style={{
            display: "flex",
            backgroundColor: "#10141e",
            borderRadius: "4px",
            overflow: "hidden",
            fontSize: "0.75rem",
          }}
        >
          <button
            onClick={() => setSortBy("nexusScore")}
            style={{
              padding: "0.5rem 0.75rem",
              background: sortBy === "nexusScore" ? "#1a202c" : "transparent",
              border: "none",
              color: sortBy === "nexusScore" ? "#4fd1c5" : "#a0aec0",
              cursor: "pointer",
            }}
          >
            NexusScore
          </button>
          <button
            onClick={() => setSortBy("roi")}
            style={{
              padding: "0.5rem 0.75rem",
              background: sortBy === "roi" ? "#1a202c" : "transparent",
              border: "none",
              color: sortBy === "roi" ? "#4fd1c5" : "#a0aec0",
              cursor: "pointer",
            }}
          >
            ROI
          </button>
          <button
            onClick={() => setSortBy("projection")}
            style={{
              padding: "0.5rem 0.75rem",
              background: sortBy === "projection" ? "#1a202c" : "transparent",
              border: "none",
              color: sortBy === "projection" ? "#4fd1c5" : "#a0aec0",
              cursor: "pointer",
            }}
          >
            Projection
          </button>
          <button
            onClick={() => setSortBy("ownership")}
            style={{
              padding: "0.5rem 0.75rem",
              background: sortBy === "ownership" ? "#1a202c" : "transparent",
              border: "none",
              color: sortBy === "ownership" ? "#4fd1c5" : "#a0aec0",
              cursor: "pointer",
            }}
          >
            Ownership
          </button>
          <button
            onClick={() => setSortBy("firstPlace")}
            style={{
              padding: "0.5rem 0.75rem",
              background: sortBy === "firstPlace" ? "#1a202c" : "transparent",
              border: "none",
              color: sortBy === "firstPlace" ? "#4fd1c5" : "#a0aec0",
              cursor: "pointer",
            }}
          >
            First Place %
          </button>
          <button
            onClick={() =>
              setSortDirection((prev) => (prev === "asc" ? "desc" : "asc"))
            }
            style={{
              padding: "0.5rem 0.75rem",
              background: "#1a202c",
              border: "none",
              color: "#a0aec0",
              cursor: "pointer",
            }}
          >
            {sortDirection === "desc" ? "↓" : "↑"}
          </button>
        </div>
      </div>

      {/* Lineups list with individual lineup components */}
      <div style={{ display: "flex", flexDirection: "column", gap: "0.5rem" }}>
        {sortedLineups.map((lineup, index) => (
          <NexusScoreLineup
            key={lineup.id || `lineup-${index}`}
            lineup={{
              ...lineup,
              // Pass the calculated metrics
              nexusScore: lineup.metrics.nexusScore,
              roi: lineup.metrics.roi,
              firstPlace: lineup.metrics.firstPlace,
            }}
            playerData={playerData}
            index={index + 1}
            onEdit={onEdit}
            onStar={() => handleToggleStar(lineup)}
            onDelete={onDelete}
            isStarred={!!starredLineups[lineup.id]}
          />
        ))}
      </div>

      {/* Run simulation button at bottom */}
      {sortedLineups.length > 0 && (
        <div
          style={{
            display: "flex",
            justifyContent: "center",
            marginTop: "1.5rem",
          }}
        >
          <button
            onClick={() => onRunSimulation && onRunSimulation()}
            style={{
              backgroundColor: "#38b2ac",
              color: "white",
              border: "none",
              borderRadius: "4px",
              padding: "0.5rem 1.5rem",
              fontWeight: "500",
              cursor: "pointer",
              transition: "background-color 0.2s",
              display: "flex",
              alignItems: "center",
              gap: "0.5rem",
            }}
            onMouseOver={(e) =>
              (e.currentTarget.style.backgroundColor = "#319795")
            }
            onMouseOut={(e) =>
              (e.currentTarget.style.backgroundColor = "#38b2ac")
            }
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="5 3 19 12 5 21 5 3"></polygon>
            </svg>
            Run Simulation
          </button>
        </div>
      )}
    </div>
  );
};

export default LineupList;
