import React, { useState } from "react";

const SortControls = ({
  sortBy,
  setSortBy,
  sortDirection,
  setSortDirection,
}) => {
  const [showTooltip, setShowTooltip] = useState(null);

  const sortOptions = [
    {
      key: "nexusScore",
      label: "NexusScore",
      tooltip:
        "NexusScore: A proprietary scoring algorithm that evaluates lineup quality based on projections, ownership leverage, and team stacking",
    },
    {
      key: "roi",
      label: "ROI",
      tooltip:
        "ROI: Return on Investment calculated using expected value from finish distributions, considering lineup strength, correlation, and contest payout structure",
    },
    {
      key: "projection",
      label: "Projection",
    },
    {
      key: "ownership",
      label: "Ownership",
    },
    {
      key: "firstPlace",
      label: "1st Place %",
    },
  ];

  return (
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
          position: "relative",
        }}
      >
        {sortOptions.map((option) => (
          <button
            key={option.key}
            onClick={() => setSortBy(option.key)}
            onMouseEnter={() =>
              option.tooltip && setShowTooltip(`sort-${option.key}`)
            }
            onMouseLeave={() => setShowTooltip(null)}
            style={{
              padding: "0.5rem 0.75rem",
              background: sortBy === option.key ? "#1a202c" : "transparent",
              border: "none",
              color: sortBy === option.key ? "#4fd1c5" : "#a0aec0",
              cursor: "pointer",
              position: "relative",
            }}
            title={option.tooltip}
          >
            {option.label}
          </button>
        ))}

        <button
          onClick={() =>
            setSortDirection(sortDirection === "asc" ? "desc" : "asc")
          }
          style={{
            padding: "0.5rem 0.75rem",
            background: "#2d3748",
            border: "none",
            color: "#4fd1c5",
            cursor: "pointer",
            borderLeft: "1px solid #4a5568",
          }}
        >
          {sortDirection === "asc" ? "↑" : "↓"}
        </button>
      </div>
    </div>
  );
};

export default SortControls;
