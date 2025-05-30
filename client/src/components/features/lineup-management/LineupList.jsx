import React, { useState, useMemo, useEffect } from "react";
import { calculateLineupROI } from "../../../utils/roiIntegration";
import {
  GlobalStats,
  LineupFilters,
  LineupActions,
  LineupGrid,
  SortControls,
} from "./index";

const LineupList = ({
  lineups = [],
  playerData = [],
  onDelete,
  onEdit,
  onExport,
  contestInfo = null,
}) => {
  // Pagination state
  const [currentPage, setCurrentPage] = useState(1);
  const [itemsPerPage, setItemsPerPage] = useState(25);
  const [totalPages, setTotalPages] = useState(1);

  // Sorting and filtering state
  const [sortBy, setSortBy] = useState("nexusScore");
  const [sortDirection, setSortDirection] = useState("desc");
  const [starredLineups, setStarredLineups] = useState({});
  const [showStarredOnly, setShowStarredOnly] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [showExportMenu, setShowExportMenu] = useState(false);

  // Close export menu when clicking outside
  useEffect(() => {
    const handleClickOutside = (event) => {
      if (showExportMenu && !event.target.closest("[data-export-menu]")) {
        setShowExportMenu(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [showExportMenu]);

  // Global stats calculations
  const [globalStats, setGlobalStats] = useState({
    avgProjection: 0,
    avgOwnership: 0,
    avgSalary: 0,
    avgNexusScore: 0,
    avgROI: 0,
  });

  // Calculate and process lineup metrics
  const lineupsWithMetrics = useMemo(() => {
    if (
      !lineups ||
      lineups.length === 0 ||
      !playerData ||
      playerData.length === 0
    ) {
      return [];
    }

    const processedLineups = lineups.map((lineup) => {
      // Get all players in the lineup (CPT + regular players)
      const allPlayers = lineup.cpt
        ? [lineup.cpt, ...(lineup.players || [])]
        : lineup.players || [];

      // Enrich players with full data from playerData
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

      // Calculate lineup uniqueness score (lower = more contrarian)
      const totalOwnership = playersWithData.reduce(
        (sum, p) => sum + (p.ownership || 0),
        0
      );
      const lineupOwnership = totalOwnership;

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

      // Calculate NexusScore
      const ownership = Math.max(0.1, lineupOwnership / 100);
      const leverageFactor = Math.min(1.5, Math.max(0.6, 1 / ownership));

      // Calculate stack bonus
      let stackBonus = 0;
      Object.values(teamCounts).forEach((count) => {
        if (count >= 3) stackBonus += (count - 2) * 3;
      });

      // Calculate NexusScore
      const baseScore = totalProj / 10;
      const nexusScore = Math.min(
        65,
        Math.max(25, baseScore * leverageFactor + stackBonus / 2)
      );

      // Calculate ROI if contest info is available
      let roi = null;
      if (contestInfo && contestInfo.entryFee) {
        const enrichedLineup = {
          ...lineup,
          cpt: lineup.cpt
            ? {
                ...lineup.cpt,
                projectedPoints:
                  playersWithData.find((p) => p.id === lineup.cpt.id)
                    ?.projectedPoints || 0,
              }
            : null,
          players: (lineup.players || []).map((player) => ({
            ...player,
            projectedPoints:
              playersWithData.find((p) => p.id === player.id)
                ?.projectedPoints || 0,
          })),
        };

        const roiResult = calculateLineupROI(enrichedLineup, contestInfo);
        roi = roiResult ? roiResult.roi : null;
      }

      return {
        ...lineup,
        metrics: {
          projectedPoints: totalProj,
          avgOwnership: lineupOwnership / allPlayers.length,
          totalSalary,
          geomean,
          nexusScore,
          firstPlace: 0, // Placeholder
          roi,
          stackInfo: stackString,
        },
      };
    });

    return processedLineups;
  }, [lineups, playerData, contestInfo]);

  // Update global stats whenever lineupsWithMetrics changes
  useEffect(() => {
    if (lineupsWithMetrics.length > 0) {
      const avgProjection =
        lineupsWithMetrics.reduce(
          (sum, l) => sum + l.metrics.projectedPoints,
          0
        ) / lineupsWithMetrics.length;
      const avgOwnership =
        lineupsWithMetrics.reduce((sum, l) => sum + l.metrics.avgOwnership, 0) /
        lineupsWithMetrics.length;
      const avgSalary =
        lineupsWithMetrics.reduce((sum, l) => sum + l.metrics.totalSalary, 0) /
        lineupsWithMetrics.length;
      const avgNexusScore =
        lineupsWithMetrics.reduce((sum, l) => sum + l.metrics.nexusScore, 0) /
        lineupsWithMetrics.length;
      const avgROI =
        lineupsWithMetrics.reduce((sum, l) => sum + (l.metrics.roi || 0), 0) /
        lineupsWithMetrics.length;

      setGlobalStats({
        avgProjection,
        avgOwnership,
        avgSalary,
        avgNexusScore,
        avgROI,
      });
    }
  }, [lineupsWithMetrics]);

  // Filter and sort lineups
  const filteredAndSortedLineups = useMemo(() => {
    let filtered = lineupsWithMetrics;

    // Apply starred filter
    if (showStarredOnly) {
      filtered = filtered.filter((lineup) => {
        if (!lineup.id) return false;
        return !!starredLineups[lineup.id];
      });
    }

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter((lineup) => {
        return true; // Simplified for now
      });
    }

    // Sort by selected metric
    const sorted = [...filtered].sort((a, b) => {
      let valueA, valueB;

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
        case "totalSalary":
          valueA = a.metrics.totalSalary;
          valueB = b.metrics.totalSalary;
          break;
        case "firstPlace":
          valueA = a.metrics.firstPlace;
          valueB = b.metrics.firstPlace;
          break;
        case "roi":
          valueA = a.metrics.roi || 0;
          valueB = b.metrics.roi || 0;
          break;
        default:
          valueA = a.metrics.nexusScore;
          valueB = b.metrics.nexusScore;
      }

      return sortDirection === "desc" ? valueB - valueA : valueA - valueB;
    });

    return sorted;
  }, [
    lineupsWithMetrics,
    showStarredOnly,
    starredLineups,
    searchTerm,
    sortBy,
    sortDirection,
  ]);

  // Pagination
  const paginatedLineups = useMemo(() => {
    const totalItems = filteredAndSortedLineups.length;
    const totalPagesCalc = Math.ceil(totalItems / itemsPerPage);
    setTotalPages(totalPagesCalc);

    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return filteredAndSortedLineups.slice(startIndex, endIndex);
  }, [filteredAndSortedLineups, currentPage, itemsPerPage]);

  // Handlers
  const handleToggleStar = (lineup) => {
    if (!lineup.id) return;
    setStarredLineups((prev) => ({
      ...prev,
      [lineup.id]: !prev[lineup.id],
    }));
  };

  const handleResetFilters = () => {
    setSearchTerm("");
    setShowStarredOnly(false);
    setSortBy("nexusScore");
    setSortDirection("desc");
    setCurrentPage(1);
  };

  const handleExport = async (format) => {
    try {
      const exportData = {
        lineups: filteredAndSortedLineups,
        format,
        timestamp: new Date().toISOString(),
      };

      const response = await fetch("http://localhost:3001/lineups/export", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(exportData),
      });

      if (response.ok) {
        const blob = await response.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement("a");
        a.href = url;
        a.download = `lineups_${format}_${new Date().toISOString().split("T")[0]}.${format === "json" ? "json" : "csv"}`;
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        window.URL.revokeObjectURL(url);
      }
    } catch (error) {
      console.error("Export failed:", error);
    }
  };

  if (!lineups || lineups.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "2rem", color: "#a0aec0" }}>
        No lineups to display. Generate some lineups first!
      </div>
    );
  }

  return (
    <div
      className="lineup-list"
      style={{ fontFamily: "Inter, system-ui, sans-serif" }}
    >
      <GlobalStats globalStats={globalStats} />

      <LineupFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        itemsPerPage={itemsPerPage}
        setItemsPerPage={setItemsPerPage}
        filteredCount={filteredAndSortedLineups.length}
        totalCount={lineups.length}
        onResetFilters={handleResetFilters}
      />

      <LineupActions
        lineupsCount={filteredAndSortedLineups.length}
        showExportMenu={showExportMenu}
        setShowExportMenu={setShowExportMenu}
        showStarredOnly={showStarredOnly}
        setShowStarredOnly={setShowStarredOnly}
        onExport={handleExport}
      />

      <SortControls
        sortBy={sortBy}
        setSortBy={setSortBy}
        sortDirection={sortDirection}
        setSortDirection={setSortDirection}
      />

      <LineupGrid
        currentLineups={paginatedLineups}
        playerData={playerData}
        contestInfo={contestInfo}
        currentPage={currentPage}
        itemsPerPage={itemsPerPage}
        starredLineups={starredLineups}
        onEdit={onEdit}
        onDelete={onDelete}
        onToggleStar={handleToggleStar}
      />

      {/* Pagination controls - Bottom */}
      {totalPages > 1 && (
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            marginTop: "1rem",
            padding: "0.5rem",
            backgroundColor: "#0d1829",
            borderRadius: "0.25rem",
            border: "1px solid #2d3748",
          }}
        >
          <div>
            <button
              onClick={() => setCurrentPage(1)}
              disabled={currentPage === 1}
              style={{
                background: "none",
                border: "none",
                color: currentPage === 1 ? "#4a5568" : "#4fd1c5",
                cursor: currentPage === 1 ? "not-allowed" : "pointer",
                marginRight: "0.5rem",
              }}
            >
              ««
            </button>
            <button
              onClick={() => setCurrentPage(Math.max(1, currentPage - 1))}
              disabled={currentPage === 1}
              style={{
                background: "none",
                border: "none",
                color: currentPage === 1 ? "#4a5568" : "#4fd1c5",
                cursor: currentPage === 1 ? "not-allowed" : "pointer",
                marginRight: "0.5rem",
              }}
            >
              «
            </button>
          </div>

          <span style={{ color: "#a0aec0", fontSize: "0.875rem" }}>
            Page {currentPage} of {totalPages}
          </span>

          <div>
            <button
              onClick={() =>
                setCurrentPage(Math.min(totalPages, currentPage + 1))
              }
              disabled={currentPage === totalPages}
              style={{
                background: "none",
                border: "none",
                color: currentPage === totalPages ? "#4a5568" : "#4fd1c5",
                cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                marginLeft: "0.5rem",
              }}
            >
              »
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={currentPage === totalPages}
              style={{
                background: "none",
                border: "none",
                color: currentPage === totalPages ? "#4a5568" : "#4fd1c5",
                cursor: currentPage === totalPages ? "not-allowed" : "pointer",
                marginLeft: "0.5rem",
              }}
            >
              »»
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default LineupList;
