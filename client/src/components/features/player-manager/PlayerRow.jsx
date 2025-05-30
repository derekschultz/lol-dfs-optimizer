import React from "react";

const PlayerRow = ({
  player,
  index,
  isSelected,
  isLoading,
  onSelect,
  onDelete,
}) => {
  return (
    <tr
      style={{
        backgroundColor: index % 2 === 0 ? "#1a202c" : "#2d3748",
        opacity: isSelected ? 0.7 : 1,
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
          checked={isSelected}
          onChange={() => onSelect(player.id)}
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
          onClick={() => onDelete(player)}
          disabled={isLoading}
        >
          Delete
        </button>
      </td>
    </tr>
  );
};

export default PlayerRow;
