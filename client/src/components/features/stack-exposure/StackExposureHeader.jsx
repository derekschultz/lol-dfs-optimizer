import React from "react";

const StackExposureHeader = ({ playerData, lineups }) => {
  const getDescription = () => {
    if (!playerData || playerData.length === 0) {
      return "Upload player projections (ROO) and team stacks to view and set target exposures";
    }
    if (lineups.length > 0) {
      return `Track and manage team stack exposure percentages across your ${lineups.length} lineups`;
    }
    return "Set target stack exposure percentages before generating lineups";
  };

  return (
    <div style={{ marginBottom: "24px" }}>
      <h2
        style={{
          fontSize: "24px",
          fontWeight: "600",
          color: "#38BDF8",
          margin: "0 0 8px 0",
        }}
      >
        Team Stack Exposure
      </h2>
      <p
        style={{
          fontSize: "14px",
          color: "#64748B",
          margin: 0,
        }}
      >
        {getDescription()}
      </p>
    </div>
  );
};

export default StackExposureHeader;
