import React, { useState, useMemo } from "react";

const StackExposure = ({ lineups = [], playerData = [], onTargetExposureUpdate }) => {
  const [activeStackSize, setActiveStackSize] = useState("4");
  const [sortBy, setSortBy] = useState("team");
  const [sortDirection, setSortDirection] = useState("asc");
  const [targetExposures, setTargetExposures] = useState({});
  const [isEditMode, setIsEditMode] = useState(false);

  // Calculate stack exposures from lineups
  const stackExposures = useMemo(() => {
    // Only show teams if we have player data uploaded
    if (!playerData || playerData.length === 0) {
      return [];
    }
    
    // Get unique teams from player data
    let teams = [...new Set(playerData.map(p => p.team))].filter(Boolean);
    
    // If no teams from player data, try to get from lineups as fallback
    if (teams.length === 0 && lineups.length > 0) {
      const lineupTeams = new Set();
      lineups.forEach(lineup => {
        if (lineup.cpt?.team) lineupTeams.add(lineup.cpt.team);
        if (lineup.players) {
          lineup.players.forEach(player => {
            if (player?.team) lineupTeams.add(player.team);
          });
        }
      });
      teams = [...lineupTeams];
    }
    
    // If still no teams, return empty (don't show default teams without data)
    if (teams.length === 0) {
      return [];
    }
    
    // Initialize team stack data
    const teamStackData = teams.map(team => ({
      team,
      projPoints: playerData
        .filter(p => p.team === team)
        .reduce((sum, p) => sum + (p.projectedPoints || 0), 0)
        .toFixed(1),
      twoManStacks: 0,
      threeManStacks: 0,
      fourManStacks: 0,
      twoManExp: 0,
      threeManExp: 0,
      fourManExp: 0,
      minExp: 0,
      maxExp: 0
    }));

    // Count stacks in each lineup
    lineups.forEach(lineup => {
      // Get all players in the lineup (captain + regular players)
      const allPlayers = [];
      if (lineup.cpt) allPlayers.push(lineup.cpt);
      if (lineup.players) allPlayers.push(...lineup.players);

      // Count players by team
      const teamCounts = {};
      allPlayers.forEach(player => {
        if (player?.team) {
          teamCounts[player.team] = (teamCounts[player.team] || 0) + 1;
        }
      });

      // Update stack counts for each team
      Object.entries(teamCounts).forEach(([team, count]) => {
        const teamData = teamStackData.find(t => t.team === team);
        if (teamData) {
          // Count different stack sizes
          if (count >= 2) {
            teamData.twoManStacks++;
          }
          if (count >= 3) {
            teamData.threeManStacks++;
          }
          if (count >= 4) {
            teamData.fourManStacks++;
          }
        }
      });
    });

    // Calculate exposure percentages
    teamStackData.forEach(team => {
      team.twoManExp = lineups.length > 0 ? Math.round((team.twoManStacks / lineups.length) * 100) : 0;
      team.threeManExp = lineups.length > 0 ? Math.round((team.threeManStacks / lineups.length) * 100) : 0;
      team.fourManExp = lineups.length > 0 ? Math.round((team.fourManStacks / lineups.length) * 100) : 0;
      
      // Set default min/max values to 0
      team.minExp = 0;
      team.maxExp = 0;
    });

    return teamStackData;
  }, [lineups, playerData, activeStackSize]);

  // Filter by stack size
  const filteredExposures = useMemo(() => {
    let filtered = [...stackExposures];

    // Sort the data
    filtered.sort((a, b) => {
      let aVal, bVal;
      
      switch (sortBy) {
        case "team":
          aVal = a.team;
          bVal = b.team;
          break;
        case "projPoints":
          aVal = parseFloat(a.projPoints);
          bVal = parseFloat(b.projPoints);
          break;
        case "minExp":
        case "maxExp":
          // Sort by the currently displayed exposure based on active stack size
          if (activeStackSize === "all" || activeStackSize === "4") {
            aVal = parseInt(a.fourManExp);
            bVal = parseInt(b.fourManExp);
          } else if (activeStackSize === "3") {
            aVal = parseInt(a.threeManExp);
            bVal = parseInt(b.threeManExp);
          } else if (activeStackSize === "2") {
            aVal = parseInt(a.twoManExp);
            bVal = parseInt(b.twoManExp);
          } else {
            aVal = parseInt(a.fourManExp);
            bVal = parseInt(b.fourManExp);
          }
          break;
        case "twoManExp":
          aVal = parseInt(a.twoManExp);
          bVal = parseInt(b.twoManExp);
          break;
        case "threeManExp":
          aVal = parseInt(a.threeManExp);
          bVal = parseInt(b.threeManExp);
          break;
        case "fourManExp":
          aVal = parseInt(a.fourManExp);
          bVal = parseInt(b.fourManExp);
          break;
        case "overallExp":
          aVal = parseInt(a.overallExp);
          bVal = parseInt(b.overallExp);
          break;
        default:
          aVal = a.team;
          bVal = b.team;
      }

      // Handle NaN values
      if (isNaN(aVal)) aVal = 0;
      if (isNaN(bVal)) bVal = 0;

      if (aVal < bVal) return sortDirection === "asc" ? -1 : 1;
      if (aVal > bVal) return sortDirection === "asc" ? 1 : -1;
      return 0;
    });

    return filtered;
  }, [stackExposures, sortBy, sortDirection, activeStackSize]);

  const handleSort = (column) => {
    if (sortBy === column) {
      setSortDirection(sortDirection === "asc" ? "desc" : "asc");
    } else {
      setSortBy(column);
      setSortDirection("asc");
    }
  };

  const getSortIcon = (column) => {
    if (sortBy !== column) return (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ marginLeft: "8px", opacity: 0.4 }}>
        <path d="M10 6L13 9H7L10 6Z" fill="#64748B"/>
        <path d="M10 14L7 11H13L10 14Z" fill="#64748B"/>
      </svg>
    );
    return sortDirection === "asc" ? (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ marginLeft: "8px" }}>
        <path d="M10 5L14 10H6L10 5Z" fill="#38BDF8" stroke="#0EA5E9" strokeWidth="0.5"/>
      </svg>
    ) : (
      <svg width="20" height="20" viewBox="0 0 20 20" fill="none" style={{ marginLeft: "8px" }}>
        <path d="M10 15L6 10H14L10 15Z" fill="#38BDF8" stroke="#0EA5E9" strokeWidth="0.5"/>
      </svg>
    );
  };

  const handleTargetExposureChange = (team, stackSize, value) => {
    const newTargetExposures = {
      ...targetExposures,
      [`${team}_${stackSize}`]: value === "" ? null : parseInt(value)
    };
    setTargetExposures(newTargetExposures);
    
    // Notify parent component if callback provided - fix key format for backend
    if (onTargetExposureUpdate) {
      // Convert stackSize format: "2_target" -> "2", "all_target" -> "4"
      const actualStackSize = stackSize.replace('_target', '');
      const numericStackSize = actualStackSize === 'all' ? '4' : actualStackSize;
      
      onTargetExposureUpdate({
        team,
        stackSize: numericStackSize,
        targetExposure: value === "" ? null : parseInt(value)
      });
    }
  };

  const saveTargetExposures = () => {
    setIsEditMode(false);
    // Send all target exposures to parent component
    if (onTargetExposureUpdate) {
      Object.entries(targetExposures).forEach(([key, value]) => {
        const parts = key.split('_');
        if (parts.length >= 2) {
          const team = parts[0];
          const stackSizeRaw = parts[1].replace('_target', '');
          const numericStackSize = stackSizeRaw === 'all' ? '4' : stackSizeRaw;
          
          onTargetExposureUpdate({
            team,
            stackSize: numericStackSize,
            targetExposure: value
          });
        }
      });
    }
    console.log("Saving target exposures:", targetExposures);
  };

  const cancelEdit = () => {
    setIsEditMode(false);
    // Reset any unsaved changes if needed
  };

  const clearTargets = () => {
    setTargetExposures({});
  };

  const applyTargets = () => {
    // Send all current target exposures to parent
    if (onTargetExposureUpdate) {
      Object.entries(targetExposures).forEach(([key, value]) => {
        const parts = key.split('_');
        if (parts.length >= 2) {
          const team = parts[0];
          const stackSizeRaw = parts[1].replace('_target', '');
          const numericStackSize = stackSizeRaw === 'all' ? '4' : stackSizeRaw;
          
          onTargetExposureUpdate({
            team,
            stackSize: numericStackSize,
            targetExposure: value
          });
        }
      });
    }
    console.log("Applied target exposures:", targetExposures);
  };

  return (
    <div style={{ 
      backgroundColor: "#0F172A", 
      padding: "24px", 
      borderRadius: "12px",
      border: "1px solid #1E293B" 
    }}>
      {/* Header */}
      <div style={{ marginBottom: "24px" }}>
        <h2 style={{ 
          fontSize: "24px", 
          fontWeight: "600", 
          color: "#38BDF8", 
          margin: "0 0 8px 0" 
        }}>
          Team Stack Exposure
        </h2>
        <p style={{ 
          fontSize: "14px", 
          color: "#64748B", 
          margin: 0 
        }}>
          {!playerData || playerData.length === 0
            ? "Upload player projections (ROO) and team stacks to view and set target exposures"
            : lineups.length > 0 
              ? `Track and manage team stack exposure percentages across your ${lineups.length} lineups`
              : "Set target stack exposure percentages before generating lineups"
          }
        </p>
      </div>

      {/* Stack size filter tabs */}
      <div style={{ marginBottom: "24px" }}>
        <div style={{ 
          display: "flex", 
          backgroundColor: "#1E293B", 
          borderRadius: "8px", 
          padding: "4px",
          gap: "4px",
          border: "1px solid #334155"
        }}>
          {[
            { key: "all", label: "All Stacks" },
            { key: "2", label: "2-stacks" },
            { key: "3", label: "3-stacks" },
            { key: "4", label: "4-stacks" }
          ].map(tab => (
            <button
              key={tab.key}
              onClick={() => setActiveStackSize(tab.key)}
              style={{
                flex: 1,
                padding: "12px 20px",
                border: "none",
                borderRadius: "6px",
                backgroundColor: activeStackSize === tab.key ? "#059669" : "transparent",
                color: activeStackSize === tab.key ? "white" : "#94A3B8",
                fontWeight: activeStackSize === tab.key ? "600" : "500",
                fontSize: "14px",
                cursor: "pointer",
                transition: "all 0.2s ease"
              }}
            >
              {tab.label}
            </button>
          ))}
        </div>
      </div>

      {/* Stats Cards */}
      <div style={{ 
        display: "grid", 
        gridTemplateColumns: "repeat(3, 1fr)", 
        gap: "16px", 
        marginBottom: "24px" 
      }}>
        <div style={{ 
          backgroundColor: "#1E293B", 
          padding: "20px", 
          borderRadius: "8px",
          border: "1px solid #334155"
        }}>
          <p style={{ fontSize: "14px", color: "#94A3B8", margin: "0 0 8px 0" }}>Total Lineups</p>
          <p style={{ fontSize: "32px", fontWeight: "600", color: "#F1F5F9", margin: 0 }}>{lineups.length}</p>
        </div>
        <div style={{ 
          backgroundColor: "#1E293B", 
          padding: "20px", 
          borderRadius: "8px",
          border: "1px solid #334155"
        }}>
          <p style={{ fontSize: "14px", color: "#94A3B8", margin: "0 0 8px 0" }}>Teams with {activeStackSize === "all" ? "4" : activeStackSize}-stacks</p>
          <p style={{ fontSize: "32px", fontWeight: "600", color: "#F1F5F9", margin: 0 }}>
            {filteredExposures.filter(team => {
              if (activeStackSize === "all" || activeStackSize === "4") return team.fourManExp > 0;
              if (activeStackSize === "3") return team.threeManExp > 0;
              if (activeStackSize === "2") return team.twoManExp > 0;
              return false;
            }).length}
          </p>
        </div>
        <div style={{ 
          backgroundColor: "#1E293B", 
          padding: "20px", 
          borderRadius: "8px",
          border: "1px solid #334155"
        }}>
          <p style={{ fontSize: "14px", color: "#94A3B8", margin: "0 0 8px 0" }}>Avg Exposure</p>
          <p style={{ fontSize: "32px", fontWeight: "600", color: "#F1F5F9", margin: 0 }}>
            {filteredExposures.length > 0 ? 
              Math.round(filteredExposures.reduce((sum, team) => {
                if (activeStackSize === "all" || activeStackSize === "4") return sum + team.fourManExp;
                if (activeStackSize === "3") return sum + team.threeManExp;
                if (activeStackSize === "2") return sum + team.twoManExp;
                return sum;
              }, 0) / filteredExposures.length) : 0
            }%
          </p>
        </div>
      </div>

      {filteredExposures.length === 0 ? (
        <div style={{ 
          textAlign: "center", 
          padding: "3rem 2rem", 
          color: "#64748B",
          backgroundColor: "#1E293B",
          borderRadius: "8px",
          border: "1px solid #334155"
        }}>
          <div style={{ marginBottom: "16px" }}>
            <svg width="48" height="48" viewBox="0 0 24 24" fill="none" style={{ margin: "0 auto", display: "block" }}>
              <path d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" stroke="#64748B" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          </div>
          <h3 style={{ fontSize: "18px", fontWeight: "600", color: "#E2E8F0", margin: "0 0 8px 0" }}>
            Upload Data Required
          </h3>
          <p style={{ margin: "0 0 16px 0", lineHeight: "1.5" }}>
            {!playerData || playerData.length === 0
              ? "Upload player projections (ROO) and team stacks on the Upload tab to view teams and set target exposures."
              : "No team data available - check your uploaded player projections file."
            }
          </p>
          {(!playerData || playerData.length === 0) && (
            <p style={{ fontSize: "14px", color: "#94A3B8", margin: 0 }}>
              Once uploaded, you'll be able to set target stack exposures for each team before generating lineups.
            </p>
          )}
        </div>
      ) : (
        <div style={{ overflowX: "auto" }}>
          <table style={{ 
            width: "100%", 
            borderCollapse: "collapse",
            backgroundColor: "transparent"
          }}>
            <thead>
              <tr style={{ backgroundColor: "#1E293B" }}>
                <th style={{ 
                  padding: "16px 20px", 
                  textAlign: "left", 
                  fontWeight: "600",
                  color: "#94A3B8",
                  fontSize: "12px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  cursor: "pointer",
                  userSelect: "none",
                  borderBottom: "1px solid #334155"
                }} onClick={() => handleSort("team")}>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px" }}>
                    Teams {getSortIcon("team")}
                  </span>
                </th>
                <th style={{ 
                  padding: "16px 20px", 
                  textAlign: "center", 
                  fontWeight: "600",
                  color: "#94A3B8",
                  fontSize: "12px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  cursor: "pointer",
                  userSelect: "none",
                  borderBottom: "1px solid #334155"
                }} onClick={() => handleSort("projPoints")}>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px", justifyContent: "center" }}>
                    Proj Points {getSortIcon("projPoints")}
                  </span>
                </th>
                <th style={{ 
                  padding: "16px 20px", 
                  textAlign: "center", 
                  fontWeight: "600",
                  color: "#94A3B8",
                  fontSize: "12px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  cursor: "pointer",
                  userSelect: "none",
                  borderBottom: "1px solid #334155"
                }} onClick={() => handleSort("minExp")}>
                  <span style={{ display: "flex", alignItems: "center", gap: "4px", justifyContent: "center" }}>
                    {activeStackSize === "all" ? "4" : activeStackSize}-stacks Exp {getSortIcon("minExp")}
                  </span>
                </th>
                <th style={{ 
                  padding: "16px 20px", 
                  textAlign: "center", 
                  fontWeight: "600",
                  color: "#94A3B8",
                  fontSize: "12px",
                  textTransform: "uppercase",
                  letterSpacing: "0.05em",
                  borderBottom: "1px solid #334155"
                }}>
                  Target
                </th>
              </tr>
            </thead>
            <tbody>
              {filteredExposures.map((team, index) => (
                <tr key={team.team} style={{ 
                  backgroundColor: "#1E293B",
                  borderBottom: "1px solid #334155"
                }}>
                  <td style={{ 
                    padding: "16px 20px", 
                    fontWeight: "600",
                    color: "#F1F5F9",
                    fontSize: "14px"
                  }}>
                    {team.team}
                  </td>
                  <td style={{ 
                    padding: "16px 20px", 
                    textAlign: "center",
                    fontWeight: "500",
                    color: "#F1F5F9",
                    fontSize: "14px"
                  }}>
                    {team.projPoints}
                  </td>
                  <td style={{ 
                    padding: "16px 20px", 
                    textAlign: "center",
                    fontWeight: "600",
                    fontSize: "14px"
                  }}>
                    <span style={{ 
                      color: activeStackSize === "all" || activeStackSize === "4" ? 
                        (team.fourManExp > 30 ? "#10B981" : team.fourManExp > 15 ? "#F59E0B" : "#EF4444") :
                        activeStackSize === "3" ?
                        (team.threeManExp > 30 ? "#10B981" : team.threeManExp > 15 ? "#F59E0B" : "#EF4444") :
                        (team.twoManExp > 30 ? "#10B981" : team.twoManExp > 15 ? "#F59E0B" : "#EF4444")
                    }}>
                      {activeStackSize === "all" || activeStackSize === "4" ? team.fourManExp :
                       activeStackSize === "3" ? team.threeManExp : team.twoManExp}%
                    </span>
                  </td>
                  <td style={{ 
                    padding: "16px 20px", 
                    textAlign: "center",
                    fontWeight: "500",
                    fontSize: "14px"
                  }}>
                    <input
                      type="number"
                      min="0"
                      max="100"
                      value={targetExposures[`${team.team}_${activeStackSize}_target`] || ""}
                      onChange={(e) => handleTargetExposureChange(team.team, `${activeStackSize}_target`, e.target.value)}
                      placeholder="—"
                      style={{
                        width: "60px",
                        padding: "6px 8px",
                        border: "1px solid #334155",
                        borderRadius: "4px",
                        backgroundColor: "#0F172A",
                        color: "#F1F5F9",
                        textAlign: "center",
                        fontSize: "14px",
                        outline: "none"
                      }}
                      onFocus={(e) => {
                        e.target.style.borderColor = "#059669";
                        e.target.style.backgroundColor = "#1E293B";
                      }}
                      onBlur={(e) => {
                        e.target.style.borderColor = "#334155";
                        e.target.style.backgroundColor = "#0F172A";
                      }}
                    />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
      
      {/* Action Buttons */}
      <div style={{ 
        display: "flex", 
        justifyContent: "flex-end", 
        gap: "12px", 
        marginTop: "24px" 
      }}>
        <button
          onClick={clearTargets}
          style={{
            padding: "10px 20px",
            backgroundColor: "transparent",
            color: "#94A3B8",
            border: "1px solid #334155",
            borderRadius: "6px",
            fontSize: "14px",
            fontWeight: "500",
            cursor: "pointer",
            transition: "all 0.2s ease"
          }}
          onMouseOver={(e) => {
            e.target.style.backgroundColor = "#334155";
            e.target.style.color = "#F1F5F9";
          }}
          onMouseOut={(e) => {
            e.target.style.backgroundColor = "transparent";
            e.target.style.color = "#94A3B8";
          }}
        >
          Clear Targets
        </button>
        <button
          onClick={applyTargets}
          style={{
            padding: "10px 20px",
            backgroundColor: "#059669",
            color: "white",
            border: "none",
            borderRadius: "6px",
            fontSize: "14px",
            fontWeight: "500",
            cursor: "pointer",
            transition: "all 0.2s ease"
          }}
          onMouseOver={(e) => {
            e.target.style.backgroundColor = "#047857";
          }}
          onMouseOut={(e) => {
            e.target.style.backgroundColor = "#059669";
          }}
        >
          Apply Targets
        </button>
      </div>
    </div>
  );
};

export default StackExposure;