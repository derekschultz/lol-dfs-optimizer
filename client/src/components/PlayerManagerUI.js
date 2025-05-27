import React, { useState, useEffect } from "react";

const PlayerManagerUI = ({
  playerData,
  onPlayersUpdated,
  displayNotification,
  API_BASE_URL,
}) => {
  const [filteredPlayers, setFilteredPlayers] = useState([]);
  const [selectedPlayers, setSelectedPlayers] = useState(new Set());
  const [searchTerm, setSearchTerm] = useState("");
  const [filterTeam, setFilterTeam] = useState("");
  const [filterPosition, setFilterPosition] = useState("");
  const [sortBy, setSortBy] = useState("projectedPoints");
  const [sortOrder, setSortOrder] = useState("desc");
  const [isLoading, setIsLoading] = useState(false);

  // Get unique teams and positions for filters
  const teams = [...new Set(playerData.map((p) => p.team))]
    .filter(Boolean)
    .sort();
  const positions = [...new Set(playerData.map((p) => p.position))]
    .filter(Boolean)
    .sort();

  // Filter and sort players
  useEffect(() => {
    let filtered = [...playerData];

    // Apply search filter
    if (searchTerm) {
      filtered = filtered.filter(
        (player) =>
          player.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
          player.team.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    // Apply team filter
    if (filterTeam) {
      filtered = filtered.filter((player) => player.team === filterTeam);
    }

    // Apply position filter
    if (filterPosition) {
      filtered = filtered.filter(
        (player) => player.position === filterPosition
      );
    }

    // Apply sorting
    filtered.sort((a, b) => {
      let aVal = a[sortBy];
      let bVal = b[sortBy];

      // Handle numeric values
      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
      }

      // Handle string values
      if (typeof aVal === "string" && typeof bVal === "string") {
        return sortOrder === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }

      return 0;
    });

    setFilteredPlayers(filtered);
  }, [playerData, searchTerm, filterTeam, filterPosition, sortBy, sortOrder]);

  // Handle select all/none
  const handleSelectAll = () => {
    if (selectedPlayers.size === filteredPlayers.length) {
      setSelectedPlayers(new Set());
    } else {
      setSelectedPlayers(new Set(filteredPlayers.map((p) => p.id)));
    }
  };

  // Handle individual player selection
  const handlePlayerSelect = (playerId) => {
    const newSelected = new Set(selectedPlayers);
    if (newSelected.has(playerId)) {
      newSelected.delete(playerId);
    } else {
      newSelected.add(playerId);
    }
    setSelectedPlayers(newSelected);
  };

  // Delete selected players
  const handleDeleteSelected = async () => {
    if (selectedPlayers.size === 0) {
      displayNotification("No players selected for deletion", "warning");
      return;
    }

    const playerNames = filteredPlayers
      .filter((p) => selectedPlayers.has(p.id))
      .map((p) => p.name)
      .join(", ");

    if (
      !window.confirm(
        `Are you sure you want to delete ${selectedPlayers.size} player(s): ${playerNames}?`
      )
    ) {
      return;
    }

    try {
      setIsLoading(true);

      const response = await fetch(`${API_BASE_URL}/players/bulk`, {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          playerIds: Array.from(selectedPlayers),
        }),
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete players");
      }

      const result = await response.json();

      // Clear selection
      setSelectedPlayers(new Set());

      // Refresh player data
      const updatedPlayers = playerData.filter(
        (p) => !selectedPlayers.has(p.id)
      );
      onPlayersUpdated(updatedPlayers);

      displayNotification(
        `Successfully deleted ${result.deletedPlayers.length} players`,
        "success"
      );

      if (result.notFoundIds && result.notFoundIds.length > 0) {
        displayNotification(
          `Warning: ${result.notFoundIds.length} players were not found`,
          "warning"
        );
      }
    } catch (error) {
      console.error("Error deleting players:", error);
      displayNotification(`Error deleting players: ${error.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  // Delete single player
  const handleDeletePlayer = async (player) => {
    if (
      !window.confirm(
        `Are you sure you want to delete ${player.name} (${player.team} - ${player.position})?`
      )
    ) {
      return;
    }

    try {
      setIsLoading(true);

      const response = await fetch(`${API_BASE_URL}/players/${player.id}`, {
        method: "DELETE",
      });

      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.message || "Failed to delete player");
      }

      // Remove from selection if selected
      const newSelected = new Set(selectedPlayers);
      newSelected.delete(player.id);
      setSelectedPlayers(newSelected);

      // Refresh player data
      const updatedPlayers = playerData.filter((p) => p.id !== player.id);
      onPlayersUpdated(updatedPlayers);

      displayNotification(`Successfully deleted ${player.name}`, "success");
    } catch (error) {
      console.error("Error deleting player:", error);
      displayNotification(`Error deleting player: ${error.message}`, "error");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="card">
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <h2 className="card-title">
          Player Management ({playerData.length} players)
        </h2>
        <div style={{ display: "flex", gap: "0.5rem" }}>
          <button
            className="btn"
            onClick={handleSelectAll}
            disabled={filteredPlayers.length === 0}
          >
            {selectedPlayers.size === filteredPlayers.length
              ? "Deselect All"
              : "Select All"}
          </button>
          <button
            className="btn"
            style={{ backgroundColor: "#e53e3e", color: "white" }}
            onClick={handleDeleteSelected}
            disabled={selectedPlayers.size === 0 || isLoading}
          >
            Delete Selected ({selectedPlayers.size})
          </button>
        </div>
      </div>

      {/* Filters */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "1fr 1fr 1fr 1fr 1fr",
          gap: "1rem",
          marginBottom: "1rem",
        }}
      >
        <div>
          <label className="form-label">Search</label>
          <input
            type="text"
            placeholder="Search players..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            style={{ width: "100%", padding: "0.5rem" }}
          />
        </div>
        <div>
          <label className="form-label">Team</label>
          <select
            value={filterTeam}
            onChange={(e) => setFilterTeam(e.target.value)}
            style={{ width: "100%", padding: "0.5rem" }}
          >
            <option value="">All Teams</option>
            {teams.map((team) => (
              <option key={team} value={team}>
                {team}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">Position</label>
          <select
            value={filterPosition}
            onChange={(e) => setFilterPosition(e.target.value)}
            style={{ width: "100%", padding: "0.5rem" }}
          >
            <option value="">All Positions</option>
            {positions.map((position) => (
              <option key={position} value={position}>
                {position}
              </option>
            ))}
          </select>
        </div>
        <div>
          <label className="form-label">Sort By</label>
          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value)}
            style={{ width: "100%", padding: "0.5rem" }}
          >
            <option value="projectedPoints">Projected Points</option>
            <option value="name">Name</option>
            <option value="team">Team</option>
            <option value="position">Position</option>
            <option value="salary">Salary</option>
            <option value="ownership">Ownership</option>
            <option value="value">Value</option>
          </select>
        </div>
        <div>
          <label className="form-label">Order</label>
          <select
            value={sortOrder}
            onChange={(e) => setSortOrder(e.target.value)}
            style={{ width: "100%", padding: "0.5rem" }}
          >
            <option value="desc">Descending</option>
            <option value="asc">Ascending</option>
          </select>
        </div>
      </div>

      {/* Player Table */}
      <div style={{ maxHeight: "600px", overflowY: "auto" }}>
        <table style={{ width: "100%", borderCollapse: "collapse" }}>
          <thead
            style={{
              position: "sticky",
              top: 0,
              backgroundColor: "#2d3748",
              zIndex: 1,
            }}
          >
            <tr>
              <th
                style={{
                  padding: "0.75rem",
                  textAlign: "left",
                  borderBottom: "1px solid #4a5568",
                }}
              >
                <input
                  type="checkbox"
                  checked={
                    filteredPlayers.length > 0 &&
                    selectedPlayers.size === filteredPlayers.length
                  }
                  onChange={handleSelectAll}
                />
              </th>
              <th
                style={{
                  padding: "0.75rem",
                  textAlign: "left",
                  borderBottom: "1px solid #4a5568",
                }}
              >
                Name
              </th>
              <th
                style={{
                  padding: "0.75rem",
                  textAlign: "left",
                  borderBottom: "1px solid #4a5568",
                }}
              >
                Team
              </th>
              <th
                style={{
                  padding: "0.75rem",
                  textAlign: "left",
                  borderBottom: "1px solid #4a5568",
                }}
              >
                Position
              </th>
              <th
                style={{
                  padding: "0.75rem",
                  textAlign: "right",
                  borderBottom: "1px solid #4a5568",
                }}
              >
                Proj
              </th>
              <th
                style={{
                  padding: "0.75rem",
                  textAlign: "right",
                  borderBottom: "1px solid #4a5568",
                }}
              >
                Salary
              </th>
              <th
                style={{
                  padding: "0.75rem",
                  textAlign: "right",
                  borderBottom: "1px solid #4a5568",
                }}
              >
                Own%
              </th>
              <th
                style={{
                  padding: "0.75rem",
                  textAlign: "right",
                  borderBottom: "1px solid #4a5568",
                }}
              >
                Value
              </th>
              <th
                style={{
                  padding: "0.75rem",
                  textAlign: "center",
                  borderBottom: "1px solid #4a5568",
                }}
              >
                Actions
              </th>
            </tr>
          </thead>
          <tbody>
            {filteredPlayers.map((player, index) => (
              <tr
                key={player.id}
                style={{
                  backgroundColor: index % 2 === 0 ? "#1a202c" : "#2d3748",
                  opacity: selectedPlayers.has(player.id) ? 0.7 : 1,
                }}
              >
                <td
                  style={{
                    padding: "0.75rem",
                    borderBottom: "1px solid #4a5568",
                  }}
                >
                  <input
                    type="checkbox"
                    checked={selectedPlayers.has(player.id)}
                    onChange={() => handlePlayerSelect(player.id)}
                  />
                </td>
                <td
                  style={{
                    padding: "0.75rem",
                    borderBottom: "1px solid #4a5568",
                    fontWeight: "bold",
                  }}
                >
                  {player.name}
                </td>
                <td
                  style={{
                    padding: "0.75rem",
                    borderBottom: "1px solid #4a5568",
                  }}
                >
                  {player.team}
                </td>
                <td
                  style={{
                    padding: "0.75rem",
                    borderBottom: "1px solid #4a5568",
                  }}
                >
                  <span
                    style={{
                      padding: "0.25rem 0.5rem",
                      borderRadius: "0.25rem",
                      backgroundColor: "#4a5568",
                      fontSize: "0.75rem",
                    }}
                  >
                    {player.position}
                  </span>
                </td>
                <td
                  style={{
                    padding: "0.75rem",
                    borderBottom: "1px solid #4a5568",
                    textAlign: "right",
                  }}
                >
                  {player.projectedPoints?.toFixed(1) || "N/A"}
                </td>
                <td
                  style={{
                    padding: "0.75rem",
                    borderBottom: "1px solid #4a5568",
                    textAlign: "right",
                  }}
                >
                  ${player.salary?.toLocaleString() || "N/A"}
                </td>
                <td
                  style={{
                    padding: "0.75rem",
                    borderBottom: "1px solid #4a5568",
                    textAlign: "right",
                  }}
                >
                  {player.ownership?.toFixed(1) || "N/A"}%
                </td>
                <td
                  style={{
                    padding: "0.75rem",
                    borderBottom: "1px solid #4a5568",
                    textAlign: "right",
                  }}
                >
                  {player.value || "N/A"}
                </td>
                <td
                  style={{
                    padding: "0.75rem",
                    borderBottom: "1px solid #4a5568",
                    textAlign: "center",
                  }}
                >
                  <button
                    className="btn"
                    style={{
                      backgroundColor: "#e53e3e",
                      color: "white",
                      padding: "0.25rem 0.5rem",
                      fontSize: "0.75rem",
                    }}
                    onClick={() => handleDeletePlayer(player)}
                    disabled={isLoading}
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {filteredPlayers.length === 0 && (
        <div style={{ textAlign: "center", padding: "2rem", color: "#a0aec0" }}>
          {playerData.length === 0
            ? "No players loaded"
            : "No players match the current filters"}
        </div>
      )}

      {isLoading && (
        <div
          style={{
            position: "absolute",
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: "rgba(0,0,0,0.5)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            color: "white",
          }}
        >
          Processing...
        </div>
      )}
    </div>
  );
};

export default PlayerManagerUI;
