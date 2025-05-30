import React from "react";

const PlayerActions = ({
  selectedCount,
  filteredPlayersLength,
  isLoading,
  onSelectAll,
  onDeleteSelected,
  isAllSelected,
}) => {
  return (
    <div style={{ display: "flex", gap: "0.5rem" }}>
      <button
        className="btn"
        onClick={onSelectAll}
        disabled={filteredPlayersLength === 0}
      >
        {isAllSelected ? "Deselect All" : "Select All"}
      </button>
      <button
        className="btn"
        style={{ backgroundColor: "#e53e3e", color: "white" }}
        onClick={onDeleteSelected}
        disabled={selectedCount === 0 || isLoading}
      >
        Delete Selected ({selectedCount})
      </button>
    </div>
  );
};

export default PlayerActions;
