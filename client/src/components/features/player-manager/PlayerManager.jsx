import React, { useState, useEffect } from "react";
import {
  PlayerStats,
  PlayerActions,
  PlayerFilters,
  PlayerTable,
} from "./index";

const PlayerManager = ({
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

    // Sort players
    filtered.sort((a, b) => {
      const aVal = a[sortBy];
      const bVal = b[sortBy];

      if (typeof aVal === "number" && typeof bVal === "number") {
        return sortOrder === "asc" ? aVal - bVal : bVal - aVal;
      } else if (typeof aVal === "string" && typeof bVal === "string") {
        return sortOrder === "asc"
          ? aVal.localeCompare(bVal)
          : bVal.localeCompare(aVal);
      }
      return 0;
    });

    setFilteredPlayers(filtered);
  }, [playerData, searchTerm, filterTeam, filterPosition, sortBy, sortOrder]);

  const handleSelectAll = () => {
    if (selectedPlayers.size === filteredPlayers.length) {
      setSelectedPlayers(new Set());
    } else {
      setSelectedPlayers(new Set(filteredPlayers.map((p) => p.id)));
    }
  };

  const handlePlayerSelect = (playerId) => {
    const newSelected = new Set(selectedPlayers);
    if (newSelected.has(playerId)) {
      newSelected.delete(playerId);
    } else {
      newSelected.add(playerId);
    }
    setSelectedPlayers(newSelected);
  };

  const handleDeleteSelected = async () => {
    if (selectedPlayers.size === 0) {
      displayNotification("No players selected for deletion", "warning");
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
        `Successfully deleted ${result.data.deletedPlayers.length} players`,
        "success"
      );

      if (result.data.notFoundIds && result.data.notFoundIds.length > 0) {
        displayNotification(
          `Warning: ${result.data.notFoundIds.length} players were not found`,
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

  const handleDeletePlayer = async (player) => {
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

  const isAllSelected =
    filteredPlayers.length > 0 &&
    selectedPlayers.size === filteredPlayers.length;

  return (
    <div className="card">
      {/* Header with Stats and Actions */}
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          marginBottom: "1rem",
        }}
      >
        <PlayerStats totalPlayers={playerData.length} />
        <PlayerActions
          selectedCount={selectedPlayers.size}
          filteredPlayersLength={filteredPlayers.length}
          isLoading={isLoading}
          onSelectAll={handleSelectAll}
          onDeleteSelected={handleDeleteSelected}
          isAllSelected={isAllSelected}
        />
      </div>

      {/* Filters */}
      <PlayerFilters
        searchTerm={searchTerm}
        setSearchTerm={setSearchTerm}
        filterTeam={filterTeam}
        setFilterTeam={setFilterTeam}
        filterPosition={filterPosition}
        setFilterPosition={setFilterPosition}
        sortBy={sortBy}
        setSortBy={setSortBy}
        sortOrder={sortOrder}
        setSortOrder={setSortOrder}
        teams={teams}
        positions={positions}
      />

      {/* Player Table */}
      <PlayerTable
        filteredPlayers={filteredPlayers}
        selectedPlayers={selectedPlayers}
        isLoading={isLoading}
        playerData={playerData}
        onSelectAll={handleSelectAll}
        onPlayerSelect={handlePlayerSelect}
        onDeletePlayer={handleDeletePlayer}
      />

      {/* Loading Overlay */}
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

export default PlayerManager;
