import React, { useState, useEffect } from "react";
import { formatROI, getROIColor } from "../utils/roiIntegration";

const NexusScoreLineup = ({
  lineup,
  playerData = [],
  index = 1,
  onEdit,
  onStar,
  onDelete,
  isStarred = false,
  exposureWarning,
  modificationSuggested,
  metaScore,
  metaAligned,
  optimizationFlag,
  salaryEfficiency,
  contestInfo = null,
}) => {
  // State for lineup metrics
  const [metrics, setMetrics] = useState({
    projectedPoints: 0,
    ownership: 0,
    totalSalary: 0,
    nexusScore: 0,
    stackInfo: "",
  });

  // Helper function to safely format numeric values
  const safeFormatNumber = (value, decimals = 2) => {
    if (value === undefined || value === null) return "0.00";

    // If value is already a string, try to parse it
    if (typeof value === "string") {
      try {
        return parseFloat(value).toFixed(decimals);
      } catch (e) {
        return value;
      }
    }

    // If value is a number, use toFixed directly
    if (typeof value === "number") {
      return value.toFixed(decimals);
    }

    // Fallback
    return "0.00";
  };

  // Calculate lineup metrics when lineup or playerData changes
  useEffect(() => {
    if (!lineup) return;

    // Get all players in the lineup including CPT
    const allPlayers = lineup.cpt
      ? [lineup.cpt, ...(lineup.players || [])]
      : lineup.players || [];

    // Get complete player data with projections and ownership
    const playersWithData = allPlayers.map((player) => {
      const fullData =
        playerData.find((p) => p.id === player.id || p.name === player.name) ||
        {};
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
        playersWithData.find((p) => p.id === lineup.cpt.id)?.projectedPoints ||
        0;
      totalProj += cptProj * 1.5; // CPT is 1.5x
    }

    // Add regular players' points
    totalProj += playersWithData
      .filter((p) => p.position !== "CPT") // Skip CPT as we already counted it
      .reduce((sum, p) => sum + (p.projectedPoints || 0), 0);

    // Calculate average ownership for this lineup only
    const totalOwnership = playersWithData.reduce(
      (sum, p) => sum + (p.ownership || 0),
      0
    );
    const avgOwnership =
      playersWithData.length > 0 ? totalOwnership / playersWithData.length : 0;

    // Calculate total salary
    const totalSalary = allPlayers.reduce((sum, p) => sum + (p.salary || 0), 0);

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
    const ownership = Math.max(0.1, avgOwnership / 100); // Convert to decimal with min value
    const leverageFactor = Math.min(1.5, Math.max(0.6, 1 / ownership)); // More points for less owned lineups

    // Calculate stack bonus
    let stackBonus = 0;
    Object.values(teamCounts).forEach((count) => {
      if (count >= 3) stackBonus += (count - 2) * 3; // Bonus for 3+ stacks
    });

    // Calculate NexusScore - scale to reasonable range (25-65)
    const baseScore = totalProj / 10;
    const nexusScore = Math.min(
      65,
      Math.max(25, baseScore * leverageFactor + stackBonus / 2)
    );

    // Update metrics state with ONLY THIS LINEUP's metrics
    setMetrics({
      projectedPoints: totalProj,
      ownership: avgOwnership,
      totalSalary,
      nexusScore,
      stackInfo: stackString,
    });
  }, [lineup, playerData]);

  // Generate opponent display
  const getOpponentDisplay = (player) => {
    if (!player) return "-";

    // Try to find full player data from playerData prop
    const fullPlayerData = playerData.find(
      (p) => p.id === player.id || p.name === player.name
    );

    // Try to extract from player data or full data
    const matchup =
      player.matchup ||
      player.opponent ||
      player.opp ||
      fullPlayerData?.matchup ||
      fullPlayerData?.opponent ||
      fullPlayerData?.opp ||
      "";

    // If we have matchup data
    if (matchup) {
      // Handle different formats of matchup data
      if (typeof matchup === "string") {
        if (matchup.startsWith("vs")) return matchup;
        if (matchup.startsWith("at")) return matchup;

        // For short team codes like 'TT', 'WE', etc. - add vs prefix
        return `vs ${matchup}`;
      }
      return matchup; // Return as is if not a string
    }

    // Default opponent display with team colors for prettier display
    const opponent =
      player.opponent ||
      player.opp ||
      fullPlayerData?.opponent ||
      fullPlayerData?.opp ||
      "";
    const isAway = player.isAway || fullPlayerData?.isAway || false;

    if (opponent) {
      // Create a colorful display based on opponent team
      return (
        <span
          style={{
            color: getTeamColor(opponent),
            fontWeight: "500",
          }}
        >
          {isAway ? `at ${opponent}` : `vs ${opponent}`}
        </span>
      );
    }

    return "-";
  };

  // If no lineup is provided, return empty state
  if (!lineup) {
    return <div className="empty-lineup">No lineup selected</div>;
  }

  return (
    <div
      style={{
        backgroundColor: "#10141e",
        color: "#e2e8f0",
        borderRadius: "4px",
        overflow: "hidden",
        boxShadow: "0 2px 8px rgba(0, 0, 0, 0.3)",
        fontFamily: "Inter, system-ui, sans-serif",
        marginBottom: "12px",
      }}
    >
      {/* Header with actions */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          padding: "12px 16px",
          borderBottom: "1px solid #1a202c",
        }}
      >
        <div style={{ display: "flex", alignItems: "center" }}>
          <div
            style={{
              padding: "4px 12px",
              backgroundColor: "#1a202c",
              borderRadius: "4px",
              marginRight: "12px",
              fontWeight: "500",
              fontSize: "14px",
            }}
          >
            {index}
          </div>
          <div style={{ fontSize: "14px", color: "#cbd5e0" }}>
            {lineup.name || `Lineup ${lineup.id}`}
          </div>

          {/* AI Modification Indicators */}
          <div style={{ display: "flex", marginLeft: "12px", gap: "4px" }}>
            {lineup.exposureWarning && (
              <div
                title={lineup.exposureWarning}
                style={{
                  padding: "2px 6px",
                  backgroundColor: "#dc2626",
                  color: "white",
                  fontSize: "10px",
                  borderRadius: "4px",
                  fontWeight: "500",
                }}
              >
                ⚠️ EXPOSURE
              </div>
            )}
            {lineup.metaScore !== undefined && (
              <div
                title={`Meta Score: ${lineup.metaScore} - ${
                  lineup.metaAligned ? "Aligned" : "Not Aligned"
                }`}
                style={{
                  padding: "2px 6px",
                  backgroundColor: lineup.metaAligned ? "#059669" : "#d97706",
                  color: "white",
                  fontSize: "10px",
                  borderRadius: "4px",
                  fontWeight: "500",
                }}
              >
                🧠 META {lineup.metaScore}
              </div>
            )}
            {lineup.optimizationFlag && (
              <div
                title="Salary optimization suggested"
                style={{
                  padding: "2px 6px",
                  backgroundColor: "#0ea5e9",
                  color: "white",
                  fontSize: "10px",
                  borderRadius: "4px",
                  fontWeight: "500",
                }}
              >
                💰 SALARY
              </div>
            )}
            {lineup.modificationSuggested && (
              <div
                title="AI suggests modifications"
                style={{
                  padding: "2px 6px",
                  backgroundColor: "#7c3aed",
                  color: "white",
                  fontSize: "10px",
                  borderRadius: "4px",
                  fontWeight: "500",
                }}
              >
                🤖 AI
              </div>
            )}
          </div>
        </div>

        <div style={{ display: "flex", gap: "8px" }}>
          <button
            onClick={() => onEdit && onEdit(lineup)}
            style={{
              background: "none",
              border: "none",
              color: "#60a5fa",
              cursor: "pointer",
              fontSize: "14px",
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
              <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"></path>
              <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"></path>
            </svg>
          </button>
          <button
            onClick={() => onStar && onStar(lineup)}
            style={{
              background: "none",
              border: "none",
              color: isStarred ? "#f59e0b" : "#60a5fa",
              cursor: "pointer",
              fontSize: "14px",
            }}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill={isStarred ? "currentColor" : "none"}
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <polygon points="12 2 15.09 8.26 22 9.27 17 14.14 18.18 21.02 12 17.77 5.82 21.02 7 14.14 2 9.27 8.91 8.26 12 2"></polygon>
            </svg>
          </button>
          <button
            onClick={() => onDelete && onDelete(lineup)}
            style={{
              background: "none",
              border: "none",
              color: "#60a5fa",
              cursor: "pointer",
              fontSize: "14px",
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
              <polyline points="3 6 5 6 21 6"></polyline>
              <path d="M19 6v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6m3 0V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"></path>
            </svg>
          </button>
        </div>
      </div>

      {/* NexusScore and ROI - Individual lineup metrics, not averages */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          padding: "8px 16px",
          borderBottom: "1px solid #1a202c",
          fontSize: "14px",
          alignItems: "center",
        }}
      >
        <div
          style={{ display: "flex", alignItems: "center", flexWrap: "wrap" }}
        >
          <span style={{ marginRight: "8px", color: "#a0aec0" }}>
            NexusScore:
          </span>
          <span style={{ color: "#4fd1c5", fontWeight: "600" }}>
            {lineup.nexusScore
              ? safeFormatNumber(lineup.nexusScore, 1)
              : safeFormatNumber(metrics.nexusScore, 1)}
          </span>
          {/* ROI Display */}
          {(() => {
            // Use the ROI passed from parent (which uses our new calculation)
            const roi = lineup.roi;

            if (roi !== null && roi !== undefined) {
              return (
                <>
                  <span style={{ margin: "0 8px", color: "#4a5568" }}>|</span>
                  <span style={{ marginRight: "8px", color: "#a0aec0" }}>
                    ROI:
                  </span>
                  <span style={{ color: getROIColor(roi), fontWeight: "600" }}>
                    {formatROI(roi)}
                  </span>
                </>
              );
            }
            return null;
          })()}
          <span style={{ margin: "0 8px", color: "#4a5568" }}>|</span>
          <span style={{ marginRight: "8px", color: "#a0aec0" }}>
            First Place:
          </span>
          <span style={{ color: "#8b5cf6", fontWeight: "600" }}>
            {safeFormatNumber(lineup.firstPlace, 2)}%
          </span>
        </div>
        <div style={{ display: "flex", gap: "8px" }}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="#a0aec0"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <circle cx="12" cy="12" r="10"></circle>
            <line x1="12" y1="16" x2="12" y2="12"></line>
            <line x1="12" y1="8" x2="12.01" y2="8"></line>
          </svg>
        </div>
      </div>

      {/* Players table */}
      <table
        style={{
          width: "100%",
          borderCollapse: "collapse",
          fontSize: "14px",
        }}
      >
        <thead>
          <tr
            style={{
              backgroundColor: "#0c111b",
              color: "#a0aec0",
              fontSize: "12px",
              textAlign: "left",
            }}
          >
            <th style={{ padding: "8px 16px", width: "40px" }}>POS</th>
            <th style={{ padding: "8px", textAlign: "left" }}>NAME</th>
            <th style={{ padding: "8px", textAlign: "center", width: "80px" }}>
              OPP
            </th>
            <th style={{ padding: "8px", textAlign: "right", width: "80px" }}>
              SALARY
            </th>
            <th style={{ padding: "8px", textAlign: "right", width: "80px" }}>
              PROJ
            </th>
            <th
              style={{ padding: "8px 16px", textAlign: "right", width: "80px" }}
            >
              OWN
            </th>
          </tr>
        </thead>
        <tbody>
          {/* Captain row */}
          {lineup.cpt && (
            <tr
              style={{
                borderBottom: "1px solid #1a202c",
                backgroundColor: "#121a2e",
              }}
            >
              <td
                style={{
                  padding: "8px 16px",
                  color: "#4fd1c5",
                  fontWeight: "500",
                }}
              >
                CPT
              </td>
              <td style={{ padding: "8px" }}>
                <div style={{ display: "flex", alignItems: "center" }}>
                  <span
                    style={{
                      display: "inline-block",
                      width: "32px",
                      textAlign: "center",
                      padding: "2px 4px",
                      backgroundColor: "#1a202c",
                      color: "#4fd1c5",
                      borderRadius: "2px",
                      marginRight: "8px",
                      fontSize: "12px",
                      fontWeight: "500",
                    }}
                  >
                    {lineup.cpt.team || "UNK"}
                  </span>
                  <span>{lineup.cpt.name}</span>
                </div>
              </td>
              <td
                style={{
                  padding: "8px",
                  textAlign: "center",
                  color: "#a0aec0",
                }}
              >
                {getOpponentDisplay(lineup.cpt)}
              </td>
              <td
                style={{
                  padding: "8px",
                  textAlign: "right",
                  color: "#ecc94b",
                  fontWeight: "500",
                }}
              >
                {lineup.cpt.salary?.toLocaleString() || "0"}
              </td>
              <td
                style={{
                  padding: "8px",
                  textAlign: "right",
                  color: "#48bb78",
                  fontWeight: "500",
                }}
              >
                {safeFormatNumber(
                  (playerData.find((p) => p.id === lineup.cpt.id)
                    ?.projectedPoints ||
                    lineup.cpt.projectedPoints ||
                    0) * 1.5,
                  2
                )}
              </td>
              <td
                style={{
                  padding: "8px 16px",
                  textAlign: "right",
                  color: "#f56565",
                }}
              >
                {safeFormatNumber(
                  playerData.find((p) => p.id === lineup.cpt.id)?.ownership ||
                    lineup.cpt.ownership ||
                    0,
                  2
                )}
                %
              </td>
            </tr>
          )}

          {/* Regular players */}
          {lineup.players &&
            lineup.players.map((player, idx) => (
              <tr
                key={player.id || idx}
                style={{
                  borderBottom: "1px solid #1a202c",
                  backgroundColor: idx % 2 === 0 ? "#10141e" : "#0c111b",
                }}
              >
                <td
                  style={{
                    padding: "8px 16px",
                    color: getPositionColor(player.position),
                  }}
                >
                  {player.position}
                </td>
                <td style={{ padding: "8px" }}>
                  <div style={{ display: "flex", alignItems: "center" }}>
                    <span
                      style={{
                        display: "inline-block",
                        width: "32px",
                        backgroundColor: "#1a202c",
                        color: getTeamColor(player.team),
                        textAlign: "center",
                        padding: "2px 4px",
                        borderRadius: "2px",
                        marginRight: "8px",
                        fontSize: "12px",
                        fontWeight: "500",
                      }}
                    >
                      {player.team || "UNK"}
                    </span>
                    <span>{player.name}</span>
                  </div>
                </td>
                <td
                  style={{
                    padding: "8px",
                    textAlign: "center",
                    color: "#a0aec0",
                  }}
                >
                  {getOpponentDisplay(player)}
                </td>
                <td
                  style={{
                    padding: "8px",
                    textAlign: "right",
                    color: "#ecc94b",
                  }}
                >
                  {player.salary?.toLocaleString() || "0"}
                </td>
                <td
                  style={{
                    padding: "8px",
                    textAlign: "right",
                    color: "#48bb78",
                    fontWeight: "500",
                  }}
                >
                  {safeFormatNumber(
                    playerData.find((p) => p.id === player.id)
                      ?.projectedPoints ||
                      player.projectedPoints ||
                      0,
                    2
                  )}
                </td>
                <td
                  style={{
                    padding: "8px 16px",
                    textAlign: "right",
                    color: "#f56565",
                  }}
                >
                  {safeFormatNumber(
                    playerData.find((p) => p.id === player.id)?.ownership ||
                      player.ownership ||
                      0,
                    2
                  )}
                  %
                </td>
              </tr>
            ))}

          {/* Stack info row - FIXED OWNERSHIP CALCULATION HERE */}
          <tr
            style={{
              backgroundColor: "#0c111b",
              borderTop: "1px solid #1a202c",
              color: "#a0aec0",
            }}
          >
            <td colSpan="3" style={{ padding: "8px 16px", textAlign: "left" }}>
              Stack: {metrics.stackInfo || "-"}
            </td>
            <td
              style={{
                padding: "8px",
                textAlign: "right",
                fontWeight: "500",
                color: "#ecc94b",
              }}
            >
              {metrics.totalSalary?.toLocaleString() || "0"}
            </td>
            <td
              style={{
                padding: "8px",
                textAlign: "right",
                color: "#48bb78",
                fontWeight: "500",
              }}
            >
              {safeFormatNumber(metrics.projectedPoints, 1)}
            </td>
            <td
              style={{
                padding: "8px 16px",
                textAlign: "right",
                color: "#f56565",
              }}
            >
              {(() => {
                // Get all players including captain
                const allPlayers = lineup.cpt
                  ? [lineup.cpt, ...(lineup.players || [])]
                  : lineup.players || [];

                // Calculate total ownership directly
                let totalOwnership = 0;
                allPlayers.forEach((player) => {
                  const playerInfo = playerData.find((p) => p.id === player.id);
                  const ownership =
                    player.ownership ||
                    (playerInfo ? playerInfo.ownership : 0) ||
                    0;
                  totalOwnership += ownership;
                });

                return `${Math.round(totalOwnership)}%`;
              })()}
            </td>
          </tr>
        </tbody>
      </table>
    </div>
  );
};

// Helper function for position colors
const getPositionColor = (position) => {
  const colors = {
    TOP: "#4fd1c5",
    JNG: "#68d391",
    MID: "#f687b3",
    ADC: "#63b3ed",
    SUP: "#f6ad55",
    TEAM: "#9f7aea",
    CPT: "#48bb78",
  };
  return colors[position] || "#4fd1c5";
};

// Helper function for team colors
const getTeamColor = (team) => {
  // Map of teams to colors - shortened for brevity
  const teamColors = {
    TES: "#4fd1c5",
    JDG: "#68d391",
    EDG: "#63b3ed",
    LNG: "#9f7aea",
    RNG: "#f687b3",
    WBG: "#f6ad55",
    WE: "#48bb78",
    BLG: "#4299e1",
    IG: "#ecc94b",
    FPX: "#f56565",
    OMG: "#ed8936",
    TT: "#a0aec0",
    RA: "#805ad5",
    AL: "#dd6b20",
    UP: "#667eea",
  };

  return teamColors[team] || "#4fd1c5"; // Default teal color if team not found
};

export default NexusScoreLineup;
