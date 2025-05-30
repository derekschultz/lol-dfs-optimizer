import React from "react";

const StackExposureStats = ({
  lineups,
  filteredExposures,
  activeStackSize,
}) => {
  const getTeamsWithStacksCount = () => {
    return filteredExposures.filter((team) => {
      if (activeStackSize === "all" || activeStackSize === "4")
        return team.fourManExp > 0;
      if (activeStackSize === "3") return team.threeManExp > 0;
      if (activeStackSize === "2") return team.twoManExp > 0;
      return false;
    }).length;
  };

  const getAverageExposure = () => {
    if (filteredExposures.length === 0) return 0;

    return Math.round(
      filteredExposures.reduce((sum, team) => {
        if (activeStackSize === "all" || activeStackSize === "4")
          return sum + team.fourManExp;
        if (activeStackSize === "3") return sum + team.threeManExp;
        if (activeStackSize === "2") return sum + team.twoManExp;
        return sum;
      }, 0) / filteredExposures.length
    );
  };

  const getStackSizeLabel = () => {
    return activeStackSize === "all" ? "4" : activeStackSize;
  };

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "repeat(3, 1fr)",
        gap: "16px",
        marginBottom: "24px",
      }}
    >
      <div
        style={{
          backgroundColor: "#1E293B",
          padding: "20px",
          borderRadius: "8px",
          border: "1px solid #334155",
        }}
      >
        <p style={{ fontSize: "14px", color: "#94A3B8", margin: "0 0 8px 0" }}>
          Total Lineups
        </p>
        <p
          style={{
            fontSize: "32px",
            fontWeight: "600",
            color: "#F1F5F9",
            margin: 0,
          }}
        >
          {lineups.length}
        </p>
      </div>

      <div
        style={{
          backgroundColor: "#1E293B",
          padding: "20px",
          borderRadius: "8px",
          border: "1px solid #334155",
        }}
      >
        <p style={{ fontSize: "14px", color: "#94A3B8", margin: "0 0 8px 0" }}>
          Teams with {getStackSizeLabel()}-stacks
        </p>
        <p
          style={{
            fontSize: "32px",
            fontWeight: "600",
            color: "#F1F5F9",
            margin: 0,
          }}
        >
          {getTeamsWithStacksCount()}
        </p>
      </div>

      <div
        style={{
          backgroundColor: "#1E293B",
          padding: "20px",
          borderRadius: "8px",
          border: "1px solid #334155",
        }}
      >
        <p style={{ fontSize: "14px", color: "#94A3B8", margin: "0 0 8px 0" }}>
          Avg Exposure
        </p>
        <p
          style={{
            fontSize: "32px",
            fontWeight: "600",
            color: "#F1F5F9",
            margin: 0,
          }}
        >
          {getAverageExposure()}%
        </p>
      </div>
    </div>
  );
};

export default StackExposureStats;
