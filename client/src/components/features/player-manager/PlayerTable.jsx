import React from "react";
import PlayerRow from "./PlayerRow";

const PlayerTable = ({
  filteredPlayers,
  selectedPlayers,
  isLoading,
  playerData,
  onSelectAll,
  onPlayerSelect,
  onDeletePlayer,
}) => {
  const isAllSelected =
    filteredPlayers.length > 0 &&
    selectedPlayers.size === filteredPlayers.length;

  return (
    <>
      <div style={{ overflowX: "auto", maxHeight: "600px", overflowY: "auto" }}>
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
                  checked={isAllSelected}
                  onChange={onSelectAll}
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
              <PlayerRow
                key={player.id}
                player={player}
                index={index}
                isSelected={selectedPlayers.has(player.id)}
                isLoading={isLoading}
                onSelect={onPlayerSelect}
                onDelete={onDeletePlayer}
              />
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
    </>
  );
};

export default PlayerTable;
